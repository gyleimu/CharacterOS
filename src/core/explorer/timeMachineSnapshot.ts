/**
 * V11.6 — Time Machine Snapshot Core
 *
 * Builds immutable, deterministic state snapshots for historical viewing.
 * Snapshot != rollback. View-only by default. No state mutation.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { buildCharacterStateSurface } from "./characterStateSurface";
import type {
  TimeMachineSnapshot,
  TimeMachineTimeline,
  TimeMachineRange,
  PersonalitySummary,
} from "./explorerTypes";

export interface TimeMachineSnapshotInput {
  state: CharacterPhysicsState;
  label: string;
  capturedAt: string;
  sequenceIndex: number;
  eventCount?: number;
  galaxyRef?: string;
  auditRef?: string;
  recentAuditVerdict?: string;
}

export function buildTimeMachineSnapshot(
  input: TimeMachineSnapshotInput,
): TimeMachineSnapshot {
  const surfaceInput: Parameters<typeof buildCharacterStateSurface>[0] = { state: input.state };
  if (input.recentAuditVerdict) surfaceInput.recentAuditVerdict = input.recentAuditVerdict;
  const surface = buildCharacterStateSurface(surfaceInput);

  const fingerprint = computeFingerprint(input.state);
  const snapshotId = buildSnapshotId(
    input.state.identity.id, input.capturedAt, input.sequenceIndex, fingerprint,
  );

  const eventCount = input.eventCount ?? input.state.memories.length;

  return {
    snapshotId,
    characterId: input.state.identity.id,
    label: input.label,
    capturedAt: input.capturedAt,
    sequenceIndex: input.sequenceIndex,
    stateSummary: `${surface.headline} — ${input.state.memories.length} 记忆, ${input.state.beliefStates.length} 信念, 边界 ${input.state.boundary.phase}`,
    personalitySummary: surface.personalitySummary,
    beliefSummary: input.state.beliefStates.slice(0, 3).map((b) => b.content).join("; ") || "无显著信念",
    needSummary: surface.dominantNeeds.map((n) => n.label).join("; ") || "需求需派生状态",
    memorySummary: `${input.state.memories.length} 条记忆${eventCount !== input.state.memories.length ? ` (快照时事件数: ${eventCount})` : ""}`,
    galaxyRef: input.galaxyRef ?? `galaxy_${fingerprint}`,
    auditRef: input.auditRef ?? `audit_${fingerprint}`,
    immutable: true,
  };
}

// ── Timeline ──

export interface TimeMachineTimelineInput {
  characterId: string;
  snapshots: TimeMachineSnapshot[];
  restoreMode?: "view_only" | "rollback_requires_confirmation";
}

export function buildTimeMachineTimeline(
  input: TimeMachineTimelineInput,
): TimeMachineTimeline {
  const warnings: string[] = [];
  const sorted = [...input.snapshots].sort((a, b) => {
    if (a.sequenceIndex !== b.sequenceIndex) return a.sequenceIndex - b.sequenceIndex;
    return a.capturedAt.localeCompare(b.capturedAt);
  });

  // Check mixed characterIds
  const mixedChars = new Set(sorted.map((s) => s.characterId));
  if (mixedChars.size > 1) {
    warnings.push(`快照列表包含不同角色: ${[...mixedChars].join(", ")}`);
  }

  const currentSnapshotId = sorted.length > 0 ? sorted[sorted.length - 1]!.snapshotId : "live";
  const mode = input.restoreMode ?? "view_only";

  if (sorted.length === 0) {
    warnings.push("暂无快照 — 创建第一个快照以启用时间机器");
  }

  // Build ranges
  const availableRanges: TimeMachineRange[] = [];
  if (sorted.length > 0) {
    availableRanges.push({
      label: "全部",
      from: sorted[0]!.capturedAt,
      to: sorted[sorted.length - 1]!.capturedAt,
      snapshotCount: sorted.length,
    });
    // Add "Day N" ranges for significant milestones
    const milestones = [sorted[0]!];
    if (sorted.length > 1) milestones.push(sorted[sorted.length - 1]!);
    for (const m of milestones) {
      const exists = availableRanges.find((r) => r.label === m.label);
      if (!exists) {
        availableRanges.push({
          label: m.label,
          from: m.capturedAt,
          to: m.capturedAt,
          snapshotCount: 1,
        });
      }
    }
  }

  return {
    characterId: input.characterId,
    snapshots: sorted,
    currentSnapshotId,
    availableRanges,
    restoreMode: mode,
    warnings,
  };
}

// ── Helpers ──

function buildSnapshotId(
  characterId: string, capturedAt: string, sequenceIndex: number, fingerprint: string,
): string {
  const seed = `${characterId}|${capturedAt}|${sequenceIndex}|${fingerprint}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return `snap_${Math.abs(hash).toString(16)}`;
}

function computeFingerprint(state: CharacterPhysicsState): string {
  const c = state.coordinate.values;
  const parts = [
    state.identity.id, state.memories.length, state.beliefStates.length,
    c.trust.toFixed(4), c.fear.toFixed(4), c.openness.toFixed(4),
    state.boundary.phase,
    state.parameterSetVersion,
  ];
  let hash = 0;
  for (let i = 0; i < parts.join("|").length; i++) {
    hash = ((hash << 5) - hash + parts.join("|").charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}
