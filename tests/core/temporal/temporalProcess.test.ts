import { describe, expect, it } from "vitest";
import { TemporalProcessRegistry } from "../../../src/core/temporal/temporalProcessRegistry";
import {
  V3_TICK_PHASES,
  V3_TICK_PHASE_COUNT,
  getV3TickPhase,
  v3TickPhaseIds
} from "../../../src/core/temporal/v3TickPhaseMetadata";
import type { TemporalProcess } from "../../../src/core/temporal/temporalProcess";

describe("V3 tick phase metadata", () => {
  it("has exactly 17 phases", () => {
    expect(V3_TICK_PHASES).toHaveLength(17);
    expect(V3_TICK_PHASE_COUNT).toBe(17);
  });

  it("every phase has a unique id", () => {
    const ids = V3_TICK_PHASES.map((phase) => phase.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every phase has a non-empty label", () => {
    for (const phase of V3_TICK_PHASES) {
      expect(phase.label).toBeTruthy();
      expect(typeof phase.label).toBe("string");
    }
  });

  it("every phase has a non-empty description", () => {
    for (const phase of V3_TICK_PHASES) {
      expect(phase.description).toBeTruthy();
      expect(typeof phase.description).toBe("string");
    }
  });

  it("every phase has reads and writes arrays", () => {
    for (const phase of V3_TICK_PHASES) {
      expect(Array.isArray(phase.reads)).toBe(true);
      expect(Array.isArray(phase.writes)).toBe(true);
    }
  });

  it("mutation phases have non-empty writes", () => {
    const mutationPhases = V3_TICK_PHASES.filter((phase) => phase.category === "mutation");
    expect(mutationPhases.length).toBeGreaterThan(0);
    for (const phase of mutationPhases) {
      expect(phase.writes.length).toBeGreaterThan(0);
    }
  });

  it("trace phases have empty writes", () => {
    const tracePhases = V3_TICK_PHASES.filter((phase) => phase.category === "trace");
    expect(tracePhases.length).toBeGreaterThan(0);
    for (const phase of tracePhases) {
      expect(phase.writes).toEqual([]);
    }
  });

  it("phase numbers are sequential from 1 to 17", () => {
    const numbers = V3_TICK_PHASES.map((phase) => phase.phase);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("phase ids are in expected execution order", () => {
    expect(v3TickPhaseIds()).toEqual([
      "snapshot",
      "meta_drift",
      "decay_and_recovery",
      "homeostasis",
      "recovery_trace",
      "parameter_network",
      "baseline_drift",
      "parameter_accumulation",
      "parameter_adjustment_draft",
      "parameter_adjustment_preview",
      "parameter_adjustment_audit",
      "parameter_adjustment_patch",
      "parameter_adjustment_snapshot",
      "boredom",
      "belief_evolution",
      "attention_and_reflection",
      "time_perception"
    ]);
  });

  it("getV3TickPhase returns correct phase by id", () => {
    const phase = getV3TickPhase("homeostasis");
    expect(phase).toBeDefined();
    expect(phase?.phase).toBe(4);
    expect(phase?.category).toBe("mutation");
    expect(phase?.writes).toContain("homeostasisState");
  });

  it("getV3TickPhase returns undefined for unknown id", () => {
    expect(getV3TickPhase("nonexistent")).toBeUndefined();
  });
});

describe("TemporalProcessRegistry", () => {
  it("is pre-populated with 17 V3 tick phases by default", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    expect(registry.size).toBe(17);
  });

  it("lists processes in insertion order", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    const ids = registry.list().map((p) => p.id);
    expect(ids[0]).toBe("snapshot");
    expect(ids[16]).toBe("time_perception");
  });

  it("returns ids in insertion order", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    expect(registry.ids()).toEqual(v3TickPhaseIds());
  });

  it("get returns a process by id", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    const phase = registry.get("belief_evolution");
    expect(phase).toBeDefined();
    expect(phase?.phase).toBe(15);
  });

  it("get returns undefined for unknown id", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("rejects duplicate process ids on register", () => {
    const registry = new TemporalProcessRegistry();
    const process: TemporalProcess = {
      id: "test",
      label: "Test",
      phase: 1,
      category: "trace",
      reads: [],
      writes: [],
      description: "A test process."
    };
    registry.register(process);
    expect(() => registry.register(process)).toThrow(/duplicate process id/);
  });

  it("can register custom metadata-only processes", () => {
    const registry = new TemporalProcessRegistry();
    const process: TemporalProcess = {
      id: "custom_adaptation",
      label: "Custom Adaptation",
      phase: 99,
      category: "trace",
      reads: ["rewardState"],
      writes: [],
      description: "Custom adaptation process for future use."
    };
    registry.register(process);
    expect(registry.size).toBe(1);
    expect(registry.get("custom_adaptation")?.label).toBe("Custom Adaptation");
  });

  it("does not execute any mutation — registry is metadata-only", () => {
    const registry = new TemporalProcessRegistry(V3_TICK_PHASES);
    // All phases in the registry are metadata; none mutate any state.
    // This is verified by the fact that registry has no execute/run method.
    expect(typeof (registry as unknown as { run?: unknown }).run).toBe("undefined");
  });
});
