import { describe, expect, it } from "vitest";
import { calculateImpactScore } from "../../src/core/benchmark/impact";
import { linFanBiologicalNature } from "../../src/core/biological/nature";
import {
  applyBoundaryImpact,
  createPsychologicalBoundary,
  recoverBoundary
} from "../../src/core/boundary/psychologicalBoundary";
import type { ExperienceEvent } from "../../src/core/event/event";
import { linFanInitialCoordinate } from "../../src/core/personality/coordinate";

describe("Psychological Boundary", () => {
  it("absorbs stress and can enter overflow when capacity is exceeded", () => {
    const event = abandonmentEvent();
    const result = applyBoundaryImpact({
      boundary: createPsychologicalBoundary({
        capacity: 0.25,
        resilience: 0.2,
        integrity: 0.6,
        stressLoad: 0.18
      }),
      nature: linFanBiologicalNature(),
      coordinate: linFanInitialCoordinate(),
      event,
      impactScore: calculateImpactScore(event)
    });

    expect(result.incomingStress).toBeGreaterThan(0);
    expect(result.after.phase).toBe("overflow");
    expect(result.after.integrity).toBeLessThan(result.before.integrity);
    expect(result.driftMultiplier).toBeGreaterThan(1);
  });

  it("recovers stress load over time without changing personality directly", () => {
    const boundary = createPsychologicalBoundary({
      capacity: 0.6,
      stressLoad: 0.5,
      cracks: 0.2,
      integrity: 0.72,
      recoveryRate: 0.04
    });
    const recovered = recoverBoundary(boundary, 30);

    expect(recovered.stressLoad).toBeLessThan(boundary.stressLoad);
    expect(recovered.integrity).toBeGreaterThan(boundary.integrity);
    expect(recovered.cracks).toBeLessThan(boundary.cracks);
  });

  it("normalizes inconsistent phase from stress and capacity", () => {
    const boundary = createPsychologicalBoundary({
      capacity: 0.5,
      stressLoad: 0.8,
      phase: "stable"
    });

    expect(boundary.phase).toBe("overflow");
  });

  it("does not recover when no time passes", () => {
    const boundary = createPsychologicalBoundary({
      capacity: 0.6,
      stressLoad: 0.5,
      cracks: 0.2,
      integrity: 0.72,
      recoveryRate: 0.04
    });
    const recovered = recoverBoundary(boundary, 0);

    expect(recovered.stressLoad).toBe(boundary.stressLoad);
    expect(recovered.cracks).toBe(boundary.cracks);
    expect(recovered.integrity).toBe(boundary.integrity);
  });

  it("gives fragile boundaries a stronger drift multiplier for the same event", () => {
    const event = abandonmentEvent();
    const strong = applyBoundaryImpact({
      boundary: createPsychologicalBoundary({ capacity: 0.9, resilience: 0.8, integrity: 1 }),
      nature: linFanBiologicalNature(),
      coordinate: linFanInitialCoordinate(),
      event,
      impactScore: calculateImpactScore(event)
    });
    const fragile = applyBoundaryImpact({
      boundary: createPsychologicalBoundary({ capacity: 0.3, resilience: 0.18, integrity: 0.5 }),
      nature: linFanBiologicalNature(),
      coordinate: linFanInitialCoordinate(),
      event,
      impactScore: calculateImpactScore(event)
    });

    expect(fragile.after.phase).toBe("overflow");
    expect(fragile.driftMultiplier).toBeGreaterThan(strong.driftMultiplier);
  });
});

function abandonmentEvent(): ExperienceEvent {
  return {
    id: "boundary_event_1",
    description: "重要的人突然失联，并在深夜没有解释地出现。",
    tags: ["失联", "等待", "亲密关系"],
    intensity: 0.9,
    importance: 0.9,
    relationshipWeight: 0.95,
    expectationGap: 0.9,
    personalitySensitivity: 0.9
  };
}
