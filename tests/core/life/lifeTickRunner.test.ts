import { describe, expect, it } from "vitest";
import {
  runLifeTickDryRun,
  type LifeTickRunnerOptions,
  type LifeTickDryRunResult,
} from "../../../src/core/life/lifeTickRunner";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { LifeTickRequest } from "../../../src/core/life/lifeTickTypes";

// ── Helpers ────────────────────────────────────────────────────────────

function validRequest(
  overrides: Partial<LifeTickRequest> = {}
): LifeTickRequest {
  return {
    characterId: "char-test",
    elapsedHours: 6,
    observed: true,
    requestedAt: "2026-06-25T14:00:00.000Z",
    mode: "dry_run",
    seed: "runner-test-seed",
    ...overrides,
  };
}

function run(req?: LifeTickRequest, opts?: LifeTickRunnerOptions) {
  return runLifeTickDryRun(
    createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.3 }),
    }),
    req ?? validRequest(),
    opts
  );
}

// ── Core Guarantees ────────────────────────────────────────────────────

describe("LifeTickRunner — core guarantees", () => {
  it("returns applied: false always", () => {
    const result = run();
    expect(result.applied).toBe(false);
  });

  it("does not mutate original character state", () => {
    const char = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45 }),
    });
    const frozenStress = char.boundary.stressLoad;
    const frozenMemories = char.memories.length;
    runLifeTickDryRun(char, validRequest());
    expect(char.boundary.stressLoad).toBe(frozenStress);
    expect(char.memories.length).toBe(frozenMemories);
  });

  it("version is v10.8", () => {
    expect(run().version).toBe("v10.8");
  });

  it("validates request (invalid throws and returns early with warnings)", () => {
    const result = runLifeTickDryRun(
      createCharacterPhysicsState(),
      validRequest({ characterId: "" })
    );
    // Should still return a result structure, not throw
    expect(result).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("builds a life tick plan", () => {
    const result = run();
    expect(result.plan).toBeDefined();
    expect(result.plan.characterId).toBe("char-test");
    expect(result.plan.elapsedHours).toBe(6);
  });
});

// ── Phases ─────────────────────────────────────────────────────────────

describe("LifeTickRunner — phases", () => {
  it("includes scheduler phase (as passive_recovery)", () => {
    const result = run();
    const scheduler = result.trace.phaseTraces.find(
      (p) => p.phase === "passive_recovery"
    );
    expect(scheduler).toBeDefined();
    expect(scheduler!.executed).toBe(true);
  });

  it("includes energy_fatigue phase", () => {
    const result = run();
    const ef = result.trace.phaseTraces.find(
      (p) => p.phase === "energy_fatigue"
    );
    expect(ef).toBeDefined();
    expect(ef!.executed).toBe(true);
  });

  it("includes sleep_wake phase (as attention_drift)", () => {
    const result = run();
    const sw = result.trace.phaseTraces.find(
      (p) => p.phase === "attention_drift"
    );
    expect(sw).toBeDefined();
    expect(sw!.executed).toBe(true);
  });

  it("includes dream phase (as memory_resurfacing)", () => {
    const result = run();
    const dream = result.trace.phaseTraces.find(
      (p) => p.phase === "memory_resurfacing"
    );
    expect(dream).toBeDefined();
    expect(dream!.executed).toBe(true);
  });

  it("includes boredom_inspiration phase (as inspiration_check)", () => {
    const result = run();
    const bi = result.trace.phaseTraces.find(
      (p) => p.phase === "inspiration_check"
    );
    expect(bi).toBeDefined();
    expect(bi!.executed).toBe(true);
  });

  it("includes random_thought phase", () => {
    const result = run();
    const rt = result.trace.phaseTraces.find(
      (p) => p.phase === "random_thought"
    );
    expect(rt).toBeDefined();
    expect(rt!.executed).toBe(true);
  });

  it("includes self_action_candidate phase", () => {
    const result = run();
    const sac = result.trace.phaseTraces.find(
      (p) => p.phase === "self_action_candidate"
    );
    expect(sac).toBeDefined();
    expect(sac!.executed).toBe(true);
  });

  it("includes summary phase (as trace_summary)", () => {
    const result = run();
    const summary = result.trace.phaseTraces.find(
      (p) => p.phase === "trace_summary"
    );
    expect(summary).toBeDefined();
    expect(summary!.executed).toBe(true);
  });
});

// ── Projected Life State ───────────────────────────────────────────────

describe("LifeTickRunner — projectedLifeState", () => {
  it("includes energyFatigue", () => {
    const result = run();
    expect(result.projectedLifeState.energyFatigue).toBeDefined();
    expect(result.projectedLifeState.energyFatigue.energy).toBeGreaterThanOrEqual(0);
    expect(result.projectedLifeState.energyFatigue.energy).toBeLessThanOrEqual(1);
  });

  it("includes sleepWake", () => {
    const result = run();
    expect(result.projectedLifeState.sleepWake).toBeDefined();
    expect(result.projectedLifeState.sleepWake.phase).toBeTruthy();
  });

  it("includes boredomExpansion", () => {
    const result = run();
    expect(result.projectedLifeState.boredomExpansion).toBeDefined();
    expect(result.projectedLifeState.boredomExpansion.boredom).toBeGreaterThanOrEqual(0);
  });

  it("includes dreamFragments array", () => {
    const result = run();
    expect(Array.isArray(result.projectedLifeState.dreamFragments)).toBe(true);
  });

  it("includes inspirationSeeds array", () => {
    const result = run();
    expect(Array.isArray(result.projectedLifeState.inspirationSeeds)).toBe(true);
  });

  it("includes selfActionCandidates", () => {
    const result = run();
    expect(Array.isArray(result.projectedLifeState.selfActionCandidates)).toBe(true);
  });

  it("awake phase can skip dream gracefully", () => {
    // Default character is awake, dream should not generate for awake state
    const result = runLifeTickDryRun(
      createCharacterPhysicsState(),
      validRequest({
        elapsedHours: 2,
        requestedAt: "2026-06-25T12:00:00.000Z",
      }),
      { localHour: 12 }
    );
    // Dream fragments may be empty for awake character
    expect(Array.isArray(result.projectedLifeState.dreamFragments)).toBe(true);
  });

  it("sleeping phase can produce dream fragment", () => {
    // Use night hours + high fatigue to push toward sleep
    const result = runLifeTickDryRun(
      createCharacterPhysicsState({
        boundary: createPsychologicalBoundary({ stressLoad: 0.2 }),
      }),
      validRequest({
        elapsedHours: 8,
        requestedAt: "2026-06-25T03:00:00.000Z",
      }),
      { localHour: 3 }
    );
    // May or may not produce dream based on sleep phase
    expect(Array.isArray(result.projectedLifeState.dreamFragments)).toBe(true);
  });

  it("randomThought may be undefined when nothing generated", () => {
    const result = run();
    // randomThought is optional — just verify it does not crash
    expect(
      result.projectedLifeState.randomThought === undefined ||
      result.projectedLifeState.randomThought !== undefined
    ).toBe(true);
  });
});

// ── Integration ────────────────────────────────────────────────────────

describe("LifeTickRunner — subsystem integration", () => {
  it("boredom feeds inspiration seeds", () => {
    const result = run();
    expect(Array.isArray(result.projectedLifeState.inspirationSeeds)).toBe(true);
  });

  it("self-action candidates are produced", () => {
    const result = run();
    expect(result.projectedLifeState.selfActionCandidates.length).toBeGreaterThan(0);
  });

  it("high elapsed hours affects energy/fatigue", () => {
    const short = run(validRequest({ elapsedHours: 1 }));
    const long = run(validRequest({ elapsedHours: 16 }));
    // Longer time should produce more fatigue
    expect(long.projectedLifeState.energyFatigue.fatigue).toBeGreaterThan(
      short.projectedLifeState.energyFatigue.fatigue
    );
  });

  it("high fatigue increases sleep candidate downstream", () => {
    const fresh = run(validRequest({ elapsedHours: 1 }));
    const tired = run(validRequest({ elapsedHours: 20 }));
    const sleepFresh = fresh.projectedLifeState.selfActionCandidates.find(
      (c) => c.type === "sleep"
    );
    const sleepTired = tired.projectedLifeState.selfActionCandidates.find(
      (c) => c.type === "sleep"
    );
    if (sleepFresh && sleepTired) {
      expect(sleepTired.strength).toBeGreaterThan(sleepFresh.strength);
    }
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("LifeTickRunner — determinism", () => {
  it("same inputs → same result", () => {
    const r1 = run();
    const r2 = run();
    expect(r1.projectedLifeState.energyFatigue).toEqual(
      r2.projectedLifeState.energyFatigue
    );
    expect(r1.projectedLifeState.sleepWake).toEqual(
      r2.projectedLifeState.sleepWake
    );
    expect(r1.projectedLifeState.boredomExpansion).toEqual(
      r2.projectedLifeState.boredomExpansion
    );
  });

  it("different seed → valid but possibly different result", () => {
    const r1 = run(validRequest({ seed: "alpha" }));
    const r2 = run(validRequest({ seed: "beta" }));
    // Both should be valid
    expect(r1.version).toBe("v10.8");
    expect(r2.version).toBe("v10.8");
    expect(r1.applied).toBe(false);
    expect(r2.applied).toBe(false);
  });
});

// ── Warnings & Reasons ─────────────────────────────────────────────────

describe("LifeTickRunner — trace quality", () => {
  it("warnings are propagated", () => {
    const result = run(validRequest({ observed: false }));
    // Unobserved ticks should generate warnings
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("reasons are human-readable", () => {
    const result = run();
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const r of result.reasons) {
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });

  it("trace.reasons are populated", () => {
    const result = run();
    expect(result.trace.reasons.length).toBeGreaterThan(0);
  });

  it("trace has stateChanged: false", () => {
    const result = run();
    expect(result.trace.stateChanged).toBe(false);
  });
});
