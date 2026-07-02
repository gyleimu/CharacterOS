import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { HomeostasisTrace } from "../homeostasis/homeostasis";
import { defaultMetaState, type MetaState } from "../meta/metaState";
import { clamp01, round4 } from "../parameters/parameterMath";
import { defaultRewardState, type RewardState } from "../reward/rewardSystem";
import { applyRecoveryCurve, type RecoveryCurveResult } from "./recoveryCurve";

export type RecoveryDimensionId =
  | "boundary_stress"
  | "boundary_integrity"
  | "self_control"
  | "craving";

export interface RecoveryDimensionTrace {
  id: RecoveryDimensionId;
  label: string;
  before: number;
  after: number;
  baseline: number;
  expectedAfter: number;
  expectedStabilizationDays: number;
  deviationBefore: number;
  deviationAfter: number;
  recoveredAmount: number;
  retainedScar: number;
  blocked: boolean;
}

export interface RecoveryTrace {
  daysElapsed: number;
  safetyFactor: number;
  obstacleFactor: number;
  scarRetention: number;
  dimensions: RecoveryDimensionTrace[];
  reasons: string[];
}

export function buildRecoveryTrace(params: {
  daysElapsed: number;
  metaBefore: MetaState;
  metaAfter: MetaState;
  boundaryBefore: PsychologicalBoundary;
  boundaryAfter: PsychologicalBoundary;
  rewardBefore: RewardState;
  rewardAfter: RewardState;
  homeostasis: HomeostasisTrace;
}): RecoveryTrace {
  const safetyFactor = calculateSafetyFactor(params);
  const obstacleFactor = calculateObstacleFactor(params);
  const scarRetention = params.homeostasis.before.scarRetention;
  const dimensions = [
    buildDimension({
      id: "boundary_stress",
      label: "边界压力恢复",
      before: params.boundaryBefore.stressLoad,
      after: params.boundaryAfter.stressLoad,
      baseline: 0,
      dailyRate: params.boundaryAfter.recoveryRate,
      daysElapsed: params.daysElapsed,
      safetyFactor,
      obstacleFactor,
      scarRetention
    }),
    buildDimension({
      id: "boundary_integrity",
      label: "边界完整度恢复",
      before: params.boundaryBefore.integrity,
      after: params.boundaryAfter.integrity,
      baseline: 1,
      dailyRate: 0.018,
      daysElapsed: params.daysElapsed,
      safetyFactor,
      obstacleFactor,
      scarRetention
    }),
    buildDimension({
      id: "self_control",
      label: "自控力恢复",
      before: params.metaBefore.selfControl,
      after: params.metaAfter.selfControl,
      baseline: defaultMetaState().selfControl,
      dailyRate: 0.015,
      daysElapsed: params.daysElapsed,
      safetyFactor,
      obstacleFactor,
      scarRetention: scarRetention * 0.5
    }),
    buildDimension({
      id: "craving",
      label: "渴求恢复",
      before: params.rewardBefore.craving,
      after: params.rewardAfter.craving,
      baseline: defaultRewardState().craving,
      dailyRate: 0.025,
      daysElapsed: params.daysElapsed,
      safetyFactor,
      obstacleFactor,
      scarRetention: scarRetention * 0.65
    })
  ];

  return {
    daysElapsed: params.daysElapsed,
    safetyFactor,
    obstacleFactor,
    scarRetention,
    dimensions,
    reasons: buildReasons({ safetyFactor, obstacleFactor, scarRetention, dimensions })
  };
}

function buildDimension(params: {
  id: RecoveryDimensionId;
  label: string;
  before: number;
  after: number;
  baseline: number;
  dailyRate: number;
  daysElapsed: number;
  safetyFactor: number;
  obstacleFactor: number;
  scarRetention: number;
}): RecoveryDimensionTrace {
  const expected = applyRecoveryCurve({
    current: params.before,
    baseline: params.baseline,
    dailyRate: params.dailyRate,
    daysElapsed: params.daysElapsed,
    safetyFactor: params.safetyFactor,
    obstacleFactor: params.obstacleFactor,
    scarRetention: params.scarRetention
  });
  return {
    id: params.id,
    label: params.label,
    before: round4(params.before),
    after: round4(params.after),
    baseline: round4(params.baseline),
    expectedAfter: expected.after,
    expectedStabilizationDays: expectedStabilizationDays({
      current: params.after,
      baseline: params.baseline,
      dailyRate: params.dailyRate,
      safetyFactor: params.safetyFactor,
      obstacleFactor: params.obstacleFactor,
      scarRetention: params.scarRetention
    }),
    deviationBefore: deviation(params.before, params.baseline),
    deviationAfter: deviation(params.after, params.baseline),
    recoveredAmount: recoveredAmount(params.before, params.after, params.baseline),
    retainedScar: expected.retainedScar,
    blocked: isBlocked(expected, params.after, params.baseline)
  };
}

function calculateSafetyFactor(params: {
  metaAfter: MetaState;
  boundaryAfter: PsychologicalBoundary;
  homeostasis: HomeostasisTrace;
}): number {
  return clamp01(
    params.metaAfter.resilience * 0.34 +
    params.boundaryAfter.integrity * 0.34 +
    (1 - clamp01(params.boundaryAfter.stressLoad)) * 0.2 +
    (1 - params.homeostasis.pressure) * 0.12
  );
}

function calculateObstacleFactor(params: {
  metaAfter: MetaState;
  boundaryAfter: PsychologicalBoundary;
  rewardAfter: RewardState;
  homeostasis: HomeostasisTrace;
}): number {
  return clamp01(
    params.boundaryAfter.cracks * 0.25 +
    params.homeostasis.pressure * 0.3 +
    params.rewardAfter.craving * 0.2 +
    params.metaAfter.traumaAmplification * 0.25
  );
}

function deviation(value: number, baseline: number): number {
  return round4(Math.abs(value - baseline));
}

function recoveredAmount(before: number, after: number, baseline: number): number {
  const beforeDeviation = Math.abs(before - baseline);
  const afterDeviation = Math.abs(after - baseline);
  return round4(Math.max(0, beforeDeviation - afterDeviation));
}

function isBlocked(expected: RecoveryCurveResult, after: number, baseline: number): boolean {
  return deviation(after, baseline) > deviation(expected.after, baseline) + 0.03;
}

function expectedStabilizationDays(params: {
  current: number;
  baseline: number;
  dailyRate: number;
  safetyFactor: number;
  obstacleFactor: number;
  scarRetention: number;
}): number {
  const currentDeviation = Math.abs(params.current - params.baseline);
  const recoverableDeviation = currentDeviation * (1 - params.scarRetention);
  if (recoverableDeviation <= 0.03) return 0;
  const effectiveDailyRate = params.dailyRate * params.safetyFactor * (1 - params.obstacleFactor) * (1 - params.scarRetention);
  if (effectiveDailyRate <= 0.0001) return 9999;
  const days = Math.log(recoverableDeviation / 0.03) / effectiveDailyRate;
  return round4(Math.min(9999, Math.max(0, days)));
}

function buildReasons(params: {
  safetyFactor: number;
  obstacleFactor: number;
  scarRetention: number;
  dimensions: RecoveryDimensionTrace[];
}): string[] {
  const reasons: string[] = [];
  if (params.safetyFactor >= 0.62) reasons.push("安全因子较高，系统具备恢复窗口。");
  if (params.obstacleFactor >= 0.45) reasons.push("阻碍因子偏高，恢复可能被裂纹、渴求或创伤放大拖慢。");
  if (params.scarRetention >= 0.42) reasons.push("伤痕保留较高，恢复不会完全回到原点。");
  if (params.dimensions.some((dimension) => dimension.blocked)) {
    reasons.push("部分恢复维度慢于预期，需要观察持续压力或环境阻碍。");
  }
  if (!reasons.length) reasons.push("恢复轨迹接近当前模型预期。");
  return reasons;
}
