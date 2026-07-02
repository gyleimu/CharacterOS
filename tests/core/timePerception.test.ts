import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState, linFanMetaState } from "../../src/core/meta/metaState";
import { defaultRewardState } from "../../src/core/reward/rewardSystem";
import { perceiveContinuousTime, perceiveEventTime } from "../../src/core/time/timePerception";

describe("TimePerception", () => {
  it("stretches subjective time during waiting and abandonment fear", () => {
    const trace = perceiveEventTime({
      event: {
        id: "waiting_event",
        description: "王雪三天没有回复。",
        tags: ["王雪", "失联", "等待", "夜晚"],
        intensity: 0.86,
        importance: 0.9,
        relationshipWeight: 0.95,
        expectationGap: 0.88,
        personalitySensitivity: 0.9
      },
      emotion: { primary: "fear", valence: -0.8, arousal: 0.82, intensity: 0.85 },
      meta: linFanMetaState(),
      boundary: createPsychologicalBoundary({ capacity: 0.45, stressLoad: 0.4 }),
      reward: defaultRewardState(),
      objectiveDuration: 3
    });

    expect(trace.multiplier).toBeGreaterThan(1.25);
    expect(trace.subjectiveDuration).toBeGreaterThan(3);
    expect(["stretched", "frozen"]).toContain(trace.mode);
    expect(trace.reasons).toContain("等待感拉长了主观时间。");
  });

  it("compresses subjective time during positive absorbed reward", () => {
    const trace = perceiveEventTime({
      event: {
        id: "joy_event",
        description: "林凡被认可并投入做一件事。",
        tags: ["认可", "成功", "投入"],
        intensity: 0.72,
        importance: 0.72,
        relationshipWeight: 0.2,
        expectationGap: 0.2,
        personalitySensitivity: 0.5
      },
      emotion: { primary: "joy", valence: 0.9, arousal: 0.5, intensity: 0.72 },
      meta: { ...defaultMetaState(), curiosity: 0.8 },
      boundary: createPsychologicalBoundary({ stressLoad: 0.05 }),
      reward: { ...defaultRewardState(), dopamineLevel: 0.8 },
      objectiveDuration: 2
    });

    expect(trace.multiplier).toBeLessThan(1);
    expect(trace.subjectiveDuration).toBeLessThan(2);
    expect(["compressed", "normal"]).toContain(trace.mode);
  });

  it("estimates subjective days during continuous living", () => {
    const trace = perceiveContinuousTime({
      daysElapsed: 7,
      meta: linFanMetaState(),
      boundary: createPsychologicalBoundary({ capacity: 0.5, stressLoad: 0.45 }),
      reward: defaultRewardState()
    });

    expect(trace.objectiveDuration).toBe(7);
    expect(trace.subjectiveDuration).toBeGreaterThan(7);
    expect(trace.lonelinessLoad).toBeGreaterThan(0);
  });
});
