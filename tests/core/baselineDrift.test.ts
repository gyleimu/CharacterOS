import { describe, expect, it } from "vitest";
import { evaluateBaselineDrift } from "../../src/core/parameters/baselineDrift";
import type { ParameterNetworkTrace } from "../../src/core/parameters/parameterNetwork";
import type { RecoveryTrace } from "../../src/core/recovery/recoveryTrace";

const recovery: RecoveryTrace = {
  daysElapsed: 180,
  safetyFactor: 0.28,
  obstacleFactor: 0.72,
  scarRetention: 0.58,
  dimensions: [
    {
      id: "self_control",
      label: "自控力恢复",
      before: 0.62,
      after: 0.34,
      baseline: 0.58,
      expectedAfter: 0.5,
      expectedStabilizationDays: 540,
      deviationBefore: 0.04,
      deviationAfter: 0.24,
      recoveredAmount: 0,
      retainedScar: 0.1,
      blocked: true
    },
    {
      id: "boundary_integrity",
      label: "边界完整度恢复",
      before: 0.8,
      after: 0.48,
      baseline: 1,
      expectedAfter: 0.72,
      expectedStabilizationDays: 900,
      deviationBefore: 0.2,
      deviationAfter: 0.52,
      recoveredAmount: 0,
      retainedScar: 0.25,
      blocked: true
    },
    {
      id: "craving",
      label: "渴求恢复",
      before: 0.72,
      after: 0.68,
      baseline: 0.18,
      expectedAfter: 0.4,
      expectedStabilizationDays: 720,
      deviationBefore: 0.54,
      deviationAfter: 0.5,
      recoveredAmount: 0.04,
      retainedScar: 0.21,
      blocked: true
    }
  ],
  reasons: []
};

const network: ParameterNetworkTrace = {
  before: {
    fatigue: 0.8,
    sleepDebt: 0.7,
    stress: 0.76,
    loneliness: 0.64,
    rewardDeficit: 0.4,
    selfControl: 0.52,
    boundaryIntegrity: 0.62,
    emotionalAmplification: 0.76,
    actionNoise: 0.55,
    recoveryCapacity: 0.28
  },
  targets: {
    fatigue: 0.8,
    sleepDebt: 0.7,
    stress: 0.76,
    loneliness: 0.64,
    rewardDeficit: 0.4,
    selfControl: 0.3,
    boundaryIntegrity: 0.44,
    emotionalAmplification: 0.88,
    actionNoise: 0.75,
    recoveryCapacity: 0.18
  },
  after: {
    fatigue: 0.8,
    sleepDebt: 0.7,
    stress: 0.76,
    loneliness: 0.64,
    rewardDeficit: 0.4,
    selfControl: 0.42,
    boundaryIntegrity: 0.55,
    emotionalAmplification: 0.82,
    actionNoise: 0.66,
    recoveryCapacity: 0.22
  },
  influences: [],
  reasons: []
};

describe("baseline drift", () => {
  it("does not suggest baseline drift before long-term evidence accumulates", () => {
    const trace = evaluateBaselineDrift({
      recovery,
      parameterNetwork: network,
      accumulatedDays: 14,
      repetitionCount: 1
    });

    expect(trace.eligible).toBe(false);
    expect(trace.candidates).toHaveLength(0);
  });

  it("suggests slow baseline drift after repeated blocked recovery", () => {
    const trace = evaluateBaselineDrift({
      recovery,
      parameterNetwork: network,
      accumulatedDays: 180,
      repetitionCount: 5
    });

    expect(trace.eligible).toBe(true);
    expect(trace.candidates.length).toBeGreaterThan(0);
    expect(trace.candidates.some((candidate) => candidate.id === "baseline_boundary_integrity")).toBe(true);
    expect(trace.candidates.every((candidate) => candidate.suggestedBaseline !== candidate.currentBaseline)).toBe(true);
  });
});
