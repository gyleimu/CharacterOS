import {
  buildTraceReplayArtifact,
  traceReplayScenarios,
  type TraceReplayScenarioId
} from "./traceReplay";
import { clamp, round4 } from "../parameters/parameterMath";
import { summarizeTraceReplayArtifact, type TraceReplaySummary } from "./traceReplaySummary";

export type CalibrationSeverity = "pass" | "warn" | "fail";

export interface ReplayCalibrationCheck {
  name: string;
  severity: CalibrationSeverity;
  message: string;
  value: number | string;
}

export interface ReplayCalibrationResult {
  scenario: TraceReplayScenarioId;
  title: string;
  summary: TraceReplaySummary;
  checks: ReplayCalibrationCheck[];
  passed: boolean;
}

export interface ReplayCalibrationSuite {
  title: string;
  parameters: ReplayCalibrationParameters;
  results: ReplayCalibrationResult[];
  passed: boolean;
}

export interface ReplayCalibrationParameters {
  daysPerStep: number;
  learningRate: number;
  maxDriftMagnitude: number;
  minObservableDrift: number;
  maxVelocity: number;
}

export interface ReplayCalibrationValidationResult {
  valid: boolean;
  errors: string[];
}

export function buildReplayCalibrationSuite(params: {
  daysPerStep?: number;
  learningRate?: number;
  maxDriftMagnitude?: number;
  minObservableDrift?: number;
  maxVelocity?: number;
} = {}): ReplayCalibrationSuite {
  const parameters = normalizeCalibrationParameters(params);
  const scenarioIds = Object.keys(traceReplayScenarios) as TraceReplayScenarioId[];
  const results = scenarioIds.map((scenario) => calibrateScenario(scenario, parameters));
  return {
    title: "CharacterOS replay calibration suite",
    parameters,
    results,
    passed: results.every((result) => result.passed)
  };
}

export function calibrateScenario(
  scenario: TraceReplayScenarioId,
  params: number | ReplayCalibrationParameters = defaultCalibrationParameters()
): ReplayCalibrationResult {
  const parameters = typeof params === "number"
    ? normalizeCalibrationParameters({ daysPerStep: params })
    : normalizeCalibrationParameters(params);
  const artifact = buildTraceReplayArtifact({
    scenario,
    daysPerStep: parameters.daysPerStep,
    learningRate: parameters.learningRate
  });
  const summary = summarizeTraceReplayArtifact(artifact);
  const checks = [
    directionCheck(summary),
    driftMagnitudeCheck(summary, parameters),
    velocityCapCheck(summary, parameters),
    dominantClusterMassCheck(summary)
  ];
  return {
    scenario,
    title: summary.title,
    summary,
    checks,
    passed: checks.every((check) => check.severity !== "fail")
  };
}

export function validateReplayCalibrationSuite(value: unknown): ReplayCalibrationValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["calibration suite must be an object"] };
  }
  if (typeof value.title !== "string" || !value.title) {
    errors.push("calibration.title must be a non-empty string");
  }
  if (!isCalibrationParameters(value.parameters)) {
    errors.push("calibration.parameters must contain finite calibration thresholds");
  }
  if (typeof value.passed !== "boolean") {
    errors.push("calibration.passed must be a boolean");
  }
  if (!Array.isArray(value.results) || value.results.length === 0) {
    errors.push("calibration.results must be a non-empty array");
  } else {
    value.results.forEach((result, index) => validateCalibrationResult(result, `calibration.results[${index}]`, errors));
    if (typeof value.passed === "boolean") {
      const derivedPassed = value.results.every((result) => (
        isRecord(result) &&
        Array.isArray(result.checks) &&
        result.checks.every((check) => isRecord(check) && check.severity !== "fail")
      ));
      if (value.passed !== derivedPassed) {
        errors.push("calibration.passed must match derived check severities");
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function directionCheck(summary: TraceReplaySummary): ReplayCalibrationCheck {
  const valid = expectedDirections(summary.scenario);
  const passed = valid.includes(summary.dominantDirection);
  return {
    name: "dominant direction",
    severity: passed ? "pass" : "fail",
    message: passed
      ? `dominant direction ${summary.dominantDirection} is in expected set [${valid.join(", ")}]`
      : `expected one of [${valid.join(", ")}], got ${summary.dominantDirection}`,
    value: summary.dominantDirection
  };
}

function driftMagnitudeCheck(
  summary: TraceReplaySummary,
  parameters: ReplayCalibrationParameters
): ReplayCalibrationCheck {
  const magnitude = Math.abs(summary.coordinateDelta.trust) + Math.abs(summary.coordinateDelta.fear);
  if (magnitude > parameters.maxDriftMagnitude) {
    return {
      name: "drift magnitude",
      severity: "fail",
      message: "personality drift is too large for a short replay",
      value: round4(magnitude)
    };
  }
  if (magnitude < parameters.minObservableDrift) {
    return {
      name: "drift magnitude",
      severity: "warn",
      message: "personality drift is very small; scenario may be too weak to inspect",
      value: round4(magnitude)
    };
  }
  return {
    name: "drift magnitude",
    severity: "pass",
    message: "personality drift is bounded and observable",
    value: round4(magnitude)
  };
}

function velocityCapCheck(
  summary: TraceReplaySummary,
  parameters: ReplayCalibrationParameters
): ReplayCalibrationCheck {
  const maxVelocity = Math.max(Math.abs(summary.lastVelocity.trust), Math.abs(summary.lastVelocity.fear));
  return {
    name: "velocity cap",
    severity: maxVelocity <= parameters.maxVelocity ? "pass" : "fail",
    message: maxVelocity <= parameters.maxVelocity
      ? "personality velocity stays within per-step cap"
      : "personality velocity exceeded per-step cap",
    value: round4(maxVelocity)
  };
}

function dominantClusterMassCheck(summary: TraceReplaySummary): ReplayCalibrationCheck {
  const trend = summary.clusterTrends.find((item) => item.category === summary.dominantClusterCategory);
  const massDelta = trend?.massDelta ?? 0;
  return {
    name: "dominant cluster mass",
    severity: massDelta > 0 ? "pass" : "warn",
    message: massDelta > 0
      ? "dominant cluster gained mass across replay"
      : "dominant cluster did not gain mass; inspect scenario construction",
    value: round4(massDelta)
  };
}

function expectedDirections(scenario: string): string[] {
  if (scenario === "success_recovery" || scenario === "support_recovery_accumulation") return ["recovery_drift"];
  // V10.72: abandonment_then_repair has 2 abandonment + 2 support;
  // with repair nudge active, net direction may be mixed or recovery
  if (scenario === "abandonment_then_repair") return ["recovery_drift", "mixed_opening", "defensive_drift"];
  return ["defensive_drift"];
}

function defaultCalibrationParameters(): ReplayCalibrationParameters {
  return {
    daysPerStep: 14,
    learningRate: 0.03,
    maxDriftMagnitude: 0.35,
    minObservableDrift: 0.002,
    maxVelocity: 0.08
  };
}

function normalizeCalibrationParameters(params: Partial<ReplayCalibrationParameters>): ReplayCalibrationParameters {
  const defaults = defaultCalibrationParameters();
  return {
    daysPerStep: clampNumber(params.daysPerStep, 1, 365, defaults.daysPerStep),
    learningRate: clampNumber(params.learningRate, 0.001, 0.2, defaults.learningRate),
    maxDriftMagnitude: clampNumber(params.maxDriftMagnitude, 0.001, 1, defaults.maxDriftMagnitude),
    minObservableDrift: clampNumber(params.minObservableDrift, 0, 0.5, defaults.minObservableDrift),
    maxVelocity: clampNumber(params.maxVelocity, 0.001, 1, defaults.maxVelocity)
  };
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function isCalibrationParameters(value: unknown): value is ReplayCalibrationParameters {
  return isRecord(value) &&
    isFiniteNumber(value.daysPerStep) &&
    isFiniteNumber(value.learningRate) &&
    isFiniteNumber(value.maxDriftMagnitude) &&
    isFiniteNumber(value.minObservableDrift) &&
    isFiniteNumber(value.maxVelocity);
}

function validateCalibrationResult(value: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof value.scenario !== "string" || !value.scenario) errors.push(`${prefix}.scenario must be a non-empty string`);
  if (typeof value.title !== "string" || !value.title) errors.push(`${prefix}.title must be a non-empty string`);
  if (typeof value.passed !== "boolean") errors.push(`${prefix}.passed must be a boolean`);
  if (!isRecord(value.summary)) errors.push(`${prefix}.summary must be an object`);
  if (!Array.isArray(value.checks) || value.checks.length === 0) {
    errors.push(`${prefix}.checks must be a non-empty array`);
  } else {
    value.checks.forEach((check, index) => validateCalibrationCheck(check, `${prefix}.checks[${index}]`, errors));
    if (typeof value.passed === "boolean") {
      const derivedPassed = value.checks.every((check) => isRecord(check) && check.severity !== "fail");
      if (value.passed !== derivedPassed) {
        errors.push(`${prefix}.passed must match check severities`);
      }
    }
  }
}

function validateCalibrationCheck(value: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof value.name !== "string" || !value.name) errors.push(`${prefix}.name must be a non-empty string`);
  if (!isCalibrationSeverity(value.severity)) errors.push(`${prefix}.severity must be pass, warn, or fail`);
  if (typeof value.message !== "string" || !value.message) errors.push(`${prefix}.message must be a non-empty string`);
  if (typeof value.value !== "number" && typeof value.value !== "string") {
    errors.push(`${prefix}.value must be a number or string`);
  }
  if (typeof value.value === "number" && !Number.isFinite(value.value)) {
    errors.push(`${prefix}.value number must be finite`);
  }
}

function isCalibrationSeverity(value: unknown): value is CalibrationSeverity {
  return value === "pass" || value === "warn" || value === "fail";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
