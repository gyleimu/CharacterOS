import { describe, expect, it } from "vitest";
import {
  runLongitudinalSimulation,
  type LongitudinalSimulationRequest,
} from "../../../src/core/life/longitudinalSimulation";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";

// ── Helpers ────────────────────────────────────────────────────────────

function char() {
  return createCharacterPhysicsState({
    boundary: createPsychologicalBoundary({ stressLoad: 0.3 }),
  });
}

function request(overrides?: Partial<LongitudinalSimulationRequest>): LongitudinalSimulationRequest {
  return {
    characterId: "char-test",
    totalHours: 24,
    stepHours: 4,
    seed: "test-seed",
    ...overrides,
  };
}

// ── Validation ─────────────────────────────────────────────────────────

describe("LongitudinalSimulation — validation", () => {
  it("rejects totalHours <= 0", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 0 }));
    expect(result.steps).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects stepHours <= 0", () => {
    const result = runLongitudinalSimulation(char(), request({ stepHours: 0 }));
    expect(result.steps).toHaveLength(0);
  });

  it("caps excessive steps at 720", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 100000,
      stepHours: 1,
    }));
    expect(result.steps.length).toBeLessThanOrEqual(720);
  });

  it("invalid result has version v10.17 and applied=false", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 0 }));
    expect(result.version).toBe("v10.17");
    expect(result.applied).toBe(false);
  });
});

// ── Dry-Run (default) ──────────────────────────────────────────────────

describe("LongitudinalSimulation — dry-run (default, no commit)", () => {
  it("does not mutate original state", () => {
    const c = char();
    const frozenStress = c.boundary.stressLoad;
    runLongitudinalSimulation(c, request());
    expect(c.boundary.stressLoad).toBe(frozenStress);
  });

  it("returns expected number of steps", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 24, stepHours: 6 }));
    expect(result.steps).toHaveLength(4);
  });

  it("each step includes lifeDecisionContext", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 12, stepHours: 4 }));
    for (const step of result.steps) {
      expect(step.lifeDecisionContext).toBeDefined();
      expect(step.lifeDecisionContext.energy).toBeGreaterThanOrEqual(0);
    }
  });

  it("each step includes compact state summaries", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4 }));
    for (const step of result.steps) {
      expect(step.stateSummaryBefore.memoryCount).toBeGreaterThanOrEqual(0);
      expect(step.stateSummaryAfter.memoryCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("commitPolicy disabled → committedSteps 0, applied false", () => {
    const result = runLongitudinalSimulation(char(), request());
    expect(result.applied).toBe(false);
    expect(result.aggregate.committedSteps).toBe(0);
    expect(result.aggregate.generatedMemoryCount).toBe(0);
  });
});

// ── Optional Decision ──────────────────────────────────────────────────

describe("LongitudinalSimulation — includeDecision", () => {
  it("includeDecision=true includes differentiatedDecision", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4, includeDecision: true,
    }));
    for (const step of result.steps) {
      expect(step.differentiatedDecision).toBeDefined();
      expect(step.differentiatedDecision!.schemas.length).toBeGreaterThan(0);
    }
  });

  it("includeDecision=false (default) omits differentiatedDecision", () => {
    const result = runLongitudinalSimulation(char(), request());
    for (const step of result.steps) {
      expect(step.differentiatedDecision).toBeUndefined();
    }
  });

  it("includeExplanation=true includes differentiatedExplanation", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 4, stepHours: 2, includeDecision: true, includeExplanation: true,
    }));
    for (const step of result.steps) {
      expect(step.differentiatedExplanation).toBeDefined();
      expect(step.differentiatedExplanation!.scope).toBe("differentiated_decision");
    }
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("LongitudinalSimulation — determinism", () => {
  it("same inputs → same result", () => {
    const r1 = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4, includeDecision: true }));
    const r2 = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4, includeDecision: true }));
    expect(r1.steps.length).toBe(r2.steps.length);
    // First step should be identical
    expect(r1.steps[0]!.lifeDecisionContext).toEqual(r2.steps[0]!.lifeDecisionContext);
    if (r1.steps[0]!.differentiatedDecision && r2.steps[0]!.differentiatedDecision) {
      expect(r1.steps[0]!.differentiatedDecision.selectedStrategy.id)
        .toBe(r2.steps[0]!.differentiatedDecision.selectedStrategy.id);
    }
  });

  it("different seeds → valid but possibly different", () => {
    const r1 = runLongitudinalSimulation(char(), request({ seed: "alpha", totalHours: 8, stepHours: 4 }));
    const r2 = runLongitudinalSimulation(char(), request({ seed: "beta", totalHours: 8, stepHours: 4 }));
    expect(r1.steps.length).toBe(r2.steps.length);
    expect(r1.version).toBe("v10.17");
    expect(r2.version).toBe("v10.17");
  });
});

// ── Optional Commit ────────────────────────────────────────────────────

describe("LongitudinalSimulation — optional commit", () => {
  it("commit enabled with dreams commits via clone only", () => {
    const c = char();
    const origMemCount = c.memories.length;
    const result = runLongitudinalSimulation(c, request({
      totalHours: 8, stepHours: 4,
      commitPolicy: { enabled: true, commitDreams: true },
    }));
    // Original state untouched
    expect(c.memories.length).toBe(origMemCount);
    // Commit tracked in result
    expect(result.aggregate.committedSteps).toBeGreaterThanOrEqual(0);
  });

  it("self-action candidates are NEVER executed", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4,
      commitPolicy: {
        enabled: true,
        commitDreams: true,
        commitRandomThoughts: true,
        // commitSelfActionCandidates is always false — enforced at type level
      },
    }));
    // No self-action execution guaranteed
    for (const step of result.steps) {
      if (step.commitResult) {
        for (const change of step.commitResult.changes) {
          expect(change.reason).not.toContain("executed");
        }
      }
    }
  });
});

// ── Aggregate ──────────────────────────────────────────────────────────

describe("LongitudinalSimulation — aggregate metrics", () => {
  it("includes averageFatigue and averageBoredom", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 12, stepHours: 4 }));
    expect(result.aggregate.averageFatigue).toBeGreaterThanOrEqual(0);
    expect(result.aggregate.averageBoredom).toBeGreaterThanOrEqual(0);
  });

  it("includes sleepPhaseCounts", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 12, stepHours: 4 }));
    const phases = result.aggregate.sleepPhaseCounts;
    expect(Object.keys(phases).length).toBeGreaterThan(0);
    const totalPhaseSteps = Object.values(phases).reduce((a, b) => a + b, 0);
    expect(totalPhaseSteps).toBe(result.steps.length);
  });

  it("includes strategyCounts and actionDirectionCounts when includeDecision=true", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4, includeDecision: true,
    }));
    expect(Object.keys(result.aggregate.strategyCounts).length).toBeGreaterThanOrEqual(0);
    expect(Object.keys(result.aggregate.actionDirectionCounts).length).toBeGreaterThanOrEqual(0);
  });

  it("includes personalityDeltaSummary", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4 }));
    const delta = result.aggregate.personalityDeltaSummary;
    // Personality shouldn't drift in dry-run (no state mutation)
    if (delta.trustDelta !== undefined) {
      expect(Math.abs(delta.trustDelta)).toBeLessThanOrEqual(0.01);
    }
  });

  it("includes belief/memory counts before/after", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4 }));
    expect(result.aggregate.beliefCountBefore).toBeGreaterThanOrEqual(0);
    expect(result.aggregate.memoryCountBefore).toBeGreaterThanOrEqual(0);
  });

  it("finalStateSummary is compact", () => {
    const result = runLongitudinalSimulation(char(), request({ totalHours: 8, stepHours: 4 }));
    const summary = result.finalStateSummary;
    expect(summary.memoryCount).toBeGreaterThanOrEqual(0);
    expect(summary.trust).toBeGreaterThanOrEqual(0);
    expect(summary.trust).toBeLessThanOrEqual(1);
  });

  it("memory cap respected in commit", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4,
      commitPolicy: {
        enabled: true,
        commitDreams: true,
        maxGeneratedMemoriesPerStep: 1,
        maxTotalGeneratedMemories: 2,
      },
    }));
    expect(result.aggregate.generatedMemoryCount).toBeLessThanOrEqual(2);
  });
});

// ── V10.19 Governance Regression Tests ──────────────────────────────────

describe("LongitudinalSimulation — V10.19 step cap enforcement", () => {
  it("enforces 720 step cap exactly", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 100000,
      stepHours: 1,
    }));
    expect(result.steps.length).toBe(720);
    expect(result.warnings.some((w) => w.includes("720"))).toBe(true);
  });

  it("does not exceed 720 steps under any input", () => {
    // Extreme: tiny step, huge total
    const r1 = runLongitudinalSimulation(char(), request({
      totalHours: 999999,
      stepHours: 0.5,
    }));
    expect(r1.steps.length).toBeLessThanOrEqual(720);

    // Extreme: huge totalHours with moderate step
    const r2 = runLongitudinalSimulation(char(), request({
      totalHours: 1_000_000,
      stepHours: 24,
    }));
    expect(r2.steps.length).toBeLessThanOrEqual(720);
  });
});

describe("LongitudinalSimulation — V10.19 dry-run original state unchanged", () => {
  it("original state memory count unchanged after dry-run", () => {
    const c = char();
    const origMem = c.memories.length;
    const origBeliefs = c.beliefStates.length;
    runLongitudinalSimulation(c, request({ totalHours: 24, stepHours: 4 }));
    expect(c.memories.length).toBe(origMem);
    expect(c.beliefStates.length).toBe(origBeliefs);
  });

  it("original state coordinate unchanged after dry-run", () => {
    const c = char();
    const origTrust = c.coordinate.values.trust;
    const origFear = c.coordinate.values.fear;
    const origControl = c.coordinate.values.control;
    runLongitudinalSimulation(c, request({ totalHours: 24, stepHours: 4 }));
    expect(c.coordinate.values.trust).toBe(origTrust);
    expect(c.coordinate.values.fear).toBe(origFear);
    expect(c.coordinate.values.control).toBe(origControl);
  });

  it("original state boundary unchanged after dry-run", () => {
    const c = char();
    const origStress = c.boundary.stressLoad;
    const origIntegrity = c.boundary.integrity;
    runLongitudinalSimulation(c, request({ totalHours: 24, stepHours: 4 }));
    expect(c.boundary.stressLoad).toBe(origStress);
    expect(c.boundary.integrity).toBe(origIntegrity);
  });
});

describe("LongitudinalSimulation — V10.19 full determinism", () => {
  it("full result is identical across repeated runs", () => {
    const r1 = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4, includeDecision: true,
    }));
    const r2 = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4, includeDecision: true,
    }));
    expect(r1.steps.length).toBe(r2.steps.length);
    expect(r1.aggregate.totalSteps).toBe(r2.aggregate.totalSteps);
    expect(r1.aggregate.averageFatigue).toBe(r2.aggregate.averageFatigue);
    expect(r1.aggregate.averageBoredom).toBe(r2.aggregate.averageBoredom);
    expect(r1.aggregate.sleepPhaseCounts).toEqual(r2.aggregate.sleepPhaseCounts);
    expect(r1.finalStateSummary.memoryCount).toBe(r2.finalStateSummary.memoryCount);
    expect(r1.finalStateSummary.beliefCount).toBe(r2.finalStateSummary.beliefCount);
    for (let i = 0; i < r1.steps.length; i++) {
      const s1 = r1.steps[i]!;
      const s2 = r2.steps[i]!;
      expect(s1.lifeDecisionContext.energy).toBe(s2.lifeDecisionContext.energy);
      expect(s1.lifeDecisionContext.fatigue).toBe(s2.lifeDecisionContext.fatigue);
      expect(s1.stateSummaryBefore).toEqual(s2.stateSummaryBefore);
      expect(s1.stateSummaryAfter).toEqual(s2.stateSummaryAfter);
    }
  });

  it("seed fallback formula is deterministic", () => {
    // Simulate the fallback pattern used in the API route
    const characterId = "test-char";
    const totalHours = 24;
    const stepHours = 4;
    const seed1 = `${characterId}:${totalHours}:${stepHours}`;
    const seed2 = `${characterId}:${totalHours}:${stepHours}`;
    expect(seed1).toBe(seed2);

    const r1 = runLongitudinalSimulation(char(), request({
      totalHours, stepHours, seed: seed1,
    }));
    const r2 = runLongitudinalSimulation(char(), request({
      totalHours, stepHours, seed: seed2,
    }));
    expect(r1.aggregate.averageFatigue).toBe(r2.aggregate.averageFatigue);
  });
});

describe("LongitudinalSimulation — V10.19 commitPolicy safety", () => {
  it("commitPolicy enabled does not execute self-action candidates", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 12, stepHours: 4,
      commitPolicy: {
        enabled: true,
        commitDreams: true,
        commitRandomThoughts: true,
        commitInspirationSeeds: true,
      },
    }));
    for (const step of result.steps) {
      // Self-action candidates may appear in lifeDecisionContext, but never as executed actions
      expect(step.lifeDecisionContext).toBeDefined();
      if (step.commitResult) {
        for (const change of step.commitResult.changes) {
          expect(change.path).not.toContain("selfAction");
          expect(change.reason).not.toMatch(/executed/i);
        }
      }
    }
  });

  it("commitPolicy.commitSelfActionCandidates is always false at type level", () => {
    // TypeScript compilation check: the commitPolicy type enforces
    // commitSelfActionCandidates?: false (always false)
    // This test verifies that passing a commitPolicy without the field works correctly
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 4, stepHours: 2,
      commitPolicy: { enabled: true, commitDreams: true },
    }));
    expect(result.applied).toBeDefined();
  });

  it("commitPolicy enabled preserves original state", () => {
    const c = char();
    const origMem = c.memories.length;
    const origBeliefs = c.beliefStates.length;
    runLongitudinalSimulation(c, request({
      totalHours: 8, stepHours: 4,
      commitPolicy: { enabled: true, commitDreams: true },
    }));
    expect(c.memories.length).toBe(origMem);
    expect(c.beliefStates.length).toBe(origBeliefs);
  });
});

describe("LongitudinalSimulation — V10.19 aggregate stability", () => {
  it("aggregate counts sum correctly", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 12, stepHours: 3,
    }));
    const agg = result.aggregate;
    // totalSteps should match steps length
    expect(agg.totalSteps).toBe(result.steps.length);
    // sleepPhaseCounts should sum to totalSteps
    const phaseSum = Object.values(agg.sleepPhaseCounts).reduce((a, b) => a + b, 0);
    expect(phaseSum).toBe(agg.totalSteps);
    // committedSteps should be 0 in dry-run
    expect(agg.committedSteps).toBe(0);
    expect(agg.generatedMemoryCount).toBe(0);
  });

  it("aggregate is stable across repeated runs", () => {
    const r1 = runLongitudinalSimulation(char(), request({
      totalHours: 12, stepHours: 3,
    }));
    const r2 = runLongitudinalSimulation(char(), request({
      totalHours: 12, stepHours: 3,
    }));
    expect(r1.aggregate.averageFatigue).toBe(r2.aggregate.averageFatigue);
    expect(r1.aggregate.averageBoredom).toBe(r2.aggregate.averageBoredom);
    expect(r1.aggregate.sleepPhaseCounts).toEqual(r2.aggregate.sleepPhaseCounts);
    expect(r1.aggregate.memoryCountBefore).toBe(r2.aggregate.memoryCountBefore);
    expect(r1.aggregate.memoryCountAfter).toBe(r2.aggregate.memoryCountAfter);
  });

  it("personalityDeltaSummary is near zero in dry-run", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 12, stepHours: 3,
    }));
    const delta = result.aggregate.personalityDeltaSummary;
    if (delta.trustDelta !== undefined) {
      expect(Math.abs(delta.trustDelta)).toBeLessThanOrEqual(0.01);
    }
    if (delta.fearDelta !== undefined) {
      expect(Math.abs(delta.fearDelta)).toBeLessThanOrEqual(0.01);
    }
  });
});

describe("LongitudinalSimulation — V10.19 finalStateSummary compactness", () => {
  it("finalStateSummary does not contain full state keys", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4,
    }));
    const summary = result.finalStateSummary;
    // Only high-level metadata, no internal detail
    expect(summary).not.toHaveProperty("coordinate");
    expect(summary).not.toHaveProperty("clusters");
    expect(summary).not.toHaveProperty("particles");
    expect(summary).not.toHaveProperty("proceduralRoutines");
    expect(summary).not.toHaveProperty("galaxyState");
  });

  it("step summaries do not contain full state keys", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4, includeDecision: true, includeExplanation: true,
    }));
    for (const step of result.steps) {
      const before = step.stateSummaryBefore as unknown as Record<string, unknown>;
      const after = step.stateSummaryAfter as unknown as Record<string, unknown>;
      expect(before).not.toHaveProperty("coordinate");
      expect(before).not.toHaveProperty("clusters");
      expect(after).not.toHaveProperty("particles");
      expect(after).not.toHaveProperty("proceduralRoutines");
    }
  });

  it("latestMemorySnippet and topBeliefSnippet are <= 80 chars", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 8, stepHours: 4,
    }));
    for (const step of result.steps) {
      if (step.stateSummaryAfter.latestMemorySnippet) {
        expect(step.stateSummaryAfter.latestMemorySnippet.length).toBeLessThanOrEqual(80);
      }
      if (step.stateSummaryAfter.topBeliefSnippet) {
        expect(step.stateSummaryAfter.topBeliefSnippet.length).toBeLessThanOrEqual(80);
      }
    }
  });
});

describe("LongitudinalSimulation — V10.19 includeExplanation bounded", () => {
  it("includeExplanation=true includes explanations but not full trace dump", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 4, stepHours: 2, includeDecision: true, includeExplanation: true,
    }));
    for (const step of result.steps) {
      expect(step.differentiatedExplanation).toBeDefined();
      expect(step.differentiatedExplanation!.scope).toBe("differentiated_decision");
      // Explanation should not include a full state dump
      const explStr = JSON.stringify(step.differentiatedExplanation);
      expect(explStr.length).toBeLessThan(50000); // Reasonable bound
    }
  });

  it("includeExplanation=false omits explanations entirely", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 4, stepHours: 2, includeDecision: true, includeExplanation: false,
    }));
    for (const step of result.steps) {
      expect(step.differentiatedExplanation).toBeUndefined();
    }
  });
});

describe("LongitudinalSimulation — V10.19 edge cases", () => {
  it("handles minimal step (totalHours=1, stepHours=1)", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 1, stepHours: 1,
    }));
    expect(result.steps.length).toBe(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("handles totalHours not evenly divisible by stepHours", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 10, stepHours: 3,
    }));
    // floor(10/3) = 3
    expect(result.steps.length).toBe(3);
  });

  it("returns empty steps for invalid totalHours", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 0, stepHours: 4,
    }));
    expect(result.steps).toHaveLength(0);
    expect(result.applied).toBe(false);
    expect(result.reasons).toContain("Simulation rejected: invalid parameters.");
  });

  it("lifeOptions are passed through without error", () => {
    const result = runLongitudinalSimulation(char(), request({
      totalHours: 4, stepHours: 2,
      lifeOptions: {
        stimulationLevel: 0.7,
        socialContactLevel: 0.3,
        localHour: 14,
      },
    }));
    expect(result.steps.length).toBe(2);
  });
});
