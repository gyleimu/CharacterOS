import { describe, expect, it } from "vitest";
import {
  buildTraceReplayArtifact,
  TRACE_REPLAY_SCHEMA_VERSION,
  traceReplayScenarios,
  validateTraceReplayArtifact,
  type TraceReplayScenarioId
} from "../../src/core/trace/traceReplay";
import {
  buildTraceReplaySummaryIndex,
  summarizeTraceReplayArtifact,
  validateTraceReplaySummary,
  validateTraceReplaySummaryIndex
} from "../../src/core/trace/traceReplaySummary";

describe("Trace replay artifacts", () => {
  it("builds schema-stable artifacts for all replay scenarios", () => {
    const scenarios = Object.keys(traceReplayScenarios) as TraceReplayScenarioId[];

    for (const scenario of scenarios) {
      const artifact = buildTraceReplayArtifact({ scenario, daysPerStep: 14 });

      expect(artifact.schemaVersion).toBe(TRACE_REPLAY_SCHEMA_VERSION);
      expect(artifact.scenario).toBe(scenario);
      expect(artifact.scenarioMeta.title.length).toBeGreaterThan(0);
      expect(artifact.scenarioMeta.expectedForces.length).toBeGreaterThan(0);
      expect(artifact.parameters.daysPerStep).toBe(14);
      expect(artifact.parameters.learningRate).toBeGreaterThan(0);
      expect(artifact.initialCoordinate.trust).toBeGreaterThan(0);
      expect(artifact.finalCoordinate.trust).toBeGreaterThanOrEqual(0);
      expect(artifact.steps.length).toBeGreaterThan(0);
      expect(artifact.steps[0]?.boundary.phase).toMatch(/stable|strained|overflow/);
      expect(artifact.steps[0]?.clusterForces.length).toBeGreaterThan(0);
      expect(artifact.steps[0]?.clusterMetrics.length).toBeGreaterThan(0);
    }
  });

  it("shows category-specific force directions in replay artifacts", () => {
    const betrayal = buildTraceReplayArtifact({ scenario: "betrayal_spiral" });
    const success = buildTraceReplayArtifact({ scenario: "success_recovery" });
    const betrayalForce = betrayal.steps.at(-1)?.clusterForces.find((force) => force.category === "betrayal");
    const successForce = success.steps.at(-1)?.clusterForces.find((force) => force.category === "success");

    expect(betrayalForce?.trust).toBeLessThan(0);
    expect(betrayalForce?.fear).toBeGreaterThan(0);
    expect(successForce?.trust).toBeGreaterThan(0);
    expect(successForce?.fear).toBeLessThan(0);
  });

  it("validates replay artifacts at runtime", () => {
    const artifact = buildTraceReplayArtifact({ scenario: "abandonment_then_repair" });
    const valid = validateTraceReplayArtifact(artifact);
    const invalid = validateTraceReplayArtifact({
      ...artifact,
      schemaVersion: "wrong",
      steps: [{ eventId: "" }]
    });

    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(1);
  });

  it("shows repeated abandonment accumulating mass and velocity", () => {
    const artifact = buildTraceReplayArtifact({ scenario: "repeated_abandonment_accumulation" });
    const first = artifact.steps[0];
    const last = artifact.steps.at(-1);
    const firstCluster = first?.clusterMetrics.find((metric) => metric.category === "abandonment");
    const lastCluster = last?.clusterMetrics.find((metric) => metric.category === "abandonment");

    expect(artifact.steps).toHaveLength(6);
    expect(firstCluster?.mass).toBeLessThan(lastCluster?.mass ?? 0);
    expect(firstCluster?.density).toBeLessThanOrEqual(lastCluster?.density ?? 0);
    expect(Math.abs(first?.velocity.trust ?? 0)).toBeLessThan(Math.abs(last?.velocity.trust ?? 0));
    expect(last?.force.trust).toBeLessThan(0);
    expect(last?.force.fear).toBeGreaterThan(0);
  });

  it("contrasts support recovery against abandonment accumulation", () => {
    const abandonment = buildTraceReplayArtifact({ scenario: "repeated_abandonment_accumulation" });
    const support = buildTraceReplayArtifact({ scenario: "support_recovery_accumulation" });
    const supportFirst = support.steps[0];
    const supportLast = support.steps.at(-1);
    const supportFirstCluster = supportFirst?.clusterMetrics.find((metric) => metric.category === "support");
    const supportLastCluster = supportLast?.clusterMetrics.find((metric) => metric.category === "support");

    expect(support.steps).toHaveLength(abandonment.steps.length);
    expect(supportFirstCluster?.mass).toBeLessThan(supportLastCluster?.mass ?? 0);
    expect(supportLast?.force.trust).toBeGreaterThan(0);
    expect(supportLast?.force.fear).toBeLessThan(0);
    expect(supportLast?.velocity.trust).toBeGreaterThan(0);
    expect(supportLast?.velocity.fear).toBeLessThan(0);
    expect(support.finalCoordinate.trust).toBeGreaterThan(support.initialCoordinate.trust);
    expect(abandonment.finalCoordinate.trust).toBeLessThan(abandonment.initialCoordinate.trust);
  });

  it("summarizes replay trends for benchmark-style inspection", () => {
    const abandonment = summarizeTraceReplayArtifact(
      buildTraceReplayArtifact({ scenario: "repeated_abandonment_accumulation" })
    );
    const support = summarizeTraceReplayArtifact(
      buildTraceReplayArtifact({ scenario: "support_recovery_accumulation" })
    );
    const abandonmentTrend = abandonment.clusterTrends.find((trend) => trend.category === "abandonment");
    const supportTrend = support.clusterTrends.find((trend) => trend.category === "support");

    expect(abandonment.dominantDirection).toBe("defensive_drift");
    expect(support.dominantDirection).toBe("recovery_drift");
    expect(abandonment.dominantClusterCategory).toBe("abandonment");
    expect(support.dominantClusterCategory).toBe("support");
    expect(abandonment.coordinateDelta.trust).toBeLessThan(0);
    expect(support.coordinateDelta.trust).toBeGreaterThan(0);
    expect(abandonment.forceDelta.trust).toBeLessThan(0);
    expect(support.forceDelta.trust).toBeGreaterThan(0);
    expect(abandonment.velocityDelta.trust).toBeLessThan(0);
    expect(support.velocityDelta.trust).toBeGreaterThan(0);
    expect(abandonmentTrend?.massDelta).toBeGreaterThan(0);
    expect(supportTrend?.massDelta).toBeGreaterThan(0);
  });

  it("builds a summary index across all replay scenarios", () => {
    const index = buildTraceReplaySummaryIndex();

    expect(index.scenarioCount).toBe(Object.keys(traceReplayScenarios).length);
    expect(index.summaries).toHaveLength(index.scenarioCount);
    expect(index.directionCounts.defensive_drift).toBeGreaterThan(0);
    expect(index.directionCounts.recovery_drift).toBeGreaterThan(0);
    expect(index.summaries.map((summary) => summary.scenario)).toContain("support_recovery_accumulation");
  });

  it("validates replay summaries and summary indexes at runtime", () => {
    const summary = summarizeTraceReplayArtifact(
      buildTraceReplayArtifact({ scenario: "support_recovery_accumulation" })
    );
    const index = buildTraceReplaySummaryIndex();
    const invalidSummary = validateTraceReplaySummary({
      ...summary,
      coordinateDelta: { trust: 1 },
      forceDelta: { trust: 1 },
      clusterTrends: []
    });
    const invalidIndex = validateTraceReplaySummaryIndex({
      ...index,
      scenarioCount: index.scenarioCount + 1
    });

    expect(validateTraceReplaySummary(summary).valid).toBe(true);
    expect(validateTraceReplaySummaryIndex(index).valid).toBe(true);
    expect(invalidSummary.valid).toBe(false);
    expect(invalidIndex.valid).toBe(false);
  });
});
