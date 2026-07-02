import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { ExperienceEvent } from "../event/event";
import type { MetaState } from "../meta/metaState";
import { clamp01 } from "../parameters/parameterMath";

export type AttentionChannel = "danger" | "relationship" | "reward" | "novelty" | "control";

export interface AttentionProfile {
  danger: number;
  relationship: number;
  reward: number;
  novelty: number;
  control: number;
}

export interface AttentionEvaluation {
  profile: AttentionProfile;
  dominantChannel: AttentionChannel;
  noticedTags: string[];
  score: number;
  reasons: string[];
}

const tagChannels: Record<AttentionChannel, string[]> = {
  danger: ["危险", "恐惧", "失联", "抛弃", "背叛", "欺骗", "痛苦", "威胁"],
  relationship: ["王雪", "亲密关系", "陪伴", "爱", "关系", "孤独", "等待", "依赖"],
  reward: ["成功", "认可", "表扬", "胜利", "完成", "晋升"],
  novelty: ["新", "陌生", "变化", "未知", "机会"],
  control: ["解释", "承诺", "安排", "计划", "说明", "掌控"]
};

export function buildAttentionProfile(params: {
  meta: MetaState;
  boundary: PsychologicalBoundary;
}): AttentionProfile {
  const stressRatio = params.boundary.capacity <= 0
    ? 1
    : Math.min(1, params.boundary.stressLoad / params.boundary.capacity);
  return {
    danger: clamp01(params.meta.emotionalSensitivity * 0.42 + params.meta.traumaAmplification * 0.38 + stressRatio * 0.2),
    relationship: clamp01(params.meta.attachmentStyle * 0.38 + (1 - params.meta.lonelinessTolerance) * 0.34 + params.meta.attention * 0.28),
    reward: clamp01(params.meta.curiosity * 0.25 + params.meta.trustGrowthRate * 0.35 + params.meta.selfControl * 0.2),
    novelty: clamp01(params.meta.curiosity * 0.55 + params.meta.attention * 0.3 + (1 - stressRatio) * 0.15),
    control: clamp01(params.meta.selfControl * 0.28 + params.meta.resilience * 0.24 + stressRatio * 0.28 + params.meta.attention * 0.2)
  };
}

/**
 * Evaluate what an event triggers in the character's attention system.
 *
 * This function is fully tested but NOT yet wired into `processEvent()`.
 * `buildAttentionProfile()` is already used by `runContinuousTick()` to
 * capture attention before/after each tick. `evaluateEventAttention()` is
 * the per-event counterpart — it should eventually be called from within
 * `processEvent()` so that every incoming event produces an attention
 * evaluation that feeds into memory encoding, belief evidence, and the
 * derived world model.
 *
 * Integration plan: call this during Phase 1 physics mutation (after
 * boundary impact, before memory encoding) and attach the result to
 * `PhysicsStepResult`. No LLM is needed — this is a pure rule-based
 * perception filter.
 */
export function evaluateEventAttention(params: {
  event: ExperienceEvent;
  meta: MetaState;
  boundary: PsychologicalBoundary;
}): AttentionEvaluation {
  const profile = buildAttentionProfile({ meta: params.meta, boundary: params.boundary });
  const channelScores = Object.fromEntries(
    (Object.keys(tagChannels) as AttentionChannel[]).map((channel) => [
      channel,
      profile[channel] * matchingTags(params.event.tags, tagChannels[channel]).length
    ])
  ) as Record<AttentionChannel, number>;
  const dominantChannel = dominantAttentionChannel(channelScores, profile);
  const noticedTags = matchingTags(params.event.tags, tagChannels[dominantChannel]);
  const score = clamp01(
    params.event.importance * 0.32 +
    params.event.intensity * 0.28 +
    profile[dominantChannel] * 0.28 +
    Math.min(1, noticedTags.length / 3) * 0.12
  );

  return {
    profile,
    dominantChannel,
    noticedTags,
    score,
    reasons: buildReasons(dominantChannel, noticedTags, profile)
  };
}

function dominantAttentionChannel(
  channelScores: Record<AttentionChannel, number>,
  profile: AttentionProfile
): AttentionChannel {
  return (Object.keys(channelScores) as AttentionChannel[]).sort((a, b) => {
    const scoreDelta = channelScores[b] - channelScores[a];
    if (scoreDelta !== 0) return scoreDelta;
    return profile[b] - profile[a];
  })[0] ?? "danger";
}

function matchingTags(tags: string[], candidates: string[]): string[] {
  const tagSet = new Set(tags);
  return candidates.filter((candidate) => tagSet.has(candidate));
}

function buildReasons(
  dominantChannel: AttentionChannel,
  noticedTags: string[],
  profile: AttentionProfile
): string[] {
  const reasons = [`dominant attention channel: ${dominantChannel}`];
  reasons.push(`channel strength: ${profile[dominantChannel].toFixed(4)}`);
  if (noticedTags.length) reasons.push(`noticed tags: ${noticedTags.join(", ")}`);
  return reasons;
}
