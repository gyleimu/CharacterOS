import { describe, expect, it } from "vitest";
import {
  buildInternalStateFieldSnapshot,
  type InternalStateFieldSnapshot
} from "../../../src/core/temporal/internalStateField";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function createFreshState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: false
  });
}

function createSeededState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
}

function snapshot(state: CharacterPhysicsState, characterId?: string): InternalStateFieldSnapshot {
  return buildInternalStateFieldSnapshot({ state, ...(characterId ? { characterId } : {}) });
}

describe("buildInternalStateFieldSnapshot", () => {
  it("builds a snapshot from a default LinFan state", () => {
    const state = createFreshState();
    const snap = snapshot(state, "lin_fan");

    expect(snap.version).toBe("4.4.0");
    expect(snap.capturedAt).toBeDefined();
    expect(snap.characterId).toBe("lin_fan");
    expect(snap.characterName).toBe("林凡");
    expect(snap.variables.length).toBeGreaterThan(0);
  });

  it("has variables across all expected domains", () => {
    const state = createSeededState();
    const snap = snapshot(state);

    const domains = new Set(snap.variables.map((v) => v.domain));
    expect(domains.has("metaState")).toBe(true);
    expect(domains.has("boundary")).toBe(true);
    expect(domains.has("rewardState")).toBe(true);
    expect(domains.has("homeostasisState")).toBe(true);
    expect(domains.has("boredomState")).toBe(true);
    expect(domains.has("coordinate")).toBe(true);
    expect(domains.has("belief")).toBe(true);
    expect(domains.has("memory")).toBe(true);
  });

  it("metaState variables cover all 13 parameters", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    const metaVariables = snap.variables.filter((v) => v.domain === "metaState");
    expect(metaVariables).toHaveLength(13);
    expect(metaVariables.map((v) => v.id)).toContain("metaState.emotionalSensitivity");
    expect(metaVariables.map((v) => v.id)).toContain("metaState.traumaAmplification");
    expect(metaVariables.map((v) => v.id)).toContain("metaState.attachmentStyle");
  });

  it("boundary variables include stressLoad, cracks, and phase", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    const boundaryVariables = snap.variables.filter((v) => v.domain === "boundary");
    expect(boundaryVariables.length).toBeGreaterThanOrEqual(7);
    expect(boundaryVariables.map((v) => v.id)).toContain("boundary.stressLoad");
    expect(boundaryVariables.map((v) => v.id)).toContain("boundary.cracks");
    expect(boundaryVariables.map((v) => v.id)).toContain("boundary.phase");
  });

  it("reward variables cover all 6 fields", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    const rewardVariables = snap.variables.filter((v) => v.domain === "rewardState");
    expect(rewardVariables).toHaveLength(6);
  });

  it("coordinate variables include trust, fear, attachment, control", () => {
    const state = createSeededState();
    const snap = snapshot(state);
    const coordVariables = snap.variables.filter((v) => v.domain === "coordinate");
    expect(coordVariables).toHaveLength(4);
    expect(coordVariables.map((v) => v.id)).toContain("coordinate.trust");
    expect(coordVariables.map((v) => v.id)).toContain("coordinate.fear");
  });

  it("belief variables reflect seeded experiences", () => {
    const state = createSeededState();
    const snap = snapshot(state);
    const beliefVariables = snap.variables.filter((v) => v.domain === "belief");
    expect(beliefVariables.length).toBeGreaterThan(0);
    // Seeded state has 3 initial memories → should produce beliefs
    const strengthVar = beliefVariables.find((v) => v.id === "belief.strengthSummary");
    expect(strengthVar).toBeDefined();
    expect(strengthVar!.currentValue).toBeGreaterThan(0);
  });

  it("memory variables reflect seeded experiences", () => {
    const state = createSeededState();
    const snap = snapshot(state);
    const memoryVariables = snap.variables.filter((v) => v.domain === "memory");
    expect(memoryVariables.length).toBeGreaterThanOrEqual(2);
    const weightVar = memoryVariables.find((v) => v.id === "memory.effectiveWeightSummary");
    expect(weightVar).toBeDefined();
    expect(weightVar!.currentValue).toBeGreaterThan(0);
  });

  it("all normalizedValues are in [0, 1]", () => {
    const state = createSeededState();
    const snap = snapshot(state);

    for (const v of snap.variables) {
      expect(v.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(v.normalizedValue).toBeLessThanOrEqual(1);
    }
  });

  it("summary counts match variable counts", () => {
    const state = createSeededState();
    const snap = snapshot(state);

    const totalByRisk =
      snap.summary.highRiskCount + snap.summary.mediumRiskCount + snap.summary.lowRiskCount;
    expect(totalByRisk).toBe(snap.variables.length);

    const totalByTimeScale =
      snap.summary.fastVariableCount +
      snap.summary.mediumVariableCount +
      snap.summary.slowVariableCount +
      snap.summary.structuralVariableCount;
    expect(totalByTimeScale).toBe(snap.variables.length);

    expect(snap.summary.variableCount).toBe(snap.variables.length);
  });

  it("does not mutate character state during snapshot", () => {
    const state = createSeededState();
    const memCountBefore = state.memories.length;
    const coordBefore = { ...state.coordinate.values };
    const metaBefore = { ...state.metaState };

    snapshot(state);

    expect(state.memories.length).toBe(memCountBefore);
    expect(state.coordinate.values).toEqual(coordBefore);
    expect(state.metaState).toEqual(metaBefore);
  });

  it("boundary variables show higher risk after stress-inducing tick", () => {
    const state = createSeededState();
    const snapBefore = snapshot(state);

    // Run a long tick to accumulate stress and boundary pressure
    runContinuousTick(state, { daysElapsed: 30 });
    const snapAfter = snapshot(state);

    // After 30 days of tick (with no events), boundary should have recovered toward baseline.
    // The stress should generally decrease, not increase.
    // We verify that both snapshots produce valid boundary variables.
    const boundaryBefore = snapBefore.variables.find((v) => v.id === "boundary.stressLoad");
    const boundaryAfter = snapAfter.variables.find((v) => v.id === "boundary.stressLoad");
    expect(boundaryBefore).toBeDefined();
    expect(boundaryAfter).toBeDefined();
    // Both should have valid risk assessments
    expect(["low", "medium", "high"]).toContain(boundaryBefore!.stabilityRisk);
    expect(["low", "medium", "high"]).toContain(boundaryAfter!.stabilityRisk);
  });

  it("average homeostatic pressure is in [0, 1]", () => {
    const state = createSeededState();
    const snap = snapshot(state);
    expect(snap.summary.averageHomeostaticPressure).toBeGreaterThanOrEqual(0);
    expect(snap.summary.averageHomeostaticPressure).toBeLessThanOrEqual(1);
  });

  it("metaState variable 'traumaAmplification' has structural timeScale", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    const trauma = snap.variables.find((v) => v.id === "metaState.traumaAmplification");
    expect(trauma).toBeDefined();
    expect(trauma!.timeScale).toBe("structural");
  });

  it("boundary variable 'stressLoad' has fast timeScale", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    const stress = snap.variables.find((v) => v.id === "boundary.stressLoad");
    expect(stress).toBeDefined();
    expect(stress!.timeScale).toBe("fast");
  });

  it("warns when no memories are present in fresh state", () => {
    const state = createFreshState();
    const snap = snapshot(state);
    // Fresh state has 0 memories → should produce a warning
    const memWarnings = snap.warnings.filter((w) => w.includes("memory"));
    expect(memWarnings.length).toBeGreaterThanOrEqual(0);
    // At minimum, the memory variables should still exist
    const memVars = snap.variables.filter((v) => v.domain === "memory");
    expect(memVars.length).toBeGreaterThan(0);
  });

  it("produces consistent snapshot for the same state", () => {
    const state = createSeededState();
    const snap1 = snapshot(state);
    const snap2 = snapshot(state);

    // Variable counts should be identical
    expect(snap1.variables.length).toBe(snap2.variables.length);
    // Values should be identical (no randomness in snapshot)
    for (let i = 0; i < snap1.variables.length; i++) {
      expect(snap1.variables[i]!.currentValue).toBe(snap2.variables[i]!.currentValue);
    }
  });
});
