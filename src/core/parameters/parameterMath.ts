export type RelativeLevel = "very_low" | "low" | "normal" | "high" | "very_high";

export interface ParameterValue {
  current: number;
  baseline: number;
}

export interface InertiaStep {
  before: number;
  target: number;
  rate: number;
  after: number;
}

export interface AccumulationThresholdResult {
  accumulated: number;
  threshold: number;
  crossed: boolean;
  overflow: number;
}

export interface RecoveryStep {
  before: number;
  baseline: number;
  recoveryRate: number;
  safetyFactor: number;
  scarRetention: number;
  after: number;
  retainedScar: number;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, round4(value)));
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function levelToValue(level: RelativeLevel): number {
  const values: Record<RelativeLevel, number> = {
    very_low: 0.1,
    low: 0.3,
    normal: 0.5,
    high: 0.7,
    very_high: 0.9
  };
  return values[level];
}

export function valueToLevel(value: number): RelativeLevel {
  const normalized = clamp01(value);
  if (normalized < 0.2) return "very_low";
  if (normalized < 0.4) return "low";
  if (normalized < 0.6) return "normal";
  if (normalized < 0.8) return "high";
  return "very_high";
}

export function moveToward(current: number, target: number, rate: number): number {
  return clamp01(current + (target - current) * clamp01(rate));
}

export function applyInertia(params: {
  current: number;
  target: number;
  inertiaRate: number;
}): InertiaStep {
  const before = clamp01(params.current);
  const target = clamp01(params.target);
  const rate = clamp01(params.inertiaRate);
  return {
    before,
    target,
    rate,
    after: moveToward(before, target, rate)
  };
}

export function accumulateTowardThreshold(params: {
  current: number;
  pressure: number;
  decay?: number;
  threshold: number;
}): AccumulationThresholdResult {
  const decay = clamp01(params.decay ?? 0);
  const accumulated = clamp01(params.current * (1 - decay) + params.pressure);
  const threshold = clamp01(params.threshold);
  const overflow = Math.max(0, round4(accumulated - threshold));
  return {
    accumulated,
    threshold,
    crossed: accumulated >= threshold,
    overflow
  };
}

export function exponentialRecoveryRate(rate: number, elapsed: number): number {
  if (elapsed <= 0) return 0;
  return clamp01(1 - Math.exp(-clamp01(rate) * elapsed));
}

export function recoverTowardBaseline(params: {
  current: number;
  baseline: number;
  recoveryRate: number;
  safetyFactor?: number;
  scarRetention?: number;
}): RecoveryStep {
  const before = clamp01(params.current);
  const baseline = clamp01(params.baseline);
  const recoveryRate = clamp01(params.recoveryRate);
  const safetyFactor = clamp01(params.safetyFactor ?? 1);
  const scarRetention = clamp01(params.scarRetention ?? 0);
  const deviation = before - baseline;
  const recoverableDeviation = deviation * (1 - scarRetention);
  const after = clamp01(before - recoverableDeviation * recoveryRate * safetyFactor);
  return {
    before,
    baseline,
    recoveryRate,
    safetyFactor,
    scarRetention,
    after,
    retainedScar: round4(deviation * scarRetention)
  };
}
