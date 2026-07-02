/**
 * V12.8 — Agent SDK Service Contracts
 *
 * Request/response types for future API routes. No HTTP routes yet.
 */
import type {
  AgentSessionConfig, AgentTurnInput, AgentTurnResult,
  AgentEventCandidate, AgentPolicyDecision, AgentWritebackPlan,
} from "../core/agent/agentTypes";
import type { EventStudioPreview, EventStudioApplyResult } from "../core/explorer/explorerTypes";

// ── Service-level error ──

export interface AgentSdkError {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
  recoverable: boolean;
}

export interface AgentSdkResponse<T> {
  success: boolean;
  data: T | null;
  error: AgentSdkError | null;
  noMutation: boolean;
  safetyNote: string;
}

// ── Turn pipeline ──

export interface ProcessTurnRequest {
  sessionConfig?: Partial<AgentSessionConfig>;
  rawInput: Record<string, unknown>;
  previewEvents?: boolean;
}

export interface ProcessTurnResponse extends AgentSdkResponse<AgentTurnResult> {}

// ── Preview ──

export interface PreviewTurnEventsResponse extends AgentSdkResponse<{
  candidates: AgentEventCandidate[];
  previews: EventStudioPreview[];
  policyDecision: AgentPolicyDecision;
}> {}

// ── Writeback ──

export interface PrepareWritebackResponse extends AgentSdkResponse<{
  writebackPlan: AgentWritebackPlan;
  ready: boolean;
}> {}

export interface ApplyWritebackRequest {
  sessionConfig: AgentSessionConfig;
  turnResult: AgentTurnResult;
  selectedCandidateIndex?: number;
  confirmation: string;
  allowMutation?: boolean;
}

export interface ApplyWritebackResponse extends AgentSdkResponse<EventStudioApplyResult> {}

// ── Helpers ──

export function agentSdkOk<T>(data: T): AgentSdkResponse<T> {
  return { success: true, data, error: null, noMutation: true, safetyNote: "CharacterOS Agent SDK — 模拟系统输出，非医学诊断。" };
}

export function agentSdkWrite<T>(data: T): AgentSdkResponse<T> {
  return { success: true, data, error: null, noMutation: false, safetyNote: "CharacterOS Agent SDK — 写入已执行，审计记录已生成。" };
}

export function agentSdkError<T>(code: string, message: string, severity: "info" | "warn" | "error" = "error"): AgentSdkResponse<T> {
  return { success: false, data: null, error: { code, message, severity, recoverable: severity !== "error" }, noMutation: true, safetyNote: "CharacterOS Agent SDK — 模拟系统输出，非医学诊断。" };
}
