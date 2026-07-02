import { clamp01, moveToward, round4 } from "../parameters/parameterMath";

export interface MetaState {
  memoryStrength: number;
  forgettingSpeed: number;
  attention: number;
  emotionalSensitivity: number;
  resilience: number;
  selfControl: number;
  curiosity: number;
  trustGrowthRate: number;
  trustDecayRate: number;
  traumaAmplification: number;
  lonelinessTolerance: number;
  attachmentStyle: number;
  needSatisfactionThreshold: number;
}

export interface MetaStateTickResult {
  before: MetaState;
  after: MetaState;
  drift: Partial<Record<keyof MetaState, number>>;
}

export function defaultMetaState(): MetaState {
  return {
    memoryStrength: 0.68,
    forgettingSpeed: 0.42,
    attention: 0.56,
    emotionalSensitivity: 0.62,
    resilience: 0.52,
    selfControl: 0.58,
    curiosity: 0.54,
    trustGrowthRate: 0.42,
    trustDecayRate: 0.58,
    traumaAmplification: 0.5,
    lonelinessTolerance: 0.42,
    attachmentStyle: 0.62,
    needSatisfactionThreshold: 0.58
  };
}

export function linFanMetaState(): MetaState {
  return {
    ...defaultMetaState(),
    memoryStrength: 0.78,
    forgettingSpeed: 0.32,
    emotionalSensitivity: 0.78,
    resilience: 0.36,
    selfControl: 0.52,
    trustGrowthRate: 0.28,
    trustDecayRate: 0.76,
    traumaAmplification: 0.72,
    lonelinessTolerance: 0.24,
    attachmentStyle: 0.84,
    needSatisfactionThreshold: 0.74
  };
}

export function updateMetaStateForTick(params: {
  meta: MetaState;
  daysElapsed: number;
  stressLoad: number;
  boundaryIntegrity: number;
}): MetaStateTickResult {
  const before = { ...params.meta };
  const pressure = clamp01(params.stressLoad * 0.7 + (1 - params.boundaryIntegrity) * 0.3);
  const timeScale = Math.min(1, params.daysElapsed / 30);
  const after: MetaState = {
    ...before,
    emotionalSensitivity: moveToward(before.emotionalSensitivity, pressure, 0.08 * timeScale),
    resilience: moveToward(before.resilience, 1 - pressure, 0.05 * timeScale),
    selfControl: moveToward(before.selfControl, 1 - pressure, 0.06 * timeScale),
    traumaAmplification: moveToward(before.traumaAmplification, pressure, 0.07 * timeScale),
    forgettingSpeed: moveToward(before.forgettingSpeed, pressure > 0.65 ? 0.24 : 0.48, 0.04 * timeScale),
    attention: moveToward(before.attention, pressure > 0.55 ? 0.76 : 0.52, 0.04 * timeScale)
  };

  return {
    before,
    after,
    drift: diffMetaState(after, before)
  };
}

export function memoryDecayRateFromMeta(meta: MetaState, baseRate: number): number {
  return round4(baseRate * (0.5 + meta.forgettingSpeed) * (1.2 - meta.memoryStrength * 0.4));
}

export function deepThinkingThresholdFromMeta(meta: MetaState, baseThreshold: number): number {
  return clamp01(baseThreshold + meta.selfControl * 0.12 + meta.resilience * 0.08 - meta.emotionalSensitivity * 0.1);
}

function diffMetaState(after: MetaState, before: MetaState): Partial<Record<keyof MetaState, number>> {
  const drift: Partial<Record<keyof MetaState, number>> = {};
  for (const key of Object.keys(after) as Array<keyof MetaState>) {
    const value = round4(after[key] - before[key]);
    if (value !== 0) drift[key] = value;
  }
  return drift;
}
