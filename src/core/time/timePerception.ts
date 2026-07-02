import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { EmotionState } from "../emotion/emotion";
import type { ExperienceEvent } from "../event/event";
import type { MetaState } from "../meta/metaState";
import { clamp, clamp01, round4 } from "../parameters/parameterMath";
import type { RewardState } from "../reward/rewardSystem";

export type TimePerceptionMode = "compressed" | "normal" | "stretched" | "frozen";

export interface TimePerceptionTrace {
  objectiveDuration: number;
  subjectiveDuration: number;
  multiplier: number;
  mode: TimePerceptionMode;
  waitingLoad: number;
  lonelinessLoad: number;
  absorptionLoad: number;
  distressLoad: number;
  reasons: string[];
}

export function perceiveEventTime(params: {
  event: ExperienceEvent;
  emotion: EmotionState;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
  objectiveDuration?: number;
}): TimePerceptionTrace {
  const objectiveDuration = params.objectiveDuration ?? 1;
  const tagSet = new Set(params.event.tags);
  const waitingLoad = hasAny(tagSet, ["等待", "失联", "迟到", "未回复"]) ? 0.78 : 0.08;
  const lonelinessLoad = hasAny(tagSet, ["孤独", "夜晚", "深夜", "亲密关系"]) ? params.meta.attachmentStyle * 0.62 : 0.08;
  const absorptionLoad = params.emotion.valence > 0
    ? clamp01(params.emotion.valence * 0.36 + params.reward.dopamineLevel * 0.24)
    : 0.04;
  const boundaryPressure = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  const distressLoad = clamp01(
    Math.max(0, -params.emotion.valence) * 0.36 +
    params.emotion.arousal * 0.18 +
    params.meta.emotionalSensitivity * 0.18 +
    boundaryPressure * 0.2
  );
  const multiplier = calculateMultiplier({
    waitingLoad,
    lonelinessLoad,
    absorptionLoad,
    distressLoad,
    rewardLevel: params.reward.dopamineLevel
  });

  return {
    objectiveDuration,
    subjectiveDuration: round4(objectiveDuration * multiplier),
    multiplier,
    mode: modeFor(multiplier, distressLoad),
    waitingLoad,
    lonelinessLoad,
    absorptionLoad,
    distressLoad,
    reasons: buildReasons({ waitingLoad, lonelinessLoad, absorptionLoad, distressLoad, multiplier })
  };
}

export function perceiveContinuousTime(params: {
  daysElapsed: number;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
}): TimePerceptionTrace {
  const boundaryPressure = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  const waitingLoad = params.meta.attachmentStyle * params.meta.emotionalSensitivity * 0.28;
  const lonelinessLoad = (1 - params.meta.lonelinessTolerance) * 0.45;
  const absorptionLoad = clamp01(params.reward.dopamineLevel * 0.24 + params.meta.curiosity * 0.16);
  const distressLoad = clamp01(boundaryPressure * 0.36 + params.meta.emotionalSensitivity * 0.2);
  const multiplier = calculateMultiplier({
    waitingLoad,
    lonelinessLoad,
    absorptionLoad,
    distressLoad,
    rewardLevel: params.reward.dopamineLevel
  });

  return {
    objectiveDuration: params.daysElapsed,
    subjectiveDuration: round4(params.daysElapsed * multiplier),
    multiplier,
    mode: modeFor(multiplier, distressLoad),
    waitingLoad,
    lonelinessLoad,
    absorptionLoad,
    distressLoad,
    reasons: buildReasons({ waitingLoad, lonelinessLoad, absorptionLoad, distressLoad, multiplier })
  };
}

function calculateMultiplier(params: {
  waitingLoad: number;
  lonelinessLoad: number;
  absorptionLoad: number;
  distressLoad: number;
  rewardLevel: number;
}): number {
  return clamp(
    1 +
    params.waitingLoad * 0.42 +
    params.lonelinessLoad * 0.28 +
    params.distressLoad * 0.38 -
    params.absorptionLoad * 0.34 -
    params.rewardLevel * 0.08,
    0.45,
    2.4
  );
}

function modeFor(multiplier: number, distressLoad: number): TimePerceptionMode {
  if (multiplier >= 1.75 && distressLoad >= 0.72) return "frozen";
  if (multiplier >= 1.15) return "stretched";
  if (multiplier <= 0.82) return "compressed";
  return "normal";
}

function buildReasons(params: {
  waitingLoad: number;
  lonelinessLoad: number;
  absorptionLoad: number;
  distressLoad: number;
  multiplier: number;
}): string[] {
  const reasons: string[] = [];
  if (params.waitingLoad >= 0.45) reasons.push("等待感拉长了主观时间。");
  if (params.lonelinessLoad >= 0.35) reasons.push("孤独和依恋需求让时间显得更慢。");
  if (params.distressLoad >= 0.55) reasons.push("高唤醒负性情绪让时间变得沉重。");
  if (params.absorptionLoad >= 0.35) reasons.push("正向投入或奖励感压缩了主观时间。");
  if (!reasons.length) reasons.push("主观时间接近客观时间。");
  return reasons;
}

function hasAny(values: Set<string>, options: string[]): boolean {
  return options.some((option) => values.has(option));
}
