import { describe, expect, it } from "vitest";
import { buildRewardRecoverySubProcessTrace } from "../../../src/core/temporal/subprocesses/rewardRecoverySubProcess";
import {
  defaultRewardState,
  recoverRewardBaseline,
  type RewardState
} from "../../../src/core/reward/rewardSystem";

describe("buildRewardRecoverySubProcessTrace", () => {
  it("produces a RewardRecoverySubProcessTrace with correct kind and id", () => {
    const before = defaultRewardState();
    const after = recoverRewardBaseline(before, 30);

    const trace = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(trace.kind).toBe("reward_recovery");
    expect(trace.id).toBe("decay_and_recovery.reward_recovery");
    expect(trace.label).toBe("Reward Baseline Recovery");
    expect(trace.reads).toEqual(["rewardState"]);
    expect(trace.writes).toEqual(["rewardState"]);
    expect(trace.changedStates).toEqual(["rewardState"]);
  });

  it("computes dopamine / threshold / craving metrics correctly", () => {
    const before: RewardState = {
      dopamineLevel: 0.75,
      dopamineThreshold: 0.82,
      rewardSensitivity: 0.3,
      noveltyNeed: 0.6,
      adaptationRate: 0.08,
      craving: 0.65
    };
    const after = recoverRewardBaseline(before, 30);

    const trace = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(trace.metrics.dopamineBefore).toBe(0.75);
    expect(trace.metrics.thresholdBefore).toBe(0.82);
    expect(trace.metrics.cravingBefore).toBe(0.65);
    // Recovery should move toward baseline (dopamine↓, threshold↓, craving↓)
    expect(trace.metrics.dopamineAfter).toBeLessThan(trace.metrics.dopamineBefore);
    expect(trace.metrics.thresholdAfter).toBeLessThan(trace.metrics.thresholdBefore);
    expect(trace.metrics.cravingAfter).toBeLessThan(trace.metrics.cravingBefore);
  });

  it("does not mutate input reward state objects", () => {
    const before: RewardState = {
      dopamineLevel: 0.8,
      dopamineThreshold: 0.7,
      rewardSensitivity: 0.5,
      noveltyNeed: 0.5,
      adaptationRate: 0.08,
      craving: 0.6
    };
    const after = recoverRewardBaseline(before, 14);

    const beforeDopamine = before.dopamineLevel;
    const afterDopamine = after.dopamineLevel;

    buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(before.dopamineLevel).toBe(beforeDopamine);
    expect(after.dopamineLevel).toBe(afterDopamine);
  });

  it("handles default (baseline) reward state correctly", () => {
    const before = defaultRewardState();
    const after = recoverRewardBaseline(before, 7);

    const trace = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    // Default state is already at baseline — recovery should keep values close
    expect(trace.metrics.dopamineBefore).toBeGreaterThan(0);
    expect(trace.metrics.dopamineAfter).toBeGreaterThan(0);
    expect(trace.metrics.thresholdBefore).toBeGreaterThan(0);
    expect(trace.metrics.thresholdAfter).toBeGreaterThan(0);
    expect(trace.metrics.cravingBefore).toBeGreaterThan(0);
    expect(trace.metrics.cravingAfter).toBeGreaterThan(0);
  });

  it("includes D10 homeostasis overwrite note in reasons", () => {
    const before = defaultRewardState();
    const after = recoverRewardBaseline(before, 7);

    const trace = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(trace.reasons.length).toBe(2);
    expect(trace.reasons[0]).toContain("recovers toward baseline");
    expect(trace.reasons[1]).toContain("D10");
    expect(trace.reasons[1]).toContain("homeostasis");
    expect(trace.reasons[1]).toContain("regulatedRewardState");
  });

  it("handles zero-day recovery (no change) correctly", () => {
    const before: RewardState = {
      dopamineLevel: 0.9,
      dopamineThreshold: 0.85,
      rewardSensitivity: 0.3,
      noveltyNeed: 0.7,
      adaptationRate: 0.08,
      craving: 0.7
    };
    const after = recoverRewardBaseline(before, 0);

    const trace = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(trace.metrics.dopamineBefore).toBe(trace.metrics.dopamineAfter);
    expect(trace.metrics.thresholdBefore).toBe(trace.metrics.thresholdAfter);
    expect(trace.metrics.cravingBefore).toBe(trace.metrics.cravingAfter);
  });

  it("produces stable reads/writes/reasons across calls", () => {
    const before = defaultRewardState();
    const after = recoverRewardBaseline(before, 7);

    const trace1 = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });
    const trace2 = buildRewardRecoverySubProcessTrace({
      rewardBefore: before,
      rewardAfter: after
    });

    expect(trace1.reads).toEqual(trace2.reads);
    expect(trace1.writes).toEqual(trace2.writes);
    expect(trace1.reasons).toEqual(trace2.reasons);
    expect(trace1.metrics).toEqual(trace2.metrics);
  });
});
