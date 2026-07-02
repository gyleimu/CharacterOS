import { describe, expect, it } from "vitest";
import { defaultMetaState } from "../../src/core/meta/metaState";
import {
  defaultRewardState,
  processReward,
  recoverRewardBaseline
} from "../../src/core/reward/rewardSystem";

describe("RewardSystem", () => {
  it("turns a novel reward into pleasure and slightly raises the threshold", () => {
    const result = processReward({
      state: defaultRewardState(),
      input: {
        kind: "novelty",
        intensity: 0.82,
        novelty: 0.9,
        repetitionCount: 0
      },
      meta: defaultMetaState()
    });

    expect(result.pleasure).toBeGreaterThan(0.2);
    expect(result.after.dopamineLevel).toBeGreaterThan(result.before.dopamineLevel);
    expect(result.after.dopamineThreshold).toBeGreaterThan(result.before.dopamineThreshold);
    expect(result.reasons).toContain("奖励超过阈值，后续满足门槛会轻微升高。");
  });

  it("reduces pleasure when repetition creates hedonic adaptation", () => {
    const fresh = processReward({
      state: defaultRewardState(),
      input: { kind: "social", intensity: 0.7, novelty: 0.8, repetitionCount: 0 },
      meta: defaultMetaState()
    });
    const repeated = processReward({
      state: defaultRewardState(),
      input: { kind: "social", intensity: 0.7, novelty: 0.05, repetitionCount: 20 },
      meta: defaultMetaState()
    });

    expect(repeated.pleasure).toBeLessThan(fresh.pleasure);
    expect(repeated.adaptation).toBeGreaterThan(fresh.adaptation);
    expect(repeated.reasons).toContain("重复或缺乏新奇降低了奖励感。");
  });

  it("can increase craving even when harmful repeated rewards are not very pleasurable", () => {
    const result = processReward({
      state: { ...defaultRewardState(), dopamineThreshold: 0.62, craving: 0.4 },
      input: {
        kind: "habit",
        intensity: 0.42,
        novelty: 0.05,
        repetitionCount: 20,
        harmful: true
      },
      meta: defaultMetaState()
    });

    expect(result.pleasure).toBeLessThan(0.2);
    expect(result.after.craving).toBeGreaterThan(result.before.craving);
    expect(result.reasons).toContain("有害奖励仍然提高 craving，存在成瘾倾向。");
  });

  it("recovers reward state toward baseline over time", () => {
    const recovered = recoverRewardBaseline({
      dopamineLevel: 0.9,
      dopamineThreshold: 0.8,
      rewardSensitivity: 0.2,
      noveltyNeed: 0.9,
      adaptationRate: 0.08,
      craving: 0.8
    }, 30);

    expect(recovered.dopamineLevel).toBeLessThan(0.9);
    expect(recovered.dopamineThreshold).toBeLessThan(0.8);
    expect(recovered.rewardSensitivity).toBeGreaterThan(0.2);
    expect(recovered.craving).toBeLessThan(0.8);
  });

  it("normalizes extreme reward input before processing", () => {
    const result = processReward({
      state: defaultRewardState(),
      input: {
        kind: "novelty",
        intensity: 2,
        novelty: -1,
        repetitionCount: -10,
        harmful: true
      },
      meta: defaultMetaState()
    });

    expect(result.after.dopamineLevel).toBeGreaterThanOrEqual(0);
    expect(result.after.dopamineLevel).toBeLessThanOrEqual(1);
    expect(result.after.craving).toBeGreaterThanOrEqual(0);
    expect(result.adaptation).toBeGreaterThan(0);
  });
});
