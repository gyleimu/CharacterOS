import { describe, expect, it } from "vitest";
import { assimilateMemoryIntoBeliefs, evolveBeliefsForTick } from "../../src/core/belief/beliefEvolution";
import type { MemoryNode } from "../../src/core/memory/memoryNode";
import { defaultMetaState } from "../../src/core/meta/metaState";
import { zeroCoordinateDelta } from "../../src/core/personality/coordinate";

describe("Belief Evolution", () => {
  it("assimilates a memory as belief evidence without maxing belief strength", () => {
    const memory = memoryNode({
      id: "memory_1",
      beliefEffect: "亲密关系并不可靠",
      importance: 0.8,
      recency: 1
    });

    const beliefs = assimilateMemoryIntoBeliefs([], memory);

    expect(beliefs).toHaveLength(1);
    expect(beliefs[0]?.content).toBe("亲密关系并不可靠");
    expect(beliefs[0]?.strength).toBeGreaterThan(0);
    expect(beliefs[0]?.strength).toBeLessThan(0.5);
    expect(beliefs[0]?.sourceMemoryIds).toContain("memory_1");
  });

  it("does not double-count the same memory evidence", () => {
    const memory = memoryNode({
      id: "memory_duplicate",
      beliefEffect: "亲密关系并不可靠",
      importance: 0.86,
      recency: 1
    });

    const once = assimilateMemoryIntoBeliefs([], memory);
    const twice = assimilateMemoryIntoBeliefs(once, memory);

    expect(twice[0]?.strength).toBe(once[0]?.strength);
    expect(twice[0]?.evidenceCount).toBe(1);
    expect(twice[0]?.sourceMemoryIds).toEqual(["memory_duplicate"]);
  });

  it("uses diminishing returns for repeated matching evidence", () => {
    const first = memoryNode({
      id: "memory_repeated_1",
      beliefEffect: "等待通常没有结果",
      importance: 0.9,
      recency: 1
    });
    const second = memoryNode({
      id: "memory_repeated_2",
      beliefEffect: "等待通常没有结果",
      importance: 0.9,
      recency: 1
    });

    const afterFirst = assimilateMemoryIntoBeliefs([], first);
    const afterSecond = assimilateMemoryIntoBeliefs(afterFirst, second);
    const firstGain = afterFirst[0]?.strength ?? 0;
    const secondGain = (afterSecond[0]?.strength ?? 0) - firstGain;

    expect(afterSecond[0]?.strength).toBeGreaterThan(firstGain);
    expect(secondGain).toBeLessThan(firstGain);
    expect(afterSecond[0]?.strength).toBeLessThan(0.5);
  });

  it("slowly strengthens beliefs that still have memory support", () => {
    const memory = memoryNode({
      id: "memory_2",
      beliefEffect: "重要的人会突然离开",
      importance: 0.95,
      recency: 0.9,
      repetitionCount: 3
    });
    const originalBelief = {
      id: "belief_abandonment",
      content: "重要的人会突然离开",
      strength: 0.18,
      evidenceCount: 1,
      sourceMemoryIds: ["old_memory"]
    };
    const current = [originalBelief];

    const trace = evolveBeliefsForTick({
      beliefs: current,
      memories: [memory],
      meta: defaultMetaState(),
      daysElapsed: 90
    });

    expect(trace.after[0]?.strength).toBeGreaterThan(originalBelief.strength);
    expect(trace.strengthened).toContain("重要的人会突然离开");
  });

  it("weakens unsupported beliefs over time", () => {
    const originalBelief = {
      id: "belief_old",
      content: "我必须永远保持警惕",
      strength: 0.42,
      evidenceCount: 2,
      sourceMemoryIds: ["old_memory"]
    };
    const current = [originalBelief];

    const trace = evolveBeliefsForTick({
      beliefs: current,
      memories: [],
      meta: {
        ...defaultMetaState(),
        forgettingSpeed: 0.9
      },
      daysElapsed: 90
    });

    expect(trace.after[0]?.strength).toBeLessThan(originalBelief.strength);
    expect(trace.weakened).toContain("我必须永远保持警惕");
  });

  it("does not change beliefs when no time passes", () => {
    const originalBelief = {
      id: "belief_static",
      content: "王雪是少数真正靠近过他的人",
      strength: 0.37,
      evidenceCount: 1,
      sourceMemoryIds: ["memory_static"]
    };

    const trace = evolveBeliefsForTick({
      beliefs: [originalBelief],
      memories: [],
      meta: defaultMetaState(),
      daysElapsed: 0
    });

    expect(trace.after[0]?.strength).toBe(originalBelief.strength);
    expect(trace.strengthened).toEqual([]);
    expect(trace.weakened).toEqual([]);
  });
});

function memoryNode(params: {
  id: string;
  beliefEffect: string;
  importance: number;
  recency: number;
  repetitionCount?: number;
}): MemoryNode {
  return {
    id: params.id,
    content: params.beliefEffect,
    vector: zeroCoordinateDelta(),
    importance: params.importance,
    emotion: "fear",
    recency: params.recency,
    repetitionCount: params.repetitionCount ?? 1,
    beliefEffect: params.beliefEffect,
    timeStamp: "2026-06-19T00:00:00.000Z",
    clusterId: "cluster_abandonment"
  };
}
