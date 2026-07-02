import { effectiveMemoryWeight } from "../memory/decay";
import type { MemoryNode } from "../memory/memoryNode";
import type { MetaState } from "../meta/metaState";
import { clamp01 } from "../parameters/parameterMath";
import type { BeliefState } from "./beliefState";
import { deriveBeliefs } from "./beliefState";

export interface BeliefEvolutionTrace {
  before: BeliefState[];
  after: BeliefState[];
  strengthened: string[];
  weakened: string[];
  reasons: string[];
}

export function assimilateMemoryIntoBeliefs(
  beliefs: BeliefState[],
  memory: MemoryNode
): BeliefState[] {
  const existingIndex = beliefs.findIndex((belief) => belief.content === memory.beliefEffect);
  const evidenceStrength = evidenceStrengthFromMemory(memory);

  if (existingIndex === -1) {
    return [
      ...beliefs,
      {
        id: beliefId(memory.beliefEffect),
        content: memory.beliefEffect,
        strength: evidenceStrength,
        evidenceCount: 1,
        sourceMemoryIds: [memory.id]
      }
    ].sort(sortBeliefs);
  }

  return beliefs
    .map((belief, index) => {
      if (index !== existingIndex) return belief;
      const alreadyAssimilated = belief.sourceMemoryIds.includes(memory.id);
      const strength = alreadyAssimilated
        ? belief.strength
        : combineEvidence(belief.strength, evidenceStrength);
      return {
        ...belief,
        strength,
        evidenceCount: alreadyAssimilated ? belief.evidenceCount : belief.evidenceCount + 1,
        sourceMemoryIds: [...new Set([...belief.sourceMemoryIds, memory.id])]
      };
    })
    .sort(sortBeliefs);
}

export function evolveBeliefsForTick(params: {
  beliefs: BeliefState[];
  memories: MemoryNode[];
  meta: MetaState;
  daysElapsed: number;
}): BeliefEvolutionTrace {
  const before = params.beliefs.length ? cloneBeliefs(params.beliefs) : deriveBeliefs(params.memories);
  const support = beliefSupportFromMemories(params.memories);
  const daysFactor = clamp01(params.daysElapsed / 90);
  const plasticity = clamp01(
    (0.04 + params.meta.emotionalSensitivity * 0.035 + params.meta.memoryStrength * 0.025) * daysFactor
  );
  const forgettingPressure = clamp01(params.meta.forgettingSpeed * 0.03 * daysFactor);
  const contents = new Set([...before.map((belief) => belief.content), ...support.keys()]);
  const after: BeliefState[] = [];
  const strengthened: string[] = [];
  const weakened: string[] = [];

  for (const content of contents) {
    const current = before.find((belief) => belief.content === content);
    const supported = support.get(content);
    const targetStrength = supported?.strength ?? 0;
    const currentStrength = current?.strength ?? 0;
    const drift = (targetStrength - currentStrength) * plasticity;
    const unsupportedDecay = supported ? 0 : forgettingPressure;
    const nextStrength = clamp01(currentStrength + drift - unsupportedDecay);

    if (nextStrength <= 0.02) continue;
    if (nextStrength > currentStrength + 0.005) strengthened.push(content);
    if (nextStrength < currentStrength - 0.005) weakened.push(content);

    after.push({
      id: current?.id ?? beliefId(content),
      content,
      strength: nextStrength,
      evidenceCount: Math.max(current?.evidenceCount ?? 0, supported?.evidenceCount ?? 0),
      sourceMemoryIds: [
        ...new Set([...(current?.sourceMemoryIds ?? []), ...(supported?.sourceMemoryIds ?? [])])
      ]
    });
  }

  return {
    before,
    after: after.sort(sortBeliefs),
    strengthened,
    weakened,
    reasons: buildReasons({ plasticity, forgettingPressure, strengthened, weakened })
  };
}

function beliefSupportFromMemories(memories: MemoryNode[]): Map<string, BeliefState> {
  const support = new Map<string, BeliefState>();
  for (const memory of memories) {
    const existing = support.get(memory.beliefEffect) ?? {
      id: beliefId(memory.beliefEffect),
      content: memory.beliefEffect,
      strength: 0,
      evidenceCount: 0,
      sourceMemoryIds: []
    };
    existing.evidenceCount += 1;
    existing.sourceMemoryIds.push(memory.id);
    existing.strength = combineEvidence(existing.strength, evidenceStrengthFromMemory(memory));
    support.set(memory.beliefEffect, existing);
  }
  return support;
}

function evidenceStrengthFromMemory(memory: MemoryNode): number {
  const repetitionPressure = 1 + Math.min(memory.repetitionCount, 8) * 0.035;
  const emotionalSalience = ["fear", "anger", "sadness", "shame", "joy", "love"].includes(memory.emotion)
    ? 1.08
    : 1;
  return clamp01(effectiveMemoryWeight(memory) * 0.24 * repetitionPressure * emotionalSalience);
}

function combineEvidence(currentStrength: number, evidenceStrength: number): number {
  return clamp01(currentStrength + evidenceStrength * (1 - currentStrength));
}

function buildReasons(params: {
  plasticity: number;
  forgettingPressure: number;
  strengthened: string[];
  weakened: string[];
}): string[] {
  const reasons = [`belief plasticity ${params.plasticity.toFixed(4)}`];
  if (params.forgettingPressure > 0) reasons.push(`unsupported belief decay ${params.forgettingPressure.toFixed(4)}`);
  if (params.strengthened.length) reasons.push("memory evidence strengthened beliefs");
  if (params.weakened.length) reasons.push("memory decay weakened beliefs");
  return reasons;
}

function cloneBeliefs(beliefs: BeliefState[]): BeliefState[] {
  return beliefs.map((belief) => ({
    ...belief,
    sourceMemoryIds: [...belief.sourceMemoryIds]
  }));
}

function beliefId(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return `belief_${hash.toString(16)}`;
}

function sortBeliefs(a: BeliefState, b: BeliefState): number {
  return b.strength - a.strength;
}
