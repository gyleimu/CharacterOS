/**
 * V11.8 — Explorer Service Boundary
 *
 * Wraps all V11 core Explorer modules behind a clean service interface.
 * Read-only by default. Write requires confirmation. No UI. No chat. No multi.
 */
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../core/character/characterBlueprint";
import { buildCharacterStateSurface } from "../core/explorer/characterStateSurface";
import { buildEventStudioPreview } from "../core/explorer/eventStudioPreview";
import { buildEventStudioDraft } from "../core/explorer/explorerDtoBuilders";
import { applyEventStudioEvent } from "../core/explorer/eventStudioApply";
import { buildExplainabilityTimeline } from "../core/explorer/explainabilityTimeline";
import { buildTimeMachineSnapshot, buildTimeMachineTimeline } from "../core/explorer/timeMachineSnapshot";
import { buildTimeMachineRestoreView } from "../core/explorer/timeMachineRestoreView";
import { buildExplorerManifest, buildMindGalaxyEmbed } from "../core/explorer/explorerDtoBuilders";
import { deterministicDraftId } from "../core/deterministicHelpers";
import type {
  EventStudioDraft, EventStudioPreview, EventStudioApplyResult,
  TimeMachineSnapshot, TimeMachineTimeline, TimeMachineRestoreView,
  EventStudioAuditEntry,
} from "../core/explorer/explorerTypes";
import {
  serviceOk, serviceOkWrite, serviceError,
  type ExplorerManifestResponse, type CharacterStateSurfaceResponse,
  type EventStudioPreviewResponse, type EventStudioApplyResponse,
  type ExplainabilityTimelineResponse, type TimeMachineSnapshotResponse,
  type TimeMachineTimelineResponse, type TimeMachineRestoreViewResponse,
  type MindGalaxyEmbedResponse,
} from "../appContracts/explorer";

// ── In-memory state store (single-character, single-machine) ──

const characterStates = new Map<string, ReturnType<typeof createCharacterStateFromBlueprint>>();
const auditHistory: EventStudioAuditEntry[] = [];
const snapshots: TimeMachineSnapshot[] = [];

function getOrCreateState(characterId: string) {
  if (!characterStates.has(characterId)) {
    characterStates.set(characterId, createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true }));
  }
  return characterStates.get(characterId)!;
}

// ── Service Methods ──

export function getExplorerManifest(characterId: string): ExplorerManifestResponse {
  return serviceOk(buildExplorerManifest(characterId));
}

export function getCharacterStateSurface(characterId: string): CharacterStateSurfaceResponse {
  const state = getOrCreateState(characterId);
  return serviceOk(buildCharacterStateSurface({ state }));
}

export function previewEvent(
  characterId: string,
  draft: Partial<EventStudioDraft>,
  options?: { previewMode?: "parse_only" | "impact_preview" | "full_preview" },
): EventStudioPreviewResponse {
  const state = getOrCreateState(characterId);
  const fullDraft = buildEventStudioDraft({
    ...draft,
    sourceId: draft.sourceId ?? deterministicDraftId(
      draft.naturalLanguageInput ?? "",
      draft.tags,
      draft.occurredAt,
    ),
  });

  const relationshipScenario = {
    id: "explorer_service_scenario",
    name: "关系场景", trigger: "对方没有回复。", stressor: "亲密关系", testFocus: "信任 安全感",
  };

  const preview = buildEventStudioPreview({
    draft: fullDraft,
    baselineState: state,
    followUpScenario: relationshipScenario,
    previewMode: options?.previewMode ?? "full_preview",
  });

  return serviceOk(preview);
}

export function applyEvent(
  characterId: string,
  draft: Partial<EventStudioDraft>,
  preview: EventStudioPreview,
  confirmation: string,
  applyReason: string,
  actorId: string,
): EventStudioApplyResponse {
  if (!confirmation || confirmation !== "apply") {
    return serviceError("CONFIRMATION_REQUIRED", "需要明确确认 'apply' 才能写入", "error");
  }

  const state = getOrCreateState(characterId);
  const fullDraft = buildEventStudioDraft({ ...draft, sourceId: draft.sourceId ?? preview.draftId });

  const result = applyEventStudioEvent({
    baselineState: state,
    draft: fullDraft,
    preview,
    confirmation,
    applyReason,
    actorId,
    options: { allowMutation: true }, // mutate in-memory state
  });

  if (!result.applied) {
    return serviceError("APPLY_BLOCKED", result.blockedReason ?? "apply 被阻止", "warn");
  }

  // Record audit
  if (result.auditEntry) {
    auditHistory.push(result.auditEntry);
  }

  return serviceOkWrite(result);
}

export function getExplainabilityTimeline(
  characterId: string,
  question?: string,
  focus?: "emotion" | "belief" | "need" | "desire" | "personality" | "decision" | "stress",
): ExplainabilityTimelineResponse {
  const state = getOrCreateState(characterId);
  const surface = buildCharacterStateSurface({ state });

  const tlInput: Parameters<typeof buildExplainabilityTimeline>[0] = {
    state,
    stateSurface: surface,
    recentAuditEntries: auditHistory.slice(-10),
  };
  if (question) tlInput.question = question;
  if (focus) tlInput.focus = focus;
  const timeline = buildExplainabilityTimeline(tlInput);

  return serviceOk(timeline);
}

export function createTimeMachineSnapshot(
  characterId: string,
  label: string,
  options?: { galaxyRef?: string; auditRef?: string },
): TimeMachineSnapshotResponse {
  const state = getOrCreateState(characterId);
  const snapInput: Parameters<typeof buildTimeMachineSnapshot>[0] = {
    state, label,
    capturedAt: new Date().toISOString(),
    sequenceIndex: snapshots.length + 1,
  };
  if (options?.galaxyRef) snapInput.galaxyRef = options.galaxyRef;
  if (options?.auditRef) snapInput.auditRef = options.auditRef;
  const snapshot = buildTimeMachineSnapshot(snapInput);

  snapshots.push(snapshot);
  return serviceOk(snapshot);
}

export function getTimeMachineTimeline(characterId: string): TimeMachineTimelineResponse {
  const timeline = buildTimeMachineTimeline({
    characterId,
    snapshots: [...snapshots],
  });
  return serviceOk(timeline);
}

export function restoreTimeMachineView(
  characterId: string,
  snapshotId: string,
): TimeMachineRestoreViewResponse {
  const timeline = buildTimeMachineTimeline({ characterId, snapshots: [...snapshots] });
  const snapshot = snapshots.find((s) => s.snapshotId === snapshotId);
  if (!snapshot) {
    return serviceError("SNAPSHOT_NOT_FOUND", `快照 ${snapshotId} 不存在`, "error");
  }

  const currentSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined;
  const viewInput: Parameters<typeof buildTimeMachineRestoreView>[0] = { snapshot, timeline };
  if (currentSnap) viewInput.currentSnapshot = currentSnap;
  const view = buildTimeMachineRestoreView(viewInput);

  return serviceOk(view);
}

export function getMindGalaxyEmbed(characterId: string): MindGalaxyEmbedResponse {
  const state = getOrCreateState(characterId);
  // Reuse existing galaxy artifact or create embed reference
  const embed = buildMindGalaxyEmbed({
    artifactRef: "mind-galaxy/index.html",
    nodeCount: state.clusters.size * 10 + 10,
    edgeCount: state.memories.length * 2,
  });
  return serviceOk(embed);
}
