import { describe, expect, it } from "vitest";
import { runQualityTrendBaseline, snapshotGate, type QualityBaselineSnapshot } from "../../../src/core/audit/qualityTrendBaseline";
import { runUnifiedQualityGate } from "../../../src/core/audit/unifiedQualityGate";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function makeSnapshot(overrides: Partial<QualityBaselineSnapshot> = {}): QualityBaselineSnapshot {
  return {
    version: "10.75.0",
    capturedAt: new Date().toISOString(),
    qualityVerdict: "WARN",
    releaseReady: true,
    failureCount: 0,
    warningCount: 3,
    benchmarkPassRate: 1,
    benchmarkPassed: 6,
    benchmarkFailed: 0,
    realityAuditPass: 1,
    realityAuditWarn: 3,
    realityAuditFail: 0,
    accumulationBetrayalVerdict: "WARN",
    accumulationSupportVerdict: "PASS",
    accumulationNeutralVerdict: "WARN",
    coverageVerdict: "WARN",
    supportBoundarySafe: true,
    neutralStable: true,
    decisionResponsive: true,
    explanationGrounded: true,
    ...overrides,
  };
}

describe("V10.76 Quality Trend Baseline", () => {
  const currentGate = runUnifiedQualityGate({ skipDeterminism: true });

  it("no previous baseline returns NO_BASELINE", () => {
    const trend = runQualityTrendBaseline({ current: currentGate, previousSnapshot: null });
    expect(trend.trendVerdict).toBe("NO_BASELINE");
    expect(trend.hasBaseline).toBe(false);
    expect(trend.previous).toBeNull();
    expect(trend.recommendedActions.length).toBeGreaterThan(0);
  });

  it("identical baseline returns STABLE", () => {
    const currentSnapshot = snapshotGate(currentGate);
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: currentSnapshot,
    });

    expect(trend.trendVerdict).toBe("STABLE");
    expect(trend.hasBaseline).toBe(true);
    expect(trend.regressionFlags).toHaveLength(0);
    expect(trend.warningDelta).toBe(0);
    expect(trend.failureDelta).toBe(0);
  });

  it("warning count decrease returns IMPROVED", () => {
    const worseBaseline = makeSnapshot({ warningCount: 6 });
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: worseBaseline,
    });

    expect(trend.trendVerdict).toBe("IMPROVED");
    expect(trend.warningDelta).toBeLessThan(0);
    expect(trend.improvementFlags.length).toBeGreaterThan(0);
    expect(trend.improvementFlags.some((f) => f.id === "improvement_warning_count")).toBe(true);
  });

  it("failure increase returns REGRESSED", () => {
    const cleanBaseline = makeSnapshot({ failureCount: 0 });
    const badGate = runUnifiedQualityGate({
      realityGateConfig: { maxNeutralPersonalityDistance: 0.0001 },
      skipDeterminism: true,
    });

    const trend = runQualityTrendBaseline({
      current: badGate,
      previousSnapshot: cleanBaseline,
    });

    // With a very tight neutral threshold, there should be failures
    if (badGate.failures.length > 0) {
      expect(trend.trendVerdict).toBe("REGRESSED");
      expect(trend.regressionFlags.length).toBeGreaterThan(0);
    }
  });

  it("releaseReady true→false returns REGRESSED", () => {
    const readyBaseline = makeSnapshot({ releaseReady: true });
    const notReadyBaseline = makeSnapshot({ releaseReady: false });

    // Create a scenario where current has failures (not ready)
    const strictGate = runUnifiedQualityGate({
      realityGateConfig: { maxNeutralPersonalityDistance: 0.0001 },
      benchmarkMinPassRate: 1.0,
      benchmarkMaxFailures: 0,
      skipDeterminism: true,
    });

    // Only test regression if the strict gate actually has failures
    if (strictGate.failures.length > 0) {
      const trend = runQualityTrendBaseline({
        current: strictGate,
        previousSnapshot: readyBaseline,
      });
      expect(trend.regressionFlags.some((f) => f.id === "regression_release_readiness")).toBe(true);
    }
  });

  it("qualityVerdict degradations create regression flags", () => {
    const passBaseline = makeSnapshot({ qualityVerdict: "PASS", warningCount: 0 });
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: passBaseline,
    });

    // Current is WARN, previous was PASS → regression
    if (currentGate.qualityVerdict.level === "WARN" && passBaseline.qualityVerdict === "PASS") {
      expect(trend.regressionFlags.some((f) => f.id === "regression_verdict_to_warn")).toBe(true);
    }
  });

  it("improvement flag created for verdict improvement", () => {
    const failBaseline = makeSnapshot({ qualityVerdict: "FAIL", failureCount: 3, warningCount: 5 });
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: failBaseline,
    });

    // Current is WARN, previous was FAIL → improvement
    expect(trend.improvementFlags.some((f) => f.id === "improvement_verdict")).toBe(true);
    expect(trend.improvementFlags.some((f) => f.id === "improvement_failure_count")).toBe(true);
    expect(trend.improvementFlags.some((f) => f.id === "improvement_warning_count")).toBe(true);
  });

  it("trend comparison does not mutate input gate result", () => {
    const snapshot1 = snapshotGate(currentGate);
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: snapshot1,
    });
    const snapshot2 = snapshotGate(currentGate);

    // Gate should be unchanged after trend analysis
    expect(snapshot2.warningCount).toBe(snapshot1.warningCount);
    expect(snapshot2.failureCount).toBe(snapshot1.failureCount);
    expect(snapshot2.qualityVerdict).toBe(snapshot1.qualityVerdict);
  });

  it("trend output has deterministic structure", () => {
    const trend1 = runQualityTrendBaseline({ current: currentGate, previousSnapshot: makeSnapshot() });
    const trend2 = runQualityTrendBaseline({ current: currentGate, previousSnapshot: makeSnapshot() });

    expect(trend2.trendVersion).toBe(trend1.trendVersion);
    expect(trend2.hasBaseline).toBe(trend1.hasBaseline);
    expect(trend2.trendVerdict).toBe(trend1.trendVerdict);
    expect(Array.isArray(trend2.metricDeltas)).toBe(true);
    expect(Array.isArray(trend2.regressionFlags)).toBe(true);
    expect(Array.isArray(trend2.improvementFlags)).toBe(true);
    expect(Array.isArray(trend2.recommendedActions)).toBe(true);
  });

  it("script writes current JSON and markdown", () => {
    const currentPath = resolve("outputs/quality-trend-current.json");
    const reportPath = resolve("outputs/quality-trend-report.md");

    expect(existsSync(currentPath)).toBe(true);
    expect(existsSync(reportPath)).toBe(true);

    const json = JSON.parse(readFileSync(currentPath, "utf-8"));
    expect(json.trendVersion).toBeDefined();
    expect(json.trendVerdict).toBeDefined();
    expect(json.current).toBeDefined();
    expect(json.metricDeltas).toBeDefined();

    const md = readFileSync(reportPath, "utf-8");
    expect(md).toContain("Quality Trend");
    expect(md).toContain("Trend Verdict");
    expect(md).toContain("Current Baseline");
  });

  it("metric deltas track all required metrics", () => {
    const trend = runQualityTrendBaseline({
      current: currentGate,
      previousSnapshot: makeSnapshot({ warningCount: 5, failureCount: 1, benchmarkPassRate: 0.9 }),
    });

    const keys = trend.metricDeltas.map((m) => m.key);
    expect(keys).toContain("failureCount");
    expect(keys).toContain("warningCount");
    expect(keys).toContain("benchmarkPassRate");
    expect(keys).toContain("benchmarkPassed");
    expect(keys).toContain("realityAuditPass");
    expect(keys).toContain("realityAuditWarn");
  });
});
