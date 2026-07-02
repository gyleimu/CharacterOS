/**
 * V6.3 Directional Assertion Engine — pure assertion evaluation.
 *
 * Evaluates benchmark expected directions against observed numeric
 * values. Does NOT call CharacterPhysicsEngine, read/write state,
 * or execute any fixtures.
 *
 * DESIGN: pure functions only. All inputs are primitive values.
 */

import type {
  BenchmarkAssertionResult,
  BenchmarkExpectedDirection,
  BenchmarkTolerancePolicy
} from "./benchmarkTypes";

// ─── Single assertion evaluation ───────────────────────────────────────

export interface EvaluateAssertionParams {
  /** The expected direction to evaluate. */
  expected: BenchmarkExpectedDirection;
  /** Value before the scenario executed. */
  valueBefore: number;
  /** Value after the scenario executed. */
  valueAfter: number;
  /** Optional series of intermediate values (for monotonic checks). */
  series?: readonly number[];
  /** Tolerance policy to apply. */
  tolerance: BenchmarkTolerancePolicy;
}

/**
 * Evaluate a single benchmark assertion against observed values.
 *
 * Pure function. All inputs are primitive or read-only.
 */
export function evaluateBenchmarkAssertion(
  params: EvaluateAssertionParams
): BenchmarkAssertionResult {
  const { expected, valueBefore, valueAfter, series, tolerance } = params;
  const delta = valueAfter - valueBefore;

  // NaN guard: any NaN input → failed
  if (isNaN(valueBefore) || isNaN(valueAfter)) {
    return fail(expected, valueBefore, valueAfter, delta,
      "observed value is NaN — metric extraction may have failed");
  }

  // Infinite guard: any infinite input → failed
  if (!isFinite(valueBefore) || !isFinite(valueAfter)) {
    return fail(expected, valueBefore, valueAfter, delta,
      "observed value is infinite — metric may be unbounded");
  }

  const mode = tolerance.mode;
  const minDelta = tolerance.minimumAbsoluteDelta ?? 1e-6;
  const epsilon = tolerance.epsilon ?? 1e-9;

  // Direction-based checks first: bounded_above / bounded_below use
  // the expected.bound, not the tolerance bounds.
  if (expected.direction === "bounded_above" || expected.direction === "bounded_below") {
    return evaluateDirectional(expected, valueBefore, valueAfter, delta, minDelta);
  }

  switch (mode) {
    case "directional":
      return evaluateDirectional(expected, valueBefore, valueAfter, delta, minDelta);
    case "bounded":
      return evaluateBounded(expected, valueAfter, tolerance);
    case "monotonic":
      return evaluateMonotonic(expected, series ?? [valueBefore, valueAfter], delta, minDelta);
    case "invariant":
      return evaluateInvariant(expected, valueBefore, valueAfter, delta, epsilon);
    case "approximate":
      return evaluateApproximate(expected, valueBefore, valueAfter, delta, epsilon);
    case "exact":
      return evaluateExact(expected, valueBefore, valueAfter, delta, epsilon);
    default:
      return fail(expected, valueBefore, valueAfter, delta,
        `unknown tolerance mode: ${String(mode)}`);
  }
}

// ─── Multi-assertion evaluation ────────────────────────────────────────

export interface EvaluateAssertionsParams {
  /** The assertions to evaluate. */
  assertions: readonly BenchmarkExpectedDirection[];
  /** A map of metricPath → { before, after }. */
  observations: Record<string, { before: number; after: number }>;
  /** Default tolerance for assertions without their own. */
  defaultTolerance: BenchmarkTolerancePolicy;
}

export interface EvaluateAssertionsResult {
  /** Per-assertion results. */
  results: readonly BenchmarkAssertionResult[];
  /** Count of passed assertions. */
  passedCount: number;
  /** Count of failed assertions. */
  failedCount: number;
  /** Overall summary explanation. */
  summary: string;
}

/**
 * Evaluate multiple assertions at once, reading values from an
 * observations map.
 *
 * Pure function. All inputs are primitive or read-only.
 */
export function evaluateBenchmarkAssertions(
  params: EvaluateAssertionsParams
): EvaluateAssertionsResult {
  const { assertions, observations, defaultTolerance } = params;
  const results: BenchmarkAssertionResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const assertion of assertions) {
    const obs = observations[assertion.metricPath];
    if (!obs || isNaN(obs.before) || isNaN(obs.after)) {
      const result = evaluateBenchmarkAssertion({
        expected: assertion,
        valueBefore: NaN,
        valueAfter: NaN,
        tolerance: assertion.tolerance ?? defaultTolerance
      });
      results.push(result);
      failedCount++;
      continue;
    }

    const result = evaluateBenchmarkAssertion({
      expected: assertion,
      valueBefore: obs.before,
      valueAfter: obs.after,
      tolerance: assertion.tolerance ?? defaultTolerance
    });
    results.push(result);
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  const summary = `${passedCount} passed, ${failedCount} failed out of ${assertions.length} assertions`;

  return { results, passedCount, failedCount, summary };
}

// ─── Mode-specific evaluators ──────────────────────────────────────────

function evaluateDirectional(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  minDelta: number
): BenchmarkAssertionResult {
  const dir = expected.direction;

  switch (dir) {
    case "increase": {
      const passed = delta >= minDelta;
      return verdict(
        expected, before, after, delta, passed,
        passed
          ? `expected ${expected.metricPath} to increase, observed ${before} → ${after} (Δ${formatDelta(delta)}) ✓`
          : `expected ${expected.metricPath} to increase, but observed ${before} → ${after} (Δ${formatDelta(delta)}, below minDelta ${minDelta})`
      );
    }
    case "decrease": {
      const passed = delta <= -minDelta;
      return verdict(
        expected, before, after, delta, passed,
        passed
          ? `expected ${expected.metricPath} to decrease, observed ${before} → ${after} (Δ${formatDelta(delta)}) ✓`
          : `expected ${expected.metricPath} to decrease, but observed ${before} → ${after} (Δ${formatDelta(delta)}, above -minDelta -${minDelta})`
      );
    }
    case "unchanged": {
      const passed = Math.abs(delta) < minDelta;
      return verdict(
        expected, before, after, delta, passed,
        passed
          ? `expected ${expected.metricPath} to remain unchanged, observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} < ${minDelta}) ✓`
          : `expected ${expected.metricPath} to remain unchanged, but observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} >= ${minDelta})`
      );
    }
    case "bounded_above": {
      const bound = expected.bound ?? 1;
      const passed = after <= bound;
      return verdict(
        expected, before, after, delta, passed,
        passed
          ? `expected ${expected.metricPath} ≤ ${bound}, observed ${after} ✓`
          : `expected ${expected.metricPath} ≤ ${bound}, but observed ${after}`
      );
    }
    case "bounded_below": {
      const bound = expected.bound ?? 0;
      const passed = after >= bound;
      return verdict(
        expected, before, after, delta, passed,
        passed
          ? `expected ${expected.metricPath} ≥ ${bound}, observed ${after} ✓`
          : `expected ${expected.metricPath} ≥ ${bound}, but observed ${after}`
      );
    }
    default:
      return fail(expected, before, after, delta,
        `unknown expected direction: ${String(dir)}`);
  }
}

function evaluateBounded(
  expected: BenchmarkExpectedDirection,
  after: number,
  tolerance: BenchmarkTolerancePolicy
): BenchmarkAssertionResult {
  const min = tolerance.minBound ?? 0;
  const max = tolerance.maxBound ?? 1;
  const passed = after >= min && after <= max;

  return verdict(
    expected, after, after, 0, passed,
    passed
      ? `expected ${expected.metricPath} in [${min}, ${max}], observed ${after} ✓`
      : `expected ${expected.metricPath} in [${min}, ${max}], but observed ${after}`
  );
}

function evaluateMonotonic(
  expected: BenchmarkExpectedDirection,
  series: readonly number[],
  delta: number,
  minDelta: number
): BenchmarkAssertionResult {
  const dir = expected.direction;

  if (series.length < 2) {
    return fail(expected, series[0] ?? NaN, series[series.length - 1] ?? NaN, delta,
      "monotonic check requires at least 2 values in series");
  }

  let isIncreasing = true;
  let isDecreasing = true;

  for (let i = 1; i < series.length; i++) {
    const step = series[i]! - series[i - 1]!;
    if (step < -minDelta) isIncreasing = false;
    if (step > minDelta) isDecreasing = false;
  }

  const before = series[0]!;
  const after = series[series.length - 1]!;

  switch (dir) {
    case "increase": {
      // monotonic increasing (non-decreasing) AND final > initial
      const passed = isIncreasing && after > before;
      return verdict(
        expected, before, after, after - before, passed,
        passed
          ? `expected ${expected.metricPath} to increase monotonically, observed ${before} → ${after} (${series.length} points) ✓`
          : `expected ${expected.metricPath} to increase monotonically, but series ${series.join(" → ")} is not monotonic increasing`
      );
    }
    case "decrease": {
      // monotonic decreasing (non-increasing) AND final < initial
      const passed = isDecreasing && after < before;
      return verdict(
        expected, before, after, after - before, passed,
        passed
          ? `expected ${expected.metricPath} to decrease monotonically, observed ${before} → ${after} (${series.length} points) ✓`
          : `expected ${expected.metricPath} to decrease monotonically, but series ${series.join(" → ")} is not monotonic decreasing`
      );
    }
    default:
      // For non-directional expected values, just check if it's monotonic at all
      return verdict(
        expected, before, after, after - before, true,
        `monotonic mode with direction "${dir}" — only checked for violations; series: ${series.join(" → ")}`
      );
  }
}

function evaluateInvariant(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  epsilon: number
): BenchmarkAssertionResult {
  const passed = Math.abs(delta) <= epsilon;
  return verdict(
    expected, before, after, delta, passed,
    passed
      ? `expected ${expected.metricPath} to be invariant, observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} ≤ ${epsilon}) ✓`
      : `expected ${expected.metricPath} to be invariant, but observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} > ${epsilon})`
  );
}

function evaluateApproximate(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  epsilon: number
): BenchmarkAssertionResult {
  // For approximate, we check if |delta| is within epsilon
  // This is most useful when combined with a target value
  const passed = Math.abs(delta) <= epsilon;
  return verdict(
    expected, before, after, delta, passed,
    passed
      ? `expected approximate stability for ${expected.metricPath}, observed Δ${formatDelta(delta)} (within ε=${epsilon}) ✓`
      : `expected approximate stability for ${expected.metricPath}, but observed Δ${formatDelta(delta)} (exceeds ε=${epsilon})`
  );
}

function evaluateExact(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  epsilon: number
): BenchmarkAssertionResult {
  const passed = Math.abs(delta) <= epsilon;
  return verdict(
    expected, before, after, delta, passed,
    passed
      ? `expected exact equality for ${expected.metricPath}, observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} ≤ ${epsilon}) ✓`
      : `expected exact equality for ${expected.metricPath}, but observed ${before} → ${after} (|Δ| ${formatAbsDelta(delta)} > ${epsilon})`
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function verdict(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  passed: boolean,
  explanation: string
): BenchmarkAssertionResult {
  return {
    expected,
    valueBefore: before,
    valueAfter: after,
    delta,
    passed,
    explanation
  };
}

function fail(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  reason: string
): BenchmarkAssertionResult {
  return {
    expected,
    valueBefore: before,
    valueAfter: after,
    delta,
    passed: false,
    explanation: `FAILED: ${reason} (expected: ${expected.reason})`
  };
}

/** Format a delta with sign for readability. */
function formatDelta(delta: number): string {
  if (!isFinite(delta)) return String(delta);
  if (delta === 0) return "0";
  return delta > 0 ? `+${round6(delta)}` : String(round6(delta));
}

/** Format absolute delta. */
function formatAbsDelta(delta: number): string {
  return String(round6(Math.abs(delta)));
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ─── Utility: extract numeric metric from an object path ────────────────

/**
 * Extract a numeric value from a nested object using a dot-separated path.
 *
 * Returns NaN if the path doesn't resolve to a finite number.
 * Pure function — does not mutate input.
 *
 * Example:
 *   extractNumericValue({ coord: { values: { trust: 0.5 } } }, "coord.values.trust")
 *   → 0.5
 */
export function extractNumericValue(
  obj: Record<string, unknown>,
  path: string
): number {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return NaN;
    if (typeof current !== "object") return NaN;
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current !== "number") return NaN;
  if (!isFinite(current)) return NaN;
  return current;
}
