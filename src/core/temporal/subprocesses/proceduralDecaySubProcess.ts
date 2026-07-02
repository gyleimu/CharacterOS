/**
 * V5.3 Procedural Decay SubProcess Instrumentation
 *
 * Pure builder that produces a ProceduralDecaySubProcessTrace from
 * pre-decay and post-decay procedural routine snapshots. Does NOT
 * mutate routines or change any decay behavior.
 *
 * Instrumentation only — V3 Phase 3 shape is preserved.
 */

import type { ProceduralRoutine } from "../../procedural/proceduralMemory";
import { average } from "../../parameters/parameterMath";
import type { ProceduralDecaySubProcessTrace } from "../subProcessTrace";

export interface BuildProceduralDecaySubProcessTraceParams {
  /** Routines before decay (Phase 3 input). */
  readonly routinesBefore: readonly ProceduralRoutine[];
  /** Routines after decay (Phase 3 output). */
  readonly routinesAfter: readonly ProceduralRoutine[];
}

/**
 * Build a ProceduralDecaySubProcessTrace from before/after routine snapshots.
 *
 * Pure function — does not read or write CharacterPhysicsState.
 * Does not mutate the input arrays. Does not perform decay.
 *
 * V5.3: This is additive instrumentation. The decay itself is still
 * performed inline in runContinuousTick Phase 3.
 */
export function buildProceduralDecaySubProcessTrace(
  params: BuildProceduralDecaySubProcessTraceParams
): ProceduralDecaySubProcessTrace {
  const { routinesBefore, routinesAfter } = params;

  const routineCount = routinesAfter.length;

  const averageStrengthBefore = average(
    routinesBefore.map((r) => r.strength)
  );
  const averageStrengthAfter = average(
    routinesAfter.map((r) => r.strength)
  );

  const reasons: string[] = [
    "Procedural routines lose strength when unused."
  ];

  if (routineCount === 0) {
    reasons.push("No procedural routines present — decay had no effect.");
  }

  return {
    id: "decay_and_recovery.procedural_decay",
    kind: "procedural_decay",
    label: "Procedural Routine Decay",
    reads: ["proceduralRoutines"],
    writes: ["proceduralRoutines"],
    changedStates: ["proceduralRoutines"],
    reasons,
    metrics: {
      routineCount,
      averageStrengthBefore,
      averageStrengthAfter
    }
  };
}
