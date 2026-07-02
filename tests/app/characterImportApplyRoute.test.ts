import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/import/apply/route";
import type {
  ApplyCharacterImportResponse,
  CharacterPhysicsExportResponse
} from "../../src/appContracts/characterPhysics";
import { buildImportConfirmationPhrase } from "../../src/core/export/characterImportApply";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

const event = {
  id: "import_apply_event",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "等待", "亲密关系"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9
};

describe("Character import apply API", () => {
  it("blocks import application without explicit confirmation", async () => {
    const targetCharacterId = uniqueCharacterId("import-apply-target");
    characterPhysicsService.resetCharacter(targetCharacterId);
    const pkg = validPackage(uniqueCharacterId("import-apply-source"));

    const response = await POST(jsonRequest({ package: pkg }), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as ApplyCharacterImportResponse;

    expect(response.status).toBe(409);
    expect(body.trace.status).toBe("blocked");
    expect(body.trace.confirmationRequired).toBe(buildImportConfirmationPhrase(targetCharacterId));
    expect(body.trace.transactionSteps.map((step) => step.name)).toEqual([
      "authorization_checked",
      "history_recorded"
    ]);
    expect(body.trace.transactionSteps[0]?.status).toBe("blocked");
    expect(body.trace.transactionSummary).toMatchObject({
      terminalStatus: "blocked",
      totalSteps: 2,
      completedSteps: 1,
      blockedSteps: 1,
      failedSteps: 0,
      stateMutated: false,
      adjustmentHistoryMutated: false,
      historyRecorded: true,
      lastStep: "history_recorded"
    });
    expect(body.trace.historyEntryId).toMatch(/^import_history_[0-9a-f]{16}$/);
    expect(body.trace.historyRecordedAt).toBeDefined();
    expect(body.trace.transitionId).toBeUndefined();
    expect(body.trace.appliedAt).toBeUndefined();
    expect(body.trace.transitionSummary).toBeUndefined();
    expect(body.trace.beforeStateIntegrity).toBeUndefined();
    expect(body.trace.afterStateIntegrity).toBeUndefined();
    expect(body.state.memories).toHaveLength(0);
    expect(characterPhysicsService.getState(targetCharacterId).memories).toHaveLength(0);
  });

  it("applies a ready import package when confirmation matches", async () => {
    const targetCharacterId = uniqueCharacterId("import-apply-target");
    characterPhysicsService.resetCharacter(targetCharacterId);
    const sourceCharacterId = uniqueCharacterId("import-apply-source");
    const pkg = validPackage(sourceCharacterId);

    const response = await POST(jsonRequest({
      package: pkg,
      confirmation: buildImportConfirmationPhrase(targetCharacterId)
    }), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as ApplyCharacterImportResponse;

    expect(response.status).toBe(200);
    expect(body.trace.status).toBe("applied");
    expect(body.trace.sourceCharacterId).toBe(sourceCharacterId);
    expect(body.trace.transactionSteps.map((step) => step.name)).toEqual([
      "authorization_checked",
      "before_state_integrity_inspected",
      "state_deserialized",
      "after_state_integrity_inspected",
      "pre_mutation_snapshot_captured",
      "state_replaced",
      "adjustment_history_replaced",
      "history_recorded"
    ]);
    expect(body.trace.transactionSteps.every((step) => step.status === "completed")).toBe(true);
    expect(body.trace.transactionSummary).toMatchObject({
      terminalStatus: "completed",
      totalSteps: 8,
      completedSteps: 8,
      blockedSteps: 0,
      failedSteps: 0,
      stateMutated: true,
      adjustmentHistoryMutated: true,
      historyRecorded: true,
      lastStep: "history_recorded"
    });
    expect(body.trace.historyEntryId).toMatch(/^import_history_[0-9a-f]{16}$/);
    expect(body.trace.historyRecordedAt).toBeDefined();
    expect(body.trace.transitionId).toMatch(/^import_[0-9a-f]{16}$/);
    expect(body.trace.appliedAt).toBeDefined();
    expect(body.trace.transitionSummary?.delta.memoryCount).toBe(1);
    expect(body.trace.transitionSummary?.delta.particleCount).toBe(1);
    expect(body.trace.transitionSummary?.afterValid).toBe(true);
    expect(body.trace.transitionSummary?.packageDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(body.trace.beforeStateIntegrity?.summary.memoryCount).toBe(0);
    expect(body.trace.afterStateIntegrity?.summary.memoryCount).toBe(1);
    expect(body.trace.afterStateIntegrity?.valid).toBe(true);
    expect(body.state.memories).toHaveLength(1);
    expect(characterPhysicsService.getState(targetCharacterId).memories).toHaveLength(1);
  });
});

function validPackage(characterId: string): CharacterPhysicsExportResponse {
  const sourceId = uniqueCharacterId("source-state");
  characterPhysicsService.resetCharacter(sourceId);
  characterPhysicsService.processEvent(sourceId, event);
  return {
    exportedAt: "2026-06-21T00:00:00.000Z",
    characterId,
    version: "1.1",
    state: serializeCharacterPhysicsState(characterPhysicsService.getState(sourceId)),
    adjustmentHistory: {
      history: [],
      summary: {
        totalEntries: 0,
        appliedCount: 0,
        rollbackCount: 0,
        blockedCount: 0,
        overrideCount: 0,
        totalOperations: 0,
        uniqueTargetPaths: [],
        latestTargetPaths: [],
        frequentTargetPaths: [],
        stabilityRisk: "low",
        reasons: ["test"]
      },
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: ["test"]
      }
    }
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/characters/test/import/apply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
