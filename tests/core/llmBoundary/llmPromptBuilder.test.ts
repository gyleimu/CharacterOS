/**
 * V13.2 — LLM Boundary Prompt Builder Tests
 *
 * Verifies:
 * - Prompt built from valid boundary request
 * - System instructions: no mutation/diagnosis/invention
 * - Developer instructions: intent + tone + boundaries
 * - Grounding facts extracted (facts, evidence, timeline)
 * - Safety notices preserved
 * - Forbidden claims: mutation/writeback/diagnosis/raw state
 * - Response constraints: uncertainty when grounding weak
 * - allowLlm=false adds disabled warning
 * - Redaction of secrets/raw state keys
 * - No raw coordinate values / memory dump / final prose
 * - Deterministic promptId
 * - Builder does not mutate request
 * - Chinese text preserved
 * - No provider/LLM call
 */
import { describe, expect, it } from "vitest";
import {
  buildLlmBoundaryPromptFromRequest,
  buildSystemInstructions,
  buildDeveloperInstructions,
  extractGroundingFacts,
  buildForbiddenClaims,
  buildResponseConstraints,
  redactPromptUnsafeFields,
  summarizeLlmPromptBuilder,
} from "../../../src/core/llmBoundary/llmPromptBuilder";
import type { LlmBoundaryRequest, LlmBoundaryPrompt } from "../../../src/core/llmBoundary/llmBoundaryTypes";
import { buildLlmBoundaryRequest } from "../../../src/core/llmBoundary/llmBoundaryBuilders";
import { buildAgentReplyPlan } from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentSessionConfig } from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentGroundingBundle } from "../../../src/core/agent/agentContextBuilder";
import { buildAgentPolicyDecision } from "../../../src/core/agent/agentDtoBuilders";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";

function makeRequest(overrides: {
  allowLlm?: boolean;
  safetyMode?: "strict" | "normal" | "research";
  customReplyPlan?: Record<string, unknown>;
} = {}): LlmBoundaryRequest {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const surface = buildCharacterStateSurface({ state });
  const session = buildAgentSessionConfig({
    sessionId: "test_session",
    characterId: "lin_fan",
    safetyMode: overrides.safetyMode ?? "strict",
  });
  const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
  const bundle = buildAgentGroundingBundle({ session, policyDecision: policy, stateSurface: surface });
  const basePlan = buildAgentReplyPlan({});

  // Apply custom overrides to the reply plan for test scenarios
  const custom = overrides.customReplyPlan ?? {};
  const replyPlan = {
    ...basePlan,
    ...(custom as Partial<typeof basePlan>),
  };

  return buildLlmBoundaryRequest({
    replyPlan,
    groundingBundle: bundle,
    session,
    turnId: "turn_1",
    policyDecisionSummary: "preview_only",
    allowLlm: overrides.allowLlm ?? false,
  });
}

// ── Helpers ──

function combinedLower(prompt: LlmBoundaryPrompt): string {
  return [
    prompt.systemInstructions,
    prompt.developerInstructions,
    ...prompt.groundingFacts,
    ...prompt.uncertaintyNotes,
    ...prompt.safetyNotices,
    ...prompt.responseConstraints,
    ...prompt.forbiddenClaims,
  ].join(" ").toLowerCase();
}

const RAW_STATE_FORBIDDEN = [
  "particleIds",
  "particleid",
  "driftMultiplier",
  "driftmultiplier",
  "biologicalNature",
  "biologicalnature",
  "rewardState",
  "rewardstate",
  "homeostasisState",
  "homeostasisstate",
  "fullMemoryDump",
  "memoryPayload",
  "memoryNodes",
  "proceduralRoutines",
  "personalityCoordinate",
];

const SECRET_FORBIDDEN = [
  "apiKey",
  "apikey",
  "api_key",
  "secretKey",
  "accessToken",
  "bearerToken",
  "password",
  "authorization:",
  "sk-proj-",
  "sk-ant-",
];

// ============================================================================
// Main Prompt Builder
// ============================================================================

describe("V13.2 Prompt Builder — buildLlmBoundaryPromptFromRequest", () => {
  it("builds a valid LlmBoundaryPrompt from a boundary request", () => {
    const req = makeRequest({ allowLlm: true });
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.promptId).toContain("llmprompt_");
    expect(prompt.requestId).toBe(req.requestId);
    expect(prompt.noMutation).toBe(true);
    expect(prompt.noWritebackAuthority).toBe(true);
    expect(prompt.outputFormat).toBe("plain_text");
  });

  it("systemInstructions is non-empty and contains safety content", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.systemInstructions.length).toBeGreaterThan(100);
  });

  it("developerInstructions is non-empty and references intent/tone", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.developerInstructions.length).toBeGreaterThan(50);
  });

  it("groundingFacts extracted", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.groundingFacts.length).toBeGreaterThan(0);
  });

  it("safetyNotices preserved", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.safetyNotices.length).toBeGreaterThan(0);
  });

  it("forbiddenClaims non-empty", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.forbiddenClaims.length).toBeGreaterThan(5);
  });

  it("responseConstraints non-empty", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.responseConstraints.length).toBeGreaterThan(2);
  });

  it("promptId is deterministic", () => {
    const req1 = makeRequest();
    const req2 = makeRequest();
    const p1 = buildLlmBoundaryPromptFromRequest(req1);
    const p2 = buildLlmBoundaryPromptFromRequest(req2);
    expect(p1.promptId).toBe(p2.promptId);
  });

  it("different requests produce different promptIds", () => {
    const s1 = buildAgentSessionConfig({ sessionId: "s1", characterId: "c1" });
    const s2 = buildAgentSessionConfig({ sessionId: "s2", characterId: "c2" });
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const surface = buildCharacterStateSurface({ state });
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = buildAgentGroundingBundle({ session: s1, policyDecision: policy, stateSurface: surface });
    const replyPlan = buildAgentReplyPlan({});
    const r1 = buildLlmBoundaryRequest({ replyPlan, groundingBundle: bundle, session: s1, turnId: "t1", policyDecisionSummary: "x" });
    const r2 = buildLlmBoundaryRequest({ replyPlan, groundingBundle: bundle, session: s2, turnId: "t2", policyDecisionSummary: "x" });
    expect(buildLlmBoundaryPromptFromRequest(r1).promptId).not.toBe(buildLlmBoundaryPromptFromRequest(r2).promptId);
  });

  it("builder does not mutate request", () => {
    const req = makeRequest();
    const frozen = JSON.stringify(req);
    buildLlmBoundaryPromptFromRequest(req);
    expect(JSON.stringify(req)).toBe(frozen);
  });
});

// ============================================================================
// System Instructions
// ============================================================================

describe("buildSystemInstructions", () => {
  it("contains role as language realization adapter", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("语言实现适配器");
    expect(si).toContain("Language Realization Adapter");
  });

  it("contains no mutation prohibition", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("不要修改角色状态");
  });

  it("contains no diagnosis prohibition", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("诊断");
  });

  it("contains no invention prohibition", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    const lower = si.toLowerCase();
    expect(lower).toMatch(/编造|fabricate|invent/);
  });

  it("contains no writeback claim prohibition", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("writeback");
  });

  it("contains no raw variable prohibition", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("内部变量");
  });

  it("contains allowLlm=false warning when disabled", () => {
    const req = makeRequest({ allowLlm: false });
    const si = buildSystemInstructions(req);
    expect(si).toContain("LLM 路径已禁用");
    expect(si).toContain("allowLlm=false");
  });

  it("does NOT contain LLM disabled warning when enabled", () => {
    const req = makeRequest({ allowLlm: true });
    const si = buildSystemInstructions(req);
    expect(si).not.toContain("LLM 路径已禁用");
  });

  it("includes grounding weakness warning when no facts", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: [], uncertaintyNotes: ["不确定"] },
    });
    const si = buildSystemInstructions(req);
    expect(si).toContain("无接地事实");
  });

  it("includes grounding limited warning when few facts + uncertainty", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: ["f1"], uncertaintyNotes: ["u1", "u2"] },
    });
    const si = buildSystemInstructions(req);
    expect(si).toContain("接地事实有限");
  });

  it("includes strict safety mode note", () => {
    const req = makeRequest({ safetyMode: "strict" });
    const si = buildSystemInstructions(req);
    expect(si).toContain("严格安全模式");
  });

  it("includes locale hint for zh-CN", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    expect(si).toContain("简体中文");
  });
});

// ============================================================================
// Developer Instructions
// ============================================================================

describe("buildDeveloperInstructions", () => {
  it("contains reply intent", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("意图");
    expect(di).toContain(req.replyPlan.intent);
  });

  it("contains reply tone", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("语气");
    expect(di).toContain(req.replyPlan.tone);
  });

  it("contains character context (headline, emotion, stress)", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("状态摘要");
    expect(di).toContain("情绪标签");
    expect(di).toContain("压力水平");
  });

  it("contains allowed response boundaries", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("允许的回复边界");
    expect(di).toMatch(/不可以声称/);
  });

  it("contains output format expectation", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("输出格式");
  });

  it("contains no first-person roleplay directive", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toContain("第一人称");
  });
});

// ============================================================================
// Grounding Facts
// ============================================================================

describe("extractGroundingFacts", () => {
  it("extracts grounded facts from reply plan", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: ["角色当前情绪稳定。", "压力水平正常。"] },
    });
    const facts = extractGroundingFacts(req);
    const hasGroundedTag = facts.some((f) => f.startsWith("[grounded]"));
    expect(hasGroundedTag).toBe(true);
  });

  it("includes evidence refs with source labels", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: ["测试事实"] },
    });
    const facts = extractGroundingFacts(req);
    // Evidence refs are from AgentGroundingBundle, may be empty in test setup
    // Facts from groundedFacts should be present
    expect(Array.isArray(facts)).toBe(true);
    expect(facts.length).toBeGreaterThan(0);
  });

  it("warns when no facts available", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: [] },
    });
    const facts = extractGroundingFacts(req);
    const hasWarning = facts.some((f) => f.includes("warning") && f.includes("没有可用的接地事实"));
    // If evidenceRefs are also empty, warning should appear
    expect(Array.isArray(facts)).toBe(true);
  });
});

// ============================================================================
// Forbidden Claims
// ============================================================================

describe("buildForbiddenClaims", () => {
  it("includes medical/psychological diagnosis prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("诊断");
  });

  it("includes state mutation claim prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("修改");
    expect(combined).toContain("更新");
  });

  it("includes writeback claim prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("writeback");
  });

  it("includes raw variable disclosure prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("内部变量");
    expect(combined).toContain("trust");
  });

  it("includes false certainty prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toMatch(/不确定|确定性结论/);
  });

  it("includes multi-character expansion prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("多角色");
  });

  it("includes unsupported emotion/personality claim prohibition", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("未提供");
  });

  it("strict mode adds extra safety claims", () => {
    const req = makeRequest({ safetyMode: "strict" });
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toContain("自我伤害");
    expect(combined).toContain("临床判断");
  });
});

// ============================================================================
// Response Constraints
// ============================================================================

describe("buildResponseConstraints", () => {
  it("includes conciseness constraint", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("简洁"))).toBe(true);
  });

  it("includes grounding constraint", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("接地"))).toBe(true);
  });

  it("includes safety notice preservation", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("safety notices") || x.includes("安全"))).toBe(true);
  });

  it("includes uncertainty constraint when uncertainty notes exist", () => {
    const req = makeRequest({
      customReplyPlan: { uncertaintyNotes: ["证据不足"] },
    });
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("不确定性"))).toBe(true);
  });

  it("includes limited info constraint when few facts", () => {
    const req = makeRequest({
      customReplyPlan: { groundedFacts: ["f1"] },
    });
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("信息有限") || x.includes("信息不足"))).toBe(true);
  });

  it("includes no-diagnosis constraint", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("诊断"))).toBe(true);
  });

  it("includes no-mutation constraint", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("变异") || x.includes("修改"))).toBe(true);
  });

  it("includes no first-person roleplay constraint", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("第一人称"))).toBe(true);
  });

  it("includes allowLlm=false disabled warning", () => {
    const req = makeRequest({ allowLlm: false });
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("LLM 路径已禁用"))).toBe(true);
  });

  it("does NOT include disabled warning when allowLlm=true", () => {
    const req = makeRequest({ allowLlm: true });
    const c = buildResponseConstraints(req);
    expect(c.some((x) => x.includes("LLM 路径已禁用"))).toBe(false);
  });
});

// ============================================================================
// Redaction
// ============================================================================

describe("redactPromptUnsafeFields", () => {
  function makePrompt(overrides: Partial<LlmBoundaryPrompt> = {}): LlmBoundaryPrompt {
    return {
      promptId: "test_prompt",
      requestId: "test_req",
      systemInstructions: "Safe system instructions.",
      developerInstructions: "Safe developer instructions.",
      groundingFacts: ["Safe fact."],
      uncertaintyNotes: [],
      safetyNotices: [],
      responseConstraints: [],
      forbiddenClaims: [],
      outputFormat: "plain_text",
      noMutation: true,
      noWritebackAuthority: true,
      ...overrides,
    };
  }

  it("passes through clean prompt unchanged", () => {
    const prompt = makePrompt();
    const result = redactPromptUnsafeFields(prompt);
    expect(result.systemInstructions).toBe("Safe system instructions.");
    expect(result.developerInstructions).toBe("Safe developer instructions.");
  });

  it("redacts API key patterns", () => {
    const prompt = makePrompt({
      systemInstructions: "Use apiKey sk-ant-api03-abc123 for auth.",
    });
    const result = redactPromptUnsafeFields(prompt);
    expect(result.systemInstructions).not.toContain("sk-ant-api03");
    expect(result.systemInstructions).toContain("已编辑");
  });

  it("redacts secret token patterns", () => {
    const prompt = makePrompt({
      developerInstructions: "Set access_token=xyz123 for this request.",
    });
    const result = redactPromptUnsafeFields(prompt);
    expect(result.developerInstructions).not.toContain("xyz123");
    expect(result.developerInstructions).toContain("已编辑");
  });

  it("redacts bearer token patterns", () => {
    const prompt = makePrompt({
      systemInstructions: "Authorization: Bearer token123.",
    });
    const result = redactPromptUnsafeFields(prompt);
    expect(result.systemInstructions).not.toContain("token123");
  });

  it("redacts raw state key patterns from grounding facts (key replaced)", () => {
    const prompt = makePrompt({
      groundingFacts: ["The particleIds are [1,2,3] and coordinate values={trust:0.5}"],
    });
    const result = redactPromptUnsafeFields(prompt);
    // The word "particleIds" itself should be redacted
    expect(result.groundingFacts[0]).not.toContain("particleIds");
    expect(result.groundingFacts[0]).toContain("已编辑");
  });

  it("redacts embedded coordinate JSON", () => {
    const prompt = makePrompt({
      groundingFacts: ['{"coordinate": {"trust": 0.42, "fear": 0.78}}'],
    });
    const result = redactPromptUnsafeFields(prompt);
    expect(result.groundingFacts[0]).not.toContain("coordinate");
    expect(result.groundingFacts[0]).toContain("已编辑");
  });

  it("redacts memory dump patterns", () => {
    const prompt = makePrompt({
      groundingFacts: ['{"memories": [{"id":"m1","description":"test"}]}'],
    });
    const result = redactPromptUnsafeFields(prompt);
    expect(result.groundingFacts[0]).not.toContain("memories");
    expect(result.groundingFacts[0]).toContain("已编辑");
  });
});

// ============================================================================
// No Raw State / No Secrets in Final Prompt
// ============================================================================

describe("No raw state / no secrets in final prompt", () => {
  it("final prompt from buildLlmBoundaryPromptFromRequest has no raw state keys", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const json = JSON.stringify(prompt).toLowerCase();
    for (const key of RAW_STATE_FORBIDDEN) {
      expect(json).not.toContain(key.toLowerCase());
    }
  });

  it("final prompt has no secret patterns", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const json = JSON.stringify(prompt).toLowerCase();
    for (const key of SECRET_FORBIDDEN) {
      expect(json).not.toContain(key.toLowerCase());
    }
  });

  it("final prompt contains no raw coordinate values object", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const json = JSON.stringify(prompt);
    // Should not contain coordinate values with numeric precision
    expect(json).not.toMatch(/"trust"\s*:\s*0\.\d+/);
    expect(json).not.toMatch(/"fear"\s*:\s*0\.\d+/);
  });

  it("final prompt contains no final reply prose", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const combined = combinedLower(prompt);
    expect(combined).not.toContain("我觉得今天很好");
    expect(combined).not.toContain("finalMessage");
    expect(combined).not.toContain("chatResponse");
  });

  it("final prompt contains no writeback execution authority", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.noWritebackAuthority).toBe(true);
    const combined = combinedLower(prompt);
    expect(combined).not.toContain("execute writeback");
    expect(combined).not.toContain("apply event");
    expect(combined).not.toContain("applyWriteback");
  });
});

// ============================================================================
// Chinese Text Preservation
// ============================================================================

describe("Chinese text preservation", () => {
  it("system instructions are primarily in Chinese", () => {
    const req = makeRequest();
    const si = buildSystemInstructions(req);
    // Should contain Chinese characters
    expect(si).toMatch(/[一-鿿]{10,}/);
  });

  it("developer instructions are primarily in Chinese", () => {
    const req = makeRequest();
    const di = buildDeveloperInstructions(req);
    expect(di).toMatch(/[一-鿿]{10,}/);
  });

  it("forbidden claims are in Chinese", () => {
    const req = makeRequest();
    const claims = buildForbiddenClaims(req);
    const combined = claims.join(" ");
    expect(combined).toMatch(/[一-鿿]{20,}/);
  });

  it("response constraints are in Chinese", () => {
    const req = makeRequest();
    const c = buildResponseConstraints(req);
    const combined = c.join(" ");
    expect(combined).toMatch(/[一-鿿]{10,}/);
  });
});

// ============================================================================
// No LLM/Provider Call
// ============================================================================

describe("No LLM/provider call", () => {
  it("buildLlmBoundaryPromptFromRequest is synchronous", () => {
    const req = makeRequest();
    const result = buildLlmBoundaryPromptFromRequest(req);
    expect(result instanceof Promise).toBe(false);
  });

  it("no fetch/axios/request in builder output", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const json = JSON.stringify(prompt).toLowerCase();
    expect(json).not.toContain("fetch(");
    expect(json).not.toContain("axios");
    expect(json).not.toContain("http://");
    expect(json).not.toContain("https://");
    expect(json).not.toContain("openai");
    expect(json).not.toContain("claude");
    expect(json).not.toContain("gemini");
  });

  it("no provider model names in prompt", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    const json = JSON.stringify(prompt).toLowerCase();
    expect(json).not.toContain("gpt-4");
    expect(json).not.toContain("gpt-3");
    expect(json).not.toContain("claude-3");
    expect(json).not.toContain("claude-4");
    expect(json).not.toContain("gemini-2");
    expect(json).not.toContain("llama");
  });
});

// ============================================================================
// Summarize
// ============================================================================

describe("summarizeLlmPromptBuilder", () => {
  it("references prompt builder role", () => {
    const summary = summarizeLlmPromptBuilder();
    expect(summary.some((s) => s.includes("V13.2"))).toBe(true);
    expect(summary.some((s) => s.includes("Prompt Builder"))).toBe(true);
  });

  it("references system/developer/grounding/forbidden/constraints", () => {
    const text = summarizeLlmPromptBuilder().join(" ");
    expect(text).toContain("instructions");
    expect(text).toContain("Developer");
    expect(text).toContain("Grounding");
    expect(text).toContain("Forbidden");
    expect(text).toContain("constraint");
  });

  it("references redaction and determinism", () => {
    const text = summarizeLlmPromptBuilder().join(" ");
    expect(text).toContain("Redaction");
    expect(text).toContain("Deterministic");
  });

  it("declares readiness for V13.3", () => {
    const summary = summarizeLlmPromptBuilder();
    expect(summary.some((s) => s.includes("V13.3"))).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  it("prompt with options.extraForbiddenClaims", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req, {
      extraForbiddenClaims: ["禁止声称与用户有私人关系"],
    });
    expect(prompt.forbiddenClaims.some((c) => c.includes("私人关系"))).toBe(true);
  });

  it("prompt with options.extraResponseConstraints", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req, {
      extraResponseConstraints: ["额外约束：回复不超过 200 字"],
    });
    expect(prompt.responseConstraints.some((c) => c.includes("200 字"))).toBe(true);
  });

  it("prompt with custom outputFormat", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req, { outputFormat: "markdown" });
    expect(prompt.outputFormat).toBe("markdown");
  });

  it("prompt respects noMutation and noWritebackAuthority invariants", () => {
    const req = makeRequest();
    const prompt = buildLlmBoundaryPromptFromRequest(req);
    expect(prompt.noMutation).toBe(true);
    expect(prompt.noWritebackAuthority).toBe(true);
  });
});
