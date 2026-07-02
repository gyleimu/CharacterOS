import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { applyActionNoise } from "../../src/core/embodiment/actionNoise";
import { defaultMetaState, linFanMetaState } from "../../src/core/meta/metaState";

describe("ActionNoise", () => {
  it("keeps final action close to intention when boundary and self-control are stable", () => {
    const action = applyActionNoise({
      intendedAction: "压住情绪，先追问原因。",
      context: {
        meta: { ...defaultMetaState(), selfControl: 0.82, resilience: 0.78 },
        boundary: createPsychologicalBoundary({ capacity: 0.8, stressLoad: 0.12, integrity: 0.96 }),
        fatigue: 0.08,
        pain: 0,
        fear: 0.18,
        skill: 0.82,
        randomness: 0.2
      }
    });

    expect(action.tone).toBe("controlled");
    expect(action.finalAction).toBe("压住情绪，先追问原因。");
    expect(action.noiseLevel).toBeLessThan(0.22);
    expect(action.misfireRisk).toBeLessThan(0.35);
    expect(action.reasons).toContain("动作噪声较低，最终行为基本贴近原始意图。");
  });

  it("distorts intention when stress is high and available self-control is low", () => {
    const action = applyActionNoise({
      intendedAction: "压住情绪，先追问原因。",
      context: {
        meta: { ...linFanMetaState(), selfControl: 0.24, resilience: 0.2, emotionalSensitivity: 0.86 },
        boundary: createPsychologicalBoundary({
          capacity: 0.42,
          stressLoad: 0.48,
          integrity: 0.62,
          phase: "overflow"
        }),
        fatigue: 0.72,
        pain: 0.2,
        fear: 0.88,
        skill: 0.28,
        randomness: 0.9
      }
    });

    expect(action.noiseLevel).toBeGreaterThan(0.55);
    expect(action.selfControlAvailable).toBeLessThan(0.35);
    expect(action.misfireRisk).toBeGreaterThan(0.65);
    expect(["avoidant", "impulsive", "shaky"]).toContain(action.tone);
    expect(action.finalAction).not.toBe("压住情绪，先追问原因。");
    expect(action.reasons).toContain("心理边界接近或超过承压区，行动更容易变形。");
    expect(action.reasons).toContain("可用自控力偏低，误动作和过度表达风险上升。");
  });

  it("makes embodiment variables change the same intention without changing the decision layer", () => {
    const intendedAction = "确认对方为什么消失。";
    const stable = applyActionNoise({
      intendedAction,
      context: {
        meta: defaultMetaState(),
        boundary: createPsychologicalBoundary({ stressLoad: 0.1, integrity: 0.95 }),
        fatigue: 0.05,
        fear: 0.15,
        skill: 0.7,
        randomness: 0.1
      }
    });
    const exhausted = applyActionNoise({
      intendedAction,
      context: {
        meta: defaultMetaState(),
        boundary: createPsychologicalBoundary({ capacity: 0.6, stressLoad: 0.5, integrity: 0.7 }),
        fatigue: 0.9,
        pain: 0.65,
        fear: 0.7,
        skill: 0.35,
        randomness: 0.8
      }
    });

    expect(stable.intendedAction).toBe(intendedAction);
    expect(exhausted.intendedAction).toBe(intendedAction);
    expect(exhausted.noiseLevel).toBeGreaterThan(stable.noiseLevel);
    expect(exhausted.finalAction).not.toBe(stable.finalAction);
  });
});
