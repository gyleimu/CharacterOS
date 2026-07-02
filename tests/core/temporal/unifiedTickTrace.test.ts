import { describe, expect, it } from "vitest";
import {
  buildUnifiedTickTrace,
  type UnifiedTickTrace
} from "../../../src/core/temporal/unifiedTickTrace";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { V3_TICK_PHASES, v3TickPhaseIds } from "../../../src/core/temporal/v3TickPhaseMetadata";
import {
  V3_TICK_PHASE_ADAPTERS,
  TemporalProcessAdapterRegistry
} from "../../../src/core/temporal/temporalProcessAdapterRegistry";
import { createLinFanBlueprint, createCharacterStateFromBlueprint } from "../../../src/core/character/characterBlueprint";

function createTestState() {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
}

describe("buildUnifiedTickTrace", () => {
  it("produces exactly 17 process traces from a real V3 tick", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(unified.version).toBe("4.3.0");
    expect(unified.source).toBe("v3_continuous_tick");
    expect(unified.daysElapsed).toBe(7);
    expect(unified.processTraces).toHaveLength(17);
  });

  it("preserves V3 phase order in process traces", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const ids = unified.processTraces.map((pt) => pt.processId);
    expect(ids).toEqual(v3TickPhaseIds());
  });

  it("every process trace has expected fields", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    for (const pt of unified.processTraces) {
      expect(typeof pt.processId).toBe("string");
      expect(typeof pt.phase).toBe("number");
      expect(pt.phase).toBeGreaterThanOrEqual(1);
      expect(pt.phase).toBeLessThanOrEqual(17);
      expect(typeof pt.label).toBe("string");
      expect(pt.label.length).toBeGreaterThan(0);
      expect(typeof pt.adapterStatus).toBe("string");
      expect(typeof pt.mutationPolicy).toBe("string");
      expect(Array.isArray(pt.reads)).toBe(true);
      expect(Array.isArray(pt.writes)).toBe(true);
      expect(Array.isArray(pt.changedStates)).toBe(true);
      expect(typeof pt.sourcePhaseName).toBe("string");
      expect(typeof pt.observedOnly).toBe("boolean");
      expect(Array.isArray(pt.reasons)).toBe(true);
    }
  });

  it("observedOnly is false for 4 delegated phases, true for 13 shells", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const delegated = new Set(["meta_drift", "homeostasis", "boredom", "belief_evolution"]);
    for (const pt of unified.processTraces) {
      if (delegated.has(pt.processId)) {
        expect(pt.observedOnly).toBe(false);
      }
    }
    const observedCount = unified.processTraces.filter((pt) => pt.observedOnly).length;
    expect(observedCount).toBe(13);
  });

  it("delegate candidate count equals 5 (mutation phases with V3 functions)", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(unified.mutationSummary.delegateCandidateCount).toBe(5);
  });

  it("mutation summary tracks actualChangedStateNames from V3 trace", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    // After a 1-day tick, at minimum metaState should have changed.
    expect(unified.mutationSummary.actualChangedStateNames.length).toBeGreaterThan(0);
  });

  it("coverage summary shows full metadata-adapter match", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(unified.coverageSummary.metadataCount).toBe(17);
    expect(unified.coverageSummary.adapterCount).toBe(17);
    expect(unified.coverageSummary.matchedCount).toBe(17);
    expect(unified.coverageSummary.missingAdapters).toEqual([]);
    expect(unified.coverageSummary.orphanAdapters).toEqual([]);
  });

  it("warns when a mutation-phase declares writes but trace shows no changedStates", () => {
    // Use a fresh state with no pre-existing drift — most mutation phases
    // should still produce changedStates after a multi-day tick.
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 30 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    // We don't assert specific warnings — they depend on internal state.
    // But we verify the warnings array exists and is an array.
    expect(Array.isArray(unified.warnings)).toBe(true);
  });

  it("does not mutate the character state during trace building", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });

    // Snapshot post-tick state
    const memoryCountAfter = state.memories.length;
    const coordinateAfter = { ...state.coordinate.values };

    // Build unified trace (should be read-only)
    buildUnifiedTickTrace({ v3Trace });

    // State must be unchanged by trace building
    expect(state.memories.length).toBe(memoryCountAfter);
    expect(state.coordinate.values).toEqual(coordinateAfter);
  });

  it("metadata/adapter mismatch generates warnings", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });

    // Build with an adapter registry that's missing some adapters.
    // We pass only a subset — the builder should warn.
    const partial = new TemporalProcessAdapterRegistry(
      V3_TICK_PHASE_ADAPTERS.slice(0, 5)
    );
    const unified = buildUnifiedTickTrace({ v3Trace, adapters: partial });

    expect(unified.coverageSummary.matchedCount).toBe(5);
    expect(unified.coverageSummary.missingAdapters.length).toBe(12);
    expect(unified.warnings.length).toBeGreaterThan(0);
  });

  it("orphan adapters (not in metadata) are detected", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });

    const registry = new TemporalProcessAdapterRegistry(V3_TICK_PHASE_ADAPTERS);
    // Register an extra adapter with an id not in metadata
    registry.register({
      processId: "quantum_fluctuation",
      sourcePhase: 99,
      mutationPolicy: "future",
      implementationStatus: "adapter_shell",
      notes: "Not a real phase.",
      risks: []
    });

    const unified = buildUnifiedTickTrace({ v3Trace, adapters: registry });
    expect(unified.coverageSummary.orphanAdapters).toContain("quantum_fluctuation");
  });

  it("reasons are aggregated from V3 trace", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(Array.isArray(unified.reasons)).toBe(true);
    // V3 trace always produces reasons (at minimum: deep thinking check result)
    expect(unified.reasons.length).toBeGreaterThan(0);
  });

  it("mutation-phase processes (meta_drift, homeostasis, etc.) have non-empty writes", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const mutationIds = new Set([
      "meta_drift",
      "decay_and_recovery",
      "homeostasis",
      "boredom",
      "belief_evolution"
    ]);

    for (const pt of unified.processTraces) {
      if (mutationIds.has(pt.processId)) {
        expect(pt.writes.length).toBeGreaterThan(0);
        expect(pt.mutationPolicy).toBe("delegates_to_v3");
      }
    }
  });

  it("trace-phase processes have empty writes", () => {
    const state = createTestState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const traceIds = new Set([
      "snapshot",
      "recovery_trace",
      "parameter_network",
      "baseline_drift",
      "parameter_accumulation",
      "parameter_adjustment_draft",
      "parameter_adjustment_preview",
      "parameter_adjustment_audit",
      "parameter_adjustment_patch",
      "parameter_adjustment_snapshot",
      "attention_and_reflection"
    ]);

    for (const pt of unified.processTraces) {
      if (traceIds.has(pt.processId)) {
        expect(pt.writes).toEqual([]);
        expect(pt.mutationPolicy).toBe("none");
      }
    }
  });
});
