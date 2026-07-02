import { describe, expect, it } from "vitest";
import {
  summarizeSubProcessTraces,
  type MemoryDecaySubProcessTrace,
  type ProceduralDecaySubProcessTrace,
  type BoundaryRecoverySubProcessTrace,
  type RewardRecoverySubProcessTrace,
  type AnySubProcessTrace
} from "../../../src/core/temporal/subProcessTrace";

function makeMemoryDecay(
  overrides?: Partial<MemoryDecaySubProcessTrace>
): MemoryDecaySubProcessTrace {
  return {
    id: "decay_and_recovery.memory_decay",
    kind: "memory_decay",
    label: "Memory Decay",
    reads: ["memories"],
    writes: ["memories"],
    changedStates: ["memories"],
    reasons: ["Memory recency and effective weight decay with elapsed time."],
    metrics: {
      memoryCount: 3,
      averageRecencyBefore: 0.82,
      averageRecencyAfter: 0.74,
      averageEffectiveWeightBefore: 0.48,
      averageEffectiveWeightAfter: 0.42
    },
    ...overrides
  };
}

function makeProceduralDecay(
  overrides?: Partial<ProceduralDecaySubProcessTrace>
): ProceduralDecaySubProcessTrace {
  return {
    id: "decay_and_recovery.procedural_decay",
    kind: "procedural_decay",
    label: "Procedural Routine Decay",
    reads: ["proceduralRoutines"],
    writes: ["proceduralRoutines"],
    changedStates: ["proceduralRoutines"],
    reasons: ["Procedural routines lose strength when unused."],
    metrics: {
      routineCount: 3,
      averageStrengthBefore: 0.58,
      averageStrengthAfter: 0.51
    },
    ...overrides
  };
}

function makeBoundaryRecovery(
  overrides?: Partial<BoundaryRecoverySubProcessTrace>
): BoundaryRecoverySubProcessTrace {
  return {
    id: "decay_and_recovery.boundary_recovery",
    kind: "boundary_recovery",
    label: "Boundary Recovery",
    reads: ["boundary"],
    writes: ["boundary"],
    changedStates: ["boundary"],
    reasons: ["Psychological boundary recovers toward baseline."],
    metrics: {
      stressLoadBefore: 0.72,
      stressLoadAfter: 0.58,
      integrityBefore: 0.52,
      integrityAfter: 0.61,
      cracksBefore: 0.35,
      cracksAfter: 0.22
    },
    ...overrides
  };
}

function makeRewardRecovery(
  overrides?: Partial<RewardRecoverySubProcessTrace>
): RewardRecoverySubProcessTrace {
  return {
    id: "decay_and_recovery.reward_recovery",
    kind: "reward_recovery",
    label: "Reward Baseline Recovery",
    reads: ["rewardState"],
    writes: ["rewardState"],
    changedStates: ["rewardState"],
    reasons: ["Reward state recovers toward baseline."],
    metrics: {
      dopamineBefore: 0.28,
      dopamineAfter: 0.34,
      thresholdBefore: 0.55,
      thresholdAfter: 0.53,
      cravingBefore: 0.42,
      cravingAfter: 0.36
    },
    ...overrides
  };
}

describe("SubProcessTrace types", () => {
  it("can construct all 4 kinds of subprocess traces", () => {
    const traces: AnySubProcessTrace[] = [
      makeMemoryDecay(),
      makeProceduralDecay(),
      makeBoundaryRecovery(),
      makeRewardRecovery()
    ];
    expect(traces).toHaveLength(4);
    expect(traces[0]!.kind).toBe("memory_decay");
    expect(traces[1]!.kind).toBe("procedural_decay");
    expect(traces[2]!.kind).toBe("boundary_recovery");
    expect(traces[3]!.kind).toBe("reward_recovery");
  });

  it("memory decay trace has all expected metric fields", () => {
    const trace = makeMemoryDecay();
    expect(trace.metrics.memoryCount).toBe(3);
    expect(trace.metrics.averageRecencyBefore).toBeGreaterThan(0);
    expect(trace.metrics.averageRecencyAfter).toBeLessThan(trace.metrics.averageRecencyBefore);
    expect(trace.metrics.averageEffectiveWeightBefore).toBeGreaterThan(0);
  });

  it("boundary recovery trace has all expected metric fields", () => {
    const trace = makeBoundaryRecovery();
    expect(trace.metrics.stressLoadAfter).toBeLessThan(trace.metrics.stressLoadBefore);
    expect(trace.metrics.integrityAfter).toBeGreaterThan(trace.metrics.integrityBefore);
    expect(trace.metrics.cracksAfter).toBeLessThan(trace.metrics.cracksBefore);
  });

  it("reward recovery trace has all expected metric fields", () => {
    const trace = makeRewardRecovery();
    expect(trace.metrics.dopamineAfter).toBeGreaterThan(trace.metrics.dopamineBefore);
    expect(trace.metrics.cravingAfter).toBeLessThan(trace.metrics.cravingBefore);
  });
});

describe("summarizeSubProcessTraces", () => {
  it("summarizes all 4 kinds correctly", () => {
    const traces: AnySubProcessTrace[] = [
      makeMemoryDecay(),
      makeProceduralDecay(),
      makeBoundaryRecovery(),
      makeRewardRecovery()
    ];
    const summary = summarizeSubProcessTraces(traces);

    expect(summary.totalSubProcesses).toBe(4);
    expect(summary.kinds).toEqual([
      "boundary_recovery",
      "memory_decay",
      "procedural_decay",
      "reward_recovery"
    ]);
    expect(summary.changedStateNames).toEqual([
      "boundary",
      "memories",
      "proceduralRoutines",
      "rewardState"
    ]);
    expect(summary.warnings).toEqual([]);
  });

  it("deduplicates repeated changedStates across subprocesses", () => {
    // Two subprocesses both writing the same field is unusual but possible
    const traces: AnySubProcessTrace[] = [
      makeBoundaryRecovery({ changedStates: ["boundary"] }),
      { ...makeBoundaryRecovery(), id: "other.boundary", changedStates: ["boundary"] }
    ];
    const summary = summarizeSubProcessTraces(traces);
    expect(summary.changedStateNames).toEqual(["boundary"]);
  });

  it("handles empty traces with a warning", () => {
    const summary = summarizeSubProcessTraces([]);
    expect(summary.totalSubProcesses).toBe(0);
    expect(summary.kinds).toEqual([]);
    expect(summary.changedStateNames).toEqual([]);
    expect(summary.warnings.length).toBe(1);
    expect(summary.warnings[0]).toContain("empty");
  });

  it("does not mutate the input traces array", () => {
    const traces: AnySubProcessTrace[] = [makeMemoryDecay(), makeBoundaryRecovery()];
    const frozen = Object.freeze([...traces]);
    summarizeSubProcessTraces(frozen);
    // If summarize mutated the input, Object.freeze would have thrown
    expect(frozen).toHaveLength(2);
  });

  it("aggregates reasons from all subprocesses", () => {
    const traces: AnySubProcessTrace[] = [makeMemoryDecay(), makeBoundaryRecovery()];
    const summary = summarizeSubProcessTraces(traces);
    expect(summary.reasons.length).toBe(2);
  });
});
