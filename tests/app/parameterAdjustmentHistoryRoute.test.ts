import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/physics/adjustment/history/route";
import type { GetParameterAdjustmentHistoryResponse } from "../../src/appContracts/characterPhysics";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Parameter adjustment history API", () => {
  it("returns adjustment history for a character", async () => {
    const characterId = `history-route-${Date.now()}`;
    characterPhysicsService.resetCharacter(characterId);

    const response = await GET(new Request("http://localhost/api/history"), {
      params: { characterId }
    });
    const body = (await response.json()) as GetParameterAdjustmentHistoryResponse;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(characterId);
    expect(body.history).toHaveLength(0);
    expect(body.summary.totalEntries).toBe(0);
    expect(body.summary.stabilityRisk).toBe("low");
    expect(body.governance.recommendation).toBe("allow");
  });
});
