import type { BehaviorDecision } from "./behaviorDecision";
import type { DerivedCharacterState } from "../state/derivedCharacterState";
import type { LLMProvider } from "../../llm/llmProvider";

export interface DecisionNarrative {
  source: "rule" | "llm" | "rule_fallback";
  summary: string;
}

export async function explainDecision(params: {
  decision: BehaviorDecision;
  derived: DerivedCharacterState;
  provider?: LLMProvider;
}): Promise<DecisionNarrative> {
  const rule = explainDecisionByRule(params.decision);
  if (!params.provider) return rule;

  try {
    const content = await params.provider.generate(
      [
        {
          role: "system",
          content: [
            "你是 CharacterOS 的人物心理解释器。",
            "不要写剧情，不要扩写场景。",
            "只解释为什么这个人物在当前心理状态下会做出该抉择。",
            "输出中文，保持克制、分析性、简洁。"
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            decision: params.decision,
            beliefs: params.derived.beliefs.slice(0, 3),
            needs: params.derived.needs.slice(0, 4),
            desires: params.derived.desires.slice(0, 4),
            behaviorBiases: params.derived.behaviorBiases.slice(0, 4)
          })
        }
      ],
      { temperature: 0.2 }
    );
    return {
      source: "llm",
      summary: content.trim()
    };
  } catch {
    return {
      ...rule,
      source: "rule_fallback"
    };
  }
}

export function explainDecisionByRule(decision: BehaviorDecision): DecisionNarrative {
  return {
    source: "rule",
    summary: [
      `最可能抉择：${decision.mostLikelyAction}`,
      `情绪反应：${decision.emotionalReaction}`,
      `内心冲突：${decision.innerConflict}`,
      `人格一致性：${decision.rationale}`
    ].join("\n")
  };
}
