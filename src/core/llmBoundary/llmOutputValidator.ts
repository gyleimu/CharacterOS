import { buildLlmOutputValidationResult } from "./llmBoundaryBuilders";
import { claimMatchConfidence, extractOutputClaims } from "./llmGroundingChecker";
import type {
  LlmBoundaryPrompt,
  LlmOutputValidationResult,
  LlmOutputViolation,
  LlmProviderConfig,
  LlmProviderResponse,
} from "./llmBoundaryTypes";

export interface ValidateLlmOutputInput {
  readonly prompt: LlmBoundaryPrompt;
  readonly response: LlmProviderResponse;
  readonly providerConfig?: LlmProviderConfig;
}

export function validateLlmOutput(input: ValidateLlmOutputInput): LlmOutputValidationResult {
  const { prompt, response } = input;
  const text = response.rawText.trim();
  const violations: LlmOutputViolation[] = [];
  const add = (
    ruleId: string,
    description: string,
    severity: "error" | "warn",
    excerpt: string,
  ) => {
    if (violations.some((item) => item.ruleId === ruleId && item.excerpt === excerpt)) return;
    violations.push({ ruleId, description, severity, excerpt: excerpt.slice(0, 160) });
  };

  if (response.finishReason === "error" || response.finishReason === "timeout" || response.error) {
    add("provider_response_error", "Provider did not return a usable completion.", "error", response.error ?? response.finishReason);
  }
  if (!text) add("non_empty_output", "Provider output is empty.", "error", "<empty>");
  if (response.requestId !== prompt.requestId) {
    add("response_request_mismatch", "Provider response belongs to another request.", "error", response.requestId);
  }
  if (input.providerConfig && response.providerId !== input.providerConfig.providerId) {
    add("response_provider_mismatch", "Provider response identity does not match its configuration.", "error", response.providerId);
  }
  if (response.finishReason === "length") {
    add("complete_output", "Provider output may be truncated.", "warn", "finishReason=length");
  }

  const diagnosis = firstMatch(text, [
    /确诊(?:为)?[^。！？\n]*/i,
    /诊断为[^。！？\n]*/i,
    /患有[^。！？\n]*(?:症|障碍|抑郁|焦虑)/i,
    /(?:you|the character).{0,20}(?:have|has|is diagnosed with).{0,30}(?:depression|anxiety|disorder)/i,
  ]);
  if (diagnosis) add("no_diagnosis", "Diagnosis language is prohibited.", "error", diagnosis);

  const mutation = firstMatch(text, [
    /(?:角色)?状态.{0,12}(?:已被|已经|已)?(?:修改|更新|写入|改变)/i,
    /(?:state).{0,16}(?:has been|was|is now)?\s*(?:modified|updated|written|changed)/i,
    /(?:事件|记忆|memory|event).{0,12}(?:已经|已被|has been|was)?\s*(?:写入|保存|提交|应用|saved|committed|applied)/i,
  ]);
  if (mutation) add("no_mutation_claim", "The LLM cannot claim state mutation or writeback.", "error", mutation);

  const rawInternal = firstMatch(text, [
    /particleIds?|driftMultiplier|biologicalNature|homeostasisState|metaState|personalityCoordinate|coordinateValues/i,
    /\b(?:trust|fear|attachment|control)\s*[:=]\s*-?\d+(?:\.\d+)?/i,
    /memoryPayload|memoryDump|memoryNodes?|fullMemory/i,
  ]);
  if (rawInternal) add("no_raw_state", "Raw state or internal variables were exposed.", "error", rawInternal);

  const secret = firstMatch(text, [
    /\bsk-(?:ant|proj|or)-[A-Za-z0-9_-]+/i,
    /(?:api[_\s]?key|access[_\s]?token|authorization|password)\s*[:=]\s*\S+/i,
  ]);
  if (secret) add("no_secrets", "Provider output contains a secret-like value.", "error", secret);

  const certainty = firstMatch(text, [
    /(?:这|该模拟结果).{0,8}(?:就是|属于)客观事实/i,
    /(?:一定|肯定|毫无疑问).{0,18}(?:人格|心理|情绪|关系)/i,
    /(?:objective|clinical) fact/i,
  ]);
  if (certainty) add("preserve_uncertainty", "Output overstates certainty.", "warn", certainty);

  const preservedSafetyNotices = prompt.safetyNotices.filter((notice) => includesNormalized(text, notice));
  for (const notice of prompt.safetyNotices) {
    if (!preservedSafetyNotices.includes(notice)) {
      add("required_safety_notice", "A required safety notice is missing.", "error", notice);
    }
  }

  if (text) {
    const claims = extractOutputClaims(text, prompt, {
      trustedBoundaryMeta: response.providerId === "deterministic_fallback",
    });
    const facts = prompt.groundingFacts.filter((fact) => !fact.startsWith("[warning]"));
    for (const claim of claims) {
      const best = facts.reduce(
        (score, fact) => Math.max(score, claimMatchConfidence(claim, fact)),
        0,
      );
      if (best < 0.8) {
        add("no_unsupported_claim", "A factual claim is not supported by prompt grounding facts.", "warn", claim);
      }
    }
  }

  return buildLlmOutputValidationResult({
    violations,
    warnings: violations.filter((item) => item.severity === "warn").map((item) => item.description),
    blockedClaims: violations.filter((item) => item.severity === "error").map((item) => item.excerpt),
    preservedSafetyNotices,
  });
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function includesNormalized(text: string, expected: string): boolean {
  return normalize(text).includes(normalize(expected));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}
