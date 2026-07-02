import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../src/core/meta/metaState";
import { defaultRewardState } from "../../src/core/reward/rewardSystem";
import {
  parameterNetworkStateFromCharacter,
  propagateParameterNetwork
} from "../../src/core/parameters/parameterNetwork";

describe("parameter network", () => {
  it("propagates fatigue, sleep debt, and stress through self-control and action noise", () => {
    const trace = propagateParameterNetwork({
      state: {
        fatigue: 0.8,
        sleepDebt: 0.7,
        stress: 0.75,
        loneliness: 0.45,
        rewardDeficit: 0.25,
        selfControl: 0.62,
        boundaryIntegrity: 0.82,
        emotionalAmplification: 0.48,
        actionNoise: 0.24,
        recoveryCapacity: 0.42
      },
      inertiaRate: 0.5
    });

    expect(trace.after.selfControl).toBeLessThan(trace.before.selfControl);
    expect(trace.after.boundaryIntegrity).toBeLessThan(trace.before.boundaryIntegrity);
    expect(trace.after.actionNoise).toBeGreaterThan(trace.before.actionNoise);
    expect(trace.influences.some((item) => item.source === "fatigue" && item.target === "selfControl")).toBe(true);
  });

  it("derives a network state from current character physics layers", () => {
    const meta = {
      ...defaultMetaState(),
      selfControl: 0.4,
      lonelinessTolerance: 0.25,
      resilience: 0.35
    };
    const boundary = createPsychologicalBoundary({
      capacity: 0.5,
      stressLoad: 0.4,
      integrity: 0.7
    });
    const reward = {
      ...defaultRewardState(),
      dopamineLevel: 0.25,
      dopamineThreshold: 0.55
    };
    const state = parameterNetworkStateFromCharacter({
      meta,
      boundary,
      reward,
      fatigue: 0.6,
      sleepDebt: 0.4
    });

    expect(state.stress).toBe(0.8);
    expect(state.loneliness).toBe(0.75);
    expect(state.rewardDeficit).toBe(0.3);
    expect(state.selfControl).toBe(0.4);
  });
});
