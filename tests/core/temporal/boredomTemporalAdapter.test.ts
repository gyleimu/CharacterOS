import { describe, expect, it } from "vitest";
import { executeBoredomTemporalAdapter } from "../../../src/core/temporal/adapters/boredomTemporalAdapter";
import { updateBoredomForTick } from "../../../src/core/boredom/boredomSystem";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { buildUnifiedTickTrace } from "../../../src/core/temporal/unifiedTickTrace";
import { buildInternalStateFieldSnapshot } from "../../../src/core/temporal/internalStateField";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function freshState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: false });
}

function seededState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
}

describe("boredomTemporalAdapter", () => {
  // ── 1. Direct equivalence ─────────────────────────────────────────
  it("produces trace identical to direct updateBoredomForTick call", () => {
    const state = seededState();
    const daysElapsed = 7;

    const directTrace = updateBoredomForTick({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed
    });

    const adapterResult = executeBoredomTemporalAdapter({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed
    });

    // Adapter trace must be identical to direct call
    expect(adapterResult.trace.before).toEqual(directTrace.before);
    expect(adapterResult.trace.after).toEqual(directTrace.after);
    expect(adapterResult.trace.boredomDelta).toBe(directTrace.boredomDelta);
    expect(adapterResult.trace.explorationDrive).toBe(directTrace.explorationDrive);
    expect(adapterResult.trace.inspirationChance).toBe(directTrace.inspirationChance);
    expect(adapterResult.trace.restQuality).toBe(directTrace.restQuality);
    expect(adapterResult.trace.reasons).toEqual(directTrace.reasons);
  });

  it("phase metadata has correct shape", () => {
    const state = freshState();
    const result = executeBoredomTemporalAdapter({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed: 1
    });

    expect(result.phase.name).toBe("boredom");
    expect(result.phase.changedStates).toEqual(["boredomState"]);
    expect(Array.isArray(result.phase.reasons)).toBe(true);
  });

  it("inspiration field equivalence: adapter matches direct call", () => {
    const state = seededState();
    // Use a long tick to increase inspiration chance
    const daysElapsed = 30;

    const directTrace = updateBoredomForTick({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed
    });

    const adapterResult = executeBoredomTemporalAdapter({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed
    });

    // inspiration field must match (present or absent)
    if ("inspiration" in directTrace) {
      expect(adapterResult.trace.inspiration).toBeDefined();
      expect(adapterResult.trace.inspiration!.type).toBe(directTrace.inspiration!.type);
      expect(adapterResult.trace.inspiration!.intensity).toBe(directTrace.inspiration!.intensity);
    } else {
      expect(adapterResult.trace.inspiration).toBeUndefined();
    }
  });

  it("temporalResult has correct processId and changedStates", () => {
    const state = freshState();
    const result = executeBoredomTemporalAdapter({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed: 1
    });

    expect(result.temporalResult.processId).toBe("boredom");
    expect(result.temporalResult.changedStates).toEqual(["boredomState"]);
    expect(result.temporalResult.warnings).toEqual([]);
  });

  // ── 2. runContinuousTick equivalence ──────────────────────────────
  it("runContinuousTick still produces 17-phase trace after delegation", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });

    expect(v3Trace.phases).toHaveLength(17);
    // Phase 14 (index 13) should be "boredom"
    expect(v3Trace.phases[13]?.name).toBe("boredom");
  });

  it("boredomState correctly mutates through delegated tick", () => {
    const state = seededState();
    const boredomBefore = { ...state.boredomState };

    runContinuousTick(state, { daysElapsed: 7 });
    const boredomAfter = state.boredomState;

    // After a 7-day tick, boredom should have changed (either up or down)
    const changed =
      boredomAfter.boredomLevel !== boredomBefore.boredomLevel ||
      boredomAfter.stimulationNeed !== boredomBefore.stimulationNeed;
    expect(changed).toBe(true);
  });

  it("Phase 14 reasons in V3 trace match adapter phase reasons", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });
    const phase14 = v3Trace.phases[13]!;

    expect(phase14.name).toBe("boredom");
    expect(phase14.changedStates).toEqual(["boredomState"]);
    // Reasons should flow through from the adapter
    expect(phase14.reasons.length).toBeGreaterThan(0);
    // The reasons should match what updateBoredomForTick would produce
    const directTrace = updateBoredomForTick({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed: 7
    });
    // Phase 14 reasons should be a superset or equal to the direct trace reasons
    // (the adapter copies reasons exactly, so they should be equal)
    for (const reason of directTrace.reasons) {
      expect(phase14.reasons).toContain(reason);
    }
  });

  it("V3 ContinuousTickTrace shape unchanged after delegation", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    // All expected top-level fields present
    expect(trace.phases).toHaveLength(17);
    expect(typeof trace.daysElapsed).toBe("number");
    expect(typeof trace.memoryCount).toBe("number");
    expect(typeof trace.averageMemoryRecencyBefore).toBe("number");
    expect(typeof trace.averageMemoryRecencyAfter).toBe("number");
    expect(typeof trace.deepThinkingRecommended).toBe("boolean");
    expect(Array.isArray(trace.reasons)).toBe(true);
    // boredom field still present (now from adapter)
    expect(trace.boredom).toBeDefined();
    expect(trace.boredom.before).toBeDefined();
    expect(trace.boredom.after).toBeDefined();
  });

  // ── 3. UnifiedTickTrace reflects delegation ───────────────────────
  it("UnifiedTickTrace marks boredom as delegated (not observedOnly)", () => {
    const state = freshState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const boredomProcess = unified.processTraces.find((pt) => pt.processId === "boredom");
    expect(boredomProcess).toBeDefined();
    expect(boredomProcess!.mutationPolicy).toBe("delegates_to_v3");
    // After V4.7, boredom adapter is "delegated", not "adapter_shell"
    expect(boredomProcess!.adapterStatus).toBe("delegated");
    // observedOnly should be false for a delegated process
    expect(boredomProcess!.observedOnly).toBe(false);
  });

  it("other 13 phases are still not delegated (4 are delegated now)", () => {
    const state = freshState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const delegated = new Set(["meta_drift", "homeostasis", "boredom", "belief_evolution"]);
    const nonDelegated = unified.processTraces.filter((pt) => !delegated.has(pt.processId));
    expect(nonDelegated).toHaveLength(13);
    for (const pt of nonDelegated) {
      expect(pt.adapterStatus).not.toBe("delegated");
      expect(pt.observedOnly).toBe(true);
    }
  });

  // ── 4. No extra mutation ─────────────────────────────────────────
  it("only boredomState is written by the boredom adapter (no extra mutation)", () => {
    const state = seededState();

    // Snapshot all state fields that boredom does NOT touch
    const metaBefore = { ...state.metaState };
    const rewardBefore = { ...state.rewardState };
    const boundaryBefore = { ...state.boundary };
    const homeostasisBefore = { ...state.homeostasisState };
    const coordBefore = { ...state.coordinate.values };

    // Run boredom adapter directly
    const result = executeBoredomTemporalAdapter({
      boredom: state.boredomState,
      meta: state.metaState,
      reward: state.rewardState,
      boundary: state.boundary,
      daysElapsed: 1
    });

    // Adapter does NOT write to state — caller does that.
    // Verify adapter result doesn't mutate the passed objects.
    expect(state.metaState).toEqual(metaBefore);
    expect(state.rewardState).toEqual(rewardBefore);
    expect(state.boundary).toEqual(boundaryBefore);
    expect(state.homeostasisState).toEqual(homeostasisBefore);
    expect(state.coordinate.values).toEqual(coordBefore);
  });

  it("V3 trace.boredom has all expected sub-fields from adapter", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.boredom.before.boredomLevel).toBeDefined();
    expect(trace.boredom.before.stimulationNeed).toBeDefined();
    expect(trace.boredom.after.boredomLevel).toBeDefined();
    expect(trace.boredom.after.stimulationNeed).toBeDefined();
    expect(typeof trace.boredom.boredomDelta).toBe("number");
    expect(typeof trace.boredom.explorationDrive).toBe("number");
    expect(typeof trace.boredom.inspirationChance).toBe("number");
    expect(typeof trace.boredom.restQuality).toBe("number");
    expect(Array.isArray(trace.boredom.reasons)).toBe(true);
  });

  // ── 5. InternalStateField consistency ─────────────────────────────
  it("InternalStateField before/after tick still consistent after delegation", () => {
    const state = seededState();
    const before = buildInternalStateFieldSnapshot({ state });

    runContinuousTick(state, { daysElapsed: 1 });
    const after = buildInternalStateFieldSnapshot({ state });

    // Variable count stable
    expect(after.variables.length).toBe(before.variables.length);
    // All normalized values in range
    for (const v of after.variables) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
    // Boredom domain variables exist
    const boredomVars = after.variables.filter((v) => v.domain === "boredomState");
    expect(boredomVars).toHaveLength(5);
  });
});
