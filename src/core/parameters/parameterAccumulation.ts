import type { BaselineDriftTrace } from "./baselineDrift";
import type { ParameterNetworkTrace } from "./parameterNetwork";
import { clamp01, round4 } from "./parameterMath";
import type { RecoveryTrace } from "../recovery/recoveryTrace";

export type ParameterAccumulationBucketId =
  | "self_control_pressure"
  | "boundary_pressure"
  | "emotion_amplification_pressure"
  | "action_noise_pressure"
  | "craving_pressure";

export interface ParameterAccumulationBucket {
  id: ParameterAccumulationBucketId;
  label: string;
  accumulated: number;
  threshold: number;
  progress: number;
  readyForReview: boolean;
  reasons: string[];
}

export interface ParameterAccumulationTrace {
  buckets: ParameterAccumulationBucket[];
  dominantBucket?: ParameterAccumulationBucket;
  reviewCount: number;
  reasons: string[];
}

export function buildParameterAccumulationTrace(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): ParameterAccumulationTrace {
  const buckets = [
    buildBucket({
      id: "self_control_pressure",
      label: "自控力压力积累",
      accumulated: selfControlPressure(params),
      threshold: 0.62,
      reasons: ["疲劳、睡眠债、恢复阻碍和自控力基线候选共同形成自控压力。"]
    }),
    buildBucket({
      id: "boundary_pressure",
      label: "心理边界压力积累",
      accumulated: boundaryPressure(params),
      threshold: 0.58,
      reasons: ["压力、边界恢复阻碍和边界基线候选共同形成边界压力。"]
    }),
    buildBucket({
      id: "emotion_amplification_pressure",
      label: "情绪放大积累",
      accumulated: emotionPressure(params),
      threshold: 0.6,
      reasons: ["孤独、边界变薄和情绪放大基线候选会让同类事件被体验得更重。"]
    }),
    buildBucket({
      id: "action_noise_pressure",
      label: "行动噪声积累",
      accumulated: actionNoisePressure(params),
      threshold: 0.64,
      reasons: ["自控力下降、压力和疲劳会让意图更难稳定转化为行为。"]
    }),
    buildBucket({
      id: "craving_pressure",
      label: "渴求压力积累",
      accumulated: cravingPressure(params),
      threshold: 0.56,
      reasons: ["奖励缺口、恢复阻碍和渴求基线候选共同形成渴求压力。"]
    })
  ].sort((a, b) => b.progress - a.progress);
  const dominantBucket = buckets[0];
  const reviewCount = buckets.filter((bucket) => bucket.readyForReview).length;

  return {
    buckets,
    ...(dominantBucket ? { dominantBucket } : {}),
    reviewCount,
    reasons: buildReasons({ dominantBucket, reviewCount })
  };
}

function buildBucket(params: {
  id: ParameterAccumulationBucketId;
  label: string;
  accumulated: number;
  threshold: number;
  reasons: string[];
}): ParameterAccumulationBucket {
  const accumulated = round4(clamp01(params.accumulated));
  const threshold = round4(clamp01(params.threshold));
  const progress = threshold <= 0 ? 1 : round4(clamp01(accumulated / threshold));
  return {
    id: params.id,
    label: params.label,
    accumulated,
    threshold,
    progress,
    readyForReview: progress >= 1,
    reasons: params.reasons
  };
}

function selfControlPressure(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): number {
  const drop = params.parameterNetwork.before.selfControl - params.parameterNetwork.after.selfControl;
  return weightedPressure({
    network: drop,
    recovery: params.recovery.obstacleFactor,
    baseline: candidatePressure(params.baselineDrift, "baseline_self_control")
  });
}

function boundaryPressure(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): number {
  const drop = params.parameterNetwork.before.boundaryIntegrity - params.parameterNetwork.after.boundaryIntegrity;
  return weightedPressure({
    network: drop + params.parameterNetwork.before.stress * 0.25,
    recovery: params.recovery.scarRetention,
    baseline: candidatePressure(params.baselineDrift, "baseline_boundary_integrity")
  });
}

function emotionPressure(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): number {
  const rise = params.parameterNetwork.after.emotionalAmplification - params.parameterNetwork.before.emotionalAmplification;
  return weightedPressure({
    network: rise + params.parameterNetwork.after.loneliness * 0.18,
    recovery: params.recovery.obstacleFactor,
    baseline: candidatePressure(params.baselineDrift, "baseline_emotional_amplification")
  });
}

function actionNoisePressure(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): number {
  const rise = params.parameterNetwork.after.actionNoise - params.parameterNetwork.before.actionNoise;
  return weightedPressure({
    network: rise + params.parameterNetwork.after.fatigue * 0.22,
    recovery: 1 - params.recovery.safetyFactor,
    baseline: 0
  });
}

function cravingPressure(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
}): number {
  return weightedPressure({
    network: params.parameterNetwork.after.rewardDeficit,
    recovery: params.recovery.obstacleFactor,
    baseline: candidatePressure(params.baselineDrift, "baseline_craving")
  });
}

function weightedPressure(params: {
  network: number;
  recovery: number;
  baseline: number;
}): number {
  return clamp01(
    clamp01(params.network) * 0.46 +
    clamp01(params.recovery) * 0.28 +
    clamp01(params.baseline) * 0.26
  );
}

function candidatePressure(
  trace: BaselineDriftTrace,
  id: string
): number {
  return trace.candidates.find((candidate) => candidate.id === id)?.pressure ?? 0;
}

function buildReasons(params: {
  dominantBucket: ParameterAccumulationBucket | undefined;
  reviewCount: number;
}): string[] {
  const reasons: string[] = [];
  if (params.dominantBucket) {
    reasons.push(`dominant accumulation bucket: ${params.dominantBucket.id}`);
  }
  if (params.reviewCount > 0) {
    reasons.push("one or more accumulation buckets crossed the manual review threshold");
  } else {
    reasons.push("no accumulation bucket crossed the manual review threshold");
  }
  return reasons;
}
