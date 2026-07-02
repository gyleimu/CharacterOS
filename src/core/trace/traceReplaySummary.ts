import type { PersonalityCoordinateValues } from "../personality/coordinate";
import { round4 } from "../parameters/parameterMath";
import {
  buildTraceReplayArtifact,
  traceReplayScenarios,
  type TraceReplayArtifact,
  type TraceReplayScenarioId,
  type TraceReplayStepArtifact
} from "./traceReplay";

export interface TraceReplayClusterTrend {
  category: string;
  firstMass: number;
  lastMass: number;
  massDelta: number;
  firstDensity: number;
  lastDensity: number;
  densityDelta: number;
  firstStability: number;
  lastStability: number;
  stabilityDelta: number;
}

export interface TraceReplaySummary {
  scenario: string;
  title: string;
  steps: number;
  coordinateDelta: PersonalityCoordinateValues;
  firstForce: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  lastForce: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  forceDelta: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  firstVelocity: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  lastVelocity: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  velocityDelta: Pick<PersonalityCoordinateValues, "trust" | "fear">;
  clusterTrends: TraceReplayClusterTrend[];
  dominantClusterCategory: string;
  dominantDirection: string;
}

export interface TraceReplaySummaryIndex {
  title: string;
  scenarioCount: number;
  summaries: TraceReplaySummary[];
  directionCounts: Record<string, number>;
}

export type TraceReplaySummarySortMode = "dominantMassDelta" | "trustDrift" | "fearDrift" | "title";

export interface TraceReplaySummaryIndexQuery {
  direction?: string;
  sort?: TraceReplaySummarySortMode;
}

export interface TraceReplaySummaryValidationResult {
  valid: boolean;
  errors: string[];
}

export function buildTraceReplaySummaryIndex(params: {
  daysPerStep?: number;
  query?: TraceReplaySummaryIndexQuery;
} = {}): TraceReplaySummaryIndex {
  const scenarios = Object.keys(traceReplayScenarios) as TraceReplayScenarioId[];
  const summaries = applySummaryQuery(scenarios.map((scenario) => {
    const artifactParams = params.daysPerStep === undefined
      ? { scenario }
      : { scenario, daysPerStep: params.daysPerStep };
    return summarizeTraceReplayArtifact(buildTraceReplayArtifact(artifactParams));
  }), params.query);
  return {
    title: "CharacterOS V2 trace replay summary index",
    scenarioCount: summaries.length,
    summaries,
    directionCounts: countDirections(summaries)
  };
}

export function applySummaryQuery(
  summaries: TraceReplaySummary[],
  query: TraceReplaySummaryIndexQuery = {}
): TraceReplaySummary[] {
  const filtered = query.direction && query.direction !== "all"
    ? summaries.filter((summary) => summary.dominantDirection === query.direction)
    : summaries;
  return [...filtered].sort((a, b) => compareSummaries(a, b, query.sort ?? "dominantMassDelta"));
}

export function summarizeTraceReplayArtifact(artifact: TraceReplayArtifact): TraceReplaySummary {
  const firstStep = artifact.steps[0];
  const lastStep = artifact.steps.at(-1);
  if (!firstStep || !lastStep) {
    throw new Error("Trace replay artifact must contain at least one step");
  }
  const clusterTrends = summarizeClusterTrends(artifact.steps);

  return {
    scenario: artifact.scenario,
    title: artifact.scenarioMeta.title,
    steps: artifact.steps.length,
    coordinateDelta: diffCoordinate(artifact.finalCoordinate, artifact.initialCoordinate),
    firstForce: pickTrustFear(firstStep.force),
    lastForce: pickTrustFear(lastStep.force),
    forceDelta: diffTrustFear(lastStep.force, firstStep.force),
    firstVelocity: pickTrustFear(firstStep.velocity),
    lastVelocity: pickTrustFear(lastStep.velocity),
    velocityDelta: diffTrustFear(lastStep.velocity, firstStep.velocity),
    clusterTrends,
    dominantClusterCategory: findDominantClusterCategory(clusterTrends),
    dominantDirection: describeDominantDirection(artifact.finalCoordinate, artifact.initialCoordinate)
  };
}

export function validateTraceReplaySummary(value: unknown): TraceReplaySummaryValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["summary must be an object"] };
  }
  if (typeof value.scenario !== "string" || !value.scenario) errors.push("summary.scenario must be a non-empty string");
  if (typeof value.title !== "string" || !value.title) errors.push("summary.title must be a non-empty string");
  if (!isNumber(value.steps) || value.steps <= 0) errors.push("summary.steps must be a positive number");
  if (!isCoordinateRecord(value.coordinateDelta)) errors.push("summary.coordinateDelta must be a coordinate record");
  if (!isTrustFearRecord(value.firstForce)) errors.push("summary.firstForce must contain trust and fear");
  if (!isTrustFearRecord(value.lastForce)) errors.push("summary.lastForce must contain trust and fear");
  if (!isTrustFearRecord(value.forceDelta)) errors.push("summary.forceDelta must contain trust and fear");
  if (!isTrustFearRecord(value.firstVelocity)) errors.push("summary.firstVelocity must contain trust and fear");
  if (!isTrustFearRecord(value.lastVelocity)) errors.push("summary.lastVelocity must contain trust and fear");
  if (!isTrustFearRecord(value.velocityDelta)) errors.push("summary.velocityDelta must contain trust and fear");
  if (!Array.isArray(value.clusterTrends) || value.clusterTrends.length === 0) {
    errors.push("summary.clusterTrends must be a non-empty array");
  } else {
    value.clusterTrends.forEach((trend, index) => validateClusterTrend(trend, `summary.clusterTrends[${index}]`, errors));
  }
  if (typeof value.dominantDirection !== "string" || !value.dominantDirection) {
    errors.push("summary.dominantDirection must be a non-empty string");
  }
  if (typeof value.dominantClusterCategory !== "string" || !value.dominantClusterCategory) {
    errors.push("summary.dominantClusterCategory must be a non-empty string");
  }
  return { valid: errors.length === 0, errors };
}

export function validateTraceReplaySummaryIndex(value: unknown): TraceReplaySummaryValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["summary index must be an object"] };
  }
  if (typeof value.title !== "string" || !value.title) errors.push("index.title must be a non-empty string");
  if (!isNumber(value.scenarioCount) || value.scenarioCount <= 0) errors.push("index.scenarioCount must be a positive number");
  if (!Array.isArray(value.summaries) || value.summaries.length === 0) {
    errors.push("index.summaries must be a non-empty array");
  } else {
    value.summaries.forEach((summary, index) => {
      const validation = validateTraceReplaySummary(summary);
      for (const error of validation.errors) {
        errors.push(`index.summaries[${index}].${error}`);
      }
    });
    if (isNumber(value.scenarioCount) && value.summaries.length !== value.scenarioCount) {
      errors.push("index.scenarioCount must match summaries length");
    }
  }
  if (!isRecord(value.directionCounts)) {
    errors.push("index.directionCounts must be an object");
  } else {
    for (const [direction, count] of Object.entries(value.directionCounts)) {
      if (!direction) errors.push("index.directionCounts keys must be non-empty");
      if (!isNumber(count) || count < 0) errors.push(`index.directionCounts.${direction} must be a non-negative number`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function countDirections(summaries: TraceReplaySummary[]): Record<string, number> {
  return summaries.reduce<Record<string, number>>((counts, summary) => {
    counts[summary.dominantDirection] = (counts[summary.dominantDirection] ?? 0) + 1;
    return counts;
  }, {});
}

function compareSummaries(
  a: TraceReplaySummary,
  b: TraceReplaySummary,
  sort: TraceReplaySummarySortMode
): number {
  if (sort === "title") return a.title.localeCompare(b.title, "zh-Hans-CN");
  if (sort === "trustDrift") return Math.abs(b.coordinateDelta.trust) - Math.abs(a.coordinateDelta.trust);
  if (sort === "fearDrift") return Math.abs(b.coordinateDelta.fear) - Math.abs(a.coordinateDelta.fear);
  return dominantMassDelta(b) - dominantMassDelta(a);
}

function dominantMassDelta(summary: TraceReplaySummary): number {
  return summary.clusterTrends.find((trend) => trend.category === summary.dominantClusterCategory)?.massDelta ?? 0;
}

function summarizeClusterTrends(steps: TraceReplayStepArtifact[]): TraceReplayClusterTrend[] {
  const categories = new Set<string>();
  for (const step of steps) {
    for (const metric of step.clusterMetrics) {
      categories.add(metric.category);
    }
  }

  const trends: TraceReplayClusterTrend[] = [];
  for (const category of categories) {
    const first = findFirstMetric(steps, category);
    const last = findLastMetric(steps, category);
    if (!first || !last) continue;
    trends.push({
      category,
      firstMass: first.mass,
      lastMass: last.mass,
      massDelta: round4(last.mass - first.mass),
      firstDensity: first.density,
      lastDensity: last.density,
      densityDelta: round4(last.density - first.density),
      firstStability: first.stability,
      lastStability: last.stability,
      stabilityDelta: round4(last.stability - first.stability)
    });
  }
  return trends;
}

function findDominantClusterCategory(trends: TraceReplayClusterTrend[]): string {
  const dominant = [...trends].sort((a, b) => b.massDelta - a.massDelta)[0];
  return dominant?.category ?? "unknown";
}

function findFirstMetric(steps: TraceReplayStepArtifact[], category: string) {
  for (const step of steps) {
    const metric = step.clusterMetrics.find((item) => item.category === category);
    if (metric) return metric;
  }
  return undefined;
}

function findLastMetric(steps: TraceReplayStepArtifact[], category: string) {
  for (const step of [...steps].reverse()) {
    const metric = step.clusterMetrics.find((item) => item.category === category);
    if (metric) return metric;
  }
  return undefined;
}

function describeDominantDirection(
  finalCoordinate: PersonalityCoordinateValues,
  initialCoordinate: PersonalityCoordinateValues
): string {
  const trust = round4(finalCoordinate.trust - initialCoordinate.trust);
  const fear = round4(finalCoordinate.fear - initialCoordinate.fear);
  if (trust < 0 && fear > 0) return "defensive_drift";
  if (trust > 0 && fear < 0) return "recovery_drift";
  if (trust > 0 && fear >= 0) return "mixed_opening";
  if (trust <= 0 && fear < 0) return "mixed_cooling";
  return "balanced_or_minimal";
}

function diffCoordinate(
  after: PersonalityCoordinateValues,
  before: PersonalityCoordinateValues
): PersonalityCoordinateValues {
  return Object.fromEntries(
    Object.keys(after).map((key) => [
      key,
      round4(after[key as keyof PersonalityCoordinateValues] - before[key as keyof PersonalityCoordinateValues])
    ])
  ) as PersonalityCoordinateValues;
}

function pickTrustFear(values: PersonalityCoordinateValues): Pick<PersonalityCoordinateValues, "trust" | "fear"> {
  return {
    trust: values.trust,
    fear: values.fear
  };
}

function diffTrustFear(
  after: PersonalityCoordinateValues,
  before: PersonalityCoordinateValues
): Pick<PersonalityCoordinateValues, "trust" | "fear"> {
  return {
    trust: round4(after.trust - before.trust),
    fear: round4(after.fear - before.fear)
  };
}
function validateClusterTrend(value: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof value.category !== "string" || !value.category) errors.push(`${prefix}.category must be a non-empty string`);
  if (!isNumber(value.firstMass)) errors.push(`${prefix}.firstMass must be a number`);
  if (!isNumber(value.lastMass)) errors.push(`${prefix}.lastMass must be a number`);
  if (!isNumber(value.massDelta)) errors.push(`${prefix}.massDelta must be a number`);
  if (!isNumber(value.firstDensity)) errors.push(`${prefix}.firstDensity must be a number`);
  if (!isNumber(value.lastDensity)) errors.push(`${prefix}.lastDensity must be a number`);
  if (!isNumber(value.densityDelta)) errors.push(`${prefix}.densityDelta must be a number`);
  if (!isNumber(value.firstStability)) errors.push(`${prefix}.firstStability must be a number`);
  if (!isNumber(value.lastStability)) errors.push(`${prefix}.lastStability must be a number`);
  if (!isNumber(value.stabilityDelta)) errors.push(`${prefix}.stabilityDelta must be a number`);
}

function isCoordinateRecord(value: unknown): value is PersonalityCoordinateValues {
  return isRecord(value) &&
    isNumber(value.openness) &&
    isNumber(value.conscientiousness) &&
    isNumber(value.extroversion) &&
    isNumber(value.agreeableness) &&
    isNumber(value.neuroticism) &&
    isNumber(value.trust) &&
    isNumber(value.attachment) &&
    isNumber(value.fear) &&
    isNumber(value.control);
}

function isTrustFearRecord(value: unknown): value is Pick<PersonalityCoordinateValues, "trust" | "fear"> {
  return isRecord(value) && isNumber(value.trust) && isNumber(value.fear);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
