/**
 * V12.4 — Agent Policy Gate
 *
 * Decides block/preview_only/confirmation_required/apply_allowed
 * based on session config, consent, safety flags, and preview results.
 * Pure decision engine — no writes, no applies, no LLM.
 */
import type {
  AgentSessionConfig, AgentTurnInput, AgentEventCandidate,
  AgentPolicyDecision, PolicyAction,
} from "./agentTypes";

export interface PolicyGateInput {
  session: AgentSessionConfig;
  turn: AgentTurnInput;
  candidates: AgentEventCandidate[];
  /** Optional: preview verdict per candidate. */
  previewVerdicts?: Array<"PASS" | "WARN" | "FAIL" | undefined>;
  /** Optional: allow story/plugin/tool input modes to auto-apply. */
  trustedInputModes?: string[];
  /** Optional: override Reality Audit FAIL block. */
  overrideAuditFail?: boolean;
}

// ── Safety flag severity ──

const BLOCKING_FLAGS = new Set([
  "possible_diagnosis_claim",
  "unsafe_writeback_without_consent",
  "high_risk_self_harm_or_medical",
  "raw_state_request",
  "policy_override_missing",
]);

const WARNING_FLAGS = new Set([
  "low_confidence",
  "fictional_or_story_input",
  "possible_multi_character_relationship",
  "sensitive_personal_data",
  "plugin_or_tool_input",
  "requires_user_confirmation",
]);

// ── Main entry ──

export function evaluateAgentPolicy(input: PolicyGateInput): AgentPolicyDecision {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const { session, turn, candidates } = input;

  // ── Gather safety flags ──
  const allFlags = new Set(candidates.flatMap((c) => c.safetyFlags));
  const hasBlocking = [...allFlags].some((f) => BLOCKING_FLAGS.has(f));
  const hasWarnings = [...allFlags].some((f) => WARNING_FLAGS.has(f));

  if (hasBlocking) {
    const blocked = [...allFlags].filter((f) => BLOCKING_FLAGS.has(f));
    return {
      decision: "block",
      reasons: [`安全标记阻止: ${blocked.join(", ")}`],
      warnings,
      writebackAllowed: false,
      safetyLevel: "unsafe",
      auditRequired: true,
    };
  }

  if (hasWarnings) {
    const flagged = [...allFlags].filter((f) => WARNING_FLAGS.has(f));
    warnings.push(`安全标记: ${flagged.join(", ")}`);
  }

  // ── Reality Audit check ──
  const worstVerdict = input.previewVerdicts?.reduce((worst, v) => {
    if (v === "FAIL") return "FAIL";
    if (v === "WARN" && worst !== "FAIL") return "WARN";
    return worst;
  }, undefined as string | undefined);

  if (worstVerdict === "FAIL" && !input.overrideAuditFail) {
    return {
      decision: "block",
      reasons: ["Reality Audit FAIL — 事件可能导致系统状态异常"],
      warnings,
      writebackAllowed: false,
      safetyLevel: "unsafe",
      auditRequired: true,
    };
  }

  if (worstVerdict === "WARN") {
    warnings.push("Reality Audit WARN — 建议审查后确认");
  }

  // ── Consent check ──
  if (!turn.consentForWriteback) {
    warnings.push("用户未授权写入");
  }

  // ── Policy routing ──
  let decision: PolicyAction;
  let writebackAllowed = false;
  let safetyLevel: AgentPolicyDecision["safetyLevel"] = "safe";

  switch (session.writebackPolicy) {
    case "never":
      decision = "preview_only";
      reasons.push("policy = never — 不写入状态");
      break;

    case "preview_only":
      decision = "preview_only";
      reasons.push("policy = preview_only — 仅预览");
      break;

    case "require_user_confirmation":
      if (!turn.consentForWriteback || !turn.userConfirmation) {
        decision = turn.consentForWriteback ? "confirmation_required" : "preview_only";
        reasons.push(turn.consentForWriteback
          ? "等待用户确认 'apply'"
          : "需要用户授权写入");
        writebackAllowed = !!turn.consentForWriteback;
      } else if (worstVerdict === "WARN") {
        decision = "confirmation_required";
        reasons.push("Reality Audit WARN — 需要额外确认");
        writebackAllowed = true;
      } else if (worstVerdict === "PASS" || input.previewVerdicts?.every((v) => !v || v === "PASS")) {
        decision = "apply_allowed";
        reasons.push("用户已确认，预览通过");
        writebackAllowed = true;
      } else {
        decision = "confirmation_required";
        reasons.push("缺少预览结果，需要确认");
        writebackAllowed = true;
      }
      break;

    case "auto_apply_safe_events": {
      const isTrustedMode = input.trustedInputModes?.includes(turn.inputMode) ?? false;
      const allLowIntensity = candidates.every((c) => (c.draft.intensity ?? 0.5) < 0.7);
      const allHighConfidence = candidates.every((c) => c.confidence > 0.5);
      const noWarnings = !hasWarnings || (hasWarnings &&
        [...allFlags].every((f) => f === "requires_user_confirmation" && turn.consentForWriteback));
      const previewPass = !worstVerdict || worstVerdict === "PASS";

      if (allLowIntensity && allHighConfidence && noWarnings && previewPass && (isTrustedMode || (turn.inputMode === "chat" || turn.inputMode === "journal"))) {
        decision = "apply_allowed";
        reasons.push("安全事件自动应用 (auto_apply_safe_events)");
        writebackAllowed = true;
      } else {
        const blockReasons: string[] = [];
        if (!allLowIntensity) blockReasons.push("事件强度偏高");
        if (!allHighConfidence) blockReasons.push("候选事件置信度不足");
        if (!noWarnings) blockReasons.push("存在安全标记");
        if (!previewPass) blockReasons.push("预览未通过");
        if (!isTrustedMode && turn.inputMode !== "chat" && turn.inputMode !== "journal") blockReasons.push("输入模式不受信任");

        if (turn.consentForWriteback) {
          decision = "confirmation_required";
          reasons.push(`auto_apply 条件不满足 (${blockReasons.join(", ")})，需要用户确认`);
          writebackAllowed = true;
        } else {
          decision = "preview_only";
          reasons.push(`auto_apply 条件不满足 (${blockReasons.join(", ")})`);
        }
        safetyLevel = "caution";
      }
      break;
    }

    default:
      decision = "preview_only";
      reasons.push("未知 writeback policy，默认 preview_only");
  }

  if (hasWarnings && safetyLevel === "safe") safetyLevel = "caution";

  const result: AgentPolicyDecision = {
    decision,
    reasons,
    warnings,
    writebackAllowed,
    safetyLevel,
    auditRequired: decision !== "preview_only" || session.writebackPolicy !== "never",
  };
  if (decision === "confirmation_required") result.requiredConfirmation = "apply";
  return result;
}

// ── Risk classification ──

export function classifyPolicyRisk(
  candidate: AgentEventCandidate,
  previewVerdict?: string,
): { riskLevel: "low" | "medium" | "high" | "blocked"; reasons: string[] } {
  const reasons: string[] = [];
  let maxLevel: "low" | "medium" | "high" | "blocked" = "low";

  if (candidate.safetyFlags.some((f) => BLOCKING_FLAGS.has(f))) {
    reasons.push("存在阻塞级安全标记");
    return { riskLevel: "blocked", reasons };
  }

  if (candidate.safetyFlags.length > 0) {
    maxLevel = "medium";
    reasons.push(`安全标记: ${candidate.safetyFlags.join(", ")}`);
  }

  if (candidate.confidence < 0.4) {
    maxLevel = "high";
    reasons.push("候选事件置信度低");
  }

  if (previewVerdict === "FAIL") {
    return { riskLevel: "blocked", reasons: [...reasons, "Reality Audit FAIL"] };
  }
  if (previewVerdict === "WARN") {
    if (maxLevel === "low") maxLevel = "medium";
    reasons.push("Reality Audit WARN");
  }

  return { riskLevel: maxLevel, reasons };
}

// ── Derive confirmation ──

export function deriveRequiredConfirmation(
  decision: PolicyAction,
): string | undefined {
  if (decision === "confirmation_required") return "apply";
  return undefined;
}

// ── Summarize ──

export function summarizePolicyDecision(decision: AgentPolicyDecision): string {
  const parts: string[] = [
    `Decision: ${decision.decision}`,
    `Safety: ${decision.safetyLevel}`,
    `Writeback: ${decision.writebackAllowed ? "allowed" : "blocked"}`,
    `Audit: ${decision.auditRequired ? "required" : "not required"}`,
  ];
  if (decision.requiredConfirmation) parts.push(`Confirmation: "${decision.requiredConfirmation}"`);
  if (decision.reasons.length > 0) parts.push(`Reasons: ${decision.reasons.join("; ")}`);
  if (decision.warnings.length > 0) parts.push(`Warnings: ${decision.warnings.join("; ")}`);
  return parts.join(" | ");
}
