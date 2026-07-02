#!/usr/bin/env npx tsx
/**
 * V10.74 — Core Reality Regression Gate CLI
 *
 * Runs all core reality audit suites and produces:
 *   - outputs/core-reality-gate-report.json (machine-readable)
 *   - outputs/core-reality-gate-report.md   (human-readable summary)
 *
 * Usage:
 *   npx tsx scripts/run-core-reality-gate.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCoreRealityRegressionGate, type CoreRealityGateResult } from "../src/core/audit/coreRealityRegressionGate";

const OUT_DIR = resolve("outputs");

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const result = runCoreRealityRegressionGate();

  // ── JSON Report ──
  const jsonPath = resolve(OUT_DIR, "core-reality-gate-report.json");
  const jsonPayload = JSON.stringify(serializeGateResult(result), null, 2);
  writeFileSync(jsonPath, jsonPayload, "utf-8");
  console.log(`JSON report written to: ${jsonPath}`);

  // ── Markdown Report ──
  const mdPath = resolve(OUT_DIR, "core-reality-gate-report.md");
  const mdContent = buildMarkdownReport(result);
  writeFileSync(mdPath, mdContent, "utf-8");
  console.log(`Markdown report written to: ${mdPath}`);

  // ── Console Summary ──
  console.log("");
  console.log(`Gate Verdict: ${result.gateVerdict.level}`);
  console.log(`  Passed: ${result.gateVerdict.passed}`);
  console.log(`  Failures: ${result.failures.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log(`  Reality Audit: ${result.summary.realityAuditPassed ? "PASS" : "FAIL"}`);
  console.log(`  Accumulation: ${result.summary.accumulationPassed ? "PASS" : "FAIL"}`);
  console.log(`  Coverage: ${result.summary.coveragePassed ? "PASS" : "FAIL"}`);
  console.log(`  Decision Responsive: ${result.summary.decisionResponsivenessPassed ? "PASS" : "FAIL"}`);
  console.log(`  Explanation Grounded: ${result.summary.explanationGrounded}`);
  console.log(`  Support Boundary Safe: ${result.summary.supportBoundarySafe}`);
  console.log(`  Neutral Stable: ${result.summary.neutralStable}`);
  console.log(`  Required for Release: ${result.requiredForRelease}`);

  process.exit(result.gateVerdict.level === "FAIL" ? 1 : 0);
}

function serializeGateResult(result: CoreRealityGateResult): unknown {
  return {
    version: result.version,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    gateVerdict: result.gateVerdict,
    summary: result.summary,
    failures: result.failures,
    warnings: result.warnings,
    knownWarningSummary: result.knownWarningSummary,
    warningRegistry: {
      activeWarnings: result.warningRegistry.activeWarnings,
      allowedWarnings: result.warningRegistry.allowedWarnings,
      resolvedWarningRegressions: result.warningRegistry.resolvedWarningRegressions,
    },
    regressionRisks: result.regressionRisks,
    requiredForRelease: result.requiredForRelease,
    suiteResults: {
      realityAudit: {
        version: result.suites.realityAudit.version,
        summary: result.suites.realityAudit.summary,
        counterfactualVerdict: result.suites.realityAudit.counterfactual.verdict.level,
        personalityDifferentiationVerdict: result.suites.realityAudit.personalityDifferentiation.verdict.level,
      },
      longTermAccumulation: {
        betrayalAccumulation: {
          verdict: result.suites.longTermAccumulation.betrayalAccumulation.accumulationVerdict.level,
          stepOneJumpRatio: result.suites.longTermAccumulation.betrayalAccumulation.stepOneJumpRatios.personality,
          saturationScore: result.suites.longTermAccumulation.betrayalAccumulation.saturationScore,
          trustDelta: round4(result.suites.longTermAccumulation.betrayalAccumulation.finalState.coordinate.trust - result.suites.longTermAccumulation.betrayalAccumulation.baselineState.coordinate.trust),
        },
        supportAccumulation: {
          verdict: result.suites.longTermAccumulation.supportAccumulation.accumulationVerdict.level,
          trustRepair: round4(result.suites.longTermAccumulation.supportAccumulation.finalState.coordinate.trust - result.suites.longTermAccumulation.supportAccumulation.baselineState.coordinate.trust),
          repairEffectiveness: result.suites.longTermAccumulation.supportAccumulation.repairEffectivenessScore,
        },
        neutralAccumulation: {
          verdict: result.suites.longTermAccumulation.neutralAccumulation.accumulationVerdict.level,
          finalPersonalityDistance: result.suites.longTermAccumulation.neutralAccumulation.accumulationCurve.personalityDistance[result.suites.longTermAccumulation.neutralAccumulation.accumulationCurve.personalityDistance.length - 1] ?? 0,
        },
      },
      eventTypeCoverage: {
        verdict: result.suites.eventTypeCoverage.coverageVerdict.level,
        summary: result.suites.eventTypeCoverage.coverageSummary,
      },
    },
    topWarnings: result.warnings.slice(0, 10),
    failures: result.failures.slice(0, 10),
    metrics: {
      totalChecks: result.summary.totalChecks,
      passRate: result.summary.totalChecks > 0 ? ((result.summary.passed / result.summary.totalChecks) * 100).toFixed(1) + "%" : "N/A",
    },
  };
}

function buildMarkdownReport(result: CoreRealityGateResult): string {
  const lines: string[] = [];
  lines.push(`# Core Reality Regression Gate — V10.74`);
  lines.push("");
  lines.push(`**Version:** ${result.version}`);
  lines.push(`**Started:** ${result.startedAt}`);
  lines.push(`**Completed:** ${result.completedAt}`);
  lines.push(`**Gate Verdict:** **${result.gateVerdict.level}**`);
  lines.push(`**Required for Release:** ${result.requiredForRelease}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Checks | ${result.summary.totalChecks} |`);
  lines.push(`| Passed | ${result.summary.passed} |`);
  lines.push(`| Warned | ${result.summary.warned} |`);
  lines.push(`| Failed | ${result.summary.failed} |`);
  lines.push(`| Reality Audit | ${result.summary.realityAuditPassed ? "✅" : "❌"} |`);
  lines.push(`| Accumulation | ${result.summary.accumulationPassed ? "✅" : "❌"} |`);
  lines.push(`| Coverage | ${result.summary.coveragePassed ? "✅" : "❌"} |`);
  lines.push(`| Decision Responsive | ${result.summary.decisionResponsivenessPassed ? "✅" : "❌"} |`);
  lines.push(`| Explanation Grounded | ${result.summary.explanationGrounded ? "✅" : "❌"} |`);
  lines.push(`| Support Boundary Safe | ${result.summary.supportBoundarySafe ? "✅" : "❌"} |`);
  lines.push(`| Neutral Stable | ${result.summary.neutralStable ? "✅" : "❌"} |`);
  lines.push("");

  if (result.failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const f of result.failures) {
      lines.push(`- **${f.suite}**${f.caseId ? ` [${f.caseId}]` : ""}: ${f.message}`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of result.warnings.slice(0, 20)) {
      lines.push(`- **${w.suite}**${w.caseId ? ` [${w.caseId}]` : ""}: ${w.message}`);
    }
    lines.push("");
  }

  if (result.gateVerdict.allowedWarnings.length > 0) {
    lines.push("## Allowed Warnings");
    lines.push("");
    for (const aw of result.gateVerdict.allowedWarnings) {
      lines.push(`- ${aw}`);
    }
    lines.push("");
  }

  if (result.gateVerdict.knownLimitations.length > 0) {
    lines.push("## Known Limitations");
    lines.push("");
    for (const kl of result.gateVerdict.knownLimitations) {
      lines.push(`- ${kl}`);
    }
    lines.push("");
  }

  lines.push("## Regression Risks Guarded");
  lines.push("");
  for (const risk of result.regressionRisks) {
    lines.push(`- **${risk.severity.toUpperCase()}** ${risk.description} → guarded by \`${risk.guardedBy}\``);
  }
  lines.push("");

  lines.push("## Reasons");
  lines.push("");
  for (const reason of result.gateVerdict.reasons) {
    lines.push(`- ${reason}`);
  }

  return lines.join("\n");
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

main();
