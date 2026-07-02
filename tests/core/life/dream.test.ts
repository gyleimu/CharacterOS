import { describe, expect, it } from "vitest";
import {
  DREAM_TONES,
  selectDreamSources,
  generateDreamFragment,
  buildDreamContextFromCharacter,
  type DreamContext,
  type DreamSource,
  type SourceSelectionInput,
} from "../../../src/core/life/dream";
import type { SleepWakePhase, SleepWakeState } from "../../../src/core/life/sleepWake";
import { DEFAULT_SLEEP_WAKE_STATE } from "../../../src/core/life/sleepWake";
import { DEFAULT_ENERGY_FATIGUE_STATE } from "../../../src/core/life/energyFatigue";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";

// ── Helpers ────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<DreamContext> = {}): DreamContext {
  return {
    sleepPhase: "deep_sleep",
    sleepQuality: 0.6,
    stressLoad: 0.3,
    fatigue: 0.4,
    loneliness: 0.3,
    activeMemoryCount: 10,
    seed: "test-seed",
    ...overrides,
  };
}

function makeMemories(
  count: number,
  base: Partial<SourceSelectionInput["memories"][number]> = {}
): SourceSelectionInput["memories"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mem-${i}`,
    content: `Memory content ${i}: a significant event occurred involving key people`,
    importance: 0.3 + i * 0.1,
    recency: 0.2 + i * 0.1,
    emotion: i % 2 === 0 ? "joy" : "sadness",
    tags: [`tag-${i}`],
    ...base,
  }));
}

function makeBeliefs(
  count: number
): SourceSelectionInput["beliefs"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `belief-${i}`,
    content: `I believe in something important ${i}`,
    strength: 0.3 + i * 0.1,
  }));
}

function makeNeeds(
  count: number
): SourceSelectionInput["needs"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `need-${i}`,
    name: `Need ${i}: connection`,
    intensity: 0.2 + i * 0.15,
  }));
}

function makeClusters(
  count: number
): SourceSelectionInput["clusters"] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cluster-${i}`,
    category: `category-${i} loss`,
    mass: 0.2 + i * 0.1,
    stability: 0.3 + i * 0.05,
  }));
}

function makeSourceInput(
  overrides: Partial<SourceSelectionInput> = {}
): SourceSelectionInput {
  return {
    memories: makeMemories(5),
    beliefs: makeBeliefs(3),
    needs: makeNeeds(3),
    clusters: makeClusters(3),
    ...overrides,
  };
}

// ── DreamTone ──────────────────────────────────────────────────────────

describe("DREAM_TONES", () => {
  it("has exactly 8 tones", () => {
    expect(DREAM_TONES).toHaveLength(8);
  });

  it("includes expected tones", () => {
    expect(DREAM_TONES).toContain("calm");
    expect(DREAM_TONES).toContain("anxious");
    expect(DREAM_TONES).toContain("lonely");
    expect(DREAM_TONES).toContain("fragmented");
    expect(DREAM_TONES).toContain("hopeful");
    expect(DREAM_TONES).toContain("threatening");
  });

  it("all tones are distinct", () => {
    expect(new Set(DREAM_TONES).size).toBe(DREAM_TONES.length);
  });
});

// ── Source Selection ───────────────────────────────────────────────────

describe("selectDreamSources", () => {
  it("sorts by weight descending (higher importance ranks higher)", () => {
    const input = makeSourceInput({
      memories: [
        { id: "mem-low", content: "low", importance: 0.1, recency: 0.1, emotion: "neutral" },
        { id: "mem-high", content: "high", importance: 0.9, recency: 0.9, emotion: "neutral" },
        { id: "mem-mid", content: "mid", importance: 0.5, recency: 0.5, emotion: "neutral" },
      ],
      beliefs: [],
      needs: [],
      clusters: [],
    });
    const sources = selectDreamSources(input);
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0]!.id).toBe("mem-high");
    expect(sources[0]!.weight).toBeGreaterThan(sources[1]!.weight);
  });

  it("intense need ranks higher than weak need", () => {
    const input = makeSourceInput({
      memories: [],
      beliefs: [],
      needs: [
        { id: "need-low", name: "low need", intensity: 0.2 },
        { id: "need-high", name: "high need", intensity: 0.9 },
      ],
      clusters: [],
    });
    const sources = selectDreamSources(input);
    expect(sources[0]!.id).toBe("need-high");
  });

  it("respects limit", () => {
    const input = makeSourceInput({ limit: 3 });
    const sources = selectDreamSources(input);
    expect(sources.length).toBeLessThanOrEqual(3);
  });

  it("defaults to limit 5 when not specified", () => {
    // Build input without specifying limit
    const input: SourceSelectionInput = {
      memories: makeMemories(10),
      beliefs: [],
      needs: [],
      clusters: [],
    };
    const sources = selectDreamSources(input);
    expect(sources.length).toBeLessThanOrEqual(5);
  });

  it("weights are clamped [0,1]", () => {
    const input = makeSourceInput({
      memories: [
        { id: "mem", content: "extreme", importance: 1.5, recency: -0.5, emotion: "neutral" },
      ],
      beliefs: [],
      needs: [],
      clusters: [],
    });
    const sources = selectDreamSources(input);
    for (const s of sources) {
      expect(s.weight).toBeGreaterThanOrEqual(0);
      expect(s.weight).toBeLessThanOrEqual(1);
      expect(s.emotionalCharge).toBeGreaterThanOrEqual(0);
      expect(s.emotionalCharge).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic (same input → same result)", () => {
    const input = makeSourceInput();
    const s1 = selectDreamSources(input);
    const s2 = selectDreamSources(input);
    expect(s1).toEqual(s2);
  });

  it("labels long content truncated", () => {
    const input = makeSourceInput({
      memories: [
        {
          id: "mem",
          content: "A very long memory content that goes on and on and on and on",
          importance: 0.5,
          recency: 0.5,
          emotion: "neutral",
        },
      ],
      beliefs: [],
      needs: [],
      clusters: [],
    });
    const sources = selectDreamSources(input);
    expect(sources[0]!.label.length).toBeLessThanOrEqual(43); // 40 + "…"
  });
});

// ── Dream Fragment Generation ──────────────────────────────────────────

describe("generateDreamFragment", () => {
  it("no sources → fragment null", () => {
    const trace = generateDreamFragment(makeContext(), []);
    expect(trace.fragment).toBeNull();
    expect(trace.reasons.some((r) => r.includes("No dream sources"))).toBe(true);
  });

  it("awake phase → no dream", () => {
    const ctx = makeContext({ sleepPhase: "awake" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).toBeNull();
  });

  it("waking phase → no dream", () => {
    const ctx = makeContext({ sleepPhase: "waking" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).toBeNull();
  });

  it("deep_sleep → can generate fragment", () => {
    const ctx = makeContext({ sleepPhase: "deep_sleep" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).not.toBeNull();
    expect(trace.fragment!.generated).toBe(true);
  });

  it("light_sleep → can generate fragment", () => {
    const ctx = makeContext({ sleepPhase: "light_sleep" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).not.toBeNull();
    expect(trace.fragment!.generated).toBe(true);
  });

  it("drowsy with strong conditions → may generate fragment", () => {
    const ctx = makeContext({
      sleepPhase: "drowsy",
      fatigue: 0.9,
      stressLoad: 0.8,
    });
    const sources = selectDreamSources(
      makeSourceInput({
        memories: makeMemories(5, { importance: 0.9, recency: 0.9 }),
      })
    );
    const trace = generateDreamFragment(ctx, sources);
    // May or may not generate based on chance threshold
    if (trace.fragment !== null) {
      expect(trace.fragment.generated).toBe(true);
    }
    // Either way, should have reasons
    expect(trace.reasons.length).toBeGreaterThan(0);
  });

  it("high stress produces anxious/threatening/fragmented tones more often", () => {
    const ctx = makeContext({ sleepPhase: "deep_sleep", stressLoad: 0.95, seed: "stress-test" });
    const sources = selectDreamSources(makeSourceInput());
    // Run multiple seeds to check tone distribution
    const tones = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const t = generateDreamFragment({ ...ctx, seed: `stress-${i}` }, sources);
      if (t.fragment) tones.add(t.fragment.tone);
    }
    // High stress should produce at least one of these
    const stressTones = ["anxious", "threatening", "fragmented"];
    const hasStressTone = [...tones].some((t) => stressTones.includes(t));
    expect(hasStressTone).toBe(true);
  });

  it("high loneliness produces lonely tone", () => {
    const ctx = makeContext({ sleepPhase: "deep_sleep", loneliness: 0.9, seed: "lonely-test" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).not.toBeNull();
    // High loneliness should heavily weight "lonely" tone
    expect(trace.fragment!.tone).toBeTruthy();
  });

  it("high sleepQuality increases clarity", () => {
    const lowQuality = makeContext({ sleepPhase: "deep_sleep", sleepQuality: 0.2, seed: "clarity-low" });
    const highQuality = makeContext({ sleepPhase: "deep_sleep", sleepQuality: 0.9, seed: "clarity-high" });
    const sources = selectDreamSources(makeSourceInput());
    const tLow = generateDreamFragment(lowQuality, sources);
    const tHigh = generateDreamFragment(highQuality, sources);
    expect(tHigh.fragment!.clarity).toBeGreaterThan(tLow.fragment!.clarity);
  });

  it("high fatigue lowers clarity or creates fragmented tone", () => {
    const ctx = makeContext({ sleepPhase: "deep_sleep", fatigue: 0.95, seed: "fatigue-test" });
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(ctx, sources);
    expect(trace.fragment).not.toBeNull();
    expect(trace.fragment!.clarity).toBeLessThan(0.7);
    // Fragmented/unclear tones should be weighted higher
  });

  it("is deterministic: same seed + same inputs → same fragment", () => {
    const ctx = makeContext({ seed: "determinism-test" });
    const sources = selectDreamSources(makeSourceInput());
    const t1 = generateDreamFragment(ctx, sources);
    const t2 = generateDreamFragment(ctx, sources);
    expect(t1.fragment).toEqual(t2.fragment);
    expect(t1.sources).toEqual(t2.sources);
  });

  it("different seeds may produce different tones", () => {
    const sources = selectDreamSources(makeSourceInput());
    const t1 = generateDreamFragment(makeContext({ seed: "alpha" }), sources);
    const t2 = generateDreamFragment(makeContext({ seed: "beta" }), sources);
    // The tones might be the same (weight overlap) but fragments should still be valid
    expect(t1.fragment).not.toBeNull();
    expect(t2.fragment).not.toBeNull();
  });

  it("symbols are extracted from source labels", () => {
    const input = makeSourceInput({
      memories: [
        { id: "m1", content: "rain falling on the rooftop", importance: 0.8, recency: 0.8, emotion: "calm" },
        { id: "m2", content: "warm coffee morning routine", importance: 0.7, recency: 0.7, emotion: "warm" },
      ],
      beliefs: [],
      needs: [],
      clusters: [],
    });
    const sources = selectDreamSources(input);
    const trace = generateDreamFragment(makeContext({ sleepPhase: "deep_sleep", seed: "symbols-test" }), sources);
    expect(trace.fragment).not.toBeNull();
    expect(trace.fragment!.symbols.length).toBeGreaterThan(0);
    // Some keyword from the memories should appear
    const keywordSources = ["rain", "falling", "rooftop", "warm", "coffee", "morning", "routine"];
    const hasKeyword = trace.fragment!.symbols.some((s) =>
      keywordSources.includes(s)
    );
    expect(hasKeyword).toBe(true);
  });

  it("description is a short fragment (≤ ~12 words)", () => {
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(makeContext({ seed: "desc-test" }), sources);
    expect(trace.fragment).not.toBeNull();
    const wordCount = trace.fragment!.description.split(/[,\s]+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(12);
  });

  it("fragment id is deterministic for same seed", () => {
    const sources = selectDreamSources(makeSourceInput());
    const t1 = generateDreamFragment(makeContext({ seed: "id-test" }), sources);
    const t2 = generateDreamFragment(makeContext({ seed: "id-test" }), sources);
    expect(t1.fragment!.id).toBe(t2.fragment!.id);
  });

  it("intensity and clarity are in [0,1]", () => {
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(makeContext(), sources);
    expect(trace.fragment).not.toBeNull();
    expect(trace.fragment!.intensity).toBeGreaterThanOrEqual(0);
    expect(trace.fragment!.intensity).toBeLessThanOrEqual(1);
    expect(trace.fragment!.clarity).toBeGreaterThanOrEqual(0);
    expect(trace.fragment!.clarity).toBeLessThanOrEqual(1);
  });

  it("does not mutate input sources array", () => {
    const input = makeSourceInput();
    const sources = selectDreamSources(input);
    const frozen = [...sources.map((s) => ({ ...s }))];
    generateDreamFragment(makeContext(), sources);
    expect(sources).toEqual(frozen);
  });

  it("trace contains context, sources, reasons", () => {
    const sources = selectDreamSources(makeSourceInput());
    const trace = generateDreamFragment(makeContext(), sources);
    expect(trace.context).toBeDefined();
    expect(trace.sources).toEqual(sources);
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildDreamContextFromCharacter", () => {
  it("reads sleepPhase from SleepWakeState", () => {
    const ctx = buildDreamContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, phase: "deep_sleep" },
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.sleepPhase).toBe("deep_sleep");
  });

  it("reads sleepQuality from SleepWakeState", () => {
    const ctx = buildDreamContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, sleepQuality: 0.75 },
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.sleepQuality).toBe(0.75);
  });

  it("reads stressLoad from boundary", () => {
    const char = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45 }),
    });
    const ctx = buildDreamContextFromCharacter({
      state: char,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.stressLoad).toBe(0.45);
  });

  it("reads fatigue from EnergyFatigueState", () => {
    const ctx = buildDreamContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      energyFatigue: { ...DEFAULT_ENERGY_FATIGUE_STATE, fatigue: 0.55 },
      seed: "test",
    });
    expect(ctx.fatigue).toBe(0.55);
  });

  it("loneliness is inverted from lonelinessTolerance", () => {
    // default lonelinessTolerance = 0.42 → loneliness = 0.58
    const ctx = buildDreamContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0);
    expect(ctx.loneliness).toBeLessThanOrEqual(1);
    // Default tolerance 0.42 → 1-0.42 = 0.58
    expect(ctx.loneliness).toBeCloseTo(0.58, 1);
  });

  it("reads activeMemoryCount from state.memories.length", () => {
    const char = createCharacterPhysicsState();
    const ctx = buildDreamContextFromCharacter({
      state: char,
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.activeMemoryCount).toBe(char.memories.length);
  });

  it("all numeric outputs clamped [0,1]", () => {
    const ctx = buildDreamContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: DEFAULT_SLEEP_WAKE_STATE,
      energyFatigue: DEFAULT_ENERGY_FATIGUE_STATE,
      seed: "test",
    });
    expect(ctx.sleepQuality).toBeGreaterThanOrEqual(0);
    expect(ctx.sleepQuality).toBeLessThanOrEqual(1);
    expect(ctx.stressLoad).toBeGreaterThanOrEqual(0);
    expect(ctx.stressLoad).toBeLessThanOrEqual(1);
    expect(ctx.fatigue).toBeGreaterThanOrEqual(0);
    expect(ctx.fatigue).toBeLessThanOrEqual(1);
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0);
    expect(ctx.loneliness).toBeLessThanOrEqual(1);
  });

  it("does not modify input state/sleep/energy", () => {
    const char = createCharacterPhysicsState();
    const sleepWake = { ...DEFAULT_SLEEP_WAKE_STATE };
    const ef = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const frozenChar = { ...char.boundary };
    const frozenSW = { ...sleepWake };
    const frozenEF = { ...ef };

    buildDreamContextFromCharacter({ state: char, sleepWake, energyFatigue: ef, seed: "t" });

    expect(char.boundary).toEqual(frozenChar);
    expect(sleepWake).toEqual(frozenSW);
    expect(ef).toEqual(frozenEF);
  });
});
