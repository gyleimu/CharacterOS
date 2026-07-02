import { describe, expect, it } from "vitest";
import { executeMetaDriftTemporalAdapter } from "../../../src/core/temporal/adapters/metaDriftTemporalAdapter";
import { updateMetaStateForTick } from "../../../src/core/meta/metaState";
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

describe("metaDriftTemporalAdapter", () => {
  // ── D1: Direct Function Equivalence ────────────────────────────────
  it("produces trace identical to direct updateMetaStateForTick call", () => {
    const state = seededState();
    const daysElapsed = 7;
    const stressLoad = state.boundary.stressLoad;
    const boundaryIntegrity = state.boundary.integrity;

    const directTrace = updateMetaStateForTick({
      meta: state.metaState,
      daysElapsed,
      stressLoad,
      boundaryIntegrity
    });

    const adapterResult = executeMetaDriftTemporalAdapter({
      meta: state.metaState,
      daysElapsed,
      stressLoad,
      boundaryIntegrity
    });

    expect(adapterResult.trace.before).toEqual(directTrace.before);
    expect(adapterResult.trace.after).toEqual(directTrace.after);
    expect(adapterResult.trace.drift).toEqual(directTrace.drift);
  });

  it("adapter trace consistent across different daysElapsed values", () => {
    const state = seededState();
    const stressLoad = state.boundary.stressLoad;
    const boundaryIntegrity = state.boundary.integrity;

    for (const days of [1, 7, 30]) {
      const directTrace = updateMetaStateForTick({
        meta: state.metaState, daysElapsed: days, stressLoad, boundaryIntegrity
      });
      const adapterResult = executeMetaDriftTemporalAdapter({
        meta: state.metaState, daysElapsed: days, stressLoad, boundaryIntegrity
      });
      expect(adapterResult.trace.after).toEqual(directTrace.after);
    }
  });

  // ── D2: Phase Trace Shape Equivalence ──────────────────────────────
  it("phase metadata has correct shape", () => {
    const state = freshState();
    const result = executeMetaDriftTemporalAdapter({
      meta: state.metaState,
      daysElapsed: 1,
      stressLoad: state.boundary.stressLoad,
      boundaryIntegrity: state.boundary.integrity
    });

    expect(result.phase.name).toBe("meta_drift");
    expect(result.phase.changedStates).toEqual(["metaState"]);
    expect(result.phase.reasons.length).toBeGreaterThan(0);
  });

  it("temporalResult has correct processId", () => {
    const state = freshState();
    const result = executeMetaDriftTemporalAdapter({
      meta: state.metaState,
      daysElapsed: 1,
      stressLoad: state.boundary.stressLoad,
      boundaryIntegrity: state.boundary.integrity
    });

    expect(result.temporalResult.processId).toBe("meta_drift");
    expect(result.temporalResult.changedStates).toEqual(["metaState"]);
    expect(result.temporalResult.warnings).toEqual([]);
  });

  it("Phase 2 reasons in V3 trace match adapter output", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });
    const phase2 = v3Trace.phases[1]!;

    expect(phase2.name).toBe("meta_drift");
    expect(phase2.changedStates).toEqual(["metaState"]);
    expect(phase2.reasons.length).toBeGreaterThan(0);
  });

  it("V3 trace.metaState has before/after/drift sub-fields", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.metaState.before).toBeDefined();
    expect(trace.metaState.after).toBeDefined();
    expect(trace.metaState.drift).toBeDefined();
  });

  // ── D3: State Mutation Equivalence ─────────────────────────────────
  it("metaState correctly mutates through delegated tick", () => {
    const state = seededState();
    const metaBefore = { ...state.metaState };

    runContinuousTick(state, { daysElapsed: 7 });
    const metaAfter = state.metaState;

    // At least one field should have drifted after 7 days
    const drifted = (
      metaAfter.emotionalSensitivity !== metaBefore.emotionalSensitivity ||
      metaAfter.resilience !== metaBefore.resilience ||
      metaAfter.forgettingSpeed !== metaBefore.forgettingSpeed
    );
    expect(drifted).toBe(true);
  });

  it("V3 ContinuousTickTrace shape unchanged after delegation", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });

    expect(trace.phases).toHaveLength(17);
    expect(trace.metaState).toBeDefined();
    expect(typeof trace.metaState.drift).toBe("object");
  });

  // ── D4: Phase Order Equivalence ────────────────────────────────────
  it("meta_drift remains Phase 2, after snapshot and before decay_and_recovery", () => {
    const state = seededState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 7 });

    expect(v3Trace.phases[0]?.name).toBe("snapshot");
    expect(v3Trace.phases[1]?.name).toBe("meta_drift");
    expect(v3Trace.phases[2]?.name).toBe("decay_and_recovery");
  });

  // ── D5+D6: Registry + UnifiedTickTrace ─────────────────────────────
  it("UnifiedTickTrace marks meta_drift as delegated", () => {
    const state = freshState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const mdProcess = unified.processTraces.find((pt) => pt.processId === "meta_drift");
    expect(mdProcess).toBeDefined();
    expect(mdProcess!.mutationPolicy).toBe("delegates_to_v3");
    expect(mdProcess!.adapterStatus).toBe("delegated");
    expect(mdProcess!.observedOnly).toBe(false);
  });

  it("4 phases are delegated; 13 others are shells", () => {
    const state = freshState();
    const v3Trace = runContinuousTick(state, { daysElapsed: 1 });
    const unified = buildUnifiedTickTrace({ v3Trace });

    const delegated = unified.processTraces.filter((pt) => pt.adapterStatus === "delegated");
    expect(delegated).toHaveLength(4);
    const shells = unified.processTraces.filter((pt) => pt.adapterStatus !== "delegated");
    expect(shells).toHaveLength(13);
  });

  // ── D7: No Extra Mutation ──────────────────────────────────────────
  it("adapter does not mutate unrelated state fields", () => {
    const state = seededState();
    const rewardBefore = { ...state.rewardState };
    const boundaryBefore = { ...state.boundary };
    const boredomBefore = { ...state.boredomState };

    executeMetaDriftTemporalAdapter({
      meta: state.metaState,
      daysElapsed: 1,
      stressLoad: state.boundary.stressLoad,
      boundaryIntegrity: state.boundary.integrity
    });

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
    const metaVars = after.variables.filter((v) => v.domain === "metaState");
    expect(metaVars).toHaveLength(13);
  });

  // ── D8: All tests pass (implicit) ──────────────────────────────────
  it("all 17 phases still present after triple delegation", () => {
    const state = seededState();
    const trace = runContinuousTick(state, { daysElapsed: 1 });
    expect(trace.phases).toHaveLength(17);
  });
});
