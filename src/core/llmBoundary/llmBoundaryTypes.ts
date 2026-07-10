/**
 * V13.1 — LLM Boundary DTO Types
 *
 * Stable data contracts for the LLM Boundary Adapter layer.
 * These types define the safe interface between the deterministic CharacterOS
 * core (V10–V12) and any LLM provider.
 *
 * INVARIANTS (enforced by builders, validated in tests):
 * - No raw CharacterPhysicsState exposure
 * - No coordinate values in any DTO
 * - No memory payload dump
 * - No API key storage (only apiKeyRef)
 * - No writeback authority
 * - No mutation authority
 * - networkAllowed = false by default
 * - allowLlm = false by default
 * - source defaults to "fallback"
 * - All IDs are deterministic (stable hash, no Date.now / Math.random)
 */

import type {
  AgentReplyPlan,
  AgentGroundingBundle,
  AgentSessionConfig,
  SafetyMode,
} from "../agent/agentTypes";

// ── 1. LLM Boundary Request ────────────────────────────────────────────

export interface LlmBoundaryRequest {
  /** Deterministic request ID — stable hash of sessionId + turnId + characterId */
  readonly requestId: string;
  readonly sessionId: string;
  readonly turnId: string;
  readonly characterId: string;
  /** The V12 reply plan that drives this request */
  readonly replyPlan: AgentReplyPlan;
  /** The V12 grounding bundle — already mediated, no raw state */
  readonly groundingBundle: AgentGroundingBundle;
  /** Summary of the V12 policy decision (decision + safetyLevel only, no internals) */
  readonly policyDecisionSummary: string;
  /** Inherited from session config */
  readonly safetyMode: SafetyMode;
  /** Locale hint for natural language output (e.g. "zh-CN", "en-US") */
  readonly locale: string;
  /** Must be explicitly set to true to allow LLM path */
  readonly allowLlm: boolean;
  /** Invariant — LLM boundary never mutates state */
  readonly noMutation: true;
  /** Invariant — LLM boundary never exposes raw state */
  readonly noRawState: true;
}

// ── 2. LLM Boundary Prompt ─────────────────────────────────────────────

export interface LlmBoundaryPrompt {
  /** Deterministic prompt ID */
  readonly promptId: string;
  /** Links back to the request */
  readonly requestId: string;
  /** System-level safety instructions (always included) */
  readonly systemInstructions: string;
  /** Developer-provided boundary instructions from replyPlan */
  readonly developerInstructions: string;
  /** Facts the LLM may reference — extracted from groundedFacts */
  readonly groundingFacts: string[];
  /** Uncertainty notes the LLM must preserve */
  readonly uncertaintyNotes: string[];
  /** Safety notices that must appear in or alongside the output */
  readonly safetyNotices: string[];
  /** Positive constraints on what the LLM SHOULD do */
  readonly responseConstraints: string[];
  /** Negative constraints on what the LLM MUST NOT claim */
  readonly forbiddenClaims: string[];
  /** Expected output format hint (e.g. "plain_text", "markdown") */
  readonly outputFormat: "plain_text" | "markdown";
  /** Invariant — prompt does not authorize mutation */
  readonly noMutation: true;
  /** Invariant — prompt does not authorize writeback */
  readonly noWritebackAuthority: true;
}

// ── 3. LLM Provider Config ─────────────────────────────────────────────

export type LlmProviderType = "mock" | "openai_compatible" | "local";

export interface LlmProviderConfig {
  /** Unique provider instance identifier */
  readonly providerId: string;
  /** Provider type */
  readonly providerType: LlmProviderType;
  /** Model name (provider-specific) */
  readonly modelName: string;
  /** Whether network calls are permitted — default false */
  readonly networkAllowed: boolean;
  /** Request timeout in milliseconds */
  readonly timeoutMs: number;
  /** LLM temperature (clamped to safe range in builder) */
  readonly temperature: number;
  /** Maximum tokens for the completion */
  readonly maxTokens: number;
  /** Safety mode inherited from session */
  readonly safetyMode: SafetyMode;
  /**
   * Reference to an API key — NEVER the key itself.
   * Resolved at the provider adapter level from env/secrets.
   * This field MUST be empty or a non-secret reference string.
   */
  readonly apiKeyRef: string;
}

// ── 4. LLM Provider Response ───────────────────────────────────────────

export interface LlmProviderResponse {
  /** Deterministic response ID */
  readonly responseId: string;
  /** Which provider produced this */
  readonly providerId: string;
  /** Links back to the request */
  readonly requestId: string;
  /** The raw text from the LLM — unvalidated at this stage */
  readonly rawText: string;
  /** Why the LLM stopped: "stop", "length", "error", "timeout" */
  readonly finishReason: "stop" | "length" | "error" | "timeout";
  /** Token usage (if provider reports it) */
  readonly usage: LlmUsage | null;
  /** Latency in milliseconds (if measurable) */
  readonly latencyMs: number | null;
  /** Warnings from the provider layer (rate limits, etc.) */
  readonly providerWarnings: string[];
  /** Provider-level error (sanitized — no API keys or internal state) */
  readonly error: string | null;
}

export interface LlmUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

// ── 5. LLM Output Validation Result ────────────────────────────────────

export type ValidationVerdict = "pass" | "warn" | "fail";

export interface LlmOutputValidationResult {
  /** Overall validity */
  readonly valid: boolean;
  /** Individual rule violations found */
  readonly violations: LlmOutputViolation[];
  /** Non-blocking warnings */
  readonly warnings: string[];
  /** Claims that were blocked by the validator */
  readonly blockedClaims: string[];
  /** Safety notices that were preserved in the output */
  readonly preservedSafetyNotices: string[];
  /** Did the output claim that state was mutated? */
  readonly mutationClaimDetected: boolean;
  /** Did the output contain diagnosis language? */
  readonly diagnosisClaimDetected: boolean;
  /** Did the output assert facts not in the grounding bundle? */
  readonly unsupportedClaimDetected: boolean;
  /** Aggregate verdict */
  readonly finalVerdict: ValidationVerdict;
}

export interface LlmOutputViolation {
  /** Rule identifier (e.g. "no_diagnosis", "no_mutation_claim") */
  readonly ruleId: string;
  /** Human-readable description */
  readonly description: string;
  /** Severity level */
  readonly severity: "error" | "warn";
  /** The offending text excerpt (truncated) */
  readonly excerpt: string;
}

// ── 6. Grounding Check Result ──────────────────────────────────────────

export type GroundingVerdict = "grounded" | "partially_grounded" | "ungrounded";

export interface GroundingCheckResult {
  /** Is every factual claim supported by evidence? */
  readonly grounded: boolean;
  /** All claims that were checked */
  readonly checkedClaims: string[];
  /** Claims with matching evidence */
  readonly supportedClaims: string[];
  /** Claims without matching evidence */
  readonly unsupportedClaims: GroundingUnsupportedClaim[];
  /** Evidence-to-claim mappings */
  readonly evidenceMatches: GroundingEvidenceMatch[];
  /** Evidence refs that had no corresponding claims */
  readonly missingEvidence: string[];
  /** Aggregate confidence (0–1) */
  readonly confidence: number;
  /** Aggregate verdict */
  readonly verdict: GroundingVerdict;
}

export interface GroundingUnsupportedClaim {
  /** The unsupported claim text */
  readonly claim: string;
  /** Why it's unsupported */
  readonly reason: "no_matching_fact" | "contradicts_evidence" | "insufficient_context";
  /** Severity */
  readonly severity: "error" | "warn";
}

export interface GroundingEvidenceMatch {
  /** The claim that was matched */
  readonly claim: string;
  /** Which evidence refs support it */
  readonly matchedEvidenceRefs: string[];
  /** Match confidence (0–1) */
  readonly matchConfidence: number;
}

// ── 7. Agent Natural Language Reply ───────────────────────────────────────

export interface AgentNaturalLanguageReply {
  /** Deterministic reply ID */
  readonly replyId: string;
  /** Links back to the request */
  readonly requestId: string;
  /** Source: "llm" if validated and grounded, "fallback" otherwise */
  readonly source: "llm" | "fallback";
  /** The natural language text */
  readonly text: string;
  /** Did grounding check pass? */
  readonly grounded: boolean;
  /** Result from the output validator */
  readonly validationVerdict: ValidationVerdict;
  /** Result from the grounding checker */
  readonly groundingVerdict: GroundingVerdict;
  /** Safety notices included in/alongside the reply */
  readonly safetyNotices: string[];
  /** Uncertainty notes preserved from the plan */
  readonly uncertaintyNotes: string[];
  /** Invariant — this reply is read-only */
  readonly noMutation: true;
  /** Invariant — writeback was never performed by the LLM boundary */
  readonly writebackPerformed: false;
}

// ── 8. LLM Fallback Reply ──────────────────────────────────────────────────

export interface LlmFallbackReply {
  /** Deterministic fallback ID */
  readonly fallbackId: string;
  /** Links back to the request */
  readonly requestId: string;
  /** Why the fallback was triggered */
  readonly reason: string;
  /** Which outline items from the reply plan were used */
  readonly outlineUsed: string[];
  /** The fallback text (deterministic, template-based) */
  readonly text: string;
  /** Safety notices included */
  readonly safetyNotices: string[];
  /** Always "fallback" */
  readonly source: "fallback";
  /** Invariant — fallback never mutates */
  readonly noMutation: true;
}

// ── V13.1 Boundary Summary ─────────────────────────────────────────────────

export const LLM_BOUNDARY_SUMMARY = [
  "V13.1: LLM Boundary DTO types — stable contracts, no implementation",
  "No raw CharacterPhysicsState in any DTO",
  "No coordinate values in any DTO",
  "No memory payload dump in any DTO",
  "No API key storage — only apiKeyRef",
  "No writeback authority",
  "No mutation authority",
  "networkAllowed = false by default",
  "allowLlm = false by default",
  "source defaults to 'fallback'",
  "All IDs deterministic via stable hash",
  "No Date.now / Math.random in ID paths",
  "No LLM provider calls at this layer",
  "Builders are pure functions, no side effects",
] as const;
