import type { MemoryNode } from "../memory/memoryNode";
import { clamp01, round4 } from "../parameters/parameterMath";

export interface GalaxyMemoryDecayResult {
  memory: MemoryNode;
  decayedImportance: number;
  decayedEmotionalIntensity: number;
}

export function ebbinghausDecay(value: number, daysElapsed: number, decayRate = 0.03): number {
  if (daysElapsed <= 0) return round4(clamp01(value));
  return round4(clamp01(value * Math.exp(-decayRate * daysElapsed)));
}

export function decayMemoryForGalaxy(
  memory: MemoryNode,
  daysElapsed: number,
  decayRate = 0.03
): GalaxyMemoryDecayResult {
  const recency = ebbinghausDecay(memory.recency, daysElapsed, decayRate);
  const decayedImportance = ebbinghausDecay(memory.importance, daysElapsed, decayRate * 0.35);
  return {
    memory: {
      ...memory,
      recency
    },
    decayedImportance,
    decayedEmotionalIntensity: decayedImportance
  };
}
