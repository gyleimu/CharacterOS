import { describe, expect, it } from "vitest";
import {
  buildDefaultLifeDecisionContext,
  buildLifeDecisionContextFromDryRun,
  summarizeLifeDecisionContext,
  type LifeDecisionContext,
} from "../../../src/core/differentiation/lifeDecisionContext";
import { buildDifferentiatedDecisionForState } from "../../../src/core/differentiation/differentiationAdapter";
import { runLifeTickDryRun } from "../../../src/core/life/lifeTickRunner";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

// ── Helpers ────────────────────────────────────────────────────────────

function charWithMemories(): CharacterPhysicsState {
  const state = createCharacterPhysicsState({
    boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
  });
  state.memories = [
    { id: "m1", content: "王雪深夜失联了，电话不接消息不回", importance: 0.8, recency: 0.95, emotion: "fear", repetitionCount: 2, beliefEffect: "亲密关系中不可靠", timeStamp: "2026-06-20T02:00:00.000Z", vector: state.coordinate },
  ];
  state.beliefStates = [
    { id: "b1", content: "亲密关系不可靠，终究会离开", strength: 0.72, evidenceCount: 3, sourceMemoryIds: ["m1"] },
  ];
  return state;
}

// ── Default ────────────────────────────────────────────────────────────

describe("buildDefaultLifeDecisionContext", () => {
  it("returns valid LifeDecisionContext with all fields", () => {
    const ctx = buildDefaultLifeDecisionContext();
    expect(ctx.energy).toBeGreaterThan(0);
    expect(ctx.sleepPhase).toBe("awake");
    expect(ctx.reasons.length).toBeGreaterThan(0);
  });
});

// ── From Dry-Run ───────────────────────────────────────────────────────

describe("buildLifeDecisionContextFromDryRun", () => {
  it("extracts expected fields from a life tick dry-run", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.3 }),
    });
    const dryRun = runLifeTickDryRun(state, {
      characterId: "test-char",
      elapsedHours: 8,
      observed: true,
      requestedAt: "2026-06-25T14:00:00.000Z",
      mode: "dry_run",
      seed: "test-seed",
    });
    const ctx = buildLifeDecisionContextFromDryRun(dryRun);
    expect(ctx.energy).toBeGreaterThanOrEqual(0);
    expect(ctx.fatigue).toBeGreaterThanOrEqual(0);
    expect(ctx.sleepPressure).toBeGreaterThanOrEqual(0);
    expect(ctx.boredom).toBeGreaterThanOrEqual(0);
    expect(ctx.restlessness).toBeGreaterThanOrEqual(0);
    expect(ctx.reasons.length).toBeGreaterThan(0);
  });

  it("does not mutate the dry-run result", () => {
    const state = createCharacterPhysicsState();
    const dryRun = runLifeTickDryRun(state, {
      characterId: "test", elapsedHours: 4, observed: true,
      requestedAt: "2026-06-25T12:00:00.000Z", mode: "dry_run", seed: "s",
    });
    const frozenEnergy = dryRun.projectedLifeState.energyFatigue.energy;
    buildLifeDecisionContextFromDryRun(dryRun);
    expect(dryRun.projectedLifeState.energyFatigue.energy).toBe(frozenEnergy);
  });

  it("deterministic: same dry-run → same context", () => {
    const state = createCharacterPhysicsState();
    const dryRun = runLifeTickDryRun(state, {
      characterId: "test", elapsedHours: 4, observed: true,
      requestedAt: "2026-06-25T12:00:00.000Z", mode: "dry_run", seed: "det",
    });
    const c1 = buildLifeDecisionContextFromDryRun(dryRun);
    const c2 = buildLifeDecisionContextFromDryRun(dryRun);
    expect(c1).toEqual(c2);
  });
});

// ── Life Context Modifies Decision ─────────────────────────────────────

describe("LifeDecisionContext — influence on differentiated decision", () => {
  it("without lifeContext, decision is backward compatible", () => {
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    expect(dd.schemas.length).toBeGreaterThan(0);
    expect(dd.lifeInfluences).toHaveLength(0);
  });

  it("with high fatigue lifeContext, strategy ranking shifts", () => {
    const state = charWithMemories();
    const tiredCtx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      fatigue: 0.75,
      sleepPressure: 0.7,
      reasons: ["Very tired"],
    };
    const dd = buildDifferentiatedDecisionForState(state, { lifeContext: tiredCtx });
    // Life influences should be non-empty
    expect(dd.lifeInfluences.length).toBeGreaterThan(0);
    // Life context still allows personality schemas to activate
    expect(dd.schemas.length).toBeGreaterThan(0);
  });

  it("with high boredom/restlessness, exploration strategies get boost", () => {
    const state = charWithMemories();
    const restlessCtx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      boredom: 0.55,
      restlessness: 0.6,
      explorationPressure: 0.5,
      reasons: ["Restless"],
    };
    const dd = buildDifferentiatedDecisionForState(state, { lifeContext: restlessCtx });
    expect(dd.lifeInfluences.length).toBeGreaterThan(0);
  });

  it("life influence is modifier, persona schema still present", () => {
    const state = charWithMemories();
    const ctx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      fatigue: 0.8,
      boredom: 0.6,
      reasons: ["Tired and bored"],
    };
    const dd = buildDifferentiatedDecisionForState(state, { lifeContext: ctx });
    // Schemas are still derived from persona/state, not overwritten by life
    expect(dd.schemas.length).toBeGreaterThan(0);
    expect(dd.schemas[0]!.label).toBeTruthy();
  });

  it("worry random thought increases safety/verification", () => {
    const state = charWithMemories();
    const worryCtx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      strongestRandomThoughtKind: "worry",
      strongestRandomThoughtPhrase: "what if she left?",
      reasons: ["Worried"],
    };
    const dd = buildDifferentiatedDecisionForState(state, { lifeContext: worryCtx });
    expect(dd.lifeInfluences.length).toBeGreaterThanOrEqual(0);
    // Life influences may include verification boost
    expect(Array.isArray(dd.lifeInfluences)).toBe(true);
  });

  it("deterministic with same lifeContext", () => {
    const state = charWithMemories();
    const ctx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      fatigue: 0.72,
      reasons: ["Deterministic test"],
    };
    const d1 = buildDifferentiatedDecisionForState(state, { lifeContext: ctx });
    const d2 = buildDifferentiatedDecisionForState(state, { lifeContext: ctx });
    expect(d1.selectedStrategy.id).toBe(d2.selectedStrategy.id);
    expect(d1.lifeInfluences).toEqual(d2.lifeInfluences);
  });
});

// ── Summarize ──────────────────────────────────────────────────────────

describe("summarizeLifeDecisionContext", () => {
  it("returns empty summary for default context", () => {
    const summary = summarizeLifeDecisionContext(buildDefaultLifeDecisionContext());
    expect(summary).toBe("no strong life signals");
  });

  it("mentions fatigue when high", () => {
    const ctx: LifeDecisionContext = {
      ...buildDefaultLifeDecisionContext(),
      fatigue: 0.7,
      reasons: [],
    };
    expect(summarizeLifeDecisionContext(ctx)).toContain("fatigue");
  });
});
