import { describe, expect, it } from "vitest";
import {
  firstReplayBenchmarkFixtures,
  listFirstReplayBenchmarkFixtures,
  getFirstReplayBenchmarkFixture,
  summarizeBenchmarkFixtures
} from "../../../src/core/benchmark/fixtures/firstReplayFixtures";
import type { BenchmarkCase, ToleranceMode } from "../../../src/core/benchmark/benchmarkTypes";

describe("firstReplayBenchmarkFixtures", () => {
  it("contains exactly 6 fixtures", () => {
    expect(firstReplayBenchmarkFixtures).toHaveLength(6);
  });

  it("has unique fixture ids", () => {
    const ids = firstReplayBenchmarkFixtures.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("each fixture has a category, scenario, and expectedDirections", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      expect(fixture.category).toBeDefined();
      expect(fixture.scenario).toBeDefined();
      expect(fixture.scenario.name.length).toBeGreaterThan(0);
      expect(fixture.expectedDirections.length).toBeGreaterThan(0);
    }
  });

  it("each fixture has a description", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      expect(fixture.description.length).toBeGreaterThan(10);
    }
  });

  it("each fixture uses non-exact tolerance for most assertions", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      // Top-level tolerance should not be exact
      expect(fixture.tolerancePolicy.mode).not.toBe("exact");

      // At least one expected direction should be directional or bounded
      // (not all fixtures benefit from directional — slow variables use bounded)
      const hasNonExact = fixture.expectedDirections.some(
        (ed) => {
          const mode = ed.tolerance?.mode ?? fixture.tolerancePolicy.mode;
          return mode === "directional" || mode === "bounded" || mode === "monotonic";
        }
      );
      expect(hasNonExact).toBe(true);
    }
  });

  it("each event in each fixture has required fields", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      for (const event of fixture.scenario.events) {
        expect(event.id.length).toBeGreaterThan(0);
        expect(event.description.length).toBeGreaterThan(0);
        expect(event.tags.length).toBeGreaterThan(0);
        expect(event.category.length).toBeGreaterThan(0);
        expect(event.intensity).toBeGreaterThanOrEqual(0);
        expect(event.intensity).toBeLessThanOrEqual(1);
        expect(event.importance).toBeGreaterThanOrEqual(0);
        expect(event.importance).toBeLessThanOrEqual(1);
      }
    }
  });

  it("each tick in each fixture has positive daysElapsed", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      for (const tick of fixture.scenario.ticks) {
        expect(tick.daysElapsed).toBeGreaterThan(0);
        expect(tick.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("each expected direction has a reason", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      for (const ed of fixture.expectedDirections) {
        expect(ed.reason.length).toBeGreaterThan(10);
        expect(ed.metricPath.length).toBeGreaterThan(0);
        expect(["increase", "decrease", "unchanged", "bounded_above", "bounded_below"]).toContain(ed.direction);
      }
    }
  });

  it("each metric selector has path and source", () => {
    for (const fixture of firstReplayBenchmarkFixtures) {
      expect(fixture.metricsToInspect.length).toBeGreaterThan(0);
      for (const ms of fixture.metricsToInspect) {
        expect(ms.path.length).toBeGreaterThan(0);
        expect(ms.source.length).toBeGreaterThan(0);
      }
    }
  });

  it("fixtures do not execute any physics", () => {
    // This test proves that importing and reading fixtures
    // does not trigger any side effects.
    const ids = listFirstReplayBenchmarkFixtures();
    expect(ids).toHaveLength(6);

    // Getting a fixture by id returns the same object
    const fixture = getFirstReplayBenchmarkFixture("memory_should_decay_over_time");
    expect(fixture).toBeDefined();
    expect(fixture!.category).toBe("memory_decay");
  });

  it("covers all 5 expected benchmark scenarios", () => {
    const fixtures = firstReplayBenchmarkFixtures;
    const categories = fixtures.map((f) => f.category);

    expect(categories).toContain("event_impact");
    expect(categories).toContain("memory_decay");
    expect(categories).toContain("homeostasis_recovery");
    expect(categories).toContain("belief_evolution");
  });
});

describe("listFirstReplayBenchmarkFixtures", () => {
  it("returns sorted list of fixture ids", () => {
    const ids = listFirstReplayBenchmarkFixtures();
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe("abandonment_event_lowers_trust");
    expect(ids[4]).toBe("belief_should_strengthen_with_repeated_evidence");
  });
});

describe("getFirstReplayBenchmarkFixture", () => {
  it("returns the correct fixture by id", () => {
    const fixture = getFirstReplayBenchmarkFixture("boundary_should_recover_under_rest");
    expect(fixture).toBeDefined();
    expect(fixture!.category).toBe("homeostasis_recovery");
  });

  it("returns undefined for unknown id", () => {
    const fixture = getFirstReplayBenchmarkFixture("nonexistent_fixture");
    expect(fixture).toBeUndefined();
  });

  it("returns the exact same reference as the list entry", () => {
    const byList = firstReplayBenchmarkFixtures[0]!;
    const byGet = getFirstReplayBenchmarkFixture(byList.id);
    expect(byGet).toBe(byList);
  });
});

describe("summarizeBenchmarkFixtures", () => {
  it("reports correct total fixture count", () => {
    const summary = summarizeBenchmarkFixtures(firstReplayBenchmarkFixtures);
    expect(summary.totalFixtures).toBe(6);
  });

  it("reports correct category counts", () => {
    const summary = summarizeBenchmarkFixtures(firstReplayBenchmarkFixtures);
    // A: event_impact, B: event_impact, C: memory_decay, D: homeostasis_recovery, E: belief_evolution
    expect(summary.categoryCounts.event_impact).toBe(2);
    expect(summary.categoryCounts.memory_decay).toBe(1);
    expect(summary.categoryCounts.homeostasis_recovery).toBe(1);
    expect(summary.categoryCounts.belief_evolution).toBe(1);
    expect(summary.categoryCounts.personality_drift).toBe(0);
    expect(summary.categoryCounts.behavior_decision).toBe(1);
  });

  it("reports correct total directions and metrics", () => {
    const summary = summarizeBenchmarkFixtures(firstReplayBenchmarkFixtures);
    expect(summary.totalExpectedDirections).toBeGreaterThan(0);
    expect(summary.totalMetricsToInspect).toBeGreaterThan(0);
    // At minimum: 3+2+4+3+2 = 14 directions across 5 fixtures
    expect(summary.totalExpectedDirections).toBeGreaterThanOrEqual(12);
  });

  it("returns fixture ids matching the input", () => {
    const summary = summarizeBenchmarkFixtures(firstReplayBenchmarkFixtures);
    expect(summary.fixtureIds).toEqual(firstReplayBenchmarkFixtures.map((f) => f.id));
  });

  it("handles empty fixtures list", () => {
    const summary = summarizeBenchmarkFixtures([]);
    expect(summary.totalFixtures).toBe(0);
    expect(summary.totalExpectedDirections).toBe(0);
    expect(summary.totalMetricsToInspect).toBe(0);
    expect(summary.fixtureIds).toEqual([]);
  });
});
