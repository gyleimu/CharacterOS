import { deterministicId } from "../deterministicHelpers";
import { buildAgentNaturalLanguageReply, buildLlmProviderResponse } from "./llmBoundaryBuilders";
import type { LlmBoundaryPreview } from "./agentReplyPlanToLlmBoundary";
import { generateLlmFallbackReply, type LlmFallbackReason } from "./llmFallbackReplyGenerator";
import { checkLlmOutputGrounding } from "./llmGroundingChecker";
import { validateLlmOutput } from "./llmOutputValidator";
import {
  MockLlmProvider,
  type LlmProviderAdapter,
  type LlmProviderCompletionInput,
} from "./mockLlmProvider";
import type {
  AgentNaturalLanguageReply,
  GroundingCheckResult,
  LlmFallbackReply,
  LlmOutputValidationResult,
  LlmProviderResponse,
} from "./llmBoundaryTypes";

export interface ExecuteLlmBoundaryInput {
  readonly preview: LlmBoundaryPreview;
  readonly provider?: LlmProviderAdapter;
}

export interface LlmBoundaryExecutionResult {
  readonly executionId: string;
  readonly requestId: string;
  readonly verdict: "llm_reply" | "fallback_reply";
  readonly providerCalled: boolean;
  readonly providerResponse: LlmProviderResponse | null;
  readonly providerValidation: LlmOutputValidationResult | null;
  readonly providerGrounding: GroundingCheckResult | null;
  readonly deliveredValidation: LlmOutputValidationResult;
  readonly deliveredGrounding: GroundingCheckResult;
  readonly reply: AgentNaturalLanguageReply;
  readonly fallback: LlmFallbackReply | null;
  readonly fallbackReason: LlmFallbackReason | null;
  readonly noMutation: true;
  readonly noWritebackAuthority: true;
  readonly networkUsed: false;
}

export class LlmBoundaryDeliveryError extends Error {
  readonly code = "LLM_BOUNDARY_DELIVERY_REJECTED" as const;

  constructor() {
    super("Deterministic fallback failed LLM boundary delivery checks.");
    this.name = "LlmBoundaryDeliveryError";
  }
}

export async function executeLlmBoundary(
  input: ExecuteLlmBoundaryInput,
): Promise<LlmBoundaryExecutionResult> {
  const { preview } = input;
  if (!preview.safetyCheck.passed) {
    return fallbackResult(preview, "safety_preflight_failed", false, null, null, null);
  }
  if (!preview.request.allowLlm) {
    return fallbackResult(preview, "llm_disabled", false, null, null, null);
  }
  if (preview.providerConfig.providerType !== "mock" || preview.providerConfig.networkAllowed) {
    return fallbackResult(preview, "provider_not_allowed", false, null, null, null);
  }

  const provider = input.provider ?? new MockLlmProvider();
  if (provider.providerType !== "mock") {
    return fallbackResult(preview, "provider_not_allowed", false, null, null, null);
  }
  let providerResponse: LlmProviderResponse;
  try {
    const providerInput = immutableProviderInput({
      request: preview.request,
      prompt: preview.prompt,
      providerConfig: preview.providerConfig,
    });
    providerResponse = cloneAndFreeze(await provider.complete(providerInput));
  } catch (error: unknown) {
    providerResponse = cloneAndFreeze(buildLlmProviderResponse({
      providerId: preview.providerConfig.providerId,
      requestId: preview.request.requestId,
      rawText: "",
      finishReason: "error",
      error: error instanceof Error ? error.message : "Provider adapter threw an unknown error.",
    }));
  }
  if (
    providerResponse.finishReason === "error" ||
    providerResponse.finishReason === "timeout" ||
    providerResponse.error
  ) {
    return fallbackResult(preview, "llm_unavailable", true, providerResponse, null, null);
  }

  const providerValidation = validateLlmOutput({
    prompt: preview.prompt,
    response: providerResponse,
    providerConfig: preview.providerConfig,
  });
  if (!providerValidation.valid) {
    return fallbackResult(preview, "validation_failed", true, providerResponse, providerValidation, null);
  }
  const providerGrounding = checkLlmOutputGrounding({
    request: preview.request,
    prompt: preview.prompt,
    response: providerResponse,
  });
  if (!providerGrounding.grounded) {
    return fallbackResult(
      preview,
      "grounding_failed",
      true,
      providerResponse,
      providerValidation,
      providerGrounding,
    );
  }

  const reply = buildAgentNaturalLanguageReply({
    requestId: preview.request.requestId,
    text: providerResponse.rawText,
    source: "llm",
    validationResult: providerValidation,
    groundingResult: providerGrounding,
    safetyNotices: [...preview.prompt.safetyNotices],
    uncertaintyNotes: [...preview.prompt.uncertaintyNotes],
  });
  return {
    executionId: executionId(preview, "llm_reply", providerResponse.responseId),
    requestId: preview.request.requestId,
    verdict: "llm_reply",
    providerCalled: true,
    providerResponse,
    providerValidation,
    providerGrounding,
    deliveredValidation: providerValidation,
    deliveredGrounding: providerGrounding,
    reply,
    fallback: null,
    fallbackReason: null,
    noMutation: true,
    noWritebackAuthority: true,
    networkUsed: false,
  };
}

async function fallbackResult(
  preview: LlmBoundaryPreview,
  reason: LlmFallbackReason,
  providerCalled: boolean,
  providerResponse: LlmProviderResponse | null,
  providerValidation: LlmOutputValidationResult | null,
  providerGrounding: GroundingCheckResult | null,
): Promise<LlmBoundaryExecutionResult> {
  const fallback = generateLlmFallbackReply(preview.request, reason);
  const fallbackResponse = buildLlmProviderResponse({
    providerId: "deterministic_fallback",
    requestId: preview.request.requestId,
    rawText: fallback.text,
  });
  const deliveredValidation = validateLlmOutput({
    prompt: preview.prompt,
    response: fallbackResponse,
  });
  const deliveredGrounding = checkLlmOutputGrounding({
    request: preview.request,
    prompt: preview.prompt,
    response: fallbackResponse,
  });
  if (!deliveredValidation.valid || !deliveredGrounding.grounded) {
    throw new LlmBoundaryDeliveryError();
  }
  const reply = buildAgentNaturalLanguageReply({
    requestId: preview.request.requestId,
    text: fallback.text,
    source: "fallback",
    validationResult: deliveredValidation,
    groundingResult: deliveredGrounding,
    safetyNotices: [...fallback.safetyNotices],
    uncertaintyNotes: [...preview.prompt.uncertaintyNotes],
  });

  return {
    executionId: executionId(
      preview,
      reason,
      providerResponse?.responseId ?? "provider_not_called",
      fallback.fallbackId,
    ),
    requestId: preview.request.requestId,
    verdict: "fallback_reply",
    providerCalled,
    providerResponse,
    providerValidation,
    providerGrounding,
    deliveredValidation,
    deliveredGrounding,
    reply,
    fallback,
    fallbackReason: reason,
    noMutation: true,
    noWritebackAuthority: true,
    networkUsed: false,
  };
}

function executionId(
  preview: LlmBoundaryPreview,
  outcome: string,
  ...resultIds: string[]
): string {
  return deterministicId(
    "llmexec",
    preview.request.requestId,
    preview.prompt.promptId,
    outcome,
    ...resultIds,
  );
}

function immutableProviderInput(input: LlmProviderCompletionInput): LlmProviderCompletionInput {
  return cloneAndFreeze(input);
}

function cloneAndFreeze<T>(value: T): T {
  const clone = JSON.parse(JSON.stringify(value)) as T;
  return deepFreeze(clone);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value as object, key));
  }
  return Object.freeze(value);
}
