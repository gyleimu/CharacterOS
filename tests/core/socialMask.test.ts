import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { buildSocialMaskExpression } from "../../src/core/expression/socialMask";
import { linFanMetaState, defaultMetaState } from "../../src/core/meta/metaState";
import { linFanInitialCoordinate, neutralCoordinate } from "../../src/core/personality/coordinate";

const decision = {
  id: "decision_test",
  innerThoughts: ["他想确认对方为什么消失。"],
  emotionalReaction: "表面冷静，内心不安。",
  innerConflict: "想靠近又想保护自己。",
  willNotDo: ["不会完全无所谓。"],
  mostLikelyAction: "压住情绪，先追问原因。",
  confidence: 0.72,
  rationale: "高依恋和高恐惧共同作用。",
  supportingBeliefIds: [],
  supportingNeedIds: [],
  supportingDesireIds: [],
  supportingBehaviorBiasIds: []
};

const embodiedAction = {
  intendedAction: "压住情绪，先追问原因。",
  finalAction: "压住情绪，先追问原因。 但语气会更冷，表达会少于真实感受。",
  tone: "cold" as const,
  noiseLevel: 0.42,
  selfControlAvailable: 0.48,
  misfireRisk: 0.46,
  reasons: ["情绪负荷较高，意图不容易稳定落地。"]
};

describe("SocialMask", () => {
  it("separates true state, conscious state, expressed state, and behavior state under self-protection", () => {
    const expression = buildSocialMaskExpression({
      coordinate: linFanInitialCoordinate(),
      meta: linFanMetaState(),
      boundary: createPsychologicalBoundary({ capacity: 0.45, stressLoad: 0.42, integrity: 0.72 }),
      desires: [{ id: "desire_confirm", content: "确认对方是否还会留下来。", intensity: 0.82, sourceNeedId: "need_safety" }],
      behaviorBiases: [{ id: "bias_cold", tendency: "表现得克制、冷淡。", likelihood: 0.7, rationale: "保护自己。" }],
      decision,
      embodiedAction
    });

    expect(expression.trueState).toContain("确认");
    expect(expression.consciousState).toContain("我没有那么在意");
    expect(expression.expressedState).toContain("没关系");
    expect(expression.behaviorState).toContain("语气会更冷");
    expect(expression.lieType).toBe("self_protection_lie");
    expect(expression.conflictLevel).toBeGreaterThan(0.45);
    expect(expression.conflicts).toContain("表达状态与真实状态不完全一致。");
  });

  it("allows more honest expression when mask pressure is low", () => {
    const expression = buildSocialMaskExpression({
      coordinate: neutralCoordinate(),
      meta: { ...defaultMetaState(), selfControl: 0.82, traumaAmplification: 0.18 },
      boundary: createPsychologicalBoundary({ capacity: 0.8, stressLoad: 0.08, integrity: 0.96 }),
      desires: [{ id: "desire_talk", content: "直接说明自己的感受。", intensity: 0.42, sourceNeedId: "need_clarity" }],
      behaviorBiases: [],
      decision,
      embodiedAction: { ...embodiedAction, finalAction: decision.mostLikelyAction, misfireRisk: 0.12 }
    });

    expect(expression.lieType).toBe("none");
    expect(expression.honestyLevel).toBeGreaterThan(0.55);
    expect(expression.expressedState).toContain(decision.mostLikelyAction);
  });
});
