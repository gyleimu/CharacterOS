/**
 * V10.75 — Unified Quality Gate
 *
 * Merges Benchmark V2.1 and Core Reality Regression Gate into a single
 * quality gate for CharacterOS core releases.
 */
import { runBenchmarkCases, type RunBenchmarkCasesResult } from "../benchmark/benchmarkRunner";
import { firstReplayBenchmarkFixtures } from "../benchmark/fixtures/firstReplayFixtures";
import { runCoreRealityRegressionGate, type CoreRealityGateResult, type GateConfig } from "./coreRealityRegressionGate";

export type QualityVerdictLevel = "PASS" | "WARN" | "FAIL";

export interface UnifiedQualityGateConfig {
  /** Benchmark pass rate threshold (0–1). Default 0.8. */
  benchmarkMinPassRate?: number;
  /** Benchmark failure tolerance (max allowed failures). Default 1. */
  benchmarkMaxFailures?: number;
  /** Distance-to-threshold for WARN (metric within this distance triggers WARN). Default 0.03. */
  benchmarkWarnMargin?: number;
  /** Reality gate config. */
  realityGateConfig?: GateConfig;
  /** Whether to skip benchmark (for faster iterations). Default false. */
  skipBenchmark?: boolean;
}

export interface BenchmarkQualitySummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  passRate: number;
  verdict: QualityVerdictLevel;
  warnings: string[];
  failures: string[];
  allCategories: string[];
  coveredCategories: string[];
}

export interface UnifiedQualityGateResult {
  version: string;
  startedAt: string;
  completedAt: string;
  config: UnifiedQualityGateConfig;
  benchmarkResult: RunBenchmarkCasesResult | null;
  benchmarkSummary: BenchmarkQualitySummary | null;
  realityGateResult: CoreRealityGateResult;
  unifiedSummary: {
    totalChecks: number;
    passed: number;
    warned: number;
    failed: number;
    benchmarkPassed: boolean;
    realityGatePassed: boolean;
    overallPassed: boolean;
  };
  qualityVerdict: {
    level: QualityVerdictLevel;
    passed: boolean;
    reasons: string[];
    allowedWarnings: string[];
  };
  releaseReadiness: {
    ready: boolean;
    blockers: string[];
    recommendations: string[];
  };
  failures: string[];
  warnings: string[];
  regressionRisks: Array<{ id: string; description: string; severity: string; guardedBy: string }>;
  recommendedNextActions: string[];
}

export function runUnifiedQualityGate(
  config: UnifiedQualityGateConfig = {},
): UnifiedQualityGateResult {
  const startedAt = new Date().toISOString();
  const cfg = normalizeUnifiedConfig(config);
  const allFailures: string[] = [];
  const allWarnings: string[] = [];
  const allReasons: string[] = [];

  // ── Benchmark ──
  let benchmarkResult: RunBenchmarkCasesResult | null = null;
  let benchmarkSummary: BenchmarkQualitySummary | null = null;

  if (!cfg.skipBenchmark) {
    benchmarkResult = runBenchmarkCases({ cases: firstReplayBenchmarkFixtures });
    benchmarkSummary = buildBenchmarkSummary(benchmarkResult, cfg);

    if (benchmarkSummary.verdict === "FAIL") {
      allFailures.push(...benchmarkSummary.failures);
    }
    if (benchmarkSummary.verdict === "WARN") {
      allWarnings.push(...benchmarkSummary.warnings);
    }
    allReasons.push(
      `Benchmark: ${benchmarkSummary.passed}/${benchmarkSummary.total} passed (${(benchmarkSummary.passRate * 100).toFixed(0)}%), ${benchmarkSummary.failed} failed`,
    );
  } else {
    allReasons.push("Benchmark: SKIPPED");
  }

  // ── Reality Gate ──
  const realityGateResult = runCoreRealityRegressionGate(cfg.realityGateConfig);

  if (realityGateResult.gateVerdict.level === "FAIL") {
    allFailures.push(
      ...realityGateResult.failures.map((f) => `[reality] ${f.suite}/${f.caseId ?? ""}: ${f.message}`),
    );
  }
  if (realityGateResult.gateVerdict.level === "WARN") {
    allWarnings.push(
      ...realityGateResult.warnings.map((w) => `[reality] ${w.suite}/${w.caseId ?? ""}: ${w.message}`),
    );
  }
  allReasons.push(
    `Reality Gate: ${realityGateResult.gateVerdict.level} (${realityGateResult.summary.passed}/${realityGateResult.summary.totalChecks} checks)`,
  );

  // ── Combined verdict ──
  const benchmarkPassed = benchmarkSummary ? benchmarkSummary.verdict !== "FAIL" : true;
  const realityGatePassed = realityGateResult.gateVerdict.passed;

  const totalChecks =
    (benchmarkSummary?.total ?? 0) + realityGateResult.summary.totalChecks;
  const passedChecks =
    (benchmarkSummary?.passed ?? 0) + realityGateResult.summary.passed;
  const warnedChecks =
    (benchmarkSummary ? (benchmarkSummary.verdict === "WARN" ? 1 : 0) : 0) +
    realityGateResult.summary.warned;
  const failedChecks =
    (benchmarkSummary?.failed ?? 0) + realityGateResult.summary.failed;

  const level: QualityVerdictLevel =
    allFailures.length > 0 ? "FAIL" :
    allWarnings.length > 0 ? "WARN" :
    "PASS";

  // ── Release readiness ──
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (!benchmarkPassed) {
    blockers.push("Benchmark has failures — fix directional assertions before release");
  }
  if (!realityGatePassed) {
    blockers.push("Reality gate has failures — all core reality checks must pass");
  }
  if (allFailures.length > 0) {
    blockers.push(`${allFailures.length} unified failures detected`);
  }

  if (allWarnings.length > 0 && allFailures.length === 0) {
    recommendations.push(`${allWarnings.length} documented warnings — review before release`);
  }
  if (benchmarkSummary && benchmarkSummary.skipped > 0) {
    recommendations.push(`${benchmarkSummary.skipped} benchmark cases skipped — review coverage`);
  }
  if (realityGateResult.gateVerdict.knownLimitations.length > 0) {
    recommendations.push("Known limitations exist — see reality gate report for details");
  }

  const ready = blockers.length === 0;

  // ── Next actions ──
  const nextActions: string[] = [];
  if (allFailures.length > 0) {
    nextActions.push("Fix all gate failures before proceeding");
  }
  if (benchmarkSummary && benchmarkSummary.failed > 0) {
    nextActions.push(`Fix ${benchmarkSummary.failed} failing benchmark assertions`);
  }
  if (allWarnings.length > 0 && allFailures.length === 0) {
    nextActions.push("Review documented warnings for acceptable risk");
    nextActions.push("Consider V10.76 Quality Trend Baseline to track warning counts over time");
  }
  if (benchmarkSummary && benchmarkSummary.passRate < 0.9) {
    nextActions.push(`Improve benchmark pass rate from ${(benchmarkSummary.passRate * 100).toFixed(0)}% to ≥90%`);
  }
  if (allFailures.length === 0 && allWarnings.length === 0) {
    nextActions.push("All checks pass — system is release-ready");
  }

  // ── Merge regression risks ──
  const risks = [
    ...realityGateResult.regressionRisks,
    { id: "risk_benchmark_regression", description: "Benchmark directional assertions degrading", severity: "high", guardedBy: "benchmark.passRate" },
    { id: "risk_benchmark_coverage_gap", description: "Benchmark category coverage dropping", severity: "medium", guardedBy: "benchmark.coveredCategories" },
  ];

  return {
    version: "10.75.0",
    startedAt,
    completedAt: new Date().toISOString(),
    config: cfg,
    benchmarkResult: benchmarkResult
      ? { results: benchmarkResult.results, passed: benchmarkResult.passed, failed: benchmarkResult.failed, skipped: benchmarkResult.skipped, errored: benchmarkResult.errored }
      : null,
    benchmarkSummary,
    realityGateResult,
    unifiedSummary: {
      totalChecks,
      passed: passedChecks,
      warned: warnedChecks,
      failed: failedChecks,
      benchmarkPassed,
      realityGatePassed,
      overallPassed: allFailures.length === 0,
    },
    qualityVerdict: {
      level,
      passed: allFailures.length === 0,
      reasons: allReasons,
      allowedWarnings: allFailures.length === 0 ? allWarnings : [],
    },
    releaseReadiness: {
      ready,
      blockers,
      recommendations,
    },
    failures: allFailures,
    warnings: allWarnings,
    regressionRisks: risks,
    recommendedNextActions: nextActions,
  };
}

function buildBenchmarkSummary(
  result: RunBenchmarkCasesResult,
  cfg: Required<UnifiedQualityGateConfig>,
): BenchmarkQualitySummary {
  const total = result.results.length;
  const passRate = total > 0 ? result.passed / total : 0;
  const warnings: string[] = [];
  const failures: string[] = [];

  // Check overall pass rate
  if (passRate < cfg.benchmarkMinPassRate) {
    failures.push(
      `benchmark pass rate ${(passRate * 100).toFixed(0)}% < ${(cfg.benchmarkMinPassRate * 100).toFixed(0)}% threshold`,
    );
  }

  // Check failure count
  if (result.failed > cfg.benchmarkMaxFailures) {
    failures.push(
      `benchmark failures ${result.failed} > max ${cfg.benchmarkMaxFailures}`,
    );
  }

  // Check for near-threshold metrics
  if (passRate >= cfg.benchmarkMinPassRate && passRate < cfg.benchmarkMinPassRate + cfg.benchmarkWarnMargin) {
    warnings.push(
      `benchmark pass rate ${(passRate * 100).toFixed(0)}% is within ${(cfg.benchmarkWarnMargin * 100).toFixed(0)}% of threshold ${(cfg.benchmarkMinPassRate * 100).toFixed(0)}%`,
    );
  }

  // Collect categories
  const categories = new Set<string>();
  for (const r of result.results) {
    // Extract category from caseId pattern like "abandonment_event_lowers_trust"
    const parts = r.caseId.split("_");
    if (parts.length > 0) categories.add(parts[0]!);
  }

  const verdict: QualityVerdictLevel =
    failures.length > 0 ? "FAIL" :
    warnings.length > 0 ? "WARN" :
    "PASS";

  return {
    total,
    passed: result.passed,
    failed: result.failed,
    skipped: result.skipped,
    errored: result.errored,
    passRate: round4(passRate),
    verdict,
    warnings,
    failures,
    allCategories: [...categories],
    coveredCategories: [...categories],
  };
}

function normalizeUnifiedConfig(config: UnifiedQualityGateConfig): Required<UnifiedQualityGateConfig> {
  return {
    benchmarkMinPassRate: config.benchmarkMinPassRate ?? 0.8,
    benchmarkMaxFailures: config.benchmarkMaxFailures ?? 1,
    benchmarkWarnMargin: config.benchmarkWarnMargin ?? 0.03,
    realityGateConfig: config.realityGateConfig ?? {},
    skipBenchmark: config.skipBenchmark ?? false,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
