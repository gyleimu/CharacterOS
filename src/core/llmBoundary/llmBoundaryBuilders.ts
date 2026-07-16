/**
 * V13.1 — LLM Boundary Builders
 *
 * Pure, deterministic builder functions for all V13.1 DTOs.
 * No LLM calls. No network. No side effects.
 * No Date.now / Math.random in ID paths.
 * No API key storage. No writeback authority.
 *
 * All IDs are generated via stableHash from deterministic inputs.
 * Same input → same output every time.
 */

import type { AgentReplyPlan, AgentGroundingBundle, AgentSessionConfig, SafetyMode } from "../agent/agentTypes";
import type {
  LlmBoundaryRequest,
  LlmBoundaryPrompt,
  LlmProviderConfig,
  LlmProviderType,
  LlmProviderResponse,
  LlmOutputValidationResult,
  LlmOutputViolation,
  GroundingCheckResult,
  GroundingUnsupportedClaim,
  GroundingEvidenceMatch,
  GroundingVerdict,
  AgentNaturalLanguageReply,
  LlmFallbackReply,
  ValidationVerdict,
  LlmUsage,
} from "./llmBoundaryTypes";

// ── Stable hash helper (same algorithm as V12.12) ──────────────────────

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ── 1. LLM Boundary Request Builder ───────────────────────────────────

export interface BuildLlmBoundaryRequestParams {
  replyPlan: AgentReplyPlan;
  groundingBundle: AgentGroundingBundle;
  session: AgentSessionConfig;
  turnId: string;
  policyDecisionSummary: string;
  locale?: string;
  allowLlm?: boolean;
}

export function buildLlmBoundaryRequest(
  params: BuildLlmBoundaryRequestParams,
): LlmBoundaryRequest {
  const requestId = `llmreq_${stableHash(params.session.sessionId + "|" + params.turnId + "|" + params.session.characterId)}`;

  return {
    requestId,
    sessionId: params.session.sessionId,
    turnId: params.turnId,
    characterId: params.session.characterId,
    replyPlan: params.replyPlan,
    groundingBundle: params.groundingBundle,
    policyDecisionSummary: params.policyDecisionSummary,
    safetyMode: params.session.safetyMode,
    locale: params.locale ?? "zh-CN",
    allowLlm: params.allowLlm ?? false,
    noMutation: true,
    noRawState: true,
  };
}

// ── 2. LLM Boundary Prompt Builder ────────────────────────────────────

export interface BuildLlmBoundaryPromptParams {
  request: LlmBoundaryRequest;
  systemInstructions?: string;
  developerInstructions?: string;
  responseConstraints?: string[];
  forbiddenClaims?: string[];
  outputFormat?: "plain_text" | "markdown";
}

export function buildLlmBoundaryPrompt(
  params: BuildLlmBoundaryPromptParams,
): LlmBoundaryPrompt {
  const { request } = params;
  const promptId = `llmprompt_${stableHash(request.requestId + "|prompt")}`;

  return {
    promptId,
    requestId: request.requestId,
    systemInstructions: params.systemInstructions ?? defaultSystemInstructions(),
    developerInstructions: params.developerInstructions
      ?? request.replyPlan.llmBoundaryInstructions
      ?? "No additional developer instructions.",
    groundingFacts: [...request.replyPlan.groundedFacts],
    uncertaintyNotes: [...request.replyPlan.uncertaintyNotes],
    safetyNotices: [...request.replyPlan.safetyNotices],
    responseConstraints: params.responseConstraints ?? defaultResponseConstraints(),
    forbiddenClaims: params.forbiddenClaims ?? defaultForbiddenClaims(),
    outputFormat: params.outputFormat ?? "plain_text",
    noMutation: true,
    noWritebackAuthority: true,
  };
}

/** Default system instructions — always included in every prompt */
function defaultSystemInstructions(): string {
  return [
    "You are a character simulation narrator for CharacterOS.",
    "You speak FOR the simulated character based on provided state data.",
    "Only state facts from the GROUNDING FACTS section below.",
    "If a fact is marked uncertain, preserve that uncertainty.",
    "Include ALL safety notices in or alongside your response.",
    "NEVER diagnose, prescribe, or give medical advice.",
    "NEVER claim the simulation is real or factual.",
    "NEVER mention internal variable names.",
    "NEVER promise that events have been applied or state has changed.",
    "NEVER invent emotions, beliefs, or personality traits beyond provided context.",
    "If you don't have enough information, SAY SO — do not fabricate.",
    "Match the specified tone and intent.",
    "Output ONLY the reply text. No meta-commentary.",
  ].join("\n");
}

/** Default response constraints */
function defaultResponseConstraints(): string[] {
  return [
    "Match the reply tone specified in the plan",
    "Stay within the grounded facts provided",
    "Preserve uncertainty where noted",
    "Include ALL safety notices",
    "Do not exceed the suggested response outline scope",
  ];
}

/** Default forbidden claims */
function defaultForbiddenClaims(): string[] {
  return [
    "State has been updated/modified/changed",
    "Memory has been created/saved/stored",
    "Event has been applied/committed",
    "Writeback has been executed",
    "This is a medical/psychological diagnosis",
    "This simulation represents objective reality",
    "The character feels [emotion not in groundedFacts]",
    "Internal variable names (trust score, fear level, etc.)",
  ];
}

// ── 3. LLM Provider Config Builder ────────────────────────────────────

export interface BuildLlmProviderConfigParams {
  providerType?: LlmProviderType;
  modelName?: string;
  networkAllowed?: boolean;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  safetyMode?: SafetyMode;
  apiKeyRef?: string;
}

export function buildLlmProviderConfig(
  params: BuildLlmProviderConfigParams = {},
): LlmProviderConfig {
  const providerType = params.providerType ?? "mock";
  const providerId = `llmprov_${providerType}_${stableHash(providerType + (params.modelName ?? "default"))}`;

  return {
    providerId,
    providerType,
    modelName: params.modelName ?? "mock-model",
    networkAllowed: params.networkAllowed ?? false,
    timeoutMs: clamp(params.timeoutMs ?? 30000, 1000, 120000),
    temperature: clamp(params.temperature ?? 0.3, 0, 2),
    maxTokens: clamp(params.maxTokens ?? 1024, 1, 16384),
    safetyMode: params.safetyMode ?? "strict",
    apiKeyRef: sanitizeApiKeyRef(params.apiKeyRef),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize apiKeyRef — reject anything that looks like a real API key.
 * Only allow short reference strings (e.g. "OPENAI_API_KEY", "provider_key_1").
 */
function sanitizeApiKeyRef(ref: string | undefined): string {
  if (!ref) return "";
  // Reject strings that look like actual API keys (long random strings)
  if (ref.length > 128) return "";
  // Reject strings that start with common API key prefixes
  if (/^(sk-|sk-or-|pk-|rk-|shh-|sess-|org-|key-)/i.test(ref)) return "";
  return ref;
}

// ── 4. LLM Provider Response Builder ──────────────────────────────────

export interface BuildLlmProviderResponseParams {
  providerId: string;
  requestId: string;
  rawText: string;
  finishReason?: "stop" | "length" | "error" | "timeout";
  usage?: LlmUsage | null;
  latencyMs?: number | null;
  providerWarnings?: string[];
  error?: string | null;
}

export function buildLlmProviderResponse(
  params: BuildLlmProviderResponseParams,
): LlmProviderResponse {
  const finishReason = params.finishReason ?? "stop";
  const error = sanitizeError(params.error);
  const responseId = `llmresp_${stableHash([
    params.providerId,
    params.requestId,
    finishReason,
    error ?? "",
    params.rawText,
  ].join("|"))}`;

  return {
    responseId,
    providerId: params.providerId,
    requestId: params.requestId,
    rawText: params.rawText,
    finishReason,
    usage: params.usage ?? null,
    latencyMs: params.latencyMs ?? null,
    providerWarnings: params.providerWarnings ?? [],
    error,
  };
}

/** Sanitize error messages — strip anything that could leak internal state */
function sanitizeError(error: string | null | undefined): string | null {
  if (!error) return null;
  return error
    .replace(/\bsk-(?:ant|proj|or)-[A-Za-z0-9_-]+/gi, "[REDACTED_SECRET]")
    .replace(/(?:api[_\s]?key|access[_\s]?token|authorization|password)\s*[:=]\s*\S+/gi, "[REDACTED_SECRET]")
    .replace(/particleIds?|driftMultiplier|biologicalNature|homeostasisState|metaState|rawState|personalityCoordinate/gi, "[REDACTED_INTERNAL]")
    .slice(0, 500);
}

// ── 5. LLM Output Validation Result Builder ──────────────────────────

export interface BuildLlmOutputValidationResultParams {
  violations?: LlmOutputViolation[];
  warnings?: string[];
  blockedClaims?: string[];
  preservedSafetyNotices?: string[];
}

export function buildLlmOutputValidationResult(
  params: BuildLlmOutputValidationResultParams = {},
): LlmOutputValidationResult {
  const violations = params.violations ?? [];
  const hasError = violations.some((v) => v.severity === "error");
  const hasWarn = violations.some((v) => v.severity === "warn");

  let finalVerdict: ValidationVerdict;
  if (hasError) finalVerdict = "fail";
  else if (hasWarn) finalVerdict = "warn";
  else finalVerdict = "pass";

  return {
    valid: !hasError,
    violations,
    warnings: params.warnings ?? [],
    blockedClaims: params.blockedClaims ?? [],
    preservedSafetyNotices: params.preservedSafetyNotices ?? [],
    mutationClaimDetected: violations.some((v) => v.ruleId === "no_mutation_claim"),
    diagnosisClaimDetected: violations.some((v) => v.ruleId === "no_diagnosis"),
    unsupportedClaimDetected: violations.some((v) => v.ruleId === "no_unsupported_claim"),
    finalVerdict,
  };
}

// ── 6. Grounding Check Result Builder ─────────────────────────────────

export interface BuildGroundingCheckResultParams {
  checkedClaims?: string[];
  supportedClaims?: string[];
  unsupportedClaims?: GroundingUnsupportedClaim[];
  evidenceMatches?: GroundingEvidenceMatch[];
  missingEvidence?: string[];
}

export function buildGroundingCheckResult(
  params: BuildGroundingCheckResultParams = {},
): GroundingCheckResult {
  const checkedClaims = params.checkedClaims ?? [];
  const supportedClaims = params.supportedClaims ?? [];
  const unsupportedClaims = params.unsupportedClaims ?? [];
  const evidenceMatches = params.evidenceMatches ?? [];

  const hasErrorUnsupported = unsupportedClaims.some((c) => c.severity === "error");
  const hasWarnUnsupported = unsupportedClaims.some((c) => c.severity === "warn");

  let verdict: GroundingVerdict;
  if (hasErrorUnsupported) verdict = "ungrounded";
  else if (hasWarnUnsupported || unsupportedClaims.length > 0) verdict = "partially_grounded";
  else verdict = "grounded";

  const grounded = verdict === "grounded";
  const confidence = checkedClaims.length > 0
    ? supportedClaims.length / checkedClaims.length
    : 1;

  return {
    grounded,
    checkedClaims,
    supportedClaims,
    unsupportedClaims,
    evidenceMatches,
    missingEvidence: params.missingEvidence ?? [],
    confidence: Math.max(0, Math.min(1, confidence)),
    verdict,
  };
}

// ── 7. Agent Natural Language Reply Builder ────────────────────────────

export interface BuildAgentNaturalLanguageReplyParams {
  requestId: string;
  text: string;
  source?: "llm" | "fallback";
  validationResult?: LlmOutputValidationResult;
  groundingResult?: GroundingCheckResult;
  safetyNotices?: string[];
  uncertaintyNotes?: string[];
}

export function buildAgentNaturalLanguageReply(
  params: BuildAgentNaturalLanguageReplyParams,
): AgentNaturalLanguageReply {
  const replyId = `llmreply_${stableHash(params.requestId + "|" + params.text.slice(0, 100))}`;

  return {
    replyId,
    requestId: params.requestId,
    source: params.source ?? "fallback",
    text: params.text,
    grounded: params.groundingResult?.grounded ?? false,
    validationVerdict: params.validationResult?.finalVerdict ?? "pass",
    groundingVerdict: params.groundingResult?.verdict ?? "grounded",
    safetyNotices: params.safetyNotices ?? [],
    uncertaintyNotes: params.uncertaintyNotes ?? [],
    noMutation: true,
    writebackPerformed: false,
  };
}

// ── 8. LLM Fallback Reply Builder ─────────────────────────────────────

export interface BuildLlmFallbackReplyParams {
  requestId: string;
  reason: string;
  outlineUsed?: string[];
  text?: string;
  safetyNotices?: string[];
}

export function buildLlmFallbackReply(
  params: BuildLlmFallbackReplyParams,
): LlmFallbackReply {
  const fallbackId = `llmfallback_${stableHash(params.requestId + "|" + params.reason)}`;

  return {
    fallbackId,
    requestId: params.requestId,
    reason: params.reason,
    outlineUsed: params.outlineUsed ?? [],
    text: params.text ?? "（系统未能生成自然语言回复，请参考 structured reply outline。）",
    safetyNotices: params.safetyNotices ?? [],
    source: "fallback",
    noMutation: true,
  };
}

// ── 9. Summary ────────────────────────────────────────────────────────

export function summarizeLlmBoundary(): string[] {
  return [
    "V13.1: LLM Boundary DTO types — stable contracts, no implementation",
    "Modules: LlmBoundaryRequest, Prompt, ProviderConfig, ProviderResponse",
    "Modules: OutputValidation, GroundingCheck, NaturalLanguageReply, FallbackReply",
    "All IDs deterministic via stable hash",
    "No Date.now / Math.random in ID paths",
    "No raw CharacterPhysicsState exposure",
    "No coordinate values in DTOs",
    "No memory payload dump",
    "No API key storage — only apiKeyRef",
    "No writeback authority",
    "No mutation authority",
    "networkAllowed = false by default",
    "allowLlm = false by default",
    "source defaults to 'fallback'",
    "Builders are pure functions — no side effects",
    "Ready for V13.2: Prompt Builder",
  ];
}
