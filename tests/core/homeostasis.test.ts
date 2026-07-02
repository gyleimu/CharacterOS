import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { applyHomeostasis, defaultHomeostasisState } from "../../src/core/homeostasis/homeostasis";
import { defaultMetaState } from "../../src/core/meta/metaState";

describe("Homeostasis", () => {
  it("pulls extreme meta, boundary, and reward states toward equilibrium", () => {
    const trace = applyHomeostasis({
      homeostasis: defaultHomeostasisState(),
      meta: {
        ...defaultMetaState(),
        emotionalSensitivity: 0.95,
        selfControl: 0.18,
        resilience: 0.16,
        traumaAmplification: 0.9
      },
      boundary: createPsychologicalBoundary({
        capacity: 0.6,
        stressLoad: 0.82,
        cracks: 0.5,
        integrity: 0.55,
        phase: "overflow"
      }),
      reward: {
        dopamineLevel: 0.88,
        dopamineThreshold: 0.8,
        rewardSensitivity: 0.2,
        noveltyNeed: 0.9,
        adaptationRate: 0.08,
        craving: 0.75
      },
      daysElapsed: 30
    });

    expect(trace.pressure).toBeGreaterThan(0.25);
    expect(trace.regulatedMetaState.emotionalSensitivity).toBeLessThan(0.95);
    expect(trace.regulatedMetaState.selfControl).toBeGreaterThan(0.18);
    expect(trace.regulatedBoundary.stressLoad).toBeLessThan(0.82);
    expect(trace.regulatedBoundary.cracks).toBeGreaterThan(0);
    expect(trace.regulatedRewardState.craving).toBeLessThan(0.75);
    expect(trace.reasons).toContain("连续时间推动状态向平衡点缓慢回归。");
  });

  it("keeps regulation small when the system is already near equilibrium", () => {
    const meta = defaultMetaState();
    const boundary = createPsychologicalBoundary();
    const reward = {
      dopamineLevel: 0.42,
      dopamineThreshold: 0.46,
      rewardSensitivity: 0.58,
      noveltyNeed: 0.5,
      adaptationRate: 0.08,
      craving: 0.18
    };
    const trace = applyHomeostasis({
      homeostasis: defaultHomeostasisState(),
      meta,
      boundary,
      reward,
      daysElapsed: 7
    });

    expect(trace.pressure).toBeLessThan(0.05);
    expect(trace.regulatedMetaState.selfControl).toBe(meta.selfControl);
    expect(trace.regulatedBoundary.stressLoad).toBe(boundary.stressLoad);
    expect(trace.regulatedRewardState.craving).toBe(reward.craving);
  });
});
