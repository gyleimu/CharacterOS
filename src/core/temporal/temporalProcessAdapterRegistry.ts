/**
 * V4.2 TemporalProcessAdapterRegistry — adapter shell registry.
 *
 * Maps each V3 tick phase to an adapter that describes the future
 * migration path from the monolithic runContinuousTick to individual
 * TemporalProcess wrappers.
 *
 * In V4.2, ALL adapters are shells (implementationStatus = "adapter_shell"
 * or "metadata_only"). No adapter executes any code. No behavior changes.
 */

import type { TemporalProcessAdapter, TemporalProcessAdapterStatus } from "./temporalProcess";
import { V3_TICK_PHASES, v3TickPhaseIds } from "./v3TickPhaseMetadata";

/**
 * Summary of adapter coverage across all registered adapters.
 */
export interface AdapterCoverageSummary {
  /** Total number of V3 tick phases (always 17). */
  totalPhases: number;
  /** Number of adapters registered. */
  registeredAdapters: number;
  /** Count by implementation status. */
  byStatus: Record<TemporalProcessAdapterStatus, number>;
  /** All phase ids that have an adapter. */
  coveredPhaseIds: string[];
  /** Phase ids missing an adapter (should be empty). */
  missingPhaseIds: string[];
}

/**
 * Registry of TemporalProcessAdapter shells.
 *
 * Thread-safe for read operations. Registration order is preserved.
 */
export class TemporalProcessAdapterRegistry {
  private readonly adapters = new Map<string, TemporalProcessAdapter>();

  constructor(initial?: readonly TemporalProcessAdapter[]) {
    if (initial) {
      for (const adapter of initial) {
        this.register(adapter);
      }
    }
  }

  /** Register an adapter. Rejects duplicate processIds. */
  register(adapter: TemporalProcessAdapter): void {
    if (this.adapters.has(adapter.processId)) {
      throw new Error(
        `TemporalProcessAdapterRegistry: duplicate adapter for process "${adapter.processId}"`
      );
    }
    this.adapters.set(adapter.processId, Object.freeze({ ...adapter }));
  }

  /** Get an adapter by process id. */
  get(processId: string): TemporalProcessAdapter | undefined {
    return this.adapters.get(processId);
  }

  /** List all adapters in registration order. */
  list(): readonly TemporalProcessAdapter[] {
    return [...this.adapters.values()];
  }

  /** Number of registered adapters. */
  get size(): number {
    return this.adapters.size;
  }

  /**
   * Build a coverage summary: which V3 phases have adapters,
   * and what their implementation statuses are.
   */
  summarize(): AdapterCoverageSummary {
    const expectedIds = new Set(v3TickPhaseIds());
    const registeredIds = new Set(this.adapters.keys());
    const missingPhaseIds = [...expectedIds].filter((id) => !registeredIds.has(id));

    const byStatus: Record<TemporalProcessAdapterStatus, number> = {
      metadata_only: 0,
      adapter_shell: 0,
      delegated: 0,
      native: 0
    };
    for (const adapter of this.adapters.values()) {
      byStatus[adapter.implementationStatus] += 1;
    }

    return {
      totalPhases: V3_TICK_PHASES.length,
      registeredAdapters: this.adapters.size,
      byStatus,
      coveredPhaseIds: [...registeredIds].sort(
        (a, b) => (this.adapters.get(a)?.sourcePhase ?? 99) - (this.adapters.get(b)?.sourcePhase ?? 99)
      ),
      missingPhaseIds
    };
  }
}

// ─── 17 adapter shells ─────────────────────────────────────────────────

/**
 * All 17 V3 tick phase adapters.
 *
 * Every adapter is currently "adapter_shell" — it declares the future
 * delegation plan but does NOT wrap or call any V3 function.
 *
 * Mutation policies:
 *   "none"             — trace/context phases that never mutate state
 *   "delegates_to_v3"  — will wrap an existing V3 function in V4.3+
 *   "future"           — mutation path still being designed
 */
export const V3_TICK_PHASE_ADAPTERS: readonly TemporalProcessAdapter[] = Object.freeze([
  // ── Phase  1: snapshot ──────────────────────────────────────────────
  {
    processId: "snapshot",
    sourcePhase: 1,
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Snapshot is a pure trace artifact. It captures pre-tick baselines. No V3 function to wrap — it is an inline computation in runContinuousTick. Future: extract as a pure snapshot() function.",
    risks: []
  },

  // ── Phase  2: meta_drift ────────────────────────────────────────────
  {
    processId: "meta_drift",
    sourcePhase: 2,
    wrapsExistingFunction: "updateMetaStateForTick",
    mutationPolicy: "delegates_to_v3",
    implementationStatus: "delegated",
    notes:
      "Delegated to executeMetaDriftTemporalAdapter (V4.10). The adapter wraps updateMetaStateForTick and is called from runContinuousTick Phase 2. This is the third V4 execution-layer delegation.",
    risks: []
  },

  // ── Phase  3: decay_and_recovery ────────────────────────────────────
  {
    processId: "decay_and_recovery",
    sourcePhase: 3,
    wrapsExistingFunction: "decayMemory + recoverBoundary + recoverRewardBaseline + decayProceduralRoutine",
    mutationPolicy: "delegates_to_v3",
    implementationStatus: "adapter_shell",
    notes:
      "This is the largest mutation phase. It currently does four things inline: memory decay, procedural decay, reward recovery, boundary recovery. Future: split into sub-processes or keep as a composite adapter. Each sub-operation delegates to an existing V3 function.",
    risks: [
      "Composite phase — splitting into sub-processes changes ordering guarantees",
      "Boundary recovery and reward recovery can likely run in parallel",
      "Phase 4 (homeostasis) overwrites some of these values — ordering matters"
    ]
  },

  // ── Phase  4: homeostasis ───────────────────────────────────────────
  {
    processId: "homeostasis",
    sourcePhase: 4,
    wrapsExistingFunction: "applyHomeostasis",
    mutationPolicy: "delegates_to_v3",
    implementationStatus: "delegated",
    notes:
      "Delegated to executeHomeostasisTemporalAdapter (V4.12). The adapter wraps applyHomeostasis and is called from runContinuousTick Phase 4. This is the first multi-state overwrite delegation — it writes homeostasisState AND overwrites Phase 3 recovery outputs (metaState, boundary, rewardState) with regulated values. D10 applies.",
    risks: []
  },

  // ── Phase  5: recovery_trace ────────────────────────────────────────
  {
    processId: "recovery_trace",
    sourcePhase: 5,
    wrapsExistingFunction: "buildRecoveryTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildRecoveryTrace(daysElapsed, metaBefore, metaAfter, boundaryBefore, boundaryAfter, rewardBefore, rewardAfter, homeostasis). No state mutation.",
    risks: []
  },

  // ── Phase  6: parameter_network ─────────────────────────────────────
  {
    processId: "parameter_network",
    sourcePhase: 6,
    wrapsExistingFunction: "propagateParameterNetwork",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to propagateParameterNetwork(state). Currently reads meta, boundary, reward, fatigue, sleepDebt and produces coupling effects. No state mutation.",
    risks: [
      "Depends on post-homeostasis meta/boundary/reward values"
    ]
  },

  // ── Phase  7: baseline_drift ────────────────────────────────────────
  {
    processId: "baseline_drift",
    sourcePhase: 7,
    wrapsExistingFunction: "evaluateBaselineDrift",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to evaluateBaselineDrift(recovery, parameterNetwork, accumulatedDays, repetitionCount). No state mutation.",
    risks: []
  },

  // ── Phase  8: parameter_accumulation ────────────────────────────────
  {
    processId: "parameter_accumulation",
    sourcePhase: 8,
    wrapsExistingFunction: "buildParameterAccumulationTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildParameterAccumulationTrace(recovery, parameterNetwork, baselineDrift). No state mutation.",
    risks: []
  },

  // ── Phase  9: parameter_adjustment_draft ────────────────────────────
  {
    processId: "parameter_adjustment_draft",
    sourcePhase: 9,
    wrapsExistingFunction: "buildParameterAdjustmentDraftTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildParameterAdjustmentDraftTrace(baselineDrift, accumulation). No state mutation.",
    risks: []
  },

  // ── Phase 10: parameter_adjustment_preview ──────────────────────────
  {
    processId: "parameter_adjustment_preview",
    sourcePhase: 10,
    wrapsExistingFunction: "buildParameterAdjustmentPreviewTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildParameterAdjustmentPreviewTrace(state, drafts). Reads state but does not mutate.",
    risks: []
  },

  // ── Phase 11: parameter_adjustment_audit ────────────────────────────
  {
    processId: "parameter_adjustment_audit",
    sourcePhase: 11,
    wrapsExistingFunction: "auditParameterAdjustmentPreview",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to auditParameterAdjustmentPreview(preview). No state mutation.",
    risks: []
  },

  // ── Phase 12: parameter_adjustment_patch ────────────────────────────
  {
    processId: "parameter_adjustment_patch",
    sourcePhase: 12,
    wrapsExistingFunction: "buildParameterAdjustmentPatchTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildParameterAdjustmentPatchTrace(preview, audit). No state mutation.",
    risks: []
  },

  // ── Phase 13: parameter_adjustment_snapshot ─────────────────────────
  {
    processId: "parameter_adjustment_snapshot",
    sourcePhase: 13,
    wrapsExistingFunction: "buildParameterAdjustmentSnapshotTrace",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure trace builder. Will delegate to buildParameterAdjustmentSnapshotTrace(state, patch). Reads state but does not mutate.",
    risks: []
  },

  // ── Phase 14: boredom ───────────────────────────────────────────────
  {
    processId: "boredom",
    sourcePhase: 14,
    wrapsExistingFunction: "updateBoredomForTick",
    mutationPolicy: "delegates_to_v3",
    implementationStatus: "delegated",
    notes:
      "Delegated to executeBoredomTemporalAdapter (V4.7). The adapter wraps updateBoredomForTick and is called from runContinuousTick Phase 14. This is the first V4 execution-layer delegation.",
    risks: []
  },

  // ── Phase 15: belief_evolution ──────────────────────────────────────
  {
    processId: "belief_evolution",
    sourcePhase: 15,
    wrapsExistingFunction: "evolveBeliefsForTick",
    mutationPolicy: "delegates_to_v3",
    implementationStatus: "delegated",
    notes:
      "Delegated to executeBeliefEvolutionTemporalAdapter (V4.8). The adapter wraps evolveBeliefsForTick and is called from runContinuousTick Phase 15. This is the second V4 execution-layer delegation.",
    risks: []
  },

  // ── Phase 16: attention_and_reflection ──────────────────────────────
  {
    processId: "attention_and_reflection",
    sourcePhase: 16,
    wrapsExistingFunction: "buildAttentionProfile + deepThinkingReasons",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure diagnostic. Builds post-tick attention profile and checks deep-thinking threshold. No state mutation. Future: extract deepThinkingReasons as a standalone function.",
    risks: []
  },

  // ── Phase 17: time_perception ───────────────────────────────────────
  {
    processId: "time_perception",
    sourcePhase: 17,
    wrapsExistingFunction: "perceiveContinuousTime",
    mutationPolicy: "none",
    implementationStatus: "adapter_shell",
    notes:
      "Pure context provider. Will delegate to perceiveContinuousTime(daysElapsed, meta, boundary, reward). Computes subjective time experience. In V4, this should become a shared TickContext rather than a separate process.",
    risks: [
      "Time perception should eventually feed back into all decay/recovery rates — cross-cutting concern"
    ]
  }
]);
