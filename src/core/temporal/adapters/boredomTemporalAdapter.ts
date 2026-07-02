/**
 * V4.7 Boredom TemporalProcess Adapter — first V4 execution-layer delegation.
 *
 * Wraps the existing V3 function `updateBoredomForTick` as a TemporalProcess.
 * Behavior is strictly equivalent to the inline Phase 14 code in
 * runContinuousTick. No extra reads, no extra writes, no trace changes.
 *
 * This adapter is the FIRST delegation in V4. It proves that the
 * TemporalProcess framework can wrap a V3 function without altering
 * behavior, trace shape, or state mutation patterns.
 */

import type { MetaState } from "../../meta/metaState";
import type { PsychologicalBoundary } from "../../boundary/psychologicalBoundary";
import type { RewardState } from "../../reward/rewardSystem";
import { updateBoredomForTick, type BoredomTickTrace } from "../../boredom/boredomSystem";
import type { TemporalProcessResult } from "../temporalProcess";

/** Input shape mirrored from updateBoredomForTick. */
export interface BoredomTemporalAdapterInput {
  boredom: BoredomTickTrace["before"];
  meta: MetaState;
  reward: RewardState;
  boundary: PsychologicalBoundary;
  daysElapsed: number;
}

/** Result includes the full V3 trace plus phase metadata for trace stitching. */
export interface BoredomTemporalAdapterResult {
  /** The V3 boredom tick trace — identical to direct updateBoredomForTick output. */
  trace: BoredomTickTrace;
  /** Phase trace metadata for stitching into runContinuousTick phases array. */
  phase: {
    name: "boredom";
    changedStates: string[];
    reasons: string[];
  };
  /** TemporalProcessResult shape for V4 trace compatibility. */
  temporalResult: TemporalProcessResult;
}

/**
 * Execute the boredom temporal process.
 *
 * Delegates directly to `updateBoredomForTick`. The returned trace and
 * phase metadata are identical to what the inline Phase 14 code produces.
 *
 * This adapter does NOT write to state — the caller is responsible for
 * `state.boredomState = result.trace.after`.
 */
export function executeBoredomTemporalAdapter(
  input: BoredomTemporalAdapterInput
): BoredomTemporalAdapterResult {
  const trace = updateBoredomForTick({
    boredom: input.boredom,
    meta: input.meta,
    reward: input.reward,
    boundary: input.boundary,
    daysElapsed: input.daysElapsed
  });

  const before = {
    boredomLevel: trace.before.boredomLevel,
    stimulationNeed: trace.before.stimulationNeed,
    daydreamingTendency: trace.before.daydreamingTendency,
    creativePressure: trace.before.creativePressure,
    restlessness: trace.before.restlessness
  };

  const after = {
    boredomLevel: trace.after.boredomLevel,
    stimulationNeed: trace.after.stimulationNeed,
    daydreamingTendency: trace.after.daydreamingTendency,
    creativePressure: trace.after.creativePressure,
    restlessness: trace.after.restlessness
  };

  return {
    trace,
    phase: {
      name: "boredom",
      changedStates: ["boredomState"],
      reasons: [...trace.reasons]
    },
    temporalResult: {
      processId: "boredom",
      before,
      after,
      changedStates: ["boredomState"],
      reasons: [...trace.reasons],
      warnings: []
    }
  };
}
