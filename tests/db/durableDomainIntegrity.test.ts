import { describe, expect, it } from "vitest";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import {
  inspectCharacterImportTransitionHistoryDomainIntegrity,
  inspectCharacterPhysicsDomainIntegrity,
  inspectLongitudinalCommitAuditDomainIntegrity,
  inspectParameterAdjustmentHistoryDomainIntegrity,
} from "../../src/db/repositories/durableDomainIntegrity";

describe("Durable domain integrity adapter", () => {
  it("accepts domain-consistent payloads for all four repositories", () => {
    expect(inspectCharacterPhysicsDomainIntegrity(validCharacterPhysicsPayload())).toEqual({ valid: true, issues: [] });
    expect(inspectParameterAdjustmentHistoryDomainIntegrity(validAdjustmentPayload())).toEqual({ valid: true, issues: [] });
    expect(inspectCharacterImportTransitionHistoryDomainIntegrity(validImportPayload())).toEqual({ valid: true, issues: [] });
    expect(inspectLongitudinalCommitAuditDomainIntegrity(validLongitudinalPayload())).toEqual({ valid: true, issues: [] });
  });

  it("clones every payload and never mutates caller-owned data", () => {
    const cases: Array<[unknown, (value: unknown) => unknown]> = [
      [validCharacterPhysicsPayload(), inspectCharacterPhysicsDomainIntegrity],
      [validAdjustmentPayload(), inspectParameterAdjustmentHistoryDomainIntegrity],
      [validImportPayload(), inspectCharacterImportTransitionHistoryDomainIntegrity],
      [validLongitudinalPayload(), inspectLongitudinalCommitAuditDomainIntegrity],
    ];

    for (const [payload, inspect] of cases) {
      const before = JSON.stringify(payload);
      inspect(payload);
      expect(JSON.stringify(payload)).toBe(before);
    }
  });

  it("uses CRITICAL when a structurally valid character state cannot be deserialized", () => {
    const payload = validCharacterPhysicsPayload();
    payload.character.parameterSetVersion = "unsupported-parameter-set";

    expect(inspectCharacterPhysicsDomainIntegrity(payload)).toEqual({
      valid: false,
      issues: [{
        code: "CHARACTER_STATE_DESERIALIZATION_FAILED",
        path: "records[0].value",
        severity: "CRITICAL",
        message: "Character state could not be deserialized for domain inspection.",
      }],
    });
  });

  it("maps character integrity errors and warnings without exposing raw domain values", () => {
    const errorPayload = validCharacterPhysicsPayload();
    errorPayload.character.coordinate.values.trust = 2;
    const secret = "PRIVATE MEMORY CONTENT";
    errorPayload.character.memories = [{
      id: "memory-secret",
      content: secret,
      vector: errorPayload.character.coordinate,
      importance: 0.8,
      emotion: "fear",
      recency: 0.8,
      repetitionCount: 1,
      beliefEffect: "PRIVATE BELIEF CONTENT",
      timeStamp: "2026-01-01T00:00:00.000Z",
      clusterId: "missing-private-cluster",
    }];

    const errorResult = inspectCharacterPhysicsDomainIntegrity(errorPayload);
    expect(errorResult.valid).toBe(false);
    expect(errorResult.issues.map((issue) => issue.severity)).toContain("ERROR");
    expect(JSON.stringify(errorResult)).not.toContain(secret);
    expect(JSON.stringify(errorResult)).not.toContain("PRIVATE BELIEF CONTENT");
    expect(JSON.stringify(errorResult)).not.toContain("missing-private-cluster");

    const warningPayload = validCharacterPhysicsPayload();
    warningPayload.character.proceduralRoutines = [{
      id: "routine-1",
      cueTags: [],
      action: "pause",
      strength: 0.4,
      repetitionCount: 1,
    }];
    const warningResult = inspectCharacterPhysicsDomainIntegrity(warningPayload);
    expect(warningResult.valid).toBe(true);
    expect(warningResult.issues).toEqual([expect.objectContaining({ severity: "WARNING" })]);
  });

  it("detects cross-field inconsistencies in all history repositories", () => {
    const adjustment = validAdjustmentPayload();
    adjustment.character[0]!.characterId = "different-character";
    adjustment.character[0]!.operationCount = 2;
    expect(issueCodes(inspectParameterAdjustmentHistoryDomainIntegrity(adjustment))).toEqual([
      "ADJUSTMENT_CHARACTER_KEY_MISMATCH",
      "ADJUSTMENT_OPERATION_COUNT_MISMATCH",
    ]);

    const importHistory = validImportPayload();
    importHistory.character[0]!.status = "applied";
    expect(issueCodes(inspectCharacterImportTransitionHistoryDomainIntegrity(importHistory))).toEqual([
      "IMPORT_STATUS_MISMATCH",
    ]);

    const longitudinal = validLongitudinalPayload();
    longitudinal.character[0]!.rollbackPlan.simulationId = "different-simulation";
    expect(issueCodes(inspectLongitudinalCommitAuditDomainIntegrity(longitudinal))).toEqual([
      "LONGITUDINAL_ROLLBACK_SIMULATION_MISMATCH",
    ]);
  });

  it("returns a stable classification for the same domain damage", () => {
    const first = {
      beta: [],
      alpha: [{
        id: "duplicate",
        characterId: "wrong",
        action: "apply",
        status: "applied",
        snapshotId: "snapshot",
        operationCount: 2,
        targetPaths: ["a"],
        createdAt: "not-a-time",
        reasons: [],
      }],
    };
    const second = {
      alpha: [{
        reasons: [],
        createdAt: "not-a-time",
        targetPaths: ["a"],
        operationCount: 2,
        snapshotId: "snapshot",
        status: "applied",
        action: "apply",
        characterId: "wrong",
        id: "duplicate",
      }],
      beta: [],
    };

    expect(inspectParameterAdjustmentHistoryDomainIntegrity(first))
      .toEqual(inspectParameterAdjustmentHistoryDomainIntegrity(second));
  });

  it("fails safely when domain inspection receives a structurally invalid payload", () => {
    expect(inspectLongitudinalCommitAuditDomainIntegrity({ character: "invalid" })).toEqual({
      valid: false,
      issues: [{
        code: "DOMAIN_PAYLOAD_PRECONDITION_FAILED",
        path: "$",
        severity: "CRITICAL",
        message: "Domain inspection requires a structurally valid repository payload.",
      }],
    });
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
      reasons: ["fixture"],
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

function issueCodes(result: { issues: readonly { code: string }[] }): string[] {
  return result.issues.map((issue) => issue.code).sort();
}
