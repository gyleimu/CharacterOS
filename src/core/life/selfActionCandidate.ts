// =========================================================================
// V10.7 Self-Action Candidate System — Pre-behavior, not behavior.
// Generates possible self-directed actions from current life state signals.
// Candidates are NEVER auto-executed. They are pure, deterministic, and
// fully traceable. No state mutation. No LLM. No API.
// =========================================================================

import {
  SELF_ACTION_CANDIDATE_TYPES,
  type SelfActionCandidateType,
} from "./lifeTickTypes";
import type { BoredomExpansionState } from "./boredomInspiration";
import type { InspirationSeedCandidate } from "./boredomInspiration";
import type { EnergyFatigueState } from "./energyFatigue";
import type { SleepWakeState } from "./sleepWake";
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// Re-export for convenience
export { SELF_ACTION_CANDIDATE_TYPES, type SelfActionCandidateType };

// ── SelfActionCandidateContext ─────────────────────────────────────────────

export interface SelfActionCandidateContext {
  /** Hours elapsed for this tick. */
  elapsedHours: number;

  // Energy / fatigue
  energy: number;
  fatigue: number;
  sleepPressure: number;

  // Sleep
  sleepPhase: string;

  // Boredom expansion
  boredom: number;
  restlessness: number;
  explorationPressure: number;
  irritability: number;

  // Random thought
  randomThoughtKind?: string;
  randomThoughtActionPotential?: number;
  randomThoughtPhrase?: string;

  // Inspiration
  inspirationSeedCount: number;
  strongestInspirationStrength: number;

  // Psychological
  stressLoad: number;
  loneliness: number;
  selfControl: number;

  // Needs / desires
  activeNeedIntensity: number;
  desirePressure: number;
}

// ── GeneratedSelfActionCandidate ───────────────────────────────────────────

export interface GeneratedSelfActionCandidate {
  id: string;
  type: SelfActionCandidateType;
  /** [0,1] — overall drive strength for this action. */
  strength: number;
  /** [0,1] — how soon the character might act. */
  urgency: number;
  /** [0,1] — internal resistance to acting. */
  friction: number;
  /** [0,1] — potential downside of this action. */
  risk: number;
  /** [0,1] — composite score = strength - friction + urgency bonus. */
  score: number;
  /** Which context fields drove this candidate. */
  sourceSignals: string[];
  /** Human-readable explanation. */
  reasons: string[];
  /** Must be false — candidates are never evaluated in V10.7. */
  evaluated: false;
  /** Must be false — candidates are never executed in V10.7. */
  executed: false;
}

// ── SelfActionCandidateTrace ───────────────────────────────────────────────

export interface SelfActionCandidateTrace {
  phase: "self_action_candidate";
  candidates: GeneratedSelfActionCandidate[];
  suppressedCandidates: GeneratedSelfActionCandidate[];
  warnings: string[];
  reasons: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 0.1;
const MIN_SCORE_FOR_CANDIDATE = 0.08;

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Context Builder ────────────────────────────────────────────────────────

/**
 * Build a SelfActionCandidateContext from character and life substates.
 * Tolerant of missing optional inputs — all fields default to sensible values.
 */
export function buildSelfActionCandidateContextFromCharacter(input: {
  state: CharacterPhysicsState;
  energyFatigue?: EnergyFatigueState | null;
  sleepWake?: SleepWakeState | null;
  boredomState?: BoredomExpansionState | null;
  randomThoughtKind?: string;
  randomThoughtActionPotential?: number;
  randomThoughtPhrase?: string;
  inspirationSeeds?: InspirationSeedCandidate[];
  elapsedHours?: number;
  activeNeedIntensity?: number;
  desirePressure?: number;
}): SelfActionCandidateContext {
  const state = input.state;
  const ef = input.energyFatigue;
  const sw = input.sleepWake;
  const bs = input.boredomState;
  const seeds = input.inspirationSeeds ?? [];

  const strongestSeed =
    seeds.length > 0
      ? Math.max(...seeds.map((s) => s.probability))
      : 0;

  const result: SelfActionCandidateContext = {
    elapsedHours: input.elapsedHours ?? 1,

    energy: clamp01(ef?.energy ?? 0.5),
    fatigue: clamp01(ef?.fatigue ?? 0.3),
    sleepPressure: clamp01(ef?.sleepPressure ?? 0.3),

    sleepPhase: sw?.phase ?? "awake",

    boredom: clamp01(bs?.boredom ?? 0.2),
    restlessness: clamp01(bs?.restlessness ?? 0.15),
    explorationPressure: clamp01(bs?.explorationPressure ?? 0.2),
    irritability: clamp01(bs?.irritability ?? 0.1),

    inspirationSeedCount: seeds.length,
    strongestInspirationStrength: clamp01(strongestSeed),

    stressLoad: clamp01(state.boundary.stressLoad),
    loneliness: clamp01(1 - clamp01(state.metaState.lonelinessTolerance)),
    selfControl: clamp01(state.metaState.selfControl),

    activeNeedIntensity: clamp01(input.activeNeedIntensity ?? 0.3),
    desirePressure: clamp01(input.desirePressure ?? 0.25),
  };

  // Only set optional fields when they have values (exactOptionalPropertyTypes)
  if (input.randomThoughtKind !== undefined) {
    result.randomThoughtKind = input.randomThoughtKind;
  }
  if (input.randomThoughtActionPotential != null) {
    result.randomThoughtActionPotential = clamp01(input.randomThoughtActionPotential);
  }
  if (input.randomThoughtPhrase !== undefined) {
    result.randomThoughtPhrase = input.randomThoughtPhrase;
  }

  return result;
}

// ── Scoring ────────────────────────────────────────────────────────────────

/**
 * Score a single self-action candidate type against context.
 * Pure, deterministic — no randomness in scoring.
 */
export function scoreSelfActionCandidate(
  type: SelfActionCandidateType,
  context: SelfActionCandidateContext
): GeneratedSelfActionCandidate {
  const signals: string[] = [];
  const reasons: string[] = [];

  let strength = 0;
  let urgency = 0;
  let friction = 0.1; // base friction
  let risk = 0.05; // base risk

  const {
    energy, fatigue, sleepPressure, sleepPhase,
    boredom, restlessness, explorationPressure, irritability,
    stressLoad, loneliness, selfControl,
    activeNeedIntensity, desirePressure,
    inspirationSeedCount, strongestInspirationStrength,
    randomThoughtKind, randomThoughtActionPotential,
  } = context;

  const isAwake = sleepPhase === "awake" || sleepPhase === "drowsy" || sleepPhase === "waking";
  const isSleeping = sleepPhase === "light_sleep" || sleepPhase === "deep_sleep";

  // ── Per-type scoring ───────────────────────────────────────────────

  switch (type) {
    case "sleep": {
      strength += sleepPressure * 0.4 + fatigue * 0.35;
      urgency += sleepPressure * 0.5 + fatigue * 0.3;
      friction += restlessness * 0.3 + strongestInspirationStrength * 0.15;
      risk += 0.02;
      signals.push("sleepPressure", "fatigue");

      if (sleepPressure > 0.5) {
        reasons.push(`High sleep pressure (${sleepPressure.toFixed(2)}) drives need for sleep.`);
      }
      if (fatigue > 0.5) {
        reasons.push(`High fatigue (${fatigue.toFixed(2)}) — body wants rest.`);
      }
      if (isSleeping) {
        strength += 0.3;
        urgency += 0.2;
        reasons.push("Already in sleep phase — natural continuation.");
      }
      if (restlessness > 0.5) {
        reasons.push(`Restlessness (${restlessness.toFixed(2)}) resists settling down.`);
      }
      break;
    }

    case "do_nothing": {
      strength += (1 - energy) * 0.3 + fatigue * 0.25;
      friction += selfControl * 0.2 + restlessness * 0.25;
      risk += 0.01;
      signals.push("energy", "fatigue");

      if (energy < 0.4) {
        reasons.push(`Low energy (${energy.toFixed(2)}) — no drive to act.`);
      }
      if (fatigue > 0.5) {
        reasons.push(`Fatigue (${fatigue.toFixed(2)}) discourages action.`);
      }
      const rtAp = randomThoughtActionPotential ?? 0;
      if (rtAp < 0.2) {
        strength += 0.15;
        reasons.push("Low random thought action potential — mind is quiet.");
      }
      if (activeNeedIntensity < 0.3) {
        strength += 0.1;
        reasons.push("No pressing needs — nothing urgent to do.");
      }
      if (restlessness > 0.5) {
        reasons.push(`Restlessness (${restlessness.toFixed(2)}) pushes against inaction.`);
      }
      break;
    }

    case "write_note": {
      strength += inspirationSeedCount * 0.15 + strongestInspirationStrength * 0.3;
      strength += energy * 0.15;
      friction += fatigue * 0.3 + irritability * 0.2;
      risk += 0.03;
      signals.push("inspirationSeedCount", "strongestInspirationStrength");

      if (randomThoughtKind === "question" || randomThoughtKind === "self_talk" || randomThoughtKind === "image") {
        strength += 0.2;
        signals.push("randomThoughtKind");
        reasons.push(`Random thought kind "${randomThoughtKind}" suggests reflective writing.`);
      }
      if (inspirationSeedCount > 0) {
        reasons.push(`${inspirationSeedCount} inspiration seed(s) — writing may capture them.`);
      }
      if (energy > 0.5) {
        reasons.push("Sufficient energy for reflective action.");
      }
      if (fatigue > 0.6) {
        reasons.push(`Fatigue (${fatigue.toFixed(2)}) reduces writing motivation.`);
      }
      break;
    }

    case "go_for_walk": {
      strength += restlessness * 0.35 + explorationPressure * 0.35;
      strength += energy * 0.2;
      urgency += restlessness * 0.3;
      friction += fatigue * 0.3 + (isSleeping ? 0.5 : 0);
      friction += stressLoad * 0.15;
      risk += 0.04;
      signals.push("restlessness", "explorationPressure", "energy");

      if (restlessness > 0.4) {
        reasons.push(`Restlessness (${restlessness.toFixed(2)}) — body wants to move.`);
      }
      if (explorationPressure > 0.4) {
        reasons.push(`Exploration pressure (${explorationPressure.toFixed(2)}) — seeking new stimuli.`);
      }
      if (!isAwake) {
        friction += 0.4;
        reasons.push("Not fully awake — unlikely to go outside.");
      }
      if (fatigue > 0.6) {
        reasons.push(`Fatigue (${fatigue.toFixed(2)}) reduces physical motivation.`);
      }
      break;
    }

    case "check_phone": {
      strength += loneliness * 0.3 + restlessness * 0.2;
      strength += desirePressure * 0.2;
      urgency += loneliness * 0.25;
      friction += selfControl * 0.25;
      risk += 0.02;
      signals.push("loneliness", "restlessness", "desirePressure");

      if (loneliness > 0.4) {
        reasons.push(`Loneliness (${loneliness.toFixed(2)}) — reaching for connection.`);
      }
      if (randomThoughtKind === "desire_shadow") {
        strength += 0.15;
        signals.push("randomThoughtKind");
        reasons.push("Desire shadow thought — phone as proxy for contact.");
      }
      if (selfControl > 0.6) {
        reasons.push(`Self-control (${selfControl.toFixed(2)}) moderates phone-checking impulse.`);
      }
      break;
    }

    case "avoid_message": {
      strength += stressLoad * 0.35 + irritability * 0.3;
      strength += fatigue * 0.2;
      friction += selfControl * 0.15;
      risk += 0.06;
      signals.push("stressLoad", "irritability", "fatigue");

      if (stressLoad > 0.5) {
        reasons.push(`High stress (${stressLoad.toFixed(2)}) — avoiding additional social load.`);
      }
      if (irritability > 0.4) {
        reasons.push(`Irritability (${irritability.toFixed(2)}) — not in the mood to engage.`);
      }
      if (selfControl < 0.4) {
        strength += 0.15;
        reasons.push(`Low self-control (${selfControl.toFixed(2)}) — harder to face messages.`);
      }
      break;
    }

    case "revisit_memory": {
      strength += boredom * 0.3 + loneliness * 0.25;
      urgency += boredom * 0.2;
      friction += fatigue * 0.15;
      risk += 0.02;
      signals.push("boredom", "loneliness");

      if (randomThoughtKind === "memory_echo") {
        strength += 0.35;
        signals.push("randomThoughtKind");
        reasons.push(`Memory echo thought — tendency to revisit the past.`);
      }
      if (boredom > 0.4) {
        reasons.push(`Boredom (${boredom.toFixed(2)}) — mind wanders to memories.`);
      }
      if (loneliness > 0.4) {
        reasons.push(`Loneliness (${loneliness.toFixed(2)}) — memories as comfort.`);
      }
      break;
    }

    case "seek_contact": {
      strength += loneliness * 0.4 + desirePressure * 0.3;
      strength += activeNeedIntensity * 0.2;
      urgency += loneliness * 0.3;
      friction += stressLoad * 0.3 + fatigue * 0.2;
      friction += (1 - selfControl) * 0.2;
      risk += 0.05;
      signals.push("loneliness", "desirePressure", "activeNeedIntensity");

      if (loneliness > 0.35) {
        reasons.push(`Loneliness (${loneliness.toFixed(2)}) drives toward social contact.`);
      }
      if (stressLoad > 0.6) {
        friction += 0.15;
        reasons.push(`High stress (${stressLoad.toFixed(2)}) suppresses social approach.`);
      }
      if (fatigue > 0.6) {
        friction += 0.1;
        reasons.push(`Fatigue (${fatigue.toFixed(2)}) reduces social energy.`);
      }
      break;
    }

    case "withdraw": {
      strength += stressLoad * 0.35 + irritability * 0.35;
      strength += fatigue * 0.2 + (1 - energy) * 0.15;
      urgency += stressLoad * 0.2;
      friction += selfControl * 0.1;
      risk += 0.04;
      signals.push("stressLoad", "irritability", "fatigue", "energy");

      if (stressLoad > 0.5) {
        reasons.push(`High stress (${stressLoad.toFixed(2)}) — withdrawing to protect self.`);
      }
      if (irritability > 0.4) {
        reasons.push(`Irritability (${irritability.toFixed(2)}) — preferring solitude.`);
      }
      if (energy < 0.4) {
        reasons.push(`Low energy (${energy.toFixed(2)}) — no capacity for engagement.`);
      }
      break;
    }
  }

  // ── Sleep phase override ────────────────────────────────────────────
  if (isSleeping && type !== "sleep" && type !== "do_nothing") {
    friction += 0.5;
    reasons.push("Character is sleeping — non-sleep actions are suppressed.");
  }

  // ── Clamp & compute score ───────────────────────────────────────────
  strength = clamp01(strength);
  urgency = clamp01(urgency);
  friction = clamp01(friction);
  risk = clamp01(risk);

  const score = clamp01(strength * 0.5 - friction * 0.3 + urgency * 0.2);

  return {
    id: `sac-${type}`,
    type,
    strength: round4(strength),
    urgency: round4(urgency),
    friction: round4(friction),
    risk: round4(risk),
    score: round4(score),
    sourceSignals: [...new Set(signals)],
    reasons,
    evaluated: false,
    executed: false,
  };
}

// ── Candidate Generation ───────────────────────────────────────────────────

export interface GenerateOptions {
  /** Max candidates to include (default 5). */
  limit?: number;
  /** Whether to include suppressed candidates in the trace. */
  includeSuppressed?: boolean;
  /** Minimum score for inclusion (default 0.1). */
  minScore?: number;
}

/**
 * Generate self-action candidates from context.
 * Pure, deterministic. Same context → same candidates every time.
 */
export function generateSelfActionCandidates(
  context: SelfActionCandidateContext,
  options?: GenerateOptions
): SelfActionCandidateTrace {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const includeSuppressed = options?.includeSuppressed ?? false;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const warnings: string[] = [];
  const reasons: string[] = [];

  // Score all candidate types
  const allScored = SELF_ACTION_CANDIDATE_TYPES.map((type) =>
    scoreSelfActionCandidate(type, context)
  );

  // Sort by score descending (stable — equal scores preserve type order)
  const sorted = [...allScored].sort((a, b) => b.score - a.score);

  // Split into candidates and suppressed
  const candidates = sorted
    .filter((c) => c.score >= minScore)
    .slice(0, limit);

  const suppressedCandidates = sorted.filter(
    (c) => c.score < MIN_SCORE_FOR_CANDIDATE || c.score < minScore
  );

  // ── Reasons ──────────────────────────────────────────────────────────
  reasons.push(
    `Generated ${candidates.length} candidate(s) above score threshold ${minScore}.`
  );
  reasons.push(
    `${suppressedCandidates.length} candidate(s) suppressed (below threshold or excluded).`
  );

  if (candidates.length === 0) {
    warnings.push("No candidates met the minimum score threshold.");
  }

  if (context.sleepPhase !== "awake" && context.sleepPhase !== "drowsy" && context.sleepPhase !== "waking") {
    warnings.push("Character is not awake — active candidates are suppressed.");
  }

  return {
    phase: "self_action_candidate",
    candidates,
    suppressedCandidates: includeSuppressed ? suppressedCandidates : [],
    warnings,
    reasons,
  };
}
