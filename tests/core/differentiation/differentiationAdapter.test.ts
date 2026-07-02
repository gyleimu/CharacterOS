import { describe, expect, it } from "vitest";
import { deriveCharacterState } from "../../../src/core/state/derivedCharacterState";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import { buildPersonaSeedFromState, buildEnvironmentSeedFromState, buildDifferentiatedDecisionForState } from "../../../src/core/differentiation/differentiationAdapter";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import type { MemoryNode } from "../../../src/core/memory/memoryNode";
import type { BeliefState } from "../../../src/core/belief/beliefState";

// ── Helpers ────────────────────────────────────────────────────────────

function char(overrides?: Partial<Parameters<typeof createCharacterPhysicsState>[0]>): CharacterPhysicsState {
  return createCharacterPhysicsState({
    boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
    ...overrides,
  });
}

function charWithMemories(): CharacterPhysicsState {
  const state = char();
  state.memories = [
    { id: "m1", content: "王雪深夜失联了，电话不接消息不回", importance: 0.8, recency: 0.95, emotion: "fear", repetitionCount: 2, beliefEffect: "亲密关系中不可靠", timeStamp: "2026-06-20T02:00:00.000Z", vector: state.coordinate },
    { id: "m2", content: "上周项目失败，老板在会上公开批评", importance: 0.7, recency: 0.7, emotion: "shame", repetitionCount: 1, beliefEffect: "我不够好", timeStamp: "2026-06-22T10:00:00.000Z", vector: state.coordinate },
  ];
  state.beliefStates = [
    { id: "b1", content: "亲密关系不可靠，终究会离开", strength: 0.72, evidenceCount: 3, sourceMemoryIds: ["m1"] },
    { id: "b2", content: "我不够好，需要证明自己", strength: 0.58, evidenceCount: 2, sourceMemoryIds: ["m2"] },
  ];
  return state;
}

// ── Adapter: Persona Seed ──────────────────────────────────────────────

describe("buildPersonaSeedFromState", () => {
  it("constructs a valid PersonaSeed from state", () => {
    const state = charWithMemories();
    const seed = buildPersonaSeedFromState(state);
    expect(seed.id).toBeTruthy();
    expect(seed.name).toBeTruthy();
    expect(seed.group).toBeTruthy();
    expect(seed.initialTraits).toBeTruthy();
    expect(seed.coreExperience).toBeTruthy();
    expect(seed.dominantBelief).toBeTruthy();
    expect(seed.needGap).toBeTruthy();
    expect(seed.defaultDefense).toBeTruthy();
    expect(seed.risk).toBeTruthy();
    expect(seed.trust).toBeTruthy();
    expect(seed.growth).toBeTruthy();
  });

  it("works with default/minimal state (no identity, no memories)", () => {
    const state = char();
    const seed = buildPersonaSeedFromState(state);
    expect(seed.id).toBeTruthy();
    expect(seed.name).toBeTruthy();
    expect(seed.dominantBelief).toBeTruthy();
    // All PersonaSeed fields are populated (no undefined/null)
    expect(seed.group).toBeTruthy();
    expect(seed.initialTraits).toBeTruthy();
    expect(seed.coreExperience).toBeTruthy();
    expect(seed.needGap).toBeTruthy();
    expect(seed.defaultDefense).toBeTruthy();
    expect(seed.risk).toBeTruthy();
    expect(seed.trust).toBeTruthy();
    expect(seed.growth).toBeTruthy();
  });

  it("deterministic: same state → same seed", () => {
    const state = charWithMemories();
    const s1 = buildPersonaSeedFromState(state);
    const s2 = buildPersonaSeedFromState(state);
    expect(s1).toEqual(s2);
  });

  it("does not mutate state", () => {
    const state = charWithMemories();
    const frozenBelief = state.beliefStates[0]!.content;
    buildPersonaSeedFromState(state);
    expect(state.beliefStates[0]!.content).toBe(frozenBelief);
  });
});

// ── Adapter: Environment Seed ──────────────────────────────────────────

describe("buildEnvironmentSeedFromState", () => {
  it("constructs a valid EnvironmentSeed from state", () => {
    const state = charWithMemories();
    const seed = buildEnvironmentSeedFromState(state);
    expect(seed.id).toBeTruthy();
    expect(seed.name).toBeTruthy();
    expect(seed.trigger).toBeTruthy();
    expect(seed.stressor).toBeTruthy();
    expect(seed.testFocus).toBeTruthy();
  });

  it("works with minimal state", () => {
    const seed = buildEnvironmentSeedFromState(char());
    expect(seed.id).toBe("env_quiet_daily");
    expect(seed.trigger).toBeTruthy();
  });

  it("deterministic: same state → same seed", () => {
    const state = charWithMemories();
    const s1 = buildEnvironmentSeedFromState(state);
    const s2 = buildEnvironmentSeedFromState(state);
    expect(s1).toEqual(s2);
  });
});

// ── Adapter: Full Differentiated Decision ──────────────────────────────

describe("buildDifferentiatedDecisionForState", () => {
  it("returns a full DifferentiatedDecision", () => {
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    expect(dd.schemas.length).toBeGreaterThan(0);
    expect(dd.needs.length).toBeGreaterThan(0);
    expect(dd.desires.length).toBeGreaterThan(0);
    expect(dd.strategies.length).toBeGreaterThan(0);
    expect(dd.selectedStrategy).toBeDefined();
    expect(dd.actionSurface).toBeDefined();
    expect(dd.perception).toBeTruthy();
    expect(dd.emotion).toBeTruthy();
    expect(dd.memoryTrigger).toBeTruthy();
    expect(dd.belief).toBeTruthy();
  });

  it("deterministic: same state → same decision", () => {
    const state = charWithMemories();
    const d1 = buildDifferentiatedDecisionForState(state);
    const d2 = buildDifferentiatedDecisionForState(state);
    expect(d1).toEqual(d2);
  });

  it("different memories produce different schemas/needs", () => {
    const state1 = charWithMemories();
    const state2 = char();
    state2.memories = [
      { id: "m3", content: "今天收到了一笔意外的合作邀约，收益可观", importance: 0.7, recency: 0.9, emotion: "joy", repetitionCount: 1, beliefEffect: "机会是真实的", timeStamp: "2026-06-24T08:00:00.000Z", vector: state2.coordinate },
    ];
    state2.beliefStates = [
      { id: "b3", content: "机会需要主动抓住", strength: 0.65, evidenceCount: 1, sourceMemoryIds: ["m3"] },
    ];

    const d1 = buildDifferentiatedDecisionForState(state1);
    const d2 = buildDifferentiatedDecisionForState(state2);

    // At minimum, the top schema or strategy should differ
    const schemaDiff = d1.schemas[0]?.id !== d2.schemas[0]?.id;
    const strategyDiff = d1.selectedStrategy.id !== d2.selectedStrategy.id;
    expect(schemaDiff || strategyDiff).toBe(true);
  });

  it("does not mutate state", () => {
    const state = charWithMemories();
    const frozenMemory = state.memories[0]!.content;
    buildDifferentiatedDecisionForState(state);
    expect(state.memories[0]!.content).toBe(frozenMemory);
  });
});

// ── Derived Character State ────────────────────────────────────────────

describe("deriveCharacterState — differentiatedDecision", () => {
  it("returns differentiatedDecision on derived state", () => {
    const state = charWithMemories();
    const derived = deriveCharacterState(state);
    expect(derived.differentiatedDecision).toBeDefined();
    expect(derived.differentiatedDecision!.schemas.length).toBeGreaterThan(0);
  });

  it("legacy decision is unchanged", () => {
    const state = charWithMemories();
    const derived = deriveCharacterState(state);
    expect(derived.decision).toBeDefined();
    expect(derived.decision.id).toBeTruthy();
    expect(derived.decision.mostLikelyAction).toBeTruthy();
    expect(derived.decision.confidence).toBeGreaterThanOrEqual(0);
  });

  it("differentiatedDecision may be undefined for pure default state (graceful)", () => {
    // Default state with no memories/beliefs should still work
    const state = char();
    const derived = deriveCharacterState(state);
    // differentiatedDecision may or may not be present depending on fallback
    // But it should never throw
    expect(derived.decision).toBeDefined();
  });

  it("deterministic: same state → same differentiatedDecision", () => {
    const state = charWithMemories();
    const d1 = deriveCharacterState(state) ;
    const d2 = deriveCharacterState(state);
    if (d1.differentiatedDecision && d2.differentiatedDecision) {
      expect(d1.differentiatedDecision).toEqual(d2.differentiatedDecision);
    }
  });

  it("does not mutate state", () => {
    const state = charWithMemories();
    const frozenContent = state.memories[0]!.content;
    deriveCharacterState(state);
    expect(state.memories[0]!.content).toBe(frozenContent);
  });
});

// ── API Response Shape ─────────────────────────────────────────────────

describe("Decision API — differentiatedDecision in serialized state", () => {
  it("derived state includes differentiatedDecision when enough state is present", () => {
    // deriveCharacterState is the core path; serialization calls it internally
    const state = charWithMemories();
    const derived = deriveCharacterState(state);
    expect(derived.decision).toBeDefined();
    // differentiatedDecision should be present when there's memory/belief data
    expect(derived.differentiatedDecision).toBeDefined();
    expect(derived.differentiatedDecision!.schemas.length).toBeGreaterThan(0);
    expect(derived.differentiatedDecision!.selectedStrategy).toBeDefined();
    expect(derived.differentiatedDecision!.actionSurface).toBeDefined();
  });
});
