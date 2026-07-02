// =========================================================================
// V10.10 Pipeline Stability Tests — Cross-cutting invariants across the
// full V10.1–V10.9 pipeline. These tests verify end-to-end guarantees
// that individual subsystem unit tests may not catch.
// =========================================================================

import { describe, expect, it } from "vitest";
import { runLifeTickDryRun, type LifeTickRunnerOptions } from "../../../src/core/life/lifeTickRunner";
import { commitLifeTickProjection } from "../../../src/core/life/lifeTickPersistence";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { LifeTickRequest } from "../../../src/core/life/lifeTickTypes";

// ── Helpers ────────────────────────────────────────────────────────────

function request(overrides: Partial<LifeTickRequest> = {}): LifeTickRequest {
  return {
    characterId: "stability-char",
    elapsedHours: 6,
    observed: true,
    requestedAt: "2026-06-25T14:00:00.000Z",
    mode: "dry_run",
    seed: "stability-seed",
    ...overrides,
  };
}

function char() {
  return createCharacterPhysicsState({
    boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
  });
}

// ── Immutability ───────────────────────────────────────────────────────

describe("V10 pipeline — immutability (cross-cutting)", () => {
  it("dry-run does not mutate CharacterPhysicsState", () => {
    const c = char();
    const frozenStress = c.boundary.stressLoad;
    const frozenMemories = [...c.memories];
    runLifeTickDryRun(c, request());
    expect(c.boundary.stressLoad).toBe(frozenStress);
    expect(c.memories).toEqual(frozenMemories);
  });

  it("commit does not mutate original CharacterPhysicsState", () => {
    const c = char();
    const frozenStress = c.boundary.stressLoad;
    const dr = runLifeTickDryRun(c, request());
    commitLifeTickProjection(c, dr);
    expect(c.boundary.stressLoad).toBe(frozenStress);
  });

  it("commit returns cloned state distinct from input", () => {
    const c = char();
    const dr = runLifeTickDryRun(c, request());
    const result = commitLifeTickProjection(c, dr);
    expect(result.state).not.toBe(c);
    expect(result.state.memories).not.toBe(c.memories);
  });

  it("dry-run + commit preserves existing memory count (no memory seed options)", () => {
    const c = char();
    const originalCount = c.memories.length;
    const dr = runLifeTickDryRun(c, request());
    const result = commitLifeTickProjection(c, dr);
    expect(result.state.memories.length).toBe(originalCount);
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("V10 pipeline — determinism (cross-cutting)", () => {
  it("same character + same request → identical dry-run", () => {
    const r1 = runLifeTickDryRun(char(), request());
    const r2 = runLifeTickDryRun(char(), request());
    expect(r1.projectedLifeState.energyFatigue).toEqual(
      r2.projectedLifeState.energyFatigue
    );
    expect(r1.projectedLifeState.sleepWake).toEqual(
      r2.projectedLifeState.sleepWake
    );
    expect(r1.projectedLifeState.boredomExpansion).toEqual(
      r2.projectedLifeState.boredomExpansion
    );
    expect(r1.projectedLifeState.inspirationSeeds).toEqual(
      r2.projectedLifeState.inspirationSeeds
    );
  });

  it("same dry-run + same commit options → identical commit result", () => {
    const dr = runLifeTickDryRun(char(), request());
    const r1 = commitLifeTickProjection(char(), dr);
    const r2 = commitLifeTickProjection(char(), dr);
    expect(r1.changes).toEqual(r2.changes);
    expect(r1.skipped).toEqual(r2.skipped);
    expect(r1.applied).toBe(r2.applied);
  });

  it("different seeds → both results valid and applied=false", () => {
    const r1 = runLifeTickDryRun(char(), request({ seed: "alpha" }));
    const r2 = runLifeTickDryRun(char(), request({ seed: "beta" }));
    expect(r1.applied).toBe(false);
    expect(r2.applied).toBe(false);
    expect(r1.version).toBe("v10.8");
    expect(r2.version).toBe("v10.8");
  });
});

// ── Boundary Safety ────────────────────────────────────────────────────

describe("V10 pipeline — boundary safety (cross-cutting)", () => {
  it("dry-run always returns applied: false", () => {
    const dr = runLifeTickDryRun(char(), request());
    expect(dr.applied).toBe(false);
  });

  it("commit default applies no changes without explicit options", () => {
    const dr = runLifeTickDryRun(char(), request());
    const result = commitLifeTickProjection(char(), dr);
    expect(result.applied).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it("self-action candidates never executed", () => {
    const dr = runLifeTickDryRun(char(), request());
    for (const c of dr.projectedLifeState.selfActionCandidates) {
      expect(c.evaluated).toBe(false);
      expect(c.executed).toBe(false);
    }
  });

  it("commit preserves evaluated=false and executed=false on candidates", () => {
    const dr = runLifeTickDryRun(char(), request());
    commitLifeTickProjection(char(), dr, {
      allowSelfActionCandidateMemorySeed: true,
    });
    // Candidates in the DRY-RUN result remain untouched
    for (const c of dr.projectedLifeState.selfActionCandidates) {
      expect(c.evaluated).toBe(false);
      expect(c.executed).toBe(false);
    }
  });

  it("persistence rejects wrong-version dry-run", () => {
    const result = commitLifeTickProjection(char(), {
      version: "v10.7",
    } as unknown as ReturnType<typeof runLifeTickDryRun>);
    expect(result.applied).toBe(false);
  });
});

// ── Trace Completeness ─────────────────────────────────────────────────

describe("V10 pipeline — trace completeness (cross-cutting)", () => {
  it("trace includes all 8 required phases", () => {
    const dr = runLifeTickDryRun(char(), request());
    const phaseNames = dr.trace.phaseTraces.map((p) => p.phase);
    expect(phaseNames).toContain("passive_recovery"); // scheduler
    expect(phaseNames).toContain("energy_fatigue");
    expect(phaseNames).toContain("attention_drift"); // sleep/wake
    expect(phaseNames).toContain("memory_resurfacing"); // dream
    expect(phaseNames).toContain("inspiration_check"); // boredom + inspiration
    expect(phaseNames).toContain("random_thought");
    expect(phaseNames).toContain("self_action_candidate");
    expect(phaseNames).toContain("trace_summary");
  });

  it("every phase has reasons", () => {
    const dr = runLifeTickDryRun(char(), request());
    for (const phase of dr.trace.phaseTraces) {
      expect(Array.isArray(phase.reasons)).toBe(true);
      expect(phase.reasons.length).toBeGreaterThan(0);
    }
  });

  it("trace has stateChanged: false always", () => {
    const dr = runLifeTickDryRun(char(), request());
    expect(dr.trace.stateChanged).toBe(false);
  });

  it("trace includes request and plan details", () => {
    const dr = runLifeTickDryRun(char(), request());
    expect(dr.trace.characterId).toBe("stability-char");
    expect(dr.trace.planId).toBeTruthy();
    expect(dr.trace.elapsedHours).toBe(6);
  });
});

// ── Persistence Policy ─────────────────────────────────────────────────

describe("V10 pipeline — persistence policy (cross-cutting)", () => {
  it("energy/sleep/boredom skipped with schema warning", () => {
    const dr = runLifeTickDryRun(char(), request());
    const result = commitLifeTickProjection(char(), dr, {
      allowEnergyFatigue: true,
      allowSleepWake: true,
      allowBoredomExpansion: true,
    });
    const energySkip = result.skipped.find(
      (s) => s.path === "lifeState.energyFatigue"
    );
    expect(energySkip).toBeDefined();
    expect(energySkip!.reason).toContain("requested");
  });

  it("memory seed options only add memories when explicitly enabled", () => {
    const c = char();
    const dr = runLifeTickDryRun(c, request());
    const defaultResult = commitLifeTickProjection(c, dr);
    const enabledResult = commitLifeTickProjection(c, dr, {
      allowDreamMemorySeed: true,
      allowInspirationSeed: true,
      allowRandomThoughtMemorySeed: true,
    });
    // Default should not add memories beyond existing count
    expect(defaultResult.state.memories.length).toBe(c.memories.length);
    // Enabled may or may not add (depends on whether dreams/thoughts were generated)
    expect(enabledResult.state.memories.length).toBeGreaterThanOrEqual(
      c.memories.length
    );
  });

  it("maxGeneratedMemories is respected across pipeline", () => {
    const c = char();
    const dr = runLifeTickDryRun(c, request());
    const result = commitLifeTickProjection(c, dr, {
      allowDreamMemorySeed: true,
      allowInspirationSeed: true,
      allowRandomThoughtMemorySeed: true,
      allowSelfActionCandidateMemorySeed: true,
      maxGeneratedMemories: 1,
    });
    expect(result.changes.length).toBeLessThanOrEqual(1);
  });
});

// ── Projected State Consistency ────────────────────────────────────────

describe("V10 pipeline — projected state consistency", () => {
  it("projectedLifeState.energyFatigue values are in [0,1]", () => {
    const dr = runLifeTickDryRun(char(), request());
    const ef = dr.projectedLifeState.energyFatigue;
    expect(ef.energy).toBeGreaterThanOrEqual(0); expect(ef.energy).toBeLessThanOrEqual(1);
    expect(ef.fatigue).toBeGreaterThanOrEqual(0); expect(ef.fatigue).toBeLessThanOrEqual(1);
  });

  it("projectedLifeState.sleepWake has valid phase", () => {
    const dr = runLifeTickDryRun(char(), request());
    const sw = dr.projectedLifeState.sleepWake;
    expect(sw.phase).toBeTruthy();
    expect(typeof sw.phase).toBe("string");
  });

  it("projectedLifeState.boredomExpansion values are in [0,1]", () => {
    const dr = runLifeTickDryRun(char(), request());
    const bs = dr.projectedLifeState.boredomExpansion;
    expect(bs.boredom).toBeGreaterThanOrEqual(0); expect(bs.boredom).toBeLessThanOrEqual(1);
    expect(bs.restlessness).toBeGreaterThanOrEqual(0); expect(bs.restlessness).toBeLessThanOrEqual(1);
  });

  it("projectedLifeState arrays are always defined", () => {
    const dr = runLifeTickDryRun(char(), request());
    expect(Array.isArray(dr.projectedLifeState.dreamFragments)).toBe(true);
    expect(Array.isArray(dr.projectedLifeState.inspirationSeeds)).toBe(true);
    expect(Array.isArray(dr.projectedLifeState.selfActionCandidates)).toBe(true);
  });

  it("longer elapsed hours increases fatigue monotonically", () => {
    const r1 = runLifeTickDryRun(char(), request({ elapsedHours: 1 }));
    const r2 = runLifeTickDryRun(char(), request({ elapsedHours: 12 }));
    expect(r2.projectedLifeState.energyFatigue.fatigue).toBeGreaterThan(
      r1.projectedLifeState.energyFatigue.fatigue
    );
  });
});
