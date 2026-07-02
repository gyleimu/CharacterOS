/**
 * V12.8 — Agent SDK Service Boundary
 *
 * Wraps V12.1–V12.7 modules into a turn pipeline.
 * Default: no mutation, no LLM. Writeback is explicit and guarded.
 */
import { buildAgentSessionConfig } from "../core/agent/agentDtoBuilders";
import { normalizeAgentInput, detectAgentInputMode, validateAgentTurnInput } from "../core/agent/agentInputAdapter";
import { extractEventCandidates } from "../core/agent/eventCandidateExtractor";
import { evaluateAgentPolicy } from "../core/agent/agentPolicyGate";
import { buildAgentGroundingBundle } from "../core/agent/agentContextBuilder";
import { buildAgentReplyPlan } from "../core/agent/replyPlanner";
import { buildAgentWritebackPlan } from "../core/agent/writebackPlanner";
import { buildCharacterStateSurface } from "../core/explorer/characterStateSurface";
import { buildEventStudioPreview } from "../core/explorer/eventStudioPreview";
import { applyEventStudioEvent } from "../core/explorer/eventStudioApply";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../core/character/characterBlueprint";
import type { AgentSessionConfig, AgentTurnResult, RawAgentInput } from "../core/agent/agentTypes";
import { agentSdkOk, agentSdkWrite, agentSdkError, type ProcessTurnResponse, type PreviewTurnEventsResponse, type PrepareWritebackResponse, type ApplyWritebackResponse } from "../appContracts/agentSdk";

// In-memory state
const sessions = new Map<string, AgentSessionConfig>();

// ── Create session ──

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

  // Preview (if requested)
  const previewVerdicts: Array<"PASS" | "WARN" | "FAIL" | undefined> = [];
  if (options?.previewEvents) {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
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

  // Context
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
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
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

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
  options?: { allowMutation?: boolean },
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

  // Execute apply via V11 boundary
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const preview = buildEventStudioPreview({
    draft: candidate.draft, baselineState: state, previewMode: "full_preview",
  });

  const applyResult = applyEventStudioEvent({
    baselineState: state, draft: candidate.draft, preview,
    confirmation, applyReason: `Agent SDK turn ${turnResult.turnId}`, actorId: sessionConfig.characterId,
    options: { allowMutation: options?.allowMutation ?? false },
  });

  if (!applyResult.applied) {
    return agentSdkError("APPLY_FAILED", applyResult.blockedReason ?? "apply 失败");
  }

  return agentSdkWrite(applyResult);
}
