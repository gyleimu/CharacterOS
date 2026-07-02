import type { MetaState } from "../meta/metaState";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import { clamp01 } from "../parameters/parameterMath";

export type ActionTone = "controlled" | "cold" | "shaky" | "impulsive" | "avoidant";

export interface ActionNoiseContext {
  meta: MetaState;
  boundary: PsychologicalBoundary;
  fatigue?: number;
  pain?: number;
  fear?: number;
  excitement?: number;
  skill?: number;
  randomness?: number;
}

export interface EmbodiedAction {
  intendedAction: string;
  finalAction: string;
  tone: ActionTone;
  noiseLevel: number;
  selfControlAvailable: number;
  misfireRisk: number;
  reasons: string[];
}

export function applyActionNoise(params: {
  intendedAction: string;
  context: ActionNoiseContext;
}): EmbodiedAction {
  const context = normalizeContext(params.context);
  const stressRatio = context.boundary.capacity <= 0
    ? 1
    : clamp01(context.boundary.stressLoad / context.boundary.capacity);
  const boundaryDamage = clamp01(1 - context.boundary.integrity);
  const bodyLoad = clamp01(context.fatigue * 0.32 + context.pain * 0.28 + stressRatio * 0.28 + boundaryDamage * 0.12);
  const emotionLoad = clamp01(context.fear * 0.42 + context.excitement * 0.22 + context.meta.emotionalSensitivity * 0.24);
  const controlBuffer = clamp01(context.meta.selfControl * 0.55 + context.meta.resilience * 0.25 + context.skill * 0.2);
  const selfControlAvailable = clamp01(controlBuffer - bodyLoad * 0.32 - emotionLoad * 0.24);
  const noiseLevel = clamp01(
    bodyLoad * 0.42 +
    emotionLoad * 0.35 +
    (1 - context.meta.selfControl) * 0.18 +
    context.randomness * 0.05 -
    context.skill * 0.18
  );
  const misfireRisk = clamp01(noiseLevel * 0.72 + (1 - selfControlAvailable) * 0.28);
  const tone = chooseTone({ noiseLevel, selfControlAvailable, fear: context.fear, stressRatio });

  return {
    intendedAction: params.intendedAction,
    finalAction: renderFinalAction(params.intendedAction, tone, misfireRisk),
    tone,
    noiseLevel,
    selfControlAvailable,
    misfireRisk,
    reasons: buildReasons({
      stressRatio,
      bodyLoad,
      emotionLoad,
      selfControlAvailable,
      noiseLevel,
      fatigue: context.fatigue,
      pain: context.pain
    })
  };
}

function normalizeContext(context: ActionNoiseContext): Required<ActionNoiseContext> {
  return {
    meta: context.meta,
    boundary: context.boundary,
    fatigue: clamp01(context.fatigue ?? 0),
    pain: clamp01(context.pain ?? 0),
    fear: clamp01(context.fear ?? context.meta.emotionalSensitivity * 0.5),
    excitement: clamp01(context.excitement ?? 0),
    skill: clamp01(context.skill ?? 0.5),
    randomness: clamp01(context.randomness ?? 0.5)
  };
}

function chooseTone(params: {
  noiseLevel: number;
  selfControlAvailable: number;
  fear: number;
  stressRatio: number;
}): ActionTone {
  if (params.noiseLevel < 0.22 && params.selfControlAvailable >= 0.58) return "controlled";
  if (params.fear >= 0.72 && params.selfControlAvailable < 0.42) return "avoidant";
  if (params.stressRatio >= 0.85 && params.selfControlAvailable < 0.38) return "impulsive";
  if (params.noiseLevel >= 0.48) return "shaky";
  return "cold";
}

function renderFinalAction(intendedAction: string, tone: ActionTone, misfireRisk: number): string {
  if (tone === "controlled") {
    return intendedAction;
  }
  if (tone === "cold") {
    return `${intendedAction} 但语气会更冷，表达会少于真实感受。`;
  }
  if (tone === "avoidant") {
    return `${intendedAction} 但会下意识后退，先保护自己，不把问题问到底。`;
  }
  if (tone === "impulsive") {
    return `${intendedAction} 但可能突然加重语气，说出超过原本意图的话。`;
  }
  if (misfireRisk >= 0.62) {
    return `${intendedAction} 但动作和措辞会明显不稳，可能停顿、重复或前后矛盾。`;
  }
  return `${intendedAction} 但会带着迟疑和紧绷。`;
}

function buildReasons(params: {
  stressRatio: number;
  bodyLoad: number;
  emotionLoad: number;
  selfControlAvailable: number;
  noiseLevel: number;
  fatigue: number;
  pain: number;
}): string[] {
  const reasons: string[] = [];
  if (params.stressRatio >= 0.7) reasons.push("心理边界接近或超过承压区，行动更容易变形。");
  if (params.fatigue >= 0.5) reasons.push("疲劳削弱了执行控制。");
  if (params.pain >= 0.5) reasons.push("痛感增加了身体层面的干扰。");
  if (params.emotionLoad >= 0.55) reasons.push("情绪负荷较高，意图不容易稳定落地。");
  if (params.selfControlAvailable <= 0.42) reasons.push("可用自控力偏低，误动作和过度表达风险上升。");
  if (params.noiseLevel < 0.22) reasons.push("动作噪声较低，最终行为基本贴近原始意图。");
  return reasons;
}
