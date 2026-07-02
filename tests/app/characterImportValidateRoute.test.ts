import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/import/validate/route";
import type {
  CharacterPhysicsExportResponse,
  ValidateCharacterImportResponse
} from "../../src/appContracts/characterPhysics";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Character import validation API", () => {
  it("validates an export package without mutating current character state", async () => {
    const targetCharacterId = uniqueCharacterId("import-target");
    characterPhysicsService.resetCharacter(targetCharacterId);
    const beforeMemoryCount = characterPhysicsService.getState(targetCharacterId).memories.length;
    const pkg = validPackage("exported-character");

    const response = await POST(jsonRequest({ package: pkg }), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as ValidateCharacterImportResponse;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(targetCharacterId);
    expect(body.valid).toBe(true);
    expect(body.mutatesState).toBe(false);
    expect(body.summary?.characterId).toBe("exported-character");
    expect(body.summary?.memoryCount).toBe(0);
    expect(body.plan.status).toBe("ready");
    expect(body.plan.risk).toBe("medium");
    expect(body.plan.stateIntegrity?.valid).toBe(true);
    expect(body.plan.auditSummary.decision).toBe("can_apply");
    expect(body.plan.auditSummary.canApply).toBe(true);
    expect(characterPhysicsService.getState(targetCharacterId).memories).toHaveLength(beforeMemoryCount);
  });

  it("rejects invalid packages without mutating state", async () => {
    const targetCharacterId = uniqueCharacterId("import-invalid-target");
    characterPhysicsService.resetCharacter(targetCharacterId);

    const response = await POST(jsonRequest({ package: { version: "1.0" } }), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as ValidateCharacterImportResponse;

    expect(response.status).toBe(422);
    expect(body.valid).toBe(false);
    expect(body.summary).toBeNull();
    expect(body.plan.status).toBe("blocked");
    expect(body.plan.auditSummary.decision).toBe("rejected");
    expect(body.errors).toContain("version must be a supported export version");
    expect(characterPhysicsService.getState(targetCharacterId).memories).toHaveLength(0);
  });

  it("rejects packages whose state fails integrity inspection", async () => {
    const targetCharacterId = uniqueCharacterId("import-broken-state-target");
    characterPhysicsService.resetCharacter(targetCharacterId);
    const pkg = validPackage("broken-exported-character", { seedInitialExperiences: true });
    pkg.state.memories[0] = {
      ...pkg.state.memories[0]!,
      clusterId: "cluster_missing"
    };

    const response = await POST(jsonRequest({ package: pkg }), {
      params: { characterId: targetCharacterId }
    });
    const body = (await response.json()) as ValidateCharacterImportResponse;

    expect(response.status).toBe(422);
    expect(body.valid).toBe(false);
    expect(body.summary?.characterId).toBe("broken-exported-character");
    expect(body.plan.status).toBe("blocked");
    expect(body.plan.stateIntegrity?.valid).toBe(false);
    expect(body.plan.auditSummary.blockers).toContain("state integrity failed");
    expect(body.errors).toContain("memories[0].clusterId: memory references missing cluster: cluster_missing");
    expect(characterPhysicsService.getState(targetCharacterId).memories).toHaveLength(0);
  });
});

function validPackage(
  characterId: string,
  options: { seedInitialExperiences?: boolean } = {}
): CharacterPhysicsExportResponse {
  const sourceId = uniqueCharacterId("export-source");
  return {
    exportedAt: "2026-06-21T00:00:00.000Z",
    characterId,
    version: "1.1",
    state: serializeCharacterPhysicsState(characterPhysicsService.resetCharacter(sourceId, {
      seedInitialExperiences: options.seedInitialExperiences ?? false
    })),
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
        reasons: ["no manual adjustment history yet"]
      },
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: ["no manual adjustment history yet"]
      }
    }
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/characters/test/import/validate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
