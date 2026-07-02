import { describe, expect, it } from "vitest";
import { explainDecisionByRule } from "../../src/core/decision/decisionNarrative";
import type { BehaviorDecision } from "../../src/core/decision/behaviorDecision";

describe("decision narrative", () => {
  it("creates a rule explanation from a behavior decision", () => {
    const narrative = explainDecisionByRule({
      id: "decision_test",
      innerThoughts: ["test"],
      emotionalReaction: "表面克制，内部不安。",
      innerConflict: "想靠近但害怕被抛下。",
      willNotDo: ["不会完全无所谓。"],
      mostLikelyAction: "压住情绪，先追问原因。",
      confidence: 0.7,
      rationale: "低信任、高依恋、高恐惧共同支持该选择。",
      supportingBeliefIds: [],
      supportingNeedIds: [],
      supportingDesireIds: [],
      supportingBehaviorBiasIds: []
    } satisfies BehaviorDecision);

    expect(narrative.source).toBe("rule");
    expect(narrative.summary).toContain("最可能抉择");
    expect(narrative.summary).toContain("压住情绪");
  });
});
