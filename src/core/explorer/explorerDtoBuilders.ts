/**
 * V11.1 — Explorer DTO Builders
 *
 * Pure, deterministic functions that build Explorer DTOs from V10 core state.
 * All builders are read-only — they never mutate CharacterPhysicsState.
 * No LLM. No UI. No API routes. No multi-character.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { buildCharacterStateSurface } from "./characterStateSurface";
import type { RealityAuditResult } from "../audit/realityAudit";
import { DETERMINISTIC_TIMESTAMP } from "../deterministicHelpers";
import type {
  ExplorerManifest,
  EventStudioDraft,
  EventStudioPreview,
  CharacterStateSurface,
  EmotionalStateSummary,
  StressStateSummary,
  NeedSummary,
  BeliefSummary,
  GoalSummary,
  BehaviorTendencySummary,
  PersonalitySummary,
  ExplainabilityTimeline,
  MindGalaxyEmbed,
  RealityAuditPanel,
  TimeMachineSnapshot,
  TimeMachineTimeline,
  ParsedEventSummary,
  ImpactPreview,
  MemoryPreview,
  BeliefPreview as BeliefPreviewType,
  NeedPreview as NeedPreviewType,
  PersonalityDeltaPreview,
  DecisionPreview,
  RealityAuditPreview,
  CausalStep,
  StateDiffSummary,
  EvidenceRef,
} from "./explorerTypes";

// ── Manifest ───────────────────────────────────────────────────────────────

export function buildExplorerManifest(characterId: string): ExplorerManifest {
  return {
    version: "11.1.0",
    characterId,
    generatedAtPolicy: "deterministic_timestamp",
    readOnlyDefault: true,
    modules: summarizeExplorerModules(),
    safetyDisclaimers: [
      "这是人格模拟系统的输出，不是医学诊断。",
      "所有状态均为模拟结果，不应作为临床决策依据。",
      "本系统不提供心理健康评估、治疗建议或危机干预。",
      "如有真实心理困扰，请寻求专业帮助。",
    ],
    releaseBoundary: {
      singleCharacterOnly: true,
      noChatAgent: true,
      noMultiCharacter: true,
      noAutonomousScheduler: true,
      noServerDeployment: true,
      noMobile: true,
      noMedicalDiagnosis: true,
      noUserAccounts: true,
    },
  };
}

export function summarizeExplorerModules(): ExplorerManifest["modules"] {
  return [
    { moduleId: "event_studio", label: "Event Studio — 事件工坊", readOnly: false, requiresConfirmation: true, status: "planned" },
    { moduleId: "character_state", label: "Character State — 当前状态", readOnly: true, requiresConfirmation: false, status: "planned" },
    { moduleId: "explainability", label: "Explainability — 变化溯源", readOnly: true, requiresConfirmation: false, status: "planned" },
    { moduleId: "mind_galaxy", label: "Mind Galaxy — 高级星云视图", readOnly: true, requiresConfirmation: false, status: "planned" },
    { moduleId: "reality_audit", label: "Reality Audit — 安全审计", readOnly: true, requiresConfirmation: false, status: "planned" },
    { moduleId: "time_machine", label: "Time Machine — 时间回溯", readOnly: true, requiresConfirmation: true, status: "planned" },
  ];
}

// ── Event Studio ───────────────────────────────────────────────────────────

export function buildEventStudioDraft(overrides: Partial<EventStudioDraft> = {}): EventStudioDraft {
  return {
    naturalLanguageInput: overrides.naturalLanguageInput ?? "",
    occurredAt: overrides.occurredAt ?? DETERMINISTIC_TIMESTAMP,
    location: overrides.location ?? "",
    people: overrides.people ?? [],
    intensity: clamp01(overrides.intensity ?? 0.5),
    repetitionCount: Math.max(1, overrides.repetitionCount ?? 1),
    sourceType: overrides.sourceType ?? "user_input",
    sourceId: overrides.sourceId ?? "",
    tags: overrides.tags ?? [],
    status: overrides.status ?? "draft",
  };
}

export function buildEventStudioPreview(params: {
  draftId: string;
  parsed: ParsedEventSummary;
  impact: ImpactPreview;
  memory: MemoryPreview;
  belief: BeliefPreviewType;
  need: NeedPreviewType;
  personality: PersonalityDeltaPreview;
  decision: DecisionPreview;
  auditWarnings: string[];
  requiresConfirmation?: boolean;
}): EventStudioPreview {
  return {
    draftId: params.draftId,
    parsedEvent: params.parsed,
    impactPreview: params.impact,
    memoryPreview: params.memory,
    beliefPreview: params.belief,
    needPreview: params.need,
    personalityPreview: params.personality,
    decisionPreview: params.decision,
    realityAuditPreview: {
      expectedVerdict: params.auditWarnings.length > 0 ? "WARN" : "PASS",
      preflightWarnings: params.auditWarnings,
    },
    warnings: params.auditWarnings,
    requiresConfirmation: params.requiresConfirmation ?? true,
  };
}

// ── Character State ────────────────────────────────────────────────────────

export function buildCharacterStateSurfaceFromState(
  state: CharacterPhysicsState,
): CharacterStateSurface {
  // V11.4: delegate to full surface module
  return buildCharacterStateSurface({ state });
}

function buildEmotionalSummary(state: CharacterPhysicsState): EmotionalStateSummary {
  // Fallback: use personality coordinate as proxy when no emotion step is available
  const fear = state.coordinate.values.fear;
  const trust = state.coordinate.values.trust;
  const neuroticism = state.coordinate.values.neuroticism;

  let primary = "uncertainty";
  let valence: EmotionalStateSummary["valence"] = "neutral";
  if (fear > 0.6) { primary = "fear"; valence = "negative"; }
  else if (trust > 0.6 && fear < 0.4) { primary = "calm"; valence = "positive"; }
  else if (neuroticism > 0.7) { primary = "anxiety"; valence = "negative"; }

  let arousal: EmotionalStateSummary["arousal"] = "moderate";
  if (fear > 0.7 || neuroticism > 0.8) arousal = "high";
  if (trust > 0.7 && fear < 0.3) arousal = "low";

  const labels: Record<string, string> = {
    fear: "恐惧主导", calm: "平静", anxiety: "焦虑倾向", uncertainty: "情绪中性",
  };

  return { primary, valence, arousal, label: labels[primary] ?? "情绪中性" };
}

function buildStressSummary(state: CharacterPhysicsState): StressStateSummary {
  const b = state.boundary;
  const ratio = b.capacity > 0 ? b.stressLoad / b.capacity : 1;
  return {
    level: ratio > 1 ? "overload" : ratio > 0.7 ? "high" : ratio > 0.3 ? "moderate" : "low",
    phase: b.phase,
    label: describeBoundaryPhase(b.phase),
  };
}

function buildNeedSummaries(_state: CharacterPhysicsState): NeedSummary[] {
  return []; // Needs require DerivedState — placeholder for V11.4
}

function buildBeliefSummaries(state: CharacterPhysicsState): BeliefSummary[] {
  return state.beliefStates.slice(0, 3).map((b) => ({
    content: b.content,
    strength: b.strength > 0.7 ? "strong" : b.strength > 0.3 ? "moderate" : "weak",
  }));
}

function buildGoalSummaries(_state: CharacterPhysicsState): GoalSummary[] {
  return []; // Goals require DerivedState — placeholder for V11.4
}

function buildBehaviorSummary(state: CharacterPhysicsState): BehaviorTendencySummary {
  const c = state.coordinate.values;
  return {
    likelyAction: c.fear > 0.5 ? "谨慎观察，避免主动接触" : "保持开放，可能主动探索",
    strategyLabel: c.fear > 0.6 ? "emotional_withdrawal" : c.trust > 0.5 ? "verify_before_commitment" : "cautious_approach",
    cautionLevel: c.fear > 0.6 ? "high" : c.fear > 0.3 ? "moderate" : "low",
    opennessLevel: c.openness > 0.6 ? "high" : c.openness > 0.3 ? "moderate" : "low",
  };
}

function buildPersonalitySummary(state: CharacterPhysicsState): PersonalitySummary {
  const c = state.coordinate.values;
  return {
    trust: { value: band3(c.trust), label: trustLabel(c.trust) },
    fear: { value: band3(c.fear), label: fearLabel(c.fear) },
    openness: { value: band3(c.openness), label: `开放性${bandLabel(c.openness)}` },
    attachment: { value: band3(c.attachment), label: `依恋${bandLabel(c.attachment)}` },
    neuroticism: { value: band3(c.neuroticism), label: `情绪稳定性${bandLabel(1 - c.neuroticism)}` },
  };
}

// ── Reality Audit ──────────────────────────────────────────────────────────

export function buildRealityAuditPanelFromResult(
  result: RealityAuditResult,
): RealityAuditPanel {
  return {
    auditScope: `Event: ${result.parsedEvent.description.slice(0, 60)}...`,
    verdict: result.auditVerdict.level,
    stateDiffSummary: result.auditVerdict.reasons[0] ?? "state delta produced",
    decisionDiffSummary: `${result.decisionBefore.strategy} → ${result.decisionAfter.strategy}`,
    explanationGrounding: result.explanationTrace.groundedDeltaPaths.length > 0 ? "grounded" : "ungrounded",
    warnings: result.auditVerdict.warnings,
    disclaimers: [
      "此审计结果是模拟系统内部验证，不代表外部真实性。",
      "事件影响为模型计算，不应等同于真实心理反应。",
    ],
  };
}

// ── Time Machine ───────────────────────────────────────────────────────────

export function buildTimeMachineSnapshotFromState(params: {
  state: CharacterPhysicsState;
  snapshotId: string;
  label: string;
  capturedAt: string;
  sequenceIndex: number;
  galaxyRef: string;
  auditRef: string;
}): TimeMachineSnapshot {
  return {
    snapshotId: params.snapshotId,
    characterId: params.state.identity.id,
    label: params.label,
    capturedAt: params.capturedAt,
    sequenceIndex: params.sequenceIndex,
    stateSummary: `${params.state.identity.name} at event #${params.state.memories.length}, boundary ${params.state.boundary.phase}`,
    personalitySummary: buildPersonalitySummary(params.state),
    beliefSummary: `${params.state.beliefStates.length} beliefs`,
    needSummary: "needs require DerivedState",
    memorySummary: `${params.state.memories.length} memories`,
    galaxyRef: params.galaxyRef,
    auditRef: params.auditRef,
    immutable: true,
  };
}

export function buildTimeMachineTimeline(params: {
  characterId: string;
  snapshots: TimeMachineSnapshot[];
  currentSnapshotId: string;
}): TimeMachineTimeline {
  return {
    characterId: params.characterId,
    snapshots: params.snapshots,
    currentSnapshotId: params.currentSnapshotId,
    availableRanges: [
      { label: "全部", from: params.snapshots[0]?.capturedAt ?? "", to: params.snapshots.at(-1)?.capturedAt ?? "", snapshotCount: params.snapshots.length },
    ],
    restoreMode: "view_only",
    warnings: params.snapshots.length === 0 ? ["暂无快照"] : [],
  };
}

// ── Explainability (placeholder — needs V11.5) ─────────────────────────────

export function buildExplainabilityStub(question: string): ExplainabilityTimeline {
  return {
    question,
    timeRange: { from: "", to: "", label: "" },
    causalSteps: [],
    stateDiffs: [],
    evidenceRefs: [],
    confidence: "low",
    groundingStatus: "ungrounded",
    warnings: ["无可用数据"],
  };
}

// ── Mind Galaxy (placeholder — reuses existing artifact) ───────────────────

export function buildMindGalaxyEmbed(params: {
  artifactRef: string;
  nodeCount: number;
  edgeCount: number;
}): MindGalaxyEmbed {
  return {
    mode: "advanced",
    artifactRef: params.artifactRef,
    nodeCount: params.nodeCount,
    edgeCount: params.edgeCount,
    selectedNodeId: null,
    visibleLayers: ["clusters", "forces", "trajectory"],
    safetyBoundary: {
      readOnly: true,
      researchViewOnly: true,
      disclaimer: "高级研究视图。这是模拟模型，不是临床诊断工具。",
    },
    noMutation: true,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function band3(value: number): "low" | "moderate" | "high" {
  if (value > 0.6) return "high";
  if (value > 0.3) return "moderate";
  return "low";
}

function bandLabel(value: number): string {
  if (value > 0.6) return "偏高";
  if (value > 0.3) return "适中";
  return "偏低";
}

function trustLabel(value: number): string {
  if (value < 0.3) return "信任度低，对他人持怀疑态度";
  if (value < 0.6) return "信任度中等，谨慎开放";
  return "信任度较高，愿意相信他人";
}

function fearLabel(value: number): string {
  if (value > 0.7) return "恐惧感强，常处于警觉状态";
  if (value > 0.4) return "有一定恐惧和担忧";
  return "恐惧感较低，情绪相对稳定";
}

function describeBoundaryPhase(phase: string): string {
  switch (phase) {
    case "overflow": return "心理压力超载，边界破裂";
    case "strained": return "心理压力偏高，但仍在承受范围";
    case "stable": return "心理状态稳定，压力可管理";
    default: return "心理状态未知";
  }
}
