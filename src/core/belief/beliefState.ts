import type { MemoryNode } from "../memory/memoryNode";
import { clamp01 } from "../parameters/parameterMath";

export interface BeliefState {
  id: string;
  content: string;
  strength: number;
  evidenceCount: number;
  sourceMemoryIds: string[];
}

export function deriveBeliefs(memories: MemoryNode[]): BeliefState[] {
  const groups = new Map<string, BeliefState>();

  for (const memory of memories) {
    const content = memory.beliefEffect;
    const existing = groups.get(content) ?? {
      id: beliefId(content),
      content,
      strength: 0,
      evidenceCount: 0,
      sourceMemoryIds: []
    };

    existing.evidenceCount += 1;
    existing.sourceMemoryIds.push(memory.id);
    existing.strength = clamp01(existing.strength + memory.importance * memory.recency * 0.35);
    groups.set(content, existing);
  }

  return [...groups.values()].sort((a, b) => b.strength - a.strength);
}

function beliefId(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return `belief_${hash.toString(16)}`;
}
