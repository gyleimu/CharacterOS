/**
 * V4.10 Meta Drift TemporalProcess Adapter — third V4 delegation.
 *
 * Wraps the existing V3 function `updateMetaStateForTick` as a TemporalProcess.
 * Behavior is strictly equivalent to the inline Phase 2 code in
 * runContinuousTick. No extra reads, no extra writes, no trace changes.
 */

import { updateMetaStateForTick, type MetaStateTickResult } from "../../meta/metaState";
import type { TemporalProcessResult } from "../temporalProcess";

export interface MetaDriftTemporalAdapterInput {
  meta: MetaStateTickResult["before"];
  daysElapsed: number;
  stressLoad: number;
  boundaryIntegrity: number;
}

export interface MetaDriftTemporalAdapterResult {
  trace: MetaStateTickResult;
  phase: {
    name: "meta_drift";
    changedStates: string[];
    reasons: string[];
  };
  temporalResult: TemporalProcessResult;
}

export function executeMetaDriftTemporalAdapter(
  input: MetaDriftTemporalAdapterInput
): MetaDriftTemporalAdapterResult {
  const trace = updateMetaStateForTick({
    meta: input.meta,
    daysElapsed: input.daysElapsed,
    stressLoad: input.stressLoad,
    boundaryIntegrity: input.boundaryIntegrity
  });

  const reason = Object.keys(trace.drift).length
    ? `Meta parameters drifted: ${Object.keys(trace.drift).join(", ")}.`
    : "No meta parameter drift.";

  return {
    trace,
    phase: {
      name: "meta_drift",
      changedStates: ["metaState"],
      reasons: [reason]
    },
    temporalResult: {
      processId: "meta_drift",
      before: {
        emotionalSensitivity: trace.before.emotionalSensitivity,
        resilience: trace.before.resilience,
        selfControl: trace.before.selfControl,
        traumaAmplification: trace.before.traumaAmplification,
        forgettingSpeed: trace.before.forgettingSpeed,
        attention: trace.before.attention
      },
      after: {
        emotionalSensitivity: trace.after.emotionalSensitivity,
        resilience: trace.after.resilience,
        selfControl: trace.after.selfControl,
        traumaAmplification: trace.after.traumaAmplification,
        forgettingSpeed: trace.after.forgettingSpeed,
        attention: trace.after.attention
      },
      changedStates: ["metaState"],
      reasons: [reason],
      warnings: []
    }
  };
}
