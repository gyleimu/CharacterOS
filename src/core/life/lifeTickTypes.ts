// =========================================================================
// V10.1 Life Tick Types — Skeleton definitions for continuous life simulation.
// This file defines the TYPE SYSTEM only. No state mutation, no execution.
// =========================================================================

// ── Life Tick Phase ──────────────────────────────────────────────────────
// The immutable ordered sequence of phases that constitute one "life tick."
// V10.1 defines the order and names; no logic is executed yet.

export const LIFE_TICK_PHASES = [
  "passive_recovery",
  "energy_fatigue",
  "attention_drift",
  "boredom_pressure",
  "memory_resurfacing",
  "random_thought",
  "inspiration_check",
  "self_action_candidate",
  "quiet_drift",
  "trace_summary",
] as const;

export type LifeTickPhase = (typeof LIFE_TICK_PHASES)[number];

// ── LifeTickRequest ──────────────────────────────────────────────────────
// What the caller submits to request a life tick.

export interface LifeTickRequest {
  characterId: string;
  /** Must be > 0 and <= 168 (max one week). */
  elapsedHours: number;
  /** false = unobserved time (character changes without observation). */
  observed: boolean;
  /** Optional deterministic seed. If omitted, the scheduler derives one. */
  seed?: string;
  /** ISO-8601 timestamp of when the request was made. */
  requestedAt: string;
  /** dry_run = plan only, no state write. commit_later = reserved for V10.2+. */
  mode: "dry_run" | "commit_later";
}

// ── LifeTickPlan ─────────────────────────────────────────────────────────
// The scheduler's response — a concrete plan for one life tick.

export interface LifeTickPlan {
  id: string;
  characterId: string;
  elapsedHours: number;
  /** Always equals LIFE_TICK_PHASES in V10.1. */
  phaseSequence: LifeTickPhase[];
  /** Derived from elapsedHours. */
  timeScale: "short" | "daily" | "multi_day";
  seed: string;
  dryRun: boolean;
  warnings: string[];
  reasons: string[];
}

// ── LifeTickTrace Skeleton ───────────────────────────────────────────────
// The full trace produced AFTER executing a life tick.
// V10.1 defines the shape only; no state is ever changed.

export interface LifeTickTrace {
  id: string;
  characterId: string;
  planId: string;
  elapsedHours: number;
  observed: boolean;
  phaseTraces: LifePhaseTrace[];
  generatedInternalEvents: InternalEvent[];
  selfActionCandidates: SelfActionCandidate[];
  /** Always false in V10.1 — no state is mutated. */
  stateChanged: boolean;
  warnings: string[];
  reasons: string[];
  createdAt: string;
}

export interface LifePhaseTrace {
  phase: LifeTickPhase;
  /** Always false in V10.1 — no execution. */
  executed: boolean;
  changedStateKeys: string[];
  warnings: string[];
  reasons: string[];
}

// ── InternalEvent ────────────────────────────────────────────────────────
// Internal events generated during a life tick.
// V10.1 defines the types and skeleton; no real events are generated.

export const INTERNAL_EVENT_TYPES = [
  "dream_fragment",
  "random_thought",
  "memory_resurfacing",
  "boredom_spike",
  "inspiration_flash",
  "fatigue_wave",
  "loneliness_wave",
  "emotional_settling",
  "quiet_realization",
] as const;

export type InternalEventType = (typeof INTERNAL_EVENT_TYPES)[number];

export interface InternalEvent {
  id: string;
  type: InternalEventType;
  /** 0–1, how strong the event is. */
  intensity: number;
  sourcePhase: LifeTickPhase;
  description: string;
  explanationIds: string[];
  /** Must be false in V10.1 — events are generated but not evaluated. */
  evaluated: boolean;
}

// ── SelfActionCandidate ──────────────────────────────────────────────────
// Actions the character MIGHT take. These are candidates only — never
// auto-executed. V10.1 defines the types; no decisions are made.

export const SELF_ACTION_CANDIDATE_TYPES = [
  "check_phone",
  "avoid_message",
  "write_note",
  "go_for_walk",
  "sleep",
  "revisit_memory",
  "seek_contact",
  "withdraw",
  "do_nothing",
] as const;

export type SelfActionCandidateType =
  (typeof SELF_ACTION_CANDIDATE_TYPES)[number];

export interface SelfActionCandidate {
  id: string;
  type: SelfActionCandidateType;
  /** 0–1, probability of being selected if evaluated. */
  probability: number;
  sourcePhase: LifeTickPhase;
  reasons: string[];
  /** Must be false in V10.1 — candidates are generated but not evaluated. */
  evaluated: false;
}
