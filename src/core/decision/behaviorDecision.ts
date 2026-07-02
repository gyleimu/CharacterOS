import type { BeliefState } from "../belief/beliefState";
import type { BehaviorBias } from "../behavior/behaviorBias";
import type { DesireState } from "../desire/desireState";
import type { NeedDeficiency } from "../need/needDeficiency";
import type { PersonalityCoordinate } from "../personality/coordinate";
import type { DerivedCharacterState } from "../state/derivedCharacterState";

export interface BehaviorDecision {
  id: string;
  innerThoughts: string[];
  emotionalReaction: string;
  innerConflict: string;
  willNotDo: string[];
  mostLikelyAction: string;
  confidence: number;
  rationale: string;
  supportingBeliefIds: string[];
  supportingNeedIds: string[];
  supportingDesireIds: string[];
  supportingBehaviorBiasIds: string[];
}

export function decideBehavior(params: {
  coordinate: PersonalityCoordinate;
  derived: Omit<DerivedCharacterState, "decision" | "embodiedAction" | "socialExpression" | "proceduralActivations">;
}): BehaviorDecision {
  const { coordinate, derived } = params;
  const topBeliefs = derived.beliefs.slice(0, 2);
  const topNeeds = derived.needs.slice(0, 3);
  const topDesires = derived.desires.slice(0, 3);
  const topBiases = derived.behaviorBiases.slice(0, 3);
  const primaryBias = topBiases[0];

  return {
    id: "decision_current",
    innerThoughts: buildInnerThoughts(topBeliefs, topNeeds, topDesires),
    emotionalReaction: buildEmotionalReaction(coordinate, topNeeds),
    innerConflict: buildInnerConflict(topBeliefs, topDesires),
    willNotDo: buildWillNotDo(derived.behaviorBiases),
    mostLikelyAction: primaryBias?.tendency ?? "先保持沉默，观察当前关系是否安全。",
    confidence: primaryBias?.likelihood ?? 0.35,
    rationale: buildRationale(coordinate, topBeliefs, topNeeds, topDesires, primaryBias),
    supportingBeliefIds: topBeliefs.map((belief) => belief.id),
    supportingNeedIds: topNeeds.map((need) => need.id),
    supportingDesireIds: topDesires.map((desire) => desire.id),
    supportingBehaviorBiasIds: topBiases.map((bias) => bias.id)
  };
}

function buildInnerThoughts(
  beliefs: BeliefState[],
  needs: NeedDeficiency[],
  desires: DesireState[]
): string[] {
  const thoughts: string[] = [];
  const belief = beliefs[0];
  const need = needs[0];
  const desire = desires[0];

  if (belief) {
    thoughts.push(`他会首先被这个信念牵动：“${belief.content}”。`);
  }
  if (need) {
    thoughts.push(`${need.name}会让他把事件理解为一种关系风险，而不只是普通插曲。`);
  }
  if (desire) {
    thoughts.push(`他真正想要的是：${desire.content}`);
  }
  if (!thoughts.length) {
    thoughts.push("他会先观察事件是否真的与自己有关，再决定是否投入情绪。");
  }
  return thoughts;
}

function buildEmotionalReaction(
  coordinate: PersonalityCoordinate,
  needs: NeedDeficiency[]
): string {
  const strongestNeed = needs[0];
  if (coordinate.values.fear >= 0.75 && strongestNeed) {
    return `表面可能克制，内部会有明显不安；${strongestNeed.name}会被快速激活。`;
  }
  if (coordinate.values.trust >= 0.55) {
    return "他更可能先尝试理解对方，而不是立刻进入防御。";
  }
  return "他会出现轻度警觉，但未必立刻表现出来。";
}

function buildInnerConflict(
  beliefs: BeliefState[],
  desires: DesireState[]
): string {
  const belief = beliefs[0];
  const desire = desires[0];
  if (belief && desire) {
    return `一方面他相信“${belief.content}”，另一方面他又${desire.content}`;
  }
  return "他在保护自己和继续靠近之间摇摆。";
}

function buildWillNotDo(biases: BehaviorBias[]): string[] {
  const ignore = biases.find((bias) => bias.id === "behavior_ignore");
  const outburst = biases.find((bias) => bias.id === "behavior_immediate_outburst");
  const result: string[] = [];

  if (!ignore || ignore.likelihood < 0.35) {
    result.push("不会真的完全无所谓。");
  }
  if (!outburst || outburst.likelihood < 0.45) {
    result.push("不会立刻失控式爆发。");
  }
  result.push("不会轻易把自己的依赖和害怕直接摊开。");
  return result;
}

function buildRationale(
  coordinate: PersonalityCoordinate,
  beliefs: BeliefState[],
  needs: NeedDeficiency[],
  desires: DesireState[],
  primaryBias?: BehaviorBias
): string {
  const parts = [
    `当前人格坐标显示：信任 ${coordinate.values.trust.toFixed(2)}，依恋 ${coordinate.values.attachment.toFixed(2)}，恐惧 ${coordinate.values.fear.toFixed(2)}。`
  ];
  if (beliefs[0]) parts.push(`主导信念是“${beliefs[0].content}”。`);
  if (needs[0]) parts.push(`最强缺失是${needs[0].name}。`);
  if (desires[0]) parts.push(`最强欲望是“${desires[0].content}”`);
  if (primaryBias) parts.push(`因此最强行为倾向是“${primaryBias.tendency}”`);
  return parts.join("");
}
