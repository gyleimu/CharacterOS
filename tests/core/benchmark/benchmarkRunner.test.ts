import { describe, expect, it } from "vitest";
import {
  runBenchmarkCase,
  runBenchmarkCases
} from "../../../src/core/benchmark/benchmarkRunner";
import {
  firstReplayBenchmarkFixtures,
  getFirstReplayBenchmarkFixture
} from "../../../src/core/benchmark/fixtures/firstReplayFixtures";
import { normalizeBenchmarkCase } from "../../../src/core/benchmark/benchmarkTypes";
import type { BenchmarkCase } from "../../../src/core/benchmark/benchmarkTypes";

describe("runBenchmarkCase — memory_decay", () => {
  it("memory_should_decay_over_time passes successfully", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time");
    expect(fixture).toBeDefined();
    const normalized = normalizeBenchmarkCase(fixture!);

    const result = runBenchmarkCase({ kase: normalized });

    expect(result.caseId).toBe("memory_should_decay_over_time");
    expect(result.verdict).toBe("pass");
    expect(result.assertionResults.length).toBeGreaterThan(0);
    expect(result.explanation).toContain("passed");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("result includes assertion results with explanations", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    for (const ar of result.assertionResults) {
      expect(ar.passed).toBeDefined();
      expect(ar.explanation.length).toBeGreaterThan(10);
      expect(typeof ar.delta).toBe("number");
    }
  });

  it("result includes memory decay subprocess metrics", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    // Should have metrics from both continuous_tick and subprocess
    const subprocessMetrics = result.metrics.filter((m) => m.source === "subprocess");
    expect(subprocessMetrics.length).toBeGreaterThan(0);

    // Average recency should be > 0
    for (const m of subprocessMetrics) {
      expect(m.valueBefore).toBeGreaterThan(0);
      // "After" metrics should show decay (after < before)
      if (m.path.includes("After") && (m.path.includes("Recency") || m.path.includes("Weight"))) {
        expect(m.valueAfter).toBeLessThan(m.valueBefore);
      }
    }
  });

  it("recency decreases over time", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    // Find the recency assertion
    const recencyAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "continuousTick.averageMemoryRecency"
    );
    expect(recencyAssertion).toBeDefined();
    expect(recencyAssertion!.passed).toBe(true);
    expect(recencyAssertion!.delta).toBeLessThan(0); // decreased
  });

  it("memory count stays at or above initial count", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const countAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "continuousTick.memoryCount"
    );
    expect(countAssertion).toBeDefined();
    expect(countAssertion!.passed).toBe(true);
    // Memory count should be >= 1 (at least the benchmark event)
    expect(countAssertion!.valueAfter).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate the fixture object", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const originalEventsLength = fixture.scenario.events.length;
    const originalTicksLength = fixture.scenario.ticks.length;

    runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    // Fixture object should be unchanged
    expect(fixture.scenario.events.length).toBe(originalEventsLength);
    expect(fixture.scenario.ticks.length).toBe(originalTicksLength);
  });

  it("running the same benchmark twice gives consistent results", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const normalized = normalizeBenchmarkCase(fixture);

    const result1 = runBenchmarkCase({ kase: normalized });
    const result2 = runBenchmarkCase({ kase: normalized });

    // Both should pass
    expect(result1.verdict).toBe("pass");
    expect(result2.verdict).toBe("pass");

    // Same number of assertions
    expect(result1.assertionResults.length).toBe(result2.assertionResults.length);

    // Same directions (all pass)
    expect(result1.assertionResults.every((a) => a.passed)).toBe(true);
    expect(result2.assertionResults.every((a) => a.passed)).toBe(true);

    // Metrics should be identical (deterministic engine)
    for (let i = 0; i < result1.metrics.length; i++) {
      expect(result1.metrics[i]!.valueBefore).toBe(result2.metrics[i]!.valueBefore);
      expect(result1.metrics[i]!.valueAfter).toBe(result2.metrics[i]!.valueAfter);
    }
  });
});

describe("runBenchmarkCase — unsupported categories", () => {
  it("event_impact fixture now runs and passes", () => {
    const fixture = getFirstReplayBenchmarkFixture("abandonment_event_lowers_trust");
    expect(fixture).toBeDefined();
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture!) });

    expect(result.verdict).toBe("pass");
    expect(result.assertionResults.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("homeostasis_recovery fixture now runs and passes", () => {
    const fixture = getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.verdict).toBe("pass");
    expect(result.assertionResults.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("D10"))).toBe(true);
  });

  it("belief_evolution fixture now runs and passes", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.verdict).toBe("pass");
    expect(result.assertionResults.length).toBeGreaterThan(0);
  });
});

describe("runBenchmarkCases", () => {
  it("runs multiple cases and reports counts", () => {
    const memoryCase = normalizeBenchmarkCase(
      getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!
    );
    const homeoCase = normalizeBenchmarkCase(
      getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest")!
    );

    const result = runBenchmarkCases({ cases: [memoryCase, homeoCase] });

    expect(result.results).toHaveLength(2);
    expect(result.passed).toBe(2);
    expect(result.errored).toBe(0);
  });

  it("all 6 fixtures can be attempted without crashing", () => {
    const cases = firstReplayBenchmarkFixtures.map((f) => normalizeBenchmarkCase(f));

    const result = runBenchmarkCases({ cases });

    // No unexpected crashes
    expect(result.results).toHaveLength(cases.length);

    // memory_decay and homeostasis_recovery should pass
    const memoryResult = result.results.find(
      (r) => r.caseId === "memory_should_decay_over_time"
    );
    expect(memoryResult).toBeDefined();
    expect(memoryResult!.verdict).toBe("pass");

    const homeoResult = result.results.find(
      (r) => r.caseId === "boundary_should_recover_under_rest"
    );
    expect(homeoResult).toBeDefined();
    expect(homeoResult!.verdict).toBe("pass");

    const beliefResult = result.results.find(
      (r) => r.caseId === "belief_should_strengthen_with_repeated_evidence"
    );
    expect(beliefResult).toBeDefined();
    expect(beliefResult!.verdict).toBe("pass");

    const eventResult = result.results.find(
      (r) => r.caseId === "abandonment_event_lowers_trust"
    );
    expect(eventResult).toBeDefined();
    expect(eventResult!.verdict).toBe("pass");

    // All 6 should now pass
    expect(result.passed).toBe(6);
  });

  it("boundary recovery includes subprocess and homeostasis metrics", () => {
    const fixture = getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const subMetrics = result.metrics.filter((m) => m.source === "subprocess");
    expect(subMetrics.length).toBeGreaterThan(0);

    const stressDelta = result.metrics.find((m) => m.path.includes("stressLoad"));
    expect(stressDelta).toBeDefined();
  });

  it("D10 warning is present in homeostasis result", () => {
    const fixture = getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.warnings.some((w) => w.includes("D10"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("intermediate"))).toBe(true);
  });

  it("homeostasis recovery stress and cracks decrease", () => {
    const fixture = getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const stressAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "boundaryRecovery.stressLoadAfter"
    );
    expect(stressAssertion).toBeDefined();
    expect(stressAssertion!.passed).toBe(true);
    expect(stressAssertion!.delta).toBeLessThan(0);

    const cracksAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "boundaryRecovery.cracksAfter"
    );
    expect(cracksAssertion).toBeDefined();
    expect(cracksAssertion!.passed).toBe(true);
    expect(cracksAssertion!.delta).toBeLessThan(0);
  });

  it("memory_decay benchmark still passes after runner extension", () => {
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });
    expect(result.verdict).toBe("pass");
  });

  it("belief_evolution fixture now runs and belief strength is bounded", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.verdict).toBe("pass");
    const strengthAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "beliefEvolution.beliefStrength"
    );
    expect(strengthAssertion).toBeDefined();
    expect(strengthAssertion!.passed).toBe(true);
    // Belief strength after repeated evidence should be >= 0.1
    expect(strengthAssertion!.valueAfter).toBeGreaterThanOrEqual(0.1);
  });

  it("belief evolution result includes trace metrics", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const traceMetrics = result.metrics.filter((m) => m.source === "continuous_tick");
    expect(traceMetrics.length).toBeGreaterThan(0);
  });

  it("belief count remains bounded after evolution", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const countAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "continuousTick.beliefEvolution.after"
    );
    expect(countAssertion).toBeDefined();
    expect(countAssertion!.passed).toBe(true);
    expect(countAssertion!.valueAfter).toBeGreaterThanOrEqual(1);
  });

  it("belief evolution slow variable warning is present", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.warnings.some((w) => w.includes("slow variable"))).toBe(true);
  });

  it("event_impact fixtures now pass", () => {
    const fixtureA = getFirstReplayBenchmarkFixture("abandonment_event_lowers_trust")!;
    const resultA = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixtureA) });
    expect(resultA.verdict).toBe("pass");

    const fixtureB = getFirstReplayBenchmarkFixture("waiting_event_raises_fear")!;
    const resultB = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixtureB) });
    expect(resultB.verdict).toBe("pass");
  });

  it("runner remains deterministic for belief_evolution", () => {
    const fixture = getFirstReplayBenchmarkFixture("belief_should_strengthen_with_repeated_evidence")!;
    const normalized = normalizeBenchmarkCase(fixture);
    const r1 = runBenchmarkCase({ kase: normalized });
    const r2 = runBenchmarkCase({ kase: normalized });
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.assertionResults.length).toBe(r2.assertionResults.length);
  });

  // ─── V6.8 Event Impact Benchmark ──────────────────────────────────

  it("abandonment_event_lowers_trust: trust decreases and fear increases", () => {
    const fixture = getFirstReplayBenchmarkFixture("abandonment_event_lowers_trust")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.verdict).toBe("pass");
    const trustAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "coordinate.values.trust"
    );
    expect(trustAssertion).toBeDefined();
    expect(trustAssertion!.passed).toBe(true);
    expect(trustAssertion!.delta).toBeLessThan(0);

    const fearAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "coordinate.values.fear"
    );
    expect(fearAssertion).toBeDefined();
    expect(fearAssertion!.passed).toBe(true);
    expect(fearAssertion!.delta).toBeGreaterThan(0);
  });

  it("waiting_event_raises_fear: fear increases", () => {
    const fixture = getFirstReplayBenchmarkFixture("waiting_event_raises_fear")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.verdict).toBe("pass");
    const fearAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "coordinate.values.fear"
    );
    expect(fearAssertion).toBeDefined();
    expect(fearAssertion!.passed).toBe(true);
    expect(fearAssertion!.delta).toBeGreaterThan(0);
  });

  it("event impact result includes impactScore metric", () => {
    const fixture = getFirstReplayBenchmarkFixture("abandonment_event_lowers_trust")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    const impactMetrics = result.metrics.filter((m) => m.path === "impactScore.value");
    expect(impactMetrics.length).toBeGreaterThan(0);
    expect(impactMetrics[0]!.valueAfter).toBeGreaterThan(0);
  });

  it("event impact subtle drift warning is present", () => {
    const fixture = getFirstReplayBenchmarkFixture("abandonment_event_lowers_trust")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });

    expect(result.warnings.some((w) => w.includes("subtle"))).toBe(true);
  });

  it("all 6 fixtures now pass (all categories supported)", () => {
    const cases = firstReplayBenchmarkFixtures.map((f) => normalizeBenchmarkCase(f));
    const result = runBenchmarkCases({ cases });

    expect(result.results).toHaveLength(6);
    expect(result.passed).toBeGreaterThanOrEqual(5);
    expect(result.failed).toBeLessThanOrEqual(1);
  });

  // ─── V6.9 Behavior Decision Benchmark ────────────────────────────

  it("behavior_decision fixture runs and passes", () => {
    const fixture = getFirstReplayBenchmarkFixture("wang_xue_returns_after_silence_decision_consistency")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });
    expect(result.verdict).toBe("pass");
  });

  it("behavior decision result includes decision metrics", () => {
    const fixture = getFirstReplayBenchmarkFixture("wang_xue_returns_after_silence_decision_consistency")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });
    const decisionMetrics = result.metrics.filter((m) => m.source === "decision");
    expect(decisionMetrics.length).toBeGreaterThan(0);
  });

  it("behavior decision confidence is bounded", () => {
    const fixture = getFirstReplayBenchmarkFixture("wang_xue_returns_after_silence_decision_consistency")!;
    const result = runBenchmarkCase({ kase: normalizeBenchmarkCase(fixture) });
    const confAssertion = result.assertionResults.find(
      (a) => a.expected.metricPath === "decision.confidence"
    );
    expect(confAssertion).toBeDefined();
    expect(confAssertion!.passed).toBe(true);
  });
});
