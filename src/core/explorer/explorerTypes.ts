/**
 * V11.1 — Explorer DTO Types
 *
 * Stable, read-only-first data contracts for CharacterOS Explorer's six modules.
 * No UI. No API routes. No core behavior changes. No LLM. No multi-character.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ── Explorer Manifest ──────────────────────────────────────────────────────

export interface ExplorerManifest {
  version: string;
  characterId: string;
  generatedAtPolicy: "deterministic_timestamp" | "runtime";
  readOnlyDefault: true;
  modules: ExplorerModuleDescriptor[];
  safetyDisclaimers: string[];
  releaseBoundary: ExplorerReleaseBoundary;
}

export interface ExplorerModuleDescriptor {
  moduleId: "event_studio" | "character_state" | "explainability" | "mind_galaxy" | "reality_audit" | "time_machine";
  label: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
  status: "active" | "planned";
}

export interface ExplorerReleaseBoundary {
  singleCharacterOnly: true;
  noChatAgent: true;
  noMultiCharacter: true;
  noAutonomousScheduler: true;
  noServerDeployment: true;
  noMobile: true;
  noMedicalDiagnosis: true;
  noUserAccounts: true;
}

// ── Event Studio ───────────────────────────────────────────────────────────

export type EventStudioStatus = "draft" | "parsed" | "previewed" | "applied" | "rejected";

export interface EventStudioDraft {
  naturalLanguageInput: string;
  occurredAt: string;
  location: string;
  people: string[];
  intensity: number;        // 0–1, clamped
  repetitionCount: number;  // ≥1, clamped
  sourceType: "user_input" | "import" | "script";
  sourceId: string;
  tags: string[];
  status: EventStudioStatus;
}

export interface EventStudioPreview {
  draftId: string;
  parsedEvent: ParsedEventSummary;
  impactPreview: ImpactPreview;
  memoryPreview: MemoryPreview;
  beliefPreview: BeliefPreview;
  needPreview: NeedPreview;
  personalityPreview: PersonalityDeltaPreview;
  decisionPreview: DecisionPreview;
  realityAuditPreview: RealityAuditPreview;
  warnings: string[];
  requiresConfirmation: boolean;
}

export interface ParsedEventSummary {
  category: string;
  emotion: string;
  intensity: number;
  importance: number;
  parserConfidence: number;
}

export interface ImpactPreview {
  expectedMemoryImpact: "low" | "moderate" | "high";
  expectedBoundaryImpact: "low" | "moderate" | "high";
  expectedBeliefImpact: "low" | "moderate" | "high";
  expectedPersonalityImpact: "minimal" | "subtle" | "visible";
}

export interface MemoryPreview {
  willCreateMemory: boolean;
  estimatedSalience: "low" | "moderate" | "high";
  relatedExistingMemories: number;
}

export interface BeliefPreview {
  likelyNewBelief: string | null;
  likelyStrengthenedBeliefs: string[];
  likelyWeakenedBeliefs: string[];
}

export interface NeedPreview {
  likelyActivatedNeeds: string[];
  likelyDeactivatedNeeds: string[];
}

export interface PersonalityDeltaPreview {
  direction: string;
  affectedDimensions: string[];
  estimatedMagnitude: "minimal" | "subtle" | "visible";
}

export interface DecisionPreview {
  likelyStrategyShift: string;
  likelyActionChange: string;
}

export interface RealityAuditPreview {
  expectedVerdict: "PASS" | "WARN" | "FAIL";
  preflightWarnings: string[];
}

// ── Character State ────────────────────────────────────────────────────────

export interface CharacterStateSurface {
  headline: string;
  characterId: string;
  characterName: string;
  emotionalState: EmotionalStateSummary;
  stressState: StressStateSummary;
  dominantNeeds: NeedSummary[];
  dominantBeliefs: BeliefSummary[];
  activeGoals: GoalSummary[];
  behaviorTendencies: BehaviorTendencySummary;
  personalitySummary: PersonalitySummary;
  safetyNote: string;
  sourceSnapshotId: string;
}

export interface EmotionalStateSummary {
  primary: string;
  valence: "positive" | "neutral" | "negative";
  arousal: "low" | "moderate" | "high";
  label: string;  // e.g. "轻度焦虑"
}

export interface StressStateSummary {
  level: "low" | "moderate" | "high" | "overload";
  phase: "stable" | "strained" | "overflow";
  label: string;  // e.g. "压力偏高，但仍在承受范围"
}

export interface NeedSummary {
  name: string;
  intensity: "low" | "moderate" | "high";
  label: string;
}

export interface BeliefSummary {
  content: string;
  strength: "weak" | "moderate" | "strong";
}

export interface GoalSummary {
  content: string;
  urgency: "low" | "moderate" | "high";
}

export interface BehaviorTendencySummary {
  likelyAction: string;
  strategyLabel: string;
  cautionLevel: "low" | "moderate" | "high";
  opennessLevel: "low" | "moderate" | "high";
}

export interface PersonalitySummary {
  trust: { value: "low" | "moderate" | "high"; label: string };
  fear: { value: "low" | "moderate" | "high"; label: string };
  openness: { value: "low" | "moderate" | "high"; label: string };
  attachment: { value: "low" | "moderate" | "high"; label: string };
  neuroticism: { value: "low" | "moderate" | "high"; label: string };
}

// ── Explainability ─────────────────────────────────────────────────────────

export type TimelineFocus = "emotion" | "belief" | "need" | "desire" | "personality" | "decision" | "stress";
export type CausalStepType = "event" | "memory" | "belief" | "need" | "desire" | "personality" | "boundary" | "decision";

export interface ExplainabilityTimeline {
  question: string;
  timeRange: { from: string; to: string; label: string };
  focus?: TimelineFocus;
  causalSteps: CausalStep[];
  stateDiffs: StateDiffSummary[];
  evidenceRefs: EvidenceRef[];
  confidence: "high" | "moderate" | "low";
  groundingStatus: "grounded" | "partially_grounded" | "ungrounded";
  warnings: string[];
}

export interface CausalStep {
  stepId: string;
  type: CausalStepType;
  label: string;
  summary: string;
  sourceRef: string;
  occurredAt: string;
  direction: "increased" | "decreased" | "stabilized" | "triggered";
  magnitudeBand: "high" | "moderate" | "low";
  confidence: number;
  grounded: boolean;
}

export interface StateDiffSummary {
  path: string;
  beforeBand: string;
  afterBand: string;
  direction: string;
  sourceStepIds: string[];
}

export interface EvidenceRef {
  sourceType: "event" | "memory" | "audit" | "reality_audit" | "gate";
  sourceId: string;
  label: string;
  excerpt: string;
  confidence: number;
}

// ── Mind Galaxy ────────────────────────────────────────────────────────────

export interface MindGalaxyEmbed {
  mode: "advanced";
  artifactRef: string;
  nodeCount: number;
  edgeCount: number;
  selectedNodeId: string | null;
  visibleLayers: string[];
  safetyBoundary: MindGalaxySafetyBoundary;
  noMutation: true;
}

export interface MindGalaxySafetyBoundary {
  readOnly: true;
  researchViewOnly: true;
  disclaimer: string;
}

// ── Reality Audit ──────────────────────────────────────────────────────────

export interface RealityAuditPanel {
  auditScope: string;
  verdict: "PASS" | "WARN" | "FAIL";
  stateDiffSummary: string;
  decisionDiffSummary: string;
  explanationGrounding: "grounded" | "partial" | "ungrounded";
  warnings: string[];
  disclaimers: string[];
}

// ── Time Machine ───────────────────────────────────────────────────────────

export interface TimeMachineSnapshot {
  snapshotId: string;
  characterId: string;
  label: string;
  capturedAt: string;
  sequenceIndex: number;
  stateSummary: string;
  personalitySummary: PersonalitySummary;
  beliefSummary: string;
  needSummary: string;
  memorySummary: string;
  galaxyRef: string;
  auditRef: string;
  immutable: true;
}

export interface TimeMachineTimeline {
  characterId: string;
  snapshots: TimeMachineSnapshot[];
  currentSnapshotId: string;
  availableRanges: TimeMachineRange[];
  restoreMode: "view_only" | "rollback_requires_confirmation";
  warnings: string[];
}

export interface TimeMachineRange {
  label: string;
  from: string;
  to: string;
  snapshotCount: number;
}

// ── V11.7: Time Machine Restore View ────────────────────────────────────

export interface TimeMachineRestoreView {
  restoreViewId: string;
  snapshotId: string;
  characterId: string;
  label: string;
  capturedAt: string;
  isHistoricalView: true;
  isCurrentSnapshot: boolean;
  restoreMode: "view_only" | "rollback_requires_confirmation";
  stateSummary: string;
  personalitySummary: PersonalitySummary;
  beliefSummary: string;
  needSummary: string;
  memorySummary: string;
  mindGalaxyRef: string | null;
  realityAuditRef: string | null;
  diffFromCurrent: QualitativeDiff | null;
  warnings: string[];
  safetyBanner: string[];
  noMutation: true;
}

export interface QualitativeDiff {
  hasChanged: boolean;
  changes: QualitativeChange[];
}

export interface QualitativeChange {
  dimension: string;
  direction: "increased" | "decreased" | "changed" | "unchanged";
  summary: string;
}

// ── V11.5: Explainability Input ───────────────────────────────────────────

export interface ExplainabilityTimelineInput {
  question?: string;
  timeRange?: { from: string; to: string; label: string };
  focus?: TimelineFocus;
  recentAuditEntries?: EventStudioAuditEntry[];
  recentEvents?: Array<{ description: string; category?: string; occurredAt: string }>;
  state: CharacterPhysicsState;
  stateSurface: CharacterStateSurface;
}

// ── V11.3: Event Studio Apply ─────────────────────────────────────────────

export interface EventStudioApplyOptions {
  /** Require explicit confirmation phrase (default: "apply"). */
  confirmationPhrase?: string;
  /** Allow mutation of the input state directly (default: false — clone and return). */
  allowMutation?: boolean;
  /** Override Reality Audit FAIL block (default: false). */
  overrideAuditFail?: boolean;
  /** Deterministic audit ID seed. */
  auditSeed?: string;
}

export interface EventStudioApplyInput {
  baselineState: CharacterPhysicsState;
  draft: EventStudioDraft;
  preview: EventStudioPreview;
  confirmation: string;
  applyReason: string;
  actorId: string;
  options?: EventStudioApplyOptions;
}

export interface EventStudioAuditEntry {
  auditId: string;
  eventDraftId: string;
  sourceId: string;
  actorId: string;
  applyReason: string;
  appliedAt: string;
  beforeFingerprint: string;
  afterFingerprint: string;
  parsedEventSummary: ParsedEventSummary;
  stateDeltaSummary: string;
  realityAuditVerdict: string;
  confirmationProvided: boolean;
  rollbackReference: string;
  warnings: string[];
}

export interface EventStudioApplyResult {
  applied: boolean;
  blockedReason: string | null;
  beforeFingerprint: string;
  afterFingerprint: string | null;
  parsedEvent: ParsedEventSummary;
  appliedMemoryId: string | null;
  stateDeltaSummary: string;
  realityAuditVerdict: string;
  warnings: string[];
  auditEntry: EventStudioAuditEntry | null;
  rollbackReference: string | null;
  nextRequiredAction: string;
}
