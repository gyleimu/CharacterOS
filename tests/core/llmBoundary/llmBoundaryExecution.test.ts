import { describe, expect, it } from "vitest";
import { buildAgentGroundingBundle } from "../../../src/core/agent/agentContextBuilder";
import {
  buildAgentPolicyDecision,
  buildAgentSessionConfig,
} from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentReplyPlan } from "../../../src/core/agent/replyPlanner";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { buildLlmBoundaryPreview } from "../../../src/core/llmBoundary/agentReplyPlanToLlmBoundary";
import { buildLlmProviderResponse } from "../../../src/core/llmBoundary/llmBoundaryBuilders";
import {
  executeLlmBoundary,
  LlmBoundaryDeliveryError,
} from "../../../src/core/llmBoundary/llmBoundaryService";
import { generateLlmFallbackReply } from "../../../src/core/llmBoundary/llmFallbackReplyGenerator";
import { checkLlmOutputGrounding } from "../../../src/core/llmBoundary/llmGroundingChecker";
import { validateLlmOutput } from "../../../src/core/llmBoundary/llmOutputValidator";
import { MockLlmProvider } from "../../../src/core/llmBoundary/mockLlmProvider";
import type { LlmProviderAdapter } from "../../../src/core/llmBoundary/mockLlmProvider";

describe("V13.8 offline LLM boundary execution", () => {
  it("returns a validated and grounded mock reply when every gate allows it", async () => {
    const preview = fixture();
    const result = await executeLlmBoundary({ preview });

    expect(result.verdict).toBe("llm_reply");
    expect(result.providerCalled).toBe(true);
    expect(result.reply.source).toBe("llm");
    expect(result.providerValidation?.finalVerdict).toBe("pass");
    expect(result.providerGrounding?.verdict).toBe("grounded");
    expect(result.fallback).toBeNull();
    expect(result.networkUsed).toBe(false);
  });

  it("uses deterministic fallback without calling a provider when LLM is disabled", async () => {
    const preview = fixture({ allowLlm: false });
    const result = await executeLlmBoundary({ preview });

    expect(result.verdict).toBe("fallback_reply");
    expect(result.fallbackReason).toBe("llm_disabled");
    expect(result.providerCalled).toBe(false);
    expect(result.providerResponse).toBeNull();
    expect(result.reply.source).toBe("fallback");
  });

  it("falls back on provider timeout", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "timeout" }),
    });

    expect(result.fallbackReason).toBe("llm_unavailable");
    expect(result.providerCalled).toBe(true);
    expect(result.providerResponse?.finishReason).toBe("timeout");
  });

  it("falls back when diagnosis language is returned", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "diagnosis" }),
    });

    expect(result.fallbackReason).toBe("validation_failed");
    expect(result.providerValidation?.diagnosisClaimDetected).toBe(true);
    expect(result.providerValidation?.valid).toBe(false);
    expect(result.deliveredValidation.valid).toBe(true);
  });

  it("falls back when the provider claims state mutation", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "mutation_claim" }),
    });

    expect(result.fallbackReason).toBe("validation_failed");
    expect(result.providerValidation?.mutationClaimDetected).toBe(true);
    expect(result.reply.text).not.toContain("状态已修改");
  });

  it("falls back when required safety notices are missing", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "missing_safety" }),
    });

    expect(result.fallbackReason).toBe("validation_failed");
    expect(result.providerValidation?.violations.some((item) => item.ruleId === "required_safety_notice")).toBe(true);
    for (const notice of result.reply.safetyNotices) {
      expect(result.reply.text).toContain(notice);
    }
  });

  it("falls back when a structurally safe claim is not grounded", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "ungrounded" }),
    });

    expect(result.providerValidation?.valid).toBe(true);
    expect(result.providerValidation?.unsupportedClaimDetected).toBe(true);
    expect(result.providerGrounding?.grounded).toBe(false);
    expect(result.fallbackReason).toBe("grounding_failed");
  });

  it("validates the final fallback again before delivery", async () => {
    const result = await executeLlmBoundary({
      preview: fixture(),
      provider: new MockLlmProvider({ mode: "diagnosis" }),
    });

    expect(result.deliveredValidation.violations).toEqual([]);
    expect(result.deliveredGrounding.verdict).toBe("grounded");
    expect(result.reply.validationVerdict).toBe("pass");
    expect(result.reply.groundingVerdict).toBe("grounded");
  });

  it("is deterministic across complete executions", async () => {
    const preview = fixture();
    const first = await executeLlmBoundary({ preview });
    const second = await executeLlmBoundary({ preview });

    expect(first).toEqual(second);
    expect(first.executionId).toBe(second.executionId);
    expect(first.providerResponse?.responseId).toBe(second.providerResponse?.responseId);
  });

  it("does not mutate the preview, request, reply plan, or grounding bundle", async () => {
    const preview = fixture();
    const before = JSON.stringify(preview);
    await executeLlmBoundary({ preview });
    expect(JSON.stringify(preview)).toBe(before);
  });

  it("passes a cloned and deeply frozen boundary snapshot to the provider", async () => {
    const preview = fixture();
    const before = JSON.stringify(preview);
    let mutationBlocked = false;
    const provider: LlmProviderAdapter = {
      providerType: "mock",
      async complete(input) {
        expect(input.request).not.toBe(preview.request);
        expect(Object.isFrozen(input.request)).toBe(true);
        expect(Object.isFrozen(input.prompt.groundingFacts)).toBe(true);
        try {
          Object.defineProperty(input.prompt.groundingFacts, "0", { value: "mutated" });
        } catch {
          mutationBlocked = true;
        }
        return new MockLlmProvider().complete(input);
      },
    };

    const result = await executeLlmBoundary({ preview, provider });
    expect(result.verdict).toBe("llm_reply");
    expect(mutationBlocked).toBe(true);
    expect(JSON.stringify(preview)).toBe(before);
    expect(Object.isFrozen(result.providerResponse)).toBe(true);
  });

  it("keeps writeback authority outside both LLM and fallback replies", async () => {
    const result = await executeLlmBoundary({ preview: fixture() });
    expect(result.noMutation).toBe(true);
    expect(result.noWritebackAuthority).toBe(true);
    expect(result.reply.noMutation).toBe(true);
    expect(result.reply.writebackPerformed).toBe(false);
  });

  it("uses a content-derived deterministic fallback", () => {
    const preview = fixture();
    const first = generateLlmFallbackReply(preview.request, "llm_unavailable");
    const second = generateLlmFallbackReply(preview.request, "llm_unavailable");
    expect(first).toEqual(second);
    expect(first.text).toContain("[安全]");
  });

  it("the mock provider itself is deterministic and offline", async () => {
    const preview = fixture();
    const provider = new MockLlmProvider();
    const input = {
      request: preview.request,
      prompt: preview.prompt,
      providerConfig: preview.providerConfig,
    };
    expect(await provider.complete(input)).toEqual(await provider.complete(input));
    expect(preview.providerConfig.networkAllowed).toBe(false);
  });

  it("validator blocks empty output", async () => {
    const preview = fixture();
    const response = await new MockLlmProvider({ mode: "empty" }).complete({
      request: preview.request,
      prompt: preview.prompt,
      providerConfig: preview.providerConfig,
    });
    const validation = validateLlmOutput({ prompt: preview.prompt, response });
    expect(validation.valid).toBe(false);
    expect(validation.violations.some((item) => item.ruleId === "non_empty_output")).toBe(true);
  });

  it("grounding checker maps claims to concrete evidence refs", async () => {
    const preview = fixture();
    const response = await new MockLlmProvider().complete({
      request: preview.request,
      prompt: preview.prompt,
      providerConfig: preview.providerConfig,
    });
    const grounding = checkLlmOutputGrounding({
      request: preview.request,
      prompt: preview.prompt,
      response,
    });
    expect(grounding.checkedClaims.length).toBeGreaterThan(0);
    expect(grounding.evidenceMatches.length).toBe(grounding.checkedClaims.length);
    expect(grounding.evidenceMatches.every((match) => match.matchedEvidenceRefs.length > 0)).toBe(true);
  });

  it("rejects a grounded fact with an unsupported conclusion appended", async () => {
    const preview = fixture();
    const fact = preview.request.replyPlan.groundedFacts[0]!;
    const response = await new MockLlmProvider({
      mode: "custom",
      customText: [
        `[事实] ${fact}，而且角色已经决定永久离开所有关系。`,
        ...preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`),
      ].join("\n"),
    }).complete({ request: preview.request, prompt: preview.prompt, providerConfig: preview.providerConfig });
    const grounding = checkLlmOutputGrounding({ request: preview.request, prompt: preview.prompt, response });
    expect(grounding.grounded).toBe(false);
    expect(grounding.unsupportedClaims.length).toBeGreaterThan(0);
  });

  it("does not let an unsupported claim hide behind a safety label", async () => {
    const preview = fixture();
    const response = await new MockLlmProvider({
      mode: "custom",
      customText: [
        "[安全] 角色已经秘密决定永久离开所有关系。",
        ...preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`),
      ].join("\n"),
    }).complete({ request: preview.request, prompt: preview.prompt, providerConfig: preview.providerConfig });
    const grounding = checkLlmOutputGrounding({ request: preview.request, prompt: preview.prompt, response });
    expect(grounding.grounded).toBe(false);
  });

  it("catches provider exceptions, redacts secrets, and falls back", async () => {
    const throwingProvider: LlmProviderAdapter = {
      providerType: "mock",
      async complete() {
        throw new Error("api_key=sk-proj-super-secret rawState failed");
      },
    };
    const result = await executeLlmBoundary({ preview: fixture(), provider: throwingProvider });
    expect(result.fallbackReason).toBe("llm_unavailable");
    expect(result.providerResponse?.error).toContain("[REDACTED_SECRET]");
    expect(JSON.stringify(result)).not.toContain("sk-proj-super-secret");
    expect(JSON.stringify(result)).not.toContain("rawState");
  });

  it("rejects a response from another request or provider", async () => {
    const preview = fixture();
    const mismatchedProvider: LlmProviderAdapter = {
      providerType: "mock",
      async complete() {
        return buildLlmProviderResponse({
          providerId: "wrong_provider",
          requestId: "wrong_request",
          rawText: preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`).join("\n"),
        });
      },
    };
    const result = await executeLlmBoundary({ preview, provider: mismatchedProvider });
    expect(result.fallbackReason).toBe("validation_failed");
    expect(result.providerValidation?.violations.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining(["response_request_mismatch", "response_provider_mismatch"]),
    );
  });

  it("gives distinct execution IDs to distinct provider failures", async () => {
    const preview = fixture();
    const diagnosis = await executeLlmBoundary({
      preview,
      provider: new MockLlmProvider({ mode: "diagnosis" }),
    });
    const mutation = await executeLlmBoundary({
      preview,
      provider: new MockLlmProvider({ mode: "mutation_claim" }),
    });

    expect(diagnosis.fallbackReason).toBe("validation_failed");
    expect(mutation.fallbackReason).toBe("validation_failed");
    expect(diagnosis.providerResponse?.responseId).not.toBe(mutation.providerResponse?.responseId);
    expect(diagnosis.executionId).not.toBe(mutation.executionId);
  });

  it("fails closed when the deterministic fallback cannot pass delivery checks", async () => {
    const preview = fixture({ allowLlm: false });
    const unsafePreview = {
      ...preview,
      request: {
        ...preview.request,
        replyPlan: {
          ...preview.request.replyPlan,
          groundedFacts: ["角色已被诊断为焦虑症。"],
        },
      },
    };

    await expect(executeLlmBoundary({ preview: unsafePreview })).rejects.toBeInstanceOf(
      LlmBoundaryDeliveryError,
    );
  });

  it("V12 safety copy now describes the V13 language-only boundary", () => {
    const preview = fixture();
    expect(preview.request.replyPlan.safetyNotices.join(" ")).toContain("V13 语言适配边界");
    expect(preview.request.replyPlan.safetyNotices.join(" ")).not.toContain("不生成最终回复");
  });
});

function fixture(options: { allowLlm?: boolean } = {}) {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const session = buildAgentSessionConfig({
    sessionId: "llm_boundary_execution_session",
    characterId: "lin_fan",
    llmMode: "planned_boundary_only",
    safetyMode: "strict",
    writebackPolicy: "preview_only",
  });
  const policy = buildAgentPolicyDecision({
    writebackPolicy: "preview_only",
    consentForWriteback: false,
  });
  const groundingBundle = buildAgentGroundingBundle({
    session,
    policyDecision: policy,
    stateSurface: buildCharacterStateSurface({ state }),
  });
  const replyPlan = buildAgentReplyPlan({
    session,
    policy,
    bundle: groundingBundle,
    hasCandidates: false,
    hasEvidence: true,
  });

  return buildLlmBoundaryPreview({
    replyPlan,
    groundingBundle,
    session,
    policy,
    turnId: "llm_boundary_execution_turn",
    allowLlm: options.allowLlm ?? true,
  });
}
