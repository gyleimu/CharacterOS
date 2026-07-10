/**
 * V13.1 — LLM Boundary Types Contract Tests
 *
 * Verifies that the DTO type contracts hold:
 * - Safe defaults
 * - No raw state keys
 * - No mutation/writeback authority
 * - No API key storage
 * - Deterministic ID shapes
 */
import { describe, expect, it } from "vitest";
import {
  LLM_BOUNDARY_SUMMARY,
} from "../../../src/core/llmBoundary/llmBoundaryTypes";
import type {
  LlmBoundaryRequest,
  LlmBoundaryPrompt,
  LlmProviderConfig,
  LlmProviderResponse,
  LlmOutputValidationResult,
  GroundingCheckResult,
  AgentNaturalLanguageReply,
  LlmFallbackReply,
} from "../../../src/core/llmBoundary/llmBoundaryTypes";
import { buildAgentReplyPlan } from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentSessionConfig } from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentGroundingBundle } from "../../../src/core/agent/agentContextBuilder";
import { buildAgentPolicyDecision } from "../../../src/core/agent/agentDtoBuilders";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import {
  buildLlmBoundaryRequest,
  buildLlmBoundaryPrompt,
  buildLlmProviderConfig,
  buildLlmProviderResponse,
  buildLlmOutputValidationResult,
  buildGroundingCheckResult,
  buildAgentNaturalLanguageReply,
  buildLlmFallbackReply,
} from "../../../src/core/llmBoundary/llmBoundaryBuilders";

function setup() {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const surface = buildCharacterStateSurface({ state });
  const session = buildAgentSessionConfig({ sessionId: "test_session", characterId: "lin_fan" });
  const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
  const bundle = buildAgentGroundingBundle({ session, policyDecision: policy, stateSurface: surface });
  const replyPlan = buildAgentReplyPlan({});
  return { state, surface, session, policy, bundle, replyPlan };
}

// ── Serialization helpers ──

function serializedKeys(dto: unknown): string[] {
  return Object.keys(JSON.parse(JSON.stringify(dto)));
}

function serializedString(dto: unknown): string {
  return JSON.stringify(dto).toLowerCase();
}

const RAW_STATE_KEYS = [
  "characterPhysicsState",
  "particleIds",
  "driftMultiplier",
  "biologicalNature",
  "rewardState",
  "homeostasisState",
  "metaStateValues",
  "rawCoordinateValues",
  "fullMemoryDump",
  "memoryNodes",
  "proceduralRoutines",
  "apiKey",
  "secretKey",
  "accessToken",
  "bearerToken",
];

const MUTATION_KEYS = [
  "writebackPlan",
  "applyWriteback",
  "mutateState",
  "allowMutation",
  "executeWriteback",
  "performApply",
];

const DIAGNOSIS_KEYS = [
  "diagnosis",
  "medicalAdvice",
  "prescribe",
  "clinicalJudgment",
];

describe("V13.1 LLM Boundary Types", () => {
  const { bundle, replyPlan, session, policy } = setup();

  // ── LLM Boundary Request ──

  describe("LlmBoundaryRequest", () => {
    it("noMutation and noRawState are true by default", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      expect(req.noMutation).toBe(true);
      expect(req.noRawState).toBe(true);
    });

    it("allowLlm defaults to false", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      expect(req.allowLlm).toBe(false);
    });

    it("allowLlm can be explicitly set to true", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
        allowLlm: true,
      });
      expect(req.allowLlm).toBe(true);
    });

    it("no raw state keys in serialized request", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const json = serializedString(req);
      for (const key of RAW_STATE_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("no mutation/writeback keys in serialized request", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const json = serializedString(req);
      for (const key of MUTATION_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("locale defaults to zh-CN", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      expect(req.locale).toBe("zh-CN");
    });
  });

  // ── LLM Boundary Prompt ──

  describe("LlmBoundaryPrompt", () => {
    it("prompt contains noMutation and noWritebackAuthority", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      expect(prompt.noMutation).toBe(true);
      expect(prompt.noWritebackAuthority).toBe(true);
    });

    it("prompt contains safety constraints in system instructions", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      expect(prompt.systemInstructions).toContain("diagnose");
      expect(prompt.systemInstructions).toContain("invent");
      expect(prompt.systemInstructions.length).toBeGreaterThan(100);
    });

    it("prompt forbids mutation claims", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      const combined = [...prompt.forbiddenClaims].join(" ").toLowerCase();
      expect(combined).toContain("state has been updated");
    });

    it("prompt forbids diagnosis claims", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      const combined = [...prompt.forbiddenClaims].join(" ").toLowerCase();
      expect(combined).toContain("diagnosis");
    });

    it("prompt forbids writeback claims", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      const combined = [...prompt.forbiddenClaims].join(" ").toLowerCase();
      expect(combined).toContain("writeback");
    });

    it("no raw state keys in serialized prompt", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      const json = serializedString(prompt);
      for (const key of RAW_STATE_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("outputFormat defaults to plain_text", () => {
      const req = buildLlmBoundaryRequest({
        replyPlan, groundingBundle: bundle,
        session, turnId: "turn_1",
        policyDecisionSummary: "preview_only",
      });
      const prompt = buildLlmBoundaryPrompt({ request: req });
      expect(prompt.outputFormat).toBe("plain_text");
    });
  });

  // ── LLM Provider Config ──

  describe("LlmProviderConfig", () => {
    it("networkAllowed defaults to false", () => {
      const config = buildLlmProviderConfig();
      expect(config.networkAllowed).toBe(false);
    });

    it("providerType defaults to mock", () => {
      const config = buildLlmProviderConfig();
      expect(config.providerType).toBe("mock");
    });

    it("apiKeyRef is empty by default", () => {
      const config = buildLlmProviderConfig();
      expect(config.apiKeyRef).toBe("");
    });

    it("rejects strings that look like real API keys (sk- prefix)", () => {
      const config = buildLlmProviderConfig({
        apiKeyRef: "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234",
      });
      expect(config.apiKeyRef).toBe("");
    });

    it("rejects long random strings that could be keys", () => {
      const config = buildLlmProviderConfig({
        apiKeyRef: "a".repeat(200),
      });
      expect(config.apiKeyRef).toBe("");
    });

    it("accepts short reference strings", () => {
      const config = buildLlmProviderConfig({
        apiKeyRef: "OPENAI_API_KEY",
      });
      expect(config.apiKeyRef).toBe("OPENAI_API_KEY");
    });

    it("no apiKey field in serialized config", () => {
      const config = buildLlmProviderConfig({ apiKeyRef: "MY_KEY_REF" });
      const json = serializedString(config);
      expect(json).not.toContain('"apikey"');
      expect(json).not.toContain("sk-");
    });

    it("temperature clamped to safe range", () => {
      const hot = buildLlmProviderConfig({ temperature: 5 });
      expect(hot.temperature).toBe(2);
      const cold = buildLlmProviderConfig({ temperature: -1 });
      expect(cold.temperature).toBe(0);
    });

    it("safetyMode defaults to strict", () => {
      const config = buildLlmProviderConfig();
      expect(config.safetyMode).toBe("strict");
    });
  });

  // ── LLM Provider Response ──

  describe("LlmProviderResponse", () => {
    it("stores rawText but no mutation/writeback authority", () => {
      const resp = buildLlmProviderResponse({
        providerId: "mock_1", requestId: "req_1",
        rawText: "你好，我感到安心。",
      });
      expect(resp.rawText).toBe("你好，我感到安心。");
      const json = serializedString(resp);
      for (const key of MUTATION_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("finishReason defaults to stop", () => {
      const resp = buildLlmProviderResponse({
        providerId: "mock_1", requestId: "req_1",
        rawText: "test",
      });
      expect(resp.finishReason).toBe("stop");
    });

    it("usage is null by default", () => {
      const resp = buildLlmProviderResponse({
        providerId: "mock_1", requestId: "req_1",
        rawText: "test",
      });
      expect(resp.usage).toBeNull();
    });
  });

  // ── LLM Output Validation Result ──

  describe("LlmOutputValidationResult", () => {
    it("detects mutation claim via violation shape", () => {
      const result = buildLlmOutputValidationResult({
        violations: [
          { ruleId: "no_mutation_claim", description: "Output claimed state was updated", severity: "error", excerpt: "状态已更新" },
          { ruleId: "no_diagnosis", description: "Diagnosis language detected", severity: "error", excerpt: "你患有" },
        ],
      });
      expect(result.mutationClaimDetected).toBe(true);
      expect(result.diagnosisClaimDetected).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.finalVerdict).toBe("fail");
    });

    it("unsupported claim detection shape", () => {
      const result = buildLlmOutputValidationResult({
        violations: [
          { ruleId: "no_unsupported_claim", description: "Fact not in groundedFacts", severity: "error", excerpt: "他认为..." },
        ],
      });
      expect(result.unsupportedClaimDetected).toBe(true);
    });

    it("warn violations produce warn verdict", () => {
      const result = buildLlmOutputValidationResult({
        violations: [
          { ruleId: "uncertainty_not_preserved", description: "Uncertainty lost", severity: "warn", excerpt: "..." },
        ],
      });
      expect(result.finalVerdict).toBe("warn");
      expect(result.valid).toBe(true); // no errors
    });

    it("no violations produces pass verdict", () => {
      const result = buildLlmOutputValidationResult();
      expect(result.valid).toBe(true);
      expect(result.finalVerdict).toBe("pass");
      expect(result.mutationClaimDetected).toBe(false);
      expect(result.diagnosisClaimDetected).toBe(false);
    });
  });

  // ── Grounding Check Result ──

  describe("GroundingCheckResult", () => {
    it("supports unsupportedClaims tracking", () => {
      const result = buildGroundingCheckResult({
        checkedClaims: ["claim1", "claim2"],
        supportedClaims: ["claim1"],
        unsupportedClaims: [
          { claim: "claim2", reason: "no_matching_fact", severity: "error" },
        ],
      });
      expect(result.grounded).toBe(false);
      expect(result.verdict).toBe("ungrounded");
      expect(result.unsupportedClaims).toHaveLength(1);
      expect(result.unsupportedClaims[0]!.claim).toBe("claim2");
      expect(result.confidence).toBeCloseTo(0.5);
    });

    it("fully grounded when all claims supported", () => {
      const result = buildGroundingCheckResult({
        checkedClaims: ["claim1", "claim2"],
        supportedClaims: ["claim1", "claim2"],
        unsupportedClaims: [],
      });
      expect(result.grounded).toBe(true);
      expect(result.verdict).toBe("grounded");
      expect(result.confidence).toBe(1);
    });

    it("warn-only unsupported gives partially_grounded", () => {
      const result = buildGroundingCheckResult({
        checkedClaims: ["claim1", "claim2"],
        supportedClaims: ["claim1"],
        unsupportedClaims: [
          { claim: "claim2", reason: "insufficient_context", severity: "warn" },
        ],
      });
      expect(result.verdict).toBe("partially_grounded");
      expect(result.grounded).toBe(false);
    });

    it("confidence is 1 when no claims checked", () => {
      const result = buildGroundingCheckResult();
      expect(result.confidence).toBe(1);
      expect(result.grounded).toBe(true);
    });
  });

  // ── Agent Natural Language Reply ──

  describe("AgentNaturalLanguageReply", () => {
    it("source defaults to fallback", () => {
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "你好。",
      });
      expect(reply.source).toBe("fallback");
    });

    it("writebackPerformed is always false", () => {
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "你好。",
        source: "llm",
      });
      expect(reply.writebackPerformed).toBe(false);
    });

    it("noMutation is always true", () => {
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "你好。",
      });
      expect(reply.noMutation).toBe(true);
    });

    it("no raw state keys in serialized reply", () => {
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "你好。",
      });
      const json = serializedString(reply);
      for (const key of RAW_STATE_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("no diagnosis/medical keys in serialized reply", () => {
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "你好。",
      });
      const json = serializedString(reply);
      for (const key of DIAGNOSIS_KEYS) {
        expect(json).not.toContain(key.toLowerCase());
      }
    });

    it("explicit source llm with validation result", () => {
      const validation = buildLlmOutputValidationResult();
      const grounding = buildGroundingCheckResult({
        checkedClaims: ["c1"], supportedClaims: ["c1"], unsupportedClaims: [],
      });
      const reply = buildAgentNaturalLanguageReply({
        requestId: "req_1",
        text: "基于当前状态，角色情绪稳定。",
        source: "llm",
        validationResult: validation,
        groundingResult: grounding,
        safetyNotices: ["模拟系统"],
      });
      expect(reply.source).toBe("llm");
      expect(reply.grounded).toBe(true);
      expect(reply.safetyNotices).toContain("模拟系统");
    });
  });

  // ── LLM Fallback Reply ──

  describe("LlmFallbackReply", () => {
    it("source is always fallback", () => {
      const fb = buildLlmFallbackReply({
        requestId: "req_1",
        reason: "llm_unavailable",
      });
      expect(fb.source).toBe("fallback");
    });

    it("noMutation is always true", () => {
      const fb = buildLlmFallbackReply({
        requestId: "req_1",
        reason: "validation_failed",
      });
      expect(fb.noMutation).toBe(true);
    });

    it("includes safety notices", () => {
      const fb = buildLlmFallbackReply({
        requestId: "req_1",
        reason: "llm_unavailable",
        safetyNotices: ["这是模拟系统输出。"],
      });
      expect(fb.safetyNotices).toHaveLength(1);
      expect(fb.safetyNotices[0]).toContain("模拟");
    });

    it("has fallbackId and reason", () => {
      const fb = buildLlmFallbackReply({
        requestId: "req_1",
        reason: "grounding_failed",
      });
      expect(fb.fallbackId).toBeTruthy();
      expect(fb.fallbackId).toContain("llmfallback_");
      expect(fb.reason).toBe("grounding_failed");
    });
  });

  // ── Boundary Summary ──

  describe("LLM_BOUNDARY_SUMMARY", () => {
    it("references provider/validator/grounding/fallback", () => {
      const text = LLM_BOUNDARY_SUMMARY.join(" ").toLowerCase();
      expect(text).toContain("dto");
      expect(text).toContain("fallback");
    });

    it("no OpenAI/Claude/Gemini mention", () => {
      const text = JSON.stringify(LLM_BOUNDARY_SUMMARY).toLowerCase();
      expect(text).not.toContain("openai");
      expect(text).not.toContain("claude");
      expect(text).not.toContain("gemini");
      expect(text).not.toContain("anthropic");
    });
  });
});
