import type { ParameterNetworkTrace } from "./parameterNetwork";
import { clamp01, moveToward, round4 } from "./parameterMath";
import type { RecoveryTrace, RecoveryDimensionTrace } from "../recovery/recoveryTrace";

export type BaselineDriftDimension =
  | "baseline_self_control"
  | "baseline_boundary_integrity"
  | "baseline_emotional_amplification"
  | "baseline_craving";

export type BaselineDriftDirection = "up" | "down" | "stable";

export interface BaselineDriftCandidate {
  id: BaselineDriftDimension;
  label: string;
  currentBaseline: number;
  observedValue: number;
  suggestedBaseline: number;
  direction: BaselineDriftDirection;
  pressure: number;
  resistance: number;
  reasons: string[];
}

export interface BaselineDriftTrace {
  accumulatedDays: number;
  repetitionCount: number;
  eligible: boolean;
  candidates: BaselineDriftCandidate[];
  reasons: string[];
}

export function evaluateBaselineDrift(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  accumulatedDays: number;
  repetitionCount: number;
  driftRate?: number;
}): BaselineDriftTrace {
  const accumulatedDays = Math.max(0, Math.floor(params.accumulatedDays));
  const repetitionCount = Math.max(0, Math.floor(params.repetitionCount));
  const eligible = accumulatedDays >= 90 || repetitionCount >= 3;
  const driftRate = clamp01(params.driftRate ?? 0.025);
  const candidates = eligible
    ? buildCandidates({
      recovery: params.recovery,
      parameterNetwork: params.parameterNetwork,
      driftRate,
      accumulatedDays,
      repetitionCount
    })
    : [];

  return {
    accumulatedDays,
    repetitionCount,
    eligible,
    candidates,
    reasons: buildTraceReasons({ eligible, accumulatedDays, repetitionCount, candidates })
  };
}

function buildCandidates(params: {
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  driftRate: number;
  accumulatedDays: number;
  repetitionCount: number;
}): BaselineDriftCandidate[] {
  const dimensionsById = new Map(params.recovery.dimensions.map((dimension) => [dimension.id, dimension]));
  const candidates = [
    buildCandidate({
      id: "baseline_self_control",
      label: "自控力基线",
      currentBaseline: findDimension(dimensionsById, "self_control")?.baseline ?? 0.58,
      observedValue: params.parameterNetwork.after.selfControl,
      pressure: pressureFromDimension(findDimension(dimensionsById, "self_control"), params.parameterNetwork.before.selfControl - params.parameterNetwork.after.selfControl),
      resistance: params.recovery.obstacleFactor,
      driftRate: params.driftRate,
      reasons: ["自控力长期低于基线且恢复阻碍存在时，基线才应缓慢下移。"]
    }),
    buildCandidate({
      id: "baseline_boundary_integrity",
      label: "心理边界完整度基线",
      currentBaseline: findDimension(dimensionsById, "boundary_integrity")?.baseline ?? 1,
      observedValue: params.parameterNetwork.after.boundaryIntegrity,
      pressure: pressureFromDimension(findDimension(dimensionsById, "boundary_integrity"), params.parameterNetwork.before.boundaryIntegrity - params.parameterNetwork.after.boundaryIntegrity),
      resistance: params.recovery.scarRetention,
      driftRate: params.driftRate,
      reasons: ["边界修复长期受阻时，角色可能形成更低的边界完整度基线。"]
    }),
    buildCandidate({
      id: "baseline_emotional_amplification",
      label: "情绪放大基线",
      currentBaseline: 0.5,
      observedValue: params.parameterNetwork.after.emotionalAmplification,
      pressure: clamp01(params.parameterNetwork.after.emotionalAmplification - 0.5 + params.recovery.obstacleFactor * 0.35),
      resistance: 1 - params.recovery.safetyFactor,
      driftRate: params.driftRate,
      reasons: ["情绪放大长期偏高时，角色会更容易把同类事件体验得更重。"]
    }),
    buildCandidate({
      id: "baseline_craving",
      label: "渴求基线",
      currentBaseline: findDimension(dimensionsById, "craving")?.baseline ?? 0.18,
      observedValue: findDimension(dimensionsById, "craving")?.after ?? 0.18,
      pressure: pressureFromDimension(findDimension(dimensionsById, "craving"), params.recovery.obstacleFactor * 0.4),
      resistance: params.recovery.scarRetention,
      driftRate: params.driftRate,
      reasons: ["渴求长期无法恢复时，奖励系统的满足门槛和习惯牵引可能形成新基线。"]
    })
  ];

  const timePressure = clamp01(params.accumulatedDays / 365);
  const repetitionPressure = clamp01(params.repetitionCount / 10);
  return candidates
    .map((candidate) => ({
      ...candidate,
      pressure: clamp01(candidate.pressure * 0.65 + timePressure * 0.2 + repetitionPressure * 0.15)
    }))
    .filter((candidate) => candidate.pressure >= 0.18 && candidate.direction !== "stable")
    .sort((a, b) => b.pressure - a.pressure);
}

function buildCandidate(params: {
  id: BaselineDriftDimension;
  label: string;
  currentBaseline: number;
  observedValue: number;
  pressure: number;
  resistance: number;
  driftRate: number;
  reasons: string[];
}): BaselineDriftCandidate {
  const currentBaseline = clamp01(params.currentBaseline);
  const observedValue = clamp01(params.observedValue);
  const pressure = clamp01(params.pressure);
  const resistance = clamp01(params.resistance);
  const effectiveRate = params.driftRate * pressure * (1 - resistance * 0.55);
  const suggestedBaseline = moveToward(currentBaseline, observedValue, effectiveRate);
  return {
    id: params.id,
    label: params.label,
    currentBaseline,
    observedValue,
    suggestedBaseline,
    direction: directionFor(currentBaseline, suggestedBaseline),
    pressure,
    resistance,
    reasons: params.reasons
  };
}

function pressureFromDimension(
  dimension: RecoveryDimensionTrace | undefined,
  fallbackPressure: number
): number {
  if (!dimension) return clamp01(fallbackPressure);
  return clamp01(
    dimension.deviationAfter * 0.45 +
    (dimension.blocked ? 0.28 : 0) +
    Math.min(1, dimension.expectedStabilizationDays / 365) * 0.27
  );
}

function directionFor(before: number, after: number): BaselineDriftDirection {
  const delta = round4(after - before);
  if (delta > 0.001) return "up";
  if (delta < -0.001) return "down";
  return "stable";
}

function findDimension(
  dimensions: Map<string, RecoveryDimensionTrace>,
  id: string
): RecoveryDimensionTrace | undefined {
  return dimensions.get(id);
}

function buildTraceReasons(params: {
  eligible: boolean;
  accumulatedDays: number;
  repetitionCount: number;
  candidates: BaselineDriftCandidate[];
}): string[] {
  const reasons: string[] = [];
  if (!params.eligible) {
    reasons.push("基线漂移未开启：持续时间或重复次数还不足。");
    return reasons;
  }
  reasons.push("基线漂移进入观察窗口：持续时间或重复次数已经足够。");
  if (params.accumulatedDays >= 90) reasons.push("持续时间达到长期观察阈值。");
  if (params.repetitionCount >= 3) reasons.push("重复经历达到基线漂移观察阈值。");
  if (params.candidates.length) {
    reasons.push("存在可观察的基线漂移候选，但当前不会自动写入角色状态。");
  } else {
    reasons.push("暂未发现足够强的基线漂移候选。");
  }
  return reasons;
}
