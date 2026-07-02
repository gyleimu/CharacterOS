import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/physics/calibration/route";
import type { CharacterCalibrationReport } from "../../src/app/api/characters/[characterId]/physics/calibration/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Character calibration API", () => {
  it("returns a read-only calibration report without mutating character state", async () => {
    const characterId = uniqueCharacterId("calibration-readonly");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const stateBefore = characterPhysicsService.getState(characterId);
    const memoryCountBefore = stateBefore.memories.length;

    const response = await GET(new Request(`http://localhost/api/characters/${characterId}/physics/calibration`), {
      params: { characterId }
    });
    const body = (await response.json()) as CharacterCalibrationReport;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(characterId);
    expect(body.generatedAt).toBeDefined();
    expect(body.daysSimulated).toBe(1);

    // All four hint categories should be present
    expect(Array.isArray(body.hints.baselineDrift)).toBe(true);
    expect(Array.isArray(body.hints.homeostasis)).toBe(true);
    expect(Array.isArray(body.hints.parameterNetwork)).toBe(true);
    expect(Array.isArray(body.hints.recovery)).toBe(true);

    // At minimum, each category should have at least one hint
    expect(body.hints.baselineDrift.length).toBeGreaterThan(0);
    expect(body.hints.homeostasis.length).toBeGreaterThan(0);
    expect(body.hints.parameterNetwork.length).toBeGreaterThan(0);
    expect(body.hints.recovery.length).toBeGreaterThan(0);

    // Each hint should have the standard shape
    for (const hint of body.hints.baselineDrift) {
      expect(typeof hint.id).toBe("string");
      expect(["info", "watch", "adjust"]).toContain(hint.severity);
      expect(typeof hint.title).toBe("string");
      expect(typeof hint.message).toBe("string");
      expect(typeof hint.value).toBe("number");
    }

    // Verify the real state was NOT mutated
    const stateAfter = characterPhysicsService.getState(characterId);
    expect(stateAfter.memories.length).toBe(memoryCountBefore);
    expect(stateAfter.metaState).toEqual(stateBefore.metaState);
  });

  it("works on a freshly reset character", async () => {
    const characterId = uniqueCharacterId("calibration-fresh");
    characterPhysicsService.resetCharacter(characterId);

    const response = await GET(new Request(`http://localhost/api/characters/${characterId}/physics/calibration`), {
      params: { characterId }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as CharacterCalibrationReport;
    expect(body.hints.baselineDrift.length).toBeGreaterThan(0);
  });
});

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
