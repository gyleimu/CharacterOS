/**
 * V9.6 Patch Explanation
 *
 * Produces ExplanationTrace instances for patch preview and apply
 * operations. All explanations are generated deterministically from
 * structured inputs — no LLM, no natural language generation beyond
 * short template strings.
 */

import type {
  CharacterEditPatch,
  PatchValidationResult,
  PatchRiskSummary,
  PatchClampedChange,
  PatchIntegrityPolicyDecision,
  CharacterEditDomain
} from "../editor/characterEditPatch";
import {
  createTraceId,
  createFactId,
  createReasonId,
  type ExplanationTrace,
  type ExplanationFact,
  type ExplanationReason,
  type ExplanationSeverity
} from "./explanationTypes";

// ─── Preview Input ──────────────────────────────────────────────────────────

export interface PatchPreviewExplanationInput {
  patch: CharacterEditPatch;
  validation: PatchValidationResult;
  affectedDomains: CharacterEditDomain[];
  riskSummary: PatchRiskSummary;
  clampedChanges: PatchClampedChange[];
  integrity?: { valid: boolean; errorCount: number; warningCount: number };
}

// ─── Apply Input ────────────────────────────────────────────────────────────

export interface PatchApplyExplanationInput {
  patch: CharacterEditPatch;
  applied: boolean;
  validation: PatchValidationResult;
  affectedDomains: CharacterEditDomain[];
  riskSummary: PatchRiskSummary;
  clampedChanges: PatchClampedChange[];
  integrityPolicy: PatchIntegrityPolicyDecision;
}

// ─── Severity mapping ──────────────────────────────────────────────────────

function mapRiskToExplanationSeverity(severity: "ok" | "warning" | "error"): ExplanationSeverity {
  switch (severity) {
    case "error": return "danger";
    case "warning": return "warning";
    case "ok": return "info";
  }
}

function mapIntegrityStatusToSeverity(status: "pass" | "soft_warning" | "block"): ExplanationSeverity {
  switch (status) {
    case "block": return "blocked";
    case "soft_warning": return "warning";
    case "pass": return "info";
  }
}

// ─── explainPatchPreview ────────────────────────────────────────────────────

export function explainPatchPreview(input: PatchPreviewExplanationInput): ExplanationTrace {
  const {
    patch,
    validation,
    affectedDomains,
    riskSummary,
    clampedChanges,
    integrity
  } = input;

  const traceId = createTraceId();
  const facts: ExplanationFact[] = [];
  const reasons: ExplanationReason[] = [];
  const warnings: string[] = [];

  // Fact: change count
  const changesFact: ExplanationFact = {
    id: createFactId(),
    label: "Change count",
    value: patch.changes.length,
    source: "patch"
  };
  facts.push(changesFact);

  // Fact: affected domains
  const domainsFact: ExplanationFact = {
    id: createFactId(),
    label: "Affected domains",
    value: affectedDomains.length > 0 ? affectedDomains : ["none"],
    source: "derived"
  };
  facts.push(domainsFact);

  // Fact: validation status
  const validationStatusFact: ExplanationFact = {
    id: createFactId(),
    label: "Validation passed",
    value: validation.valid,
    source: "validation"
  };
  facts.push(validationStatusFact);

  // Fact: validation summary
  const validationSummaryFact: ExplanationFact = {
    id: createFactId(),
    label: "Validation summary",
    value: validation.summary,
    source: "validation"
  };
  facts.push(validationSummaryFact);

  // Fact: risk severity
  const riskFact: ExplanationFact = {
    id: createFactId(),
    label: "Risk severity",
    value: riskSummary.severity,
    source: "validation"
  };
  facts.push(riskFact);

  // Fact: error/warning/ok counts
  const countsFact: ExplanationFact = {
    id: createFactId(),
    label: "Change result counts",
    value: { errors: riskSummary.errorCount, warnings: riskSummary.warningCount, ok: riskSummary.okCount },
    source: "validation"
  };
  facts.push(countsFact);

  // Reason: patch summary
  reasons.push({
    id: createReasonId(),
    message: `Patch "${patch.description}" contains ${patch.changes.length} change(s).`,
    scope: "patch",
    severity: "info",
    confidence: "high",
    supportingFacts: [changesFact, domainsFact]
  });

  // Reason: affected domains
  if (affectedDomains.length > 0 && (affectedDomains.length > 1 || affectedDomains[0] !== "unknown")) {
    reasons.push({
      id: createReasonId(),
      message: `Patch affects domains: ${affectedDomains.join(", ")}.`,
      scope: "patch",
      severity: "info",
      confidence: "high",
      supportingFacts: [domainsFact]
    });
  }

  // Reason: validation
  const validationSeverity = validation.valid ? "info" : "danger";
  const validationMessage = validation.valid
    ? "Patch passed all validation checks."
    : `Patch failed validation: ${validation.summary}`;
  reasons.push({
    id: createReasonId(),
    message: validationMessage,
    scope: "patch",
    severity: validationSeverity as ExplanationSeverity,
    confidence: "high",
    supportingFacts: [validationStatusFact, validationSummaryFact]
  });

  // Reason: risk
  const riskSeverity = mapRiskToExplanationSeverity(riskSummary.severity);
  const riskMessage = riskSummary.severity === "ok"
    ? `Risk assessment: no errors or warnings.`
    : riskSummary.severity === "error"
      ? `Risk assessment: ${riskSummary.errorCount} error(s) detected.`
      : `Risk assessment: ${riskSummary.warningCount} warning(s) present.`;
  reasons.push({
    id: createReasonId(),
    message: riskMessage,
    scope: "patch",
    severity: riskSeverity,
    confidence: "high",
    supportingFacts: [riskFact, countsFact]
  });

  if (riskSummary.messages.length > 0) {
    const detailFact: ExplanationFact = {
      id: createFactId(),
      label: "Risk messages",
      value: riskSummary.messages,
      source: "validation"
    };
    facts.push(detailFact);
  }

  // Reason: clamped changes
  if (clampedChanges.length > 0) {
    const clampedFact: ExplanationFact = {
      id: createFactId(),
      label: "Clamped changes",
      value: clampedChanges.map((c) => ({
        path: c.path,
        submitted: c.submittedValue,
        applied: c.appliedValue,
        reason: c.reason
      })),
      source: "derived"
    };
    facts.push(clampedFact);

    for (const cc of clampedChanges) {
      reasons.push({
        id: createReasonId(),
        message: `Value for "${cc.path}" clamped from ${cc.submittedValue} to ${cc.appliedValue} — ${cc.reason}.`,
        scope: "patch",
        severity: "warning",
        confidence: "high",
        supportingFacts: [clampedFact]
      });
      warnings.push(`Clamped: ${cc.path} ${cc.submittedValue} → ${cc.appliedValue}`);
    }
  }

  // Reason: integrity
  if (integrity) {
    const integrityFact: ExplanationFact = {
      id: createFactId(),
      label: "Post-edit integrity",
      value: integrity,
      source: "integrity"
    };
    facts.push(integrityFact);

    const integrityPassed = integrity.valid && integrity.errorCount === 0;
    reasons.push({
      id: createReasonId(),
      message: integrityPassed
        ? "Post-edit integrity check passed."
        : `Post-edit integrity: ${integrity.errorCount} error(s), ${integrity.warningCount} warning(s).`,
      scope: "integrity_policy",
      severity: integrityPassed ? "info" : integrity.errorCount > 0 ? "danger" : "warning",
      confidence: "high",
      supportingFacts: [integrityFact]
    });
  }

  // Overall verdict
  const verdict = !validation.valid
    ? "blocked"
    : riskSummary.severity === "error"
      ? "blocked_by_risk"
      : riskSummary.severity === "warning"
        ? "allowed_with_warnings"
        : "allowed";

  const verdictFact: ExplanationFact = {
    id: createFactId(),
    label: "Verdict",
    value: verdict,
    source: "derived"
  };
  facts.push(verdictFact);

  const verdictMessage = verdict === "blocked" || verdict === "blocked_by_risk"
    ? "Patch is blocked and cannot be applied."
    : verdict === "allowed_with_warnings"
      ? "Patch is allowed with warnings — review before applying."
      : "Patch is allowed — no issues detected.";

  reasons.push({
    id: createReasonId(),
    message: verdictMessage,
    scope: "patch",
    severity: verdict === "allowed" ? "info" : verdict === "allowed_with_warnings" ? "warning" : "blocked",
    confidence: "high",
    supportingFacts: [verdictFact]
  });

  return {
    id: traceId,
    scope: "patch",
    title: `Patch Preview: ${patch.description}`,
    summary: verdictMessage,
    reasons,
    facts,
    warnings,
    createdAt: new Date().toISOString()
  };
}

// ─── explainPatchApply ──────────────────────────────────────────────────────

export function explainPatchApply(input: PatchApplyExplanationInput): ExplanationTrace {
  const {
    patch,
    applied,
    validation,
    affectedDomains,
    riskSummary,
    clampedChanges,
    integrityPolicy
  } = input;

  const traceId = createTraceId();
  const facts: ExplanationFact[] = [];
  const reasons: ExplanationReason[] = [];
  const warnings: string[] = [];

  // Fact: applied status
  const appliedFact: ExplanationFact = {
    id: createFactId(),
    label: "Patch applied",
    value: applied,
    source: "derived"
  };
  facts.push(appliedFact);

  // Fact: change count
  const changesFact: ExplanationFact = {
    id: createFactId(),
    label: "Change count",
    value: patch.changes.length,
    source: "patch"
  };
  facts.push(changesFact);

  // Fact: affected domains
  const domainsFact: ExplanationFact = {
    id: createFactId(),
    label: "Affected domains",
    value: affectedDomains.length > 0 ? affectedDomains : ["none"],
    source: "derived"
  };
  facts.push(domainsFact);

  // Fact: validation summary
  const validationFact: ExplanationFact = {
    id: createFactId(),
    label: "Validation summary",
    value: validation.summary,
    source: "validation"
  };
  facts.push(validationFact);

  // Fact: risk
  const riskFact: ExplanationFact = {
    id: createFactId(),
    label: "Risk severity",
    value: riskSummary.severity,
    source: "validation"
  };
  facts.push(riskFact);

  // Fact: clamped changes
  if (clampedChanges.length > 0) {
    const clampedFact: ExplanationFact = {
      id: createFactId(),
      label: "Clamped changes",
      value: clampedChanges.map((c) => ({
        path: c.path,
        submitted: c.submittedValue,
        applied: c.appliedValue,
        reason: c.reason
      })),
      source: "derived"
    };
    facts.push(clampedFact);

    for (const cc of clampedChanges) {
      warnings.push(`Clamped: ${cc.path} ${cc.submittedValue} → ${cc.appliedValue}`);
    }
  }

  // Fact: integrity policy
  const integrityFact: ExplanationFact = {
    id: createFactId(),
    label: "Integrity policy decision",
    value: {
      status: integrityPolicy.status,
      errorCount: integrityPolicy.errorCount,
      warningCount: integrityPolicy.warningCount
    },
    source: "integrity"
  };
  facts.push(integrityFact);

  // Reason: apply status
  const applyMessage = applied
    ? `Patch "${patch.description}" was applied successfully.`
    : `Patch "${patch.description}" was NOT applied.`;
  reasons.push({
    id: createReasonId(),
    message: applyMessage,
    scope: "patch",
    severity: applied ? "info" : "blocked",
    confidence: "high",
    supportingFacts: [appliedFact, changesFact]
  });

  // Reason: why blocked (if applicable)
  if (!applied) {
    const whyBlocked = validation.valid
      ? "Patch was blocked by integrity policy or risk assessment."
      : `Patch was blocked by validation: ${validation.summary}`;
    reasons.push({
      id: createReasonId(),
      message: whyBlocked,
      scope: "patch",
      severity: "blocked",
      confidence: "high",
      supportingFacts: [validationFact, riskFact, integrityFact]
    });
  }

  // Reason: affected domains
  if (affectedDomains.length > 0) {
    reasons.push({
      id: createReasonId(),
      message: `Affected character domains: ${affectedDomains.join(", ")}.`,
      scope: "patch",
      severity: "info",
      confidence: "high",
      supportingFacts: [domainsFact]
    });
  }

  // Reason: risk
  if (riskSummary.severity !== "ok") {
    const riskSev = mapRiskToExplanationSeverity(riskSummary.severity);
    reasons.push({
      id: createReasonId(),
      message: `Risk: ${riskSummary.errorCount} error(s), ${riskSummary.warningCount} warning(s).`,
      scope: "patch",
      severity: riskSev,
      confidence: "high",
      supportingFacts: [riskFact]
    });
  }

  // Reason: clamped changes
  if (clampedChanges.length > 0) {
    for (const cc of clampedChanges) {
      const ccFact: ExplanationFact = {
        id: createFactId(),
        label: `Clamped: ${cc.path}`,
        value: { submitted: cc.submittedValue, applied: cc.appliedValue, reason: cc.reason },
        source: "derived"
      };
      facts.push(ccFact);

      reasons.push({
        id: createReasonId(),
        message: `Value for "${cc.path}" was clamped: ${cc.submittedValue} → ${cc.appliedValue} (${cc.reason}).`,
        scope: "patch",
        severity: "warning",
        confidence: "high",
        supportingFacts: [ccFact]
      });
    }
  }

  // Reason: integrity policy
  const integritySev = mapIntegrityStatusToSeverity(integrityPolicy.status);
  const integrityMessage = integrityPolicy.status === "pass"
    ? "Integrity policy: passed."
    : integrityPolicy.status === "soft_warning"
      ? `Integrity policy: soft warning — ${integrityPolicy.warningCount} warning(s). Apply was allowed.`
      : `Integrity policy: BLOCKED — ${integrityPolicy.errorCount} error(s). ${integrityPolicy.blockingReasons.join(" ")}`;
  reasons.push({
    id: createReasonId(),
    message: integrityMessage,
    scope: "integrity_policy",
    severity: integritySev,
    confidence: "high",
    supportingFacts: [integrityFact]
  });

  // Warnings from integrity policy
  for (const w of integrityPolicy.warnings) {
    warnings.push(w);
  }

  // Audit relevance
  reasons.push({
    id: createReasonId(),
    message: applied
      ? "This patch was recorded in the audit log."
      : "This patch was NOT recorded in the audit log (not applied).",
    scope: "patch",
    severity: "info",
    confidence: "high",
    supportingFacts: [appliedFact]
  });

  // Overall verdict
  const verdictFact: ExplanationFact = {
    id: createFactId(),
    label: "Verdict",
    value: applied ? "applied" : "blocked",
    source: "derived"
  };
  facts.push(verdictFact);

  return {
    id: traceId,
    scope: "patch",
    title: `Patch Apply: ${patch.description}`,
    summary: applied
      ? `Patch applied. ${patch.changes.length} change(s) across ${affectedDomains.length} domain(s).`
      : `Patch blocked. ${validation.valid ? "Integrity or risk gate prevented application." : validation.summary}`,
    reasons,
    facts,
    warnings,
    createdAt: new Date().toISOString()
  };
}
