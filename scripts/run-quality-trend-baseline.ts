#!/usr/bin/env npx tsx
/**
 * V10.76 — Quality Trend Baseline CLI
 *
 * Runs Unified Quality Gate, compares against previous baseline (if exists),
 * and produces trend reports.
 *
 * Outputs:
 *   - outputs/quality-trend-current.json
 *   - outputs/quality-trend-report.md
 *
 * Usage:
 *   npx tsx scripts/run-quality-trend-baseline.ts
 *   npx tsx scripts/run-quality-trend-baseline.ts --save-baseline
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runUnifiedQualityGate } from "../src/core/audit/unifiedQualityGate";
import { runQualityTrendBaseline, snapshotGate, type QualityTrendResult } from "../src/core/audit/qualityTrendBaseline";

const OUT_DIR = resolve("outputs");
const BASELINE_PATH = resolve(OUT_DIR, "quality-trend-baseline.json");
const CURRENT_PATH = resolve(OUT_DIR, "quality-trend-current.json");
const REPORT_PATH = resolve(OUT_DIR, "quality-trend-report.md");

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // Run current quality gate
  const current = runUnifiedQualityGate();

  // Read previous baseline if exists (as QualityBaselineSnapshot)
  let previousSnapshot = null;
  if (existsSync(BASELINE_PATH)) {
    try {
      previousSnapshot = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
    } catch {
      console.log("Could not parse previous baseline — treating as NO_BASELINE");
    }
  }

  // Run trend analysis
  const trend = runQualityTrendBaseline({ current, previousSnapshot });

  // Write current as JSON
  writeFileSync(CURRENT_PATH, JSON.stringify(serializeTrend(trend), null, 2), "utf-8");
  console.log(`Current trend written to: ${CURRENT_PATH}`);

  // Write markdown report
  writeFileSync(REPORT_PATH, buildTrendMarkdown(trend), "utf-8");
  console.log(`Trend report written to: ${REPORT_PATH}`);

  // Optionally save as new baseline
  if (process.argv.includes("--save-baseline")) {
    const baselineSnapshot = snapshotGate(current);
    writeFileSync(BASELINE_PATH, JSON.stringify(baselineSnapshot, null, 2), "utf-8");
    console.log(`Baseline saved to: ${BASELINE_PATH}`);
  }

  // Console summary
  console.log("");
  console.log(`Trend Verdict: ${trend.trendVerdict}`);
  console.log(`  Has Baseline: ${trend.hasBaseline}`);
  console.log(`  Verdict Delta: ${trend.verdictDelta}`);
  console.log(`  Warning Delta: ${trend.warningDelta >= 0 ? "+" : ""}${trend.warningDelta}`);
  console.log(`  Failure Delta: ${trend.failureDelta >= 0 ? "+" : ""}${trend.failureDelta}`);
  console.log(`  Regression Flags: ${trend.regressionFlags.length}`);
  console.log(`  Improvement Flags: ${trend.improvementFlags.length}`);
  for (const f of trend.regressionFlags.filter((f) => f.severity === "high")) {
    console.log(`  REGRESSION: ${f.description}`);
  }
  for (const action of trend.recommendedActions.slice(0, 3)) {
    console.log(`  → ${action}`);
  }

  const hasHighRegression = trend.regressionFlags.some((f) => f.severity === "high");
  process.exit(hasHighRegression ? 1 : 0);
}

function serializeTrend(trend: QualityTrendResult): unknown {
  return {
    trendVersion: trend.trendVersion,
    comparedAt: trend.comparedAt,
    hasBaseline: trend.hasBaseline,
    trendVerdict: trend.trendVerdict,
    verdictDelta: trend.verdictDelta,
    warningDelta: trend.warningDelta,
    failureDelta: trend.failureDelta,
    current: trend.current,
    previous: trend.previous,
    metricDeltas: trend.metricDeltas.map((m) => ({
      key: m.key, label: m.label, current: m.current, previous: m.previous, delta: m.delta,
    })),
    regressionFlags: trend.regressionFlags,
    improvementFlags: trend.improvementFlags,
    recommendedActions: trend.recommendedActions,
  };
}

function buildTrendMarkdown(trend: QualityTrendResult): string {
  const l: string[] = [];
  l.push("# Quality Trend Report — V10.76");
  l.push("");
  l.push(`**Compared:** ${trend.comparedAt}`);
  l.push(`**Trend Verdict:** **${trend.trendVerdict}**`);
  l.push(`**Has Baseline:** ${trend.hasBaseline}`);
  l.push(`**Verdict Delta:** ${trend.verdictDelta}`);
  l.push(`**Warning Delta:** ${trend.warningDelta >= 0 ? "+" : ""}${trend.warningDelta}`);
  l.push(`**Failure Delta:** ${trend.failureDelta >= 0 ? "+" : ""}${trend.failureDelta}`);
  l.push("");

  l.push("## Current Baseline");
  l.push("");
  l.push(`| Metric | Value |`);
  l.push(`|--------|-------|`);
  l.push(`| Quality Verdict | ${trend.current.qualityVerdict} |`);
  l.push(`| Release Ready | ${trend.current.releaseReady} |`);
  l.push(`| Failures | ${trend.current.failureCount} |`);
  l.push(`| Warnings | ${trend.current.warningCount} |`);
  l.push(`| Benchmark Pass Rate | ${(trend.current.benchmarkPassRate * 100).toFixed(0)}% |`);
  l.push(`| Support Boundary Safe | ${trend.current.supportBoundarySafe} |`);
  l.push(`| Neutral Stable | ${trend.current.neutralStable} |`);
  l.push("");

  if (trend.previous) {
    l.push("## Previous Baseline Comparison");
    l.push("");
    l.push(`| Metric | Previous | Current | Δ |`);
    l.push(`|--------|----------|---------|---|`);
    for (const m of trend.metricDeltas) {
      l.push(`| ${m.label} | ${m.previous} | ${m.current} | ${m.delta >= 0 ? "+" : ""}${m.delta} |`);
    }
    l.push("");
  }

  if (trend.regressionFlags.length > 0) {
    l.push("## Regression Flags");
    for (const f of trend.regressionFlags) {
      l.push(`- **${f.severity.toUpperCase()}** ${f.description}`);
    }
    l.push("");
  }

  if (trend.improvementFlags.length > 0) {
    l.push("## Improvement Flags");
    for (const f of trend.improvementFlags) {
      l.push(`- ${f.description}`);
    }
    l.push("");
  }

  l.push("## Recommended Actions");
  for (const a of trend.recommendedActions) l.push(`- ${a}`);
  l.push("");

  return l.join("\n");
}

main();
