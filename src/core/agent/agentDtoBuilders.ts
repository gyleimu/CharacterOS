/**
 * V12.1 — Agent SDK DTO Builders
 * V12.12 — Deterministic ID paths: no Date.now() / Math.random() in defaults
 *
 * Pure, deterministic builders. Read-only by default.
 * No LLM execution. No raw state. No multi-character.
 */

import { buildEventStudioDraft } from "../explorer/explorerDtoBuilders";
import type { CharacterStateSurface } from "../explorer/explorerTypes";
import type {
  AgentSessionConfig, AgentTurnInput, AgentEventCandidate,
  AgentPolicyDecision, AgentGroundingBundle, AgentReplyPlan,
  AgentWritebackPlan, AgentTurnResult, AgentSafetyNotice,
  InputMode, WritebackPolicy, SafetyMode, LLMMode,
} from "./agentTypes";

// ── Stable hash helper (V12.12) ───────────────────────────────────────

/**
 * Deterministic djb2-derived hash. Same input → same output every time.
 * Used for generating IDs in builder defaults where the caller did not
 * supply an explicit ID.
 */
function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ── Session Config ────────────────────────────────────────────────────────

export function buildAgentSessionConfig(overrides: Partial<AgentSessionConfig> = {}): AgentSessionConfig {
  return {
    sessionId: overrides.sessionId ?? "session_unknown",
    characterId: overrides.characterId ?? "lin_fan",
    inputMode: overrides.inputMode ?? "chat",
    writebackPolicy: overrides.writebackPolicy ?? "require_user_confirmation",
    safetyMode: overrides.safetyMode ?? "strict",
    llmMode: overrides.llmMode ?? "disabled",
    createdAtPolicy: "deterministic_timestamp",
    readOnlyDefault: true,
    noMultiCharacter: true,
    noDiagnosis: true,
  };
}

// ── Turn Input ────────────────────────────────────────────────────────────

export function buildAgentTurnInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  const result: AgentTurnInput = {
    turnId: overrides.turnId ?? "turn_unknown",
    sessionId: overrides.sessionId ?? "",
    inputMode: overrides.inputMode ?? "chat",
    content: overrides.content ?? "",
    occurredAt: overrides.occurredAt ?? "unknown",
    speakerLabel: overrides.speakerLabel ?? "user",
    sourceRef: overrides.sourceRef ?? "",
    metadata: overrides.metadata ?? {},
    consentForWriteback: overrides.consentForWriteback ?? false,
  };
  if (overrides.userConfirmation) result.userConfirmation = overrides.userConfirmation;
  return result;
}

// ── Event Candidate ───────────────────────────────────────────────────────

export function buildAgentEventCandidateFromDraft(params: {
  draft: ReturnType<typeof buildEventStudioDraft>;
  extractionMethod?: "deterministic" | "llm_proposed" | "manual";
  confidence?: number;
  relevance?: number;
}): AgentEventCandidate {
  return {
    candidateId: `candidate_${params.draft.sourceId || "unknown"}`,
    draft: params.draft,
    extractionMethod: params.extractionMethod ?? "deterministic",
    confidence: Math.max(0, Math.min(1, params.confidence ?? 0.5)),
    relevance: Math.max(0, Math.min(1, params.relevance ?? 0.5)),
    safetyFlags: [],
    requiresPreview: true,
  };
}

// ── Policy Decision ───────────────────────────────────────────────────────

export function buildAgentPolicyDecision(params: {
  writebackPolicy: WritebackPolicy;
  consentForWriteback: boolean;
  safetyFlags?: string[];
  realityAuditVerdict?: string;
}): AgentPolicyDecision {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let decision: AgentPolicyDecision["decision"] = "preview_only";
  let safetyLevel: AgentPolicyDecision["safetyLevel"] = "safe";

  // Unsafe content flags
  if (params.safetyFlags && params.safetyFlags.length > 0) {
    decision = "block";
    safetyLevel = "unsafe";
    reasons.push(`安全标记触发: ${params.safetyFlags.join(", ")}`);
    return { decision, reasons, warnings, writebackAllowed: false, safetyLevel, auditRequired: true };
  }

  // Reality Audit check
  if (params.realityAuditVerdict === "FAIL") {
    decision = "block";
    safetyLevel = "unsafe";
    reasons.push("Reality Audit FAIL — 事件可能导致系统状态异常");
    return { decision, reasons, warnings, writebackAllowed: false, safetyLevel, auditRequired: true };
  }
  if (params.realityAuditVerdict === "WARN") {
    warnings.push("Reality Audit WARN — 建议审查后再应用");
    safetyLevel = "caution";
  }

  // Writeback policy
  switch (params.writebackPolicy) {
    case "never":
      decision = "preview_only";
      reasons.push("writeback policy = never");
      break;
    case "preview_only":
      decision = "preview_only";
      reasons.push("writeback policy = preview_only — 不会写入状态");
      break;
    case "auto_apply_safe_events":
      if (safetyLevel === "safe") {
        decision = "apply_allowed";
        reasons.push("安全事件自动应用 (auto_apply_safe_events)");
      } else {
        decision = "preview_only";
        warnings.push("事件未达到 auto_apply 安全标准");
      }
      break;
    case "require_user_confirmation":
      if (params.consentForWriteback) {
        decision = "confirmation_required";
        reasons.push("用户已同意写入，等待最终确认");
      } else {
        decision = "preview_only";
        reasons.push("writeback policy = require_user_confirmation — 用户未授权");
      }
      break;
  }

  const result: AgentPolicyDecision = {
    decision,
    reasons,
    warnings,
    writebackAllowed: decision === "apply_allowed" || decision === "confirmation_required",
    safetyLevel,
    auditRequired: decision !== "preview_only" || params.writebackPolicy !== "never",
  };
  if (decision === "confirmation_required") result.requiredConfirmation = "apply";
  return result;
}

// ── Reply Plan (DTO builder) ──────────────────────────────────────────────

export function buildAgentReplyPlan(params: {
  groundedFacts?: string[];
  safetyNotices?: string[];
  llmAllowed?: boolean;
}): AgentReplyPlan {
  const idSeed = JSON.stringify(params);
  return {
    replyPlanId: `reply_${stableHash(idSeed)}`,
    tone: "中性",
    intent: "基于角色状态提供信息",
    groundedFacts: params.groundedFacts ?? [],
    uncertaintyNotes: [],
    safetyNotices: [
      "此回复基于 CharacterOS 模拟系统生成，不是医学或心理诊断。",
      "角色状态为模型计算结果，不代表真实人格。",
      ...(params.safetyNotices ?? []),
    ],
    suggestedResponseOutline: [],
    llmAllowed: params.llmAllowed ?? false,
    noStateMutation: true,
  };
}

// ── Writeback Plan ────────────────────────────────────────────────────────

export function buildAgentWritebackPlan(params: {
  policy: WritebackPolicy;
  candidates?: AgentEventCandidate[];
}): AgentWritebackPlan {
  const candidates = params.candidates ?? [];
  const idSeed = `${params.policy}|${candidates.map((c) => c.candidateId).join(",")}`;
  const result: AgentWritebackPlan = {
    writebackId: `writeback_${stableHash(idSeed)}`,
    policy: params.policy,
    candidates,
    previewRequired: params.policy !== "never",
    applyRequiresConfirmation: params.policy === "require_user_confirmation",
    auditTrailRequired: params.policy !== "never",
    status: params.policy === "never" ? "none"
      : params.policy === "preview_only" ? "preview_pending"
      : "confirmation_pending",
  };
  if (candidates[0]?.candidateId) result.selectedCandidateId = candidates[0].candidateId;
  return result;
}

// ── Turn Result ───────────────────────────────────────────────────────────

export function buildAgentTurnResult(params: {
  turnId: string;
  sessionId: string;
  normalizedInput: string;
  eventCandidates: AgentEventCandidate[];
  policyDecision: AgentPolicyDecision;
  groundingBundle: AgentGroundingBundle;
  replyPlan: AgentReplyPlan;
  writebackPlan: AgentWritebackPlan;
  safetyNotices?: AgentSafetyNotice[];
  auditRefs?: string[];
}): AgentTurnResult {
  return {
    turnId: params.turnId,
    sessionId: params.sessionId,
    normalizedInput: params.normalizedInput,
    eventCandidates: params.eventCandidates,
    policyDecision: params.policyDecision,
    groundingBundle: params.groundingBundle,
    replyPlan: params.replyPlan,
    writebackPlan: params.writebackPlan,
    safetyNotices: params.safetyNotices ?? [],
    noMutation: params.writebackPlan.status !== "applied",
    auditRefs: params.auditRefs ?? [],
  };
}

// ── Summary ───────────────────────────────────────────────────────────────

export function summarizeAgentSdkBoundary(): string[] {
  return [
    "readOnlyDefault: true — SDK 默认只读",
    "llmMode: disabled — LLM 未接入，仅 boundary contract",
    "noMultiCharacter: true — 单角色 Agent，不做关系引擎",
    "noDiagnosis: true — 禁止医学/心理诊断语言",
    "writebackPolicy: require_user_confirmation — 默认需要用户确认",
    "safetyMode: strict — 严格安全模式",
    "noMutation: true — Agent 不能直接修改 Core 状态",
    "LLM boundary: replyPlan 中包含 boundary instructions，LLM 不能越过",
    "V12.12: deterministic IDs — no Date.now() / Math.random() in default paths",
  ];
}
