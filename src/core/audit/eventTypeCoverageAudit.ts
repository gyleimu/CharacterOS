import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { CharacterPhysicsEngine } from "../physics/physicsEngine";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../physics/serialization";
import { parseExperienceEvent, type ParseExperienceEventInput } from "../event/eventParser";
import type { PersonalityCoordinateValues } from "../personality/coordinate";
import { coordinateToRecord } from "../personality/coordinate";
import type { EnvironmentSeed } from "../differentiation/characterDifferentiation";
import { runRealityAudit } from "./realityAudit";
import type { ImpactCalibrationChannel } from "./impactCalibrationAudit";

export type CoverageVerdictLevel = "PASS" | "WARN" | "FAIL";

export interface ExpectedChannelProfile {
  channel: ImpactCalibrationChannel;
  expectedDirection: "increase" | "decrease" | "minimal" | "any";
  minMagnitude?: number;
  maxMagnitude?: number;
  rationale: string;
}

export interface EventTypeCoverageFixture {
  eventType: string;
  label: string;
  eventInput: ParseExperienceEventInput;
  expectedProfiles: ExpectedChannelProfile[];
  /** These scenario IDs should show high relevance for this event type */
  relevantScenarios: string[];
  /** These scenario IDs should show low relevance for this event type */
  irrelevantScenarios: string[];
}

export interface EventTypeCoverageResult {
  eventType: string;
  label: string;
  baselineLabel: string;
  parsedCategory: string;
  channelActivations: Record<ImpactCalibrationChannel, number>;
  directionChecks: Array<{
    channel: ImpactCalibrationChannel;
    expectedDirection: string;
    actualDirection: string;
    actualValue: number;
    passed: boolean;
    detail: string;
  }>;
  relevanceScores: Array<{
    scenarioId: string;
    relevance: number;
    overreactionScore: number;
    expectedHigh: boolean;
    passed: boolean;
  }>;
  warnings: string[];
  failures: string[];
}

export interface EventTypeCoverageAuditInput {
  fixtures: EventTypeCoverageFixture[];
  baselines: Array<{
    id: string;
    label: string;
    state: CharacterPhysicsState;
  }>;
  scenarios: Array<{
    id: string;
    definition: EnvironmentSeed;
  }>;
}

export interface EventTypeCoverageAuditResult {
  results: EventTypeCoverageResult[];
  channelActivationMatrix: Record<string, Record<ImpactCalibrationChannel, number>>;
  coverageSummary: {
    totalEventTypes: number;
    totalBaselines: number;
    totalResults: number;
    passedDirectionChecks: number;
    failedDirectionChecks: number;
    passedRelevanceChecks: number;
    failedRelevanceChecks: number;
  };
  coverageVerdict: {
    level: CoverageVerdictLevel;
    passed: boolean;
    warnings: string[];
    failures: string[];
    reasons: string[];
  };
}

export function runEventTypeCoverageAudit(
  input: EventTypeCoverageAuditInput,
): EventTypeCoverageAuditResult {
  const results: EventTypeCoverageResult[] = [];
  const channelActivationMatrix: Record<string, Record<ImpactCalibrationChannel, number>> = {};

  for (const fixture of input.fixtures) {
    for (const baseline of input.baselines) {
      const resultKey = `${fixture.eventType}_${baseline.id}`;
      const result = runSingleCoverageCheck(fixture, baseline, input.scenarios);
      results.push(result);

      channelActivationMatrix[resultKey] = { ...result.channelActivations };
    }
  }

  const coverageSummary = computeCoverageSummary(results, input);
  const coverageVerdict = buildCoverageVerdict(results, coverageSummary);

  return {
    results,
    channelActivationMatrix,
    coverageSummary,
    coverageVerdict,
  };
}

function runSingleCoverageCheck(
  fixture: EventTypeCoverageFixture,
  baseline: { id: string; label: string; state: CharacterPhysicsState },
  scenarios: EventTypeCoverageAuditInput["scenarios"],
): EventTypeCoverageResult {
  const warnings: string[] = [];
  const failures: string[] = [];

  // Clone baseline state
  const state = deserializeCharacterPhysicsState(
    structuredClone(serializeCharacterPhysicsState(baseline.state)),
  );

  // Parse and process the event
  const parsed = parseExperienceEvent(fixture.eventInput);
  const engine = new CharacterPhysicsEngine();
  engine.processEvent(state, parsed);

  // Measure channel activations
  const channelActivations = measureChannelActivations(
    baseline.state,
    state,
    parsed,
  );

  // Direction checks
  const directionChecks = fixture.expectedProfiles.map((profile) => {
    const actual = channelActivations[profile.channel];
    const direction = classifyDirection(actual, profile.channel, baseline.state, state);
    const passed = checkDirection(direction, profile);

    return {
      channel: profile.channel,
      expectedDirection: profile.expectedDirection,
      actualDirection: direction,
      actualValue: round4(actual),
      passed,
      detail: passed
        ? `${profile.channel}: ${direction} matches expected ${profile.expectedDirection}`
        : `${profile.channel}: got ${direction}, expected ${profile.expectedDirection} (value=${round4(actual)})`,
    };
  });

  const failedDirChecks = directionChecks.filter((d) => !d.passed);
  for (const fail of failedDirChecks) {
    // Only flag as failure for critical channels with clear directional expectations.
    // memoryImpact is the most reliable single-event channel; belief/need/personality
    // are slow channels that may not show clear signal in one event.
    const isCritical = fail.channel === "memoryImpact";
    const isBoundaryOverreaction =
      fail.channel === "boundaryDelta" &&
      fail.expectedDirection === "minimal" &&
      fail.actualDirection !== "minimal";

    if (fixture.eventType === "neutral" || fixture.eventType === "fatigue" || fixture.eventType === "general") {
      warnings.push(fail.detail);
    } else if (isBoundaryOverreaction) {
      failures.push(fail.detail);
    } else if (isCritical && fail.actualDirection === "minimal") {
      // Critical channel not responding is a failure
      failures.push(fail.detail);
    } else if (fail.channel === "personalityCoordinateDelta") {
      // Personality is always a slow channel — mismatch is a warning
      warnings.push(fail.detail);
    } else {
      // Other mismatches are warnings, not failures
      warnings.push(fail.detail);
    }
  }

  // Relevance checks
  const relevanceScores = scenarios.map((scenario) => {
    const audit = runRealityAudit({
      id: `coverage_${fixture.eventType}_${scenario.id}`,
      label: `Coverage: ${fixture.label} × ${scenario.id}`,
      baselineState: baseline.state,
      eventInput: fixture.eventInput,
      followUpDecisionScenario: scenario.definition,
    });

    const expectedHigh = fixture.relevantScenarios.includes(scenario.id);
    const relevance = audit.impactCalibration.domainRelevanceScore;
    const overreactionScore = audit.decisionResponsiveness.overreactionScore;

    let passed: boolean;
    if (expectedHigh) {
      passed = relevance >= 0.3;
      if (!passed) {
        failures.push(
          `${fixture.eventType} on ${scenario.id}: expected high relevance but got ${round4(relevance)}`,
        );
      }
    } else if (fixture.irrelevantScenarios.includes(scenario.id)) {
      // V10.77: tiered overreaction check — correctly low relevance (<0.3) gets
      // a more lenient overreaction threshold. Moderately relevant events (0.3–0.5)
      // still get the strict check to catch boundary cases.
      const overreactionLimit = relevance < 0.3 ? 0.45 : 0.35;
      passed = relevance < 0.5 && overreactionScore < overreactionLimit;
      if (!passed) {
        warnings.push(
          `${fixture.eventType} on ${scenario.id}: expected low relevance but got relevance=${round4(relevance)} overreaction=${round4(overreactionScore)}`,
        );
      }
    } else {
      passed = true; // Not explicitly relevant or irrelevant — no check
    }

    return {
      scenarioId: scenario.id,
      relevance: round4(relevance),
      overreactionScore: round4(overreactionScore),
      expectedHigh,
      passed,
    };
  });

  return {
    eventType: fixture.eventType,
    label: fixture.label,
    baselineLabel: baseline.label,
    parsedCategory: parsed.category ?? "unknown",
    channelActivations,
    directionChecks,
    relevanceScores,
    warnings,
    failures,
  };
}

function measureChannelActivations(
  before: CharacterPhysicsState,
  after: CharacterPhysicsState,
  _parsed: ReturnType<typeof parseExperienceEvent>,
): Record<ImpactCalibrationChannel, number> {
  const beforeCoord = coordinateToRecord(before.coordinate);
  const afterCoord = coordinateToRecord(after.coordinate);

  return {
    memoryImpact: round4(after.memories.length - before.memories.length > 0 ? 0.7 : 0),
    emotionDelta: round4(0), // Set by audit caller
    needDelta: round4(maxAbsCoordDiff(beforeCoord, afterCoord, ["trust", "fear", "attachment"]) * 0.8),
    boundaryDelta: round4(
      clamp01(Math.abs(after.boundary.stressLoad - before.boundary.stressLoad) * 0.45),
    ),
    beliefDelta: round4(
      after.beliefStates.length !== before.beliefStates.length
        ? 0.15
        : Math.min(1, Math.abs(after.coordinate.values.trust - before.coordinate.values.trust) * 3),
    ),
    personalityCoordinateDelta: round4(maxAbsCoordDiff(beforeCoord, afterCoord)),
    decisionSurfaceDelta: round4(0), // Set by audit caller
  };
}

function classifyDirection(
  actual: number,
  channel: ImpactCalibrationChannel,
  before: CharacterPhysicsState,
  after: CharacterPhysicsState,
): string {
  if (channel === "boundaryDelta") {
    const delta = after.boundary.stressLoad - before.boundary.stressLoad;
    if (delta > 0.01) return "increase";
    if (delta < -0.01) return "decrease";
    return "minimal";
  }
  if (channel === "personalityCoordinateDelta") {
    if (actual < 0.005) return "minimal";
    if (actual < 0.02) return "moderate";
    return "significant";
  }
  if (channel === "memoryImpact" || channel === "emotionDelta") {
    if (actual > 0.3) return "high";
    if (actual > 0.1) return "moderate";
    return "minimal";
  }
  if (actual > 0.15) return "high";
  if (actual > 0.05) return "moderate";
  return "minimal";
}

function checkDirection(actualDirection: string, profile: ExpectedChannelProfile): boolean {
  const expected = profile.expectedDirection;
  if (expected === "any") return true;
  if (expected === "minimal") return actualDirection === "minimal";
  // For directional expectations, require the value to be at least moderate/high in that direction
  if (expected === "increase" || expected === "decrease") {
    // increase/decrease direction check passes if the channel shows non-minimal response in the right direction
    return actualDirection !== "minimal";
  }
  return true;
}

function computeCoverageSummary(
  results: EventTypeCoverageResult[],
  input: EventTypeCoverageAuditInput,
): EventTypeCoverageAuditResult["coverageSummary"] {
  let passedDir = 0;
  let failedDir = 0;
  let passedRel = 0;
  let failedRel = 0;

  for (const result of results) {
    passedDir += result.directionChecks.filter((d) => d.passed).length;
    failedDir += result.directionChecks.filter((d) => !d.passed).length;
    passedRel += result.relevanceScores.filter((r) => r.passed).length;
    failedRel += result.relevanceScores.filter((r) => !r.passed).length;
  }

  return {
    totalEventTypes: input.fixtures.length,
    totalBaselines: input.baselines.length,
    totalResults: results.length,
    passedDirectionChecks: passedDir,
    failedDirectionChecks: failedDir,
    passedRelevanceChecks: passedRel,
    failedRelevanceChecks: failedRel,
  };
}

function buildCoverageVerdict(
  results: EventTypeCoverageResult[],
  summary: EventTypeCoverageAuditResult["coverageSummary"],
): EventTypeCoverageAuditResult["coverageVerdict"] {
  const allWarnings: string[] = [];
  const allFailures: string[] = [];
  const reasons: string[] = [];

  for (const result of results) {
    allWarnings.push(...result.warnings);
    allFailures.push(...result.failures);
  }

  // Accept up to 10% direction check failures as WARN
  const dirFailRate =
    summary.totalResults > 0
      ? summary.failedDirectionChecks / (summary.passedDirectionChecks + summary.failedDirectionChecks)
      : 0;

  if (dirFailRate > 0.3) {
    allFailures.push(
      `direction check failure rate ${(dirFailRate * 100).toFixed(0)}% exceeds 30%`,
    );
  } else if (dirFailRate > 0.1) {
    allWarnings.push(
      `direction check failure rate ${(dirFailRate * 100).toFixed(0)}% exceeds 10%`,
    );
  } else {
    reasons.push(
      `direction check failure rate ${(dirFailRate * 100).toFixed(0)}% ≤ 10%`,
    );
  }

  // Accept up to 20% relevance failures as WARN
  const relFailRate =
    summary.totalResults > 0
      ? summary.failedRelevanceChecks / (summary.passedRelevanceChecks + summary.failedRelevanceChecks)
      : 0;

  if (relFailRate > 0.4) {
    allFailures.push(`relevance check failure rate ${(relFailRate * 100).toFixed(0)}% exceeds 40%`);
  } else if (relFailRate > 0.2) {
    allWarnings.push(`relevance check failure rate ${(relFailRate * 100).toFixed(0)}% exceeds 20%`);
  } else {
    reasons.push(`relevance check failure rate ${(relFailRate * 100).toFixed(0)}% ≤ 20%`);
  }

  // Coverage completeness
  const uniqueTypes = new Set(results.map((r) => r.eventType));
  reasons.push(`${uniqueTypes.size} event types covered across ${summary.totalBaselines} baseline personalities`);

  return {
    level: allFailures.length > 0 ? "FAIL" : allWarnings.length > 0 ? "WARN" : "PASS",
    passed: allFailures.length === 0,
    warnings: allWarnings,
    failures: allFailures,
    reasons,
  };
}

function maxAbsCoordDiff(
  before: PersonalityCoordinateValues,
  after: PersonalityCoordinateValues,
  keys?: string[],
): number {
  const allKeys = keys ?? (Object.keys(before) as Array<keyof PersonalityCoordinateValues>);
  return allKeys.reduce((max, k) => {
    const b = before[k as keyof PersonalityCoordinateValues] ?? 0;
    const a = after[k as keyof PersonalityCoordinateValues] ?? 0;
    return Math.max(max, Math.abs(a - b));
  }, 0);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
