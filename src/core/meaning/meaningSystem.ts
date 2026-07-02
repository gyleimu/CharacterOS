import type { BeliefState } from "../belief/beliefState";
import type { DesireState } from "../desire/desireState";
import type { NeedDeficiency } from "../need/needDeficiency";
import { clamp01 } from "../parameters/parameterMath";
import type { PersonalityCoordinate } from "../personality/coordinate";
import type { RewardState } from "../reward/rewardSystem";

export type MeaningAnchorKind = "relationship" | "self_protection" | "growth" | "truth" | "dignity" | "stability";

export interface MeaningAnchor {
  id: string;
  kind: MeaningAnchorKind;
  content: string;
  strength: number;
  sourceIds: string[];
}

export interface MeaningState {
  anchors: MeaningAnchor[];
  dominantAnchor?: MeaningAnchor;
  meaningIntensity: number;
  painTolerance: number;
  rewardOverride: number;
  existentialClarity: number;
  reasons: string[];
}

export function deriveMeaningState(params: {
  coordinate: PersonalityCoordinate;
  beliefs: BeliefState[];
  needs: NeedDeficiency[];
  desires: DesireState[];
  reward: RewardState;
}): MeaningState {
  const anchors = [
    relationshipAnchor(params),
    truthAnchor(params),
    dignityAnchor(params),
    stabilityAnchor(params),
    growthAnchor(params),
    selfProtectionAnchor(params)
  ]
    .filter((anchor): anchor is MeaningAnchor => anchor !== null)
    .sort((a, b) => b.strength - a.strength);
  const dominantAnchor = anchors[0];
  const meaningIntensity = clamp01(anchors.slice(0, 3).reduce((sum, anchor) => sum + anchor.strength, 0) / 2.2);
  const painTolerance = clamp01(
    meaningIntensity * 0.46 +
    params.coordinate.values.conscientiousness * 0.16 +
    params.coordinate.values.attachment * 0.14 +
    params.coordinate.values.control * 0.12 -
    params.coordinate.values.neuroticism * 0.08
  );
  const rewardOverride = clamp01(
    meaningIntensity * 0.5 +
    painTolerance * 0.22 -
    params.reward.craving * 0.18 -
    params.reward.dopamineLevel * 0.08
  );
  const existentialClarity = clamp01(
    meaningIntensity * 0.52 +
    (dominantAnchor ? dominantAnchor.strength * 0.28 : 0) -
    params.reward.craving * 0.1
  );

  return {
    anchors,
    ...(dominantAnchor ? { dominantAnchor } : {}),
    meaningIntensity,
    painTolerance,
    rewardOverride,
    existentialClarity,
    reasons: buildReasons({
      ...(dominantAnchor ? { dominantAnchor } : {}),
      meaningIntensity,
      painTolerance,
      rewardOverride,
      existentialClarity
    })
  };
}

function relationshipAnchor(params: {
  coordinate: PersonalityCoordinate;
  beliefs: BeliefState[];
  needs: NeedDeficiency[];
  desires: DesireState[];
}): MeaningAnchor | null {
  const attachmentNeed = params.needs.find((need) => need.id === "need_attachment");
  const desire = params.desires.find((item) => item.sourceNeedId === "need_attachment");
  const belief = params.beliefs.find((item) => item.content.includes("王雪") || item.content.includes("重要的人"));
  const strength = clamp01(
    params.coordinate.values.attachment * 0.32 +
    (attachmentNeed?.intensity ?? 0) * 0.28 +
    (desire?.intensity ?? 0) * 0.18 +
    (belief?.strength ?? 0) * 0.22
  );
  if (strength < 0.18) return null;
  return {
    id: "meaning_relationship",
    kind: "relationship",
    content: "维持重要关系本身具有意义，即使它带来不安。",
    strength,
    sourceIds: ids([attachmentNeed, desire, belief])
  };
}

function truthAnchor(params: { beliefs: BeliefState[]; desires: DesireState[] }): MeaningAnchor | null {
  const trustDesire = params.desires.find((desire) => desire.sourceNeedId === "need_trust");
  const belief = params.beliefs.find((item) => item.content.includes("可靠") || item.content.includes("离开"));
  const strength = clamp01((trustDesire?.intensity ?? 0) * 0.48 + (belief?.strength ?? 0) * 0.34);
  if (strength < 0.18) return null;
  return {
    id: "meaning_truth",
    kind: "truth",
    content: "知道真相比短暂舒服更重要。",
    strength,
    sourceIds: ids([trustDesire, belief])
  };
}

function dignityAnchor(params: { coordinate: PersonalityCoordinate; needs: NeedDeficiency[] }): MeaningAnchor | null {
  const controlNeed = params.needs.find((need) => need.id === "need_control");
  const strength = clamp01(params.coordinate.values.control * 0.34 + (controlNeed?.intensity ?? 0) * 0.42);
  if (strength < 0.18) return null;
  return {
    id: "meaning_dignity",
    kind: "dignity",
    content: "保持尊严和边界比立刻获得安慰更重要。",
    strength,
    sourceIds: ids([controlNeed])
  };
}

function stabilityAnchor(params: { needs: NeedDeficiency[]; coordinate: PersonalityCoordinate }): MeaningAnchor | null {
  const securityNeed = params.needs.find((need) => need.id === "need_security");
  const strength = clamp01((securityNeed?.intensity ?? 0) * 0.42 + params.coordinate.values.fear * 0.18);
  if (strength < 0.18) return null;
  return {
    id: "meaning_stability",
    kind: "stability",
    content: "让内心恢复稳定本身就是当前意义。",
    strength,
    sourceIds: ids([securityNeed])
  };
}

function growthAnchor(params: { coordinate: PersonalityCoordinate; reward: RewardState }): MeaningAnchor | null {
  const strength = clamp01(params.coordinate.values.openness * 0.2 + params.coordinate.values.conscientiousness * 0.18 - params.reward.craving * 0.12);
  if (strength < 0.18) return null;
  return {
    id: "meaning_growth",
    kind: "growth",
    content: "把痛苦理解为成长材料，而不是只追求立刻好受。",
    strength,
    sourceIds: []
  };
}

function selfProtectionAnchor(params: { coordinate: PersonalityCoordinate; needs: NeedDeficiency[] }): MeaningAnchor | null {
  const securityNeed = params.needs.find((need) => need.id === "need_security");
  const strength = clamp01(params.coordinate.values.fear * 0.28 + (securityNeed?.intensity ?? 0) * 0.24 + (1 - params.coordinate.values.trust) * 0.16);
  if (strength < 0.18) return null;
  return {
    id: "meaning_self_protection",
    kind: "self_protection",
    content: "保护自己不再次受伤是当前最强的意义之一。",
    strength,
    sourceIds: ids([securityNeed])
  };
}

function buildReasons(params: {
  dominantAnchor?: MeaningAnchor;
  meaningIntensity: number;
  painTolerance: number;
  rewardOverride: number;
  existentialClarity: number;
}): string[] {
  const reasons: string[] = [];
  if (params.dominantAnchor) reasons.push(`主导意义锚点：${params.dominantAnchor.content}`);
  if (params.rewardOverride >= 0.45) reasons.push("意义强度足以部分压过即时奖励或痛苦回避。");
  if (params.painTolerance >= 0.45) reasons.push("角色可能愿意为了意义承受一定痛苦。");
  if (params.existentialClarity < 0.25) reasons.push("意义感较低，角色可能处于迷茫或只是维持生活。");
  if (!reasons.length) reasons.push("意义系统处于弱激活状态。");
  return reasons;
}

function ids(values: Array<{ id: string } | undefined>): string[] {
  return values.filter((value): value is { id: string } => Boolean(value)).map((value) => value.id);
}
