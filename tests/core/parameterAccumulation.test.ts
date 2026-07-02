import { describe, expect, it } from "vitest";
import { evaluateBaselineDrift } from "../../src/core/parameters/baselineDrift";
import { buildParameterAccumulationTrace } from "../../src/core/parameters/parameterAccumulation";
import { propagateParameterNetwork } from "../../src/core/parameters/parameterNetwork";
import type { RecoveryTrace } from "../../src/core/recovery/recoveryTrace";

const recovery: RecoveryTrace = {
  daysElapsed: 180,
  safetyFactor: 0.2,
  obstacleFactor: 0.78,
  scarRetention: 0.66,
  dimensions: [
    {
      id: "boundary_integrity",
      label: "边界完整度恢复",
      before: 0.8,
      after: 0.42,
      baseline: 1,
      expectedAfter: 0.72,
      expectedStabilizationDays: 900,
      deviationBefore: 0.2,
      deviationAfter: 0.58,
      recoveredAmount: 0,
      retainedScar: 0.28,
      blocked: true
    }
  ],
  reasons: []
};

describe("parameter accumulation", () => {
  it("collects network, recovery, and baseline drift pressure into review buckets", () => {
    const parameterNetwork = propagateParameterNetwork({
      state: {
        fatigue: 0.9,
        sleepDebt: 0.8,
        stress: 0.9,
        loneliness: 0.72,
        rewardDeficit: 0.55,
        selfControl: 0.48,
        boundaryIntegrity: 0.52,
        emotionalAmplification: 0.74,
        actionNoise: 0.58,
        recoveryCapacity: 0.18
      },
      inertiaRate: 0.7
    });
    const baselineDrift = evaluateBaselineDrift({
      recovery,
      parameterNetwork,
      accumulatedDays: 180,
      repetitionCount: 6
    });

    const trace = buildParameterAccumulationTrace({
      recovery,
      parameterNetwork,
      baselineDrift
    });

    expect(trace.buckets).toHaveLength(5);
    expect(trace.dominantBucket).toBeDefined();
    expect(trace.buckets[0]?.progress).toBeGreaterThanOrEqual(trace.buckets[1]?.progress ?? 0);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });
});
