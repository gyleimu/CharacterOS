import type { ParameterAdjustmentApplyTrace } from "./parameterAdjustmentApply";

export type ParameterAdjustmentHistoryAction = "apply" | "rollback";

export interface ParameterAdjustmentHistoryGovernanceOverride {
  used: boolean;
  reason?: string;
}

export interface ParameterAdjustmentHistoryEntry {
  id: string;
  characterId: string;
  action: ParameterAdjustmentHistoryAction;
  status: ParameterAdjustmentApplyTrace["status"];
  snapshotId: string;
  operationCount: number;
  targetPaths: string[];
  createdAt: string;
  reasons: string[];
  governanceOverride?: ParameterAdjustmentHistoryGovernanceOverride;
}

export interface ParameterAdjustmentHistorySummary {
  totalEntries: number;
  appliedCount: number;
  rollbackCount: number;
  blockedCount: number;
  overrideCount: number;
  totalOperations: number;
  uniqueTargetPaths: string[];
  latestTargetPaths: string[];
  latestAction?: ParameterAdjustmentHistoryAction;
  latestAt?: string;
  frequentTargetPaths: string[];
  stabilityRisk: "low" | "medium" | "high";
  reasons: string[];
}

export function createParameterAdjustmentHistoryEntry(params: {
  characterId: string;
  action: ParameterAdjustmentHistoryAction;
  trace: ParameterAdjustmentApplyTrace;
  createdAt?: string;
}): ParameterAdjustmentHistoryEntry {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const targetPaths = params.trace.appliedOperations.map((operation) => operation.path);
  return {
    id: buildHistoryId({
      characterId: params.characterId,
      action: params.action,
      snapshotId: params.trace.snapshotId,
      createdAt
    }),
    characterId: params.characterId,
    action: params.action,
    status: params.trace.status,
    snapshotId: params.trace.snapshotId,
    operationCount: params.trace.appliedOperations.length,
    targetPaths,
    createdAt,
    reasons: params.trace.reasons,
    ...(params.trace.governanceOverride ? { governanceOverride: params.trace.governanceOverride } : {})
  };
}

export function summarizeParameterAdjustmentHistory(
  history: ParameterAdjustmentHistoryEntry[]
): ParameterAdjustmentHistorySummary {
  const applied = history.filter((entry) => entry.status === "applied");
  const rollbacks = history.filter((entry) => entry.action === "rollback");
  const blocked = history.filter((entry) => entry.status === "blocked");
  const overrides = history.filter((entry) => entry.governanceOverride?.used);
  const targetCounts = new Map<string, number>();
  for (const entry of applied) {
    for (const path of entry.targetPaths) {
      targetCounts.set(path, (targetCounts.get(path) ?? 0) + 1);
    }
  }
  const uniqueTargetPaths = [...targetCounts.keys()].sort();
  const frequentTargetPaths = [...targetCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([path]) => path)
    .sort();
  const latest = [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const stabilityRisk = riskFromHistory({
    appliedCount: applied.length,
    rollbackCount: rollbacks.length,
    frequentTargetCount: frequentTargetPaths.length
  });

  return {
    totalEntries: history.length,
    appliedCount: applied.length,
    rollbackCount: rollbacks.length,
    blockedCount: blocked.length,
    overrideCount: overrides.length,
    totalOperations: applied.reduce((sum, entry) => sum + entry.operationCount, 0),
    uniqueTargetPaths,
    latestTargetPaths: latest?.targetPaths ?? [],
    ...(latest ? { latestAction: latest.action, latestAt: latest.createdAt } : {}),
    frequentTargetPaths,
    stabilityRisk,
    reasons: buildSummaryReasons({ history, frequentTargetPaths, stabilityRisk })
  };
}

function buildHistoryId(params: {
  characterId: string;
  action: ParameterAdjustmentHistoryAction;
  snapshotId: string;
  createdAt: string;
}): string {
  const source = `${params.characterId}|${params.action}|${params.snapshotId}|${params.createdAt}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `adjustment_history_${hash.toString(16)}`;
}

function riskFromHistory(params: {
  appliedCount: number;
  rollbackCount: number;
  frequentTargetCount: number;
}): ParameterAdjustmentHistorySummary["stabilityRisk"] {
  if (params.appliedCount >= 8 || params.rollbackCount >= 4 || params.frequentTargetCount >= 2) return "high";
  if (params.appliedCount >= 4 || params.rollbackCount >= 2 || params.frequentTargetCount >= 1) return "medium";
  return "low";
}

function buildSummaryReasons(params: {
  history: ParameterAdjustmentHistoryEntry[];
  frequentTargetPaths: string[];
  stabilityRisk: ParameterAdjustmentHistorySummary["stabilityRisk"];
}): string[] {
  if (!params.history.length) return ["no manual adjustment history yet"];
  const reasons = [`manual adjustment stability risk: ${params.stabilityRisk}`];
  if (params.frequentTargetPaths.length) {
    reasons.push(`frequent target paths: ${params.frequentTargetPaths.join(", ")}`);
  }
  return reasons;
}
