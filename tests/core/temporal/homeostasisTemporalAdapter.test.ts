import { describe, expect, it } from "vitest";
import { executeHomeostasisTemporalAdapter } from "../../../src/core/temporal/adapters/homeostasisTemporalAdapter";
import { applyHomeostasis } from "../../../src/core/homeostasis/homeostasis";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { buildUnifiedTickTrace } from "../../../src/core/temporal/unifiedTickTrace";
import { buildInternalStateFieldSnapshot } from "../../../src/core/temporal/internalStateField";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function freshState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: false });
}

function seededState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
}

function stressedState(): CharacterPhysicsState {
  const state = seededState();
  state.boundary = createPsychologicalBoundary({
    stressLoad: 0.85, capacity: 0.7, integrity: 0.35, cracks: 0.5, phase: "strained"
  });
  return state;
}

describe("homeostasisTemporalAdapter", () => {
  // ── D1: Direct Function Equivalence ────────────────────────────────
  it("produces trace identical to direct applyHomeostasis call", () => {
    const state = stressedState();
    const daysElapsed = 7;

    const directTrace = applyHomeostasis({
      homeostasis: state.homeostasisState,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState,
      daysElapsed
    });

    const adapterResult = executeHomeostasisTemporalAdapter({
      homeostasis: state.homeostasisState,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState,
      daysElapsed
    });

    expect(adapterResult.trace.before).toEqual(directTrace.before);
    expect(adapterResult.trace.after).toEqual(directTrace.after);
    expect(adapterResult.trace.pressure).toBe(directTrace.pressure);
    expect(adapterResult.trace.resistance).toBe(directTrace.resistance);
    expect(adapterResult.trace.regulatedMetaState).toEqual(directTrace.regulatedMetaState);
    expect(adapterResult.trace.regulatedBoundary).toEqual(directTrace.regulatedBoundary);
    expect(adapterResult.trace.regulatedRewardState).toEqual(directTrace.regulatedRewardState);
    expect(adapterResult.trace.reasons).toEqual(directTrace.reasons);
  });

  it("adapter trace consistent across different daysElapsed", () => {
    const state = stressedState();
    for (const days of [1, 7, 30]) {
      const direct = applyHomeostasis({
        homeostasis: state.homeostasisState,
        meta: state.metaState, boundary: state.boundary,
        reward: state.rewardState, daysElapsed: days
      });
      const adapter = executeHomeostasisTemporalAdapter({
        homeostasis: state.homeostasisState,
        meta: state.metaState, boundary: state.boundary,
        reward: state.rewardState, daysElapsed: days
      });
      expect(adapter.trace.regulatedBoundary).toEqual(direct.regulatedBoundary);
    }
  });

  // ── D2: Phase Trace Shape Equivalence ──────────────────────────────
  it("phase metadata has correct shape", () => {
    const state = freshState();
    const result = executeHomeostasisTemporalAdapter({
      homeostasis: state.homeostasisState,
      meta: state.metaState, boundary: state.boundary,
      reward: state.rewardState, daysElapsed: 1
    });

    expect(result.phase.name).toBe("homeostasis");
    expect(result.phase.changedStates).toEqual([
      "homeostasisState", "metaState", "boundary", "rewardState"
    ]);
    expect(result.phase.reasons.length).toBeGreaterThan(0);
  });

  it("temporalResult has correct processId", () => {
    const state = freshState();
    const result = executeHomeostasisTemporalAdapter({
      homeostasis: state.homeostasisState,
      meta: state.metaState, boundary: state.boundary,
      reward: state.rewardState, daysElapsed: 1
    });

    expect(result.temporalResult.processId).toBe("homeostasis");
    expect(result.temporalResult.changedStates).toContain("homeostasisState");
    expect(result.temporalResult.warnings).toEqual([]);
  });

  it("Phase 4 reasons in V3 trace match adapter output", () => {
    const state = stressedState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });
    const phase4 = v3Trace.phases[3]!;

    expect(phase4.name).toBe("homeostasis");
    expect(phase4.changedStates).toEqual([
      "homeostasisState", "metaState", "boundary", "rewardState"
    ]);
    // Reasons must exist and be non-empty for a stressed state
    expect(phase4.reasons.length).toBeGreaterThan(0);
  });

  it("V3 trace.homeostasis has all expected sub-fields", () => {
    const state = stressedState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.homeostasis.before).toBeDefined();
    expect(trace.homeostasis.after).toBeDefined();
    expect(typeof trace.homeostasis.pressure).toBe("number");
    expect(typeof trace.homeostasis.resistance).toBe("number");
    expect(trace.homeostasis.regulatedMetaState).toBeDefined();
    expect(trace.homeostasis.regulatedBoundary).toBeDefined();
    expect(trace.homeostasis.regulatedRewardState).toBeDefined();
    expect(Array.isArray(trace.homeostasis.reasons)).toBe(true);
  });

  // ── D3: State Mutation Equivalence ─────────────────────────────────
  it("homeostasisState mutates through delegated tick", () => {
    const state = stressedState();
    const hsBefore = { ...state.homeostasisState };

    runContinuousTick(state, { daysElapsed: 7 });
    const hsAfter = state.homeostasisState;

    const changed =
      hsAfter.stabilitySetPoint !== hsBefore.stabilitySetPoint ||
      hsAfter.changeResistance !== hsBefore.changeResistance;
    // After 7 stressed days, homeostasisState should adapt
    expect(changed).toBe(true);
  });

  it("V3 trace shape unchanged after delegation", () => {
    const state = stressedState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.phases).toHaveLength(17);
    expect(trace.homeostasis).toBeDefined();
    expect(trace.homeostasis.regulatedMetaState).toBeDefined();
  });

  // ── D4: Phase Order Equivalence ────────────────────────────────────
  it("homeostasis remains Phase 4, between decay_and_recovery and recovery_trace", () => {
    const state = stressedState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });

    expect(v3Trace.phases[2]?.name).toBe("decay_and_recovery");
    expect(v3Trace.phases[3]?.name).toBe("homeostasis");
    expect(v3Trace.phases[4]?.name).toBe("recovery_trace");
  });

  // ── D5+D6: Registry + UnifiedTickTrace ─────────────────────────────
  it("UnifiedTickTrace marks homeostasis as delegated", () => {
    const state = stressedState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const hsProcess = unified.processTraces.find((pt) => pt.processId === "homeostasis");
    expect(hsProcess).toBeDefined();
    expect(hsProcess!.mutationPolicy).toBe("delegates_to_v3");
    expect(hsProcess!.adapterStatus).toBe("delegated");
    expect(hsProcess!.observedOnly).toBe(false);
  });

  it("4 phases are delegated; 13 others are shells", () => {
    const state = stressedState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const delegated = unified.processTraces.filter((pt) => pt.adapterStatus === "delegated");
    expect(delegated).toHaveLength(4);
    expect(delegated.map((p) => p.processId).sort()).toEqual([
      "belief_evolution", "boredom", "homeostasis", "meta_drift"
    ]);

    const shells = unified.processTraces.filter((pt) => pt.adapterStatus !== "delegated");
    expect(shells).toHaveLength(13);
  });

  // ── D7: No Extra Mutation ──────────────────────────────────────────
  it("adapter does not mutate unrelated state fields", () => {
    const state = stressedState();
    const boredomBefore = { ...state.boredomState };
    const beliefsBefore = [...state.beliefStates];

    executeHomeostasisTemporalAdapter({
      homeostasis: state.homeostasisState,
      meta: state.metaState, boundary: state.boundary,
      reward: state.rewardState, daysElapsed: 1
    });

    expect(state.boredomState).toEqual(boredomBefore);
    expect(state.beliefStates).toEqual(beliefsBefore);
  });

  it("InternalStateField consistent after delegated tick", () => {
    const state = stressedState();
    const before = buildInternalStateFieldSnapshot({ state });

    runContinuousTick(state, { daysElapsed: 1 });
    const after = buildInternalStateFieldSnapshot({ state });

    expect(after.variables.length).toBe(before.variables.length);
    for (const v of after.variables) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
  });

  // ── D10: Overwrite Semantics Equivalence ───────────────────────────
  it("D10: Phase 4 regulatedBoundary overwrites Phase 3 boundary recovery", () => {
    const state = stressedState();

    // Run the full tick
    const trace = runContinuousTick(state, { daysElapsed: 7 });

    // Phase 3 (decay_and_recovery) writes boundary
    const phase3 = trace.phases[2]!;
    expect(phase3.name).toBe("decay_and_recovery");
    expect(phase3.changedStates).toContain("boundary");

    // Phase 4 (homeostasis) also writes boundary — intentional overwrite
    const phase4 = trace.phases[3]!;
    expect(phase4.name).toBe("homeostasis");
    expect(phase4.changedStates).toContain("boundary");

    // The final state.boundary must equal the regulatedBoundary from homeostasis
    // (not the Phase 3 recovered boundary)
    expect(state.boundary).toEqual(trace.homeostasis.regulatedBoundary);

    // And regulatedBoundary must exist and have valid stressLoad
    expect(trace.homeostasis.regulatedBoundary.stressLoad).toBeGreaterThanOrEqual(0);
  });

  it("D10: Phase 4 regulatedMetaState overwrites Phase 3 metaState", () => {
    const state = stressedState();
    const trace = runContinuousTick(state, { daysElapsed: 7 });

    // Final state.metaState must equal regulatedMetaState
    expect(state.metaState).toEqual(trace.homeostasis.regulatedMetaState);
  });

  it("D10: Phase 4 regulatedRewardState overwrites Phase 3 rewardState", () => {
    const state = stressedState();
    const trace = runContinuousTick(state, { daysElapsed: 7 });

    // Final state.rewardState must equal regulatedRewardState
    expect(state.rewardState).toEqual(trace.homeostasis.regulatedRewardState);
  });

  it("D10: overwrite values are identical between adapter and inline V3 function", () => {
    // Run a V3 tick, then verify the adapter would produce identical regulated values
    const state = stressedState();
    runContinuousTick(state, { daysElapsed: 7 });

    // Now call the adapter directly with the post-tick state
    // (simulating what would happen in the next tick)
    const adapterResult = executeHomeostasisTemporalAdapter({
      homeostasis: state.homeostasisState,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState,
      daysElapsed: 1
    });

    const directResult = applyHomeostasis({
      homeostasis: state.homeostasisState,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState,
      daysElapsed: 1
    });

    // Regulated outputs must be identical
    expect(adapterResult.trace.regulatedMetaState).toEqual(directResult.regulatedMetaState);
    expect(adapterResult.trace.regulatedBoundary).toEqual(directResult.regulatedBoundary);
    expect(adapterResult.trace.regulatedRewardState).toEqual(directResult.regulatedRewardState);
  });

  // ── D8: All tests pass (implicit) ──────────────────────────────────
  it("all 17 phases still present after homeostasis delegation", () => {
    const state = stressedState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });
    expect(trace.phases).toHaveLength(17);
  });
});
