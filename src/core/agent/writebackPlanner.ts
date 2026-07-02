/**
 * V12.7 — Writeback Planner / Audit
 *
 * Generates writeback plans and audit drafts. Never executes apply.
 * No state mutation. No EventStudioApply call. No LLM.
 */
import type {
  AgentSessionConfig, AgentTurnInput, AgentEventCandidate,
  AgentPolicyDecision, AgentWritebackPlan, WritebackStatus,
} from "./agentTypes";

export interface WritebackPlannerInput {
  session: AgentSessionConfig;
  turn: AgentTurnInput;
  candidates: AgentEventCandidate[];
  policy: AgentPolicyDecision;
  /** Optional: per-candidate preview verdicts */
  previewVerdicts?: Array<"PASS" | "WARN" | "FAIL" | undefined>;
  /** Whether auto_apply can skip confirmation */
  autoApplySkipConfirmation?: boolean;
}

export interface WritebackAuditDraft {
  writebackId: string;
  sessionId: string;
  turnId: string;
  selectedCandidateId: string | undefined;
  policyDecision: string;
  confirmationRequired: boolean;
  previewRefs: string[];
  realityAuditVerdict: string;
  safetyFlags: string[];
  reasons: string[];
  status: WritebackStatus;
  createdAtPolicy: "deterministic_timestamp" | "runtime";
}

export interface WritebackValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Main entry ──

export function buildAgentWritebackPlan(input: WritebackPlannerInput): AgentWritebackPlan {
  const status = deriveWritebackStatus(input.policy);
  const { selectedId, reasons } = selectWritebackCandidate(
    input.candidates, input.policy, input.previewVerdicts,
  );

  const confirmationRequired = !input.autoApplySkipConfirmation &&
    input.policy.decision !== "preview_only" &&
    status === "ready_for_apply";

  const plan: AgentWritebackPlan = {
    writebackId: `writeback_${input.turn.turnId}`,
    policy: input.session.writebackPolicy,
    candidates: input.candidates,
    previewRequired: status !== "none" && status !== "blocked",
    applyRequiresConfirmation: confirmationRequired,
    auditTrailRequired: input.candidates.length > 0 && status !== "none",
    status,
  };
  if (selectedId) plan.selectedCandidateId = selectedId;
  return plan;
}

// ── Status derivation ──

function deriveWritebackStatus(policy: AgentPolicyDecision): WritebackStatus {
  switch (policy.decision) {
    case "block": return "blocked";
    case "preview_only": return "preview_pending";
    case "confirmation_required": return "confirmation_pending";
    case "apply_allowed": return "ready_for_apply";
    default: return "none";
  }
}

// ── Candidate selection ──

export function selectWritebackCandidate(
  candidates: AgentEventCandidate[],
  policy: AgentPolicyDecision,
  previewVerdicts?: Array<"PASS" | "WARN" | "FAIL" | undefined>,
): { selectedId: string | undefined; reasons: string[] } {
  const reasons: string[] = [];

  if (candidates.length === 0) {
    return { selectedId: undefined, reasons: ["无可选候选事件"] };
  }

  if (policy.decision === "block") {
    return { selectedId: undefined, reasons: ["策略阻止 — 不选择任何候选"] };
  }

  if (policy.decision === "preview_only" && candidates.length > 0) {
    const safe = candidates.filter((c) => !c.safetyFlags.some((f) => f.includes("diagnosis") || f.includes("block")));
    const pick = safe[0] ?? undefined;
    reasons.push(pick ? "预览模式 — 选中第一个安全候选" : "所有候选均有安全标记");
    return { selectedId: pick?.candidateId, reasons };
  }

  // Score candidates: confidence - safety penalty + preview bonus
  const scored = candidates.map((c, i) => {
    let score = c.confidence;
    if (c.safetyFlags.some((f) => f.includes("diagnosis") || f.includes("block"))) score -= 0.5;
    if (previewVerdicts?.[i] === "PASS") score += 0.15;
    if (previewVerdicts?.[i] === "FAIL") score -= 0.5;
    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  if (best.score < 0.2) {
    reasons.push(`最优候选置信度过低 (${best.score.toFixed(2)}) — 不选择`);
    return { selectedId: undefined, reasons };
  }

  reasons.push(`选中候选: ${best.candidate.draft.naturalLanguageInput.slice(0, 40)} (置信度: ${best.score.toFixed(2)})`);

  if (candidates.length > 1) {
    reasons.push(`从 ${candidates.length} 个候选中选择`);
  }

  return { selectedId: best.candidate.candidateId, reasons };
}

// ── Audit draft ──

export function buildWritebackAuditDraft(input: WritebackPlannerInput): WritebackAuditDraft {
  const { selectedId, reasons } = selectWritebackCandidate(
    input.candidates, input.policy, input.previewVerdicts,
  );
  const status = deriveWritebackStatus(input.policy);
  const allSafetyFlags = [...new Set(input.candidates.flatMap((c) => c.safetyFlags))];
  const worstVerdict = input.previewVerdicts?.reduce((w, v) =>
    v === "FAIL" ? "FAIL" : v === "WARN" && w !== "FAIL" ? "WARN" : w, "PASS") ?? "UNKNOWN";

  return {
    writebackId: `writeback_${input.turn.turnId}`,
    sessionId: input.session.sessionId,
    turnId: input.turn.turnId,
    selectedCandidateId: selectedId,
    policyDecision: input.policy.decision,
    confirmationRequired: status === "confirmation_pending" || (status === "ready_for_apply" && !input.autoApplySkipConfirmation),
    previewRefs: input.previewVerdicts?.map((_, i) => `preview_${i}`) ?? [],
    realityAuditVerdict: worstVerdict,
    safetyFlags: allSafetyFlags,
    reasons,
    status,
    createdAtPolicy: "runtime",
  };
}

// ── Validation ──

export function validateWritebackPlan(plan: AgentWritebackPlan): WritebackValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (plan.status !== "none" && plan.candidates.length > 0 && !plan.selectedCandidateId) {
    if (plan.status !== "blocked") {
      warnings.push("有候选事件但未选择 — 可能需要审查候选");
    }
  }

  if (plan.auditTrailRequired && plan.status !== "none") {
    // Audit will be generated during actual apply
  }

  if (plan.applyRequiresConfirmation && (plan.status as string) === "ready_for_apply") {
    warnings.push("apply 已就绪但仍需要确认 — 这是安全默认");
  }

  if (plan.candidates.length === 0 && plan.status !== "none") {
    warnings.push("没有候选事件但状态不是 none");
  }

  return { valid: errors.length === 0, errors, warnings };
}
