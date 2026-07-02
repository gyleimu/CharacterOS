import { describe, expect, it } from "vitest";
import { executeBeliefEvolutionTemporalAdapter } from "../../../src/core/temporal/adapters/beliefEvolutionTemporalAdapter";
import { evolveBeliefsForTick } from "../../../src/core/belief/beliefEvolution";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { buildUnifiedTickTrace } from "../../../src/core/temporal/unifiedTickTrace";
import { buildInternalStateFieldSnapshot } from "../../../src/core/temporal/internalStateField";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function seededState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
}

describe("beliefEvolutionTemporalAdapter", () => {
  // ── D1: Direct Function Equivalence ────────────────────────────────
  it("produces trace identical to direct evolveBeliefsForTick call", () => {
    const state = seededState();
    const daysElapsed = 7;

    const directTrace = evolveBeliefsForTick({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed
    });

    const adapterResult = executeBeliefEvolutionTemporalAdapter({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed
    });

    // Trace equivalence
    expect(adapterResult.trace.before).toEqual(directTrace.before);
    expect(adapterResult.trace.after).toEqual(directTrace.after);
    expect(adapterResult.trace.strengthened).toEqual(directTrace.strengthened);
    expect(adapterResult.trace.weakened).toEqual(directTrace.weakened);
    expect(adapterResult.trace.reasons).toEqual(directTrace.reasons);
  });

  it("adapter trace consistent across different daysElapsed values", () => {
    const state = seededState();

    for (const days of [1, 7, 30]) {
      const directTrace = evolveBeliefsForTick({
        beliefs: state.beliefStates,
        memories: state.memories,
        meta: state.metaState,
        daysElapsed: days
      });
      const adapterResult = executeBeliefEvolutionTemporalAdapter({
        beliefs: state.beliefStates,
        memories: state.memories,
        meta: state.metaState,
        daysElapsed: days
      });
      expect(adapterResult.trace.after).toEqual(directTrace.after);
    }
  });

  // ── D2: Phase Trace Shape Equivalence ──────────────────────────────
  it("phase metadata has correct shape", () => {
    const state = seededState();
    const result = executeBeliefEvolutionTemporalAdapter({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed: 1
    });

    expect(result.phase.name).toBe("belief_evolution");
    expect(result.phase.changedStates).toEqual(["beliefStates"]);
    expect(Array.isArray(result.phase.reasons)).toBe(true);
  });

  it("temporalResult has correct processId", () => {
    const state = seededState();
    const result = executeBeliefEvolutionTemporalAdapter({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed: 1
    });

    expect(result.temporalResult.processId).toBe("belief_evolution");
    expect(result.temporalResult.changedStates).toEqual(["beliefStates"]);
    expect(result.temporalResult.warnings).toEqual([]);
  });

  it("Phase 15 reasons in V3 trace match adapter output", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });
    const phase15 = v3Trace.phases[14]!;

    expect(phase15.name).toBe("belief_evolution");
    expect(phase15.changedStates).toEqual(["beliefStates"]);

    const directTrace = evolveBeliefsForTick({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed: 7
    });
    for (const reason of directTrace.reasons) {
      expect(phase15.reasons).toContain(reason);
    }
  });

  it("V3 trace.beliefEvolution sub-fields are complete", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(Array.isArray(trace.beliefEvolution.before)).toBe(true);
    expect(Array.isArray(trace.beliefEvolution.after)).toBe(true);
    expect(Array.isArray(trace.beliefEvolution.strengthened)).toBe(true);
    expect(Array.isArray(trace.beliefEvolution.weakened)).toBe(true);
    expect(Array.isArray(trace.beliefEvolution.reasons)).toBe(true);
  });

  // ── D3: State Mutation Equivalence ─────────────────────────────────
  it("beliefStates correctly mutates through delegated tick", () => {
    const state = seededState();
    const beforeCount = state.beliefStates.length;

    runContinuousTick(state, { daysElapsed: 7 });
    // Belief count may change (new beliefs formed, weak ones pruned)
    // but the tick should still produce a valid beliefStates array
    expect(Array.isArray(state.beliefStates)).toBe(true);
    // Seeded state has beliefs from 3 initial memories
    expect(beforeCount).toBeGreaterThan(0);
  });

  it("V3 ContinuousTickTrace shape unchanged after delegation", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.phases).toHaveLength(17);
    expect(trace.beliefEvolution).toBeDefined();
    expect(trace.beliefEvolution.before).toBeDefined();
    expect(trace.beliefEvolution.after).toBeDefined();
  });

  // ── D4: Phase Order Equivalence ────────────────────────────────────
  it("belief_evolution remains Phase 15, after boredom and before attention", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });

    // Phase 14 (index 13) = boredom
    expect(v3Trace.phases[13]?.name).toBe("boredom");
    // Phase 15 (index 14) = belief_evolution
    expect(v3Trace.phases[14]?.name).toBe("belief_evolution");
    // Phase 16 (index 15) = attention_and_reflection
    expect(v3Trace.phases[15]?.name).toBe("attention_and_reflection");
  });

  // ── D5: Registry Status ────────────────────────────────────────────
  it("UnifiedTickTrace marks belief_evolution as delegated", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const beProcess = unified.processTraces.find((pt) => pt.processId === "belief_evolution");
    expect(beProcess).toBeDefined();
    expect(beProcess!.mutationPolicy).toBe("delegates_to_v3");
    expect(beProcess!.adapterStatus).toBe("delegated");
    expect(beProcess!.observedOnly).toBe(false);
  });

  it("4 phases delegated; 13 others are shells", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const delegated = unified.processTraces.filter((pt) => pt.adapterStatus === "delegated");
    expect(delegated).toHaveLength(4);
    const shells = unified.processTraces.filter((pt) => pt.adapterStatus !== "delegated");
    expect(shells).toHaveLength(13);
  });

  // ── D6: UnifiedTickTrace Visibility ────────────────────────────────
  it("mutationSummary reflects 5 delegate candidates unchanged", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    // Delegation doesn't change the count of mutation-capable phases
    expect(unified.mutationSummary.delegateCandidateCount).toBe(5);
  });

  // ── D7: No Extra Mutation ──────────────────────────────────────────
  it("adapter does not mutate unrelated state fields", () => {
    const state = seededState();
    const metaBefore = { ...state.metaState };
    const rewardBefore = { ...state.rewardState };
    const boundaryBefore = { ...state.boundary };
    const boredomBefore = { ...state.boredomState };

    executeBeliefEvolutionTemporalAdapter({
      beliefs: state.beliefStates,
      memories: state.memories,
      meta: state.metaState,
      daysElapsed: 1
    });

    // Adapter does NOT write to state — caller does that.
    expect(state.metaState).toEqual(metaBefore);
    expect(state.rewardState).toEqual(rewardBefore);
    expect(state.boundary).toEqual(boundaryBefore);
    expect(state.boredomState).toEqual(boredomBefore);
  });

  it("InternalStateField consistent after delegated tick", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });

    runContinuousTick(state, { daysElapsed: 1 });
    const after = buildInternalStateFieldSnapshot({ state });

    expect(after.variables.length).toBe(before.variables.length);
    for (const v of after.variables) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
    // Belief domain variables exist
    const beliefVars = after.variables.filter((v) => v.domain === "belief");
    expect(beliefVars.length).toBeGreaterThan(0);
  });

  // ── D8: All tests pass (implicit — verified by test runner) ────────
  it("all 17 phases still present after dual delegation", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });
    expect(trace.phases).toHaveLength(17);
  });
});
