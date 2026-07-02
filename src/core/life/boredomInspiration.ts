// =========================================================================
// V10.5 Boredom Expansion & Inspiration Seed — Boredom is not emptiness.
// It drives attention drift, exploration desire, daydreaming, irritability,
// and creative incubation. Inspiration seeds are candidates only — they are
// not executed, not creative output, not stories.
// Pure functions only. No LLM. No state mutation.
// =========================================================================

import { createSeededRandom, type SeededRandom } from "./seededRandom";
import type { DreamFragment } from "./dream";
import type { EnergyFatigueState } from "./energyFatigue";
import type { SleepWakeState } from "./sleepWake";
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ── BoredomExpansionState ──────────────────────────────────────────────────

export interface BoredomExpansionState {
  /** [0,1] — core boredom level. */
  boredom: number;
  /** [0,1] — physical/mental restlessness. */
  restlessness: number;
  /** [0,1] — tendency to drift into daydreams. */
  daydreamingTendency: number;
  /** [0,1] — pressure to seek new stimuli or explore. */
  explorationPressure: number;
  /** [0,1] — irritability / frustration from boredom. */
  irritability: number;
}

export const DEFAULT_BOREDOM_EXPANSION_STATE: BoredomExpansionState = {
  boredom: 0.25,
  restlessness: 0.2,
  daydreamingTendency: 0.35,
  explorationPressure: 0.25,
  irritability: 0.15,
};

// ── BoredomExpansionContext ────────────────────────────────────────────────

export interface BoredomExpansionContext {
  elapsedHours: number;
  /** [0,1] — low stimulation = more boredom. */
  stimulationLevel: number;
  /** [0,1] — low social contact = more boredom. */
  socialContactLevel: number;
  /** [0,1] */
  energy: number;
  /** [0,1] */
  fatigue: number;
  /** [0,1] — from metaState.curiosity. */
  curiosity: number;
  /** [0,1] */
  stressLoad: number;
  /** [0,1] */
  sleepQuality: number;
}

// ── BoredomExpansionDelta ──────────────────────────────────────────────────

export interface BoredomExpansionDelta {
  boredomDelta: number;
  restlessnessDelta: number;
  daydreamingDelta: number;
  explorationPressureDelta: number;
  irritabilityDelta: number;
}

// ── BoredomExpansionTrace ──────────────────────────────────────────────────

export interface BoredomExpansionTrace {
  before: BoredomExpansionState;
  after: BoredomExpansionState;
  delta: BoredomExpansionDelta;
  context: BoredomExpansionContext;
  warnings: string[];
  reasons: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_EFFECTIVE_HOURS = 24;

// Base rates per 24h equivalent
const BOREDOM_BASE_RATE = 0.25;
const RESTLESSNESS_BASE_RATE = 0.20;
const DAYDREAMING_BASE_RATE = 0.18;
const EXPLORATION_BASE_RATE = 0.15;
const IRRITABILITY_BASE_RATE = 0.12;

// Modifiers
const STIMULATION_SUPPRESSION = 0.8;
const SOCIAL_SUPPRESSION = 0.5;
const ENERGY_REQUIREMENT = 0.6;
const FATIGUE_SUPPRESSION = 0.5;
const BOREDOM_RESTLESSNESS_LINK = 0.4;
const STRESS_IRRITABILITY_BOOST = 0.35;
const CURIOSITY_EXPLORATION_BOOST = 0.4;
const SLEEP_QUALITY_DAYDREAM_BOOST = 0.25;

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampState(state: BoredomExpansionState): BoredomExpansionState {
  return {
    boredom: clamp01(state.boredom),
    restlessness: clamp01(state.restlessness),
    daydreamingTendency: clamp01(state.daydreamingTendency),
    explorationPressure: clamp01(state.explorationPressure),
    irritability: clamp01(state.irritability),
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
 * Compute boredom expansion delta for a single tick.
 *
 * Boredom grows when stimulation and social contact are low, energy is
 * sufficient, and fatigue is not suppressing everything. Boredom is NOT
 * a failure state — it drives restlessness, daydreaming, exploration
 * pressure, and irritability through secondary pathways.
 */
export function computeBoredomExpansionDelta(
  state: BoredomExpansionState,
  context: BoredomExpansionContext
): BoredomExpansionDelta {
  const tf = timeFactor(context.elapsedHours);

  // ── Boredom ──────────────────────────────────────────────────────────
  // Boredom increases when stimulation is low, social contact is low,
  // and the character has enough energy to notice.
  const stimulationDeficit = Math.max(0, 1 - context.stimulationLevel);
  const socialDeficit = Math.max(0, 1 - context.socialContactLevel);

  const boredomGain =
    BOREDOM_BASE_RATE *
    tf *
    stimulationDeficit * STIMULATION_SUPPRESSION +
    BOREDOM_BASE_RATE * tf * socialDeficit * SOCIAL_SUPPRESSION;

  // Energy must be sufficient for boredom to register (exhausted = too tired to be bored)
  const energyGate = context.energy > 0.1 ? context.energy : 0.1;

  // High fatigue suppresses boredom (too tired to care)
  const fatigueSuppression = 1 - context.fatigue * FATIGUE_SUPPRESSION;

  // Existing boredom provides some "inertia" (harder to get bored if already very bored)
  const inertiaDamp = 1 - state.boredom * 0.3;

  const boredomDelta = round4(
    boredomGain * energyGate * fatigueSuppression * inertiaDamp
  );

  // ── Restlessness ─────────────────────────────────────────────────────
  // Restlessness grows when boredom is high and energy is available.
  // Stress amplifies restlessness.
  const restlessnessGain =
    RESTLESSNESS_BASE_RATE *
    tf *
    state.boredom * BOREDOM_RESTLESSNESS_LINK *
    context.energy * ENERGY_REQUIREMENT;

  const stressRestlessnessBoost =
    context.stressLoad > 0.5
      ? (context.stressLoad - 0.5) * 0.15
      : 0;

  const restlessnessDecay =
    context.stimulationLevel > 0.6
      ? -RESTLESSNESS_BASE_RATE * tf * 0.3
      : 0;

  const restlessnessDelta = round4(
    restlessnessGain + stressRestlessnessBoost + restlessnessDecay
  );

  // ── Daydreaming Tendency ─────────────────────────────────────────────
  // Daydreaming increases when boredom is moderate (not too high), sleep
  // quality is decent, stress is not overwhelming, and fatigue is moderate.
  const boredomOptimal =
    state.boredom > 0.2 && state.boredom < 0.7 ? state.boredom * 0.5 : 0;

  const daydreamGain =
    DAYDREAMING_BASE_RATE *
    tf *
    boredomOptimal *
    (1 + context.sleepQuality * SLEEP_QUALITY_DAYDREAM_BOOST);

  // High stress blocks daydreaming (too focused on threat)
  const stressBlock = context.stressLoad > 0.7 ? -0.05 * tf : 0;

  // Daydreaming decays if restless (can't sit still to daydream)
  const restlessPenalty = state.restlessness > 0.6 ? -0.03 * tf : 0;

  const daydreamingDelta = round4(daydreamGain + stressBlock + restlessPenalty);

  // ── Exploration Pressure ─────────────────────────────────────────────
  // Pressure to explore grows when boredom is high AND curiosity is high.
  // Requires some energy but not exhaustion.
  const explorationGain =
    EXPLORATION_BASE_RATE *
    tf *
    state.boredom *
    context.curiosity * CURIOSITY_EXPLORATION_BOOST;

  // Very high fatigue suppresses exploration (too tired)
  const fatigueGate = context.fatigue > 0.8 ? 0.2 : 1;

  const explorationDelta = round4(explorationGain * fatigueGate);

  // ── Irritability ─────────────────────────────────────────────────────
  // Irritability grows when boredom is high AND (fatigue high OR stress high).
  const irritabilityGain =
    IRRITABILITY_BASE_RATE *
    tf *
    state.boredom *
    (context.fatigue * 0.5 + context.stressLoad * STRESS_IRRITABILITY_BOOST);

  const irritabilityDelta = round4(irritabilityGain);

  return {
    boredomDelta,
    restlessnessDelta,
    daydreamingDelta,
    explorationPressureDelta: explorationDelta,
    irritabilityDelta,
  };
}

// ── Apply Delta ────────────────────────────────────────────────────────────

/**
 * Apply a delta to a BoredomExpansionState, returning a NEW object.
 * Input state is never mutated.
 */
export function applyBoredomExpansionDelta(
  state: BoredomExpansionState,
  delta: BoredomExpansionDelta
): BoredomExpansionState {
  return clampState({
    boredom: round4(state.boredom + delta.boredomDelta),
    restlessness: round4(state.restlessness + delta.restlessnessDelta),
    daydreamingTendency: round4(
      state.daydreamingTendency + delta.daydreamingDelta
    ),
    explorationPressure: round4(
      state.explorationPressure + delta.explorationPressureDelta
    ),
    irritability: round4(state.irritability + delta.irritabilityDelta),
  });
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function tickBoredomExpansion(
  state: BoredomExpansionState,
  context: BoredomExpansionContext
): BoredomExpansionTrace {
  const warnings: string[] = [];
  const reasons: string[] = [];

  const delta = computeBoredomExpansionDelta(state, context);
  const after = applyBoredomExpansionDelta(state, delta);

  // ── Reasons ──────────────────────────────────────────────────────────
  if (context.stimulationLevel < 0.3) {
    reasons.push(
      `Very low stimulation (${context.stimulationLevel.toFixed(2)}) — boredom growing.`
    );
  } else if (context.stimulationLevel > 0.7) {
    reasons.push(
      `High stimulation (${context.stimulationLevel.toFixed(2)}) — boredom suppressed.`
    );
  }

  if (context.socialContactLevel < 0.3) {
    reasons.push(
      `Low social contact (${context.socialContactLevel.toFixed(2)}) — contributing to boredom.`
    );
  }

  if (delta.restlessnessDelta > 0.01) {
    reasons.push(
      `Restlessness increasing — boredom=${state.boredom.toFixed(2)}, energy=${context.energy.toFixed(2)}.`
    );
  }

  if (delta.daydreamingDelta > 0.01) {
    reasons.push(
      `Daydreaming tendency rising — moderate boredom, decent sleep quality.`
    );
  } else if (delta.daydreamingDelta < -0.005) {
    reasons.push(
      `Daydreaming suppressed — stress too high or mind too restless.`
    );
  }

  if (delta.explorationPressureDelta > 0.005) {
    reasons.push(
      `Exploration pressure building — boredom=${state.boredom.toFixed(2)} × curiosity=${context.curiosity.toFixed(2)}.`
    );
  }

  if (delta.irritabilityDelta > 0.005) {
    reasons.push(
      `Irritability increasing — boredom combined with fatigue/stress.`
    );
  }

  // ── Warnings ─────────────────────────────────────────────────────────
  if (after.boredom > 0.7) {
    warnings.push("High boredom — character may experience significant restlessness or irritability.");
  }
  if (after.irritability > 0.6) {
    warnings.push("Elevated irritability — character may respond poorly to social stimuli.");
  }
  if (context.elapsedHours <= 0) {
    warnings.push(`elapsedHours=${context.elapsedHours} — should be > 0.`);
  }

  // ── Clamping reasons ─────────────────────────────────────────────────
  const clampedKeys: string[] = [];
  if (after.boredom === 0 && state.boredom + delta.boredomDelta < 0) clampedKeys.push("boredom");
  if (after.boredom === 1 && state.boredom + delta.boredomDelta > 1) clampedKeys.push("boredom");
  if (after.restlessness === 1 && state.restlessness + delta.restlessnessDelta > 1) clampedKeys.push("restlessness");
  if (after.daydreamingTendency === 1 && state.daydreamingTendency + delta.daydreamingDelta > 1) clampedKeys.push("daydreamingTendency");
  if (after.explorationPressure === 1 && state.explorationPressure + delta.explorationPressureDelta > 1) clampedKeys.push("explorationPressure");
  if (after.irritability === 1 && state.irritability + delta.irritabilityDelta > 1) clampedKeys.push("irritability");

  if (clampedKeys.length > 0) {
    reasons.push(`Values clamped to [0,1] for: ${clampedKeys.join(", ")}.`);
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

// ── Inspiration Seed ───────────────────────────────────────────────────────

export const INSPIRATION_SEED_TYPES = [
  "memory_association",
  "problem_reframing",
  "creative_image",
  "social_realization",
  "quiet_realization",
] as const;

export type InspirationSeedType = (typeof INSPIRATION_SEED_TYPES)[number];

export interface InspirationSeedCandidate {
  id: string;
  type: InspirationSeedType;
  /** [0,1] — likelihood this seed would germinate into something meaningful. */
  probability: number;
  source: "boredom" | "daydreaming" | "dream_residue" | "memory_resurfacing";
  /** Short label describing what triggered this seed. */
  trigger: string;
  /** Must be false in V10.5 — seeds are candidates only. */
  evaluated: false;
  reasons: string[];
}

// ── Inspiration Seed Generation ────────────────────────────────────────────

export interface InspirationSeedInput {
  boredomState: BoredomExpansionState;
  dreamFragment?: DreamFragment | null;
  memorySourceCount: number;
  curiosity: number;
  seed: string;
  limit?: number;
}

/**
 * Generate inspiration seed candidates from boredom and related factors.
 *
 * Seeds are NOT creative output — they are candidate signals that *might*
 * lead to insight later. They are deterministically generated from the
 * character's current psychological state.
 */
export function generateInspirationSeedCandidates(
  input: InspirationSeedInput
): InspirationSeedCandidate[] {
  const { boredomState, dreamFragment, memorySourceCount, curiosity, seed } =
    input;
  const limit = input.limit ?? 3;
  const candidates: InspirationSeedCandidate[] = [];
  const rng = createSeededRandom(seed);
  const idBase = seed.slice(0, 8);

  // If boredom is very low, few/no candidates
  if (boredomState.boredom < 0.15) {
    return [];
  }

  let counter = 0;

  // ── Daydreaming → creative_image / memory_association ────────────────
  if (boredomState.daydreamingTendency > 0.3) {
    const prob = clamp01(
      boredomState.daydreamingTendency * 0.5 +
        curiosity * 0.2 +
        (dreamFragment ? 0.15 : 0) +
        0.05
    );
    // Irritability penalizes creative inspiration probability
    const adjustedProb = clamp01(prob - boredomState.irritability * 0.3);

    const type: InspirationSeedType =
      rng.next() < 0.5 ? "creative_image" : "memory_association";

    const trigger = type === "creative_image"
      ? "Daydreaming during idle moment"
      : "Loose memory association while mind wanders";

    candidates.push({
      id: `insp-${idBase}-${counter++}`,
      type,
      probability: round4(adjustedProb),
      source: "daydreaming",
      trigger,
      evaluated: false,
      reasons: [
        `Daydreaming tendency=${boredomState.daydreamingTendency.toFixed(2)}`,
        `Curiosity=${curiosity.toFixed(2)}`,
        dreamFragment ? "Dream fragment present — cross-pollination possible." : "",
      ].filter(Boolean),
    });
  }

  // ── Exploration pressure + curiosity → problem_reframing ─────────────
  if (
    boredomState.explorationPressure > 0.3 &&
    curiosity > 0.4
  ) {
    const prob = clamp01(
      boredomState.explorationPressure * 0.4 +
        curiosity * 0.35 -
        boredomState.irritability * 0.25 +
        0.05
    );

    candidates.push({
      id: `insp-${idBase}-${counter++}`,
      type: "problem_reframing",
      probability: round4(prob),
      source: "boredom",
      trigger: "Exploration pressure seeking new perspective",
      evaluated: false,
      reasons: [
        `Exploration pressure=${boredomState.explorationPressure.toFixed(2)}`,
        `Curiosity=${curiosity.toFixed(2)}`,
      ],
    });
  }

  // ── Dream fragment → dream_residue source ────────────────────────────
  if (dreamFragment && dreamFragment.generated) {
    const prob = clamp01(
      dreamFragment.intensity * 0.45 +
        curiosity * 0.2 +
        boredomState.daydreamingTendency * 0.15 -
        boredomState.irritability * 0.2
    );

    const type: InspirationSeedType =
      rng.next() < 0.6 ? "creative_image" : "quiet_realization";

    candidates.push({
      id: `insp-${idBase}-${counter++}`,
      type,
      probability: round4(prob),
      source: "dream_residue",
      trigger: `Dream residue: "${dreamFragment.description}"`,
      evaluated: false,
      reasons: [
        `Dream tone="${dreamFragment.tone}", intensity=${dreamFragment.intensity.toFixed(2)}`,
        `Dream symbols: ${dreamFragment.symbols.slice(0, 3).join(", ")}`,
      ],
    });
  }

  // ── Memory count → memory_association ────────────────────────────────
  if (memorySourceCount > 3 && boredomState.boredom > 0.2) {
    const prob = clamp01(
      0.15 +
        (memorySourceCount / 50) * 0.3 +
        curiosity * 0.2 -
        boredomState.irritability * 0.2
    );

    candidates.push({
      id: `insp-${idBase}-${counter++}`,
      type: "memory_association",
      probability: round4(prob),
      source: "memory_resurfacing",
      trigger: `Memory pool (${memorySourceCount} memories) — spontaneous association possible`,
      evaluated: false,
      reasons: [
        `Active memory count=${memorySourceCount}`,
        `Boredom=${boredomState.boredom.toFixed(2)} — mind has space to resurface memories.`,
      ],
    });
  }

  // ── Quiet realization — low probability, high boredom + low stimulation ──
  if (boredomState.boredom > 0.45 && boredomState.irritability < 0.5) {
    const prob = clamp01(
      boredomState.boredom * 0.2 +
        curiosity * 0.15 +
        boredomState.daydreamingTendency * 0.1 +
        0.05
    );

    candidates.push({
      id: `insp-${idBase}-${counter++}`,
      type: "quiet_realization",
      probability: round4(prob),
      source: "boredom",
      trigger: "Quiet moment of reflection during boredom",
      evaluated: false,
      reasons: [
        `Boredom creates space for reflection (${boredomState.boredom.toFixed(2)}).`,
        `Low irritability — mind is calm enough to notice.`,
      ],
    });
  }

  // Sort by probability descending, respect limit
  candidates.sort((a, b) => b.probability - a.probability);
  return candidates.slice(0, limit);
}

// ── Context Helper ──────────────────────────────────────────────────────────

/**
 * Build a BoredomExpansionContext from character state.
 * Read-only — no state is ever modified.
 */
export function buildBoredomExpansionContextFromCharacter(input: {
  state: CharacterPhysicsState;
  energyFatigue: EnergyFatigueState;
  sleepWake: SleepWakeState;
  elapsedHours: number;
  stimulationLevel: number;
  socialContactLevel: number;
}): BoredomExpansionContext {
  const { state, energyFatigue, sleepWake, elapsedHours, stimulationLevel, socialContactLevel } = input;

  return {
    elapsedHours,
    stimulationLevel: clamp01(stimulationLevel),
    socialContactLevel: clamp01(socialContactLevel),
    energy: clamp01(energyFatigue.energy),
    fatigue: clamp01(energyFatigue.fatigue),
    curiosity: clamp01(state.metaState.curiosity),
    stressLoad: clamp01(state.boundary.stressLoad),
    sleepQuality: clamp01(sleepWake.sleepQuality),
  };
}
