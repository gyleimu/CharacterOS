/**
 * V10.76 — Quality Trend Baseline / Regression History
 *
 * Compares current UnifiedQualityGateResult against a previous baseline
 * to detect regressions, improvements, and trend direction.
 */
import type { UnifiedQualityGateResult } from "./unifiedQualityGate";
import type { CoreRealityGateResult } from "./coreRealityRegressionGate";

export type TrendVerdict = "IMPROVED" | "STABLE" | "REGRESSED" | "NO_BASELINE";

export interface TrendMetric {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  tolerance: number;
  direction: "higher_is_better" | "lower_is_better" | "stable_is_better";
}

export interface RegressionFlag {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  metric?: string;
  currentValue?: number;
  previousValue?: number;
}

export interface ImprovementFlag {
  id: string;
  description: string;
  metric?: string;
  delta?: number;
}

export interface QualityTrendBaselineInput {
  current: UnifiedQualityGateResult;
  /** Previous baseline snapshot (from quality-trend-baseline.json). */
  previousSnapshot?: QualityBaselineSnapshot | null;
  /** Tolerance for metric deltas before flagging (default 0.05). */
  metricTolerance?: number;
  /** Maximum allowed warning count increase before WARN regression (default 2). */
  maxWarningIncrease?: number;
}

export interface QualityBaselineSnapshot {
  version: string;
  capturedAt: string;
  qualityVerdict: string;
  releaseReady: boolean;
  failureCount: number;
  warningCount: number;
  benchmarkPassRate: number;
  benchmarkPassed: number;
  benchmarkFailed: number;
  realityAuditPass: number;
  realityAuditWarn: number;
  realityAuditFail: number;
  accumulationBetrayalVerdict: string;
  accumulationSupportVerdict: string;
  accumulationNeutralVerdict: string;
  coverageVerdict: string;
  supportBoundarySafe: boolean;
  neutralStable: boolean;
  decisionResponsive: boolean;
  explanationGrounded: boolean;
}

export interface QualityTrendResult {
  trendVersion: string;
  comparedAt: string;
  hasBaseline: boolean;
  current: QualityBaselineSnapshot;
  previous: QualityBaselineSnapshot | null;
  metricDeltas: TrendMetric[];
  regressionFlags: RegressionFlag[];
  improvementFlags: ImprovementFlag[];
  /** Warning count delta (current - previous). Negative = fewer warnings = improvement. */
  warningDelta: number;
  /** Failure count delta (current - previous). */
  failureDelta: number;
  /** Verdict change (e.g. "WARN → WARN"). */
  verdictDelta: string;
  trendVerdict: TrendVerdict;
  recommendedActions: string[];
}

export function runQualityTrendBaseline(
  input: QualityTrendBaselineInput,
): QualityTrendResult {
  const comparedAt = new Date().toISOString();
  const tolerance = input.metricTolerance ?? 0.05;
  const maxWarningIncrease = input.maxWarningIncrease ?? 2;

  const current = snapshotGate(input.current);
  const previous = input.previousSnapshot ?? null;
  const hasBaseline = previous !== null;

  // ── Metric deltas ──
  const metricDeltas = computeMetricDeltas(current, previous, tolerance);

  // ── Regression flags ──
  const regressionFlags: RegressionFlag[] = [];
  const improvementFlags: ImprovementFlag[] = [];

  // Check verdict regression
  const verdictLevels = { PASS: 0, WARN: 1, FAIL: 2 };
  const currentVerdictLevel = verdictLevels[current.qualityVerdict as keyof typeof verdictLevels] ?? 0;
  const previousVerdictLevel = previous
    ? (verdictLevels[previous.qualityVerdict as keyof typeof verdictLevels] ?? 0)
    : 0;

  if (hasBaseline) {
    // FAIL: quality verdict worsened to FAIL
    if (currentVerdictLevel === 2 && previousVerdictLevel < 2) {
      regressionFlags.push({
        id: "regression_verdict_to_fail",
        description: `Quality verdict degraded from ${previous!.qualityVerdict} to FAIL`,
        severity: "high",
      });
    }

    // WARN: quality verdict worsened to WARN from PASS
    if (currentVerdictLevel === 1 && previousVerdictLevel === 0) {
      regressionFlags.push({
        id: "regression_verdict_to_warn",
        description: `Quality verdict degraded from PASS to WARN`,
        severity: "medium",
      });
    }

    // FAIL: release readiness regressed
    if (!current.releaseReady && previous!.releaseReady) {
      regressionFlags.push({
        id: "regression_release_readiness",
        description: "Release readiness changed from true to false",
        severity: "high",
      });
    }

    // FAIL: failure count increased
    if (current.failureCount > previous!.failureCount) {
      regressionFlags.push({
        id: "regression_failure_count",
        description: `Failures increased from ${previous!.failureCount} to ${current.failureCount} (${current.failureCount - previous!.failureCount} new)`,
        severity: "high",
        currentValue: current.failureCount,
        previousValue: previous!.failureCount,
      });
    }

    // WARN: warning count increased beyond tolerance
    const warningDelta = current.warningCount - previous!.warningCount;
    if (warningDelta > maxWarningIncrease) {
      regressionFlags.push({
        id: "regression_warning_spike",
        description: `Warnings increased by ${warningDelta} (from ${previous!.warningCount} to ${current.warningCount}), exceeding max ${maxWarningIncrease}`,
        severity: "medium",
        currentValue: current.warningCount,
        previousValue: previous!.warningCount,
      });
    } else if (warningDelta > 0) {
      regressionFlags.push({
        id: "regression_warning_increase",
        description: `Warnings increased from ${previous!.warningCount} to ${current.warningCount} (${warningDelta} new)`,
        severity: "low",
        currentValue: current.warningCount,
        previousValue: previous!.warningCount,
      });
    }

    // FAIL: support boundary safety regressed
    if (!current.supportBoundarySafe && previous!.supportBoundarySafe) {
      regressionFlags.push({
        id: "regression_support_boundary",
        description: "Support boundary safety regressed — V10.70 fix may have been broken",
        severity: "high",
      });
    }

    // FAIL: neutral stability regressed
    if (!current.neutralStable && previous!.neutralStable) {
      regressionFlags.push({
        id: "regression_neutral_stability",
        description: "Neutral event stability regressed",
        severity: "high",
      });
    }

    // WARN: benchmark pass rate dropped beyond tolerance
    if (previous!.benchmarkPassRate > 0) {
      const benchmarkDrop = previous!.benchmarkPassRate - current.benchmarkPassRate;
      if (benchmarkDrop > tolerance) {
        regressionFlags.push({
          id: "regression_benchmark_pass_rate",
          description: `Benchmark pass rate dropped from ${(previous!.benchmarkPassRate * 100).toFixed(0)}% to ${(current.benchmarkPassRate * 100).toFixed(0)}% (Δ${(benchmarkDrop * 100).toFixed(1)}%)`,
          severity: "medium",
          currentValue: current.benchmarkPassRate,
          previousValue: previous!.benchmarkPassRate,
        });
      }
    }

    // WARN: reality audit pass count decreased
    if (current.realityAuditPass < previous!.realityAuditPass) {
      regressionFlags.push({
        id: "regression_reality_pass",
        description: `Reality audit pass count decreased from ${previous!.realityAuditPass} to ${current.realityAuditPass}`,
        severity: "low",
      });
    }

    // ── Improvement flags ──
    if (currentVerdictLevel < previousVerdictLevel) {
      improvementFlags.push({
        id: "improvement_verdict",
        description: `Quality verdict improved from ${previous!.qualityVerdict} to ${current.qualityVerdict}`,
      });
    }

    if (current.warningCount < previous!.warningCount) {
      improvementFlags.push({
        id: "improvement_warning_count",
        description: `Warnings decreased from ${previous!.warningCount} to ${current.warningCount}`,
        delta: current.warningCount - previous!.warningCount,
      });
    }

    if (current.failureCount < previous!.failureCount) {
      improvementFlags.push({
        id: "improvement_failure_count",
        description: `Failures decreased from ${previous!.failureCount} to ${current.failureCount}`,
        delta: current.failureCount - previous!.failureCount,
      });
    }

    if (current.benchmarkPassRate > previous!.benchmarkPassRate + tolerance) {
      improvementFlags.push({
        id: "improvement_benchmark",
        description: `Benchmark pass rate improved from ${(previous!.benchmarkPassRate * 100).toFixed(0)}% to ${(current.benchmarkPassRate * 100).toFixed(0)}%`,
        delta: current.benchmarkPassRate - previous!.benchmarkPassRate,
      });
    }
  }

  // ── Determine trend verdict ──
  let trendVerdict: TrendVerdict;
  if (!hasBaseline) {
    trendVerdict = "NO_BASELINE";
  } else if (regressionFlags.some((f) => f.severity === "high")) {
    trendVerdict = "REGRESSED";
  } else if (regressionFlags.length > 0) {
    trendVerdict = "REGRESSED";
  } else if (improvementFlags.length > 0) {
    trendVerdict = "IMPROVED";
  } else {
    trendVerdict = "STABLE";
  }

  // ── Recommended actions ──
  const actions: string[] = [];
  if (!hasBaseline) {
    actions.push("Save current result as baseline for future trend comparison");
    actions.push("Run trend baseline again after next core logic change");
  }
  if (trendVerdict === "REGRESSED") {
    for (const f of regressionFlags.filter((f) => f.severity === "high")) {
      actions.push(`CRITICAL: Fix ${f.description}`);
    }
    actions.push("Review all regression flags before next release");
  }
  if (trendVerdict === "IMPROVED") {
    actions.push("Update baseline to reflect improvements");
    actions.push("Continue tracking remaining warnings");
  }
  if (trendVerdict === "STABLE" && hasBaseline) {
    actions.push("No changes detected — system is stable");
  }

  const warningDelta = hasBaseline ? current.warningCount - previous!.warningCount : 0;
  const failureDelta = hasBaseline ? current.failureCount - previous!.failureCount : 0;
  const verdictDelta = hasBaseline
    ? `${previous!.qualityVerdict} → ${current.qualityVerdict}`
    : "no baseline";

  return {
    trendVersion: "10.76.0",
    comparedAt,
    hasBaseline,
    current,
    previous,
    metricDeltas,
    regressionFlags,
    improvementFlags,
    warningDelta,
    failureDelta,
    verdictDelta,
    trendVerdict,
    recommendedActions: actions,
  };
}

// ── Snapshot extraction ──

export function snapshotGate(gate: UnifiedQualityGateResult): QualityBaselineSnapshot {
  return {
    version: gate.version,
    capturedAt: gate.completedAt,
    qualityVerdict: gate.qualityVerdict.level,
    releaseReady: gate.releaseReadiness.ready,
    failureCount: gate.failures.length,
    warningCount: gate.warnings.length,
    benchmarkPassRate: gate.benchmarkSummary?.passRate ?? 1,
    benchmarkPassed: gate.benchmarkSummary?.passed ?? 0,
    benchmarkFailed: gate.benchmarkSummary?.failed ?? 0,
    realityAuditPass: gate.realityGateResult.summary.realityAuditPassed ? 1 : 0,
    realityAuditWarn: gate.realityGateResult.summary.warned,
    realityAuditFail: gate.realityGateResult.summary.failed,
    accumulationBetrayalVerdict: gate.realityGateResult.suites.longTermAccumulation.betrayalAccumulation.accumulationVerdict.level,
    accumulationSupportVerdict: gate.realityGateResult.suites.longTermAccumulation.supportAccumulation.accumulationVerdict.level,
    accumulationNeutralVerdict: gate.realityGateResult.suites.longTermAccumulation.neutralAccumulation.accumulationVerdict.level,
    coverageVerdict: gate.realityGateResult.suites.eventTypeCoverage.coverageVerdict.level,
    supportBoundarySafe: gate.realityGateResult.summary.supportBoundarySafe,
    neutralStable: gate.realityGateResult.summary.neutralStable,
    decisionResponsive: gate.realityGateResult.summary.decisionResponsivenessPassed,
    explanationGrounded: gate.realityGateResult.summary.explanationGrounded,
  };
}

// ── Metric delta computation ──

function computeMetricDeltas(
  current: QualityBaselineSnapshot,
  previous: QualityBaselineSnapshot | null,
  tolerance: number,
): TrendMetric[] {
  const metrics: Array<{
    key: string; label: string;
    current: number; previous: number;
    direction: TrendMetric["direction"];
  }> = [
    { key: "failureCount", label: "Failure Count", current: current.failureCount, previous: previous?.failureCount ?? 0, direction: "lower_is_better" },
    { key: "warningCount", label: "Warning Count", current: current.warningCount, previous: previous?.warningCount ?? 0, direction: "lower_is_better" },
    { key: "benchmarkPassRate", label: "Benchmark Pass Rate", current: current.benchmarkPassRate, previous: previous?.benchmarkPassRate ?? 1, direction: "higher_is_better" },
    { key: "benchmarkPassed", label: "Benchmark Passed", current: current.benchmarkPassed, previous: previous?.benchmarkPassed ?? 0, direction: "higher_is_better" },
    { key: "realityAuditPass", label: "Reality Audit Pass", current: current.realityAuditPass, previous: previous?.realityAuditPass ?? 1, direction: "higher_is_better" },
    { key: "realityAuditWarn", label: "Reality Audit Warn", current: current.realityAuditWarn, previous: previous?.realityAuditWarn ?? 0, direction: "lower_is_better" },
  ];

  return metrics.map((m) => ({
    key: m.key,
    label: m.label,
    current: m.current,
    previous: m.previous,
    delta: round4(m.current - m.previous),
    tolerance,
    direction: m.direction,
  }));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
