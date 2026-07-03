/**
 * V12.8 — Agent SDK Service Boundary
 * V12.12 — Session State Repair: per-character in-memory state store
 *
 * Wraps V12.1–V12.7 modules into a turn pipeline.
 * Default: no mutation, no LLM. Writeback is explicit and guarded.
 *
 * ## Session State Continuity (V12.12)
 *
 * This service maintains an **in-memory character state store** keyed by `characterId`.
 * It is **not a production database** — it lives only for the lifetime of the SDK
 * process / session. When the process exits, all state is discarded.
 *
 * - `processTurn()` and `previewTurnEvents()` read stored state for multi-turn
 *   continuity but never mutate it.
 * - `applyWriteback()` clones stored state, applies the event, and returns the
 *   result. By default it does **not** update the store — the next turn sees the
 *   same baseline.
 * - Pass `options.persistAppliedState = true` to `applyWriteback()` to persist
 *   the applied state back into the store, enabling true multi-turn state
 *   continuity.
 * - `resetCharacterState(characterId)` resets a character's state to a fresh
 *   LinFan blueprint.
 * - Different `characterId` values are fully isolated.
 * - No raw internal state is exposed in service responses.
 */
import { buildAgentSessionConfig } from "../core/agent/agentDtoBuilders";
import { normalizeAgentInput, validateAgentTurnInput } from "../core/agent/agentInputAdapter";
import { extractEventCandidates } from "../core/agent/eventCandidateExtractor";
import { evaluateAgentPolicy } from "../core/agent/agentPolicyGate";
import { buildAgentGroundingBundle } from "../core/agent/agentContextBuilder";
import { buildAgentReplyPlan } from "../core/agent/replyPlanner";
import { buildAgentWritebackPlan } from "../core/agent/writebackPlanner";
import { buildCharacterStateSurface } from "../core/explorer/characterStateSurface";
import { buildEventStudioPreview } from "../core/explorer/eventStudioPreview";
import { applyEventStudioEvent } from "../core/explorer/eventStudioApply";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../core/character/characterBlueprint";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../core/physics/serialization";
import type { CharacterPhysicsState } from "../core/physics/physicsEngine";
import type { AgentSessionConfig, AgentTurnResult, RawAgentInput } from "../core/agent/agentTypes";
import { agentSdkOk, agentSdkWrite, agentSdkError, type ProcessTurnResponse, type PreviewTurnEventsResponse, type PrepareWritebackResponse, type ApplyWritebackResponse } from "../appContracts/agentSdk";

// ── In-memory character state store ────────────────────────────────────
//
// NOT a production database. Lives only for the lifetime of the SDK process.
// Keyed by characterId for single-character isolation (no multi-character
// relationship support).

const characterStateStore = new Map<string, CharacterPhysicsState>();

/** Retrieve or lazily initialize the character state for a given characterId. */
export function getCharacterState(characterId: string): CharacterPhysicsState {
  if (!characterStateStore.has(characterId)) {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    characterStateStore.set(characterId, state);
  }
  return characterStateStore.get(characterId)!;
}

/** Replace the character state in the store (used after a persisted apply). */
export function setCharacterState(characterId: string, state: CharacterPhysicsState): void {
  characterStateStore.set(characterId, state);
}

/** Reset a character's state to a fresh LinFan blueprint. */
export function resetCharacterState(characterId: string): void {
  const fresh = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  characterStateStore.set(characterId, fresh);
}

/** Return the number of characters currently tracked in the store (for tests). */
export function getCharacterStateStoreSize(): number {
  return characterStateStore.size;
}

// ── Sessions ──

const sessions = new Map<string, AgentSessionConfig>();

export function createSession(config?: Partial<AgentSessionConfig>): AgentSessionConfig {
  const session = buildAgentSessionConfig(config ?? {});
  sessions.set(session.sessionId, session);
  return session;
}

// ── Process turn (main pipeline) ──

export function processTurn(
  sessionConfig: AgentSessionConfig,
  rawInput: RawAgentInput,
  options?: { previewEvents?: boolean },
): ProcessTurnResponse {
  // Normalize
  const turn = normalizeAgentInput(sessionConfig, rawInput);
  const validation = validateAgentTurnInput(turn);
  if (!validation.valid) {
    return agentSdkError("INVALID_INPUT", validation.errors.join("; "));
  }

  // Extract candidates
  const candidates = extractEventCandidates(turn);

  // Preview (if requested) — uses stored state for continuity, does NOT mutate
  const previewVerdicts: Array<"PASS" | "WARN" | "FAIL" | undefined> = [];
  if (options?.previewEvents) {
    const state = getCharacterState(sessionConfig.characterId);
    for (const c of candidates) {
      try {
        const preview = buildEventStudioPreview({
          draft: c.draft, baselineState: state, previewMode: "full_preview",
        });
        previewVerdicts.push(preview.realityAuditPreview.expectedVerdict);
      } catch {
        previewVerdicts.push(undefined);
      }
    }
  }

  // Policy
  const policy = evaluateAgentPolicy({
    session: sessionConfig, turn, candidates, previewVerdicts,
  });

  // Context — uses stored state for continuity, does NOT mutate
  const state = getCharacterState(sessionConfig.characterId);
  const surface = buildCharacterStateSurface({ state });
  const bundle = buildAgentGroundingBundle({ session: sessionConfig, policyDecision: policy, stateSurface: surface });

  // Reply plan
  const replyPlan = buildAgentReplyPlan({
    session: sessionConfig, policy, bundle,
    hasCandidates: candidates.length > 0,
    hasEvidence: false,
  });

  // Writeback plan
  const writebackPlan = buildAgentWritebackPlan({
    session: sessionConfig, turn, candidates, policy,
  });

  const result: AgentTurnResult = {
    turnId: turn.turnId,
    sessionId: sessionConfig.sessionId,
    normalizedInput: turn.content,
    eventCandidates: candidates,
    policyDecision: policy,
    groundingBundle: bundle,
    replyPlan,
    writebackPlan,
    safetyNotices: [],
    noMutation: true,
    auditRefs: [],
  };

  return agentSdkOk(result);
}

// ── Preview turn events ──

export function previewTurnEvents(
  sessionConfig: AgentSessionConfig,
  rawInput: RawAgentInput,
): PreviewTurnEventsResponse {
  const turn = normalizeAgentInput(sessionConfig, rawInput);
  const candidates = extractEventCandidates(turn);
  // Uses stored state for continuity, does NOT mutate
  const state = getCharacterState(sessionConfig.characterId);

  const previews = candidates.map((c) =>
    buildEventStudioPreview({ draft: c.draft, baselineState: state, previewMode: "full_preview" }),
  );

  const previewVerdicts = previews.map((p) => p.realityAuditPreview.expectedVerdict);
  const policy = evaluateAgentPolicy({ session: sessionConfig, turn, candidates, previewVerdicts });

  return agentSdkOk({ candidates, previews, policyDecision: policy });
}

// ── Prepare writeback ──

export function prepareWriteback(
  _sessionConfig: AgentSessionConfig,
  turnResult: AgentTurnResult,
): PrepareWritebackResponse {
  const plan = turnResult.writebackPlan;
  if (!plan) return agentSdkError("NO_WRITEBACK_PLAN", "turn result 中没有 writeback plan");

  const ready = plan.status === "ready_for_apply" || plan.status === "confirmation_pending";
  return agentSdkOk({ writebackPlan: plan, ready });
}

// ── Apply writeback ──

export function applyWriteback(
  sessionConfig: AgentSessionConfig,
  turnResult: AgentTurnResult,
  selectedCandidateIndex: number,
  confirmation: string,
  options?: { allowMutation?: boolean; persistAppliedState?: boolean },
): ApplyWritebackResponse {
  // Policy gate
  if (turnResult.policyDecision.decision !== "apply_allowed" && turnResult.policyDecision.decision !== "confirmation_required") {
    return agentSdkError("APPLY_BLOCKED", `policy decision ${turnResult.policyDecision.decision} 不允许 apply`);
  }

  // Confirmation
  if (confirmation !== "apply") {
    return agentSdkError("CONFIRMATION_REQUIRED", "需要明确确认 'apply' 才能写入");
  }

  // Candidate
  const candidate = turnResult.eventCandidates[selectedCandidateIndex];
  if (!candidate) {
    return agentSdkError("NO_CANDIDATE", `候选索引 ${selectedCandidateIndex} 不存在`);
  }

  // Use stored character state as baseline (continuity from previous applies)
  const storedState = getCharacterState(sessionConfig.characterId);

  // Always clone at the service layer to protect the store.
  // The underlying `applyEventStudioEvent` receives `allowMutation` from
  // the caller so its audit trail reflects the caller's intent, but we
  // control persistence at this layer via `persistAppliedState`.
  const workingState = deserializeCharacterPhysicsState(
    structuredClone(serializeCharacterPhysicsState(storedState)),
  );

  const preview = buildEventStudioPreview({
    draft: candidate.draft, baselineState: workingState, previewMode: "full_preview",
  });

  const applyResult = applyEventStudioEvent({
    baselineState: workingState, draft: candidate.draft, preview,
    confirmation, applyReason: `Agent SDK turn ${turnResult.turnId}`, actorId: sessionConfig.characterId,
    options: { allowMutation: options?.allowMutation ?? false },
  });

  if (!applyResult.applied) {
    return agentSdkError("APPLY_FAILED", applyResult.blockedReason ?? "apply 失败");
  }

  // Persist applied state to the in-memory store if explicitly requested.
  // Without this flag the next turn sees the same baseline — this is the
  // safe default for preview-only / confirmation workflows.
  if (options?.persistAppliedState) {
    setCharacterState(sessionConfig.characterId, workingState);
  }

  return agentSdkWrite(applyResult);
}
