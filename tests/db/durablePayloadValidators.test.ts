import { describe, expect, it } from "vitest";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import {
  validateCharacterImportTransitionHistoryPayload,
  validateCharacterPhysicsPayload,
  validateLongitudinalCommitAuditPayload,
  validateParameterAdjustmentHistoryPayload,
} from "../../src/db/repositories/durablePayloadValidators";

describe("Durable payload runtime validators", () => {
  it("accepts valid payloads for all four durable repositories", () => {
    const results = [
      validateCharacterPhysicsPayload(validCharacterPhysicsPayload()),
      validateParameterAdjustmentHistoryPayload(validAdjustmentPayload()),
      validateCharacterImportTransitionHistoryPayload(validImportPayload()),
      validateLongitudinalCommitAuditPayload(validLongitudinalPayload()),
    ];

    expect(results).toEqual([
      { valid: true, issues: [] },
      { valid: true, issues: [] },
      { valid: true, issues: [] },
      { valid: true, issues: [] },
    ]);
  });

  it("classifies malformed payloads for every repository kind", () => {
    const physics = validCharacterPhysicsPayload();
    (physics.character as unknown as Record<string, unknown>).coordinate = null;
    const adjustment = validAdjustmentPayload();
    adjustment.character[0]!.operationCount = -1;
    const importHistory = validImportPayload();
    (importHistory.character[0]! as unknown as Record<string, unknown>).trace = null;
    const longitudinal = validLongitudinalPayload();
    longitudinal.character[0]!.status = "unknown";

    expect(validateCharacterPhysicsPayload(physics)).toMatchObject({
      valid: false,
      issues: [{ code: "COORDINATE_OBJECT_REQUIRED", severity: "ERROR" }],
    });
    expect(validateParameterAdjustmentHistoryPayload(adjustment)).toMatchObject({
      valid: false,
      issues: [{ code: "ADJUSTMENT_OPERATION_COUNT_INVALID", severity: "ERROR" }],
    });
    expect(validateCharacterImportTransitionHistoryPayload(importHistory)).toMatchObject({
      valid: false,
      issues: [{ code: "IMPORT_TRACE_OBJECT_REQUIRED", severity: "ERROR" }],
    });
    expect(validateLongitudinalCommitAuditPayload(longitudinal)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "LONGITUDINAL_STATUS_INVALID", severity: "ERROR" }),
      ]),
    });
  });

  it("returns identical classifications for the same damage with different key insertion order", () => {
    const normal = {
      beta: [],
      alpha: [{
        id: "entry",
        characterId: "alpha",
        action: "apply",
        status: "applied",
        snapshotId: "snapshot",
        operationCount: -1,
        targetPaths: [1],
        createdAt: "2026-01-01T00:00:00.000Z",
        reasons: [],
      }],
    };
    const reversed = {
      alpha: [{
        reasons: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        targetPaths: [1],
        operationCount: -1,
        snapshotId: "snapshot",
        status: "applied",
        action: "apply",
        characterId: "alpha",
        id: "entry",
      }],
      beta: [],
    };

    expect(validateParameterAdjustmentHistoryPayload(normal))
      .toEqual(validateParameterAdjustmentHistoryPayload(reversed));
  });

  it("sorts issues deterministically by safe structural paths", () => {
    const result = validateParameterAdjustmentHistoryPayload({
      zeta: "not-an-array",
      alpha: [{ id: "", characterId: "", action: "bad" }],
    });
    const paths = result.issues.map((issue) => issue.path);
    const sortedPaths = [...paths].sort(compareText);

    expect(paths).toEqual(sortedPaths);
    expect(paths.every((path) => !path.includes("alpha") && !path.includes("zeta"))).toBe(true);
  });

  it("never copies memory text or invalid raw values into issues", () => {
    const secret = "PRIVATE MEMORY TEXT MUST NOT LEAK";
    const payload = validCharacterPhysicsPayload();
    (payload.character as unknown as { memories: unknown[] }).memories = [{
      id: "memory-1",
      content: secret,
      vector: payload.character.coordinate,
      importance: "invalid",
      emotion: "fear",
      recency: 0.8,
      repetitionCount: 1,
      beliefEffect: "private belief",
      timeStamp: "2026-01-01T00:00:00.000Z",
    }];

    const serialized = JSON.stringify(validateCharacterPhysicsPayload(payload));
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("private belief");
    expect(serialized).not.toContain('"invalid"');
  });

  it("classifies non-object roots without throwing", () => {
    for (const value of [null, [], "text", 1]) {
      expect(validateCharacterPhysicsPayload(value)).toEqual({
        valid: false,
        issues: [{
          code: "STORE_ROOT_OBJECT_REQUIRED",
          path: "$",
          severity: "ERROR",
          message: "Repository payload must be an object.",
        }],
      });
    }
  });
});

function validCharacterPhysicsPayload() {
  const state = serializeCharacterPhysicsState(createCharacterPhysicsState());
  if (!state.identity) throw new Error("Character fixture requires an identity.");
  state.identity.id = "character";
  return { character: state };
}

function validAdjustmentPayload() {
  return {
    character: [{
      id: "adjustment-1",
      characterId: "character",
      action: "apply",
      status: "applied",
      snapshotId: "snapshot-1",
      operationCount: 1,
      targetPaths: ["coordinate.values.trust"],
      createdAt: "2026-01-01T00:00:00.000Z",
      reasons: ["test fixture"],
    }],
  };
}

function validImportPayload() {
  return {
    character: [{
      id: "import-1",
      characterId: "character",
      createdAt: "2026-01-01T00:00:00.000Z",
      status: "blocked",
      confirmationRequired: "confirm import",
      trace: {
        status: "blocked",
        targetCharacterId: "character",
        confirmationRequired: "confirm import",
        plan: {},
        transactionSteps: [{
          name: "authorization_checked",
          status: "blocked",
          message: "blocked fixture",
        }],
        transactionSummary: {
          terminalStatus: "blocked",
          totalSteps: 1,
          completedSteps: 0,
          blockedSteps: 1,
          failedSteps: 0,
          stateMutated: false,
          adjustmentHistoryMutated: false,
          historyRecorded: false,
          reasons: [],
        },
        reasons: [],
        errors: [],
      },
    }],
  };
}

function validLongitudinalPayload() {
  const base = digest("a");
  const final = digest("b");
  return {
    character: [{
      version: "v10.24",
      id: "audit-1",
      characterId: "character",
      simulationId: "simulation-1",
      status: "previewed",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      requestDigest: digest("c"),
      baseStateFingerprint: base,
      finalStateFingerprint: final,
      commitPolicy: {},
      changedPaths: [],
      generatedMemoryIds: [],
      beforeSummary: {},
      afterSummary: {},
      governanceStatus: "pass",
      governanceBlockers: [],
      governanceWarnings: [],
      rollbackPlan: {
        id: "rollback-1",
        simulationId: "simulation-1",
        type: "remove_generated_memories",
        generatedMemoryIds: [],
        baseStateFingerprint: base,
        finalStateFingerprint: final,
        staleWritePolicy: "block_if_changed",
        warnings: [],
        reasons: [],
      },
      warnings: [],
      reasons: [],
    }],
  };
}

function digest(character: string) {
  return {
    algorithm: "sha256",
    canonicalization: "characteros-longitudinal-json-v1",
    value: character.repeat(64),
  };
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
