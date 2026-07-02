/**
 * V6.9 Behavior Decision Assertion Helper
 *
 * Simple pure text/semantic assertion helpers for behavior decision
 * benchmarks. Does NOT call LLM, NLP, or any AI service.
 */

import type { BenchmarkAssertionResult, BenchmarkExpectedDirection, BenchmarkTolerancePolicy } from "./benchmarkTypes";

// ─── Text assertion types ───────────────────────────────────────────────

export interface TextAssertionParams {
  expected: BenchmarkExpectedDirection;
  /** The text value to check. */
  text: string;
  /** Optional numeric value (for numeric-bound checks). */
  numericValue?: number;
  /** Tolerance policy. */
  tolerance: BenchmarkTolerancePolicy;
}

/**
 * Evaluate a text-based assertion.
 *
 * Supported expected directions:
 *   - bounded_above / bounded_below: check numericValue against bound
 *   - unchanged: check text is non-empty
 *
 * For text content checks, use evaluateTextMatch instead.
 */
export function evaluateTextAssertion(
  params: TextAssertionParams
): BenchmarkAssertionResult {
  const { expected, text, numericValue, tolerance } = params;

  if (numericValue !== undefined && !isNaN(numericValue)) {
    const bound = expected.bound ?? 0.5;
    const delta = 0;

    switch (expected.direction) {
      case "bounded_above":
        return textVerdict(expected, 0, numericValue, 0,
          numericValue <= bound,
          numericValue <= bound
            ? `expected ${expected.metricPath} ≤ ${bound}, observed ${numericValue} ✓`
            : `expected ${expected.metricPath} ≤ ${bound}, but observed ${numericValue}`);
      case "bounded_below":
        return textVerdict(expected, 0, numericValue, 0,
          numericValue >= bound,
          numericValue >= bound
            ? `expected ${expected.metricPath} ≥ ${bound}, observed ${numericValue} ✓`
            : `expected ${expected.metricPath} ≥ ${bound}, but observed ${numericValue}`);
    }
  }

  // Text non-empty check
  return textVerdict(expected, 0, 0, 0,
    text.length > 0,
    text.length > 0
      ? `expected ${expected.metricPath} to be non-empty, observed ${text.length} chars ✓`
      : `expected ${expected.metricPath} to be non-empty, but text is empty`);
}

// ─── Text match helpers ────────────────────────────────────────────────

export interface TextMatchParams {
  expected: BenchmarkExpectedDirection;
  /** The text value to check. */
  text: string;
}

/**
 * Evaluate whether text includes ANY of the given substrings.
 */
export function evaluateTextIncludesAny(
  params: TextMatchParams & { substrings: readonly string[] }
): BenchmarkAssertionResult {
  const { expected, text, substrings } = params;
  const matched = substrings.filter((s) => text.includes(s));
  const passed = matched.length > 0;
  return textVerdict(expected, 0, 0, 0, passed,
    passed
      ? `expected "${expected.metricPath}" to include one of [${substrings.join(", ")}], matched: "${matched[0]}" ✓`
      : `expected "${expected.metricPath}" to include one of [${substrings.join(", ")}], but matched none`);
}

/**
 * Evaluate whether text EXCLUDES ALL of the given substrings.
 */
export function evaluateTextExcludesAll(
  params: TextMatchParams & { substrings: readonly string[] }
): BenchmarkAssertionResult {
  const { expected, text, substrings } = params;
  const matched = substrings.filter((s) => text.includes(s));
  const passed = matched.length === 0;
  return textVerdict(expected, 0, 0, 0, passed,
    passed
      ? `expected "${expected.metricPath}" to exclude [${substrings.join(", ")}] ✓`
      : `expected "${expected.metricPath}" to exclude [${substrings.join(", ")}], but contained: "${matched[0]}"`);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function textVerdict(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  delta: number,
  passed: boolean,
  explanation: string
): BenchmarkAssertionResult {
  return { expected, valueBefore: before, valueAfter: after, delta, passed, explanation };
}
