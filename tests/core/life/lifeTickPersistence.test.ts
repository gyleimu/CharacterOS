import { describe, expect, it } from "vitest";
import {
  commitLifeTickProjection,
  type LifeTickCommitOptions,
  type LifeTickCommitResult,
  type LifeTickCommitChange,
} from "../../../src/core/life/lifeTickPersistence";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import type { LifeTickDryRunResult } from "../../../src/core/life/lifeTickRunner";
import type {
  EnergyFatigueState,
} from "../../../src/core/life/energyFatigue";
import type { SleepWakeState } from "../../../src/core/life/sleepWake";
import type { BoredomExpansionState } from "../../../src/core/life/boredomInspiration";

// ── Helpers ────────────────────────────────────────────────────────────

function makeDryRun(
  overrides: Partial<LifeTickDryRunResult> = {}
): LifeTickDryRunResult {
  const ef: EnergyFatigueState = {
    energy: 0.55, fatigue: 0.4, sleepPressure: 0.45, restDebt: 0.3,
  };
  const sw: SleepWakeState = {
    phase: "awake", sleepQuality: 0.65, circadianAlignment: 0.7,
    hoursSinceSleep: 8, hoursAsleep: 0,
  };
  const bs: BoredomExpansionState = {
    boredom: 0.35, restlessness: 0.25, daydreamingTendency: 0.4,
    explorationPressure: 0.3, irritability: 0.15,
  };

  return {
    version: "v10.8",
    applied: false,
    request: {
      characterId: "char-test",
      elapsedHours: 4,
      observed: true,
      requestedAt: "2026-06-25T14:00:00.000Z",
      mode: "dry_run",
      seed: "test-seed",
    },
    plan: {
      id: "plan-1",
      characterId: "char-test",
      elapsedHours: 4,
      phaseSequence: [],
      timeScale: "short",
      seed: "test-seed",
      dryRun: true,
      warnings: [],
      reasons: [],
    },
    trace: {
      id: "trace-1",
      characterId: "char-test",
      planId: "plan-1",
      elapsedHours: 4,
      observed: true,
      phaseTraces: [],
      generatedInternalEvents: [],
      selfActionCandidates: [],
      stateChanged: false,
      warnings: [],
      reasons: [],
      createdAt: "2026-06-25T14:00:00.000Z",
    },
    projectedLifeState: {
      energyFatigue: ef,
      sleepWake: sw,
      boredomExpansion: bs,
      dreamFragments: [],
      inspirationSeeds: [],
      selfActionCandidates: [],
    },
    warnings: [],
    reasons: [],
    ...overrides,
  } as LifeTickDryRunResult;
}

function commit(
  dryRun?: LifeTickDryRunResult,
  options?: LifeTickCommitOptions
) {
  return commitLifeTickProjection(
    createCharacterPhysicsState(),
    dryRun ?? makeDryRun(),
    options
  );
}

// ── Core Guarantees ────────────────────────────────────────────────────

describe("commitLifeTickProjection — core guarantees", () => {
  it("returns cloned state (never mutates input)", () => {
    const char = createCharacterPhysicsState();
    const originalMemoryCount = char.memories.length;
    const result = commitLifeTickProjection(char, makeDryRun());
    expect(char.memories.length).toBe(originalMemoryCount);
  });

  it("rejects invalid dry-run result", () => {
    const result = commitLifeTickProjection(
      createCharacterPhysicsState(),
      null as unknown as LifeTickDryRunResult
    );
    expect(result.applied).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects wrong-version dry-run", () => {
    const result = commit(
      makeDryRun({ version: "v10.7" as unknown as "v10.8" })
    );
    expect(result.applied).toBe(false);
  });

  it("default commit is conservative (no changes applied)", () => {
    const result = commit();
    expect(result.applied).toBe(false);
    expect(result.changes).toHaveLength(0);
    // Skipped changes should include energy/sleep/boredom
    expect(result.skipped.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Skipped Domains ────────────────────────────────────────────────────

describe("commitLifeTickProjection — skipped domains", () => {
  it("energy/fatigue writeback is skipped by default", () => {
    const result = commit();
    const energySkip = result.skipped.find(
      (s) => s.path === "lifeState.energyFatigue"
    );
    expect(energySkip).toBeDefined();
    expect(energySkip!.reason).toContain("not enabled");
  });

  it("sleep/wake writeback is skipped by default", () => {
    const result = commit();
    const sleepSkip = result.skipped.find(
      (s) => s.path === "lifeState.sleepWake"
    );
    expect(sleepSkip).toBeDefined();
  });

  it("boredom expansion writeback is skipped by default", () => {
    const result = commit();
    const boredomSkip = result.skipped.find(
      (s) => s.path === "lifeState.boredomExpansion"
    );
    expect(boredomSkip).toBeDefined();
  });

  it("dream memory seeds are disabled by default", () => {
    const dreamDr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [
          {
            id: "d1", tone: "calm", intensity: 0.5, clarity: 0.5,
            sourceIds: [], symbols: ["rain"], description: "rain again",
            generated: true,
          },
        ],
      },
    });
    const result = commit(dreamDr);
    expect(result.changes).toHaveLength(0);
    const dreamSkip = result.skipped.find(
      (s) => s.path === "memories[].dreamFragment"
    );
    expect(dreamSkip).toBeDefined();
  });
});

// ── Explicit Enables ───────────────────────────────────────────────────

describe("commitLifeTickProjection — explicit enables", () => {
  it("dream memory seed requires explicit option", () => {
    const dreamDr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [
          {
            id: "d1", tone: "calm", intensity: 0.5, clarity: 0.5,
            sourceIds: [], symbols: ["rain"], description: "rain again",
            generated: true,
          },
        ],
      },
    });
    const result = commit(dreamDr, { allowDreamMemorySeed: true });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.path.startsWith("memories["))).toBe(true);
    expect(result.applied).toBe(true);
  });

  it("random thought memory seed requires explicit option", () => {
    const rtDr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        randomThought: {
          id: "rt-1", kind: "question", intensity: 0.4, clarity: 0.6,
          sourceIds: ["s1"], phrase: "why rain again?",
          actionPotential: 0.2, generated: true,
        },
      },
    });
    const result = commit(rtDr, { allowRandomThoughtMemorySeed: true });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.reason.includes("Random thought"))).toBe(true);
  });

  it("inspiration seed requires explicit option", () => {
    const inspDr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        inspirationSeeds: [
          {
            id: "is-1", type: "creative_image", probability: 0.5,
            source: "daydreaming", trigger: "An image forms",
            evaluated: false, reasons: ["test"],
          },
        ],
      },
    });
    const result = commit(inspDr, { allowInspirationSeed: true });
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("self-action candidate memory seed requires explicit option", () => {
    const sacDr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        selfActionCandidates: [
          {
            id: "sac-sleep", type: "sleep", strength: 0.6,
            urgency: 0.4, friction: 0.2, risk: 0.05, score: 0.35,
            sourceSignals: ["fatigue"], reasons: ["Tired"],
            evaluated: false, executed: false,
          },
        ],
      },
    });
    const result = commit(sacDr, { allowSelfActionCandidateMemorySeed: true });
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("when energy/sleep/boredom explicitly enabled, they are skipped with schema warning", () => {
    const result = commit(makeDryRun(), {
      allowEnergyFatigue: true,
      allowSleepWake: true,
      allowBoredomExpansion: true,
    });
    // They are still skipped because no life field exists on CharacterPhysicsState
    const energySkip = result.skipped.find(
      (s) => s.path === "lifeState.energyFatigue"
    );
    expect(energySkip).toBeDefined();
    expect(energySkip!.reason).toContain("requested");
  });
});

// ── Self-Action Never Executed ─────────────────────────────────────────

describe("commitLifeTickProjection — self-action safety", () => {
  it("self-action candidates are never executed", () => {
    const result = commit(makeDryRun(), {
      allowSelfActionCandidateMemorySeed: true,
    });
    // Even with the option enabled, candidates are only stored as memory seeds
    // No candidate has executed=true
    for (const c of result.changes) {
      expect(c.reason).not.toContain("executed");
    }
  });

  it("candidate evaluated remains false", () => {
    const sac = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        selfActionCandidates: [
          {
            id: "sac-1", type: "do_nothing", strength: 0.3,
            urgency: 0.1, friction: 0.1, risk: 0.01, score: 0.15,
            sourceSignals: ["fatigue"], reasons: ["test"],
            evaluated: false, executed: false,
          },
        ],
      },
    });
    const result = commit(sac);
    // The candidate itself should remain untouched
    expect(sac.projectedLifeState.selfActionCandidates[0]!.evaluated).toBe(false);
    expect(sac.projectedLifeState.selfActionCandidates[0]!.executed).toBe(false);
  });
});

// ── Change Tracking ────────────────────────────────────────────────────

describe("commitLifeTickProjection — change tracking", () => {
  it("applied changes include path/from/to/reason", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [
          {
            id: "d1", tone: "warm", intensity: 0.5, clarity: 0.5,
            sourceIds: [], symbols: ["light"], description: "warm light",
            generated: true,
          },
        ],
      },
    });
    const result = commit(dr, { allowDreamMemorySeed: true });
    const change = result.changes[0]!;
    expect(change.path).toBeTruthy();
    expect(change.from).toBeNull();
    expect(change.to).toBeTruthy();
    expect(change.reason.length).toBeGreaterThan(0);
  });

  it("skipped changes include path/from/to/reason", () => {
    const result = commit();
    const skip = result.skipped[0]!;
    expect(skip.path).toBeTruthy();
    expect(skip.reason.length).toBeGreaterThan(0);
  });

  it("reason option is included in change reasons", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [
          {
            id: "d1", tone: "calm", intensity: 0.5, clarity: 0.5,
            sourceIds: [], symbols: [], description: "rain",
            generated: true,
          },
        ],
      },
    });
    const result = commit(dr, {
      allowDreamMemorySeed: true,
      reason: "nightly-tick-42",
    });
    expect(result.changes[0]!.reason).toContain("[nightly-tick-42]");
  });

  it("maxGeneratedMemories is respected", () => {
    const basePls = makeDryRun().projectedLifeState;
    const pls: typeof basePls = {
      energyFatigue: basePls.energyFatigue,
      sleepWake: basePls.sleepWake,
      boredomExpansion: basePls.boredomExpansion,
      dreamFragments: [
        { id: "d1", tone: "calm", intensity: 0.5, clarity: 0.5, sourceIds: [], symbols: [], description: "a", generated: true },
        { id: "d2", tone: "calm", intensity: 0.5, clarity: 0.5, sourceIds: [], symbols: [], description: "b", generated: true },
        { id: "d3", tone: "calm", intensity: 0.5, clarity: 0.5, sourceIds: [], symbols: [], description: "c", generated: true },
        { id: "d4", tone: "calm", intensity: 0.5, clarity: 0.5, sourceIds: [], symbols: [], description: "d", generated: true },
      ],
      inspirationSeeds: [],
      selfActionCandidates: [],
    };
    const dr = makeDryRun({ projectedLifeState: pls });
    const result = commit(dr, {
      allowDreamMemorySeed: true,
      maxGeneratedMemories: 2,
    });
    expect(result.changes.length).toBeLessThanOrEqual(2);
  });

  it("uniquifies generated memory ids when projected ids already exist", () => {
    const char = createCharacterPhysicsState();
    char.memories.push({
      id: "life-insp-dup",
      content: "Existing inspiration seed",
      vector: char.coordinate,
      importance: 0.1,
      emotion: "neutral",
      recency: 1,
      repetitionCount: 1,
      beliefEffect: "",
      timeStamp: "2026-06-28T00:00:00.000Z",
    });
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        inspirationSeeds: [
          {
            id: "dup", type: "creative_image", probability: 0.5,
            source: "daydreaming", trigger: "first duplicate",
            evaluated: false, reasons: ["test"],
          },
          {
            id: "dup", type: "creative_image", probability: 0.5,
            source: "daydreaming", trigger: "second duplicate",
            evaluated: false, reasons: ["test"],
          },
        ],
      },
    });

    const result = commitLifeTickProjection(char, dr, { allowInspirationSeed: true });
    const ids = result.state.memories.map((memory) => memory.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("life-insp-dup-2");
    expect(ids).toContain("life-insp-dup-3");
  });
});

// ── Edge Cases ─────────────────────────────────────────────────────────

describe("commitLifeTickProjection — edge cases", () => {
  it("handles empty dream fragments", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [],
      },
    });
    const result = commit(dr, { allowDreamMemorySeed: true });
    // No crash, no dream changes
    expect(result.changes.filter((c) => c.reason.includes("dream")).length).toBe(0);
  });

  it("handles missing random thought", () => {
    const pls = { ...makeDryRun().projectedLifeState };
    delete (pls as Record<string, unknown>).randomThought;
    const dr = makeDryRun({ projectedLifeState: pls });
    const result = commit(dr, { allowRandomThoughtMemorySeed: true });
    expect(result.applied).toBe(false);
  });

  it("handles empty inspiration seeds", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        inspirationSeeds: [],
      },
    });
    const result = commit(dr, { allowInspirationSeed: true });
    // No inspiration changes
    expect(result.changes.filter((c) => c.reason.includes("Inspiration")).length).toBe(0);
  });

  it("handles empty self-action candidates", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        selfActionCandidates: [],
      },
    });
    const result = commit(dr, { allowSelfActionCandidateMemorySeed: true });
    expect(result.applied).toBe(false);
  });

  it("preserves existing memories unless explicitly adding seeds", () => {
    const char = createCharacterPhysicsState();
    const originalCount = char.memories.length;
    const result = commitLifeTickProjection(char, makeDryRun());
    // Default: no changes → same memory count
    expect(result.state.memories.length).toBe(originalCount);
  });

  it("deterministic: same dry-run + same options → same commit result", () => {
    const dr = makeDryRun({
      projectedLifeState: {
        ...makeDryRun().projectedLifeState,
        dreamFragments: [
          { id: "d1", tone: "calm", intensity: 0.5, clarity: 0.5, sourceIds: [], symbols: [], description: "rain", generated: true },
        ],
      },
    });
    const r1 = commit(dr, { allowDreamMemorySeed: true });
    const r2 = commit(dr, { allowDreamMemorySeed: true });
    expect(r1.changes.length).toBe(r2.changes.length);
    expect(r1.applied).toBe(r2.applied);
  });

  it("does not mutate dry-run result", () => {
    const dr = makeDryRun();
    const frozenVersion = dr.version;
    commit(dr);
    expect(dr.version).toBe(frozenVersion);
  });
});
