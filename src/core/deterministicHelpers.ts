/**
 * V13.3 — Deterministic Helpers
 *
 * Provides content-based deterministic ID generation for core builders.
 * Replaces Date.now() / Math.random() fallbacks in default paths.
 * All functions are pure — same input always produces same output.
 */

/**
 * Deterministic timestamp for "unknown" occurrence time.
 * Fixed at CharacterOS epoch — this is a deliberate sentinel,
 * not a runtime value. Callers that need real timestamps
 * must pass them explicitly.
 */
export const DETERMINISTIC_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/**
 * Generate a deterministic hash-based ID from input parts.
 * Uses a simple string hash (djb2 variant) — NOT cryptographic.
 * Same inputs always produce the same ID.
 */
export function deterministicId(prefix: string, ...parts: string[]): string {
  const seed = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return `${prefix}_${Math.abs(hash).toString(16)}`;
}

/**
 * Deterministic content-based ID for event studio drafts without sourceId.
 */
export function deterministicDraftId(naturalLanguageInput: string, tags?: string[]): string {
  return deterministicId("draft", naturalLanguageInput, (tags ?? []).join(","));
}

/**
 * Deterministic content-based ID for agent sessions without explicit sessionId.
 */
export function deterministicSessionId(characterId: string, inputMode?: string): string {
  return deterministicId("session", characterId, inputMode ?? "chat");
}

/**
 * Deterministic content-based ID for agent turns without explicit turnId.
 */
export function deterministicTurnId(sessionId: string, content: string): string {
  return deterministicId("turn", sessionId, content);
}

/**
 * Deterministic content-based ID for reply plans.
 */
export function deterministicReplyPlanId(intent: string, ...groundedFacts: string[]): string {
  return deterministicId("reply", intent, ...groundedFacts);
}

/**
 * Deterministic content-based audit ID.
 */
export function deterministicAuditId(seed: string): string {
  return deterministicId("audit", seed);
}

/**
 * Deterministic content-based candidate ID.
 */
export function deterministicCandidateId(draftSourceId: string, extractionMethod: string): string {
  return deterministicId("candidate", draftSourceId, extractionMethod);
}

/**
 * Deterministic writeback ID from turnId.
 */
export function deterministicWritebackId(turnId: string): string {
  return deterministicId("writeback", turnId);
}
