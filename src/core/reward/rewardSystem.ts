import type { MetaState } from "../meta/metaState";
import { clamp01, exponentialRecoveryRate, moveToward, round4 } from "../parameters/parameterMath";

export type RewardKind = "social" | "novelty" | "relief" | "achievement" | "habit" | "attachment";

export interface RewardState {
  dopamineLevel: number;
  dopamineThreshold: number;
  rewardSensitivity: number;
  noveltyNeed: number;
  adaptationRate: number;
  craving: number;
}

export interface RewardInput {
  kind: RewardKind;
  intensity: number;
  novelty: number;
  repetitionCount?: number;
  harmful?: boolean;
}

export interface RewardResult {
  before: RewardState;
  after: RewardState;
  pleasure: number;
  rewardPredictionError: number;
  thresholdDelta: number;
  cravingDelta: number;
  adaptation: number;
  reasons: string[];
}

export function defaultRewardState(): RewardState {
  return {
    dopamineLevel: 0.42,
    dopamineThreshold: 0.46,
    rewardSensitivity: 0.58,
    noveltyNeed: 0.5,
    adaptationRate: 0.08,
    craving: 0.18
  };
}

export function linFanRewardState(): RewardState {
  return {
    ...defaultRewardState(),
    dopamineLevel: 0.36,
    dopamineThreshold: 0.52,
    rewardSensitivity: 0.66,
    noveltyNeed: 0.42,
    adaptationRate: 0.1,
    craving: 0.32
  };
}

export function processReward(params: {
  state: RewardState;
  input: RewardInput;
  meta: MetaState;
}): RewardResult {
  const before = { ...params.state };
  const input = normalizeRewardInput(params.input);
  const repetition = Math.min(1, (input.repetitionCount ?? 0) / 20);
  const adaptation = clamp01(repetition * before.adaptationRate + (1 - input.novelty) * 0.18);
  const noveltyBoost = input.novelty * before.noveltyNeed * 0.22;
  const sensitivity = before.rewardSensitivity * (0.75 + params.meta.curiosity * 0.25);
  const rawReward = clamp01(input.intensity * sensitivity + noveltyBoost - adaptation * 0.28);
  const pleasure = clamp01(rawReward - before.dopamineThreshold * 0.42);
  const rewardPredictionError = round4(rawReward - before.dopamineLevel);
  const thresholdDelta = round4(Math.max(0, rawReward - before.dopamineThreshold) * 0.08);
  const cravingPressure = input.harmful ? 0.12 : 0.04;
  const cravingDelta = round4((rawReward * cravingPressure + adaptation * 0.06) - pleasure * 0.04);
  const after: RewardState = {
    dopamineLevel: clamp01(before.dopamineLevel + rewardPredictionError * 0.35 - before.dopamineLevel * 0.04),
    dopamineThreshold: clamp01(before.dopamineThreshold + thresholdDelta),
    rewardSensitivity: clamp01(before.rewardSensitivity - adaptation * 0.04 + input.novelty * 0.02),
    noveltyNeed: clamp01(before.noveltyNeed + adaptation * 0.03 - input.novelty * 0.015),
    adaptationRate: before.adaptationRate,
    craving: clamp01(before.craving + cravingDelta)
  };

  return {
    before,
    after,
    pleasure,
    rewardPredictionError,
    thresholdDelta,
    cravingDelta,
    adaptation,
    reasons: buildReasons({ input, pleasure, adaptation, cravingDelta, thresholdDelta })
  };
}

function normalizeRewardInput(input: RewardInput): RewardInput {
  return {
    ...input,
    intensity: clamp01(input.intensity),
    novelty: clamp01(input.novelty),
    repetitionCount: Math.max(0, Math.floor(input.repetitionCount ?? 0)),
    harmful: input.harmful ?? false
  };
}

export function recoverRewardBaseline(state: RewardState, daysElapsed: number): RewardState {
  const recovery = exponentialRecoveryRate(0.025, Math.max(0, daysElapsed));
  return {
    ...state,
    dopamineLevel: moveToward(state.dopamineLevel, 0.42, recovery * 0.4),
    dopamineThreshold: moveToward(state.dopamineThreshold, 0.46, recovery * 0.22),
    rewardSensitivity: moveToward(state.rewardSensitivity, 0.58, recovery * 0.18),
    noveltyNeed: moveToward(state.noveltyNeed, 0.5, recovery * 0.16),
    craving: moveToward(state.craving, 0.18, recovery * 0.2)
  };
}

function buildReasons(params: {
  input: RewardInput;
  pleasure: number;
  adaptation: number;
  cravingDelta: number;
  thresholdDelta: number;
}): string[] {
  const reasons: string[] = [];
  if (params.pleasure <= 0.08) reasons.push("奖励低于或接近阈值，主观愉悦很弱。");
  if (params.adaptation >= 0.18) reasons.push("重复或缺乏新奇降低了奖励感。");
  if (params.thresholdDelta > 0) reasons.push("奖励超过阈值，后续满足门槛会轻微升高。");
  if (params.cravingDelta > 0 && params.input.harmful) reasons.push("有害奖励仍然提高 craving，存在成瘾倾向。");
  if (params.input.kind === "attachment") reasons.push("依恋型奖励会影响角色的靠近和等待倾向。");
  return reasons;
}
