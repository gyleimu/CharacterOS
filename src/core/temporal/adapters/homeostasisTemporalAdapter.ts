/**
 * V4.12 Homeostasis TemporalProcess Adapter — fourth V4 delegation.
 *
 * Wraps the existing V3 function `applyHomeostasis` as a TemporalProcess.
 * Behavior is strictly equivalent to the inline Phase 4 code in
 * runContinuousTick. This is the first multi-state overwrite adapter —
 * it writes homeostasisState AND overwrites Phase 3 recovery outputs
 * (metaState, boundary, rewardState) with regulated values.
 *
 * D10 (Overwrite Semantics Equivalence) applies to this adapter.
 */

import type { MetaState } from "../../meta/metaState";
import type { PsychologicalBoundary } from "../../boundary/psychologicalBoundary";
import type { RewardState } from "../../reward/rewardSystem";
import { applyHomeostasis, type HomeostasisTrace, type HomeostasisState } from "../../homeostasis/homeostasis";
import type { TemporalProcessResult } from "../temporalProcess";

export interface HomeostasisTemporalAdapterInput {
  homeostasis: HomeostasisState;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
  daysElapsed: number;
}

export interface HomeostasisTemporalAdapterResult {
  trace: HomeostasisTrace;
  phase: {
    name: "homeostasis";
    changedStates: string[];
    reasons: string[];
  };
  temporalResult: TemporalProcessResult;
}

export function executeHomeostasisTemporalAdapter(
  input: HomeostasisTemporalAdapterInput
): HomeostasisTemporalAdapterResult {
  const trace = applyHomeostasis({
    homeostasis: input.homeostasis,
    meta: input.meta,
    boundary: input.boundary,
    reward: input.reward,
    daysElapsed: input.daysElapsed
  });

  return {
    trace,
    phase: {
      name: "homeostasis",
      changedStates: ["homeostasisState", "metaState", "boundary", "rewardState"],
      reasons: [...trace.reasons]
    },
    temporalResult: {
      processId: "homeostasis",
      before: {
        homeostasisStabilitySetPoint: trace.before.stabilitySetPoint,
        homeostasisChangeResistance: trace.before.changeResistance,
        pressure: trace.pressure,
        resistance: trace.resistance
      },
      after: {
        homeostasisStabilitySetPoint: trace.after.stabilitySetPoint,
        homeostasisChangeResistance: trace.after.changeResistance,
        pressure: trace.pressure,
        resistance: trace.resistance
      },
      changedStates: ["homeostasisState", "metaState", "boundary", "rewardState"],
      reasons: [...trace.reasons],
      warnings: []
    }
  };
}
