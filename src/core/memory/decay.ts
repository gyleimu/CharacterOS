import type { MemoryNode } from "./memoryNode";
import { ebbinghausDecay } from "../galaxy/memoryDecay";
import { clamp01, round4 } from "../parameters/parameterMath";

export function decayMemory(memory: MemoryNode, daysElapsed: number, decayRate = 0.03): MemoryNode {
  if (daysElapsed <= 0) return memory;
  const recency = ebbinghausDecay(memory.recency, daysElapsed, decayRate);
  return { ...memory, recency: clamp01(recency) };
}

export function decayMemories(memories: MemoryNode[], daysElapsed: number, decayRate = 0.03): MemoryNode[] {
  return memories.map((memory) => decayMemory(memory, daysElapsed, decayRate));
}

export function effectiveMemoryWeight(memory: MemoryNode): number {
  const repetitionBonus = 1 + Math.min(memory.repetitionCount, 10) * 0.05;
  return round4(memory.importance * memory.recency * repetitionBonus);
}
