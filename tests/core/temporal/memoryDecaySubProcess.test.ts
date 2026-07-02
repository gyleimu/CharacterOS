import { describe, expect, it } from "vitest";
import { buildMemoryDecaySubProcessTrace } from "../../../src/core/temporal/subprocesses/memoryDecaySubProcess";
import type { MemoryNode } from "../../../src/core/memory/memoryNode";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

function makeMemory(overrides?: Partial<MemoryNode>): MemoryNode {
  return {
    id: "test_memory",
    content: "test",
    vector: neutralCoordinate(),
    importance: 0.8,
    emotion: "neutral",
    recency: 1.0,
    repetitionCount: 2,
    beliefEffect: "test",
    timeStamp: "2026-06-23T00:00:00",
    clusterId: "cluster_test",
    ...overrides
  };
}

describe("buildMemoryDecaySubProcessTrace", () => {
  it("produces a MemoryDecaySubProcessTrace with correct kind and id", () => {
    const mem = makeMemory();
    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: [mem],
      memoriesAfter: [mem]
    });

    expect(trace.kind).toBe("memory_decay");
    expect(trace.id).toBe("decay_and_recovery.memory_decay");
    expect(trace.label).toBe("Memory Decay");
    expect(trace.reads).toEqual(["memories"]);
    expect(trace.writes).toEqual(["memories"]);
    expect(trace.changedStates).toEqual(["memories"]);
  });

  it("computes average recency and weight from before/after snapshots", () => {
    const before: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.9, importance: 0.8 }),
      makeMemory({ id: "m2", recency: 0.7, importance: 0.6 })
    ];
    const after: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.6, importance: 0.8 }),
      makeMemory({ id: "m2", recency: 0.4, importance: 0.6 })
    ];

    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: before,
      memoriesAfter: after
    });

    expect(trace.metrics.memoryCount).toBe(2);
    expect(trace.metrics.averageRecencyBefore).toBeGreaterThan(0);
    expect(trace.metrics.averageRecencyAfter).toBeGreaterThan(0);
  });

  it("has averageRecencyBefore > averageRecencyAfter when decay occurred", () => {
    const before: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 1.0, importance: 0.9 }),
      makeMemory({ id: "m2", recency: 0.8, importance: 0.7 })
    ];
    const after: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.4, importance: 0.9 }),
      makeMemory({ id: "m2", recency: 0.3, importance: 0.7 })
    ];

    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: before,
      memoriesAfter: after
    });

    expect(trace.metrics.averageRecencyBefore).toBeGreaterThan(
      trace.metrics.averageRecencyAfter
    );
  });

  it("has averageEffectiveWeightBefore > averageEffectiveWeightAfter when decay reduces recency", () => {
    const before: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 1.0, importance: 0.8, repetitionCount: 2 })
    ];
    const after: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.3, importance: 0.8, repetitionCount: 2 })
    ];

    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: before,
      memoriesAfter: after
    });

    expect(trace.metrics.averageEffectiveWeightBefore).toBeGreaterThan(
      trace.metrics.averageEffectiveWeightAfter
    );
  });

  it("does not mutate input arrays", () => {
    const before: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.9 }),
      makeMemory({ id: "m2", recency: 0.7 })
    ];
    const after: MemoryNode[] = [
      makeMemory({ id: "m1", recency: 0.6 }),
      makeMemory({ id: "m2", recency: 0.4 })
    ];

    const beforeCopy = [...before];
    const afterCopy = [...after];

    buildMemoryDecaySubProcessTrace({
      memoriesBefore: before,
      memoriesAfter: after
    });

    // Verify arrays unchanged
    expect(before.length).toBe(2);
    expect(after.length).toBe(2);
    expect(before[0]!.recency).toBe(beforeCopy[0]!.recency);
    expect(before[1]!.recency).toBe(beforeCopy[1]!.recency);
    expect(after[0]!.recency).toBe(afterCopy[0]!.recency);
    expect(after[1]!.recency).toBe(afterCopy[1]!.recency);
  });

  it("returns memoryCount=0 and includes warning reason for empty memories", () => {
    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: [],
      memoriesAfter: []
    });

    expect(trace.metrics.memoryCount).toBe(0);
    expect(trace.metrics.averageRecencyBefore).toBe(0);
    expect(trace.metrics.averageRecencyAfter).toBe(0);
    expect(trace.metrics.averageEffectiveWeightBefore).toBe(0);
    expect(trace.metrics.averageEffectiveWeightAfter).toBe(0);
    expect(trace.reasons.length).toBeGreaterThanOrEqual(2);
    expect(trace.reasons.some((r) => r.includes("No memories"))).toBe(true);
  });

  it("includes the standard decay reason for non-empty memories", () => {
    const mem = makeMemory();
    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: [mem],
      memoriesAfter: [mem]
    });

    expect(trace.reasons.length).toBe(1);
    expect(trace.reasons[0]).toContain("recency");
    expect(trace.reasons[0]).toContain("effective weight");
  });

  it("handles single memory correctly", () => {
    const before: MemoryNode[] = [
      makeMemory({ id: "single", recency: 0.85, importance: 0.75, repetitionCount: 3 })
    ];
    const after: MemoryNode[] = [
      makeMemory({ id: "single", recency: 0.42, importance: 0.75, repetitionCount: 3 })
    ];

    const trace = buildMemoryDecaySubProcessTrace({
      memoriesBefore: before,
      memoriesAfter: after
    });

    expect(trace.metrics.memoryCount).toBe(1);
    expect(trace.metrics.averageRecencyBefore).toBe(0.85);
    expect(trace.metrics.averageRecencyAfter).toBe(0.42);
  });

  it("produces stable reads/writes/reasons across calls", () => {
    const mem = makeMemory();
    const trace1 = buildMemoryDecaySubProcessTrace({
      memoriesBefore: [mem],
      memoriesAfter: [mem]
    });
    const trace2 = buildMemoryDecaySubProcessTrace({
      memoriesBefore: [mem],
      memoriesAfter: [mem]
    });

    expect(trace1.reads).toEqual(trace2.reads);
    expect(trace1.writes).toEqual(trace2.writes);
    expect(trace1.reasons).toEqual(trace2.reasons);
    expect(trace1.metrics.memoryCount).toBe(trace2.metrics.memoryCount);
  });
});
