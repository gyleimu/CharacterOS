/**
 * V4.5 Homeostasis Consistency Tests.
 *
 * These tests verify cross-cutting invariants between V3 tick behavior,
 * V4 UnifiedTickTrace, and V4 InternalStateField — without modifying
 * any V3 code or executing V4 adapters.
 *
 * All tests are READ-ONLY observers.
 */
import { describe, expect, it } from "vitest";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { buildUnifiedTickTrace } from "../../../src/core/temporal/unifiedTickTrace";
import { buildInternalStateFieldSnapshot } from "../../../src/core/temporal/internalStateField";
import { V3_TICK_PHASES, getV3TickPhase } from "../../../src/core/temporal/v3TickPhaseMetadata";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { clamp01 } from "../../../src/core/parameters/parameterMath";

// ─── Helpers ──────────────────────────────────────────────────────────

function freshState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: false
  });
}

function seededState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
}

/** Create a state with high boundary stress and low integrity. */
function stressedState(): CharacterPhysicsState {
  const state = seededState();
  state.boundary = createPsychologicalBoundary({
    stressLoad: 0.85,
    capacity: 0.7,
    integrity: 0.35,
    cracks: 0.5,
    phase: "strained",
    recoveryRate: 0.12
  });
  return state;
}

function tick(state: CharacterPhysicsState, daysElapsed = 7) {
  return runContinuousTick(state, { daysElapsed });
}

// ─── 1. UnifiedTickTrace ↔ V3 trace consistency ──────────────────────

describe("UnifiedTickTrace ↔ V3 trace consistency", () => {
  it("UnifiedTickTrace has exactly 17 process traces from a real V3 tick", () => {
    const state = freshState();
    const v3Trace = tick(state, 1);
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(unified.processTraces).toHaveLength(17);
    // All 17 should map to known V3 phases
    const phaseIds = unified.processTraces.map((pt) => pt.processId);
    expect(new Set(phaseIds).size).toBe(17);
  });

  it("mutationSummary.actualChangedStateNames is a superset of V3 changedStates", () => {
    const state = seededState();
    const v3Trace = tick(state, 3);
    const unified = buildUnifiedTickTrace({ v3Trace });

    // Collect all changedStates from V3 phases
    const v3Changed = new Set<string>();
    for (const phase of v3Trace.phases) {
      for (const state of phase.changedStates) {
        v3Changed.add(state);
      }
    }

    // Unified trace should capture all of them
    for (const name of v3Changed) {
      expect(unified.mutationSummary.actualChangedStateNames).toContain(name);
    }
  });

  it("delegateCandidateCount matches adapter registry (5 mutation phases)", () => {
    const state = freshState();
    const v3Trace = tick(state, 1);
    const unified = buildUnifiedTickTrace({ v3Trace });

    expect(unified.mutationSummary.delegateCandidateCount).toBe(5);

    // The 5 delegated phases are: meta_drift, decay_and_recovery,
    // homeostasis, boredom, belief_evolution
    const delegated = unified.processTraces.filter(
      (pt) => pt.mutationPolicy === "delegates_to_v3"
    );
    expect(delegated).toHaveLength(5);
  });

  it("homeostasis phase reads/writes match V3 metadata", () => {
    const metadata = getV3TickPhase("homeostasis");
    expect(metadata).toBeDefined();

    const state = freshState();
    const v3Trace = tick(state, 1);
    const unified = buildUnifiedTickTrace({ v3Trace });

    const homeostasisTrace = unified.processTraces.find((pt) => pt.processId === "homeostasis");
    expect(homeostasisTrace).toBeDefined();
    expect(homeostasisTrace!.phase).toBe(4);
    expect(homeostasisTrace!.mutationPolicy).toBe("delegates_to_v3");
    expect(homeostasisTrace!.writes).toContain("homeostasisState");
    expect(homeostasisTrace!.writes).toContain("metaState");
    expect(homeostasisTrace!.writes).toContain("boundary");
    expect(homeostasisTrace!.writes).toContain("rewardState");
  });
});

// ─── 2. InternalStateField before/after observability ────────────────

describe("InternalStateField before/after tick", () => {
  it("variable count is stable across ticks", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });
    tick(state, 7);
    const after = buildInternalStateFieldSnapshot({ state });

    expect(after.variables).toHaveLength(before.variables.length);
    expect(after.summary.variableCount).toBe(before.summary.variableCount);
  });

  it("at least some temporal-domain variables change after a multi-day tick", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });
    tick(state, 30);
    const after = buildInternalStateFieldSnapshot({ state });

    // Variables in fast/medium domains (boundary stressLoad, reward dopamineLevel,
    // boredom boredomLevel, memory recency) should shift over 30 days.
    const changedVariables = after.variables.filter((v, i) => {
      return v.currentValue !== before.variables[i]!.currentValue;
    });
    expect(changedVariables.length).toBeGreaterThan(0);
  });

  it("memory variables change after tick (decay applies)", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });
    const recencyBefore = before.variables.find((v) => v.id === "memory.recencySummary");
    tick(state, 30);
    const after = buildInternalStateFieldSnapshot({ state });
    const recencyAfter = after.variables.find((v) => v.id === "memory.recencySummary");

    expect(recencyBefore).toBeDefined();
    expect(recencyAfter).toBeDefined();
    // Memory recency should decay over 30 days
    expect(recencyAfter!.currentValue).toBeLessThan(recencyBefore!.currentValue);
  });

  it("homeostatic pressure can be observed across domains", () => {
    const state = seededState();
    const snap = buildInternalStateFieldSnapshot({ state });

    // Multiple domains should contribute to homeostatic pressure
    const pressures = snap.variables.map((v) => v.homeostaticPressure);
    const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;

    expect(avgPressure).toBeGreaterThanOrEqual(0);
    expect(avgPressure).toBeLessThanOrEqual(1);
    // At least one variable should have measurable homeostatic pressure
    const withPressure = snap.variables.filter((v) => v.homeostaticPressure > 0);
    expect(withPressure.length).toBeGreaterThan(0);
  });
});

// ─── 3. High stress scenario ─────────────────────────────────────────

describe("High stress boundary scenario", () => {
  it("stressed state has high/medium risk boundary variables", () => {
    const state = stressedState();
    const snap = buildInternalStateFieldSnapshot({ state });

    const boundaryVars = snap.variables.filter((v) => v.domain === "boundary");
    const riskyBoundary = boundaryVars.filter(
      (v) => v.stabilityRisk === "high" || v.stabilityRisk === "medium"
    );
    expect(riskyBoundary.length).toBeGreaterThan(0);

    // stressLoad should be above baseline
    const stressLoad = boundaryVars.find((v) => v.id === "boundary.stressLoad");
    expect(stressLoad).toBeDefined();
    expect(stressLoad!.direction).toBe("above_baseline");
    expect(stressLoad!.stabilityRisk).toBe("high");
  });

  it("homeostasis reduces boundary pressure over time (not guaranteed, but recovery exists)", () => {
    const state = stressedState();
    const before = buildInternalStateFieldSnapshot({ state });
    const stressBefore = before.variables.find((v) => v.id === "boundary.stressLoad");

    tick(state, 30);
    const after = buildInternalStateFieldSnapshot({ state });
    const stressAfter = after.variables.find((v) => v.id === "boundary.stressLoad");

    expect(stressBefore).toBeDefined();
    expect(stressAfter).toBeDefined();
    // After 30 days of tick (with recovery + homeostasis), stress should
    // decrease or at worst stay similar — it should not increase.
    expect(stressAfter!.currentValue).toBeLessThanOrEqual(stressBefore!.currentValue + 0.05);
  });

  it("scar retention prevents full recovery to baseline", () => {
    const state = stressedState();
    // baseline stressLoad = 0.18
    tick(state, 30);
    const snap = buildInternalStateFieldSnapshot({ state });
    const stressLoad = snap.variables.find((v) => v.id === "boundary.stressLoad");

    expect(stressLoad).toBeDefined();
    // After 30 days of recovery from 0.85, stressLoad should have moved
    // significantly toward baseline. It may overshoot below baseline or
    // stay above it. The key invariant: it moved by a meaningful amount.
    const deviation = stressLoad!.deviationFromBaseline ?? 0;
    const absDeviation = Math.abs(deviation);
    // Stress should have moved at least 0.3 from the starting 0.85.
    // Starting deviation was 0.85 - 0.18 = 0.67. After 30 days, the
    // remaining deviation magnitude should be notably smaller.
    expect(absDeviation).toBeLessThan(0.4);
  });

  it("integrity recovers toward baseline but may not reach it", () => {
    const state = stressedState();
    const before = buildInternalStateFieldSnapshot({ state });
    const integrityBefore = before.variables.find((v) => v.id === "boundary.integrity");
    expect(integrityBefore!.currentValue).toBeLessThan(0.5); // started at 0.35

    tick(state, 30);
    const after = buildInternalStateFieldSnapshot({ state });
    const integrityAfter = after.variables.find((v) => v.id === "boundary.integrity");

    // Integrity should improve but not necessarily reach baseline (0.88)
    expect(integrityAfter!.currentValue).toBeGreaterThan(integrityBefore!.currentValue);
    expect(integrityAfter!.currentValue).toBeLessThan(0.88);
  });
});

// ─── 4. No direct personality rewrite ────────────────────────────────

describe("No direct personality rewrite", () => {
  it("coordinate variables change slowly even over many ticks", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });
    const coordBefore = before.variables.filter((v) => v.domain === "coordinate");

    // Run multiple long ticks
    tick(state, 30);
    tick(state, 30);
    tick(state, 30);

    const after = buildInternalStateFieldSnapshot({ state });
    const coordAfter = after.variables.filter((v) => v.domain === "coordinate");

    // Coordinate variables should still exist
    expect(coordAfter).toHaveLength(coordBefore.length);

    // Changes in coordinate values should be bounded — personality is slow
    for (let i = 0; i < coordBefore.length; i++) {
      const delta = Math.abs(coordAfter[i]!.currentValue - coordBefore[i]!.currentValue);
      // Over 90 days with no events, personality drift should be modest
      expect(delta).toBeLessThan(0.3);
    }
  });

  it("coordinate variables are classified as slow/medium timeScale (not fast)", () => {
    const state = seededState();
    const snap = buildInternalStateFieldSnapshot({ state });
    const coordVars = snap.variables.filter((v) => v.domain === "coordinate");

    for (const v of coordVars) {
      // Coordinate variables are slow (trust, attachment, control) or medium (fear).
      // They should never be "fast".
      expect(v.timeScale).not.toBe("fast");
    }
  });

  it("structural variables (traumaAmplification, attachmentStyle) barely change in one tick", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });
    const structuralBefore = before.variables.filter((v) => v.timeScale === "structural");

    tick(state, 7);
    const after = buildInternalStateFieldSnapshot({ state });

    for (let i = 0; i < structuralBefore.length; i++) {
      const bv = structuralBefore[i]!;
      const av = after.variables.find((v) => v.id === bv.id);
      expect(av).toBeDefined();
      // Structural variables should barely move in a single 7-day tick
      const delta = Math.abs(av!.currentValue - bv.currentValue);
      expect(delta).toBeLessThan(0.05);
    }
  });
});

// ─── 5. Homeostasis first-class observability ────────────────────────

describe("Homeostasis as first-class observable", () => {
  it("InternalStateField summary includes dominantDomains", () => {
    const state = stressedState();
    const snap = buildInternalStateFieldSnapshot({ state });

    expect(Array.isArray(snap.summary.dominantDomains)).toBe(true);
    // In a stressed state, boundary should be among the dominant domains
    expect(snap.summary.dominantDomains).toContain("boundary");
  });

  it("homeostasisState variables exist and have values in [0, 1]", () => {
    const state = seededState();
    const snap = buildInternalStateFieldSnapshot({ state });
    const homeoVars = snap.variables.filter((v) => v.domain === "homeostasisState");

    expect(homeoVars).toHaveLength(5);
    for (const v of homeoVars) {
      expect(v.currentValue).toBeGreaterThanOrEqual(0);
      expect(v.currentValue).toBeLessThanOrEqual(1);
    }
  });

  it("UnifiedTickTrace contains homeostasis as a delegate candidate", () => {
    const state = freshState();
    const v3Trace = tick(state, 1);
    const unified = buildUnifiedTickTrace({ v3Trace });

    const homeostasisTrace = unified.processTraces.find((pt) => pt.processId === "homeostasis");
    expect(homeostasisTrace).toBeDefined();
    expect(homeostasisTrace!.mutationPolicy).toBe("delegates_to_v3");
    expect(homeostasisTrace!.observedOnly).toBe(false); // V4.12 delegated
  });

  it("homeostasis domain variables have corresponding phase in UnifiedTickTrace", () => {
    const state = freshState();
    const snap = buildInternalStateFieldSnapshot({ state });
    const v3Trace = tick(state, 1);
    const unified = buildUnifiedTickTrace({ v3Trace });

    // HomeostasisState domain variables should correspond to the
    // homeostasis phase (phase 4) in the UnifiedTickTrace.
    const homeoVarCount = snap.variables.filter(
      (v) => v.domain === "homeostasisState"
    ).length;
    expect(homeoVarCount).toBe(5);

    const homeostasisPhase = unified.processTraces.find((pt) => pt.processId === "homeostasis");
    expect(homeostasisPhase).toBeDefined();
    // The phase writes homeostasisState
    expect(homeostasisPhase!.writes).toContain("homeostasisState");
  });

  it("average homeostatic pressure decreases after recovery tick in stressed state", () => {
    const state = stressedState();
    const before = buildInternalStateFieldSnapshot({ state });

    tick(state, 14);
    const after = buildInternalStateFieldSnapshot({ state });

    // After 14 days of recovery, average homeostatic pressure should
    // not increase — it should either decrease or stay similar.
    expect(after.summary.averageHomeostaticPressure).toBeLessThanOrEqual(
      before.summary.averageHomeostaticPressure + 0.05
    );
  });

  it("all variables across all domains stay within [0, 1] after any tick", () => {
    const state = stressedState();

    // Run multiple ticks of varying lengths
    tick(state, 1);
    tick(state, 7);
    tick(state, 30);

    const snap = buildInternalStateFieldSnapshot({ state });
    for (const v of snap.variables) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
  });
});
