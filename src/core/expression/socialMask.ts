import type { BehaviorBias } from "../behavior/behaviorBias";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { BehaviorDecision } from "../decision/behaviorDecision";
import type { DesireState } from "../desire/desireState";
import type { EmbodiedAction } from "../embodiment/actionNoise";
import type { MetaState } from "../meta/metaState";
import { clamp01 } from "../parameters/parameterMath";
import type { PersonalityCoordinate } from "../personality/coordinate";

export type LieType = "none" | "social_lie" | "kind_lie" | "malicious_lie" | "self_protection_lie";

export interface MultiStateExpression {
  trueState: string;
  consciousState: string;
  expressedState: string;
  behaviorState: string;
  maskPressure: number;
  honestyLevel: number;
  selfDeceptionLevel: number;
  lieType: LieType;
  conflictLevel: number;
  conflicts: string[];
}

export function buildSocialMaskExpression(params: {
  coordinate: PersonalityCoordinate;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  desires: DesireState[];
  behaviorBiases: BehaviorBias[];
  decision: BehaviorDecision;
  embodiedAction: EmbodiedAction;
}): MultiStateExpression {
  const primaryDesire = params.desires[0];
  const primaryBias = params.behaviorBiases[0];
  const stressRatio = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  const vulnerability =
    params.coordinate.values.attachment * 0.24 +
    params.coordinate.values.fear * 0.28 +
    (1 - params.coordinate.values.trust) * 0.2 +
    stressRatio * 0.18 +
    (1 - params.meta.selfControl) * 0.1;
  const maskPressure = clamp01(vulnerability);
  const selfDeceptionLevel = clamp01(
    params.coordinate.values.fear * 0.26 +
    (1 - params.coordinate.values.trust) * 0.18 +
    params.meta.traumaAmplification * 0.22 +
    (1 - params.meta.resilience) * 0.18 +
    stressRatio * 0.16
  );
  const honestyLevel = clamp01(
    1 -
    maskPressure * 0.52 -
    selfDeceptionLevel * 0.24 +
    params.meta.selfControl * 0.14 +
    params.coordinate.values.trust * 0.1
  );
  const lieType = chooseLieType({
    maskPressure,
    selfDeceptionLevel,
    trust: params.coordinate.values.trust,
    agreeableness: params.coordinate.values.agreeableness
  });
  const trueState = primaryDesire
    ? `真实欲望：${primaryDesire.content}`
    : "真实状态：还没有形成清晰欲望，但仍在寻找安全感。";
  const consciousState = renderConsciousState({
    selfDeceptionLevel,
    trueState,
    ...(primaryBias ? { primaryBias } : {})
  });
  const expressedState = renderExpressedState({
    lieType,
    honestyLevel,
    decision: params.decision
  });
  const behaviorState = params.embodiedAction.finalAction;
  const conflicts = buildConflicts({
    trueState,
    consciousState,
    expressedState,
    behaviorState,
    lieType,
    selfDeceptionLevel,
    maskPressure
  });

  return {
    trueState,
    consciousState,
    expressedState,
    behaviorState,
    maskPressure,
    honestyLevel,
    selfDeceptionLevel,
    lieType,
    conflictLevel: clamp01((maskPressure + selfDeceptionLevel + params.embodiedAction.misfireRisk) / 3),
    conflicts
  };
}

function chooseLieType(params: {
  maskPressure: number;
  selfDeceptionLevel: number;
  trust: number;
  agreeableness: number;
}): LieType {
  if (params.selfDeceptionLevel >= 0.68) return "self_protection_lie";
  if (params.maskPressure < 0.42) return "none";
  if (params.trust < 0.42) return "self_protection_lie";
  if (params.agreeableness >= 0.62) return "kind_lie";
  return "social_lie";
}

function renderConsciousState(params: {
  selfDeceptionLevel: number;
  trueState: string;
  primaryBias?: BehaviorBias;
}): string {
  if (params.selfDeceptionLevel >= 0.68) {
    return "意识说法：我没有那么在意，我只是想确认事实。";
  }
  if (params.selfDeceptionLevel >= 0.45) {
    return "意识说法：我应该保持冷静，别显得自己太需要对方。";
  }
  if (params.primaryBias) {
    return `意识说法：现在最合理的是${params.primaryBias.tendency}`;
  }
  return params.trueState;
}

function renderExpressedState(params: {
  lieType: LieType;
  honestyLevel: number;
  decision: BehaviorDecision;
}): string {
  if (params.lieType === "none" && params.honestyLevel >= 0.62) {
    return `表达状态：${params.decision.mostLikelyAction}`;
  }
  if (params.lieType === "kind_lie") {
    return "表达状态：没事，我理解，你不用解释太多。";
  }
  if (params.lieType === "self_protection_lie") {
    return "表达状态：没关系，我也没一直等。";
  }
  if (params.lieType === "malicious_lie") {
    return "表达状态：我根本不在乎你怎么想。";
  }
  return "表达状态：还好，我只是随便问问。";
}

function buildConflicts(params: {
  trueState: string;
  consciousState: string;
  expressedState: string;
  behaviorState: string;
  lieType: LieType;
  selfDeceptionLevel: number;
  maskPressure: number;
}): string[] {
  const conflicts: string[] = [];
  if (params.lieType !== "none") {
    conflicts.push("表达状态与真实状态不完全一致。");
  }
  if (params.selfDeceptionLevel >= 0.55) {
    conflicts.push("意识状态可能正在替真实欲望辩护或遮蔽真实欲望。");
  }
  if (params.maskPressure >= 0.55) {
    conflicts.push("社交面具压力较高，角色倾向隐藏脆弱感。");
  }
  if (params.behaviorState !== params.expressedState.replace("表达状态：", "")) {
    conflicts.push("语言表达与实际行为可能出现偏差。");
  }
  if (!conflicts.length) {
    conflicts.push("真实状态、表达状态和行为状态暂时较一致。");
  }
  return conflicts;
}
