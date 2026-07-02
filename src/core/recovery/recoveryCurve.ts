import { clamp01, exponentialRecoveryRate, recoverTowardBaseline, type RecoveryStep } from "../parameters/parameterMath";

export interface RecoveryCurveInput {
  current: number;
  baseline: number;
  dailyRate: number;
  daysElapsed: number;
  safetyFactor?: number;
  obstacleFactor?: number;
  scarRetention?: number;
}

export interface RecoveryCurveResult extends RecoveryStep {
  elapsedRate: number;
  obstacleFactor: number;
}

export function applyRecoveryCurve(input: RecoveryCurveInput): RecoveryCurveResult {
  const obstacleFactor = clamp01(input.obstacleFactor ?? 0);
  const elapsedRate = exponentialRecoveryRate(input.dailyRate, input.daysElapsed);
  const recovery = recoverTowardBaseline({
    current: input.current,
    baseline: input.baseline,
    recoveryRate: elapsedRate * (1 - obstacleFactor),
    safetyFactor: input.safetyFactor ?? 1,
    scarRetention: input.scarRetention ?? 0
  });

  return {
    ...recovery,
    elapsedRate,
    obstacleFactor
  };
}
