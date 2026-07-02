import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/import/history/route";
import { POST } from "../../src/app/api/characters/[characterId]/import/apply/route";
import type {
  CharacterPhysicsExportResponse,
  GetCharacterImportTransitionHistoryResponse
} from "../../src/appContracts/characterPhysics";
import { buildImportConfirmationPhrase } from "../../src/core/export/characterImportApply";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

const event = {
  id: "import_history_event",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "等待", "亲密关系"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9
};

describe("Character import transition history API", () => {
  it("returns blocked and applied import attempts for a character", async () => {
    const targetCharacterId = uniqueCharacterId("import-history-target");
    characterPhysicsService.resetCharacter(targetCharacterId);
    const pkg = validPackage(uniqueCharacterId("import-history-source"));

    await POST(jsonRequest({ package: pkg }), {
      params: { characterId: targetCharacterId }
    });
    await POST(jsonRequest({
      package: pkg,
      confirmation: buildImportConfirmationPhrase(targetCharacterId)
    }), {
      params: { characterId: targetCharacterId }
    });

    const response = await GET(new Request("http://localhost/api/import/history"), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as GetCharacterImportTransitionHistoryResponse;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(targetCharacterId);
    expect(body.history).toHaveLength(2);
    expect(body.history[0]?.status).toBe("blocked");
    expect(body.history[1]?.status).toBe("applied");
    expect(body.history[0]?.trace.historyEntryId).toBe(body.history[0]?.id);
    expect(body.history[0]?.trace.historyRecordedAt).toBe(body.history[0]?.createdAt);
    expect(body.history[1]?.trace.historyEntryId).toBe(body.history[1]?.id);
    expect(body.history[1]?.trace.historyRecordedAt).toBe(body.history[1]?.createdAt);
    expect(body.history[1]?.transitionId).toMatch(/^import_[0-9a-f]{16}$/);
    expect(body.summary.totalEntries).toBe(2);
    expect(body.summary.blockedCount).toBe(1);
    expect(body.summary.appliedCount).toBe(1);
    expect(body.summary.latestStatus).toBe("applied");
    expect(body.summary.latestTransitionId).toBe(body.history[1]?.transitionId);
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
