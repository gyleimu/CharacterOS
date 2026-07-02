import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import { linFanInitialCoordinate } from "../../src/core/personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { toGalaxyStepTrace, toPhysicsStepTrace } from "../../src/core/trace/galaxyTrace";

describe("Galaxy trace", () => {
  it("converts a physics step into an auditable trace", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    const result = new CharacterPhysicsEngine().processEvent(state, event());
    const galaxyTrace = toGalaxyStepTrace(result);
    const stepTrace = toPhysicsStepTrace(result);

    expect(galaxyTrace.clusterMetrics).toHaveLength(1);
    expect(galaxyTrace.forces).toHaveLength(1);
    expect(galaxyTrace.forces[0]?.category).toBe("abandonment");
    expect(galaxyTrace.totalForce.values.trust).toBeLessThan(0);
    expect(galaxyTrace.nextVelocity.values.trust).toBeLessThan(0);
    expect(stepTrace.boundaryImpact.incomingStress).toBeGreaterThan(0);
    expect(stepTrace.galaxyTrace.after.values.trust).toBeLessThan(stepTrace.galaxyTrace.before.values.trust);
  });
});

function event(): ExperienceEvent {
  return {
    id: "trace_event_1",
    description: "王雪三天没有回复林凡。",
    tags: ["王雪", "失联", "等待"],
    intensity: 0.82,
    importance: 0.86,
    relationshipWeight: 0.95,
    expectationGap: 0.78,
    personalitySensitivity: 0.9
  };
}
