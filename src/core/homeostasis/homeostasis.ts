import { createPsychologicalBoundary, type PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import { defaultMetaState, type MetaState } from "../meta/metaState";
import { average, clamp01, moveToward, round4 } from "../parameters/parameterMath";
import { defaultRewardState, type RewardState } from "../reward/rewardSystem";

export interface HomeostasisState {
  stabilitySetPoint: number;
  changeResistance: number;
  recoveryBias: number;
  moderationBias: number;
  scarRetention: number;
}

export interface HomeostasisTrace {
  before: HomeostasisState;
  after: HomeostasisState;
  pressure: number;
  resistance: number;
  regulatedMetaState: MetaState;
  regulatedBoundary: PsychologicalBoundary;
  regulatedRewardState: RewardState;
  reasons: string[];
}

export function defaultHomeostasisState(): HomeostasisState {
  return {
    stabilitySetPoint: 0.52,
    changeResistance: 0.62,
    recoveryBias: 0.48,
    moderationBias: 0.58,
    scarRetention: 0.32
  };
}

export function linFanHomeostasisState(): HomeostasisState {
  return {
    ...defaultHomeostasisState(),
    changeResistance: 0.7,
    recoveryBias: 0.36,
    moderationBias: 0.5,
    scarRetention: 0.48
  };
}

export function applyHomeostasis(params: {
  homeostasis: HomeostasisState;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
  daysElapsed: number;
}): HomeostasisTrace {
  const before = { ...params.homeostasis };
  const pressure = calculateSystemPressure(params);
  const timeScale = Math.min(1, Math.max(0, params.daysElapsed) / 30);
  const resistance = clamp01(before.changeResistance * (0.65 + pressure * 0.35));
  const regulationRate = timeScale * before.recoveryBias * (1 - resistance * 0.42);
  const moderationRate = timeScale * before.moderationBias * 0.1;
  const regulatedMetaState = regulateMeta(params.meta, regulationRate, moderationRate);
  const regulatedBoundary = regulateBoundary(params.boundary, before, regulationRate);
  const regulatedRewardState = regulateReward(params.reward, regulationRate, moderationRate);
  const after = regulateHomeostasisState(before, pressure, timeScale);

  return {
    before,
    after,
    pressure,
    resistance,
    regulatedMetaState,
    regulatedBoundary,
    regulatedRewardState,
    reasons: buildReasons({ pressure, resistance, regulationRate, scarRetention: before.scarRetention })
  };
}

function calculateSystemPressure(params: {
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
}): number {
  const defaultMeta = defaultMetaState();
  const defaultReward = defaultRewardState();
  const defaultBoundary = createPsychologicalBoundary();
  const metaDeviation = average([
    Math.abs(params.meta.emotionalSensitivity - defaultMeta.emotionalSensitivity),
    Math.abs(params.meta.resilience - defaultMeta.resilience),
    Math.abs(params.meta.selfControl - defaultMeta.selfControl),
    Math.abs(params.meta.traumaAmplification - defaultMeta.traumaAmplification)
  ]);
  const rewardDeviation = average([
    Math.abs(params.reward.dopamineLevel - defaultReward.dopamineLevel),
    Math.abs(params.reward.dopamineThreshold - defaultReward.dopamineThreshold),
    Math.abs(params.reward.craving - defaultReward.craving)
  ]);
  const boundaryDeviation = average([
    Math.abs(params.boundary.stressLoad - defaultBoundary.stressLoad),
    Math.abs(params.boundary.integrity - defaultBoundary.integrity),
    Math.abs(params.boundary.cracks - defaultBoundary.cracks)
  ]);
  return clamp01(metaDeviation * 0.34 + rewardDeviation * 0.24 + boundaryDeviation * 0.42);
}

function regulateMeta(meta: MetaState, recoveryRate: number, moderationRate: number): MetaState {
  const baseline = defaultMetaState();
  return {
    ...meta,
    emotionalSensitivity: moderate(moveToward(meta.emotionalSensitivity, baseline.emotionalSensitivity, recoveryRate), moderationRate),
    resilience: moveToward(meta.resilience, baseline.resilience, recoveryRate * 0.7),
    selfControl: moveToward(meta.selfControl, baseline.selfControl, recoveryRate * 0.7),
    traumaAmplification: moderate(moveToward(meta.traumaAmplification, baseline.traumaAmplification, recoveryRate), moderationRate),
    attention: moveToward(meta.attention, baseline.attention, recoveryRate * 0.45)
  };
}

function regulateBoundary(
  boundary: PsychologicalBoundary,
  homeostasis: HomeostasisState,
  recoveryRate: number
): PsychologicalBoundary {
  const scarRetention = homeostasis.scarRetention;
  const cracks = clamp01(boundary.cracks * (1 - recoveryRate * (1 - scarRetention)));
  const stressLoad = Math.max(0, round4(boundary.stressLoad * (1 - recoveryRate)));
  const integrity = clamp01(boundary.integrity + recoveryRate * 0.12 * (1 - scarRetention));
  return {
    ...boundary,
    stressLoad,
    cracks,
    integrity,
    phase: stressLoad > boundary.capacity ? "overflow" : stressLoad >= boundary.capacity * 0.7 ? "strained" : "stable"
  };
}

function regulateReward(reward: RewardState, recoveryRate: number, moderationRate: number): RewardState {
  const baseline = defaultRewardState();
  return {
    ...reward,
    dopamineLevel: moveToward(reward.dopamineLevel, baseline.dopamineLevel, recoveryRate),
    dopamineThreshold: moveToward(reward.dopamineThreshold, baseline.dopamineThreshold, recoveryRate * 0.8),
    rewardSensitivity: moderate(moveToward(reward.rewardSensitivity, baseline.rewardSensitivity, recoveryRate * 0.65), moderationRate),
    noveltyNeed: moderate(moveToward(reward.noveltyNeed, baseline.noveltyNeed, recoveryRate * 0.55), moderationRate),
    craving: moveToward(reward.craving, baseline.craving, recoveryRate * 0.75)
  };
}

function regulateHomeostasisState(
  state: HomeostasisState,
  pressure: number,
  timeScale: number
): HomeostasisState {
  return {
    stabilitySetPoint: state.stabilitySetPoint,
    changeResistance: clamp01(state.changeResistance + (pressure - state.changeResistance) * 0.025 * timeScale),
    recoveryBias: clamp01(state.recoveryBias + ((1 - pressure) - state.recoveryBias) * 0.02 * timeScale),
    moderationBias: state.moderationBias,
    scarRetention: clamp01(state.scarRetention + (pressure - state.scarRetention) * 0.015 * timeScale)
  };
}

function buildReasons(params: {
  pressure: number;
  resistance: number;
  regulationRate: number;
  scarRetention: number;
}): string[] {
  const reasons: string[] = [];
  if (params.pressure >= 0.45) reasons.push("系统偏离平衡，homeostasis 产生恢复压力。");
  if (params.resistance >= 0.6) reasons.push("变化阻力较高，状态不会快速回到基线。");
  if (params.regulationRate > 0) reasons.push("连续时间推动状态向平衡点缓慢回归。");
  if (params.scarRetention >= 0.4) reasons.push("伤痕保留较高，恢复不会完全抹除历史影响。");
  if (!reasons.length) reasons.push("系统接近平衡，homeostasis 只做轻微调节。");
  return reasons;
}

function moderate(value: number, rate: number): number {
  return moveToward(value, 0.5, rate);
}
