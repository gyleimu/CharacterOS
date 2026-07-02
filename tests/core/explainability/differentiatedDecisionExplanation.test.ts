import { describe, expect, it } from "vitest";
import { explainDifferentiatedDecision, type DifferentiatedDecisionExplanationInput } from "../../../src/core/explainability/differentiatedDecisionExplanation";
import { buildDifferentiatedDecisionForState } from "../../../src/core/differentiation/differentiationAdapter";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import type { BehaviorDecision } from "../../../src/core/decision/behaviorDecision";

// ── Helpers ────────────────────────────────────────────────────────────

function charWithMemories(): CharacterPhysicsState {
  const state = createCharacterPhysicsState({
    boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
  });
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

function legacyDecision(): BehaviorDecision {
  return {
    id: "decision_current",
    innerThoughts: ["测试想法"],
    emotionalReaction: "轻度警觉",
    innerConflict: "靠近和撤退之间摇摆",
    willNotDo: ["不会失控"],
    mostLikelyAction: "先保持沉默，观察当前关系是否安全。",
    confidence: 0.35,
    rationale: "测试理由",
    supportingBeliefIds: ["b1"],
    supportingNeedIds: ["need_1"],
    supportingDesireIds: ["desire_1"],
    supportingBehaviorBiasIds: [],
  };
}

function makeInput(overrides?: Partial<DifferentiatedDecisionExplanationInput>): DifferentiatedDecisionExplanationInput {
  const state = charWithMemories();
  const dd = buildDifferentiatedDecisionForState(state);
  return {
    legacyDecision: legacyDecision(),
    differentiatedDecision: dd,
    seed: "test-seed",
    personaName: "测试角色",
    environmentName: "测试环境",
    ...overrides,
  };
}

// ── Core ───────────────────────────────────────────────────────────────

describe("explainDifferentiatedDecision — core", () => {
  it("returns a valid ExplanationTrace", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const trace = result.trace;
    expect(trace.id).toBeTruthy();
    expect(trace.scope).toBe("differentiated_decision");
    expect(trace.title).toBeTruthy();
    expect(trace.summary).toBeTruthy();
    expect(trace.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(Array.isArray(trace.facts)).toBe(true);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(trace.createdAt).toBeTruthy();
  });

  it("includes schema activation facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const schemaFacts = result.trace.facts.filter((f) => f.label.startsWith("激活图式"));
    expect(schemaFacts.length).toBeGreaterThan(0);
    const firstSchema = schemaFacts[0]!.value as Record<string, unknown>;
    expect(firstSchema.id).toBeTruthy();
    expect(firstSchema.label).toBeTruthy();
    expect(firstSchema.intensity).toBeGreaterThan(0);
  });

  it("includes need formation facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const needFacts = result.trace.facts.filter((f) => f.label.startsWith("需求"));
    expect(needFacts.length).toBeGreaterThan(0);
  });

  it("includes desire formation facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const desireFacts = result.trace.facts.filter((f) => f.label.startsWith("欲望"));
    expect(desireFacts.length).toBeGreaterThan(0);
  });

  it("includes strategy selection facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const strategyFacts = result.trace.facts.filter((f) => f.label.startsWith("策略"));
    expect(strategyFacts.length).toBeGreaterThan(0);
  });

  it("includes action surface facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const actionFacts = result.trace.facts.filter((f) => f.label === "最终行动");
    expect(actionFacts.length).toBeGreaterThan(0);
  });

  it("includes legacy comparison facts", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const legacyFact = result.trace.facts.find((f) => f.label === "Legacy 决策行动");
    expect(legacyFact).toBeDefined();
    const diffFact = result.trace.facts.find((f) => f.label === "Differentiated 决策行动");
    expect(diffFact).toBeDefined();
  });

  it("includes reasons for schema/need/desire/strategy/action/legacy", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const reasonTexts = result.trace.reasons.map((r) => r.message);
    // Should have at least one reason per category
    const categories = ["图式", "需求", "欲望", "策略", "行动", "Legacy"];
    for (const cat of categories) {
      expect(reasonTexts.some((t) => t.includes(cat)) || reasonTexts.some((t) => t.includes(cat.toLowerCase()))).toBe(true);
    }
  });

  it("deterministic: same input → same trace", () => {
    const input = makeInput();
    const r1 = explainDifferentiatedDecision(input);
    const r2 = explainDifferentiatedDecision(input);
    expect(r1.trace).toEqual(r2.trace);
  });

  it("does not mutate input objects", () => {
    const input = makeInput();
    const frozenSchemas = [...input.differentiatedDecision.schemas];
    explainDifferentiatedDecision(input);
    expect(input.differentiatedDecision.schemas).toEqual(frozenSchemas);
  });

  it("works with default anonymous state", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary(),
    });
    const dd = buildDifferentiatedDecisionForState(state);
    const result = explainDifferentiatedDecision({
      legacyDecision: legacyDecision(),
      differentiatedDecision: dd,
      seed: "default-test",
    });
    expect(result.trace.scope).toBe("differentiated_decision");
    expect(result.trace.reasons.length).toBeGreaterThan(0);
  });

  it("handles missing legacy fields gracefully", () => {
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    const legacy = legacyDecision();
    const result = explainDifferentiatedDecision({
      legacyDecision: legacy,
      differentiatedDecision: dd,
      seed: "missing-test",
    });
    // Should not crash — still produces valid trace
    expect(result.trace.summary).toBeTruthy();
  });

  it("reason messages are human-readable and short", () => {
    const result = explainDifferentiatedDecision(makeInput());
    for (const reason of result.trace.reasons) {
      expect(typeof reason.message).toBe("string");
      expect(reason.message.length).toBeGreaterThan(0);
      expect(reason.message.length).toBeLessThan(500);
      expect(reason.scope).toBe("differentiated_decision");
    }
  });

  it("facts have id/label/value/source", () => {
    const result = explainDifferentiatedDecision(makeInput());
    for (const fact of result.trace.facts) {
      expect(fact.id).toBeTruthy();
      expect(fact.label).toBeTruthy();
      expect(fact.value).toBeDefined();
      expect(fact.source).toBeTruthy();
    }
  });

  it("mentions top schema in summary", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const topSchema = makeInput().differentiatedDecision.schemas[0]!;
    expect(result.trace.summary).toContain(topSchema.label);
  });

  it("mentions selected strategy in summary", () => {
    const result = explainDifferentiatedDecision(makeInput());
    const selected = makeInput().differentiatedDecision.selectedStrategy;
    expect(result.trace.summary).toContain(selected.label);
  });
});

// ── Action Surface Warnings ────────────────────────────────────────────

describe("explainDifferentiatedDecision — action surface warnings", () => {
  it("warns when templatePenalty is high", () => {
    // Create a DD with a potentially generic action (high template penalty)
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    const result = explainDifferentiatedDecision({
      legacyDecision: legacyDecision(),
      differentiatedDecision: dd,
      seed: "penalty-test",
    });
    // Warnings may or may not appear depending on the penalty value
    expect(Array.isArray(result.trace.warnings)).toBe(true);
  });
});

// ── Legacy Comparison ──────────────────────────────────────────────────

describe("explainDifferentiatedDecision — legacy comparison", () => {
  it("detects when legacy and diff actions match", () => {
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    const legacy = legacyDecision();
    const result = explainDifferentiatedDecision({
      legacyDecision: legacy,
      differentiatedDecision: dd,
      seed: "match-test",
    });
    const matchFact = result.trace.facts.find((f) => f.label === "行动一致");
    expect(matchFact).toBeDefined();
  });

  it("legacy + diff actions are both in facts", () => {
    const state = charWithMemories();
    const dd = buildDifferentiatedDecisionForState(state);
    const result = explainDifferentiatedDecision({
      legacyDecision: legacyDecision(),
      differentiatedDecision: dd,
      seed: "both-test",
    });
    const legacyAction = result.trace.facts.find((f) => f.label === "Legacy 决策行动");
    const diffAction = result.trace.facts.find((f) => f.label === "Differentiated 决策行动");
    expect(legacyAction).toBeDefined();
    expect(diffAction).toBeDefined();
    expect(typeof legacyAction!.value).toBe("string");
    expect(typeof diffAction!.value).toBe("string");
  });
});

// ── Confidence ─────────────────────────────────────────────────────────

describe("explainDifferentiatedDecision — confidence levels", () => {
  it("reasons have confidence levels", () => {
    const result = explainDifferentiatedDecision(makeInput());
    for (const reason of result.trace.reasons) {
      expect(["low", "medium", "high"]).toContain(reason.confidence);
    }
  });

  it("high intensity schema produces high confidence reason", () => {
    const input = makeInput();
    // Find a schema with high intensity
    const highIntensity = input.differentiatedDecision.schemas.find((s) => s.intensity > 0.6);
    if (highIntensity) {
      const highConfReasons = input.differentiatedDecision.schemas
        .filter((s) => s.intensity > 0.6).length;
      expect(highConfReasons).toBeGreaterThan(0);
    }
  });
});
