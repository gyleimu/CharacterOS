import type {
  LongitudinalFinalStateForCommit,
  LongitudinalStateFingerprint,
} from "./finalStateForCommit";
import type { LongitudinalCommitAuditEntry } from "./longitudinalCommitAudit";

export const LONGITUDINAL_COMMIT_CONFIRMATION = "APPLY_LONGITUDINAL_COMMIT";

export type LongitudinalCommitApplyReadinessStatus = "ready" | "blocked" | "conflict";
export type LongitudinalCommitApplyStatus = "applied" | "blocked" | "conflict" | "not_found";

export interface LongitudinalCommitApplyOptions {
  confirmation?: string;
  allowWarnings?: boolean;
  appliedAt?: string;
}

export interface LongitudinalCommitApplyReadiness {
  status: LongitudinalCommitApplyReadinessStatus;
  blockers: string[];
  warnings: string[];
  reasons: string[];
  expectedBaseStateFingerprint: LongitudinalStateFingerprint;
  actualStateFingerprint: LongitudinalStateFingerprint;
}

export interface LongitudinalCommitApplyResult {
  status: LongitudinalCommitApplyStatus;
  applied: boolean;
  characterId: string;
  simulationId: string;
  audit?: LongitudinalCommitAuditEntry;
  readiness?: LongitudinalCommitApplyReadiness;
  warnings: string[];
  reasons: string[];
}

export function evaluateLongitudinalCommitApplyReadiness(params: {
  handoff: LongitudinalFinalStateForCommit;
  currentStateFingerprint: LongitudinalStateFingerprint;
  confirmation?: string;
  allowWarnings?: boolean;
}): LongitudinalCommitApplyReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (params.confirmation !== LONGITUDINAL_COMMIT_CONFIRMATION) {
    blockers.push(`confirmation must equal ${LONGITUDINAL_COMMIT_CONFIRMATION}`);
  } else {
    reasons.push("Explicit longitudinal commit confirmation matched.");
  }

  if (params.currentStateFingerprint.value !== params.handoff.baseStateFingerprint.value) {
    blockers.push("current state fingerprint does not match preview base state fingerprint.");
  } else {
    reasons.push("Current state fingerprint matches preview base state fingerprint.");
  }

  if (params.handoff.governance.status === "block") {
    blockers.push(...params.handoff.governance.blockers);
  } else {
    reasons.push(`Governance status ${params.handoff.governance.status} allows apply evaluation.`);
  }

  if (params.handoff.governance.status === "warning" && params.allowWarnings !== true) {
    blockers.push("governance warnings require allowWarnings=true before apply.");
  }

  warnings.push(...params.handoff.governance.warnings);
  if (params.allowWarnings === true && warnings.length > 0) {
    reasons.push("allowWarnings=true accepts governance warnings for this apply.");
  }

  const status: LongitudinalCommitApplyReadinessStatus =
    params.currentStateFingerprint.value !== params.handoff.baseStateFingerprint.value
      ? "conflict"
      : blockers.length > 0
        ? "blocked"
        : "ready";

  return {
    status,
    blockers,
    warnings,
    reasons,
    expectedBaseStateFingerprint: params.handoff.baseStateFingerprint,
    actualStateFingerprint: params.currentStateFingerprint,
  };
}
