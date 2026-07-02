import type { ParsedExperienceEvent } from "../event/eventParser";
import type { PersonalityCoordinateValues } from "../personality/coordinate";
import type { EnvironmentSeed } from "../differentiation/characterDifferentiation";
import type { DecisionInfluenceLayerResult } from "../differentiation/decisionInfluenceLayer";
import type {
  RealityAuditScalarDelta,
  RealityAuditTextDelta,
} from "./realityAudit";

export type ImpactCalibrationVerdictLevel = "PASS" | "PASS_WITH_RESILIENCE_BUFFER" | "WARN" | "FAIL";
export type ImpactCalibrationChannel =
  | "memoryImpact"
  | "emotionDelta"
  | "needDelta"
  | "boundaryDelta"
  | "beliefDelta"
  | "personalityCoordinateDelta"
  | "decisionSurfaceDelta";

export interface ImpactCalibrationChannelRange {
  channel: ImpactCalibrationChannel;
  expectedMin: number;
  expectedMax: number;
  rationale: string;
}

export interface ImpactCalibrationAuditInput {
  parsedEvent: ParsedExperienceEvent;
  impactParticles: readonly {
    category: string;
    emotion: string;
    impactScore: number;
    vector: PersonalityCoordinateValues;
  }[];
  beforeState: {
    coordinate: PersonalityCoordinateValues;
    boundaryStressLoad: number;
  };
  afterState: {
    coordinate: PersonalityCoordinateValues;
    boundaryStressLoad: number;
  };
  memoryDelta: readonly RealityAuditTextDelta[];
  beliefDelta: readonly RealityAuditScalarDelta[];
  personalityDelta: readonly RealityAuditScalarDelta[];
  needDelta: readonly RealityAuditScalarDelta[];
  desireDelta: readonly RealityAuditScalarDelta[];
  boundaryDelta: readonly RealityAuditScalarDelta[];
  emotionDelta: {
    primary: string;
    valence: number;
    arousal: number;
    intensity: number;
    deltaIntensity: number;
  };
  followUpScenario: EnvironmentSeed;
  decisionInfluence: DecisionInfluenceLayerResult;
}

export interface ImpactCalibrationAuditResult {
  eventSeverityScore: number;
  domainRelevanceScore: number;
  baselineStabilityScore: number;
  resilienceBufferScore: number;
  repetitionScore: number;
  emotionalIntensityScore: number;
  channelImpactAllocation: Record<ImpactCalibrationChannel, number>;
  expectedDeltaRange: ImpactCalibrationChannelRange[];
  actualDeltaByChannel: Record<ImpactCalibrationChannel, number>;
  underResponseWarnings: string[];
  overResponseWarnings: string[];
  calibrationVerdict: {
    level: ImpactCalibrationVerdictLevel;
    passed: boolean;
    reasons: string[];
    warnings: string[];
    failures: string[];
  };
}

const CHANNELS: ImpactCalibrationChannel[] = [
  "memoryImpact",
  "emotionDelta",
  "needDelta",
  "boundaryDelta",
  "beliefDelta",
  "personalityCoordinateDelta",
  "decisionSurfaceDelta",
];

export function runImpactCalibrationAudit(input: ImpactCalibrationAuditInput): ImpactCalibrationAuditResult {
  const eventSeverityScore = estimateEventSeverity(input);
  const domainRelevanceScore = estimateDomainRelevance(input);
  const baselineStabilityScore = estimateBaselineStability(input);
  const resilienceBufferScore = estimateResilienceBuffer(input, baselineStabilityScore);
  const repetitionScore = estimateRepetition(input);
  const emotionalIntensityScore = round4(clamp01(input.emotionDelta.intensity || input.parsedEvent.intensity));
  const category = input.parsedEvent.category ?? "general";
  const channelImpactAllocation = allocateChannelImpact({
    eventSeverityScore,
    domainRelevanceScore,
    baselineStabilityScore,
    resilienceBufferScore,
    repetitionScore,
    emotionalIntensityScore,
    category,
  });
  const expectedDeltaRange = buildExpectedRanges(channelImpactAllocation, category);
  const actualDeltaByChannel = measureActualDeltas(input);
  const underResponseWarnings = findUnderResponses(expectedDeltaRange, actualDeltaByChannel, input);
  const overResponseWarnings = findOverResponses(expectedDeltaRange, actualDeltaByChannel, input);
  const calibrationVerdict = buildCalibrationVerdict({
    underResponseWarnings,
    overResponseWarnings,
    expectedDeltaRange,
    actualDeltaByChannel,
    resilienceBufferScore,
  });

  return {
    eventSeverityScore,
    domainRelevanceScore,
    baselineStabilityScore,
    resilienceBufferScore,
    repetitionScore,
    emotionalIntensityScore,
    channelImpactAllocation,
    expectedDeltaRange,
    actualDeltaByChannel,
    underResponseWarnings,
    overResponseWarnings,
    calibrationVerdict,
  };
}

function estimateEventSeverity(input: ImpactCalibrationAuditInput): number {
  const impact = input.impactParticles[0]?.impactScore ?? input.parsedEvent.intensity;
  const categoryBoost =
    input.parsedEvent.category === "betrayal" || input.parsedEvent.category === "abandonment"
      ? 0.08
      : input.parsedEvent.category === "support" || input.parsedEvent.category === "success"
        ? 0.03
        : 0;
  return round4(clamp01(impact * 0.62 + input.parsedEvent.importance * 0.22 + input.parsedEvent.expectationGap * 0.16 + categoryBoost));
}

function estimateDomainRelevance(input: ImpactCalibrationAuditInput): number {
  const eventText = `${input.parsedEvent.description} ${input.parsedEvent.tags.join(" ")} ${input.parsedEvent.category}`;
  const scenarioText = `${input.followUpScenario.name} ${input.followUpScenario.trigger} ${input.followUpScenario.stressor} ${input.followUpScenario.testFocus}`;
  let score = 0.18;

  // Relationship / attachment events → relationship / trust scenarios
  if (hasAny(eventText, ["失联", "抛弃", "背叛", "亲密", "王雪", "朋友", "拒绝", "冷淡", "疏远"]) && hasAny(scenarioText, ["关系", "信任", "亲密", "回复", "朋友", "依赖", "社交"])) score += 0.58;
  // Support / repair events → relationship repair scenarios
  if (hasAny(eventText, ["支持", "解释", "陪伴", "安慰"]) && hasAny(scenarioText, ["关系", "修复", "信任", "支持"])) score += 0.5;
  // Achievement / failure / success events → challenge / ability scenarios
  if (hasAny(eventText, ["失败", "考试", "学业", "能力", "成功", "认可", "表扬", "晋升", "被否定", "落选"]) && hasAny(scenarioText, ["挑战", "学业", "能力", "自尊", "努力"])) score += 0.55;
  // Fatigue / body events → action / patience scenarios
  if (hasAny(eventText, ["疲劳", "睡眠", "身体", "乏力", "困", "体力"]) && hasAny(scenarioText, ["执行", "耐心", "行动", "身体"])) score += 0.5;
  // Conflict / social events → social scenarios
  if (hasAny(eventText, ["冲突", "指责", "批评", "对峙"]) && hasAny(scenarioText, ["社交", "评价", "自我呈现"])) score += 0.5;
  // Uncertainty events → trust / verification scenarios
  if (hasAny(eventText, ["不确定", "模糊", "犹豫", "矛盾"]) && hasAny(scenarioText, ["关系", "信任", "验证", "回复"])) score += 0.42;
  // Category-based fallback for cases where keyword matching alone fails
  if (score < 0.25) {
    const category = input.parsedEvent.category;
    if ((category === "abandonment" || category === "betrayal" || category === "rejection") && hasAny(scenarioText, ["关系", "信任", "社交"])) score = Math.max(score, 0.5);
    if ((category === "support") && hasAny(scenarioText, ["关系", "修复", "信任"])) score = Math.max(score, 0.5);
    if ((category === "success" || category === "failure") && hasAny(scenarioText, ["挑战", "学业", "能力", "自尊"])) score = Math.max(score, 0.5);
    if (category === "fatigue" && hasAny(scenarioText, ["执行", "耐心", "行动", "身体"])) score = Math.max(score, 0.45);
    if (category === "conflict" && hasAny(scenarioText, ["社交", "评价"])) score = Math.max(score, 0.5);
    if (category === "uncertainty" && hasAny(scenarioText, ["关系", "信任", "验证"])) score = Math.max(score, 0.4);
  }
  return round4(clamp01(score));
}

function estimateBaselineStability(input: ImpactCalibrationAuditInput): number {
  const c = input.beforeState.coordinate;
  const trustStability = c.trust > 0.65 ? 0.24 : c.trust < 0.35 ? -0.08 : 0.05;
  const fearStability = c.fear < 0.35 ? 0.2 : c.fear > 0.7 ? -0.08 : 0.04;
  const neuroticismStability = c.neuroticism < 0.35 ? 0.18 : c.neuroticism > 0.7 ? -0.08 : 0.04;
  const controlStability = c.control > 0.65 ? 0.06 : 0;
  return round4(clamp01(0.42 + trustStability + fearStability + neuroticismStability + controlStability));
}

function estimateResilienceBuffer(input: ImpactCalibrationAuditInput, stability: number): number {
  const stress = clamp01(input.beforeState.boundaryStressLoad);
  return round4(clamp01(stability * 0.62 + (1 - stress) * 0.2 + (input.beforeState.coordinate.trust > 0.6 ? 0.12 : 0)));
}

function estimateRepetition(input: ImpactCalibrationAuditInput): number {
  const memory = input.memoryDelta[0];
  const text = `${memory?.id ?? ""} ${memory?.after ?? ""} ${input.parsedEvent.tags.join(" ")}`;
  const repeatedTags = input.parsedEvent.tags.filter((tag) => text.includes(tag)).length;
  return round4(clamp01(input.parsedEvent.personalitySensitivity * 0.25 + repeatedTags * 0.08));
}

function allocateChannelImpact(params: {
  eventSeverityScore: number;
  domainRelevanceScore: number;
  baselineStabilityScore: number;
  resilienceBufferScore: number;
  repetitionScore: number;
  emotionalIntensityScore: number;
  category: string;
}): Record<ImpactCalibrationChannel, number> {
  const fast = params.eventSeverityScore;
  const relevance = params.domainRelevanceScore;
  const buffer = params.resilienceBufferScore;
  const repeated = params.repetitionScore;
  const positive = params.category === "support" || params.category === "success";
  const personalityBase = fast * relevance * (0.2 + repeated * 0.55) * (1 - buffer * 0.55);
  return {
    memoryImpact: round4(clamp01(fast * 0.92 + params.emotionalIntensityScore * 0.08)),
    emotionDelta: round4(clamp01(params.emotionalIntensityScore * 0.9 + fast * 0.1)),
    needDelta: round4(clamp01(fast * relevance * (positive ? 0.04 : 0.62))),
    boundaryDelta: round4(clamp01(fast * relevance * (positive ? 0.14 : 0.58) * (1 - buffer * 0.25))),
    beliefDelta: round4(clamp01(fast * relevance * (0.32 + repeated * 0.22))),
    personalityCoordinateDelta: round4(clamp01(personalityBase)),
    decisionSurfaceDelta: round4(clamp01(fast * relevance * 0.75)),
  };
}

function buildExpectedRanges(
  allocation: Record<ImpactCalibrationChannel, number>,
  category: string,
): ImpactCalibrationChannelRange[] {
  return CHANNELS.map((channel) => {
    const center = allocation[channel];
    const slow = channel === "personalityCoordinateDelta";
    const wide = channel === "beliefDelta" || channel === "decisionSurfaceDelta";
    const minFactor = slow ? 0.02 : wide ? 0.35 : 0.45;
    const maxFactor = slow ? 1.85 : wide ? 1.75 : 1.55;
    return {
      channel,
      expectedMin: round4(center * minFactor),
      expectedMax: round4(Math.max(center * maxFactor, center + 0.025)),
      rationale: rangeRationale(channel, category),
    };
  });
}

function measureActualDeltas(input: ImpactCalibrationAuditInput): Record<ImpactCalibrationChannel, number> {
  return {
    memoryImpact: round4(input.memoryDelta.length ? input.parsedEvent.importance : 0),
    emotionDelta: round4(clamp01(input.emotionDelta.intensity)),
    needDelta: round4(maxAbs(input.needDelta)),
    boundaryDelta: round4(clamp01(maxAbs(input.boundaryDelta) * 0.45)),
    beliefDelta: round4(maxAbs(input.beliefDelta)),
    personalityCoordinateDelta: round4(maxAbs(input.personalityDelta)),
    decisionSurfaceDelta: round4(maxAbsObject(input.decisionInfluence.actionCandidateScoreDelta)),
  };
}

function findUnderResponses(
  ranges: readonly ImpactCalibrationChannelRange[],
  actual: Record<ImpactCalibrationChannel, number>,
  input: ImpactCalibrationAuditInput,
): string[] {
  const warnings: string[] = [];
  for (const range of ranges) {
    if (range.expectedMin < 0.025) continue;
    if (actual[range.channel] + 0.002 < range.expectedMin) {
      warnings.push(`${range.channel} under-responded: actual ${actual[range.channel]} < expected ${range.expectedMin}`);
    }
  }
  if (input.parsedEvent.category === "betrayal" && maxAbs(input.beliefDelta) < 0.08) {
    warnings.push("high severity relationship betrayal did not visibly update trust-related belief");
  }
  if ((input.parsedEvent.category === "abandonment" || input.parsedEvent.category === "betrayal") && maxAbs(input.needDelta) < 0.01) {
    warnings.push("high severity relationship event did not visibly update safety/attachment need");
  }
  return warnings;
}

function findOverResponses(
  ranges: readonly ImpactCalibrationChannelRange[],
  actual: Record<ImpactCalibrationChannel, number>,
  input: ImpactCalibrationAuditInput,
): string[] {
  const warnings: string[] = [];
  for (const range of ranges) {
    if (actual[range.channel] > range.expectedMax + 0.05) {
      warnings.push(`${range.channel} over-responded: actual ${actual[range.channel]} > expected ${range.expectedMax}`);
    }
  }
  if (input.parsedEvent.category === "general" && actual.personalityCoordinateDelta > 0.015) {
    warnings.push("neutral event caused large personality drift");
  }
  if (input.parsedEvent.category === "general" && actual.decisionSurfaceDelta > 0.08 && estimateDomainRelevance(input) < 0.35) {
    warnings.push("low relevance neutral event strongly changed decision surface");
  }
  return warnings;
}

function buildCalibrationVerdict(input: {
  underResponseWarnings: string[];
  overResponseWarnings: string[];
  expectedDeltaRange: readonly ImpactCalibrationChannelRange[];
  actualDeltaByChannel: Record<ImpactCalibrationChannel, number>;
  resilienceBufferScore: number;
}): ImpactCalibrationAuditResult["calibrationVerdict"] {
  const failures: string[] = [];
  const warnings = [...input.underResponseWarnings, ...input.overResponseWarnings];
  const personalityUnder = input.underResponseWarnings.some((warning) => warning.startsWith("personalityCoordinateDelta under-responded"));
  const otherChannelsHealthy = (["memoryImpact", "emotionDelta", "needDelta", "boundaryDelta", "beliefDelta", "decisionSurfaceDelta"] as ImpactCalibrationChannel[])
    .filter((channel) => {
      const range = input.expectedDeltaRange.find((item) => item.channel === channel);
      return range ? input.actualDeltaByChannel[channel] + 0.002 >= Math.min(range.expectedMin, 0.02) : false;
    }).length >= 4;

  if (warnings.length >= 5 && !otherChannelsHealthy) failures.push("multiple channels failed calibration simultaneously");

  const bufferedPersonality =
    input.resilienceBufferScore >= 0.55 &&
    input.actualDeltaByChannel.personalityCoordinateDelta < 0.005 &&
    otherChannelsHealthy;

  if ((personalityUnder && input.resilienceBufferScore >= 0.55 && otherChannelsHealthy) || bufferedPersonality) {
    return {
      level: "PASS_WITH_RESILIENCE_BUFFER",
      passed: true,
      reasons: ["personality coordinate was buffered, while fast/mid channels responded"],
      warnings: warnings.filter((warning) => !warning.startsWith("personalityCoordinateDelta under-responded")),
      failures: [],
    };
  }

  return {
    level: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    passed: failures.length === 0,
    reasons: failures.length || warnings.length ? [] : ["actual channel deltas stayed within calibrated ranges"],
    warnings,
    failures,
  };
}

function rangeRationale(channel: ImpactCalibrationChannel, category: string): string {
  if (channel === "personalityCoordinateDelta") return "personality is a slow variable and is buffered by stability/resilience.";
  if (channel === "memoryImpact") return "event memory can become salient immediately.";
  if (channel === "emotionDelta") return "acute emotion is the fastest channel.";
  if (channel === "decisionSurfaceDelta") return `decision surface can respond quickly when ${category} is scenario-relevant.`;
  return "channel range is allocated from severity, relevance, repetition, and resilience buffer.";
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function maxAbs(deltas: readonly RealityAuditScalarDelta[]): number {
  return deltas.reduce((max, delta) => Math.max(max, Math.abs(delta.delta)), 0);
}

function maxAbsObject(values: Record<string, number>): number {
  return Object.values(values).reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
