#!/usr/bin/env npx tsx
/**
 * V13.3 — Determinism Boundary Audit CLI
 *
 * Runs the determinism boundary audit and produces:
 *   - outputs/determinism-boundary-audit.json (machine-readable)
 *   - outputs/determinism-boundary-audit.md   (human-readable summary)
 *
 * Usage:
 *   npx tsx scripts/run-determinism-boundary-audit.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runDeterminismBoundaryAudit,
  summarizeDeterminismAudit,
  type DeterminismBoundaryAuditResult,
} from "../src/core/audit/determinismBoundaryAudit";

const OUT_DIR = resolve("outputs");

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const result = runDeterminismBoundaryAudit();

  // ── JSON Report ──
  const jsonPath = resolve(OUT_DIR, "determinism-boundary-audit.json");
  writeFileSync(jsonPath, JSON.stringify(serializeResult(result), null, 2), "utf-8");
  console.log(`JSON report: ${jsonPath}`);

  // ── Markdown Report ──
  const mdPath = resolve(OUT_DIR, "determinism-boundary-audit.md");
  writeFileSync(mdPath, buildMarkdown(result), "utf-8");
  console.log(`Markdown report: ${mdPath}`);

  // ── Console Summary ──
  console.log("");
  console.log(`Determinism Boundary Audit v${result.auditVersion}`);
  console.log(`  Passed: ${result.passed ? "✅ YES" : "❌ NO"}`);
  console.log(`  Release Ready: ${result.releaseReady ? "✅ YES" : "❌ NO"}`);
  console.log(`  Modules: ${result.checkedModules.filter((m) => m.passed).length}/${result.checkedModules.length} passed`);
  console.log(`  Forbidden findings: ${result.forbiddenPatternFindings.length}`);
  console.log(`  Allowed runtime sources: ${result.allowedRuntimeSources.length}`);
  console.log(`  Replay tests: ${result.deterministicReplayResults.filter((r) => r.passed).length}/${result.deterministicReplayResults.length} passed`);
  console.log(`  Failures: ${result.failures.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);

  if (result.failures.length > 0) {
    console.log("");
    console.log("FAILURES:");
    for (const f of result.failures) {
      console.log(`  ❌ ${f}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("WARNINGS:");
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  process.exit(result.passed ? 0 : 1);
}

function serializeResult(result: DeterminismBoundaryAuditResult): unknown {
  return {
    auditVersion: result.auditVersion,
    auditedAt: result.auditedAt,
    passed: result.passed,
    releaseReady: result.releaseReady,
    summary: {
      modulesTotal: result.checkedModules.length,
      modulesPassed: result.checkedModules.filter((m) => m.passed).length,
      forbiddenFindings: result.forbiddenPatternFindings.length,
      allowedRuntimeSources: result.allowedRuntimeSources.length,
      replayPassed: result.deterministicReplayResults.filter((r) => r.passed).length,
      replayTotal: result.deterministicReplayResults.length,
      failures: result.failures.length,
      warnings: result.warnings.length,
    },
    checkedModules: result.checkedModules.map((m) => ({
      moduleName: m.moduleName,
      passed: m.passed,
      staticFindings: m.staticFindings,
      forbiddenFindings: m.forbiddenFindings,
      replayPassed: m.replayResults.filter((r) => r.passed).length,
      replayTotal: m.replayResults.length,
    })),
    forbiddenPatternFindings: result.forbiddenPatternFindings,
    allowedRuntimeSources: result.allowedRuntimeSources,
    deterministicReplayResults: result.deterministicReplayResults,
    failures: result.failures,
    warnings: result.warnings,
  };
}

function buildMarkdown(result: DeterminismBoundaryAuditResult): string {
  const l: string[] = [];
  l.push("# Determinism Boundary Audit — V13.3");
  l.push("");
  l.push(`**Audited:** ${result.auditedAt}`);
  l.push(`**Verdict:** ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
  l.push(`**Release Ready:** ${result.releaseReady ? "✅ Yes" : "❌ No"}`);
  l.push("");

  l.push("## Summary");
  l.push("");
  l.push(`| Metric | Value |`);
  l.push(`|--------|-------|`);
  l.push(`| Modules checked | ${result.checkedModules.length} |`);
  l.push(`| Modules passed | ${result.checkedModules.filter((m) => m.passed).length} |`);
  l.push(`| Forbidden findings | ${result.forbiddenPatternFindings.length} |`);
  l.push(`| Allowed runtime sources | ${result.allowedRuntimeSources.length} |`);
  l.push(`| Replay tests passed | ${result.deterministicReplayResults.filter((r) => r.passed).length}/${result.deterministicReplayResults.length} |`);
  l.push(`| Failures | ${result.failures.length} |`);
  l.push(`| Warnings | ${result.warnings.length} |`);
  l.push("");

  l.push("## Modules");
  l.push("");
  l.push("| Module | Status | Forbidden | Replay |");
  l.push("|--------|--------|-----------|--------|");
  for (const m of result.checkedModules) {
    const replayStr = `${m.replayResults.filter((r) => r.passed).length}/${m.replayResults.length}`;
    l.push(`| ${m.moduleName} | ${m.passed ? "✅" : "❌"} | ${m.forbiddenFindings} | ${replayStr} |`);
  }
  l.push("");

  if (result.forbiddenPatternFindings.length > 0) {
    l.push("## Forbidden Pattern Findings");
    l.push("");
    for (const f of result.forbiddenPatternFindings) {
      l.push(`- **❌ ${f.file}:${f.line}** — \`${f.pattern}\``);
      l.push(`  - Context: \`${f.context}\``);
      l.push(`  - Reason: ${f.reason}`);
    }
    l.push("");
  }

  if (result.allowedRuntimeSources.length > 0) {
    l.push("## Allowed Runtime Sources");
    l.push("");
    l.push("These patterns use runtime timestamps but are classified as allowed because they are not in core default paths:");
    l.push("");
    for (const src of result.allowedRuntimeSources) {
      l.push(`- **${src.file}:${src.line}** — \`${src.source}\``);
      l.push(`  - ${src.justification}`);
    }
    l.push("");
  }

  l.push("## Replay Results");
  l.push("");
  for (const r of result.deterministicReplayResults) {
    l.push(`- ${r.passed ? "✅" : "❌"} **${r.functionName}**: ${r.note}`);
  }
  l.push("");

  if (result.failures.length > 0) {
    l.push("## Failures");
    l.push("");
    for (const f of result.failures) {
      l.push(`- ❌ ${f}`);
    }
    l.push("");
  }

  if (result.warnings.length > 0) {
    l.push("## Warnings");
    l.push("");
    for (const w of result.warnings) {
      l.push(`- ⚠ ${w}`);
    }
    l.push("");
  }

  return l.join("\n");
}

main();
