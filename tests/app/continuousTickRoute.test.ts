import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/physics/tick/route";
import type { ContinuousTickResponse } from "../../src/appContracts/characterPhysics";

describe("Continuous tick API", () => {
  it("ticks a character forward and returns the updated state", async () => {
    const characterId = `tick-route-${Date.now()}`;
    const request = new Request(`http://localhost/api/characters/${characterId}/physics/tick`, {
      method: "POST",
      body: JSON.stringify({
        daysElapsed: 14,
        fatigue: 0.8,
        sleepDebt: 0.7,
        memoryDecayRate: 0.04,
        deepThinkingThreshold: 0.62
      }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request, { params: { characterId } });
    const body = (await response.json()) as ContinuousTickResponse;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(characterId);
    expect(body.trace.daysElapsed).toBe(14);
    expect(body.trace.parameterNetwork.before.fatigue).toBe(0.8);
    expect(body.trace.parameterNetwork.before.sleepDebt).toBe(0.7);
    expect(body.trace.effectiveMemoryDecayRate).toBeGreaterThan(0);
    expect(body.trace.effectiveDeepThinkingThreshold).toBeGreaterThan(0);
    expect(body.state.proceduralRoutines?.length).toBeGreaterThan(0);
    expect(body.trace.proceduralRoutineCount).toBe(body.state.proceduralRoutines?.length);
    expect(body.trace.averageProceduralStrengthAfter).toBeLessThan(
      body.trace.averageProceduralStrengthBefore
    );
  });
});
