/**
 * V4.1 TemporalProcess — minimal interface layer.
 *
 * This file defines the type system for V4's Temporal Homeostasis model.
 * It does NOT replace runContinuousTick. It does NOT mutate state.
 * It exists so that V4.2+ can register V3 tick phases as metadata and
 * later (V5+) migrate toward a process-scheduled tick architecture.
 *
 * DESIGN ONLY — V4.1 does not change any V3 behavior.
 */

import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ─── Process identity ───────────────────────────────────────────────

/**
 * Unique identifier for a temporal process.
 * V3 phase IDs use the ContinuousTickPhaseName values.
 */
export type TemporalProcessId = string;

/**
 * Human-readable label for documentation and trace display.
 */
export type TemporalProcessLabel = string;

/**
 * Process category:
 * - "mutation"  — writes to CharacterPhysicsState
 * - "trace"     — builds trace artifacts, does not mutate state
 * - "context"   — provides shared context (e.g. time perception)
 */
export type TemporalProcessCategory = "mutation" | "trace" | "context";

// ─── Core interface ──────────────────────────────────────────────────

/**
 * Metadata describing a single temporal process.
 *
 * In V4.1, this is purely declarative. Each entry corresponds to one
 * phase of runContinuousTick or one V3 time-system wrapper. No actual
 * state mutation occurs through this interface yet.
 */
export interface TemporalProcess {
  /** Unique identifier — must match ContinuousTickPhaseName for tick phases. */
  readonly id: TemporalProcessId;
  /** Human-readable label. */
  readonly label: TemporalProcessLabel;
  /** Execution phase number (1-based, matches the 17-phase tick order). */
  readonly phase: number;
  /** Process category. */
  readonly category: TemporalProcessCategory;
  /** State fields this process reads from. */
  readonly reads: string[];
  /** State fields this process writes to. Empty for trace/context processes. */
  readonly writes: string[];
  /** One-line description of what this process does. */
  readonly description: string;
}

// ─── Input / output types (for future V4.2+ use) ─────────────────────

/**
 * Input to a TemporalProcess execution.
 * Not used in V4.1 — placeholder for V4.2+.
 */
export interface TemporalProcessInput {
  state: CharacterPhysicsState;
  daysElapsed: number;
  options?: Record<string, number | boolean | string>;
}

/**
 * Result of executing a single TemporalProcess.
 * Not used in V4.1 — placeholder for V4.2+.
 */
export interface TemporalProcessResult {
  processId: TemporalProcessId;
  /** Snapshot of affected fields before execution. */
  before: Record<string, unknown>;
  /** Snapshot of affected fields after execution. */
  after: Record<string, unknown>;
  /** Names of state fields that changed. */
  changedStates: string[];
  /** Human-readable reasons. */
  reasons: string[];
  /** Non-fatal warnings. */
  warnings: string[];
}

// ─── V4.2 Adapter types ───────────────────────────────────────────────

/**
 * Adapter implementation status for a temporal process.
 *
 * - "metadata_only"   — process exists as metadata only (V4.1)
 * - "adapter_shell"   — adapter declared but delegates nothing (V4.2)
 * - "delegated"       — adapter wraps a V3 function and can execute (V4.3+)
 * - "native"          — process has a native V4 implementation (V5+)
 */
export type TemporalProcessAdapterStatus =
  | "metadata_only"
  | "adapter_shell"
  | "delegated"
  | "native";

/**
 * How an adapter handles state mutation.
 *
 * - "none"             — this process never mutates state (trace/context)
 * - "delegates_to_v3"  — mutation delegated to existing V3 function
 * - "future"           — mutation planned but not yet implemented
 */
export type TemporalProcessMutationPolicy = "none" | "delegates_to_v3" | "future";

/**
 * An adapter that connects a TemporalProcess metadata entry to its
 * eventual implementation. In V4.2, all adapters are shells — they
 * describe the plan but do NOT execute any code.
 */
export interface TemporalProcessAdapter {
  /** Matches TemporalProcess.id */
  readonly processId: TemporalProcessId;
  /** Matches TemporalProcess.phase */
  readonly sourcePhase: number;
  /** The V3 function this adapter will eventually wrap, if any. */
  readonly wrapsExistingFunction?: string;
  /** How this adapter handles (or will handle) state mutation. */
  readonly mutationPolicy: TemporalProcessMutationPolicy;
  /** Current implementation status. */
  readonly implementationStatus: TemporalProcessAdapterStatus;
  /** Migration notes: why delegation is deferred, what needs to happen first. */
  readonly notes: string;
  /** Risks of migrating this particular process. */
  readonly risks: string[];
}
