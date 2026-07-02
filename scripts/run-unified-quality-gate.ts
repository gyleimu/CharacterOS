#!/usr/bin/env npx tsx
/**
 * V10.75 — Unified Quality Gate CLI
 *
 * Runs Benchmark V2.1 + Core Reality Regression Gate and produces:
 *   - outputs/unified-quality-gate-report.json (machine-readable)
 *   - outputs/unified-quality-gate-report.md   (human-readable summary)
 *
 * Usage:
 *   npx tsx scripts/run-unified-quality-gate.ts
 *   npx tsx scripts/run-unified-quality-gate.ts --skip-benchmark
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runUnifiedQualityGate, type UnifiedQualityGateResult } from "../src/core/audit/unifiedQualityGate";

const OUT_DIR = resolve("outputs");

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const skipBenchmark = process.argv.includes("--skip-benchmark");
  const result = runUnifiedQualityGate({ skipBenchmark });

  // ── JSON Report ──
  const jsonPath = resolve(OUT_DIR, "unified-quality-gate-report.json");
  writeFileSync(jsonPath, JSON.stringify(serializeResult(result), null, 2), "utf-8");
  console.log(`JSON report: ${jsonPath}`);

  // ── Markdown Report ──
  const mdPath = resolve(OUT_DIR, "unified-quality-gate-report.md");
  writeFileSync(mdPath, buildMarkdown(result), "utf-8");
  console.log(`Markdown report: ${mdPath}`);

  // ── Console Summary ──
  console.log("");
  console.log(`Quality Verdict: ${result.qualityVerdict.level}`);
  console.log(`  Overall Passed: ${result.unifiedSummary.overallPassed}`);
  console.log(`  Benchmark Passed: ${result.unifiedSummary.benchmarkPassed}`);
  console.log(`  Reality Gate Passed: ${result.unifiedSummary.realityGatePassed}`);
  console.log(`  Failures: ${result.failures.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log(`  Release Ready: ${result.releaseReadiness.ready}`);
  if (result.releaseReadiness.blockers.length > 0) {
    console.log(`  Blockers: ${result.releaseReadiness.blockers.join("; ")}`);
  }
  if (result.recommendedNextActions.length > 0) {
    console.log(`  Next: ${result.recommendedNextActions[0]}`);
  }

  process.exit(result.qualityVerdict.level === "FAIL" ? 1 : 0);
}

function serializeResult(result: UnifiedQualityGateResult): unknown {
  return {
    version: result.version,
    generatedAt: result.completedAt,
    qualityVerdict: result.qualityVerdict,
    releaseReadiness: result.releaseReadiness,
    unifiedSummary: result.unifiedSummary,
    benchmark: result.benchmarkSummary
      ? {
          total: result.benchmarkSummary.total,
          passed: result.benchmarkSummary.passed,
          failed: result.benchmarkSummary.failed,
          passRate: result.benchmarkSummary.passRate,
          verdict: result.benchmarkSummary.verdict,
          warnings: result.benchmarkSummary.warnings,
          failures: result.benchmarkSummary.failures,
        }
      : null,
    realityGate: {
      verdict: result.realityGateResult.gateVerdict.level,
      summary: result.realityGateResult.summary,
      warnings: result.realityGateResult.warnings.map((w) => `${w.suite}/${w.caseId ?? ""}: ${w.message}`),
      failures: result.realityGateResult.failures.map((f) => `${f.suite}/${f.caseId ?? ""}: ${f.message}`),
    },
    failures: result.failures,
    warnings: result.warnings,
    regressionRisks: result.regressionRisks,
    thresholds: {
      benchmarkMinPassRate: result.config.benchmarkMinPassRate,
      benchmarkMaxFailures: result.config.benchmarkMaxFailures,
      benchmarkWarnMargin: result.config.benchmarkWarnMargin,
    },
    recommendedNextActions: result.recommendedNextActions,
  };
}

function buildMarkdown(result: UnifiedQualityGateResult): string {
  const l: string[] = [];
  l.push("# Unified Quality Gate Report — V10.75");
  l.push("");
  l.push(`**Generated:** ${result.completedAt}`);
  l.push(`**Quality Verdict:** **${result.qualityVerdict.level}**`);
  l.push(`**Release Ready:** ${result.releaseReadiness.ready ? "✅ Yes" : "❌ No"}`);
  l.push("");

  l.push("## Summary");
  l.push("");
  l.push(`| Metric | Value |`);
  l.push(`|--------|-------|`);
  l.push(`| Benchmark | ${result.unifiedSummary.benchmarkPassed ? "✅" : "❌"} |`);
  l.push(`| Reality Gate | ${result.unifiedSummary.realityGatePassed ? "✅" : "❌"} |`);
  l.push(`| Total Checks | ${result.unifiedSummary.totalChecks} |`);
  l.push(`| Passed | ${result.unifiedSummary.passed} |`);
  l.push(`| Warned | ${result.unifiedSummary.warned} |`);
  l.push(`| Failed | ${result.unifiedSummary.failed} |`);
  l.push(`| Overall | ${result.unifiedSummary.overallPassed ? "✅" : "❌"} |`);
  l.push("");

  if (result.benchmarkSummary) {
    l.push("## Benchmark V2.1");
    l.push("");
    l.push(`- **Total:** ${result.benchmarkSummary.total}`);
    l.push(`- **Passed:** ${result.benchmarkSummary.passed}`);
    l.push(`- **Failed:** ${result.benchmarkSummary.failed}`);
    l.push(`- **Pass Rate:** ${(result.benchmarkSummary.passRate * 100).toFixed(0)}%`);
    l.push(`- **Verdict:** ${result.benchmarkSummary.verdict}`);
    if (result.benchmarkSummary.warnings.length > 0) {
      l.push(`- **Warnings:** ${result.benchmarkSummary.warnings.join("; ")}`);
    }
    l.push("");
  }

  l.push("## Reality Gate");
  l.push("");
  l.push(`- **Verdict:** ${result.realityGateResult.gateVerdict.level}`);
  l.push(`- **Reality Audit:** ${result.realityGateResult.summary.realityAuditPassed ? "PASS" : "FAIL"}`);
  l.push(`- **Accumulation:** ${result.realityGateResult.summary.accumulationPassed ? "PASS" : "FAIL"}`);
  l.push(`- **Coverage:** ${result.realityGateResult.summary.coveragePassed ? "PASS" : "FAIL"}`);
  l.push("");

  if (result.failures.length > 0) {
    l.push("## Failures");
    for (const f of result.failures) l.push(`- ${f}`);
    l.push("");
  }

  if (result.warnings.length > 0) {
    l.push("## Warnings (Documented)");
    for (const w of result.warnings.slice(0, 15)) l.push(`- ${w}`);
    l.push("");
  }

  if (result.releaseReadiness.blockers.length > 0) {
    l.push("## Release Blockers");
    for (const b of result.releaseReadiness.blockers) l.push(`- ❌ ${b}`);
    l.push("");
  }

  if (result.releaseReadiness.recommendations.length > 0) {
    l.push("## Release Recommendations");
    for (const r of result.releaseReadiness.recommendations) l.push(`- ${r}`);
    l.push("");
  }

  l.push("## Recommended Next Actions");
  for (const a of result.recommendedNextActions) l.push(`- ${a}`);
  l.push("");

  l.push("## Regression Risks");
  for (const r of result.regressionRisks.slice(0, 10)) l.push(`- **${r.severity}** ${r.description}`);
  l.push("");

  return l.join("\n");
}

main();
