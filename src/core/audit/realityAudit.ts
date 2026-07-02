import { deriveNeedDeficiencies, type NeedDeficiency } from "../need/needDeficiency";
import { deriveDesires, type DesireState } from "../desire/desireState";
import { parseExperienceEvent, type ParsedExperienceEvent, type ParseExperienceEventInput } from "../event/eventParser";
import { CharacterPhysicsEngine, createCharacterPhysicsState, type CharacterPhysicsState, type PhysicsStepResult } from "../physics/physicsEngine";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../physics/serialization";
import { coordinateDistance, coordinateToRecord, neutralCoordinate, type PersonalityCoordinateValues } from "../personality/coordinate";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../character/characterBlueprint";
import { buildDifferentiatedDecisionForState } from "../differentiation/differentiationAdapter";
import type { DifferentiatedDecision, EnvironmentSeed } from "../differentiation/characterDifferentiation";
import { buildDecisionInfluenceLayer, type DecisionInfluenceLayerResult } from "../differentiation/decisionInfluenceLayer";
import { runImpactCalibrationAudit, type ImpactCalibrationAuditResult } from "./impactCalibrationAudit";
import type { BeliefState } from "../belief/beliefState";
import type { MemoryNode } from "../memory/memoryNode";

export type RealityAuditVerdictLevel = "PASS" | "WARN" | "FAIL";
export type RealityAuditCaseKind =
  | "same_character_before_after"
  | "counterfactual_event"
  | "same_event_different_personality";

export interface RealityAuditStateSummary {
  characterId: string;
  memoryCount: number;
  beliefCount: number;
  coordinate: PersonalityCoordinateValues;
  topBelief?: string;
  topNeed?: string;
  topDesire?: string;
  boundaryPhase: string;
  boundaryStressLoad: number;
}

export interface RealityAuditDecisionSummary {
  action: string;
  confidence: number;
  strategy: string;
  strategyId: string;
  direction: string;
  topSchema?: string;
  topNeed?: string;
  topDesire?: string;
  supportingBeliefIds: string[];
  supportingNeedIds: string[];
  supportingDesireIds: string[];
  actionCandidates: Array<{
    id: string;
    label: string;
    score: number;
    rank: number;
    strategyTag: string;
    riskProfile: string;
    approachStyle: string;
  }>;
}

export interface RealityAuditScalarDelta {
  id: string;
  before?: number;
  after?: number;
  delta: number;
}

export interface RealityAuditTextDelta {
  id: string;
  before?: string;
  after?: string;
  delta: "added" | "removed" | "changed";
}

export interface RealityAuditExplanationFact {
  id: string;
  label: string;
  sourceDeltaPath: string;
  value: string | number;
}

export interface RealityAuditExplanationTrace {
  id: string;
  scope: "reality_audit";
  summary: string;
  facts: RealityAuditExplanationFact[];
  reasons: string[];
  groundedDeltaPaths: string[];
}

export interface RealityAuditDecisionResponsiveness {
  candidateScoreChanged: boolean;
  topCandidateChanged: boolean;
  strategyDistributionChanged: boolean;
  influenceTraceGrounded: boolean;
  responsivenessScore: number;
  overreactionScore: number;
  verdict: "PASS" | "PASS_WITH_STABLE_TOP_DECISION" | "WARN" | "FAIL";
  reasons: string[];
  warnings: string[];
  failures: string[];
}

export interface RealityAuditVerdict {
  level: RealityAuditVerdictLevel;
  passed: boolean;
  warnings: string[];
  failures: string[];
  reasons: string[];
}

export interface RealityAuditRunnerInput {
  id: string;
  label: string;
  baselineState: CharacterPhysicsState;
  eventInput: ParseExperienceEventInput;
  followUpDecisionScenario: EnvironmentSeed;
  caseKind?: RealityAuditCaseKind;
}

export interface RealityAuditResult {
  id: string;
  label: string;
  caseKind: RealityAuditCaseKind;
  eventInput: ParseExperienceEventInput;
  followUpDecisionScenario: EnvironmentSeed;
  beforeState: RealityAuditStateSummary;
  parsedEvent: ParsedExperienceEvent;
  impactParticles: Array<{
    id: string;
    category: string;
    emotion: string;
    impactScore: number;
    vector: PersonalityCoordinateValues;
    rationale: string;
  }>;
  memoryDelta: RealityAuditTextDelta[];
  beliefDelta: RealityAuditScalarDelta[];
  personalityDelta: RealityAuditScalarDelta[];
  needDelta: RealityAuditScalarDelta[];
  desireDelta: RealityAuditScalarDelta[];
  boundaryDelta: RealityAuditScalarDelta[];
  emotionDelta: {
    primary: string;
    valence: number;
    arousal: number;
    intensity: number;
    deltaIntensity: number;
  };
  decisionBefore: RealityAuditDecisionSummary;
  afterState: RealityAuditStateSummary;
  decisionAfter: RealityAuditDecisionSummary;
  decisionInfluence: DecisionInfluenceLayerResult;
  decisionResponsiveness: RealityAuditDecisionResponsiveness;
  impactCalibration: ImpactCalibrationAuditResult;
  explanationTrace: RealityAuditExplanationTrace;
  auditVerdict: RealityAuditVerdict;
}

export interface RealityAuditSuiteResult {
  version: "10.73.0";
  generatedAt: string;
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  cases: RealityAuditResult[];
  counterfactual: {
    negativeCaseId: string;
    positiveCaseId: string;
    decisionDifferent: boolean;
    coordinateDirectionDifferent: boolean;
    verdict: RealityAuditVerdict;
  };
  personalityDifferentiation: {
    sensitiveCaseId: string;
    secureCaseId: string;
    decisionDifferent: boolean;
    coordinateDifferent: boolean;
    verdict: RealityAuditVerdict;
  };
}

export function runRealityAudit(input: RealityAuditRunnerInput): RealityAuditResult {
  const before = cloneState(input.baselineState);
  const after = cloneState(input.baselineState);
  const beforeDerived = deriveAuditState(before);
  const decisionBeforeRaw = buildDifferentiatedDecisionForState(before, { environment: input.followUpDecisionScenario });
  const decisionBefore = summarizeDecision(before, decisionBeforeRaw);
  const parsedEvent = parseExperienceEvent(input.eventInput);
  const step = new CharacterPhysicsEngine().processEvent(after, parsedEvent);
  const afterDerived = deriveAuditState(after);
  const decisionAfterRaw = buildDifferentiatedDecisionForState(after, { environment: input.followUpDecisionScenario });
  const memoryDelta = diffMemories(before.memories, after.memories);
  const beliefDelta = diffBeliefs(beforeDerived.beliefs, afterDerived.beliefs);
  const personalityDelta = diffCoordinate(before.coordinate, after.coordinate);
  const needDelta = diffNeeds(beforeDerived.needs, afterDerived.needs);
  const desireDelta = diffDesires(beforeDerived.desires, afterDerived.desires);
  const boundaryDelta = diffBoundary(before, after);
  const emotionDelta = {
    primary: step.emotion.primary,
    valence: round4(step.emotion.valence),
    arousal: round4(step.emotion.arousal),
    intensity: round4(step.emotion.intensity),
    deltaIntensity: round4(step.emotion.intensity),
  };
  const decisionInfluence = buildDecisionInfluenceLayer({
    beforeDecision: decisionBeforeRaw,
    afterDecision: decisionAfterRaw,
    memoryDelta,
    beliefDelta,
    personalityDelta,
    needDelta,
    desireDelta,
    boundaryDelta,
    emotionDelta,
    followUpScenario: input.followUpDecisionScenario,
  });
  const decisionAfter = summarizeDecision(after, decisionAfterRaw, decisionInfluence);
  const impactCalibration = runImpactCalibrationAudit({
    parsedEvent,
    impactParticles: [summarizeImpact(step)],
    beforeState: summarizeState(before, beforeDerived),
    afterState: summarizeState(after, afterDerived),
    memoryDelta,
    beliefDelta,
    personalityDelta,
    needDelta,
    desireDelta,
    boundaryDelta,
    emotionDelta,
    followUpScenario: input.followUpDecisionScenario,
    decisionInfluence,
  });
  const explanationTrace = buildExplanationTrace({
    id: input.id,
    parsedEvent,
    memoryDelta,
    beliefDelta,
    personalityDelta,
    needDelta,
    desireDelta,
    decisionInfluence,
    impactCalibration,
    decisionBefore,
    decisionAfter,
  });
  const auditVerdict = buildVerdict({
    parsedEvent,
    memoryDelta,
    beliefDelta,
    personalityDelta,
    needDelta,
    desireDelta,
    decisionResponsiveness: decisionInfluence.responsivenessAudit,
    impactCalibration,
    decisionBefore,
    decisionAfter,
    explanationTrace,
  });

  return {
    id: input.id,
    label: input.label,
    caseKind: input.caseKind ?? "same_character_before_after",
    eventInput: input.eventInput,
    followUpDecisionScenario: input.followUpDecisionScenario,
    beforeState: summarizeState(before, beforeDerived),
    parsedEvent,
    impactParticles: [summarizeImpact(step)],
    memoryDelta,
    beliefDelta,
    personalityDelta,
    needDelta,
    desireDelta,
    boundaryDelta,
    emotionDelta,
    decisionBefore,
    afterState: summarizeState(after, afterDerived),
    decisionAfter,
    decisionInfluence,
    decisionResponsiveness: decisionInfluence.responsivenessAudit,
    impactCalibration,
    explanationTrace,
    auditVerdict,
  };
}

export function runRealityAuditSuite(): RealityAuditSuiteResult {
  const scenario: EnvironmentSeed = {
    id: "follow_up_wang_xue_late_reply",
    name: "王雪迟迟未回复后的后续场景",
    trigger: "第二天王雪只回复了一句“刚看到”，没有解释昨晚为什么消失。",
    stressor: "亲密关系中的解释缺失",
    testFocus: "信任 / 安全感 / 行为策略",
  };
  const linFan = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const negative = runRealityAudit({
    id: "audit_same_character_negative_event",
    label: "A. Same Character Before / After — 负向失联事件",
    baselineState: linFan,
    eventInput: {
      description: "王雪昨晚突然失联，直到第二天中午才回复一句刚看到。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      categoryHint: "abandonment",
    },
    followUpDecisionScenario: scenario,
    caseKind: "same_character_before_after",
  });
  const positive = runRealityAudit({
    id: "audit_counterfactual_positive_event",
    label: "B. Counterfactual Event — 正向解释陪伴事件",
    baselineState: linFan,
    eventInput: {
      description: "王雪主动解释昨晚没回复的原因，并约定下次会提前说明。",
      tags: ["王雪", "解释", "陪伴", "亲密关系"],
      categoryHint: "support",
    },
    followUpDecisionScenario: scenario,
    caseKind: "counterfactual_event",
  });
  const sensitive = runRealityAudit({
    id: "audit_same_event_sensitive_personality",
    label: "C. Same Event Different Personality — 高敏依恋人格",
    baselineState: linFan,
    eventInput: {
      description: "朋友临时取消了约定，没有提前说明原因。",
      tags: ["朋友", "突然", "取消", "等待"],
      categoryHint: "abandonment",
    },
    followUpDecisionScenario: scenario,
    caseKind: "same_event_different_personality",
  });
  const secure = runRealityAudit({
    id: "audit_same_event_secure_personality",
    label: "C. Same Event Different Personality — 稳定高信任人格",
    baselineState: createSecureBaselineState(),
    eventInput: {
      description: "朋友临时取消了约定，没有提前说明原因。",
      tags: ["朋友", "突然", "取消", "等待"],
      categoryHint: "abandonment",
    },
    followUpDecisionScenario: scenario,
    caseKind: "same_event_different_personality",
  });
  const cases = [negative, positive, sensitive, secure];
  const counterfactual = compareCounterfactual(negative, positive);
  const personalityDifferentiation = comparePersonalityCases(sensitive, secure);
  const allVerdicts = [...cases.map((c) => c.auditVerdict), counterfactual.verdict, personalityDifferentiation.verdict];

  return {
    version: "10.73.0",
    generatedAt: "2026-07-02T00:00:00.000Z",
    summary: {
      total: allVerdicts.length,
      pass: allVerdicts.filter((v) => v.level === "PASS").length,
      warn: allVerdicts.filter((v) => v.level === "WARN").length,
      fail: allVerdicts.filter((v) => v.level === "FAIL").length,
    },
    cases,
    counterfactual,
    personalityDifferentiation,
  };
}

function deriveAuditState(state: CharacterPhysicsState): {
  beliefs: BeliefState[];
  needs: NeedDeficiency[];
  desires: DesireState[];
} {
  const beliefs = state.beliefStates;
  const needs = deriveNeedDeficiencies({
    coordinate: state.coordinate,
    beliefs,
    clusters: [...state.clusters.values()],
  });
  return {
    beliefs,
    needs,
    desires: deriveDesires(needs),
  };
}

function summarizeState(
  state: CharacterPhysicsState,
  derived = deriveAuditState(state),
): RealityAuditStateSummary {
  const summary: RealityAuditStateSummary = {
    characterId: state.identity.id,
    memoryCount: state.memories.length,
    beliefCount: derived.beliefs.length,
    coordinate: coordinateToRecord(state.coordinate),
    boundaryPhase: state.boundary.phase,
    boundaryStressLoad: round4(state.boundary.stressLoad),
  };
  if (derived.beliefs[0]) summary.topBelief = derived.beliefs[0].content;
  if (derived.needs[0]) summary.topNeed = derived.needs[0].name;
  if (derived.desires[0]) summary.topDesire = derived.desires[0].content;
  return summary;
}

function summarizeDecision(
  state: CharacterPhysicsState,
  differentiated: DifferentiatedDecision,
  influence?: DecisionInfluenceLayerResult,
): RealityAuditDecisionSummary {
  const derived = deriveAuditState(state);
  const surfaceCandidates = influence?.decisionSurfaceAfter.actionCandidates;
  const actionCandidates = surfaceCandidates
    ? surfaceCandidates.slice(0, 6).map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      score: candidate.score,
      rank: candidate.rank,
      strategyTag: candidate.strategyTag,
      riskProfile: candidate.riskProfile,
      approachStyle: candidate.approachStyle,
    }))
    : differentiated.strategies.slice(0, 6).map((strategy, index) => ({
      id: strategy.id,
      label: strategy.label,
      score: round4(strategy.intensity),
      rank: index + 1,
      strategyTag: "baseline_strategy",
      riskProfile: "unknown",
      approachStyle: "unknown",
    }));
  const selectedCandidate = actionCandidates[0];
  const summary: RealityAuditDecisionSummary = {
    action: differentiated.actionSurface.action,
    confidence: round4(selectedCandidate?.score ?? differentiated.selectedStrategy.intensity),
    strategy: selectedCandidate?.label ?? differentiated.selectedStrategy.label,
    strategyId: selectedCandidate?.id ?? differentiated.selectedStrategy.id,
    direction: differentiated.selectedStrategy.direction,
    supportingBeliefIds: derived.beliefs.slice(0, 3).map((belief) => belief.id),
    supportingNeedIds: derived.needs.slice(0, 3).map((need) => need.id),
    supportingDesireIds: derived.desires.slice(0, 3).map((desire) => desire.id),
    actionCandidates,
  };
  if (differentiated.schemas[0]) summary.topSchema = differentiated.schemas[0].label;
  if (derived.needs[0]) summary.topNeed = derived.needs[0].name;
  if (derived.desires[0]) summary.topDesire = derived.desires[0].content;
  return summary;
}

function summarizeImpact(step: PhysicsStepResult): RealityAuditResult["impactParticles"][number] {
  return {
    id: step.particle.id,
    category: step.particle.category,
    emotion: step.particle.emotion,
    impactScore: round4(step.particle.impactScore),
    vector: coordinateToRecord(step.particle.vector.delta),
    rationale: step.particle.vector.rationale,
  };
}

function diffMemories(before: MemoryNode[], after: MemoryNode[]): RealityAuditTextDelta[] {
  const beforeIds = new Set(before.map((memory) => memory.id));
  return after
    .filter((memory) => !beforeIds.has(memory.id))
    .map((memory) => ({
      id: memory.id,
      after: memory.content,
      delta: "added" as const,
    }));
}

function diffBeliefs(before: BeliefState[], after: BeliefState[]): RealityAuditScalarDelta[] {
  const beforeById = new Map(before.map((belief) => [belief.id, belief]));
  const afterById = new Map(after.map((belief) => [belief.id, belief]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  return [...ids].flatMap((id) => {
    const b = beforeById.get(id);
    const a = afterById.get(id);
    const beforeValue = b?.strength ?? 0;
    const afterValue = a?.strength ?? 0;
    const delta = round4(afterValue - beforeValue);
    return Math.abs(delta) >= 0.0001
      ? [{ id, before: round4(beforeValue), after: round4(afterValue), delta }]
      : [];
  });
}

function diffCoordinate(
  before: CharacterPhysicsState["coordinate"],
  after: CharacterPhysicsState["coordinate"],
): RealityAuditScalarDelta[] {
  return Object.entries(coordinateToRecord(after)).flatMap(([id, afterValue]) => {
    const beforeValue = coordinateToRecord(before)[id as keyof PersonalityCoordinateValues];
    const delta = round4(afterValue - beforeValue);
    return Math.abs(delta) >= 0.0001
      ? [{ id, before: beforeValue, after: afterValue, delta }]
      : [];
  });
}

function diffNeeds(before: NeedDeficiency[], after: NeedDeficiency[]): RealityAuditScalarDelta[] {
  return diffIntensityById(before, after);
}

function diffDesires(before: DesireState[], after: DesireState[]): RealityAuditScalarDelta[] {
  return diffIntensityById(before, after);
}

function diffBoundary(before: CharacterPhysicsState, after: CharacterPhysicsState): RealityAuditScalarDelta[] {
  return [
    {
      id: "boundaryStressLoad",
      before: round4(before.boundary.stressLoad),
      after: round4(after.boundary.stressLoad),
      delta: round4(after.boundary.stressLoad - before.boundary.stressLoad),
    },
    {
      id: "boundaryIntegrity",
      before: round4(before.boundary.integrity),
      after: round4(after.boundary.integrity),
      delta: round4(after.boundary.integrity - before.boundary.integrity),
    },
  ].filter((delta) => Math.abs(delta.delta) >= 0.0001);
}

function diffIntensityById(
  before: Array<{ id: string; intensity: number }>,
  after: Array<{ id: string; intensity: number }>,
): RealityAuditScalarDelta[] {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  return [...ids].flatMap((id) => {
    const beforeValue = beforeById.get(id)?.intensity ?? 0;
    const afterValue = afterById.get(id)?.intensity ?? 0;
    const delta = round4(afterValue - beforeValue);
    return Math.abs(delta) >= 0.0001
      ? [{ id, before: round4(beforeValue), after: round4(afterValue), delta }]
      : [];
  });
}

function buildExplanationTrace(input: {
  id: string;
  parsedEvent: ParsedExperienceEvent;
  memoryDelta: RealityAuditTextDelta[];
  beliefDelta: RealityAuditScalarDelta[];
  personalityDelta: RealityAuditScalarDelta[];
  needDelta: RealityAuditScalarDelta[];
  desireDelta: RealityAuditScalarDelta[];
  decisionInfluence: DecisionInfluenceLayerResult;
  impactCalibration: ImpactCalibrationAuditResult;
  decisionBefore: RealityAuditDecisionSummary;
  decisionAfter: RealityAuditDecisionSummary;
}): RealityAuditExplanationTrace {
  const facts: RealityAuditExplanationFact[] = [];
  if (input.memoryDelta[0]) {
    facts.push({
      id: `${input.id}_memory_added`,
      label: "memory added",
      sourceDeltaPath: "memoryDelta[0]",
      value: input.memoryDelta[0].id,
    });
  }
  for (const [path, delta] of [
    ["beliefDelta[0]", input.beliefDelta[0]],
    ["personalityDelta[0]", input.personalityDelta[0]],
    ["needDelta[0]", input.needDelta[0]],
    ["desireDelta[0]", input.desireDelta[0]],
  ] as const) {
    if (!delta) continue;
    facts.push({
      id: `${input.id}_${path.replace(/\W/g, "_")}`,
      label: delta.id,
      sourceDeltaPath: path,
      value: delta.delta,
    });
  }
  facts.push({
    id: `${input.id}_decision_change`,
    label: "decision before/after",
    sourceDeltaPath: "decisionBefore/decisionAfter",
    value: `${input.decisionBefore.strategy} -> ${input.decisionAfter.strategy}`,
  });
  const firstInfluence = input.decisionInfluence.responsivenessTrace.contributions[0];
  if (firstInfluence) {
    facts.push({
      id: `${input.id}_decision_influence`,
      label: firstInfluence.influenceKey,
      sourceDeltaPath: firstInfluence.sourceDeltaPath,
      value: firstInfluence.strength,
    });
  }
  facts.push({
    id: `${input.id}_impact_calibration`,
    label: "impact calibration verdict",
    sourceDeltaPath: "impactCalibration.calibrationVerdict",
    value: input.impactCalibration.calibrationVerdict.level,
  });

  return {
    id: `trace_${input.id}`,
    scope: "reality_audit",
    summary: `${input.parsedEvent.category} event produced ${facts.length} grounded audit fact(s).`,
    facts,
    reasons: [
      `parsedEvent.category=${input.parsedEvent.category}`,
      `memoryDelta=${input.memoryDelta.length}`,
      `beliefDelta=${input.beliefDelta.length}`,
      `personalityDelta=${input.personalityDelta.length}`,
      `needDelta=${input.needDelta.length}`,
      `desireDelta=${input.desireDelta.length}`,
      `responsivenessScore=${input.decisionInfluence.responsivenessAudit.responsivenessScore}`,
      `calibrationVerdict=${input.impactCalibration.calibrationVerdict.level}`,
      `decision=${input.decisionBefore.strategyId}->${input.decisionAfter.strategyId}`,
    ],
    groundedDeltaPaths: facts.map((fact) => fact.sourceDeltaPath),
  };
}

function buildVerdict(input: {
  parsedEvent: ParsedExperienceEvent;
  memoryDelta: RealityAuditTextDelta[];
  beliefDelta: RealityAuditScalarDelta[];
  personalityDelta: RealityAuditScalarDelta[];
  needDelta: RealityAuditScalarDelta[];
  desireDelta: RealityAuditScalarDelta[];
  decisionResponsiveness: RealityAuditDecisionResponsiveness;
  impactCalibration: ImpactCalibrationAuditResult;
  decisionBefore: RealityAuditDecisionSummary;
  decisionAfter: RealityAuditDecisionSummary;
  explanationTrace: RealityAuditExplanationTrace;
}): RealityAuditVerdict {
  const warnings: string[] = [];
  const failures: string[] = [];
  const reasons: string[] = [];
  const stateChanged =
    input.memoryDelta.length +
    input.beliefDelta.length +
    input.personalityDelta.length +
    input.needDelta.length +
    input.desireDelta.length > 0;
  const decisionResponded = hasDecisionResponded(input.decisionBefore, input.decisionAfter);
  const responsiveSurface =
    input.decisionResponsiveness.candidateScoreChanged ||
    input.decisionResponsiveness.strategyDistributionChanged ||
    input.decisionResponsiveness.topCandidateChanged;
  const grounded = isExplanationGrounded(input.explanationTrace, input);
  const impactMagnitude = maxAbs(input.personalityDelta);

  if (!stateChanged) failures.push("state did not change after event input");
  else reasons.push("event produced structured state delta");

  if (stateChanged && !responsiveSurface) {
    warnings.push("state changed but decision did not respond");
  } else if (decisionResponded || input.decisionResponsiveness.verdict === "PASS_WITH_STABLE_TOP_DECISION") {
    reasons.push("decision before/after changed after state delta");
  }
  for (const warning of input.decisionResponsiveness.warnings) warnings.push(warning);
  for (const failure of input.decisionResponsiveness.failures) failures.push(failure);
  for (const warning of input.impactCalibration.calibrationVerdict.warnings) warnings.push(warning);
  for (const failure of input.impactCalibration.calibrationVerdict.failures) failures.push(failure);
  if (input.decisionResponsiveness.verdict === "PASS_WITH_STABLE_TOP_DECISION") {
    reasons.push("top decision stayed stable, but candidate scores or strategy distribution responded");
  }
  if (input.impactCalibration.calibrationVerdict.level === "PASS_WITH_RESILIENCE_BUFFER") {
    reasons.push("personality slow-variable drift was buffered while faster channels responded");
  }

  if (!grounded) warnings.push("explanation is not grounded in state diff");
  else reasons.push("explanation trace references concrete delta paths");

  if (input.parsedEvent.category === "general" && impactMagnitude > 0.04) {
    warnings.push("neutral event caused large personality drift");
  }
  const majorCategories: string[] = ["abandonment", "betrayal", "support"];
  const calibrationBuffered =
    input.impactCalibration.calibrationVerdict.level === "PASS_WITH_RESILIENCE_BUFFER" ||
    input.impactCalibration.calibrationVerdict.level === "PASS";
  if (majorCategories.includes(input.parsedEvent.category ?? "") && impactMagnitude < 0.001 && !calibrationBuffered) {
    warnings.push("major event produced weak or invisible personality impact");
  }

  return {
    level: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    passed: failures.length === 0,
    warnings,
    failures,
    reasons,
  };
}

function compareCounterfactual(
  negative: RealityAuditResult,
  positive: RealityAuditResult,
): RealityAuditSuiteResult["counterfactual"] {
  const decisionDifferent =
    hasDecisionResponded(negative.decisionAfter, positive.decisionAfter) ||
    influenceVectorDistance(
      negative.decisionInfluence.decisionInfluenceVector,
      positive.decisionInfluence.decisionInfluenceVector,
    ) >= 0.08 ||
    strategyDistributionDistance(
      negative.decisionInfluence.decisionSurfaceAfter.strategyDistribution,
      positive.decisionInfluence.decisionSurfaceAfter.strategyDistribution,
    ) >= 0.02;
  const trustNeg = findDelta(negative.personalityDelta, "trust");
  const trustPos = findDelta(positive.personalityDelta, "trust");
  const fearNeg = findDelta(negative.personalityDelta, "fear");
  const fearPos = findDelta(positive.personalityDelta, "fear");
  const coordinateDirectionDifferent = trustNeg < trustPos || fearNeg > fearPos;
  const warnings: string[] = [];
  if (!decisionDifferent) warnings.push("counterfactual events did not produce different decision surface");
  if (!coordinateDirectionDifferent) warnings.push("counterfactual event coordinate direction was not clearly different");
  return {
    negativeCaseId: negative.id,
    positiveCaseId: positive.id,
    decisionDifferent,
    coordinateDirectionDifferent,
    verdict: {
      level: warnings.length ? "WARN" : "PASS",
      passed: true,
      warnings,
      failures: [],
      reasons: warnings.length ? [] : ["positive and negative events diverged structurally"],
    },
  };
}

function comparePersonalityCases(
  sensitive: RealityAuditResult,
  secure: RealityAuditResult,
): RealityAuditSuiteResult["personalityDifferentiation"] {
  const decisionDifferent = hasDecisionResponded(sensitive.decisionAfter, secure.decisionAfter);
  const coordinateDifferent = coordinateDistance(
    { values: sensitive.beforeState.coordinate },
    { values: secure.beforeState.coordinate },
  ) > 0.2;
  const warnings: string[] = [];
  if (!decisionDifferent) warnings.push("same event on different personalities did not produce differentiated decision");
  if (!coordinateDifferent) warnings.push("test baselines were not meaningfully different");
  return {
    sensitiveCaseId: sensitive.id,
    secureCaseId: secure.id,
    decisionDifferent,
    coordinateDifferent,
    verdict: {
      level: warnings.length ? "WARN" : "PASS",
      passed: true,
      warnings,
      failures: [],
      reasons: warnings.length ? [] : ["same event produced personality-dependent result"],
    },
  };
}

function createSecureBaselineState(): CharacterPhysicsState {
  return createCharacterPhysicsState({
    identity: {
      id: "secure_yan",
      name: "严澈",
      description: "一个高信任、低恐惧、边界稳定的人。",
      tags: ["稳定", "高信任", "低恐惧"],
    },
    coordinate: {
      values: {
        ...neutralCoordinate().values,
        trust: 0.78,
        attachment: 0.42,
        fear: 0.24,
        control: 0.48,
        neuroticism: 0.28,
        extroversion: 0.54,
        agreeableness: 0.62,
      },
    },
    learningRate: 0.02,
  });
}

function hasDecisionResponded(
  before: RealityAuditDecisionSummary,
  after: RealityAuditDecisionSummary,
): boolean {
  return (
    before.strategyId !== after.strategyId ||
    before.action !== after.action ||
    before.direction !== after.direction ||
    Math.abs(before.confidence - after.confidence) >= 0.03 ||
    before.topNeed !== after.topNeed ||
    before.topDesire !== after.topDesire
  );
}

function isExplanationGrounded(
  trace: RealityAuditExplanationTrace,
  input: {
    memoryDelta: RealityAuditTextDelta[];
    beliefDelta: RealityAuditScalarDelta[];
    personalityDelta: RealityAuditScalarDelta[];
    needDelta: RealityAuditScalarDelta[];
    desireDelta: RealityAuditScalarDelta[];
  },
): boolean {
  const paths = new Set(trace.groundedDeltaPaths);
  if (input.memoryDelta.length && !paths.has("memoryDelta[0]")) return false;
  if (input.beliefDelta.length && !paths.has("beliefDelta[0]")) return false;
  if (input.personalityDelta.length && !paths.has("personalityDelta[0]")) return false;
  if (input.needDelta.length && !paths.has("needDelta[0]")) return false;
  if (input.desireDelta.length && !paths.has("desireDelta[0]")) return false;
  return trace.facts.every((fact) => fact.sourceDeltaPath.length > 0);
}

function maxAbs(deltas: RealityAuditScalarDelta[]): number {
  return deltas.reduce((max, delta) => Math.max(max, Math.abs(delta.delta)), 0);
}

function findDelta(deltas: RealityAuditScalarDelta[], id: string): number {
  return deltas.find((delta) => delta.id === id)?.delta ?? 0;
}

function influenceVectorDistance(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return round4([...keys].reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / Math.max(1, keys.size));
}

function strategyDistributionDistance(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return round4([...keys].reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / 2);
}

function cloneState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state)));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
