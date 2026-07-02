import type {
  LongitudinalCommitGovernanceStatus,
  LongitudinalFinalStateForCommit,
  LongitudinalRequestDigest,
  LongitudinalRollbackPlan,
  LongitudinalStateFingerprint,
} from "./finalStateForCommit";
import type { CompactStateSummary, LongitudinalCommitPolicy } from "./longitudinalSimulation";

export type LongitudinalCommitAuditStatus =
  | "previewed"
  | "applied"
  | "rolled_back"
  | "blocked";

export interface LongitudinalCommitAuditEntry {
  version: "v10.24";
  id: string;
  characterId: string;
  simulationId: string;
  status: LongitudinalCommitAuditStatus;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
  requestDigest: LongitudinalRequestDigest;
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
  commitPolicy: LongitudinalCommitPolicy;
  changedPaths: string[];
  generatedMemoryIds: string[];
  beforeSummary: CompactStateSummary;
  afterSummary: CompactStateSummary;
  governanceStatus: LongitudinalCommitGovernanceStatus;
  governanceBlockers: string[];
  governanceWarnings: string[];
  rollbackPlan: LongitudinalRollbackPlan;
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalCommitHistorySummary {
  total: number;
  previewed: number;
  applied: number;
  rolledBack: number;
  blocked: number;
  generatedMemoryCount: number;
  latestUpdatedAt?: string;
}

export function createLongitudinalCommitAuditEntry(
  handoff: LongitudinalFinalStateForCommit,
  options: {
    status?: LongitudinalCommitAuditStatus;
    createdAt?: string;
    updatedAt?: string;
  } = {}
): LongitudinalCommitAuditEntry {
  const createdAt = options.createdAt ?? handoff.auditDraft.timestamp;
  const status = options.status ?? (handoff.governance.status === "block" ? "blocked" : "previewed");
  const entry: LongitudinalCommitAuditEntry = {
    version: "v10.24",
    id: handoff.auditDraft.id,
    characterId: handoff.characterId,
    simulationId: handoff.simulationId,
    status,
    createdAt,
    updatedAt: options.updatedAt ?? createdAt,
    requestDigest: handoff.requestDigest,
    baseStateFingerprint: handoff.baseStateFingerprint,
    finalStateFingerprint: handoff.finalStateFingerprint,
    commitPolicy: handoff.auditDraft.commitPolicy,
    changedPaths: [...handoff.auditDraft.changedPaths],
    generatedMemoryIds: [...handoff.auditDraft.generatedMemoryIds],
    beforeSummary: { ...handoff.auditDraft.beforeSummary },
    afterSummary: { ...handoff.auditDraft.afterSummary },
    governanceStatus: handoff.governance.status,
    governanceBlockers: [...handoff.governance.blockers],
    governanceWarnings: [...handoff.governance.warnings],
    rollbackPlan: cloneRollbackPlan(handoff.rollbackPlan),
    warnings: [...handoff.warnings],
    reasons: [
      "Longitudinal commit audit entry records summaries and digests only.",
      ...handoff.reasons,
    ],
  };
  return entry;
}

export function markLongitudinalCommitAuditApplied(
  entry: LongitudinalCommitAuditEntry,
  appliedAt: string
): LongitudinalCommitAuditEntry {
  return {
    ...cloneAuditEntry(entry),
    status: "applied",
    appliedAt,
    updatedAt: appliedAt,
    reasons: [
      ...entry.reasons,
      "Longitudinal commit was marked applied after service-layer state replacement.",
    ],
  };
}

export function markLongitudinalCommitAuditRolledBack(
  entry: LongitudinalCommitAuditEntry,
  rolledBackAt: string
): LongitudinalCommitAuditEntry {
  const next: LongitudinalCommitAuditEntry = {
    ...cloneAuditEntry(entry),
    status: "rolled_back",
    rolledBackAt,
    updatedAt: rolledBackAt,
    reasons: [
      ...entry.reasons,
      "Longitudinal commit rollback was recorded as a separate audit state transition.",
    ],
  };
  if (entry.appliedAt) next.appliedAt = entry.appliedAt;
  return next;
}

export function summarizeLongitudinalCommitHistory(
  entries: LongitudinalCommitAuditEntry[]
): LongitudinalCommitHistorySummary {
  const summary: LongitudinalCommitHistorySummary = {
    total: entries.length,
    previewed: entries.filter((entry) => entry.status === "previewed").length,
    applied: entries.filter((entry) => entry.status === "applied").length,
    rolledBack: entries.filter((entry) => entry.status === "rolled_back").length,
    blocked: entries.filter((entry) => entry.status === "blocked").length,
    generatedMemoryCount: entries.reduce((sum, entry) => sum + entry.generatedMemoryIds.length, 0),
  };
  const latestUpdatedAt = entries
    .map((entry) => entry.updatedAt)
    .filter((value) => value.length > 0)
    .sort()
    .at(-1);
  if (latestUpdatedAt) summary.latestUpdatedAt = latestUpdatedAt;
  return summary;
}

export function findLongitudinalCommitAuditBySimulationId(
  entries: LongitudinalCommitAuditEntry[],
  simulationId: string
): LongitudinalCommitAuditEntry | undefined {
  return entries.find((entry) => entry.simulationId === simulationId);
}

function cloneAuditEntry(entry: LongitudinalCommitAuditEntry): LongitudinalCommitAuditEntry {
  const clone: LongitudinalCommitAuditEntry = {
    version: entry.version,
    id: entry.id,
    characterId: entry.characterId,
    simulationId: entry.simulationId,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    requestDigest: entry.requestDigest,
    baseStateFingerprint: entry.baseStateFingerprint,
    finalStateFingerprint: entry.finalStateFingerprint,
    commitPolicy: { ...entry.commitPolicy },
    changedPaths: [...entry.changedPaths],
    generatedMemoryIds: [...entry.generatedMemoryIds],
    beforeSummary: { ...entry.beforeSummary },
    afterSummary: { ...entry.afterSummary },
    governanceStatus: entry.governanceStatus,
    governanceBlockers: [...entry.governanceBlockers],
    governanceWarnings: [...entry.governanceWarnings],
    rollbackPlan: cloneRollbackPlan(entry.rollbackPlan),
    warnings: [...entry.warnings],
    reasons: [...entry.reasons],
  };
  if (entry.appliedAt) clone.appliedAt = entry.appliedAt;
  if (entry.rolledBackAt) clone.rolledBackAt = entry.rolledBackAt;
  return clone;
}

function cloneRollbackPlan(plan: LongitudinalRollbackPlan): LongitudinalRollbackPlan {
  return {
    id: plan.id,
    simulationId: plan.simulationId,
    type: plan.type,
    generatedMemoryIds: [...plan.generatedMemoryIds],
    baseStateFingerprint: plan.baseStateFingerprint,
    finalStateFingerprint: plan.finalStateFingerprint,
    staleWritePolicy: plan.staleWritePolicy,
    warnings: [...plan.warnings],
    reasons: [...plan.reasons],
  };
}
