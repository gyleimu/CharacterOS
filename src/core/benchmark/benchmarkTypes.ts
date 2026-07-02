/**
 * V6.1 Benchmark Types — minimal type system for the benchmark framework.
 *
 * DESIGN ONLY — no runner, no fixtures, no API.
 * Does NOT execute CharacterPhysicsEngine.
 * Does NOT read/write CharacterPhysicsState.
 *
 * impact.ts continues to serve as the event impact scoring utility.
 * V6 benchmarkTypes is the higher-level benchmark framework.
 */

import type { TemporalSubProcessKind } from "../temporal/subProcessTrace";
import type { CharacterPhysicsState } from "../physics/physicsEngine";

// ─── Category ──────────────────────────────────────────────────────────

export const BENCHMARK_CATEGORIES = [
  "event_impact",
  "personality_drift",
  "memory_decay",
  "homeostasis_recovery",
  "belief_evolution",
  "behavior_decision"
] as const;

export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

/** Type guard for BenchmarkCategory. */
export function isBenchmarkCategory(value: unknown): value is BenchmarkCategory {
  return typeof value === "string" && BENCHMARK_CATEGORIES.includes(value as BenchmarkCategory);
}

// ─── Metric source ─────────────────────────────────────────────────────

export const BENCHMARK_METRIC_SOURCES = [
  "state",
  "physics_step",
  "continuous_tick",
  "unified_tick",
  "internal_state_field",
  "subprocess",
  "decision"
] as const;

export type BenchmarkMetricSource = (typeof BENCHMARK_METRIC_SOURCES)[number];

// ─── Tolerance ─────────────────────────────────────────────────────────

export const TOLERANCE_MODES = [
  "exact",
  "approximate",
  "directional",
  "monotonic",
  "bounded",
  "invariant"
] as const;

export type ToleranceMode = (typeof TOLERANCE_MODES)[number];

/** Type guard for ToleranceMode. */
export function isToleranceMode(value: unknown): value is ToleranceMode {
  return typeof value === "string" && TOLERANCE_MODES.includes(value as ToleranceMode);
}

/** Tolerance policy for a benchmark case or individual assertion. */
export interface BenchmarkTolerancePolicy {
  /** Tolerance mode for numeric comparison. */
  mode: ToleranceMode;
  /** Minimum absolute delta to consider a change "real" (for directional mode). */
  minimumAbsoluteDelta?: number;
  /** Maximum allowed deviation for approximate/exact modes. */
  epsilon?: number;
  /** Bound value for bounded mode (e.g. max allowed value). */
  maxBound?: number;
  /** Bound value for bounded mode (e.g. min allowed value). */
  minBound?: number;
}

/** Default tolerance policy: directional with minimum 1e-6 delta. */
export function defaultBenchmarkTolerancePolicy(): BenchmarkTolerancePolicy {
  return {
    mode: "directional",
    minimumAbsoluteDelta: 1e-6
  };
}

/**
 * Produce a stable human-readable description of a tolerance policy.
 */
export function describeTolerancePolicy(policy: BenchmarkTolerancePolicy): string {
  const parts: string[] = [`mode: ${policy.mode}`];
  if (policy.minimumAbsoluteDelta !== undefined) {
    parts.push(`minDelta: ${policy.minimumAbsoluteDelta}`);
  }
  if (policy.epsilon !== undefined) {
    parts.push(`epsilon: ${policy.epsilon}`);
  }
  if (policy.maxBound !== undefined) {
    parts.push(`maxBound: ${policy.maxBound}`);
  }
  if (policy.minBound !== undefined) {
    parts.push(`minBound: ${policy.minBound}`);
  }
  return parts.join(", ");
}

// ─── Expected direction ────────────────────────────────────────────────

export const EXPECTED_DIRECTIONS = [
  "increase",
  "decrease",
  "unchanged",
  "bounded_above",
  "bounded_below"
] as const;

export type ExpectedDirection = (typeof EXPECTED_DIRECTIONS)[number];

/** A single expected-direction assertion for a benchmark case. */
export interface BenchmarkExpectedDirection {
  /** Dot-separated path to the metric (e.g. "coordinate.values.trust"). */
  metricPath: string;
  /** Expected direction of change. */
  direction: ExpectedDirection;
  /** Human-readable reason for this expectation. */
  reason: string;
  /** Optional bound value for bounded_above / bounded_below. */
  bound?: number;
  /** Optional per-assertion tolerance override. */
  tolerance?: BenchmarkTolerancePolicy;
}

// ─── Metric selector ───────────────────────────────────────────────────

/** Which metric to collect for a benchmark run. */
export interface BenchmarkMetricSelector {
  /** Dot-separated path to the metric. */
  path: string;
  /** Which data source contains this metric. */
  source: BenchmarkMetricSource;
  /** Optional subprocess kind when source is "subprocess". */
  subprocessKind?: TemporalSubProcessKind;
}

// ─── Input spec ────────────────────────────────────────────────────────

/** A deterministic benchmark input event. */
export interface BenchmarkInputEvent {
  /** Unique event id within the fixture. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Tags for the event. */
  tags: string[];
  /** Event category. */
  category: string;
  /** Intensity [0, 1]. */
  intensity: number;
  /** Importance [0, 1]. */
  importance: number;
  /** Relationship weight [0, 1]. */
  relationshipWeight: number;
  /** Expectation gap [0, 1]. */
  expectationGap: number;
  /** Personality sensitivity [0, 1]. */
  personalitySensitivity: number;
}

/** A tick specification within a benchmark scenario. */
export interface BenchmarkTickSpec {
  /** Human-readable label for this tick step. */
  label: string;
  /** Days elapsed for this tick. */
  daysElapsed: number;
  /** Optional memory decay rate override. */
  memoryDecayRate?: number;
}

// ─── Initial state spec ────────────────────────────────────────────────

/** How to obtain the initial character state for a benchmark run. */
export type BenchmarkInitialStateSpec =
  | { readonly kind: "inline"; readonly state: CharacterPhysicsState }
  | { readonly kind: "default"; readonly characterName?: string };

// ─── Scenario ──────────────────────────────────────────────────────────

/** A benchmark scenario: initial state, events, ticks. */
export interface BenchmarkScenario {
  /** Human-readable scenario name. */
  name: string;
  /** Initial character state specification. */
  initialState: BenchmarkInitialStateSpec;
  /** Events to inject (in order). */
  events: readonly BenchmarkInputEvent[];
  /** Continuous ticks to execute (in order). */
  ticks: readonly BenchmarkTickSpec[];
  /** Which subprocess traces to collect (if any). */
  collectSubProcesses?: readonly TemporalSubProcessKind[];
}

// ─── Case ──────────────────────────────────────────────────────────────

/** A complete benchmark case. */
export interface BenchmarkCase {
  /** Unique case id. */
  id: string;
  /** Human-readable description of what this case tests. */
  description: string;
  /** Category this case belongs to. */
  category: BenchmarkCategory;
  /** The scenario to execute. */
  scenario: BenchmarkScenario;
  /** Expected behavioral directions. */
  expectedDirections: readonly BenchmarkExpectedDirection[];
  /** Which metrics to collect. */
  metricsToInspect: readonly BenchmarkMetricSelector[];
  /** Tolerance policy for this case. */
  tolerancePolicy: BenchmarkTolerancePolicy;
  /** Optional human-readable notes. */
  notes?: string;
}

// ─── Normalization ─────────────────────────────────────────────────────

/**
 * Normalize a BenchmarkCase — fill in default tolerance where omitted.
 *
 * Pure function. Does not execute anything.
 */
export function normalizeBenchmarkCase(
  kase: BenchmarkCase
): BenchmarkCase {
  return {
    ...kase,
    tolerancePolicy: kase.tolerancePolicy ?? defaultBenchmarkTolerancePolicy(),
    expectedDirections: kase.expectedDirections.map((ed) => ({
      ...ed,
      tolerance: ed.tolerance ?? kase.tolerancePolicy ?? defaultBenchmarkTolerancePolicy()
    })),
    scenario: {
      ...kase.scenario,
      events: [...kase.scenario.events],
      ticks: [...kase.scenario.ticks]
    }
  };
}

// ─── Assertion result ──────────────────────────────────────────────────

/** Result of evaluating one expected direction. */
export interface BenchmarkAssertionResult {
  /** The expected direction that was evaluated. */
  expected: BenchmarkExpectedDirection;
  /** Value before scenario execution. */
  valueBefore: number;
  /** Value after scenario execution. */
  valueAfter: number;
  /** Absolute delta (after - before). */
  delta: number;
  /** Whether the assertion passed. */
  passed: boolean;
  /** Human-readable explanation of pass/fail. */
  explanation: string;
}

// ─── Result ────────────────────────────────────────────────────────────

/** Collected metric value from a benchmark run. */
export interface BenchmarkMetric {
  /** Path matching BenchmarkMetricSelector.path. */
  path: string;
  /** Which source this metric came from. */
  source: BenchmarkMetricSource;
  /** Value before scenario execution. */
  valueBefore: number;
  /** Value after scenario execution. */
  valueAfter: number;
  /** Absolute delta. */
  delta: number;
}

/** Result of running one benchmark case. */
export interface BenchmarkResult {
  /** Case id this result is for. */
  caseId: string;
  /** Overall verdict. */
  verdict: "pass" | "fail" | "inconclusive" | "error";
  /** Per-assertion results. */
  assertionResults: readonly BenchmarkAssertionResult[];
  /** Collected metrics. */
  metrics: readonly BenchmarkMetric[];
  /** Non-fatal warnings. */
  warnings: readonly string[];
  /** Human-readable explanation of the verdict. */
  explanation: string;
  /** Execution duration in ms. */
  durationMs: number;
}
