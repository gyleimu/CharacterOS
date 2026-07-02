import type {
  ActionSurface,
  BehaviorStrategy,
  BehaviorStrategyId,
  DifferentiatedDecision,
  EnvironmentSeed,
} from "./characterDifferentiation";

export type DecisionInfluenceKey =
  | "caution"
  | "testing"
  | "withdrawal"
  | "openness"
  | "reassuranceSeeking"
  | "boundaryProbing"
  | "confrontation"
  | "control"
  | "repair"
  | "negotiation"
  | "freeze";

export type DecisionResponsivenessVerdictLevel = "PASS" | "PASS_WITH_STABLE_TOP_DECISION" | "WARN" | "FAIL";

export interface DecisionInfluenceScalarDelta {
  id: string;
  before?: number;
  after?: number;
  delta: number;
}

export interface DecisionInfluenceTextDelta {
  id: string;
  before?: string;
  after?: string;
  delta: "added" | "removed" | "changed";
}

export interface DecisionInfluenceEmotionDelta {
  primary: string;
  valence: number;
  arousal: number;
  intensity: number;
  deltaIntensity: number;
}

export interface DecisionActionCandidateSurface {
  id: string;
  label: string;
  score: number;
  rank: number;
  strategyTag: string;
  riskProfile: "low" | "medium" | "high";
  approachStyle: "open" | "cautious" | "defensive" | "confrontational" | "repairing" | "controlling";
  direction: string;
  reason: string;
}

export interface DecisionSurface {
  topCandidateId: string;
  selectedStrategyId: BehaviorStrategyId;
  selectedAction: string;
  strategyDistribution: Record<string, number>;
  actionCandidates: DecisionActionCandidateSurface[];
}

export interface DecisionInfluenceContribution {
  sourceDeltaPath: string;
  influenceKey: DecisionInfluenceKey;
  strength: number;
  reason: string;
}

export interface DecisionResponsivenessTrace {
  scenarioRelevance: number;
  stateDeltaMagnitude: number;
  influenceMagnitude: number;
  groundedDeltaPaths: string[];
  contributions: DecisionInfluenceContribution[];
  reasons: string[];
  warnings: string[];
}

export interface DecisionResponsivenessAudit {
  candidateScoreChanged: boolean;
  topCandidateChanged: boolean;
  strategyDistributionChanged: boolean;
  influenceTraceGrounded: boolean;
  responsivenessScore: number;
  overreactionScore: number;
  verdict: DecisionResponsivenessVerdictLevel;
  reasons: string[];
  warnings: string[];
  failures: string[];
}

export interface DecisionInfluenceLayerResult {
  decisionInfluenceVector: Record<DecisionInfluenceKey, number>;
  strategyWeightDelta: Record<string, number>;
  actionCandidateScoreDelta: Record<string, number>;
  decisionSurfaceBefore: DecisionSurface;
  decisionSurfaceAfter: DecisionSurface;
  responsivenessTrace: DecisionResponsivenessTrace;
  responsivenessAudit: DecisionResponsivenessAudit;
}

export interface BuildDecisionInfluenceLayerInput {
  beforeDecision: DifferentiatedDecision;
  afterDecision: DifferentiatedDecision;
  memoryDelta: readonly DecisionInfluenceTextDelta[];
  beliefDelta: readonly DecisionInfluenceScalarDelta[];
  personalityDelta: readonly DecisionInfluenceScalarDelta[];
  needDelta: readonly DecisionInfluenceScalarDelta[];
  desireDelta: readonly DecisionInfluenceScalarDelta[];
  boundaryDelta?: readonly DecisionInfluenceScalarDelta[];
  emotionDelta?: DecisionInfluenceEmotionDelta;
  followUpScenario: EnvironmentSeed;
}

const INFLUENCE_KEYS: DecisionInfluenceKey[] = [
  "caution",
  "testing",
  "withdrawal",
  "openness",
  "reassuranceSeeking",
  "boundaryProbing",
  "confrontation",
  "control",
  "repair",
  "negotiation",
  "freeze",
];

const STRATEGY_INFLUENCE_WEIGHTS: Record<BehaviorStrategyId, Partial<Record<DecisionInfluenceKey, number>>> = {
  verify_before_commitment: { caution: 0.55, testing: 0.65, control: 0.2 },
  small_scale_trial: { testing: 0.55, openness: 0.25, repair: 0.2 },
  negotiate_control: { control: 0.75, negotiation: 0.5, caution: 0.15 },
  demand_written_terms: { testing: 0.45, control: 0.45, caution: 0.35 },
  delay_decision: { freeze: 0.5, caution: 0.35, withdrawal: 0.2 },
  direct_join: { openness: 0.75, repair: 0.15 },
  impulsive_join: { openness: 0.65, control: -0.15, caution: -0.25 },
  moral_reject: { confrontation: 0.35, caution: 0.25 },
  resource_protective_refusal: { caution: 0.55, withdrawal: 0.35, freeze: 0.2 },
  emotional_withdrawal: { withdrawal: 0.75, freeze: 0.25, openness: -0.35 },
  attachment_checking: { reassuranceSeeking: 0.75, boundaryProbing: 0.35, testing: 0.2 },
  seek_support: { reassuranceSeeking: 0.35, repair: 0.35, testing: 0.25 },
  confront_directly: { confrontation: 0.75, control: 0.25 },
  appease_then_observe: { testing: 0.3, withdrawal: 0.25, caution: 0.25 },
  overcompensate_to_prove_self: { control: 0.25, freeze: 0.2 },
  avoid_dependency: { withdrawal: 0.55, caution: 0.35, openness: -0.25 },
  self_sacrifice: { openness: 0.15, withdrawal: -0.1 },
  boundary_assertion: { boundaryProbing: 0.4, control: 0.35, caution: 0.25 },
  exploit_opportunity: { openness: 0.45, testing: 0.2, caution: -0.15 },
  reframe_as_growth: { repair: 0.65, openness: 0.25, negotiation: 0.2 },
  responsibility_first: { caution: 0.25, control: 0.25 },
  freedom_preserving_choice: { boundaryProbing: 0.25, control: 0.25, withdrawal: 0.15 },
  power_grab: { control: 0.8, confrontation: 0.25 },
  fairness_correction: { confrontation: 0.45, negotiation: 0.25, control: 0.25 },
  revenge_or_rectify: { confrontation: 0.75, control: 0.2 },
};

export function buildDecisionInfluenceLayer(input: BuildDecisionInfluenceLayerInput): DecisionInfluenceLayerResult {
  const beforeSurface = buildDecisionSurface(input.beforeDecision);
  const baseAfterSurface = buildDecisionSurface(input.afterDecision);
  const scenarioRelevance = computeScenarioRelevance(input);
  const stateDeltaMagnitude = computeStateDeltaMagnitude(input);
  const contributions = buildInfluenceContributions(input, scenarioRelevance);
  const decisionInfluenceVector = normalizeInfluenceVector(contributions);
  const strategyWeightDelta = buildStrategyWeightDelta(input.afterDecision.strategies, decisionInfluenceVector, {
    scenarioRelevance,
    stateDeltaMagnitude,
  });
  const adjustedStrategies = input.afterDecision.strategies
    .map((strategy) => ({
      ...strategy,
      intensity: round4(clamp01(strategy.intensity + (strategyWeightDelta[strategy.id] ?? 0))),
    }))
    .sort((a, b) => b.intensity - a.intensity);
  const afterSurface = buildDecisionSurface({
    ...input.afterDecision,
    strategies: adjustedStrategies,
    selectedStrategy: adjustedStrategies[0] ?? input.afterDecision.selectedStrategy,
  });
  const actionCandidateScoreDelta = buildCandidateScoreDelta(baseAfterSurface, afterSurface);
  const trace = buildTrace({
    scenarioRelevance,
    stateDeltaMagnitude,
    contributions,
    vector: decisionInfluenceVector,
  });
  const audit = buildResponsivenessAudit({
    beforeSurface,
    baseAfterSurface,
    afterSurface,
    actionCandidateScoreDelta,
    trace,
  });

  return {
    decisionInfluenceVector,
    strategyWeightDelta,
    actionCandidateScoreDelta,
    decisionSurfaceBefore: beforeSurface,
    decisionSurfaceAfter: afterSurface,
    responsivenessTrace: trace,
    responsivenessAudit: audit,
  };
}

function buildDecisionSurface(decision: DifferentiatedDecision): DecisionSurface {
  const candidates = decision.strategies.map((strategy, index) => buildCandidateSurface(strategy, index + 1));
  const distributionTotal = candidates.reduce((sum, candidate) => sum + candidate.score, 0) || 1;
  const strategyDistribution = Object.fromEntries(
    candidates.map((candidate) => [candidate.id, round4(candidate.score / distributionTotal)]),
  );
  const top = candidates[0] ?? buildCandidateSurface(decision.selectedStrategy, 1);
  return {
    topCandidateId: top.id,
    selectedStrategyId: top.id as BehaviorStrategyId,
    selectedAction: decision.actionSurface.action,
    strategyDistribution,
    actionCandidates: candidates,
  };
}

function buildCandidateSurface(strategy: BehaviorStrategy, rank: number): DecisionActionCandidateSurface {
  return {
    id: strategy.id,
    label: strategy.label,
    score: round4(strategy.intensity),
    rank,
    strategyTag: tagForStrategy(strategy.id),
    riskProfile: riskForStrategy(strategy.id),
    approachStyle: styleForStrategy(strategy.id),
    direction: strategy.direction,
    reason: strategy.coreReason,
  };
}

function buildInfluenceContributions(
  input: BuildDecisionInfluenceLayerInput,
  scenarioRelevance: number,
): DecisionInfluenceContribution[] {
  const scale = clamp01(0.35 + scenarioRelevance * 0.65);
  const supportiveEvent = hasSupportiveDelta(input);
  const contributions: DecisionInfluenceContribution[] = [];
  const add = (sourceDeltaPath: string, influenceKey: DecisionInfluenceKey, rawStrength: number, reason: string) => {
    const strength = round4(rawStrength * scale);
    if (Math.abs(strength) >= 0.002) contributions.push({ sourceDeltaPath, influenceKey, strength, reason });
  };

  for (const [index, delta] of input.memoryDelta.entries()) {
    const path = `memoryDelta[${index}]`;
    const text = `${delta.id} ${delta.before ?? ""} ${delta.after ?? ""}`;
    if (hasAny(text, ["解释", "陪伴", "支持", "安慰", "留下", "靠近", "新证据"])) {
      add(path, "openness", 0.16, "supportive memory delta; openness gains weight");
      add(path, "repair", 0.14, "supportive memory delta; repair strategies gain weight");
      add(path, "withdrawal", -0.12, "supportive memory delta; withdrawal softens");
      add(path, "caution", -0.08, "supportive memory delta; caution softens");
    }
  }

  for (const [index, delta] of input.personalityDelta.entries()) {
    const path = `personalityDelta[${index}]`;
    if (delta.id === "trust" && delta.delta < 0) {
      add(path, "caution", -delta.delta * 3.2, "trust decreased; caution rises");
      add(path, "testing", -delta.delta * 2.8, "trust decreased; verification/testing rises");
      add(path, "withdrawal", -delta.delta * 2.1, "trust decreased; withdrawal becomes more available");
      add(path, "openness", delta.delta * 2.7, "trust decreased; direct openness falls");
    }
    if (delta.id === "trust" && delta.delta > 0) {
      add(path, "openness", delta.delta * 3.2, "trust increased; openness rises");
      add(path, "repair", delta.delta * 2.2, "trust increased; repair strategies become safer");
      add(path, "caution", -delta.delta * 1.8, "trust increased; caution softens");
      add(path, "withdrawal", -delta.delta * 1.8, "trust increased; withdrawal softens");
    }
    if (delta.id === "fear" && delta.delta > 0) {
      add(path, "caution", delta.delta * 3.0, "fear increased; risk avoidance rises");
      add(path, "freeze", delta.delta * 1.8, "fear increased; delay/freeze becomes more likely");
      add(path, "withdrawal", delta.delta * 1.8, "fear increased; defensive distance rises");
    }
    if (delta.id === "fear" && delta.delta < 0) {
      add(path, "openness", -delta.delta * 2.3, "fear decreased; openness can increase");
      add(path, "freeze", delta.delta * 1.8, "fear decreased; freeze softens");
    }
    if (delta.id === "attachment" && delta.delta > 0) {
      add(path, "reassuranceSeeking", delta.delta * 2.8, "attachment pressure increased; reassurance seeking rises");
      add(path, "boundaryProbing", delta.delta * 1.6, "attachment pressure increased; relationship boundary probing rises");
    }
    if (delta.id === "control" && delta.delta > 0) {
      add(path, "control", delta.delta * 2.6, "control need increased; control strategies rise");
      add(path, "negotiation", delta.delta * 1.5, "control need increased; negotiation becomes useful");
    }
    if (delta.id === "agreeableness" && delta.delta < 0) {
      add(path, "confrontation", -delta.delta * 1.8, "agreeableness decreased; confrontation becomes less inhibited");
    }
  }

  for (const [index, delta] of input.needDelta.entries()) {
    const path = `needDelta[${index}]`;
    if (delta.delta <= 0) continue;
    add(path, "caution", delta.delta * 0.8, "need pressure increased; cautious strategies gain weight");
    add(path, "testing", delta.delta * 0.5, "need pressure increased; evidence seeking gains weight");
    if (delta.id.includes("安全") || delta.id.includes("safety")) {
      add(path, "freeze", delta.delta * 0.5, "safety need increased; delay/freeze gains weight");
    }
  }

  for (const [index, delta] of input.beliefDelta.entries()) {
    const path = `beliefDelta[${index}]`;
    if (delta.delta <= 0) continue;
    add(path, "testing", delta.delta * 0.5, "belief strength changed; decision asks for more evidence");
    add(path, "caution", delta.delta * 0.4, "belief strength changed; defensive caution adjusts");
    if (mentionsAttachmentRisk(delta.id)) {
      add(path, "reassuranceSeeking", delta.delta * 0.6, "attachment-related belief strengthened");
    }
  }

  for (const [index, delta] of input.boundaryDelta?.entries() ?? []) {
    const path = `boundaryDelta[${index}]`;
    if (delta.delta > 0) {
      const boundaryScale = supportiveEvent ? 0.32 : 1;
      add(path, "withdrawal", delta.delta * 1.2 * boundaryScale, "boundary stress increased; withdrawal rises");
      add(path, "freeze", delta.delta * 1.1 * boundaryScale, "boundary stress increased; freeze/exit candidates rise");
      add(path, "boundaryProbing", delta.delta * 0.9 * boundaryScale, "boundary stress increased; boundary protection rises");
    }
  }

  if (input.emotionDelta) {
    const e = input.emotionDelta;
    const strength = e.deltaIntensity || e.intensity;
    if (e.primary === "anger") {
      add("emotionDelta", "confrontation", strength * 0.35, "anger increased; confrontation gains weight");
      add("emotionDelta", "control", strength * 0.18, "anger increased; control gains weight");
    }
    if (e.primary === "joy" || e.primary === "relief") {
      add("emotionDelta", "openness", strength * 0.25, "positive emotion increased; openness gains weight");
      add("emotionDelta", "repair", strength * 0.18, "positive emotion increased; repair gains weight");
      add("emotionDelta", "withdrawal", -strength * 0.12, "positive emotion increased; withdrawal softens");
    }
    if (e.primary === "fear") {
      add("emotionDelta", "caution", strength * 0.25, "fear emotion increased; caution gains weight");
      add("emotionDelta", "withdrawal", strength * 0.18, "fear emotion increased; withdrawal gains weight");
    }
  }

  if (!contributions.length && computeStateDeltaMagnitude(input) > 0) {
    add("stateDelta", "testing", 0.03, "state changed but no specific influence matched; preserve weak verification response");
  }

  return contributions;
}

function normalizeInfluenceVector(contributions: readonly DecisionInfluenceContribution[]): Record<DecisionInfluenceKey, number> {
  const vector = Object.fromEntries(INFLUENCE_KEYS.map((key) => [key, 0])) as Record<DecisionInfluenceKey, number>;
  for (const contribution of contributions) {
    vector[contribution.influenceKey] = clampSigned(vector[contribution.influenceKey] + contribution.strength, -0.35, 0.35);
  }
  for (const key of INFLUENCE_KEYS) vector[key] = round4(vector[key]);
  return vector;
}

function buildStrategyWeightDelta(
  strategies: readonly BehaviorStrategy[],
  vector: Record<DecisionInfluenceKey, number>,
  context: { scenarioRelevance: number; stateDeltaMagnitude: number },
): Record<string, number> {
  const cap = clamp01(0.015 + context.stateDeltaMagnitude * 0.6 + context.scenarioRelevance * 0.08);
  const deltas: Record<string, number> = {};
  for (const strategy of strategies) {
    const weights = STRATEGY_INFLUENCE_WEIGHTS[strategy.id] ?? {};
    const raw = INFLUENCE_KEYS.reduce((sum, key) => sum + (weights[key] ?? 0) * vector[key], 0);
    deltas[strategy.id] = round4(clampSigned(raw, -cap, cap));
  }
  return deltas;
}

function buildCandidateScoreDelta(before: DecisionSurface, after: DecisionSurface): Record<string, number> {
  const beforeScores = new Map(before.actionCandidates.map((candidate) => [candidate.id, candidate.score]));
  return Object.fromEntries(
    after.actionCandidates.map((candidate) => [
      candidate.id,
      round4(candidate.score - (beforeScores.get(candidate.id) ?? 0)),
    ]),
  );
}

function buildTrace(input: {
  scenarioRelevance: number;
  stateDeltaMagnitude: number;
  contributions: readonly DecisionInfluenceContribution[];
  vector: Record<DecisionInfluenceKey, number>;
}): DecisionResponsivenessTrace {
  const influenceMagnitude = round4(
    INFLUENCE_KEYS.reduce((sum, key) => sum + Math.abs(input.vector[key]), 0) / INFLUENCE_KEYS.length,
  );
  const warnings: string[] = [];
  if (input.stateDeltaMagnitude > 0.08 && influenceMagnitude < 0.005) {
    warnings.push("major state delta produced weak decision influence");
  }
  return {
    scenarioRelevance: round4(input.scenarioRelevance),
    stateDeltaMagnitude: round4(input.stateDeltaMagnitude),
    influenceMagnitude,
    groundedDeltaPaths: [...new Set(input.contributions.map((item) => item.sourceDeltaPath))],
    contributions: [...input.contributions],
    reasons: input.contributions.map((item) => `${item.sourceDeltaPath}: ${item.reason}`),
    warnings,
  };
}

function buildResponsivenessAudit(input: {
  beforeSurface: DecisionSurface;
  baseAfterSurface: DecisionSurface;
  afterSurface: DecisionSurface;
  actionCandidateScoreDelta: Record<string, number>;
  trace: DecisionResponsivenessTrace;
}): DecisionResponsivenessAudit {
  const warnings: string[] = [...input.trace.warnings];
  const failures: string[] = [];
  const reasons: string[] = [];
  const maxScoreDelta = Math.max(0, ...Object.values(input.actionCandidateScoreDelta).map((value) => Math.abs(value)));
  const candidateScoreChanged = maxScoreDelta >= 0.006;
  const topCandidateChanged = input.beforeSurface.topCandidateId !== input.afterSurface.topCandidateId;
  const strategyDistributionChanged = distributionDistance(
    input.baseAfterSurface.strategyDistribution,
    input.afterSurface.strategyDistribution,
  ) >= 0.004;
  const influenceTraceGrounded = input.trace.groundedDeltaPaths.length > 0 && input.trace.contributions.length > 0;
  const responsivenessScore = round4(
    clamp01(maxScoreDelta * 8 + (strategyDistributionChanged ? 0.18 : 0) + (topCandidateChanged ? 0.25 : 0)),
  );
  const expectedResponse = clamp01(input.trace.stateDeltaMagnitude * input.trace.scenarioRelevance * 6);
  const overreactionScore = round4(clamp01(responsivenessScore - expectedResponse - 0.12));

  if (!candidateScoreChanged && !strategyDistributionChanged && input.trace.stateDeltaMagnitude > 0.01) {
    failures.push("decision influence layer did not change candidate scores or strategy distribution");
  }
  if (!influenceTraceGrounded) warnings.push("decision influence trace is not grounded in concrete state delta");
  if (overreactionScore > 0.35) warnings.push("decision shifted more than impact/relevance justify");

  if (candidateScoreChanged) reasons.push("candidate scores changed after consuming state delta");
  if (strategyDistributionChanged) reasons.push("strategy distribution changed after consuming state delta");
  if (topCandidateChanged) reasons.push("top candidate changed");
  if (!topCandidateChanged && (candidateScoreChanged || strategyDistributionChanged)) {
    reasons.push("top candidate stayed stable, but candidate surface responded");
  }
  if (influenceTraceGrounded) reasons.push("influence trace references concrete delta paths");

  const verdict: DecisionResponsivenessVerdictLevel = failures.length
    ? "FAIL"
    : warnings.length
      ? "WARN"
      : topCandidateChanged
        ? "PASS"
        : "PASS_WITH_STABLE_TOP_DECISION";

  return {
    candidateScoreChanged,
    topCandidateChanged,
    strategyDistributionChanged,
    influenceTraceGrounded,
    responsivenessScore,
    overreactionScore,
    verdict,
    reasons,
    warnings,
    failures,
  };
}

function computeScenarioRelevance(input: BuildDecisionInfluenceLayerInput): number {
  const scenarioText = textForScenario(input.followUpScenario);
  const deltaText = [
    ...input.memoryDelta.map((delta) => `${delta.id} ${delta.before ?? ""} ${delta.after ?? ""}`),
    ...input.beliefDelta.map((delta) => delta.id),
    ...input.needDelta.map((delta) => delta.id),
    ...input.desireDelta.map((delta) => delta.id),
  ].join(" ");
  let score = 0.2;
  if (hasAny(scenarioText, ["王雪", "亲密", "关系", "信任", "回复", "朋友", "合作", "依赖"])) score += 0.34;
  if (hasAny(deltaText, ["王雪", "亲密", "关系", "失联", "等待", "朋友", "抛弃", "abandonment"])) score += 0.32;
  if (hasAny(scenarioText, ["学业", "失败", "能力", "自尊", "挑战", "努力"])) score += hasAny(deltaText, ["失败", "能力", "羞耻", "success"]) ? 0.36 : 0;
  if (hasAny(scenarioText, ["疲劳", "身体", "执行", "耐心", "行动"])) score += hasAny(deltaText, ["fatigue", "sleep", "energy"]) ? 0.36 : 0;
  if (input.emotionDelta?.primary === "joy" && hasAny(scenarioText, ["支持", "修复", "解释", "关系"])) score += 0.12;
  return round4(clamp01(score));
}

function computeStateDeltaMagnitude(input: {
  personalityDelta: readonly DecisionInfluenceScalarDelta[];
  beliefDelta: readonly DecisionInfluenceScalarDelta[];
  needDelta: readonly DecisionInfluenceScalarDelta[];
  desireDelta: readonly DecisionInfluenceScalarDelta[];
  boundaryDelta?: readonly DecisionInfluenceScalarDelta[];
  memoryDelta: readonly DecisionInfluenceTextDelta[];
  emotionDelta?: DecisionInfluenceEmotionDelta;
}): number {
  const personality = maxAbs(input.personalityDelta) * 3.2;
  const beliefs = avgAbs(input.beliefDelta) * 0.7;
  const needs = avgAbs(input.needDelta) * 0.45;
  const desires = avgAbs(input.desireDelta) * 0.35;
  const boundary = avgAbs(input.boundaryDelta ?? []) * 0.6;
  const memory = input.memoryDelta.length ? 0.04 : 0;
  const emotion = (input.emotionDelta?.intensity ?? 0) * 0.08;
  return round4(clamp01(personality + beliefs + needs + desires + boundary + memory + emotion));
}

function distributionDistance(before: Record<string, number>, after: Record<string, number>): number {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  return round4([...ids].reduce((sum, id) => sum + Math.abs((after[id] ?? 0) - (before[id] ?? 0)), 0) / 2);
}

function tagForStrategy(id: BehaviorStrategyId): string {
  if (id === "attachment_checking" || id === "seek_support") return "relationship_confirmation";
  if (id === "verify_before_commitment" || id === "demand_written_terms" || id === "small_scale_trial") return "evidence_testing";
  if (id === "emotional_withdrawal" || id === "avoid_dependency" || id === "resource_protective_refusal") return "defensive_distance";
  if (id === "confront_directly" || id === "fairness_correction" || id === "revenge_or_rectify") return "confrontation";
  if (id === "negotiate_control" || id === "power_grab" || id === "boundary_assertion") return "control_boundary";
  if (id === "reframe_as_growth" || id === "direct_join" || id === "exploit_opportunity") return "open_repair";
  return "general_strategy";
}

function riskForStrategy(id: BehaviorStrategyId): DecisionActionCandidateSurface["riskProfile"] {
  if (id === "impulsive_join" || id === "power_grab" || id === "revenge_or_rectify" || id === "confront_directly") return "high";
  if (id === "direct_join" || id === "exploit_opportunity" || id === "self_sacrifice") return "medium";
  return "low";
}

function styleForStrategy(id: BehaviorStrategyId): DecisionActionCandidateSurface["approachStyle"] {
  if (id === "direct_join" || id === "exploit_opportunity" || id === "impulsive_join") return "open";
  if (id === "emotional_withdrawal" || id === "avoid_dependency" || id === "resource_protective_refusal") return "defensive";
  if (id === "confront_directly" || id === "fairness_correction" || id === "revenge_or_rectify") return "confrontational";
  if (id === "reframe_as_growth" || id === "seek_support") return "repairing";
  if (id === "negotiate_control" || id === "power_grab" || id === "boundary_assertion") return "controlling";
  return "cautious";
}

function textForScenario(scenario: EnvironmentSeed): string {
  return `${scenario.id} ${scenario.name} ${scenario.trigger} ${scenario.stressor} ${scenario.testFocus}`;
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasSupportiveDelta(input: BuildDecisionInfluenceLayerInput): boolean {
  return input.memoryDelta.some((delta) => hasAny(`${delta.id} ${delta.after ?? ""}`, ["解释", "陪伴", "支持", "安慰", "留下", "靠近", "新证据"])) ||
    input.emotionDelta?.primary === "relief" ||
    input.emotionDelta?.primary === "joy";
}

function mentionsAttachmentRisk(text: string): boolean {
  return hasAny(text, ["abandonment", "attachment", "trust", "relationship", "抛弃", "依恋", "信任", "关系"]);
}

function maxAbs(items: readonly DecisionInfluenceScalarDelta[]): number {
  return items.reduce((max, item) => Math.max(max, Math.abs(item.delta)), 0);
}

function avgAbs(items: readonly DecisionInfluenceScalarDelta[]): number {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + Math.abs(item.delta), 0) / items.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampSigned(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
