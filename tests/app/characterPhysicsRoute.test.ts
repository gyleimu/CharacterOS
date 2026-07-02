import { describe, expect, it } from "vitest";
import {
  DELETE,
  GET
} from "../../src/app/api/characters/[characterId]/physics/route";
import type { GetCharacterPhysicsStateResponse } from "../../src/appContracts/characterPhysics";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Character physics API", () => {
  it("resets to an empty blueprint state by default", async () => {
    const characterId = uniqueCharacterId("physics-reset");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await DELETE(new Request(`http://localhost/api/characters/${characterId}/physics`), {
      params: { characterId }
    });
    const body = (await response.json()) as GetCharacterPhysicsStateResponse;

    expect(response.status).toBe(200);
    expect(body.state.identity?.name).toBe("林凡");
    expect(body.state.memories).toHaveLength(0);
    expect(body.state.clusters).toHaveLength(0);
    expect(body.integrity.valid).toBe(true);
  });

  it("can reset and seed blueprint origin experiences through query params", async () => {
    const characterId = uniqueCharacterId("physics-seed-reset");

    const response = await DELETE(
      new Request(`http://localhost/api/characters/${characterId}/physics?seedInitialExperiences=true`),
      { params: { characterId } }
    );
    const body = (await response.json()) as GetCharacterPhysicsStateResponse;

    expect(response.status).toBe(200);
    expect(body.state.identity?.name).toBe("林凡");
    expect(body.state.memories).toHaveLength(3);
    expect(body.state.clusters.map((cluster) => cluster.category).sort()).toEqual(["abandonment", "support"]);
    expect(body.integrity.valid).toBe(true);
    expect(body.integrity.summary.memoryCount).toBe(3);
  });

  it("returns seeded state after reset", async () => {
    const characterId = uniqueCharacterId("physics-get-seeded");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(new Request(`http://localhost/api/characters/${characterId}/physics`), {
      params: { characterId }
    });
    const body = (await response.json()) as GetCharacterPhysicsStateResponse;

    expect(response.status).toBe(200);
    expect(body.state.memories.map((memory) => memory.id)).toContain("memory_lin_fan_origin_mother_rain_night");
  });
});

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
