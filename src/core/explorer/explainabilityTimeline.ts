/**
 * V11.5 — Explainability Timeline Core
 *
 * Builds structured, evidence-grounded causal timelines from recent event/audit history.
 * No LLM. No invented causes. Low confidence when insufficient evidence.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type {
  ExplainabilityTimeline,
  ExplainabilityTimelineInput,
  CausalStep,
  StateDiffSummary,
  EvidenceRef,
  TimelineFocus,
  EventStudioAuditEntry,
} from "./explorerTypes";

export function buildExplainabilityTimeline(
  input: ExplainabilityTimelineInput,
): ExplainabilityTimeline {
  const warnings: string[] = [];
  const question = input.question ?? "最近发生了什么变化？";
  const focus = input.focus;
  const timeRange = input.timeRange ?? { from: "", to: "", label: "最近" };

  const audits = input.recentAuditEntries ?? [];
  const events = input.recentEvents ?? [];

  // ── Evidence inventory ──
  const hasHistory = audits.length > 0 || events.length > 0;
  if (!hasHistory) {
    warnings.push("无最近事件历史或审计记录，无法构建因果时间线");
    warnings.push("这是模拟系统的内部解释，不是医学或心理诊断");
    return emptyTimeline(question, timeRange, focus, warnings);
  }

  if (audits.length < 1 && events.length < 2) {
    warnings.push("历史记录较少，置信度受限");
  }

  // ── Build evidence refs ──
  const evidenceRefs: EvidenceRef[] = [];

  for (const audit of audits) {
    evidenceRefs.push({
      sourceType: "audit",
      sourceId: audit.auditId,
      label: `事件应用: ${audit.parsedEventSummary.category}`,
      excerpt: audit.stateDeltaSummary,
      confidence: 0.9,
    });
    evidenceRefs.push({
      sourceType: "reality_audit",
      sourceId: `${audit.auditId}_reality`,
      label: `审计判定: ${audit.realityAuditVerdict}`,
      excerpt: audit.warnings.join("; ") || "无警告",
      confidence: 1.0,
    });
  }

  for (const event of events.slice(0, 10)) {
    evidenceRefs.push({
      sourceType: "event",
      sourceId: `event_${event.occurredAt}`,
      label: event.description.slice(0, 60),
      excerpt: event.description,
      confidence: 0.7,
    });
  }

  // ── Build causal steps from audit history ──
  const causalSteps: CausalStep[] = [];
  let stepCounter = 0;

  for (const audit of audits) {
    // Event step
    causalSteps.push(makeStep(stepCounter++, "event", "事件发生",
      `${audit.parsedEventSummary.category} 事件: 强度 ${audit.parsedEventSummary.intensity.toFixed(2)}`,
      audit.auditId, audit.appliedAt,
      "triggered", audit.parsedEventSummary.intensity > 0.6 ? "high" : "moderate", 0.9));

    // Memory step
    causalSteps.push(makeStep(stepCounter++, "memory", "记忆形成",
      `新记忆: ${audit.parsedEventSummary.category} 经历`,
      audit.auditId, audit.appliedAt,
      "triggered", "moderate", 0.85));

    // Belief step (if beliefs changed)
    if (audit.stateDeltaSummary && audit.stateDeltaSummary.length > 10) {
      causalSteps.push(makeStep(stepCounter++, "belief", "信念调整",
        audit.stateDeltaSummary,
        audit.auditId, audit.appliedAt,
        audit.parsedEventSummary.category === "support" || audit.parsedEventSummary.category === "success" ? "increased" : "decreased",
        "moderate", 0.7));
    }

    // State delta step
    causalSteps.push(makeStep(stepCounter++, "personality", "状态变化",
      `trust/fear/boundary delta: ${audit.stateDeltaSummary}`,
      audit.auditId, audit.appliedAt,
      audit.parsedEventSummary.category === "abandonment" || audit.parsedEventSummary.category === "betrayal" ? "decreased" : "increased",
      "low", 0.65));
  }

  // ── Add surface-derived steps ──
  const surface = input.stateSurface;

  // Current stress state
  causalSteps.push(makeStep(stepCounter++, "boundary", "当前边界状态",
    `${surface.stressState.label} (${surface.stressState.phase})`,
    "current_surface", new Date().toISOString(),
    surface.stressState.level === "overload" ? "triggered" : "stabilized",
    surface.stressState.level === "high" || surface.stressState.level === "overload" ? "high" : "moderate", 0.8));

  // Current emotional state
  causalSteps.push(makeStep(stepCounter++, "boundary", "当前情绪状态",
    surface.emotionalState.label,
    "current_surface", new Date().toISOString(),
    surface.emotionalState.valence === "negative" ? "decreased" : "stabilized",
    "moderate", 0.75));

  // ── Build state diffs ──
  const stateDiffs: StateDiffSummary[] = [];

  if (surface.personalitySummary.trust.value === "low") {
    stateDiffs.push({
      path: "personality.trust", beforeBand: "基线", afterBand: "低",
      direction: "降低", sourceStepIds: causalSteps.filter((s) => s.type === "event" || s.type === "belief").map((s) => s.stepId),
    });
  }
  if (surface.personalitySummary.fear.value === "high") {
    stateDiffs.push({
      path: "personality.fear", beforeBand: "基线", afterBand: "高",
      direction: "升高", sourceStepIds: causalSteps.filter((s) => s.type === "event").map((s) => s.stepId),
    });
  }
  stateDiffs.push({
    path: "boundary.phase", beforeBand: "基线", afterBand: surface.stressState.phase,
    direction: surface.stressState.phase === "overflow" ? "恶化" : surface.stressState.phase === "stable" ? "恢复" : "承压",
    sourceStepIds: causalSteps.filter((s) => s.type === "boundary").map((s) => s.stepId),
  });

  // ── Focus filtering ──
  const filteredSteps = focus
    ? filterByFocus(causalSteps, focus)
    : causalSteps;

  const filteredDiffs = focus
    ? stateDiffs.filter((d) => d.path.includes(mapFocusToPath(focus)))
    : stateDiffs;

  // ── Grounding assessment ──
  const groundedSteps = filteredSteps.filter((s) => s.grounded);
  const groundingRatio = filteredSteps.length > 0 ? groundedSteps.length / filteredSteps.length : 0;

  let groundingStatus: ExplainabilityTimeline["groundingStatus"];
  let confidence: ExplainabilityTimeline["confidence"];

  if (!hasHistory) {
    groundingStatus = "ungrounded";
    confidence = "low";
  } else if (groundingRatio > 0.7) {
    groundingStatus = "grounded";
    confidence = "high";
  } else if (groundingRatio > 0.3) {
    groundingStatus = "partially_grounded";
    confidence = "moderate";
    warnings.push("部分因果步骤缺乏直接证据支撑");
  } else {
    groundingStatus = "ungrounded";
    confidence = "low";
    warnings.push("大部分因果步骤无法确认直接因果关系");
  }

  warnings.push("这是模拟系统的内部解释，不是医学或心理诊断");

  const result: ExplainabilityTimeline = {
    question,
    timeRange,
    causalSteps: filteredSteps,
    stateDiffs: filteredDiffs,
    evidenceRefs,
    confidence,
    groundingStatus,
    warnings,
  };
  if (focus) result.focus = focus;
  return result;
}

// ── Helpers ──

function makeStep(
  id: number, type: CausalStep["type"], label: string, summary: string,
  sourceRef: string, occurredAt: string,
  direction: CausalStep["direction"], magnitude: CausalStep["magnitudeBand"], confidence: number,
): CausalStep {
  return {
    stepId: `step_${id}`,
    type, label, summary, sourceRef, occurredAt, direction,
    magnitudeBand: magnitude, confidence, grounded: sourceRef !== "current_surface",
  };
}

function emptyTimeline(
  question: string, timeRange: ExplainabilityTimeline["timeRange"],
  _focus: TimelineFocus | undefined, warnings: string[],
): ExplainabilityTimeline {
  const result: ExplainabilityTimeline = {
    question, timeRange,
    causalSteps: [], stateDiffs: [], evidenceRefs: [],
    confidence: "low", groundingStatus: "ungrounded", warnings,
  };
  if (_focus) result.focus = _focus;
  return result;
}

function filterByFocus(steps: CausalStep[], focus: TimelineFocus): CausalStep[] {
  const typeMap: Record<TimelineFocus, CausalStep["type"][]> = {
    emotion: ["event", "memory", "boundary"],
    belief: ["event", "belief"],
    need: ["event", "need"],
    desire: ["event", "desire"],
    personality: ["event", "personality", "belief"],
    decision: ["event", "decision"],
    stress: ["event", "boundary"],
  };
  const allowed = typeMap[focus] ?? [];
  return steps.filter((s) => allowed.includes(s.type));
}

function mapFocusToPath(focus: TimelineFocus): string {
  const pathMap: Record<TimelineFocus, string> = {
    emotion: "emotion", belief: "belief", need: "need", desire: "desire",
    personality: "personality", decision: "decision", stress: "boundary",
  };
  return pathMap[focus] ?? focus;
}
