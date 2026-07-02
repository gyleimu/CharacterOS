/**
 * V12.1 — Agent SDK DTO Types
 *
 * Stable data contracts for the Character Agent SDK.
 * No LLM execution. No raw state exposure. No multi-character.
 * Read-only by default. Writeback requires explicit policy + audit.
 */
import type { EventStudioDraft, CharacterStateSurface, ExplainabilityTimeline, RealityAuditPanel, TimeMachineRestoreView } from "../explorer/explorerTypes";

// ── Agent Session ─────────────────────────────────────────────────────────

export type InputMode = "chat" | "journal" | "story" | "plugin" | "tool";
export type WritebackPolicy = "never" | "preview_only" | "auto_apply_safe_events" | "require_user_confirmation";
export type SafetyMode = "strict" | "normal" | "research";
export type LLMMode = "disabled" | "planned_boundary_only";

export interface AgentSessionConfig {
  sessionId: string;
  characterId: string;
  inputMode: InputMode;
  writebackPolicy: WritebackPolicy;
  safetyMode: SafetyMode;
  llmMode: LLMMode;
  createdAtPolicy: "deterministic_timestamp" | "runtime";
  readOnlyDefault: true;
  noMultiCharacter: true;
  noDiagnosis: true;
}

// ── Agent Turn ────────────────────────────────────────────────────────────

export interface AgentTurnInput {
  turnId: string;
  sessionId: string;
  inputMode: InputMode;
  content: string;
  occurredAt: string;
  speakerLabel: string;
  sourceRef: string;
  metadata: Record<string, string>;
  consentForWriteback: boolean;
  userConfirmation?: string;
}

// ── Event Candidate ───────────────────────────────────────────────────────

export type ExtractionMethod = "deterministic" | "llm_proposed" | "manual";

export interface AgentEventCandidate {
  candidateId: string;
  draft: EventStudioDraft;
  extractionMethod: ExtractionMethod;
  confidence: number;
  relevance: number;
  safetyFlags: string[];
  requiresPreview: true;
}

// ── Policy Decision ───────────────────────────────────────────────────────

export type PolicyAction = "block" | "preview_only" | "apply_allowed" | "confirmation_required";

export interface AgentPolicyDecision {
  decision: PolicyAction;
  reasons: string[];
  warnings: string[];
  requiredConfirmation?: string;
  writebackAllowed: boolean;
  safetyLevel: "safe" | "caution" | "unsafe";
  auditRequired: boolean;
}

// ── Grounding Bundle ──────────────────────────────────────────────────────

export interface AgentGroundingBundle {
  characterStateSurface: CharacterStateSurface;
  explainabilityTimeline?: ExplainabilityTimeline;
  realityAuditPanel?: RealityAuditPanel;
  timeMachineRefs: string[];
  evidenceRefs: Array<{ source: string; excerpt: string }>;
  omittedRawState: true;
}

// ── Reply Plan ────────────────────────────────────────────────────────────

export interface AgentReplyPlan {
  replyPlanId: string;
  tone: string;
  intent: string;
  groundedFacts: string[];
  uncertaintyNotes: string[];
  safetyNotices: string[];
  suggestedResponseOutline: string[];
  llmAllowed: boolean;
  llmBoundaryInstructions?: string;
  noStateMutation: true;
}

// ── Writeback Plan ────────────────────────────────────────────────────────

export type WritebackStatus = "none" | "preview_pending" | "confirmation_pending" | "ready_for_apply" | "applied" | "blocked";

export interface AgentWritebackPlan {
  writebackId: string;
  policy: WritebackPolicy;
  candidates: AgentEventCandidate[];
  selectedCandidateId?: string;
  previewRequired: boolean;
  applyRequiresConfirmation: boolean;
  auditTrailRequired: boolean;
  status: WritebackStatus;
}

// ── Turn Result ───────────────────────────────────────────────────────────

export interface AgentTurnResult {
  turnId: string;
  sessionId: string;
  normalizedInput: string;
  eventCandidates: AgentEventCandidate[];
  policyDecision: AgentPolicyDecision;
  groundingBundle: AgentGroundingBundle;
  replyPlan: AgentReplyPlan;
  writebackPlan: AgentWritebackPlan;
  safetyNotices: AgentSafetyNotice[];
  noMutation: boolean;
  auditRefs: string[];
}

// ── Safety Notice ─────────────────────────────────────────────────────────

export interface AgentSafetyNotice {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  appliesTo: string;
  recoverable: boolean;
}

// ── V12.6: Reply Intent / Tone ───────────────────────────────────────────

export type ReplyIntent =
  | "explain_state" | "preview_event" | "ask_confirmation"
  | "refuse_unsafe" | "summarize_history" | "neutral_ack" | "clarify_input";

export type ReplyTone =
  | "calm" | "concise" | "reflective" | "cautious" | "technical" | "safety_first";

// ── V12.2: Raw Input Types ───────────────────────────────────────────────

export interface ChatRawInput {
  type: "chat";
  message: string;
  speakerLabel?: string;
  occurredAt?: string;
  sourceRef?: string;
  metadata?: Record<string, string>;
}

export interface JournalRawInput {
  type: "journal";
  entry: string;
  occurredAt?: string;
  mood?: string;
  location?: string;
  tags?: string[];
  sourceRef?: string;
}

export interface StoryRawInput {
  type: "story";
  sceneText: string;
  narrator?: string;
  occurredAt?: string;
  chapterId?: string;
  sourceRef?: string;
}

export interface PluginRawInput {
  type: "plugin";
  pluginId: string;
  payload: unknown;
  occurredAt?: string;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolRawInput {
  type: "tool";
  toolName: string;
  result: string;
  occurredAt?: string;
  sourceRef?: string;
  metadata?: Record<string, string>;
}

export type RawAgentInput = ChatRawInput | JournalRawInput | StoryRawInput | PluginRawInput | ToolRawInput;

// ── Validation ───────────────────────────────────────────────────────────

export interface AgentInputValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}
