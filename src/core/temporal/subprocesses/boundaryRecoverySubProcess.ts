/**
 * V5.4 Boundary Recovery SubProcess Instrumentation
 *
 * Pure builder that produces a BoundaryRecoverySubProcessTrace from
 * pre-recovery and post-recovery boundary snapshots. Does NOT mutate
 * boundary or change any recovery behavior.
 *
 * D10-AWARE: Phase 3 boundary recovery is intermediate. Phase 4
 * homeostasis may further modify boundary via regulatedBoundary.
 * The subprocess trace records the Phase 3 recovery operation, not
 * the final tick boundary. Callers should consult
 * homeostasisResult.trace.regulatedBoundary for the final value.
 *
 * Instrumentation only — V3 Phase 3 shape is preserved.
 */

import type { PsychologicalBoundary } from "../../boundary/psychologicalBoundary";
import type { BoundaryRecoverySubProcessTrace } from "../subProcessTrace";

export interface BuildBoundaryRecoverySubProcessTraceParams {
  /** Boundary before recovery (Phase 1 snapshot). */
  readonly boundaryBefore: PsychologicalBoundary;
  /** Boundary after Phase 3 recovery (recoverBoundary result, pre-homeostasis). */
  readonly boundaryAfter: PsychologicalBoundary;
}

/**
 * Build a BoundaryRecoverySubProcessTrace from before/after boundary snapshots.
 *
 * Pure function — does not read or write CharacterPhysicsState.
 * Does not mutate the input objects. Does not perform recovery.
 *
 * D10 note: boundaryAfter here is the Phase 3 intermediate result of
 * recoverBoundary(). Phase 4 homeostasis may produce a different final
 * boundary via regulatedBoundary. This trace records the recovery
 * operation itself, not the tick's final boundary state.
 *
 * V5.4: This is additive instrumentation. The recovery itself is still
 * performed inline in runContinuousTick Phase 3.
 */
export function buildBoundaryRecoverySubProcessTrace(
  params: BuildBoundaryRecoverySubProcessTraceParams
): BoundaryRecoverySubProcessTrace {
  const { boundaryBefore, boundaryAfter } = params;

  const reasons: string[] = [
    "Psychological boundary recovers toward baseline with elapsed time.",
    "D10 note: Phase 4 homeostasis may further regulate boundary via regulatedBoundary — this trace records Phase 3 intermediate recovery only."
  ];

  return {
    id: "decay_and_recovery.boundary_recovery",
    kind: "boundary_recovery",
    label: "Boundary Recovery",
    reads: ["boundary"],
    writes: ["boundary"],
    changedStates: ["boundary"],
    reasons,
    metrics: {
      stressLoadBefore: boundaryBefore.stressLoad,
      stressLoadAfter: boundaryAfter.stressLoad,
      integrityBefore: boundaryBefore.integrity,
      integrityAfter: boundaryAfter.integrity,
      cracksBefore: boundaryBefore.cracks,
      cracksAfter: boundaryAfter.cracks
    }
  };
}
