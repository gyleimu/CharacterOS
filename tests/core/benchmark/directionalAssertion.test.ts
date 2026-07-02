import { describe, expect, it } from "vitest";
import {
  evaluateBenchmarkAssertion,
  evaluateBenchmarkAssertions,
  extractNumericValue,
  type EvaluateAssertionParams
} from "../../../src/core/benchmark/directionalAssertion";
import type {
  BenchmarkExpectedDirection,
  BenchmarkTolerancePolicy
} from "../../../src/core/benchmark/benchmarkTypes";

// ─── Reusable helpers ──────────────────────────────────────────────────

function makeExpected(
  overrides?: Partial<BenchmarkExpectedDirection>
): BenchmarkExpectedDirection {
  return {
    metricPath: "test.metric",
    direction: "decrease",
    reason: "Test metric should decrease.",
    ...overrides
  };
}

const DIRECTIONAL: BenchmarkTolerancePolicy = {
  mode: "directional",
  minimumAbsoluteDelta: 1e-6
};
const EXACT: BenchmarkTolerancePolicy = { mode: "exact", epsilon: 1e-9 };
const APPROXIMATE: BenchmarkTolerancePolicy = { mode: "approximate", epsilon: 0.01 };
const INVARIANT: BenchmarkTolerancePolicy = { mode: "invariant", epsilon: 1e-9 };
const MONOTONIC: BenchmarkTolerancePolicy = { mode: "monotonic", minimumAbsoluteDelta: 1e-6 };
const BOUNDED: BenchmarkTolerancePolicy = { mode: "bounded", minBound: 0, maxBound: 1 };

function evalSimple(
  expected: BenchmarkExpectedDirection,
  before: number,
  after: number,
  tolerance?: BenchmarkTolerancePolicy
) {
  return evaluateBenchmarkAssertion({
    expected,
    valueBefore: before,
    valueAfter: after,
    tolerance: tolerance ?? DIRECTIONAL
  });
}

// ─── Directional: increase ─────────────────────────────────────────────

describe("directional: increase", () => {
  it("passes when after > before by at least minDelta", () => {
    const r = evalSimple(makeExpected({ direction: "increase", metricPath: "trust" }), 0.4, 0.5);
    expect(r.passed).toBe(true);
    expect(r.delta).toBeCloseTo(0.1);
    expect(r.explanation).toContain("to increase");
    expect(r.explanation).toContain("✓");
  });

  it("fails when after < before", () => {
    const r = evalSimple(makeExpected({ direction: "increase" }), 0.5, 0.4);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("expected");
  });

  it("fails when delta is below minDelta", () => {
    const r = evalSimple(makeExpected({ direction: "increase" }), 0.5, 0.5000001);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("below minDelta");
  });

  it("passes with custom minDelta", () => {
    const tol: BenchmarkTolerancePolicy = { mode: "directional", minimumAbsoluteDelta: 0.05 };
    const r = evalSimple(makeExpected({ direction: "increase" }), 0.4, 0.43, tol);
    expect(r.passed).toBe(false); // 0.03 < 0.05
  });
});

// ─── Directional: decrease ─────────────────────────────────────────────

describe("directional: decrease", () => {
  it("passes when after < before by at least minDelta", () => {
    const r = evalSimple(makeExpected({ direction: "decrease", metricPath: "trust" }), 0.5, 0.4);
    expect(r.passed).toBe(true);
    expect(r.delta).toBeCloseTo(-0.1);
    expect(r.explanation).toContain("to decrease");
    expect(r.explanation).toContain("✓");
  });

  it("fails when after > before", () => {
    const r = evalSimple(makeExpected({ direction: "decrease" }), 0.4, 0.5);
    expect(r.passed).toBe(false);
  });
});

// ─── Directional: unchanged ────────────────────────────────────────────

describe("directional: unchanged", () => {
  it("passes when |delta| < minDelta", () => {
    const r = evalSimple(makeExpected({ direction: "unchanged" }), 0.5, 0.5);
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("remain unchanged");
  });

  it("fails when delta is significant", () => {
    const r = evalSimple(makeExpected({ direction: "unchanged" }), 0.5, 0.6);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("but observed");
  });
});

// ─── Directional: bounded_above / bounded_below ────────────────────────

describe("directional: bounded_above / bounded_below", () => {
  it("bounded_above passes when after ≤ bound", () => {
    const r = evalSimple(
      makeExpected({ direction: "bounded_above", bound: 0.8 }),
      0.6, 0.7
    );
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("≤ 0.8");
  });

  it("bounded_above fails when after > bound", () => {
    const r = evalSimple(
      makeExpected({ direction: "bounded_above", bound: 0.5 }),
      0.6, 0.7
    );
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("but observed");
  });

  it("bounded_below passes when after ≥ bound", () => {
    const r = evalSimple(
      makeExpected({ direction: "bounded_below", bound: 0.2 }),
      0.5, 0.4
    );
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("≥ 0.2");
  });

  it("bounded_below fails when after < bound", () => {
    const r = evalSimple(
      makeExpected({ direction: "bounded_below", bound: 0.5 }),
      0.6, 0.3
    );
    expect(r.passed).toBe(false);
  });
});

// ─── Tolerance mode: bounded ────────────────────────────────────────────

describe("tolerance mode: bounded", () => {
  it("passes when value is within [min, max]", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "bounded_above", bound: 1 }),
      valueBefore: 0.5,
      valueAfter: 0.5,
      tolerance: BOUNDED
    });
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("≤");
  });

  it("fails when value is below min", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "bounded_below" }),
      valueBefore: 0,
      valueAfter: -0.1,
      tolerance: BOUNDED
    });
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("but observed -0.1");
  });

  it("fails when value is above max", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "bounded_above" }),
      valueBefore: 0.5,
      valueAfter: 1.5,
      tolerance: BOUNDED
    });
    expect(r.passed).toBe(false);
  });
});

// ─── Tolerance mode: monotonic ──────────────────────────────────────────

describe("tolerance mode: monotonic", () => {
  it("passes for monotonic increasing series", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "increase", metricPath: "strength" }),
      valueBefore: 0.3,
      valueAfter: 0.7,
      series: [0.3, 0.45, 0.6, 0.7],
      tolerance: MONOTONIC
    });
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("increase monotonically");
  });

  it("fails for non-monotonic series", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "increase" }),
      valueBefore: 0.3,
      valueAfter: 0.7,
      series: [0.3, 0.5, 0.4, 0.7], // dip at index 2
      tolerance: MONOTONIC
    });
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("not monotonic");
  });

  it("passes for monotonic decreasing series", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "decrease", metricPath: "recency" }),
      valueBefore: 0.9,
      valueAfter: 0.3,
      series: [0.9, 0.7, 0.5, 0.3],
      tolerance: MONOTONIC
    });
    expect(r.passed).toBe(true);
  });

  it("fails for flat-then-up series when expecting decrease", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "decrease" }),
      valueBefore: 0.9,
      valueAfter: 0.8,
      series: [0.9, 0.9, 1.0, 0.8],
      tolerance: MONOTONIC
    });
    expect(r.passed).toBe(false);
  });

  it("rejects series with fewer than 2 values", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "increase" }),
      valueBefore: 0.5,
      valueAfter: 0.5,
      series: [0.5],
      tolerance: MONOTONIC
    });
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("at least 2 values");
  });
});

// ─── Tolerance mode: invariant ──────────────────────────────────────────

describe("tolerance mode: invariant", () => {
  it("passes when values are identical", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.42,
      valueAfter: 0.42,
      tolerance: INVARIANT
    });
    expect(r.passed).toBe(true);
  });

  it("fails when values differ beyond epsilon", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.42,
      valueAfter: 0.43,
      tolerance: INVARIANT
    });
    expect(r.passed).toBe(false);
  });

  it("passes when difference is within epsilon", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.42,
      valueAfter: 0.4200000001,
      tolerance: INVARIANT
    });
    expect(r.passed).toBe(true);
  });
});

// ─── Tolerance mode: approximate ────────────────────────────────────────

describe("tolerance mode: approximate", () => {
  it("passes when delta is within epsilon", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.5,
      valueAfter: 0.505,
      tolerance: APPROXIMATE
    });
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("within ε=");
  });

  it("fails when delta exceeds epsilon", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.5,
      valueAfter: 0.6,
      tolerance: APPROXIMATE
    });
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("exceeds ε=");
  });
});

// ─── Tolerance mode: exact ──────────────────────────────────────────────

describe("tolerance mode: exact", () => {
  it("passes when values are identical within epsilon", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.42,
      valueAfter: 0.42,
      tolerance: EXACT
    });
    expect(r.passed).toBe(true);
    expect(r.explanation).toContain("exact equality");
  });

  it("fails when values differ", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "unchanged" }),
      valueBefore: 0.42,
      valueAfter: 0.43,
      tolerance: EXACT
    });
    expect(r.passed).toBe(false);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("NaN before → failed with NaN warning", () => {
    const r = evalSimple(makeExpected({ direction: "decrease" }), NaN, 0.4);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("NaN");
    expect(r.valueBefore).toBeNaN();
  });

  it("NaN after → failed with NaN warning", () => {
    const r = evalSimple(makeExpected({ direction: "decrease" }), 0.5, NaN);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("NaN");
  });

  it("Infinity → failed", () => {
    const r = evalSimple(makeExpected({ direction: "decrease" }), Infinity, 0.4);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("infinite");
  });

  it("-Infinity → failed", () => {
    const r = evalSimple(makeExpected({ direction: "increase" }), -Infinity, 0.4);
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("infinite");
  });

  it("unknown tolerance mode → failed", () => {
    const r = evaluateBenchmarkAssertion({
      expected: makeExpected({ direction: "decrease" }),
      valueBefore: 0.5,
      valueAfter: 0.4,
      tolerance: { mode: "fuzzy" as never }
    });
    expect(r.passed).toBe(false);
    expect(r.explanation).toContain("unknown tolerance mode");
  });
});

// ─── Multi-assertion evaluation ─────────────────────────────────────────

describe("evaluateBenchmarkAssertions", () => {
  it("evaluates multiple assertions and reports counts", () => {
    const assertions: BenchmarkExpectedDirection[] = [
      makeExpected({ direction: "decrease", metricPath: "trust" }),
      makeExpected({ direction: "increase", metricPath: "fear" }),
      makeExpected({ direction: "unchanged", metricPath: "structural" })
    ];
    const observations = {
      trust: { before: 0.5, after: 0.4 },    // pass: decreased
      fear: { before: 0.3, after: 0.35 },     // pass: increased
      structural: { before: 0.42, after: 0.5 } // fail: changed significantly
    };

    const result = evaluateBenchmarkAssertions({
      assertions,
      observations,
      defaultTolerance: DIRECTIONAL
    });

    expect(result.results).toHaveLength(3);
    expect(result.passedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.summary).toContain("2 passed");
    expect(result.summary).toContain("1 failed");
    expect(result.summary).toContain("out of 3");
  });

  it("handles missing observation as failed", () => {
    const assertions: BenchmarkExpectedDirection[] = [
      makeExpected({ direction: "decrease", metricPath: "missing.metric" })
    ];
    const observations = {};

    const result = evaluateBenchmarkAssertions({
      assertions,
      observations,
      defaultTolerance: DIRECTIONAL
    });

    expect(result.results[0]!.passed).toBe(false);
    expect(result.passedCount).toBe(0);
    expect(result.failedCount).toBe(1);
  });

  it("handles empty assertions", () => {
    const result = evaluateBenchmarkAssertions({
      assertions: [],
      observations: {},
      defaultTolerance: DIRECTIONAL
    });

    expect(result.results).toHaveLength(0);
    expect(result.passedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.summary).toContain("out of 0");
  });

  it("does not call physics engine", () => {
    // Pure function — no side effects, no state access
    const result = evaluateBenchmarkAssertions({
      assertions: [makeExpected({ direction: "decrease", metricPath: "x" })],
      observations: { x: { before: 1, after: 0.5 } },
      defaultTolerance: DIRECTIONAL
    });
    expect(result.results[0]!.passed).toBe(true);
  });
});

// ─── extractNumericValue ────────────────────────────────────────────────

describe("extractNumericValue", () => {
  it("extracts a simple top-level number", () => {
    expect(extractNumericValue({ a: 42 }, "a")).toBe(42);
  });

  it("extracts a nested value via dot path", () => {
    expect(extractNumericValue({ a: { b: { c: 0.75 } } }, "a.b.c")).toBe(0.75);
  });

  it("returns NaN for missing path", () => {
    expect(extractNumericValue({ a: 1 }, "a.b.c")).toBeNaN();
  });

  it("returns NaN for non-numeric value", () => {
    expect(extractNumericValue({ a: "hello" }, "a")).toBeNaN();
  });

  it("returns NaN for null intermediate", () => {
    expect(extractNumericValue({ a: null }, "a.b")).toBeNaN();
  });

  it("returns NaN for NaN value", () => {
    expect(extractNumericValue({ a: NaN }, "a")).toBeNaN();
  });
});
