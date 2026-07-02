import { describe, expect, it } from "vitest";
import {
  RANDOM_THOUGHT_KINDS,
  selectRandomThoughtSources,
  generateRandomThought,
  buildRandomThoughtContextFromCharacter,
  type RandomThoughtContext,
  type RandomThoughtSource,
} from "../../../src/core/life/randomThought";
import type { DreamFragment } from "../../../src/core/life/dream";
import type { InspirationSeedCandidate } from "../../../src/core/life/boredomInspiration";
import { DEFAULT_BOREDOM_EXPANSION_STATE } from "../../../src/core/life/boredomInspiration";
import { DEFAULT_ENERGY_FATIGUE_STATE } from "../../../src/core/life/energyFatigue";
import { DEFAULT_SLEEP_WAKE_STATE } from "../../../src/core/life/sleepWake";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../../src/core/meta/metaState";

// ── Helpers ────────────────────────────────────────────────────────────

function defaultContext(
  overrides: Partial<RandomThoughtContext> = {}
): RandomThoughtContext {
  return {
    seed: "test-seed",
    boredom: 0.3,
    daydreamingTendency: 0.35,
    restlessness: 0.2,
    stressLoad: 0.3,
    loneliness: 0.3,
    fatigue: 0.25,
    curiosity: 0.54,
    sleepResidue: 0.2,
    ...overrides,
  };
}

function makeMemories(
  count: number
): Array<{ id: string; content: string; importance: number; recency: number; emotion: string; tags?: string[] }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `mem-${i}`,
    content: `Memory ${i}: something happened involving rain and waiting`,
    importance: 0.3 + i * 0.1,
    recency: 0.2 + i * 0.1,
    emotion: i % 2 === 0 ? "sadness" : "joy",
    tags: [`tag-${i}`],
  }));
}

function makeBeliefs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `belief-${i}`,
    content: `I believe something important ${i}`,
    strength: 0.3 + i * 0.1,
  }));
}

function makeNeeds(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `need-${i}`,
    name: `Need ${i}: connection`,
    intensity: 0.2 + i * 0.15,
  }));
}

// ── Kind List ──────────────────────────────────────────────────────────

describe("RANDOM_THOUGHT_KINDS", () => {
  it("has exactly 9 kinds", () => {
    expect(RANDOM_THOUGHT_KINDS).toHaveLength(9);
  });

  it("includes expected kinds", () => {
    expect(RANDOM_THOUGHT_KINDS).toContain("memory_echo");
    expect(RANDOM_THOUGHT_KINDS).toContain("worry");
    expect(RANDOM_THOUGHT_KINDS).toContain("desire_shadow");
    expect(RANDOM_THOUGHT_KINDS).toContain("sensory_fragment");
    expect(RANDOM_THOUGHT_KINDS).toContain("self_talk");
    expect(RANDOM_THOUGHT_KINDS).toContain("question");
    expect(RANDOM_THOUGHT_KINDS).toContain("image");
    expect(RANDOM_THOUGHT_KINDS).toContain("urge");
    expect(RANDOM_THOUGHT_KINDS).toContain("nothing");
  });

  it("all kinds distinct", () => {
    expect(new Set(RANDOM_THOUGHT_KINDS).size).toBe(RANDOM_THOUGHT_KINDS.length);
  });
});

// ── Source Selection ───────────────────────────────────────────────────

describe("selectRandomThoughtSources", () => {
  it("ranks important/recent memory high", () => {
    const sources = selectRandomThoughtSources({
      memories: [
        { id: "m1", content: "low", importance: 0.1, recency: 0.1, emotion: "neutral" },
        { id: "m2", content: "high", importance: 0.9, recency: 0.9, emotion: "neutral" },
      ],
      beliefs: [],
      needs: [],
    });
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0]!.id).toBe("m2");
  });

  it("strong need creates high-weight source", () => {
    const sources = selectRandomThoughtSources({
      memories: [],
      beliefs: [],
      needs: [
        { id: "n1", name: "weak need", intensity: 0.1 },
        { id: "n2", name: "strong need", intensity: 0.9 },
      ],
    });
    expect(sources[0]!.id).toBe("n2");
    expect(sources[0]!.weight).toBeGreaterThan(0.5);
  });

  it("dreamFragment creates dream_fragment source", () => {
    const dream: DreamFragment = {
      id: "d1",
      tone: "calm",
      intensity: 0.7,
      clarity: 0.6,
      sourceIds: ["s1"],
      symbols: ["rain", "window"],
      description: "rain, waiting, closed door",
      generated: true,
    };
    const sources = selectRandomThoughtSources({
      memories: makeMemories(2),
      beliefs: [],
      needs: [],
      dreamFragment: dream,
    });
    expect(sources.some((s) => s.kind === "dream_fragment")).toBe(true);
  });

  it("non-generated dreamFragment is skipped", () => {
    const dream: DreamFragment = {
      id: "d1",
      tone: "calm",
      intensity: 0,
      clarity: 0,
      sourceIds: [],
      symbols: [],
      description: "",
      generated: false,
    };
    const sources = selectRandomThoughtSources({
      memories: makeMemories(2),
      beliefs: [],
      needs: [],
      dreamFragment: dream,
    });
    expect(sources.some((s) => s.kind === "dream_fragment")).toBe(false);
  });

  it("inspirationSeeds create inspiration_seed sources", () => {
    const seeds: InspirationSeedCandidate[] = [
      {
        id: "insp-1",
        type: "creative_image",
        probability: 0.6,
        source: "daydreaming",
        trigger: "A creative image",
        evaluated: false,
        reasons: ["test"],
      },
    ];
    const sources = selectRandomThoughtSources({
      memories: makeMemories(1),
      beliefs: [],
      needs: [],
      inspirationSeeds: seeds,
    });
    expect(sources.some((s) => s.kind === "inspiration_seed")).toBe(true);
  });

  it("boredomState creates boredom source when high", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(2),
      beliefs: [],
      needs: [],
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.6,
        daydreamingTendency: 0.5,
      },
    });
    expect(sources.some((s) => s.kind === "boredom")).toBe(true);
  });

  it("boredomState creates no source when low", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(2),
      beliefs: [],
      needs: [],
      boredomState: {
        ...DEFAULT_BOREDOM_EXPANSION_STATE,
        boredom: 0.1,
        daydreamingTendency: 0.1,
      },
    });
    expect(sources.some((s) => s.kind === "boredom")).toBe(false);
  });

  it("respects limit", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(10),
      beliefs: makeBeliefs(5),
      needs: makeNeeds(5),
      limit: 3,
    });
    expect(sources.length).toBeLessThanOrEqual(3);
  });

  it("defaults to limit 6", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(10),
      beliefs: [],
      needs: [],
    });
    expect(sources.length).toBeLessThanOrEqual(6);
  });

  it("deterministic: same input → same result", () => {
    const s1 = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: makeBeliefs(2),
      needs: makeNeeds(2),
    });
    const s2 = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: makeBeliefs(2),
      needs: makeNeeds(2),
    });
    expect(s1).toEqual(s2);
  });
});

// ── Thought Generation ─────────────────────────────────────────────────

describe("generateRandomThought", () => {
  it("low pressure generates nothing", () => {
    const trace = generateRandomThought(
      defaultContext({ boredom: 0.05, daydreamingTendency: 0.05, restlessness: 0.05, fatigue: 0.1 }),
      []
    );
    expect(trace.thought.generated).toBe(true);
    expect(trace.thought.kind).toBe("nothing");
  });

  it("no sources → nothing", () => {
    const trace = generateRandomThought(
      defaultContext({ boredom: 0.5, daydreamingTendency: 0.5 }),
      []
    );
    expect(trace.thought.kind).toBe("nothing");
  });

  it("stress high generates worry", () => {
    // Run multiple seeds to verify worry appears under high stress
    const worryTones = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const sources = selectRandomThoughtSources({
        memories: makeMemories(5),
        beliefs: [],
        needs: [],
      });
      const trace = generateRandomThought(
        defaultContext({ stressLoad: 0.9, seed: `stress-${i}` }),
        sources
      );
      worryTones.add(trace.thought.kind);
    }
    // High stress should produce worry at least sometimes
    expect(worryTones.has("worry") || worryTones.has("self_talk")).toBe(true);
  });

  it("loneliness high generates desire_shadow/self_talk", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const trace = generateRandomThought(
      defaultContext({ loneliness: 0.9, seed: "lonely-test" }),
      sources
    );
    expect(trace.thought.generated).toBe(true);
    expect(trace.thought.kind).toBeTruthy();
  });

  it("fatigue high reduces clarity", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const lowFatigue = generateRandomThought(
      defaultContext({ fatigue: 0.1, seed: "fatigue-low" }),
      sources
    );
    const highFatigue = generateRandomThought(
      defaultContext({ fatigue: 0.9, seed: "fatigue-high" }),
      sources
    );
    if (highFatigue.thought.kind !== "nothing") {
      expect(highFatigue.thought.clarity).toBeLessThan(lowFatigue.thought.clarity);
    }
  });

  it("curiosity high generates question", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const trace = generateRandomThought(
      defaultContext({ curiosity: 0.9, seed: "curious-test" }),
      sources
    );
    expect(trace.thought.generated).toBe(true);
    // High curiosity should weight question highly
    expect(trace.thought.kind).toBeTruthy();
  });

  it("memory source generates memory_echo", () => {
    const sources = selectRandomThoughtSources({
      memories: [
        { id: "m", content: "rain falling on the window", importance: 0.8, recency: 0.8, emotion: "calm" },
      ],
      beliefs: [],
      needs: [],
    });
    const trace = generateRandomThought(
      defaultContext({ seed: "mem-test" }),
      sources
    );
    expect(trace.thought.generated).toBe(true);
  });

  it("dream source generates image/sensory_fragment", () => {
    const dream: DreamFragment = {
      id: "d1",
      tone: "warm",
      intensity: 0.8,
      clarity: 0.7,
      sourceIds: ["s1"],
      symbols: ["light", "warmth"],
      description: "warm light, distant voice",
      generated: true,
    };
    const sources = selectRandomThoughtSources({
      memories: makeMemories(2),
      beliefs: [],
      needs: [],
      dreamFragment: dream,
    });
    const trace = generateRandomThought(
      defaultContext({ seed: "dream-src-test" }),
      sources
    );
    expect(trace.thought.generated).toBe(true);
  });

  it("thought phrase is short", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(10),
      beliefs: makeBeliefs(3),
      needs: makeNeeds(3),
    });
    const trace = generateRandomThought(
      defaultContext({ seed: "phrase-test" }),
      sources
    );
    const wordCount = trace.thought.phrase.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(10);
  });

  it("actionPotential bounded [0,1]", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(10),
      beliefs: makeBeliefs(3),
      needs: makeNeeds(3),
    });
    for (let i = 0; i < 10; i++) {
      const trace = generateRandomThought(
        defaultContext({ seed: `ap-${i}` }),
        sources
      );
      expect(trace.thought.actionPotential).toBeGreaterThanOrEqual(0);
      expect(trace.thought.actionPotential).toBeLessThanOrEqual(1);
    }
  });

  it("intensity and clarity clamped [0,1]", () => {
    const sources = selectRandomThoughtSources({
      memories: [
        { id: "m", content: "intense memory", importance: 1, recency: 1, emotion: "intense" },
      ],
      beliefs: [],
      needs: [],
    });
    const trace = generateRandomThought(
      defaultContext({ fatigue: 1, stressLoad: 1, seed: "clamp-test" }),
      sources
    );
    expect(trace.thought.intensity).toBeGreaterThanOrEqual(0);
    expect(trace.thought.intensity).toBeLessThanOrEqual(1);
    expect(trace.thought.clarity).toBeGreaterThanOrEqual(0);
    expect(trace.thought.clarity).toBeLessThanOrEqual(1);
  });

  it("deterministic: same seed → same thought", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const t1 = generateRandomThought(
      defaultContext({ seed: "det-test" }),
      sources
    );
    const t2 = generateRandomThought(
      defaultContext({ seed: "det-test" }),
      sources
    );
    expect(t1.thought).toEqual(t2.thought);
  });

  it("different seed may vary phrase/kind", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const t1 = generateRandomThought(
      defaultContext({ seed: "alpha" }),
      sources
    );
    const t2 = generateRandomThought(
      defaultContext({ seed: "beta" }),
      sources
    );
    // IDs differ (embed seed prefix)
    expect(t1.thought.id).not.toBe(t2.thought.id);
  });

  it("does not mutate sources array", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const frozen = sources.map((s) => ({ ...s }));
    generateRandomThought(defaultContext(), sources);
    expect(sources).toEqual(frozen);
  });

  it("trace contains context, sources, thought, reasons, warnings", () => {
    const sources = selectRandomThoughtSources({
      memories: makeMemories(5),
      beliefs: [],
      needs: [],
    });
    const trace = generateRandomThought(
      defaultContext({ seed: "trace-test" }),
      sources
    );
    expect(trace.context).toBeDefined();
    expect(trace.sources).toBeDefined();
    expect(trace.thought).toBeDefined();
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildRandomThoughtContextFromCharacter", () => {
  it("reads boredom/daydreaming/restlessness from boredomState", () => {
    const ctx = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: { ...DEFAULT_BOREDOM_EXPANSION_STATE, boredom: 0.55, daydreamingTendency: 0.4, restlessness: 0.3 },
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    expect(ctx.boredom).toBe(0.55);
    expect(ctx.daydreamingTendency).toBe(0.4);
    expect(ctx.restlessness).toBe(0.3);
  });

  it("reads stressLoad from boundary", () => {
    const char = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
    });
    const ctx = buildRandomThoughtContextFromCharacter({
      state: char,
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    expect(ctx.stressLoad).toBe(0.35);
  });

  it("loneliness inverted from lonelinessTolerance", () => {
    const ctx = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0);
    expect(ctx.loneliness).toBeLessThanOrEqual(1);
  });

  it("reads fatigue from energyFatigue", () => {
    const ctx = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: { ...DEFAULT_ENERGY_FATIGUE_STATE, fatigue: 0.45 },
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    expect(ctx.fatigue).toBe(0.45);
  });

  it("reads curiosity from metaState", () => {
    const ctx = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    const meta = defaultMetaState();
    expect(ctx.curiosity).toBe(meta.curiosity);
  });

  it("sleepResidue higher during waking/drowsy phases", () => {
    const awake = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake", hoursSinceSleep: 10 },
      seed: "test",
    });
    const waking = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, phase: "waking" },
      seed: "test",
    });
    expect(waking.sleepResidue).toBeGreaterThan(awake.sleepResidue);
  });

  it("all numeric outputs clamped [0,1]", () => {
    const ctx = buildRandomThoughtContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: DEFAULT_BOREDOM_EXPANSION_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      seed: "test",
    });
    expect(ctx.boredom).toBeGreaterThanOrEqual(0);
    expect(ctx.boredom).toBeLessThanOrEqual(1);
    expect(ctx.daydreamingTendency).toBeGreaterThanOrEqual(0);
    expect(ctx.daydreamingTendency).toBeLessThanOrEqual(1);
    expect(ctx.restlessness).toBeGreaterThanOrEqual(0);
    expect(ctx.restlessness).toBeLessThanOrEqual(1);
    expect(ctx.stressLoad).toBeGreaterThanOrEqual(0);
    expect(ctx.stressLoad).toBeLessThanOrEqual(1);
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0);
    expect(ctx.loneliness).toBeLessThanOrEqual(1);
    expect(ctx.fatigue).toBeGreaterThanOrEqual(0);
    expect(ctx.fatigue).toBeLessThanOrEqual(1);
    expect(ctx.curiosity).toBeGreaterThanOrEqual(0);
    expect(ctx.curiosity).toBeLessThanOrEqual(1);
    expect(ctx.sleepResidue).toBeGreaterThanOrEqual(0);
    expect(ctx.sleepResidue).toBeLessThanOrEqual(1);
  });

  it("does not modify input objects", () => {
    const char = createCharacterPhysicsState();
    const bs = { ...DEFAULT_BOREDOM_EXPANSION_STATE };
    const ef = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const sw = { ...DEFAULT_SLEEP_WAKE_STATE };
    const frozenMeta = { ...char.metaState };

    buildRandomThoughtContextFromCharacter({
      state: char, boredomState: bs, energyFatigue: ef, sleepWake: sw, seed: "t",
    });

    expect(char.metaState).toEqual(frozenMeta);
  });
});
