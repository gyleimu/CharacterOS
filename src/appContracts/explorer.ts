/**
 * V11.8 — Explorer Service Contracts
 *
 * Structured service-level types for the Explorer API boundary.
 * No UI. No chat. No multi-character. No medical language.
 */
import type {
  ExplorerManifest, CharacterStateSurface, EventStudioPreview, EventStudioDraft,
  EventStudioApplyResult, ExplainabilityTimeline, TimeMachineSnapshot,
  TimeMachineTimeline, TimeMachineRestoreView, MindGalaxyEmbed,
} from "../core/explorer/explorerTypes";

// ── Service Error ──

export interface ExplorerServiceError {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
  recoverable: boolean;
}

// ── Service Responses ──

export interface ExplorerServiceResponse<T> {
  success: boolean;
  data: T | null;
  error: ExplorerServiceError | null;
  writeRequiresConfirmation: boolean;
  safetyNote: string;
}

export interface ExplorerManifestResponse extends ExplorerServiceResponse<ExplorerManifest> {}
export interface CharacterStateSurfaceResponse extends ExplorerServiceResponse<CharacterStateSurface> {}
export interface EventStudioPreviewResponse extends ExplorerServiceResponse<EventStudioPreview> {}
export interface EventStudioApplyResponse extends ExplorerServiceResponse<EventStudioApplyResult> {}
export interface ExplainabilityTimelineResponse extends ExplorerServiceResponse<ExplainabilityTimeline> {}
export interface TimeMachineSnapshotResponse extends ExplorerServiceResponse<TimeMachineSnapshot> {}
export interface TimeMachineTimelineResponse extends ExplorerServiceResponse<TimeMachineTimeline> {}
export interface TimeMachineRestoreViewResponse extends ExplorerServiceResponse<TimeMachineRestoreView> {}
export interface MindGalaxyEmbedResponse extends ExplorerServiceResponse<MindGalaxyEmbed> {}

// ── Helpers ──

export function serviceOk<T>(data: T): ExplorerServiceResponse<T> {
  return {
    success: true,
    data,
    error: null,
    writeRequiresConfirmation: false,
    safetyNote: "CharacterOS Explorer — 模拟系统输出，非医学诊断。",
  };
}

export function serviceOkWrite<T>(data: T): ExplorerServiceResponse<T> {
  return {
    success: true,
    data,
    error: null,
    writeRequiresConfirmation: true,
    safetyNote: "CharacterOS Explorer — 模拟系统输出，非医学诊断。写入操作已记录审计。",
  };
}

export function serviceError<T>(
  code: string, message: string, severity: "info" | "warn" | "error" = "error", recoverable = true,
): ExplorerServiceResponse<T> {
  return {
    success: false,
    data: null,
    error: { code, message, severity, recoverable },
    writeRequiresConfirmation: false,
    safetyNote: "CharacterOS Explorer — 模拟系统输出，非医学诊断。",
  };
}
