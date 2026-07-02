/**
 * V4.8 Belief Evolution TemporalProcess Adapter — second V4 delegation.
 *
 * Wraps the existing V3 function `evolveBeliefsForTick` as a TemporalProcess.
 * Behavior is strictly equivalent to the inline Phase 15 code in
 * runContinuousTick. No extra reads, no extra writes, no trace changes.
 *
 * Follows the same delegation template established by V4.7 boredom adapter.
 */

import type { MetaState } from "../../meta/metaState";
import type { MemoryNode } from "../../memory/memoryNode";
import type { BeliefState } from "../../belief/beliefState";
import { evolveBeliefsForTick, type BeliefEvolutionTrace } from "../../belief/beliefEvolution";
import type { TemporalProcessResult } from "../temporalProcess";

export interface BeliefEvolutionTemporalAdapterInput {
  beliefs: BeliefState[];
  memories: MemoryNode[];
  meta: MetaState;
  daysElapsed: number;
}

export interface BeliefEvolutionTemporalAdapterResult {
  trace: BeliefEvolutionTrace;
  phase: {
    name: "belief_evolution";
    changedStates: string[];
    reasons: string[];
  };
  temporalResult: TemporalProcessResult;
}

export function executeBeliefEvolutionTemporalAdapter(
  input: BeliefEvolutionTemporalAdapterInput
): BeliefEvolutionTemporalAdapterResult {
  const trace = evolveBeliefsForTick({
    beliefs: input.beliefs,
    memories: input.memories,
    meta: input.meta,
    daysElapsed: input.daysElapsed
  });

  const before = {
    count: trace.before.length,
    avgStrength: trace.before.length
      ? trace.before.reduce((s, b) => s + b.strength, 0) / trace.before.length
      : 0
  };

  const after = {
    count: trace.after.length,
    avgStrength: trace.after.length
      ? trace.after.reduce((s, b) => s + b.strength, 0) / trace.after.length
      : 0
  };

  return {
    trace,
    phase: {
      name: "belief_evolution",
      changedStates: ["beliefStates"],
      reasons: [...trace.reasons]
    },
    temporalResult: {
      processId: "belief_evolution",
      before,
      after,
      changedStates: ["beliefStates"],
      reasons: [...trace.reasons],
      warnings: []
    }
  };
}
