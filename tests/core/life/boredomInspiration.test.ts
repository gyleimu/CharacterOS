import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOREDOM_EXPANSION_STATE,
  INSPIRATION_SEED_TYPES,
  applyBoredomExpansionDelta,
  buildBoredomExpansionContextFromCharacter,
  computeBoredomExpansionDelta,
  generateInspirationSeedCandidates,
  tickBoredomExpansion,
  type BoredomExpansionContext,
  type BoredomExpansionState,
} from "../../../src/core/life/boredomInspiration";
import type { DreamFragment } from "../../../src/core/life/dream";
import { DEFAULT_ENERGY_FATIGUE_STATE } from "../../../src/core/life/energyFatigue";
import { DEFAULT_SLEEP_WAKE_STATE } from "../../../src/core/life/sleepWake";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../../src/core/meta/metaState";

// ── Helpers ────────────────────────────────────────────────────────────

function defaultContext(
  overrides: Partial<BoredomExpansionContext> = {}
): BoredomExpansionContext {
  return {
    elapsedHours: 4,
    stimulationLevel: 0.3,
    socialContactLevel: 0.3,
    energy: 0.65,
    fatigue: 0.25,
    curiosity: 0.54,
    stressLoad: 0.3,
    sleepQuality: 0.65,
    ...overrides,
  };
}

// ── Default State ──────────────────────────────────────────────────────

describe("DEFAULT_BOREDOM_EXPANSION_STATE", () => {
  it("all values in [0,1]", () => {
    const s = DEFAULT_BOREDOM_EXPANSION_STATE;
    expect(s.boredom).toBeGreaterThanOrEqual(0);
    expect(s.boredom).toBeLessThanOrEqual(1);
    expect(s.restlessness).toBeGreaterThanOrEqual(0);
    expect(s.restlessness).toBeLessThanOrEqual(1);
    expect(s.daydreamingTendency).toBeGreaterThanOrEqual(0);
    expect(s.daydreamingTendency).toBeLessThanOrEqual(1);
    expect(s.explorationPressure).toBeGreaterThanOrEqual(0);
    expect(s.explorationPressure).toBeLessThanOrEqual(1);
    expect(s.irritability).toBeGreaterThanOrEqual(0);
    expect(s.irritability).toBeLessThanOrEqual(1);
  });
});

// ── Boredom ────────────────────────────────────────────────────────────

describe("boredom delta", () => {
  it("low stimulation increases boredom", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const trace = tickBoredomExpansion(
      state,
      defaultContext({ stimulationLevel: 0.1, socialContactLevel: 0.1, elapsedHours: 8 })
    );
    expect(trace.delta.boredomDelta).toBeGreaterThan(0);
    expect(trace.after.boredom).toBeGreaterThan(state.boredom);
  });

  it("high stimulation decreases boredom or slows growth", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.5,
    };
    const lowStim = tickBoredomExpansion(
      { ...bored },
      defaultContext({ stimulationLevel: 0.1, socialContactLevel: 0.5, elapsedHours: 8 })
    );
    const highStim = tickBoredomExpansion(
      { ...bored },
      defaultContext({ stimulationLevel: 0.9, socialContactLevel: 0.5, elapsedHours: 8 })
    );
    expect(highStim.after.boredom).toBeLessThan(lowStim.after.boredom);
  });

  it("low social contact increases boredom", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const lowSoc = tickBoredomExpansion(
      { ...state },
      defaultContext({ socialContactLevel: 0.1, elapsedHours: 8 })
    );
    const highSoc = tickBoredomExpansion(
      { ...state },
      defaultContext({ socialContactLevel: 0.9, elapsedHours: 8 })
    );
    expect(lowSoc.delta.boredomDelta).toBeGreaterThan(highSoc.delta.boredomDelta);
  });

  it("high fatigue suppresses boredom growth", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const fresh = tickBoredomExpansion(
      { ...state },
      defaultContext({ fatigue: 0.1, elapsedHours: 8 })
    );
    const tired = tickBoredomExpansion(
      { ...state },
      defaultContext({ fatigue: 0.9, elapsedHours: 8 })
    );
    expect(tired.delta.boredomDelta).toBeLessThan(fresh.delta.boredomDelta);
  });
});

// ── Restlessness ────────────────────────────────────────────────────────

describe("restlessness", () => {
  it("high boredom + energy increases restlessness", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.6,
    };
    const trace = tickBoredomExpansion(
      bored,
      defaultContext({ energy: 0.8, elapsedHours: 8 })
    );
    expect(trace.delta.restlessnessDelta).toBeGreaterThan(0);
    expect(trace.after.restlessness).toBeGreaterThan(bored.restlessness);
  });

  it("low boredom produces little restlessness", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE, boredom: 0.1 };
    const trace = tickBoredomExpansion(
      state,
      defaultContext({ elapsedHours: 8 })
    );
    // Restlessness should stay very low when boredom is low
    expect(trace.delta.restlessnessDelta).toBeLessThan(0.01);
  });
});

// ── Daydreaming ────────────────────────────────────────────────────────

describe("daydreaming tendency", () => {
  it("moderate boredom + good sleep increases daydreaming", () => {
    const moderate: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.4,
    };
    const trace = tickBoredomExpansion(
      moderate,
      defaultContext({ sleepQuality: 0.8, elapsedHours: 8 })
    );
    expect(trace.delta.daydreamingDelta).toBeGreaterThan(0);
  });

  it("high stress suppresses daydreaming", () => {
    const moderate: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.4,
    };
    const lowStress = tickBoredomExpansion(
      { ...moderate },
      defaultContext({ stressLoad: 0.2, sleepQuality: 0.8, elapsedHours: 4 })
    );
    const highStress = tickBoredomExpansion(
      { ...moderate },
      defaultContext({ stressLoad: 0.9, sleepQuality: 0.8, elapsedHours: 4 })
    );
    expect(highStress.delta.daydreamingDelta).toBeLessThan(
      lowStress.delta.daydreamingDelta
    );
  });

  it("high restlessness penalizes daydreaming", () => {
    const moderate: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.4,
    };
    const calmTrace = tickBoredomExpansion(
      { ...moderate, restlessness: 0.2 },
      defaultContext({ elapsedHours: 4 })
    );
    const restlessTrace = tickBoredomExpansion(
      { ...moderate, restlessness: 0.8 },
      defaultContext({ elapsedHours: 4 })
    );
    // High restlessness should reduce daydreaming relative to low restlessness
    expect(restlessTrace.delta.daydreamingDelta).toBeLessThan(
      calmTrace.delta.daydreamingDelta
    );
  });
});

// ── Exploration Pressure ───────────────────────────────────────────────

describe("exploration pressure", () => {
  it("high curiosity + boredom increases explorationPressure", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.55,
    };
    const trace = tickBoredomExpansion(
      bored,
      defaultContext({ curiosity: 0.9, elapsedHours: 8 })
    );
    expect(trace.delta.explorationPressureDelta).toBeGreaterThan(0);
    expect(trace.after.explorationPressure).toBeGreaterThan(
      bored.explorationPressure
    );
  });

  it("low curiosity produces little exploration pressure", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.55,
    };
    const highCur = tickBoredomExpansion(
      { ...bored },
      defaultContext({ curiosity: 0.8, elapsedHours: 8 })
    );
    const lowCur = tickBoredomExpansion(
      { ...bored },
      defaultContext({ curiosity: 0.1, elapsedHours: 8 })
    );
    expect(highCur.delta.explorationPressureDelta).toBeGreaterThan(
      lowCur.delta.explorationPressureDelta
    );
  });
});

// ── Irritability ───────────────────────────────────────────────────────

describe("irritability", () => {
  it("high fatigue + stress increases irritability when bored", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.5,
    };
    const trace = tickBoredomExpansion(
      bored,
      defaultContext({ fatigue: 0.8, stressLoad: 0.75, elapsedHours: 8 })
    );
    expect(trace.delta.irritabilityDelta).toBeGreaterThan(0);
    expect(trace.after.irritability).toBeGreaterThan(bored.irritability);
  });
});

// ── Output Clamping ────────────────────────────────────────────────────

describe("output clamping", () => {
  it("all outputs clamped [0,1]", () => {
    const extreme: BoredomExpansionState = {
      boredom: 0.99,
      restlessness: 0.99,
      daydreamingTendency: 0.99,
      explorationPressure: 0.99,
      irritability: 0.99,
    };
    const trace = tickBoredomExpansion(
      extreme,
      defaultContext({
        elapsedHours: 24,
        stimulationLevel: 0,
        socialContactLevel: 0,
      })
    );
    expect(trace.after.boredom).toBeGreaterThanOrEqual(0);
    expect(trace.after.boredom).toBeLessThanOrEqual(1);
    expect(trace.after.restlessness).toBeGreaterThanOrEqual(0);
    expect(trace.after.restlessness).toBeLessThanOrEqual(1);
    expect(trace.after.daydreamingTendency).toBeGreaterThanOrEqual(0);
    expect(trace.after.daydreamingTendency).toBeLessThanOrEqual(1);
    expect(trace.after.explorationPressure).toBeGreaterThanOrEqual(0);
    expect(trace.after.explorationPressure).toBeLessThanOrEqual(1);
    expect(trace.after.irritability).toBeGreaterThanOrEqual(0);
    expect(trace.after.irritability).toBeLessThanOrEqual(1);
  });
});

// ── Immutability ───────────────────────────────────────────────────────

describe("immutability", () => {
  it("tickBoredomExpansion does not mutate input state", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const frozen = { ...state };
    tickBoredomExpansion(state, defaultContext());
    expect(state).toEqual(frozen);
  });

  it("computeBoredomExpansionDelta does not mutate", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const frozen = { ...state };
    computeBoredomExpansionDelta(state, defaultContext());
    expect(state).toEqual(frozen);
  });

  it("applyBoredomExpansionDelta returns new object", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const delta = computeBoredomExpansionDelta(state, defaultContext());
    const result = applyBoredomExpansionDelta(state, delta);
    expect(result).not.toBe(state);
  });
});

// ── Trace ──────────────────────────────────────────────────────────────

describe("BoredomExpansionTrace", () => {
  it("contains before/after/delta/context/reasons/warnings", () => {
    const trace = tickBoredomExpansion(
      DEFAULT_BOREDOM_EXPANSION_STATE,
      defaultContext({ stimulationLevel: 0.1, socialContactLevel: 0.1, elapsedHours: 8 })
    );
    expect(trace.before).toBeDefined();
    expect(trace.after).toBeDefined();
    expect(trace.delta).toBeDefined();
    expect(trace.context).toBeDefined();
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });

  it("reasons mention low stimulation when applicable", () => {
    const trace = tickBoredomExpansion(
      DEFAULT_BOREDOM_EXPANSION_STATE,
      defaultContext({ stimulationLevel: 0.1 })
    );
    expect(trace.reasons.some((r) => r.toLowerCase().includes("stimulation"))).toBe(true);
  });

  it("reasons mention exploration when pressure building", () => {
    const bored: BoredomExpansionState = {
      ...DEFAULT_BOREDOM_EXPANSION_STATE,
      boredom: 0.5,
    };
    const trace = tickBoredomExpansion(
      bored,
      defaultContext({ curiosity: 0.9, elapsedHours: 8 })
    );
    expect(trace.reasons.some((r) => r.toLowerCase().includes("exploration"))).toBe(true);
  });
});

// ── Inspiration Seeds ──────────────────────────────────────────────────

describe("generateInspirationSeedCandidates", () => {
  it("returns empty array when boredom is very low", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: { ...DEFAULT_BOREDOM_EXPANSION_STATE, boredom: 0.05 },
      memorySourceCount: 10,
      curiosity: 0.6,
      seed: "test",
    });
    expect(candidates).toHaveLength(0);
  });

  it("high daydreaming creates creative_image or memory_association candidate", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.4,
        daydreamingTendency: 0.7,
      },
      memorySourceCount: 10,
      curiosity: 0.5,
      seed: "daydream-test",
    });
    expect(candidates.length).toBeGreaterThan(0);
    const types = candidates.map((c) => c.type);
    expect(
      types.some((t) => t === "creative_image" || t === "memory_association")
    ).toBe(true);
  });

  it("dreamFragment creates dream_residue candidate", () => {
    const dreamFragment: DreamFragment = {
      id: "dream-1",
      tone: "calm",
      intensity: 0.6,
      clarity: 0.5,
      sourceIds: ["s1"],
      symbols: ["rain", "window"],
      description: "rain, waiting, closed door",
      generated: true,
    };
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.4,
        daydreamingTendency: 0.5,
      },
      dreamFragment,
      memorySourceCount: 5,
      curiosity: 0.5,
      seed: "dream-residue-test",
    });
    expect(
      candidates.some((c) => c.source === "dream_residue")
    ).toBe(true);
    expect(
      candidates.some((c) => c.trigger.includes("Dream residue"))
    ).toBe(true);
  });

  it("high memoryCount creates memory_association candidate", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.35,
      },
      memorySourceCount: 30,
      curiosity: 0.5,
      seed: "memory-test",
    });
    expect(
      candidates.some((c) => c.type === "memory_association")
    ).toBe(true);
  });

  it("null/undefined dreamFragment does not crash", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.4,
        daydreamingTendency: 0.5,
      },
      memorySourceCount: 10,
      curiosity: 0.5,
      seed: "no-dream-test",
    });
    // Should not crash, should return candidates from non-dream sources
    expect(Array.isArray(candidates)).toBe(true);
    expect(
      candidates.every((c) => c.source !== "dream_residue")
    ).toBe(true);
  });

  it("irritability lowers probabilities", () => {
    const calm = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.5,
        daydreamingTendency: 0.6,
        explorationPressure: 0.5,
        irritability: 0.1,
      },
      memorySourceCount: 10,
      curiosity: 0.6,
      seed: "low-irrit",
    });
    const irritable = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.5,
        daydreamingTendency: 0.6,
        explorationPressure: 0.5,
        irritability: 0.9,
      },
      memorySourceCount: 10,
      curiosity: 0.6,
      seed: "high-irrit",
    });
    // If both have candidates, high irritability should have lower avg probability
    if (calm.length > 0 && irritable.length > 0) {
      const calmAvg =
        calm.reduce((s, c) => s + c.probability, 0) / calm.length;
      const irritAvg =
        irritable.reduce((s, c) => s + c.probability, 0) / irritable.length;
      expect(irritAvg).toBeLessThanOrEqual(calmAvg);
    }
  });

  it("is deterministic: same seed → same candidates", () => {
    const input = {
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.5,
        daydreamingTendency: 0.6,
        explorationPressure: 0.4,
        irritability: 0.2,
      },
      dreamFragment: {
        id: "d",
        tone: "warm" as const,
        intensity: 0.5,
        clarity: 0.5,
        sourceIds: [],
        symbols: ["light"],
        description: "warm light",
        generated: true,
      } satisfies DreamFragment,
      memorySourceCount: 15,
      curiosity: 0.6,
      seed: "determinism-test",
    };
    const c1 = generateInspirationSeedCandidates(input);
    const c2 = generateInspirationSeedCandidates(input);
    expect(c1).toEqual(c2);
  });

  it("different seed may produce different id order", () => {
    const baseInput = {
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.5,
        daydreamingTendency: 0.6,
        explorationPressure: 0.4,
      },
      memorySourceCount: 10,
      curiosity: 0.6,
    };
    const c1 = generateInspirationSeedCandidates({ ...baseInput, seed: "alpha" });
    const c2 = generateInspirationSeedCandidates({ ...baseInput, seed: "beta" });
    // IDs should differ since they embed the seed
    if (c1.length > 0 && c2.length > 0) {
      expect(c1[0]!.id).not.toBe(c2[0]!.id);
    }
  });

  it("respects limit", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.6,
        daydreamingTendency: 0.7,
        explorationPressure: 0.6,
      },
      dreamFragment: {
        id: "d",
        tone: "calm" as const,
        intensity: 0.5,
        clarity: 0.5,
        sourceIds: [],
        symbols: [],
        description: "quiet",
        generated: true,
      } satisfies DreamFragment,
      memorySourceCount: 40,
      curiosity: 0.7,
      seed: "limit-test",
      limit: 2,
    });
    expect(candidates.length).toBeLessThanOrEqual(2);
  });

  it("defaults to limit 3", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.6,
        daydreamingTendency: 0.7,
        explorationPressure: 0.6,
      },
      memorySourceCount: 40,
      curiosity: 0.7,
      seed: "default-limit-test",
    });
    expect(candidates.length).toBeLessThanOrEqual(3);
  });

  it("all candidates have evaluated=false", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.5,
        daydreamingTendency: 0.6,
        explorationPressure: 0.4,
      },
      memorySourceCount: 20,
      curiosity: 0.6,
      seed: "eval-test",
    });
    for (const c of candidates) {
      expect(c.evaluated).toBe(false);
      expect(c.probability).toBeGreaterThanOrEqual(0);
      expect(c.probability).toBeLessThanOrEqual(1);
    }
  });

  it("quiet_realization appears when boredom high + irritability low", () => {
    const candidates = generateInspirationSeedCandidates({
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.6,
        daydreamingTendency: 0.4,
        explorationPressure: 0.3,
        irritability: 0.2,
      },
      memorySourceCount: 1,
      curiosity: 0.6,
      seed: "quiet-test",
    });
    expect(
      candidates.some((c) => c.type === "quiet_realization")
    ).toBe(true);
  });
});

// ── Inspiration Seed Types ─────────────────────────────────────────────

describe("INSPIRATION_SEED_TYPES", () => {
  it("has exactly 5 types", () => {
    expect(INSPIRATION_SEED_TYPES).toHaveLength(5);
  });

  it("all distinct", () => {
    expect(new Set(INSPIRATION_SEED_TYPES).size).toBe(INSPIRATION_SEED_TYPES.length);
  });

  it("includes memory_association and creative_image", () => {
    expect(INSPIRATION_SEED_TYPES).toContain("memory_association");
    expect(INSPIRATION_SEED_TYPES).toContain("creative_image");
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildBoredomExpansionContextFromCharacter", () => {
  it("reads curiosity from metaState", () => {
    const char = createCharacterPhysicsState();
    const meta = defaultMetaState();
    const ctx = buildBoredomExpansionContextFromCharacter({
      state: char,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      elapsedHours: 4,
      stimulationLevel: 0.4,
      socialContactLevel: 0.5,
    });
    expect(ctx.curiosity).toBe(meta.curiosity);
  });

  it("reads stressLoad from boundary", () => {
    const char = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
    });
    const ctx = buildBoredomExpansionContextFromCharacter({
      state: char,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      elapsedHours: 4,
      stimulationLevel: 0.4,
      socialContactLevel: 0.5,
    });
    expect(ctx.stressLoad).toBe(0.35);
  });

  it("reads energy/fatigue from energyFatigue state", () => {
    const ctx = buildBoredomExpansionContextFromCharacter({
      state: createCharacterPhysicsState(),
      energyFatigue: { energy: 0.5, fatigue: 0.6, sleepPressure: 0.3, restDebt: 0.2 },
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      elapsedHours: 4,
      stimulationLevel: 0.4,
      socialContactLevel: 0.5,
    });
    expect(ctx.energy).toBe(0.5);
    expect(ctx.fatigue).toBe(0.6);
  });

  it("reads sleepQuality from sleepWake state", () => {
    const ctx = buildBoredomExpansionContextFromCharacter({
      state: createCharacterPhysicsState(),
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, sleepQuality: 0.72 },
      elapsedHours: 4,
      stimulationLevel: 0.4,
      socialContactLevel: 0.5,
    });
    expect(ctx.sleepQuality).toBe(0.72);
  });

  it("clamps all fields to [0,1]", () => {
    const ctx = buildBoredomExpansionContextFromCharacter({
      state: createCharacterPhysicsState(),
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      elapsedHours: 4,
      stimulationLevel: 1.5,
      socialContactLevel: -0.5,
    });
    expect(ctx.stimulationLevel).toBe(1);
    expect(ctx.socialContactLevel).toBe(0);
  });

  it("does not modify input objects", () => {
    const char = createCharacterPhysicsState();
    const ef = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const sw = { ...DEFAULT_SLEEP_WAKE_STATE };
    const frozenChar = { ...char.boundary, ...char.metaState };
    buildBoredomExpansionContextFromCharacter({
      state: char, energyFatigue: ef, sleepWake: sw,
      elapsedHours: 4, stimulationLevel: 0.3, socialContactLevel: 0.3,
    });
    expect(char.boundary.stressLoad).toBe(frozenChar.stressLoad);
    expect(char.metaState.curiosity).toBe(frozenChar.curiosity);
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("determinism", () => {
  it("tickBoredomExpansion same inputs → same output", () => {
    const state = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const ctx = defaultContext({ elapsedHours: 4 });
    const t1 = tickBoredomExpansion(state, ctx);
    const t2 = tickBoredomExpansion(state, ctx);
    expect(t1.delta).toEqual(t2.delta);
    expect(t1.after).toEqual(t2.after);
  });
});
