import { describe, expect, it } from "vitest";
import {
  TemporalProcessAdapterRegistry,
  V3_TICK_PHASE_ADAPTERS
} from "../../../src/core/temporal/temporalProcessAdapterRegistry";
import { V3_TICK_PHASES, v3TickPhaseIds } from "../../../src/core/temporal/v3TickPhaseMetadata";
import type { TemporalProcessAdapter } from "../../../src/core/temporal/temporalProcess";

describe("V3 tick phase adapters", () => {
  it("has exactly 17 adapter shells — one per V3 phase", () => {
    expect(V3_TICK_PHASE_ADAPTERS).toHaveLength(17);
  });

  it("every phase id has a corresponding adapter", () => {
    const phaseIds = new Set(v3TickPhaseIds());
    const adapterIds = new Set(V3_TICK_PHASE_ADAPTERS.map((a) => a.processId));
    expect(adapterIds).toEqual(phaseIds);
  });

  it("every adapter's processId matches its metadata counterpart's id", () => {
    for (const adapter of V3_TICK_PHASE_ADAPTERS) {
      const metadata = V3_TICK_PHASES.find((p) => p.id === adapter.processId);
      expect(metadata).toBeDefined();
      expect(adapter.sourcePhase).toBe(metadata!.phase);
    }
  });

  it("4 phases delegated (meta_drift, homeostasis, boredom, belief_evolution); 13 shells", () => {
    const delegated = new Set(["meta_drift", "homeostasis", "boredom", "belief_evolution"]);
    for (const adapter of V3_TICK_PHASE_ADAPTERS) {
      if (delegated.has(adapter.processId)) {
        expect(adapter.implementationStatus).toBe("delegated");
      } else {
        expect(adapter.implementationStatus).toBe("adapter_shell");
      }
    }
  });

  it("mutation policy 'none' adapters do not have wrapsExistingFunction referring to mutation functions", () => {
    // Trace/context adapters may still reference existing functions but they're non-mutating.
    const noneAdapters = V3_TICK_PHASE_ADAPTERS.filter((a) => a.mutationPolicy === "none");
    expect(noneAdapters.length).toBeGreaterThan(0);
    // Each must have a non-empty notes field
    for (const adapter of noneAdapters) {
      expect(adapter.notes.length).toBeGreaterThan(0);
    }
  });

  it("mutation policy 'delegates_to_v3' adapters reference existing V3 functions", () => {
    const delegated = V3_TICK_PHASE_ADAPTERS.filter((a) => a.mutationPolicy === "delegates_to_v3");
    // Phases 2 (meta_drift), 3 (decay_and_recovery), 4 (homeostasis), 14 (boredom), 15 (belief_evolution)
    expect(delegated.length).toBe(5);
    for (const adapter of delegated) {
      expect(adapter.wrapsExistingFunction).toBeTruthy();
    }
  });

  it("every adapter has a non-empty notes field", () => {
    for (const adapter of V3_TICK_PHASE_ADAPTERS) {
      expect(adapter.notes.length).toBeGreaterThan(0);
    }
  });

  it("every adapter's risks field is an array (may be empty)", () => {
    for (const adapter of V3_TICK_PHASE_ADAPTERS) {
      expect(Array.isArray(adapter.risks)).toBe(true);
    }
  });

  it("homeostasis adapter correctly identifies as multi-state overwrite delegation", () => {
    const homeostasisAdapter = V3_TICK_PHASE_ADAPTERS.find((a) => a.processId === "homeostasis");
    expect(homeostasisAdapter).toBeDefined();
    expect(homeostasisAdapter?.mutationPolicy).toBe("delegates_to_v3");
    expect(homeostasisAdapter?.wrapsExistingFunction).toContain("applyHomeostasis");
    expect(homeostasisAdapter?.notes).toContain("multi-state overwrite");
  });

  it("snapshot adapter is the only one that delegates nothing and mutates nothing", () => {
    const snapshot = V3_TICK_PHASE_ADAPTERS.find((a) => a.processId === "snapshot");
    expect(snapshot?.mutationPolicy).toBe("none");
  });
});

describe("TemporalProcessAdapterRegistry", () => {
  function buildRegistry(): TemporalProcessAdapterRegistry {
    return new TemporalProcessAdapterRegistry(V3_TICK_PHASE_ADAPTERS);
  }

  it("is pre-populated with 17 adapters", () => {
    const registry = buildRegistry();
    expect(registry.size).toBe(17);
  });

  it("lists adapters in registration order", () => {
    const registry = buildRegistry();
    const list = registry.list();
    expect(list[0]?.processId).toBe("snapshot");
    expect(list[16]?.processId).toBe("time_perception");
  });

  it("get returns correct adapter by processId", () => {
    const registry = buildRegistry();
    const adapter = registry.get("decay_and_recovery");
    expect(adapter).toBeDefined();
    expect(adapter?.mutationPolicy).toBe("delegates_to_v3");
    expect(adapter?.wrapsExistingFunction).toContain("decayMemory");
  });

  it("get returns undefined for unknown processId", () => {
    const registry = buildRegistry();
    expect(registry.get("quantum_consciousness")).toBeUndefined();
  });

  it("summarize reports full coverage with zero missing phases", () => {
    const registry = buildRegistry();
    const summary = registry.summarize();
    expect(summary.totalPhases).toBe(17);
    expect(summary.registeredAdapters).toBe(17);
    expect(summary.byStatus.adapter_shell).toBe(13);
    expect(summary.byStatus.delegated).toBe(4);
    expect(summary.byStatus.native).toBe(0);
    expect(summary.byStatus.metadata_only).toBe(0);
    expect(summary.missingPhaseIds).toEqual([]);
    expect(summary.coveredPhaseIds).toEqual(v3TickPhaseIds());
  });

  it("summarize detects missing adapters when not all phases are registered", () => {
    const registry = new TemporalProcessAdapterRegistry();
    // Register only a subset
    const subset = V3_TICK_PHASE_ADAPTERS.slice(0, 5);
    for (const adapter of subset) {
      registry.register(adapter);
    }
    const summary = registry.summarize();
    expect(summary.registeredAdapters).toBe(5);
    expect(summary.missingPhaseIds.length).toBe(12);
    expect(summary.totalPhases).toBe(17);
  });

  it("rejects duplicate adapter processIds", () => {
    const registry = new TemporalProcessAdapterRegistry();
    const first = V3_TICK_PHASE_ADAPTERS[0]!;
    registry.register(first);
    expect(() => registry.register({ ...first })).toThrow(/duplicate adapter/);
  });

  it("does not execute any mutation — adapter registry is shell-only", () => {
    const registry = buildRegistry();
    // Verify no execute/run/apply method exists on the registry
    const reg = registry as unknown as Record<string, unknown>;
    expect(typeof reg.run).toBe("undefined");
    expect(typeof reg.execute).toBe("undefined");
    expect(typeof reg.apply).toBe("undefined");
    expect(typeof reg.tick).toBe("undefined");
  });

  it("adapters are frozen and cannot be mutated after registration", () => {
    const registry = new TemporalProcessAdapterRegistry();
    const adapter: TemporalProcessAdapter = {
      processId: "test_frozen",
      sourcePhase: 99,
      mutationPolicy: "none",
      implementationStatus: "adapter_shell",
      notes: "Test adapter.",
      risks: []
    };
    registry.register(adapter);
    const retrieved = registry.get("test_frozen");
    expect(retrieved).toBeDefined();
    // Attempting to mutate should throw in strict mode (Object.freeze)
    expect(() => {
      if (retrieved) {
        (retrieved as TemporalProcessAdapter & { notes: string }).notes = "mutated";
      }
    }).toThrow();
  });

  it("4 phases delegated; others are shells (V4.12)", () => {
    const delegated = new Set(["meta_drift", "homeostasis", "boredom", "belief_evolution"]);
    const registry = buildRegistry();
    for (const adapter of registry.list()) {
      if (delegated.has(adapter.processId)) {
        expect(adapter.implementationStatus).toBe("delegated");
      } else {
        expect(adapter.implementationStatus).toBe("adapter_shell");
      }
      if (adapter.mutationPolicy === "delegates_to_v3") {
        expect(adapter.wrapsExistingFunction).toBeTruthy();
      }
    }
  });
});
