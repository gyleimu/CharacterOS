/**
 * V5.1 SubProcess Trace Types — type system for decay_and_recovery
 * composite phase decomposition.
 *
 * These types describe the 4 subprocesses inside Phase 3
 * (decay_and_recovery). They are NOT yet wired into runContinuousTick.
 * V5.2-V5.5 will instrument each subprocess to produce these traces.
 *
 * DESIGN ONLY — V5.1 does not change any V3 behavior.
 */

// ─── Common types ─────────────────────────────────────────────────────

/** Kind discriminator for subprocess traces. */
export type TemporalSubProcessKind =
  | "memory_decay"
  | "procedural_decay"
  | "boundary_recovery"
  | "reward_recovery";

/** Base interface shared by all subprocess traces. */
export interface TemporalSubProcessTrace {
  /** Unique id within the parent phase (e.g. "decay_and_recovery.memory_decay"). */
  readonly id: string;
  /** Discriminator. */
  readonly kind: TemporalSubProcessKind;
  /** Human-readable label. */
  readonly label: string;
  /** State fields this subprocess reads. */
  readonly reads: string[];
  /** State fields this subprocess writes. */
  readonly writes: string[];
  /** Names of state fields actually changed by this subprocess. */
  readonly changedStates: string[];
  /** Human-readable reasons. */
  readonly reasons: string[];
  /** Kind-specific metrics. */
  readonly metrics: Record<string, number>;
}

// ─── Specialized traces ───────────────────────────────────────────────

export interface MemoryDecaySubProcessTrace extends TemporalSubProcessTrace {
  kind: "memory_decay";
  metrics: {
    /** Number of memories decayed. */
    memoryCount: number;
    /** Average recency before decay. */
    averageRecencyBefore: number;
    /** Average recency after decay. */
    averageRecencyAfter: number;
    /** Average effective weight before decay. */
    averageEffectiveWeightBefore: number;
    /** Average effective weight after decay. */
    averageEffectiveWeightAfter: number;
  };
}

export interface ProceduralDecaySubProcessTrace extends TemporalSubProcessTrace {
  kind: "procedural_decay";
  metrics: {
    /** Number of procedural routines decayed. */
    routineCount: number;
    /** Average strength before decay. */
    averageStrengthBefore: number;
    /** Average strength after decay. */
    averageStrengthAfter: number;
  };
}

export interface BoundaryRecoverySubProcessTrace extends TemporalSubProcessTrace {
  kind: "boundary_recovery";
  metrics: {
    /** Stress load before recovery. */
    stressLoadBefore: number;
    /** Stress load after recovery. */
    stressLoadAfter: number;
    /** Integrity before recovery. */
    integrityBefore: number;
    /** Integrity after recovery. */
    integrityAfter: number;
    /** Cracks before recovery. */
    cracksBefore: number;
    /** Cracks after recovery. */
    cracksAfter: number;
  };
}

export interface RewardRecoverySubProcessTrace extends TemporalSubProcessTrace {
  kind: "reward_recovery";
  metrics: {
    /** Dopamine level before recovery. */
    dopamineBefore: number;
    /** Dopamine level after recovery. */
    dopamineAfter: number;
    /** Dopamine threshold before recovery. */
    thresholdBefore: number;
    /** Dopamine threshold after recovery. */
    thresholdAfter: number;
    /** Craving before recovery. */
    cravingBefore: number;
    /** Craving after recovery. */
    cravingAfter: number;
  };
}

/** Union of all subprocess trace types. */
export type AnySubProcessTrace =
  | MemoryDecaySubProcessTrace
  | ProceduralDecaySubProcessTrace
  | BoundaryRecoverySubProcessTrace
  | RewardRecoverySubProcessTrace;

// ─── Summary ───────────────────────────────────────────────────────────

export interface SubProcessTraceSummary {
  /** Total number of subprocess traces. */
  totalSubProcesses: number;
  /** Distinct kinds present. */
  kinds: TemporalSubProcessKind[];
  /** Union of all changedStates across subprocesses. */
  changedStateNames: string[];
  /** Non-fatal warnings (e.g., empty traces, missing metrics). */
  warnings: string[];
  /** Aggregated reasons from all subprocesses. */
  reasons: string[];
}

/**
 * Summarize a list of subprocess traces.
 *
 * Pure function — does not read or write CharacterPhysicsState.
 * Does not mutate the input array.
 */
export function summarizeSubProcessTraces(
  traces: readonly AnySubProcessTrace[]
): SubProcessTraceSummary {
  const warnings: string[] = [];

  if (!traces.length) {
    warnings.push("no subprocess traces provided — summary is empty");
    return {
      totalSubProcesses: 0,
      kinds: [],
      changedStateNames: [],
      warnings,
      reasons: []
    };
  }

  const kindSet = new Set<TemporalSubProcessKind>();
  const stateSet = new Set<string>();
  const allReasons: string[] = [];

  for (const trace of traces) {
    kindSet.add(trace.kind);
    for (const state of trace.changedStates) {
      stateSet.add(state);
    }
    for (const reason of trace.reasons) {
      allReasons.push(reason);
    }
  }

  // Warn if metrics are missing expected keys (non-exhaustive check)
  for (const trace of traces) {
    if (!trace.metrics || Object.keys(trace.metrics).length === 0) {
      warnings.push(`subprocess "${trace.id}" has no metrics`);
    }
  }

  return {
    totalSubProcesses: traces.length,
    kinds: [...kindSet].sort(),
    changedStateNames: [...stateSet].sort(),
    warnings,
    reasons: allReasons
  };
}
