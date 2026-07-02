// =========================================================================
// V10.3 Sleep-Wake Cycle — Circadian rhythm and sleep phase transitions.
// Models the character's sleep/wake state as a function of energy, fatigue,
// sleep pressure, and circadian drive. Pure functions only.
// No state mutation, no CharacterPhysicsState writes.
// =========================================================================

import type { EnergyFatigueState } from "./energyFatigue";

// ── SleepWakePhase ────────────────────────────────────────────────────────

export const SLEEP_WAKE_PHASES = [
  "awake",
  "drowsy",
  "falling_asleep",
  "light_sleep",
  "deep_sleep",
  "waking",
] as const;

export type SleepWakePhase = (typeof SLEEP_WAKE_PHASES)[number];

// ── SleepWakeState ─────────────────────────────────────────────────────────

export interface SleepWakeState {
  phase: SleepWakePhase;
  /** [0,1] — subjective restfulness of current/last sleep. */
  sleepQuality: number;
  /** [0,1] — how well sleep timing aligns with circadian rhythm. */
  circadianAlignment: number;
  /** Hours since last sleep period ended. */
  hoursSinceSleep: number;
  /** Hours spent in current sleep period. */
  hoursAsleep: number;
}

export const DEFAULT_SLEEP_WAKE_STATE: SleepWakeState = {
  phase: "awake",
  sleepQuality: 0.65,
  circadianAlignment: 0.7,
  hoursSinceSleep: 8,
  hoursAsleep: 0,
};

// ── SleepWakeContext ───────────────────────────────────────────────────────

export interface SleepWakeContext {
  /** Hours elapsed for this tick. */
  elapsedHours: number;
  /** Local hour of day (0–23). */
  localHour: number;
  /** [0,1] — from EnergyFatigueState. */
  energy: number;
  /** [0,1] — from EnergyFatigueState. */
  fatigue: number;
  /** [0,1] — from EnergyFatigueState. */
  sleepPressure: number;
  /** [0,1] — external stress load. */
  stressLoad: number;
  /** [0,1] — recovery capacity. */
  resilience: number;
}

// ── Circadian Sleep Drive ──────────────────────────────────────────────────

/**
 * Compute circadian sleep drive from local hour.
 *
 * Model (piecewise linear):
 *   22–5  → high (peak ~3am)
 *   6–8   → medium high (waking up)
 *   9–17  → low (daytime alert)
 *   18–21 → medium (evening wind-down)
 *
 * Output clamped to [0,1].
 */
export function computeCircadianSleepDrive(localHour: number): number {
  // Normalize hour to 0–23
  const h = ((localHour % 24) + 24) % 24;

  // Night: 22–23 and 0–5 → high drive, peak at 3am
  if (h >= 22 || h <= 5) {
    // Shortest circular distance from 3am (peak)
    const distFrom3 = Math.min(Math.abs(h - 3), 24 - Math.abs(h - 3));
    // distFrom3=0 (3am) → 1.0, distFrom3=5 (22h/8h boundary) → ~0.65
    return round4(clamp01(1.0 - distFrom3 * 0.07));
  }

  // Morning: 6–8 → medium drive, declining as morning progresses
  if (h >= 6 && h <= 8) {
    return round4(0.55 - (h - 6) * 0.1); // 6h→0.55, 8h→0.35
  }

  // Daytime: 9–17 → low drive, slight afternoon dip
  if (h >= 9 && h <= 17) {
    // Flat low with slight afternoon trough
    if (h <= 14) return round4(0.20 - (h - 9) * 0.006); // 0.20 → ~0.17
    return round4(0.17 + (h - 14) * 0.02); // slight rise toward evening
  }

  // Evening: 18–21 → medium drive, rising
  return round4(0.30 + (h - 18) * 0.08); // 18h→0.30, 21h→0.54
}

// ── Sleep Readiness ────────────────────────────────────────────────────────

/**
 * Compute how ready the character is to fall asleep.
 *
 * Factors:
 *   sleepPressure ↑   → readiness ↑  (strongest)
 *   fatigue ↑         → readiness ↑
 *   circadian drive ↑ → readiness ↑
 *   energy ↑          → readiness ↓  (too alert to sleep)
 *   hoursSinceSleep ↑ → readiness ↑
 *
 * Weighted sum clamped to [0,1].
 */
export function computeSleepReadiness(
  state: SleepWakeState,
  context: SleepWakeContext
): number {
  const circadianDrive = computeCircadianSleepDrive(context.localHour);

  // Core contributors to sleep readiness
  const sleepPressureContrib = context.sleepPressure * 0.35;
  const fatigueContrib = context.fatigue * 0.22;
  const circadianContrib = circadianDrive * 0.22;
  const energyPenalty = (1 - context.energy) * 0.15; // low energy = more ready
  const hoursSinceContrib = Math.min(state.hoursSinceSleep / 24, 1) * 0.06;

  // Stress can push someone toward exhaustion (slightly increases readiness)
  // but also disrupts sleep quality (handled separately in tick)
  const stressContrib = context.stressLoad > 0.7
    ? (context.stressLoad - 0.7) * 0.05
    : 0;

  return round4(clamp01(
    sleepPressureContrib +
    fatigueContrib +
    circadianContrib +
    energyPenalty +
    hoursSinceContrib +
    stressContrib
  ));
}

// ── Phase Selection ────────────────────────────────────────────────────────

/**
 * Select the next sleep/wake phase based on current state and context.
 * Pure decision function — no state mutation.
 */
export function selectSleepWakePhase(
  state: SleepWakeState,
  context: SleepWakeContext
): SleepWakePhase {
  const readiness = computeSleepReadiness(state, context);

  // ── Currently awake or transitioning to sleep ────────────────────
  if (state.phase === "awake" || state.phase === "drowsy" || state.phase === "falling_asleep") {
    if (readiness < 0.35) return "awake";
    if (readiness < 0.55) return "drowsy";
    if (readiness < 0.75) return "falling_asleep";
    return "light_sleep";
  }

  // ── Currently sleeping ───────────────────────────────────────────
  if (state.phase === "light_sleep" || state.phase === "deep_sleep") {
    const hoursAsleep = state.hoursAsleep + context.elapsedHours;

    // Just fell asleep — stay in light sleep for at least 1 hour
    if (hoursAsleep < 1) return "light_sleep";

    // Good conditions: can enter deep sleep (1–5 hours in)
    const conditionsGood =
      context.stressLoad < 0.6 && context.resilience > 0.4 && hoursAsleep <= 5;

    if (conditionsGood) return "deep_sleep";

    // After sufficient sleep or poor conditions → waking
    const shouldWake =
      hoursAsleep >= 6 ||
      context.fatigue < 0.2 ||
      (hoursAsleep >= 3 && context.stressLoad > 0.8); // stress disrupts sleep

    if (shouldWake) return "waking";

    // Default: stay in light sleep
    return "light_sleep";
  }

  // ── Waking phase → transition to awake ───────────────────────────
  if (state.phase === "waking") {
    return "awake";
  }

  // Fallback
  return "awake";
}

// ── Tick ────────────────────────────────────────────────────────────────────

export interface SleepWakeTrace {
  before: SleepWakeState;
  after: SleepWakeState;
  context: SleepWakeContext;
  sleepReadiness: number;
  circadianSleepDrive: number;
  warnings: string[];
  reasons: string[];
}

/**
 * Run a full sleep/wake tick: compute readiness, select phase, update
 * hoursSinceSleep/hoursAsleep, adjust quality/alignment, produce trace.
 * Pure function — input state is never mutated.
 */
export function tickSleepWake(
  state: SleepWakeState,
  context: SleepWakeContext
): SleepWakeTrace {
  const warnings: string[] = [];
  const reasons: string[] = [];

  const circadianSleepDrive = computeCircadianSleepDrive(context.localHour);
  const sleepReadiness = computeSleepReadiness(state, context);
  const nextPhase = selectSleepWakePhase(state, context);

  const prevPhase = state.phase;
  const isSleeping =
    nextPhase === "light_sleep" || nextPhase === "deep_sleep";
  const wasSleeping =
    state.phase === "light_sleep" || state.phase === "deep_sleep";

  // Update hoursSinceSleep / hoursAsleep
  let hoursSinceSleep: number;
  let hoursAsleep: number;

  if (isSleeping) {
    hoursAsleep = state.hoursAsleep + context.elapsedHours;
    hoursSinceSleep = 0;
  } else if (nextPhase === "waking") {
    // Still in the sleep period, transitioning out
    hoursAsleep = state.hoursAsleep + context.elapsedHours;
    hoursSinceSleep = 0;
  } else {
    // Awake / drowsy / falling_asleep
    hoursAsleep = 0;
    if (wasSleeping) {
      // Just woke up — reset
      hoursSinceSleep = 0;
    } else {
      hoursSinceSleep = state.hoursSinceSleep + context.elapsedHours;
    }
  }

  // ── Sleep Quality ──────────────────────────────────────────────────
  let sleepQuality = state.sleepQuality;

  if (isSleeping) {
    // Quality improves with deep sleep, degrades with stress
    const qualityDelta =
      0.02 * (context.resilience - 0.5) -
      0.03 * (context.stressLoad - 0.3);
    sleepQuality = clamp01(sleepQuality + qualityDelta * (context.elapsedHours / 8));
  } else if (nextPhase === "waking") {
    // Waking — quality reflects the sleep just had
    // High stress during sleep reduces quality
    const stressPenalty = context.stressLoad > 0.6 ? 0.05 : 0;
    sleepQuality = clamp01(sleepQuality - stressPenalty);
  }

  // ── Circadian Alignment ────────────────────────────────────────────
  let circadianAlignment = state.circadianAlignment;

  if (isSleeping) {
    // Night sleep (22–6) improves alignment
    // Daytime sleep reduces it slightly
    const h = ((context.localHour % 24) + 24) % 24;
    if (h >= 22 || h < 6) {
      circadianAlignment = clamp01(
        circadianAlignment + 0.03 * (context.elapsedHours / 8)
      );
    } else {
      circadianAlignment = clamp01(
        circadianAlignment - 0.02 * (context.elapsedHours / 8)
      );
    }
  } else {
    // Awake during day — slight alignment improvement
    const h = ((context.localHour % 24) + 24) % 24;
    if (h >= 9 && h <= 17) {
      circadianAlignment = clamp01(circadianAlignment + 0.005);
    }
  }

  // ── Build reasons ──────────────────────────────────────────────────
  if (nextPhase !== prevPhase) {
    reasons.push(
      `Phase transition: ${prevPhase} → ${nextPhase} (readiness=${sleepReadiness.toFixed(2)}, circadian=${circadianSleepDrive.toFixed(2)}).`
    );
  } else {
    reasons.push(
      `Phase stable: ${nextPhase} (readiness=${sleepReadiness.toFixed(2)}, circadian=${circadianSleepDrive.toFixed(2)}).`
    );
  }

  if (isSleeping && !wasSleeping) {
    reasons.push("Character is falling asleep — entering sleep period.");
  }
  if (!isSleeping && wasSleeping && nextPhase !== "waking") {
    reasons.push("Character has woken up — exiting sleep period.");
  }
  if (sleepReadiness > 0.7) {
    reasons.push(`High sleep readiness (${sleepReadiness.toFixed(2)}) — strong sleep pressure.`);
  }
  if (context.stressLoad > 0.6) {
    reasons.push(`High stress (${context.stressLoad.toFixed(2)}) may reduce sleep quality.`);
  }
  if (circadianSleepDrive > 0.6) {
    reasons.push(`High circadian sleep drive (${circadianSleepDrive.toFixed(2)}) — night hours.`);
  }

  // ── Warnings ───────────────────────────────────────────────────────
  if (context.elapsedHours <= 0) {
    warnings.push(`elapsedHours=${context.elapsedHours} — should be > 0.`);
  }
  if (state.hoursSinceSleep > 20) {
    warnings.push(
      `hoursSinceSleep=${state.hoursSinceSleep.toFixed(1)}h — extended wakefulness may impair function.`
    );
  }
  if (context.sleepPressure > 0.85 && nextPhase === "awake") {
    warnings.push(
      `High sleep pressure (${context.sleepPressure.toFixed(2)}) but character remains awake — possible insomnia.`
    );
  }

  const after: SleepWakeState = {
    phase: nextPhase,
    sleepQuality,
    circadianAlignment,
    hoursSinceSleep: round4(hoursSinceSleep),
    hoursAsleep: round4(hoursAsleep),
  };

  return {
    before: { ...state },
    after,
    context: { ...context },
    sleepReadiness,
    circadianSleepDrive,
    warnings,
    reasons,
  };
}

// ── Context Helper ──────────────────────────────────────────────────────────

/**
 * Build a SleepWakeContext from individual inputs.
 * Read-only — no state mutation.
 */
export function buildSleepWakeContext(input: {
  elapsedHours: number;
  localHour: number;
  energyFatigue: EnergyFatigueState;
  stressLoad: number;
  resilience: number;
}): SleepWakeContext {
  return {
    elapsedHours: input.elapsedHours,
    localHour: ((input.localHour % 24) + 24) % 24,
    energy: clamp01(input.energyFatigue.energy),
    fatigue: clamp01(input.energyFatigue.fatigue),
    sleepPressure: clamp01(input.energyFatigue.sleepPressure),
    stressLoad: clamp01(input.stressLoad),
    resilience: clamp01(input.resilience),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
