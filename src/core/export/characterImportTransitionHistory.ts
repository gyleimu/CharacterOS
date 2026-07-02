import { createHash } from "node:crypto";
import type { CharacterImportApplyTrace, CharacterImportApplyStatus } from "./characterImportApply";

export interface CharacterImportTransitionHistoryEntry {
  id: string;
  characterId: string;
  createdAt: string;
  status: CharacterImportApplyStatus;
  transitionId?: string;
  sourceCharacterId?: string;
  confirmationRequired: string;
  trace: CharacterImportApplyTrace;
}

export interface CharacterImportTransitionHistorySummary {
  totalEntries: number;
  appliedCount: number;
  blockedCount: number;
  latestStatus?: CharacterImportApplyStatus;
  latestTransitionId?: string;
  latestCreatedAt?: string;
  reasons: string[];
}

export function createCharacterImportTransitionHistoryEntry(params: {
  characterId: string;
  trace: CharacterImportApplyTrace;
  createdAt?: string;
}): CharacterImportTransitionHistoryEntry {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const id = buildImportTransitionHistoryEntryId({
    characterId: params.characterId,
    createdAt,
    trace: params.trace
  });
  return {
    id,
    characterId: params.characterId,
    createdAt,
    status: params.trace.status,
    ...(params.trace.transitionId ? { transitionId: params.trace.transitionId } : {}),
    ...(params.trace.sourceCharacterId ? { sourceCharacterId: params.trace.sourceCharacterId } : {}),
    confirmationRequired: params.trace.confirmationRequired,
    trace: params.trace
  };
}

export function summarizeCharacterImportTransitionHistory(
  entries: CharacterImportTransitionHistoryEntry[]
): CharacterImportTransitionHistorySummary {
  const latest = entries.at(-1);
  const appliedCount = entries.filter((entry) => entry.status === "applied").length;
  const blockedCount = entries.length - appliedCount;
  return {
    totalEntries: entries.length,
    appliedCount,
    blockedCount,
    ...(latest ? { latestStatus: latest.status } : {}),
    ...(latest?.transitionId ? { latestTransitionId: latest.transitionId } : {}),
    ...(latest ? { latestCreatedAt: latest.createdAt } : {}),
    reasons: buildHistorySummaryReasons(entries.length, appliedCount, blockedCount)
  };
}

function buildImportTransitionHistoryEntryId(params: {
  characterId: string;
  createdAt: string;
  trace: CharacterImportApplyTrace;
}): string {
  const payload = {
    characterId: params.characterId,
    createdAt: params.createdAt,
    status: params.trace.status,
    transitionId: params.trace.transitionId ?? null,
    sourceCharacterId: params.trace.sourceCharacterId ?? null,
    confirmationRequired: params.trace.confirmationRequired,
    reasons: params.trace.reasons,
    errors: params.trace.errors
  };
  return `import_history_${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16)}`;
}

function buildHistorySummaryReasons(
  totalEntries: number,
  appliedCount: number,
  blockedCount: number
): string[] {
  if (totalEntries === 0) return ["no import apply attempts recorded"];
  const reasons = [`${totalEntries} import apply attempt(s) recorded`];
  if (appliedCount > 0) reasons.push(`${appliedCount} applied import(s)`);
  if (blockedCount > 0) reasons.push(`${blockedCount} blocked import attempt(s)`);
  return reasons;
}
