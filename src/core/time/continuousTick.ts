import { buildAttentionProfile, type AttentionProfile } from "../attention/attentionSystem";
import { evolveBeliefsForTick, type BeliefEvolutionTrace } from "../belief/beliefEvolution";
import { updateBoredomForTick, type BoredomTickTrace } from "../boredom/boredomSystem";
import { recoverBoundary, type PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { MemoryNode } from "../memory/memoryNode";
import { decayMemory, effectiveMemoryWeight } from "../memory/decay";
import {
  deepThinkingThresholdFromMeta,
  memoryDecayRateFromMeta,
  updateMetaStateForTick,
  type MetaStateTickResult
} from "../meta/metaState";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { decayProceduralRoutine } from "../procedural/proceduralMemory";
import { recoverRewardBaseline, type RewardState } from "../reward/rewardSystem";
import { applyHomeostasis, type HomeostasisTrace } from "../homeostasis/homeostasis";
import { average, clamp, clamp01 } from "../parameters/parameterMath";
import {
  parameterNetworkStateFromCharacter,
  propagateParameterNetwork,
  type ParameterNetworkTrace
} from "../parameters/parameterNetwork";
import {
  buildParameterAccumulationTrace,
  type ParameterAccumulationTrace
} from "../parameters/parameterAccumulation";
import {
  buildParameterAdjustmentDraftTrace,
  type ParameterAdjustmentDraftTrace
} from "../parameters/parameterAdjustmentDraft";
import {
  buildParameterAdjustmentPreviewTrace,
  type ParameterAdjustmentPreviewTrace
} from "../parameters/parameterAdjustmentPreview";
import {
  auditParameterAdjustmentPreview,
  type ParameterAdjustmentAuditTrace
} from "../parameters/parameterAdjustmentAudit";
import {
  buildParameterAdjustmentPatchTrace,
  type ParameterAdjustmentPatchTrace
} from "../parameters/parameterAdjustmentPatch";
import {
  buildParameterAdjustmentSnapshotTrace,
  type ParameterAdjustmentSnapshotTrace
} from "../parameters/parameterAdjustmentSnapshot";
import { evaluateBaselineDrift, type BaselineDriftTrace } from "../parameters/baselineDrift";
import { buildRecoveryTrace, type RecoveryTrace } from "../recovery/recoveryTrace";
import { perceiveContinuousTime, type TimePerceptionTrace } from "./timePerception";
import { executeBoredomTemporalAdapter } from "../temporal/adapters/boredomTemporalAdapter";
import { executeBeliefEvolutionTemporalAdapter } from "../temporal/adapters/beliefEvolutionTemporalAdapter";
import { executeMetaDriftTemporalAdapter } from "../temporal/adapters/metaDriftTemporalAdapter";
import { executeHomeostasisTemporalAdapter } from "../temporal/adapters/homeostasisTemporalAdapter";
import { buildMemoryDecaySubProcessTrace } from "../temporal/subprocesses/memoryDecaySubProcess";
import { buildProceduralDecaySubProcessTrace } from "../temporal/subprocesses/proceduralDecaySubProcess";
import { buildBoundaryRecoverySubProcessTrace } from "../temporal/subprocesses/boundaryRecoverySubProcess";
import { buildRewardRecoverySubProcessTrace } from "../temporal/subprocesses/rewardRecoverySubProcess";
import type { TemporalSubProcessTrace } from "../temporal/subProcessTrace";
import { advanceTemporalStateByDays } from "./eventTemporalSemantics";

export interface ContinuousTickOptions {
  daysElapsed?: number;
  memoryDecayRate?: number;
  deepThinkingThreshold?: number;
  fatigue?: number;
  sleepDebt?: number;
}

export type ContinuousTickPhaseName =
  | "snapshot"
  | "meta_drift"
  | "decay_and_recovery"
  | "homeostasis"
  | "recovery_trace"
  | "baseline_drift"
  | "parameter_accumulation"
  | "parameter_adjustment_draft"
  | "parameter_adjustment_preview"
  | "parameter_adjustment_audit"
  | "parameter_adjustment_patch"
  | "parameter_adjustment_snapshot"
  | "boredom"
  | "belief_evolution"
  | "parameter_network"
  | "attention_and_reflection"
  | "time_perception";

export interface ContinuousTickPhaseTrace {
  name: ContinuousTickPhaseName;
  changedStates: string[];
  reasons: string[];
  /** V5.2+: Optional subprocess traces (instrumentation only, additive). */
  subProcesses?: TemporalSubProcessTrace[];
}

export interface ContinuousTickTrace {
  daysElapsed: number;
  phases: ContinuousTickPhaseTrace[];
  memoryCount: number;
  proceduralRoutineCount: number;
  averageMemoryRecencyBefore: number;
  averageMemoryRecencyAfter: number;
  averageMemoryWeightBefore: number;
  averageMemoryWeightAfter: number;
  averageProceduralStrengthBefore: number;
  averageProceduralStrengthAfter: number;
  rewardBefore: RewardState;
  rewardAfter: RewardState;
  homeostasis: HomeostasisTrace;
  recovery: RecoveryTrace;
  parameterNetwork: ParameterNetworkTrace;
  baselineDrift: BaselineDriftTrace;
  parameterAccumulation: ParameterAccumulationTrace;
  parameterAdjustmentDraft: ParameterAdjustmentDraftTrace;
  parameterAdjustmentPreview: ParameterAdjustmentPreviewTrace;
  parameterAdjustmentAudit: ParameterAdjustmentAuditTrace;
  parameterAdjustmentPatch: ParameterAdjustmentPatchTrace;
  parameterAdjustmentSnapshot: ParameterAdjustmentSnapshotTrace;
  boredom: BoredomTickTrace;
  beliefEvolution: BeliefEvolutionTrace;
  timePerception: TimePerceptionTrace;
  boundaryBefore: PsychologicalBoundary;
  boundaryAfter: PsychologicalBoundary;
  metaState: MetaStateTickResult;
  attentionProfileBefore: AttentionProfile;
  attentionProfileAfter: AttentionProfile;
  effectiveMemoryDecayRate: number;
  effectiveDeepThinkingThreshold: number;
  deepThinkingRecommended: boolean;
  reasons: string[];
  temporalClockBefore: string | null;
  temporalClockAfter: string | null;
}

// =========================================================================
// runContinuousTick — Phase Structure Overview
// =========================================================================
// The tick models "a character living through N days without external events."
// It is organized as a pipeline of 17 ordered phases. Each phase reads from
// the current state, computes derived artifacts, and may mutate the state.
// Phases are sequential because later phases depend on earlier mutations.
//
//   Phase  1  snapshot                   — freeze pre-tick baselines
//   Phase  2  meta_drift                 — slow meta-parameter drift
//   Phase  3  decay_and_recovery         — memory/procedural decay + boundary/reward recovery
//   Phase  4  homeostasis                — homeostatic regulation across meta/boundary/reward
//   Phase  5  recovery_trace             — build recovery trace from before/after deltas
//   Phase  6  parameter_network          — propagate parameter interdependencies
//   Phase  7  baseline_drift             — evaluate whether baselines should shift
//   Phase  8  parameter_accumulation     — accumulate factors toward adjustment thresholds
//   Phase  9  parameter_adjustment_draft — draft potential parameter changes
//   Phase 10  parameter_adjustment_preview — preview what applying drafts would do
//   Phase 11  parameter_adjustment_audit   — audit preview for safety/governance
//   Phase 12  parameter_adjustment_patch   — build the patch from audited preview
//   Phase 13  parameter_adjustment_snapshot — snapshot state before/after potential patch
//   Phase 14  boredom                     — update boredom/inspiration dynamics
//   Phase 15  belief_evolution            — evolve belief strengths toward memory evidence
//   Phase 16  attention_and_reflection    — build post-tick attention profile + deep-thinking check
//   Phase 17  time_perception             — compute subjective time experience for the tick
//
// IMPORTANT: This function mutates `state` in place. Phases 3-4 and 14-15
// directly write modified fields back to the state object. Phases 5-13 are
// mostly trace-building (read-only on state, read+write on their own
// artifact types). If splitting, extract Phase 5-13 trace builders as pure
// functions first — they don't need the live state reference.
// =========================================================================

export function runContinuousTick(
  state: CharacterPhysicsState,
  options: ContinuousTickOptions = {}
): ContinuousTickTrace {
  // ═══════════════════════════════════════════════════════════════════
  // Phase 1: snapshot — capture pre-tick baselines before any mutation.
  // ═══════════════════════════════════════════════════════════════════
  const normalizedOptions = normalizeContinuousTickOptions(options);
  const temporalClockBefore = state.temporal.lastProcessedAt;
  const daysElapsed = normalizedOptions.daysElapsed;
  const baseMemoryDecayRate = normalizedOptions.memoryDecayRate;
  const baseDeepThinkingThreshold = normalizedOptions.deepThinkingThreshold;
  const memoryDecayRate = memoryDecayRateFromMeta(state.metaState, baseMemoryDecayRate);
  const deepThinkingThreshold = deepThinkingThresholdFromMeta(state.metaState, baseDeepThinkingThreshold);
  const memoriesBefore = state.memories;
  const proceduralRoutinesBefore = state.proceduralRoutines;
  const boundaryBefore = { ...state.boundary };
  const rewardBefore = { ...state.rewardState };
  const phases: ContinuousTickPhaseTrace[] = [
    {
      name: "snapshot",
      changedStates: [],
      reasons: ["Captured pre-tick state before any continuous living updates."]
    }
  ];
  const attentionProfileBefore = buildAttentionProfile({
    meta: state.metaState,
    boundary: state.boundary
  });
  const averageMemoryRecencyBefore = average(memoriesBefore.map((memory) => memory.recency));
  const averageMemoryWeightBefore = average(memoriesBefore.map(effectiveMemoryWeight));
  const averageProceduralStrengthBefore = average(
    proceduralRoutinesBefore.map((routine) => routine.strength)
  );

  // ═══════════════════════════════════════════════════════════════════
  // Phase 2: meta_drift — delegated to V4.10 metaDriftTemporalAdapter.
  // ═══════════════════════════════════════════════════════════════════
  const metaDriftResult = executeMetaDriftTemporalAdapter({
    meta: state.metaState,
    daysElapsed,
    stressLoad: boundaryBefore.stressLoad,
    boundaryIntegrity: boundaryBefore.integrity
  });
  phases.push(metaDriftResult.phase);
  // ═══════════════════════════════════════════════════════════════════
  // Phase 3: decay_and_recovery — time-based decay of memories and
  // procedural routines, plus baseline recovery of boundary and reward.
  // These are the "physics" mutations of the tick — direct state writes.
  // ═══════════════════════════════════════════════════════════════════
  state.memories = memoriesBefore.map((memory) => decayMemory(memory, daysElapsed, memoryDecayRate));
  state.proceduralRoutines = proceduralRoutinesBefore.map((routine) => decayProceduralRoutine(routine, daysElapsed));
  state.rewardState = recoverRewardBaseline(state.rewardState, daysElapsed);
  state.boundary = recoverBoundary(state.boundary, daysElapsed);
  state.metaState = metaDriftResult.trace.after;
  // V5.2-V5.4: Build subprocess traces (instrumentation only — no behavior change)
  const memoryDecaySubProcess = buildMemoryDecaySubProcessTrace({
    memoriesBefore,
    memoriesAfter: state.memories
  });
  const proceduralDecaySubProcess = buildProceduralDecaySubProcessTrace({
    routinesBefore: proceduralRoutinesBefore,
    routinesAfter: state.proceduralRoutines
  });
  // D10: Capture Phase 3 intermediate boundary BEFORE Phase 4 homeostasis overwrites it.
  // state.boundary at this point is the recoverBoundary() result — not the final tick boundary.
  const boundaryRecoverySubProcess = buildBoundaryRecoverySubProcessTrace({
    boundaryBefore,
    boundaryAfter: state.boundary
  });
  // D10: Capture Phase 3 intermediate rewardState BEFORE Phase 4 homeostasis overwrites it.
  // state.rewardState at this point is the recoverRewardBaseline() result — not the final tick reward state.
  const rewardRecoverySubProcess = buildRewardRecoverySubProcessTrace({
    rewardBefore,
    rewardAfter: state.rewardState
  });
  phases.push({
    name: "decay_and_recovery",
    changedStates: ["memories", "proceduralRoutines", "rewardState", "boundary"],
    reasons: [
      "Memory recency and effective weight decay with elapsed time.",
      "Procedural routines lose strength when unused.",
      "Reward state and psychological boundary recover toward baseline."
    ],
    subProcesses: [memoryDecaySubProcess, proceduralDecaySubProcess, boundaryRecoverySubProcess, rewardRecoverySubProcess]
  });
  // ═══════════════════════════════════════════════════════════════════
  // Phase 4: homeostasis — delegated to V4.12 homeostasisTemporalAdapter.
  // ═══════════════════════════════════════════════════════════════════
  const homeostasisResult = executeHomeostasisTemporalAdapter({
    homeostasis: state.homeostasisState,
    meta: state.metaState,
    boundary: state.boundary,
    reward: state.rewardState,
    daysElapsed
  });
  state.homeostasisState = homeostasisResult.trace.after;
  state.metaState = homeostasisResult.trace.regulatedMetaState;
  state.boundary = homeostasisResult.trace.regulatedBoundary;
  state.rewardState = homeostasisResult.trace.regulatedRewardState;
  phases.push(homeostasisResult.phase);
  // ═══════════════════════════════════════════════════════════════════
  // Phases 5-13: parameter adjustment pipeline (read-only trace builders).
  // These phases do NOT directly mutate state fields — they build derived
  // artifacts (traces, drafts, previews, patches, snapshots) that can later
  // be applied manually. This block is a good candidate for extraction into
  // a pure function: buildParameterAdjustmentPipeline(state, traces).
  // ═══════════════════════════════════════════════════════════════════

  // Phase 5: recovery_trace
  const recovery = buildRecoveryTrace({
    daysElapsed,
    metaBefore: metaDriftResult.trace.before,
    metaAfter: state.metaState,
    boundaryBefore,
    boundaryAfter: state.boundary,
    rewardBefore,
    rewardAfter: state.rewardState,
    homeostasis: homeostasisResult.trace
  });
  phases.push({
    name: "recovery_trace",
    changedStates: ["recovery"],
    reasons: recovery.reasons
  });
  // Phase 6: parameter_network
  const parameterNetwork = propagateParameterNetwork({
    state: parameterNetworkStateFromCharacter({
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState,
      ...(normalizedOptions.fatigue !== undefined ? { fatigue: normalizedOptions.fatigue } : {}),
      ...(normalizedOptions.sleepDebt !== undefined ? { sleepDebt: normalizedOptions.sleepDebt } : {})
    })
  });
  phases.push({
    name: "parameter_network",
    changedStates: ["parameterNetwork"],
    reasons: parameterNetwork.reasons
  });
  // Phase 7: baseline_drift
  const baselineDrift = evaluateBaselineDrift({
    recovery,
    parameterNetwork,
    accumulatedDays: daysElapsed,
    repetitionCount: state.memories.length
  });
  phases.push({
    name: "baseline_drift",
    changedStates: ["baselineDrift"],
    reasons: baselineDrift.reasons
  });
  const parameterAccumulation = buildParameterAccumulationTrace({
    recovery,
    parameterNetwork,
    baselineDrift
  });
  phases.push({
    name: "parameter_accumulation",
    changedStates: ["parameterAccumulation"],
    reasons: parameterAccumulation.reasons
  });
  const parameterAdjustmentDraft = buildParameterAdjustmentDraftTrace({
    baselineDrift,
    accumulation: parameterAccumulation
  });
  phases.push({
    name: "parameter_adjustment_draft",
    changedStates: ["parameterAdjustmentDraft"],
    reasons: parameterAdjustmentDraft.reasons
  });
  const parameterAdjustmentPreview = buildParameterAdjustmentPreviewTrace({
    state,
    drafts: parameterAdjustmentDraft
  });
  phases.push({
    name: "parameter_adjustment_preview",
    changedStates: ["parameterAdjustmentPreview"],
    reasons: parameterAdjustmentPreview.reasons
  });
  const parameterAdjustmentAudit = auditParameterAdjustmentPreview({
    preview: parameterAdjustmentPreview
  });
  phases.push({
    name: "parameter_adjustment_audit",
    changedStates: ["parameterAdjustmentAudit"],
    reasons: parameterAdjustmentAudit.reasons
  });
  const parameterAdjustmentPatch = buildParameterAdjustmentPatchTrace({
    preview: parameterAdjustmentPreview,
    audit: parameterAdjustmentAudit
  });
  phases.push({
    name: "parameter_adjustment_patch",
    changedStates: ["parameterAdjustmentPatch"],
    reasons: parameterAdjustmentPatch.reasons
  });
  const parameterAdjustmentSnapshot = buildParameterAdjustmentSnapshotTrace({
    state,
    patch: parameterAdjustmentPatch
  });
  phases.push({
    name: "parameter_adjustment_snapshot",
    changedStates: ["parameterAdjustmentSnapshot"],
    reasons: parameterAdjustmentSnapshot.reasons
  });
  // ═══════════════════════════════════════════════════════════════════
  // Phase 14: boredom — delegated to V4.7 boredomTemporalAdapter.
  // ═══════════════════════════════════════════════════════════════════
  const boredomResult = executeBoredomTemporalAdapter({
    boredom: state.boredomState,
    meta: state.metaState,
    reward: state.rewardState,
    boundary: state.boundary,
    daysElapsed
  });
  state.boredomState = boredomResult.trace.after;
  phases.push(boredomResult.phase);
  // ═══════════════════════════════════════════════════════════════════
  // Phase 15: belief_evolution — delegated to V4.8 beliefEvolutionTemporalAdapter.
  // ═══════════════════════════════════════════════════════════════════
  const beliefEvolutionResult = executeBeliefEvolutionTemporalAdapter({
    beliefs: state.beliefStates,
    memories: state.memories,
    meta: state.metaState,
    daysElapsed
  });
  state.beliefStates = beliefEvolutionResult.trace.after;
  phases.push(beliefEvolutionResult.phase);
  const attentionProfileAfter = buildAttentionProfile({
    meta: state.metaState,
    boundary: state.boundary
  });

  const averageMemoryRecencyAfter = average(state.memories.map((memory) => memory.recency));
  const averageMemoryWeightAfter = average(state.memories.map(effectiveMemoryWeight));
  const averageProceduralStrengthAfter = average(
    state.proceduralRoutines.map((routine) => routine.strength)
  );
  // ═══════════════════════════════════════════════════════════════════
  // Phase 16: attention_and_reflection — post-tick attention + deep-thinking check.
  // ═══════════════════════════════════════════════════════════════════
  const reasons = deepThinkingReasons(state, deepThinkingThreshold);
  phases.push({
    name: "attention_and_reflection",
    changedStates: ["attentionProfile", "deepThinkingRecommended"],
    reasons: reasons.length ? reasons : ["No reflection threshold crossed."]
  });
  // ═══════════════════════════════════════════════════════════════════
  // Phase 17: time_perception — subjective time experience for this tick.
  // ═══════════════════════════════════════════════════════════════════
  const timePerception = perceiveContinuousTime({
    daysElapsed,
    meta: state.metaState,
    boundary: state.boundary,
    reward: state.rewardState
  });
  phases.push({
    name: "time_perception",
    changedStates: ["timePerception"],
    reasons: timePerception.reasons
  });

  state.temporal = advanceTemporalStateByDays(state.temporal, daysElapsed);

  return {
    daysElapsed,
    phases,
    memoryCount: state.memories.length,
    proceduralRoutineCount: state.proceduralRoutines.length,
    averageMemoryRecencyBefore,
    averageMemoryRecencyAfter,
    averageMemoryWeightBefore,
    averageMemoryWeightAfter,
    averageProceduralStrengthBefore,
    averageProceduralStrengthAfter,
    rewardBefore,
    rewardAfter: state.rewardState,
    homeostasis: homeostasisResult.trace,
    recovery,
    parameterNetwork,
    baselineDrift,
    parameterAccumulation,
    parameterAdjustmentDraft,
    parameterAdjustmentPreview,
    parameterAdjustmentAudit,
    parameterAdjustmentPatch,
    parameterAdjustmentSnapshot,
    boredom: boredomResult.trace,
    beliefEvolution: beliefEvolutionResult.trace,
    timePerception,
    boundaryBefore,
    boundaryAfter: state.boundary,
    metaState: metaDriftResult.trace,
    attentionProfileBefore,
    attentionProfileAfter,
    effectiveMemoryDecayRate: memoryDecayRate,
    effectiveDeepThinkingThreshold: deepThinkingThreshold,
    deepThinkingRecommended: reasons.length > 0,
    reasons,
    temporalClockBefore,
    temporalClockAfter: state.temporal.lastProcessedAt,
  };
}

function normalizeContinuousTickOptions(options: ContinuousTickOptions): Required<
  Pick<ContinuousTickOptions, "daysElapsed" | "memoryDecayRate" | "deepThinkingThreshold">
> & Pick<ContinuousTickOptions, "fatigue" | "sleepDebt"> {
  return {
    daysElapsed: clamp(options.daysElapsed ?? 1, 0, 3650),
    memoryDecayRate: clamp(options.memoryDecayRate ?? 0.02, 0, 0.2),
    deepThinkingThreshold: clamp01(options.deepThinkingThreshold ?? 0.72),
    ...(options.fatigue !== undefined ? { fatigue: clamp01(options.fatigue) } : {}),
    ...(options.sleepDebt !== undefined ? { sleepDebt: clamp01(options.sleepDebt) } : {})
  };
}

function deepThinkingReasons(state: CharacterPhysicsState, threshold: number): string[] {
  const reasons: string[] = [];
  if (state.boundary.stressLoad >= threshold) reasons.push("boundary stress exceeds reflection threshold");
  if (state.boundary.phase === "overflow") reasons.push("boundary is overflowing");
  if (state.boundary.cracks >= threshold) reasons.push("boundary cracks exceed reflection threshold");
  return reasons;
}
