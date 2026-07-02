import { describe, expect, it } from "vitest";
import { buildProceduralDecaySubProcessTrace } from "../../../src/core/temporal/subprocesses/proceduralDecaySubProcess";
import type { ProceduralRoutine } from "../../../src/core/procedural/proceduralMemory";

function makeRoutine(overrides?: Partial<ProceduralRoutine>): ProceduralRoutine {
  return {
    id: "test_routine",
    cueTags: ["测试"],
    action: "执行测试。",
    strength: 0.8,
    repetitionCount: 10,
    ...overrides
  };
}

describe("buildProceduralDecaySubProcessTrace", () => {
  it("produces a ProceduralDecaySubProcessTrace with correct kind and id", () => {
    const routine = makeRoutine();
    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: [routine],
      routinesAfter: [routine]
    });

    expect(trace.kind).toBe("procedural_decay");
    expect(trace.id).toBe("decay_and_recovery.procedural_decay");
    expect(trace.label).toBe("Procedural Routine Decay");
    expect(trace.reads).toEqual(["proceduralRoutines"]);
    expect(trace.writes).toEqual(["proceduralRoutines"]);
    expect(trace.changedStates).toEqual(["proceduralRoutines"]);
  });

  it("computes average strength from before/after snapshots", () => {
    const before: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.9 }),
      makeRoutine({ id: "r2", strength: 0.7 })
    ];
    const after: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.6 }),
      makeRoutine({ id: "r2", strength: 0.4 })
    ];

    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: before,
      routinesAfter: after
    });

    expect(trace.metrics.routineCount).toBe(2);
    expect(trace.metrics.averageStrengthBefore).toBeGreaterThan(0);
    expect(trace.metrics.averageStrengthAfter).toBeGreaterThan(0);
  });

  it("has averageStrengthBefore >= averageStrengthAfter when decay occurred", () => {
    const before: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.95 }),
      makeRoutine({ id: "r2", strength: 0.82 })
    ];
    const after: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.51 }),
      makeRoutine({ id: "r2", strength: 0.38 })
    ];

    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: before,
      routinesAfter: after
    });

    expect(trace.metrics.averageStrengthBefore).toBeGreaterThan(
      trace.metrics.averageStrengthAfter
    );
  });

  it("does not mutate input arrays", () => {
    const before: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.9 }),
      makeRoutine({ id: "r2", strength: 0.7 })
    ];
    const after: ProceduralRoutine[] = [
      makeRoutine({ id: "r1", strength: 0.6 }),
      makeRoutine({ id: "r2", strength: 0.4 })
    ];

    const beforeCopy = [...before];
    const afterCopy = [...after];

    buildProceduralDecaySubProcessTrace({
      routinesBefore: before,
      routinesAfter: after
    });

    expect(before.length).toBe(2);
    expect(after.length).toBe(2);
    expect(before[0]!.strength).toBe(beforeCopy[0]!.strength);
    expect(before[1]!.strength).toBe(beforeCopy[1]!.strength);
    expect(after[0]!.strength).toBe(afterCopy[0]!.strength);
    expect(after[1]!.strength).toBe(afterCopy[1]!.strength);
  });

  it("returns routineCount=0 and includes warning reason for empty routines", () => {
    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: [],
      routinesAfter: []
    });

    expect(trace.metrics.routineCount).toBe(0);
    expect(trace.metrics.averageStrengthBefore).toBe(0);
    expect(trace.metrics.averageStrengthAfter).toBe(0);
    expect(trace.reasons.length).toBeGreaterThanOrEqual(2);
    expect(trace.reasons.some((r) => r.includes("No procedural routines"))).toBe(true);
  });

  it("includes the standard decay reason for non-empty routines", () => {
    const routine = makeRoutine();
    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: [routine],
      routinesAfter: [routine]
    });

    expect(trace.reasons.length).toBe(1);
    expect(trace.reasons[0]).toContain("lose strength");
    expect(trace.reasons[0]).toContain("unused");
  });

  it("handles single routine correctly", () => {
    const before: ProceduralRoutine[] = [
      makeRoutine({ id: "single", strength: 0.72 })
    ];
    const after: ProceduralRoutine[] = [
      makeRoutine({ id: "single", strength: 0.35 })
    ];

    const trace = buildProceduralDecaySubProcessTrace({
      routinesBefore: before,
      routinesAfter: after
    });

    expect(trace.metrics.routineCount).toBe(1);
    expect(trace.metrics.averageStrengthBefore).toBe(0.72);
    expect(trace.metrics.averageStrengthAfter).toBe(0.35);
  });

  it("produces stable reads/writes/reasons across calls", () => {
    const routine = makeRoutine();
    const trace1 = buildProceduralDecaySubProcessTrace({
      routinesBefore: [routine],
      routinesAfter: [routine]
    });
    const trace2 = buildProceduralDecaySubProcessTrace({
      routinesBefore: [routine],
      routinesAfter: [routine]
    });

    expect(trace1.reads).toEqual(trace2.reads);
    expect(trace1.writes).toEqual(trace2.writes);
    expect(trace1.reasons).toEqual(trace2.reasons);
    expect(trace1.metrics.routineCount).toBe(trace2.metrics.routineCount);
  });
});
