// =========================================================================
// V10.2 Energy & Fatigue System — First real-life subsystem for Continuous Life.
// Models energy depletion, fatigue accumulation, sleep pressure, and rest
// recovery as pure functions. No state mutation, no CharacterPhysicsState writes.
// =========================================================================

import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ── EnergyFatigueState ────────────────────────────────────────────────────

export interface EnergyFatigueState {
  /** [0,1] — higher = more energy, more capable of acting. */
  energy: number;
  /** [0,1] — higher = more tired, reduced capacity. */
  fatigue: number;
  /** [0,1] — higher = stronger urge to sleep. */
  sleepPressure: number;
  /** [0,1] — accumulated lack of rest over time. */
  restDebt: number;
}

export const DEFAULT_ENERGY_FATIGUE_STATE: EnergyFatigueState = {
  energy: 0.65,
  fatigue: 0.25,
  sleepPressure: 0.3,
  restDebt: 0.2,
};

// ── EnergyFatigueContext ──────────────────────────────────────────────────

export interface EnergyFatigueContext {
  /** Hours elapsed since last tick. Must be > 0. */
  elapsedHours: number;
  /** Whether the character is currently resting/sleeping. */
  isResting: boolean;
  /** [0,1] — external stress load (from boundary). */
  stressLoad: number;
  /** [0,1] — capacity to regulate impulses. */
  selfControl: number;
  /** [0,1] — capacity to recover from adversity. */
  resilience: number;
  /** [0,1] — sensitivity to emotional stimuli. */
  emotionalSensitivity: number;
}

// ── EnergyFatigueDelta ────────────────────────────────────────────────────

export interface EnergyFatigueDelta {
  energyDelta: number;
  fatigueDelta: number;
  sleepPressureDelta: number;
  restDebtDelta: number;
}

// ── EnergyFatigueTrace ─────────────────────────────────────────────────────

export interface EnergyFatigueTrace {
  before: EnergyFatigueState;
  after: EnergyFatigueState;
  delta: EnergyFatigueDelta;
  context: EnergyFatigueContext;
  warnings: string[];
  reasons: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Max elapsed hours before time factor saturates at 1. */
const MAX_EFFECTIVE_HOURS = 24;

// Active (awake) rates — per full day equivalent
const ACTIVE_FATIGUE_RATE = 0.30; // fatigue gained per 24h awake
const ACTIVE_ENERGY_DRAIN_RATE = 0.25; // energy lost per 24h awake
const ACTIVE_SLEEP_PRESSURE_RATE = 0.28; // sleep pressure gained per 24h
const REST_DEBT_ACCUMULATION_RATE = 0.08; // rest debt gained per 24h

// Resting (asleep) rates — per full day equivalent
const REST_FATIGUE_RECOVERY_RATE = 0.35; // fatigue reduced per 24h resting
const REST_ENERGY_RECOVERY_RATE = 0.40; // energy recovered per 24h resting
const REST_SLEEP_PRESSURE_DECAY_RATE = 0.38; // sleep pressure reduced per 24h
const REST_DEBT_RECOVERY_RATE = 0.10; // rest debt reduced per 24h resting

// Modifiers
const STRESS_FATIGUE_MULTIPLIER = 0.35; // how much high stress amplifies fatigue gain
const LOW_SELF_CONTROL_FATIGUE_MULTIPLIER = 0.30; // how much low self-control amplifies fatigue
const RESILIENCE_RECOVERY_BOOST = 0.30; // how much high resilience accelerates recovery
const STRESS_RECOVERY_PENALTY = 0.30; // how much high stress slows resting recovery
const EMOTIONAL_SENSITIVITY_FATIGUE_BOOST = 0.15; // extra fatigue from emotional sensitivity

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampState(state: EnergyFatigueState): EnergyFatigueState {
  return {
    energy: clamp01(state.energy),
    fatigue: clamp01(state.fatigue),
    sleepPressure: clamp01(state.sleepPressure),
    restDebt: clamp01(state.restDebt),
  };
}

function timeFactor(elapsedHours: number): number {
  return Math.min(elapsedHours / MAX_EFFECTIVE_HOURS, 1);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Delta Computation ──────────────────────────────────────────────────────

/**
 * Compute the energy/fatigue delta for a single tick.
 *
 * Active (isResting=false):
 *   - fatigue grows with elapsed time, amplified by stress and low self-control
 *   - energy drains as fatigue accumulates
 *   - sleep pressure tracks fatigue
 *   - rest debt accumulates slowly
 *
 * Resting (isResting=true):
 *   - energy and fatigue recover toward baseline
 *   - resilience speeds recovery; high stress slows it
 *   - sleep pressure decays
 *   - rest debt recovers slowly
 */
export function computeEnergyFatigueDelta(
  state: EnergyFatigueState,
  context: EnergyFatigueContext
): EnergyFatigueDelta {
  const tf = timeFactor(context.elapsedHours);
  const {
    isResting,
    stressLoad,
    selfControl,
    resilience,
    emotionalSensitivity,
  } = context;

  if (isResting) {
    // ── Resting ──────────────────────────────────────────────────────
    // Resilience boosts recovery; high stress penalizes it.
    const recoveryMultiplier =
      1 + resilience * RESILIENCE_RECOVERY_BOOST - stressLoad * STRESS_RECOVERY_PENALTY;
    const effectiveRecovery = Math.max(0.05, recoveryMultiplier);

    const fatigueDelta = round4(
      -(REST_FATIGUE_RECOVERY_RATE * tf * effectiveRecovery)
    );
    const energyDelta = round4(
      REST_ENERGY_RECOVERY_RATE * tf * effectiveRecovery
    );
    const sleepPressureDelta = round4(
      -(REST_SLEEP_PRESSURE_DECAY_RATE * tf * effectiveRecovery)
    );
    const restDebtDelta = round4(
      -(REST_DEBT_RECOVERY_RATE * tf * effectiveRecovery)
    );

    return {
      energyDelta,
      fatigueDelta,
      sleepPressureDelta,
      restDebtDelta,
    };
  }

  // ── Active / Awake ──────────────────────────────────────────────────
  // Stress amplifies fatigue gain.
  const stressAmplifier = 1 + stressLoad * STRESS_FATIGUE_MULTIPLIER;

  // Low self-control means more fatigue (you push yourself less efficiently).
  const selfControlAmplifier =
    1 + (1 - selfControl) * LOW_SELF_CONTROL_FATIGUE_MULTIPLIER;

  // High emotional sensitivity adds a small fatigue overhead.
  const emotionalAmplifier =
    1 + emotionalSensitivity * EMOTIONAL_SENSITIVITY_FATIGUE_BOOST;

  const fatigueDelta = round4(
    ACTIVE_FATIGUE_RATE * tf * stressAmplifier * selfControlAmplifier * emotionalAmplifier
  );

  // Energy drains proportionally to fatigue gain and existing fatigue.
  const fatiguePressure = (state.fatigue + fatigueDelta) * 0.5;
  const energyDelta = round4(
    -(ACTIVE_ENERGY_DRAIN_RATE * tf * stressAmplifier * (1 + fatiguePressure))
  );

  // Sleep pressure rises with fatigue.
  const sleepPressureDelta = round4(
    ACTIVE_SLEEP_PRESSURE_RATE * tf * (1 + state.fatigue * 0.5)
  );

  // Rest debt accumulates slowly.
  const restDebtDelta = round4(
    REST_DEBT_ACCUMULATION_RATE * tf * (1 + state.fatigue * 0.3)
  );

  return {
    energyDelta,
    fatigueDelta,
    sleepPressureDelta,
    restDebtDelta,
  };
}

// ── Apply Delta ────────────────────────────────────────────────────────────

/**
 * Apply a delta to an EnergyFatigueState, returning a NEW object.
 * Input state is never mutated. All values clamped to [0,1].
 */
export function applyEnergyFatigueDelta(
  state: EnergyFatigueState,
  delta: EnergyFatigueDelta
): EnergyFatigueState {
  return clampState({
    energy: round4(state.energy + delta.energyDelta),
    fatigue: round4(state.fatigue + delta.fatigueDelta),
    sleepPressure: round4(state.sleepPressure + delta.sleepPressureDelta),
    restDebt: round4(state.restDebt + delta.restDebtDelta),
  });
}

// ── Tick ────────────────────────────────────────────────────────────────────

/**
 * Run a full energy/fatigue tick: compute delta, apply it, produce trace.
 * Pure function — no state mutation, no side effects.
 */
export function tickEnergyFatigue(
  state: EnergyFatigueState,
  context: EnergyFatigueContext
): EnergyFatigueTrace {
  const warnings: string[] = [];
  const reasons: string[] = [];

  // Validate / warn
  if (context.elapsedHours <= 0) {
    warnings.push(
      `elapsedHours=${context.elapsedHours} — clamp to small positive for safety.`
    );
  }
  if (context.elapsedHours > MAX_EFFECTIVE_HOURS) {
    warnings.push(
      `elapsedHours=${context.elapsedHours}h exceeds ${MAX_EFFECTIVE_HOURS}h effective window; time factor saturated at 1.`
    );
  }

  const delta = computeEnergyFatigueDelta(state, context);
  const after = applyEnergyFatigueDelta(state, delta);

  // Clamping reasons
  const clampedKeys: string[] = [];
  if (after.energy === 0 && state.energy + delta.energyDelta < 0)
    clampedKeys.push("energy");
  if (after.energy === 1 && state.energy + delta.energyDelta > 1)
    clampedKeys.push("energy");
  if (after.fatigue === 0 && state.fatigue + delta.fatigueDelta < 0)
    clampedKeys.push("fatigue");
  if (after.fatigue === 1 && state.fatigue + delta.fatigueDelta > 1)
    clampedKeys.push("fatigue");
  if (after.sleepPressure === 0 && state.sleepPressure + delta.sleepPressureDelta < 0)
    clampedKeys.push("sleepPressure");
  if (after.sleepPressure === 1 && state.sleepPressure + delta.sleepPressureDelta > 1)
    clampedKeys.push("sleepPressure");
  if (after.restDebt === 0 && state.restDebt + delta.restDebtDelta < 0)
    clampedKeys.push("restDebt");
  if (after.restDebt === 1 && state.restDebt + delta.restDebtDelta > 1)
    clampedKeys.push("restDebt");

  // Build reasons
  if (context.isResting) {
    reasons.push("Character is resting — energy recovers, fatigue and sleep pressure decrease.");
  } else {
    reasons.push("Character is active — energy drains, fatigue and sleep pressure accumulate.");
  }

  if (context.stressLoad > 0.6) {
    reasons.push(
      `High stress load (${context.stressLoad.toFixed(2)}) amplifies fatigue gain${context.isResting ? " and slows recovery" : ""}.`
    );
  } else if (context.stressLoad < 0.3) {
    reasons.push(
      `Low stress load (${context.stressLoad.toFixed(2)}) — minimal stress amplification.`
    );
  }

  if (!context.isResting && context.selfControl < 0.4) {
    reasons.push(
      `Low self-control (${context.selfControl.toFixed(2)}) amplifies fatigue accumulation.`
    );
  }

  if (context.isResting && context.resilience > 0.6) {
    reasons.push(
      `High resilience (${context.resilience.toFixed(2)}) accelerates recovery.`
    );
  }

  if (context.isResting && context.stressLoad > 0.5) {
    reasons.push(
      `Stress (${context.stressLoad.toFixed(2)}) penalizes resting recovery.`
    );
  }

  if (clampedKeys.length > 0) {
    reasons.push(`Values clamped to [0,1] for: ${clampedKeys.join(", ")}.`);
  }

  // Attach warnings from the delta logic
  for (const w of warnings) {
    if (!reasons.includes(w)) reasons.push(w);
  }

  return {
    before: { ...state },
    after,
    delta,
    context: { ...context },
    warnings,
    reasons,
  };
}

// ── CharacterPhysicsState Context Helper ───────────────────────────────────

/**
 * Build an EnergyFatigueContext from a CharacterPhysicsState.
 * Read-only — the character state is never modified.
 */
export function buildEnergyFatigueContextFromCharacter(
  character: CharacterPhysicsState,
  elapsedHours: number,
  isResting: boolean
): EnergyFatigueContext {
  return {
    elapsedHours,
    isResting,
    stressLoad: clamp01(character.boundary.stressLoad),
    selfControl: clamp01(character.metaState.selfControl),
    resilience: clamp01(character.metaState.resilience),
    emotionalSensitivity: clamp01(character.metaState.emotionalSensitivity),
  };
}
