/**
 * V6.7 Benchmark DTO — maps benchmark results to API response shape.
 *
 * Pure functions. Does NOT execute benchmarks.
 */

import type {
  BenchmarkReportResultEntry,
  BenchmarkReportSummary,
  GetBenchmarkReportResponse
} from "@/appContracts/characterPhysics";
import type { RunBenchmarkCasesResult } from "../core/benchmark/benchmarkRunner";
import type { BenchmarkCase } from "../core/benchmark/benchmarkTypes";

export interface BuildBenchmarkReportParams {
  /** Results from running benchmark cases. */
  runResult: RunBenchmarkCasesResult;
  /** All fixtures that were attempted. */
  fixtures: readonly BenchmarkCase[];
  /** Categories the runner currently supports. */
  supportedCategories: readonly string[];
}

/**
 * Build a full benchmark report response from run results.
 */
export function toBenchmarkReportResponse(
  params: BuildBenchmarkReportParams
): GetBenchmarkReportResponse {
  const { runResult, fixtures, supportedCategories } = params;

  const results: BenchmarkReportResultEntry[] = runResult.results.map((r) => ({
    caseId: r.caseId,
    category: fixtures.find((f) => f.id === r.caseId)?.category ?? "unknown",
    verdict: r.verdict,
    passedAssertions: r.assertionResults.filter((a) => a.passed).length,
    totalAssertions: r.assertionResults.length,
    durationMs: r.durationMs,
    warnings: [...r.warnings],
    explanation: r.explanation
  }));

  const summary = summarizeBenchmarkRunResult(runResult, fixtures, supportedCategories);

  const allWarnings = runResult.results.flatMap((r) => r.warnings);
  const uniqueWarnings = [...new Set(allWarnings)];
  const reasons = [
    "CharacterOS V6 Benchmark Report — generated at runtime.",
    `Supported categories: ${supportedCategories.join(", ")}.`,
    "Skipped categories indicate benchmarks not yet implemented — this is expected.",
    "Directional assertions are preferred over exact numeric assertions."
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary,
    results,
    warnings: uniqueWarnings,
    reasons
  };
}

/**
 * Summarize a benchmark run result.
 */
export function summarizeBenchmarkRunResult(
  runResult: RunBenchmarkCasesResult,
  fixtures: readonly BenchmarkCase[],
  supportedCategories: readonly string[]
): BenchmarkReportSummary {
  const categoriesSeen = new Set(fixtures.map((f) => f.category));
  const unsupportedCategories = [...categoriesSeen].filter(
    (c) => !supportedCategories.includes(c)
  );

  return {
    totalCases: fixtures.length,
    passedCount: runResult.passed,
    failedCount: runResult.failed,
    skippedCount: runResult.skipped + unsupportedCategories.length,
    erroredCount: runResult.errored,
    supportedCategories: [...supportedCategories].sort(),
    unsupportedCategories: [...unsupportedCategories].sort()
  };
}
