import { describe, expect, it } from "vitest";
import { updateBoredomForTick } from "../../src/core/boredom/boredomSystem";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../src/core/meta/metaState";

describe("Boredom and Inspiration System", () => {
  it("turns low stimulation and curiosity into exploration pressure", () => {
    const trace = updateBoredomForTick({
      boredom: {
        boredomLevel: 0.42,
        stimulationNeed: 0.72,
        daydreamingTendency: 0.62,
        creativePressure: 0.5,
        restlessness: 0.2
      },
      meta: {
        ...defaultMetaState(),
        curiosity: 0.9,
        resilience: 0.78,
        selfControl: 0.64
      },
      reward: {
        dopamineLevel: 0.16,
        dopamineThreshold: 0.72,
        rewardSensitivity: 0.45,
        noveltyNeed: 0.88,
        adaptationRate: 0.05,
        craving: 0.12
      },
      boundary: createPsychologicalBoundary({ stressLoad: 0.12, integrity: 0.9 }),
      daysElapsed: 30
    });

    expect(trace.after.boredomLevel).toBeGreaterThan(trace.before.boredomLevel);
    expect(trace.explorationDrive).toBeGreaterThan(0.6);
    expect(trace.inspirationChance).toBeGreaterThan(0.45);
    expect(trace.reasons).toContain("curiosity and novelty need create exploration pressure");
  });

  it("suppresses inspiration when stress dominates boredom", () => {
    const trace = updateBoredomForTick({
      boredom: {
        boredomLevel: 0.68,
        stimulationNeed: 0.7,
        daydreamingTendency: 0.76,
        creativePressure: 0.64,
        restlessness: 0.58
      },
      meta: {
        ...defaultMetaState(),
        curiosity: 0.76,
        resilience: 0.28,
        selfControl: 0.22
      },
      reward: {
        dopamineLevel: 0.18,
        dopamineThreshold: 0.74,
        rewardSensitivity: 0.35,
        noveltyNeed: 0.82,
        adaptationRate: 0.05,
        craving: 0.2
      },
      boundary: createPsychologicalBoundary({ stressLoad: 0.9, integrity: 0.38, phase: "overflow" }),
      daysElapsed: 30
    });

    expect(trace.after.restlessness).toBeGreaterThan(trace.before.restlessness);
    expect(trace.inspiration).toBeUndefined();
    expect(trace.reasons).toContain("stress converts boredom into restless tension");
  });

  it("lets sufficient reward reduce boredom pressure", () => {
    const trace = updateBoredomForTick({
      boredom: {
        boredomLevel: 0.6,
        stimulationNeed: 0.35,
        daydreamingTendency: 0.3,
        creativePressure: 0.22,
        restlessness: 0.18
      },
      meta: {
        ...defaultMetaState(),
        curiosity: 0.32
      },
      reward: {
        dopamineLevel: 0.86,
        dopamineThreshold: 0.44,
        rewardSensitivity: 0.72,
        noveltyNeed: 0.24,
        adaptationRate: 0.05,
        craving: 0.05
      },
      boundary: createPsychologicalBoundary({ stressLoad: 0.08, integrity: 0.92 }),
      daysElapsed: 30
    });

    expect(trace.after.boredomLevel).toBeLessThan(trace.before.boredomLevel);
    expect(trace.explorationDrive).toBeLessThan(0.5);
  });
});
