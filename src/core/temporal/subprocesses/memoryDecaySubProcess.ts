/**
 * V5.2 Memory Decay SubProcess Instrumentation
 *
 * Pure builder that produces a MemoryDecaySubProcessTrace from
 * pre-decay and post-decay memory snapshots. Does NOT mutate
 * memories or change any decay behavior.
 *
 * Instrumentation only — V3 Phase 3 shape is preserved.
 */

import type { MemoryNode } from "../../memory/memoryNode";
import { effectiveMemoryWeight } from "../../memory/decay";
import { average } from "../../parameters/parameterMath";
import type { MemoryDecaySubProcessTrace } from "../subProcessTrace";

export interface BuildMemoryDecaySubProcessTraceParams {
  /** Memories before decay (Phase 3 input). */
  readonly memoriesBefore: readonly MemoryNode[];
  /** Memories after decay (Phase 3 output). */
  readonly memoriesAfter: readonly MemoryNode[];
}

/**
 * Build a MemoryDecaySubProcessTrace from before/after memory snapshots.
 *
 * Pure function — does not read or write CharacterPhysicsState.
 * Does not mutate the input arrays. Does not perform decay.
 *
 * V5.2: This is additive instrumentation. The decay itself is still
 * performed inline in runContinuousTick Phase 3.
 */
export function buildMemoryDecaySubProcessTrace(
  params: BuildMemoryDecaySubProcessTraceParams
): MemoryDecaySubProcessTrace {
  const { memoriesBefore, memoriesAfter } = params;

  const memoryCount = memoriesAfter.length;

  const averageRecencyBefore = average(
    memoriesBefore.map((m) => m.recency)
  );
  const averageRecencyAfter = average(
    memoriesAfter.map((m) => m.recency)
  );
  const averageEffectiveWeightBefore = average(
    memoriesBefore.map(effectiveMemoryWeight)
  );
  const averageEffectiveWeightAfter = average(
    memoriesAfter.map(effectiveMemoryWeight)
  );

  const reasons: string[] = [
    "Memory recency and effective weight decay with elapsed time."
  ];

  if (memoryCount === 0) {
    reasons.push("No memories present — decay had no effect.");
  }

  return {
    id: "decay_and_recovery.memory_decay",
    kind: "memory_decay",
    label: "Memory Decay",
    reads: ["memories"],
    writes: ["memories"],
    changedStates: ["memories"],
    reasons,
    metrics: {
      memoryCount,
      averageRecencyBefore,
      averageRecencyAfter,
      averageEffectiveWeightBefore,
      averageEffectiveWeightAfter
    }
  };
}
