/**
 * V11.7 — Time Machine Restore View Core
 *
 * Builds read-only historical view from a TimeMachineSnapshot.
 * No writes. No rollback. No state mutation.
 */
import type { TimeMachineSnapshot, TimeMachineTimeline, TimeMachineRestoreView, QualitativeDiff, QualitativeChange } from "./explorerTypes";

export interface RestoreViewInput {
  snapshot: TimeMachineSnapshot;
  timeline: TimeMachineTimeline;
  currentSnapshot?: TimeMachineSnapshot;
  restoreMode?: "view_only" | "rollback_requires_confirmation";
}

export function buildTimeMachineRestoreView(
  input: RestoreViewInput,
): TimeMachineRestoreView {
  const warnings: string[] = [];
  const { snapshot, timeline } = input;

  const isCurrent = snapshot.snapshotId === timeline.currentSnapshotId ||
    (input.currentSnapshot
      ? snapshot.snapshotId === input.currentSnapshot.snapshotId
      : false);

  const mode = input.restoreMode ?? timeline.restoreMode;

  // Galaxy ref check
  if (!snapshot.galaxyRef || snapshot.galaxyRef === "unknown") {
    warnings.push("此快照的 Mind Galaxy 引用不可用");
  }

  // Audit ref check
  if (!snapshot.auditRef || snapshot.auditRef === "unknown") {
    warnings.push("此快照的 Reality Audit 引用不可用");
  }

  // Diff from current
  let diff: QualitativeDiff | null = null;
  if (input.currentSnapshot && !isCurrent) {
    diff = buildQualitativeDiff(snapshot, input.currentSnapshot);
  }

  // Deterministic restore view ID
  const restoreViewId = buildRestoreViewId(snapshot.snapshotId, isCurrent);

  return {
    restoreViewId,
    snapshotId: snapshot.snapshotId,
    characterId: snapshot.characterId,
    label: snapshot.label,
    capturedAt: snapshot.capturedAt,
    isHistoricalView: true,
    isCurrentSnapshot: isCurrent,
    restoreMode: mode,
    stateSummary: snapshot.stateSummary,
    personalitySummary: snapshot.personalitySummary,
    beliefSummary: snapshot.beliefSummary,
    needSummary: snapshot.needSummary,
    memorySummary: snapshot.memorySummary,
    mindGalaxyRef: snapshot.galaxyRef ?? null,
    realityAuditRef: snapshot.auditRef ?? null,
    diffFromCurrent: diff,
    warnings,
    safetyBanner: [
      "📜 历史视图 — 这是过去某一时刻的状态快照",
      "这不是当前角色状态",
      "这是模拟系统的历史记录，不是医学或心理诊断",
      "查看历史视图不会写回或修改角色当前状态",
    ],
    noMutation: true,
  };
}

// ── Qualitative Diff ──

function buildQualitativeDiff(
  historical: TimeMachineSnapshot,
  current: TimeMachineSnapshot,
): QualitativeDiff {
  const changes: QualitativeDiff["changes"] = [];
  let hasChanged = false;

  // Compare personality bands
  const dims: Array<keyof typeof historical.personalitySummary> = ["trust", "fear", "openness", "attachment", "neuroticism"];
  for (const dim of dims) {
    const hist = historical.personalitySummary[dim];
    const curr = current.personalitySummary[dim];
    if (hist.value !== curr.value) {
      hasChanged = true;
      let dir: "increased" | "decreased" | "changed" | "unchanged";
      if ((hist.value === "low" && (curr.value === "moderate" || curr.value === "high")) ||
          (hist.value === "moderate" && curr.value === "high")) {
        dir = "increased";
      } else if ((hist.value === "high" && (curr.value === "moderate" || curr.value === "low")) ||
                 (hist.value === "moderate" && curr.value === "low")) {
        dir = "decreased";
      } else {
        dir = "changed";
      }

      changes.push({
        dimension: dim,
        direction: dir,
        summary: `${dim}: ${hist.label} → ${curr.label}`,
      });
    }
  }

  if (!hasChanged && changes.length === 0) {
    changes.push({ dimension: "整体", direction: "unchanged", summary: "人格特征无明显变化" });
  }

  return { hasChanged, changes };
}

// ── ID builder ──

function buildRestoreViewId(snapshotId: string, isCurrent: boolean): string {
  const seed = `restore_${snapshotId}_${isCurrent ? "current" : "historical"}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `rview_${Math.abs(hash).toString(16)}`;
}
