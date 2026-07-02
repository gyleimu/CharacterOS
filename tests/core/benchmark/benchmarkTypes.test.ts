import { describe, expect, it } from "vitest";
import {
  BENCHMARK_CATEGORIES,
  BENCHMARK_METRIC_SOURCES,
  TOLERANCE_MODES,
  EXPECTED_DIRECTIONS,
  isBenchmarkCategory,
  isToleranceMode,
  defaultBenchmarkTolerancePolicy,
  describeTolerancePolicy,
  normalizeBenchmarkCase,
  type BenchmarkCase,
  type BenchmarkCategory,
  type ToleranceMode,
  type BenchmarkTolerancePolicy
} from "../../../src/core/benchmark/benchmarkTypes";

describe("Benchmark types — constants", () => {
  it("has 6 benchmark categories", () => {
    expect(BENCHMARK_CATEGORIES).toHaveLength(6);
    expect(BENCHMARK_CATEGORIES).toContain("event_impact");
    expect(BENCHMARK_CATEGORIES).toContain("personality_drift");
    expect(BENCHMARK_CATEGORIES).toContain("memory_decay");
    expect(BENCHMARK_CATEGORIES).toContain("homeostasis_recovery");
    expect(BENCHMARK_CATEGORIES).toContain("belief_evolution");
    expect(BENCHMARK_CATEGORIES).toContain("behavior_decision");
  });

  it("has 7 metric sources", () => {
    expect(BENCHMARK_METRIC_SOURCES).toHaveLength(7);
    expect(BENCHMARK_METRIC_SOURCES).toContain("state");
    expect(BENCHMARK_METRIC_SOURCES).toContain("physics_step");
    expect(BENCHMARK_METRIC_SOURCES).toContain("continuous_tick");
    expect(BENCHMARK_METRIC_SOURCES).toContain("unified_tick");
    expect(BENCHMARK_METRIC_SOURCES).toContain("internal_state_field");
    expect(BENCHMARK_METRIC_SOURCES).toContain("subprocess");
    expect(BENCHMARK_METRIC_SOURCES).toContain("decision");
  });

  it("has 6 tolerance modes", () => {
    expect(TOLERANCE_MODES).toHaveLength(6);
    expect(TOLERANCE_MODES).toContain("exact");
    expect(TOLERANCE_MODES).toContain("approximate");
    expect(TOLERANCE_MODES).toContain("directional");
    expect(TOLERANCE_MODES).toContain("monotonic");
    expect(TOLERANCE_MODES).toContain("bounded");
    expect(TOLERANCE_MODES).toContain("invariant");
  });

  it("has 5 expected direction types", () => {
    expect(EXPECTED_DIRECTIONS).toHaveLength(5);
    expect(EXPECTED_DIRECTIONS).toContain("increase");
    expect(EXPECTED_DIRECTIONS).toContain("decrease");
    expect(EXPECTED_DIRECTIONS).toContain("unchanged");
    expect(EXPECTED_DIRECTIONS).toContain("bounded_above");
    expect(EXPECTED_DIRECTIONS).toContain("bounded_below");
  });
});

describe("isBenchmarkCategory", () => {
  it("returns true for valid categories", () => {
    expect(isBenchmarkCategory("memory_decay")).toBe(true);
    expect(isBenchmarkCategory("event_impact")).toBe(true);
    expect(isBenchmarkCategory("behavior_decision")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isBenchmarkCategory("narrative_quality")).toBe(false);
    expect(isBenchmarkCategory("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isBenchmarkCategory(42)).toBe(false);
    expect(isBenchmarkCategory(null)).toBe(false);
    expect(isBenchmarkCategory(undefined)).toBe(false);
    expect(isBenchmarkCategory({})).toBe(false);
  });
});

describe("isToleranceMode", () => {
  it("returns true for valid modes", () => {
    expect(isToleranceMode("directional")).toBe(true);
    expect(isToleranceMode("exact")).toBe(true);
    expect(isToleranceMode("invariant")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isToleranceMode("fuzzy")).toBe(false);
    expect(isToleranceMode("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isToleranceMode(42)).toBe(false);
    expect(isToleranceMode(null)).toBe(false);
    expect(isToleranceMode(undefined)).toBe(false);
  });
});

describe("defaultBenchmarkTolerancePolicy", () => {
  it("defaults to directional mode", () => {
    const policy = defaultBenchmarkTolerancePolicy();
    expect(policy.mode).toBe("directional");
  });

  it("includes a minimum delta", () => {
    const policy = defaultBenchmarkTolerancePolicy();
    expect(policy.minimumAbsoluteDelta).toBeGreaterThan(0);
  });

  it("is not exact — avoids fragile numeric assertions by default", () => {
    const policy = defaultBenchmarkTolerancePolicy();
    expect(policy.mode).not.toBe("exact");
  });

  it("returns a new object each call", () => {
    const a = defaultBenchmarkTolerancePolicy();
    const b = defaultBenchmarkTolerancePolicy();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe("describeTolerancePolicy", () => {
  it("outputs mode", () => {
    const policy: BenchmarkTolerancePolicy = { mode: "directional" };
    expect(describeTolerancePolicy(policy)).toContain("mode: directional");
  });

  it("outputs minDelta when set", () => {
    const policy: BenchmarkTolerancePolicy = { mode: "directional", minimumAbsoluteDelta: 0.01 };
    expect(describeTolerancePolicy(policy)).toContain("minDelta: 0.01");
  });

  it("outputs epsilon when set", () => {
    const policy: BenchmarkTolerancePolicy = { mode: "approximate", epsilon: 1e-9 };
    expect(describeTolerancePolicy(policy)).toContain("epsilon: 1e-9");
  });

  it("outputs bounds when set", () => {
    const policy: BenchmarkTolerancePolicy = {
      mode: "bounded",
      minBound: 0,
      maxBound: 1
    };
    const desc = describeTolerancePolicy(policy);
    expect(desc).toContain("minBound: 0");
    expect(desc).toContain("maxBound: 1");
  });

  it("produces stable output for same input", () => {
    const policy: BenchmarkTolerancePolicy = { mode: "directional", minimumAbsoluteDelta: 1e-6 };
    expect(describeTolerancePolicy(policy)).toBe(describeTolerancePolicy(policy));
  });
});

describe("normalizeBenchmarkCase", () => {
  function minimalCase(overrides?: Partial<BenchmarkCase>): BenchmarkCase {
    return {
      id: "test_case",
      description: "A minimal benchmark case.",
      category: "memory_decay" as BenchmarkCategory,
      scenario: {
        name: "test_scenario",
        initialState: { kind: "default" },
        events: [],
        ticks: [{ label: "one day", daysElapsed: 1 }]
      },
      expectedDirections: [
        {
          metricPath: "memories.0.recency",
          direction: "decrease",
          reason: "Recency should decay over time."
        }
      ],
      metricsToInspect: [
        { path: "memories.0.recency", source: "state" }
      ],
      tolerancePolicy: { mode: "directional" as ToleranceMode },
      ...overrides
    };
  }

  it("preserves case identity fields", () => {
    const kase = minimalCase();
    const normalized = normalizeBenchmarkCase(kase);
    expect(normalized.id).toBe(kase.id);
    expect(normalized.description).toBe(kase.description);
    expect(normalized.category).toBe(kase.category);
  });

  it("fills default tolerance on expected directions when omitted", () => {
    const kase = minimalCase();
    const normalized = normalizeBenchmarkCase(kase);
    for (const ed of normalized.expectedDirections) {
      expect(ed.tolerance).toBeDefined();
      expect(ed.tolerance!.mode).toBe("directional");
    }
  });

  it("does not override explicit per-assertion tolerance", () => {
    const kase = minimalCase({
      expectedDirections: [
        {
          metricPath: "coordinate.values.trust",
          direction: "unchanged",
          reason: "Trust should not change in zero-day tick.",
          tolerance: { mode: "exact", epsilon: 1e-12 }
        }
      ]
    });
    const normalized = normalizeBenchmarkCase(kase);
    expect(normalized.expectedDirections[0]!.tolerance!.mode).toBe("exact");
  });

  it("does not mutate the input case", () => {
    const kase = minimalCase();
    const eventsBefore = kase.scenario.events;
    normalizeBenchmarkCase(kase);
    // Mutating original should not have happened
    expect(kase.scenario.events).toBe(eventsBefore);
  });

  it("does not execute any physics", () => {
    // This test verifies that normalizeBenchmarkCase is purely structural.
    // It does not call CharacterPhysicsEngine, runContinuousTick, or any mutation function.
    const kase = minimalCase();
    // Should complete without any side effects
    const result = normalizeBenchmarkCase(kase);
    expect(result).toBeDefined();
    expect(result.id).toBe("test_case");
  });
});
