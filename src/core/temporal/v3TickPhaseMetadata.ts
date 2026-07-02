/**
 * V3 Tick Phase Metadata — declarative descriptions of the 17 phases
 * executed by runContinuousTick, in exact execution order.
 *
 * This file does NOT execute any tick logic.
 * It is a read-only metadata registry for V4 tooling.
 *
 * Phase order MUST match the actual execution order in:
 *   src/core/time/continuousTick.ts :: runContinuousTick()
 */

import type { TemporalProcess } from "./temporalProcess";

export const V3_TICK_PHASES: readonly TemporalProcess[] = Object.freeze([
  // ── Phase  1 ───────────────────────────────────────────────────────
  {
    id: "snapshot",
    label: "Pre-tick Snapshot",
    phase: 1,
    category: "trace",
    reads: ["memories", "proceduralRoutines", "boundary", "rewardState", "metaState"],
    writes: [],
    description:
      "Captures pre-tick baselines (memory recency/weight, procedural strength, boundary, reward, attention profile) before any mutation."
  },

  // ── Phase  2 ───────────────────────────────────────────────────────
  {
    id: "meta_drift",
    label: "Meta State Drift",
    phase: 2,
    category: "mutation",
    reads: ["metaState", "boundary"],
    writes: ["metaState"],
    description:
      "Slow drift of meta parameters (emotionalSensitivity, resilience, selfControl, etc.) driven by elapsed time, stress load, and boundary integrity."
  },

  // ── Phase  3 ───────────────────────────────────────────────────────
  {
    id: "decay_and_recovery",
    label: "Decay and Recovery",
    phase: 3,
    category: "mutation",
    reads: ["memories", "proceduralRoutines", "rewardState", "boundary", "metaState"],
    writes: ["memories", "proceduralRoutines", "rewardState", "boundary", "metaState"],
    description:
      "Time-based decay of memory recency/weight and procedural routine strength, plus baseline recovery of reward state, psychological boundary, and meta state."
  },

  // ── Phase  4 ───────────────────────────────────────────────────────
  {
    id: "homeostasis",
    label: "Homeostatic Regulation",
    phase: 4,
    category: "mutation",
    reads: ["homeostasisState", "metaState", "boundary", "rewardState"],
    writes: ["homeostasisState", "metaState", "boundary", "rewardState"],
    description:
      "Homeostatic pull of meta, boundary, and reward toward their set points while preserving inertia and scars. Regulated values overwrite the decay-and-recovery outputs."
  },

  // ── Phase  5 ───────────────────────────────────────────────────────
  {
    id: "recovery_trace",
    label: "Recovery Trace",
    phase: 5,
    category: "trace",
    reads: ["metaState", "boundary", "rewardState", "homeostasis"],
    writes: [],
    description:
      "Builds a recovery trace from before/after deltas of meta, boundary, and reward, recording how far each drifted and how much recovered."
  },

  // ── Phase  6 ───────────────────────────────────────────────────────
  {
    id: "parameter_network",
    label: "Parameter Network Propagation",
    phase: 6,
    category: "trace",
    reads: ["metaState", "boundary", "rewardState"],
    writes: [],
    description:
      "Propagates parameter interdependencies through the parameter network, computing coupling effects between fatigue, sleep debt, meta, boundary, and reward."
  },

  // ── Phase  7 ───────────────────────────────────────────────────────
  {
    id: "baseline_drift",
    label: "Baseline Drift Evaluation",
    phase: 7,
    category: "trace",
    reads: ["recovery", "parameterNetwork", "memories"],
    writes: [],
    description:
      "Evaluates whether character baselines should shift based on accumulated recovery evidence, parameter network coupling, and repetition count."
  },

  // ── Phase  8 ───────────────────────────────────────────────────────
  {
    id: "parameter_accumulation",
    label: "Parameter Accumulation",
    phase: 8,
    category: "trace",
    reads: ["recovery", "parameterNetwork", "baselineDrift"],
    writes: [],
    description:
      "Accumulates factors from recovery, parameter network, and baseline drift toward parameter adjustment thresholds."
  },

  // ── Phase  9 ───────────────────────────────────────────────────────
  {
    id: "parameter_adjustment_draft",
    label: "Parameter Adjustment Draft",
    phase: 9,
    category: "trace",
    reads: ["baselineDrift", "parameterAccumulation"],
    writes: [],
    description:
      "Drafts potential parameter changes based on baseline drift direction and accumulated factors."
  },

  // ── Phase 10 ───────────────────────────────────────────────────────
  {
    id: "parameter_adjustment_preview",
    label: "Parameter Adjustment Preview",
    phase: 10,
    category: "trace",
    reads: ["state", "parameterAdjustmentDraft"],
    writes: [],
    description:
      "Previews what applying the drafted adjustments would do to the current character state."
  },

  // ── Phase 11 ───────────────────────────────────────────────────────
  {
    id: "parameter_adjustment_audit",
    label: "Parameter Adjustment Audit",
    phase: 11,
    category: "trace",
    reads: ["parameterAdjustmentPreview"],
    writes: [],
    description:
      "Audits the adjustment preview for safety and governance compliance before allowing application."
  },

  // ── Phase 12 ───────────────────────────────────────────────────────
  {
    id: "parameter_adjustment_patch",
    label: "Parameter Adjustment Patch",
    phase: 12,
    category: "trace",
    reads: ["parameterAdjustmentPreview", "parameterAdjustmentAudit"],
    writes: [],
    description:
      "Builds a parameter adjustment patch from the audited preview, encoding which operations to apply."
  },

  // ── Phase 13 ───────────────────────────────────────────────────────
  {
    id: "parameter_adjustment_snapshot",
    label: "Parameter Adjustment Snapshot",
    phase: 13,
    category: "trace",
    reads: ["state", "parameterAdjustmentPatch"],
    writes: [],
    description:
      "Snapshots character state before and after the potential patch application for rollback support."
  },

  // ── Phase 14 ───────────────────────────────────────────────────────
  {
    id: "boredom",
    label: "Boredom / Inspiration Update",
    phase: 14,
    category: "mutation",
    reads: ["boredomState", "metaState", "rewardState", "boundary"],
    writes: ["boredomState"],
    description:
      "Updates boredom level, stimulation need, daydreaming tendency, creative pressure, and inspiration probability based on low stimulation and reward gaps."
  },

  // ── Phase 15 ───────────────────────────────────────────────────────
  {
    id: "belief_evolution",
    label: "Belief Evolution",
    phase: 15,
    category: "mutation",
    reads: ["beliefStates", "memories", "metaState"],
    writes: ["beliefStates"],
    description:
      "Evolves belief strengths toward current memory evidence, modulated by meta plasticity and elapsed time."
  },

  // ── Phase 16 ───────────────────────────────────────────────────────
  {
    id: "attention_and_reflection",
    label: "Attention and Deep Thinking Check",
    phase: 16,
    category: "trace",
    reads: ["metaState", "boundary"],
    writes: [],
    description:
      "Builds post-tick attention profile and checks whether boundary stress, overflow, or cracks exceed the deep-thinking threshold."
  },

  // ── Phase 17 ───────────────────────────────────────────────────────
  {
    id: "time_perception",
    label: "Subjective Time Perception",
    phase: 17,
    category: "context",
    reads: ["metaState", "boundary", "rewardState"],
    writes: [],
    description:
      "Computes subjective time experience for this tick — how the elapsed days feel to the character based on their internal state."
  }
]);

/** Total number of V3 tick phases. */
export const V3_TICK_PHASE_COUNT = V3_TICK_PHASES.length as 17;

/** Lookup a phase by its id. */
export function getV3TickPhase(id: string): TemporalProcess | undefined {
  return V3_TICK_PHASES.find((phase) => phase.id === id);
}

/** All phase ids in execution order. */
export function v3TickPhaseIds(): string[] {
  return V3_TICK_PHASES.map((phase) => phase.id);
}
