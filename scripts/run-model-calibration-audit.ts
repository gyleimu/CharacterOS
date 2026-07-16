#!/usr/bin/env npx tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runModelCalibrationAudit,
  type ModelCalibrationAuditResult,
} from "../src/core/audit/modelCalibrationAudit";

const OUTPUT_DIR = resolve("outputs");
const JSON_PATH = resolve(OUTPUT_DIR, "model-calibration-audit.json");
const MARKDOWN_PATH = resolve(OUTPUT_DIR, "model-calibration-audit.md");

function main(): void {
  const result = runModelCalibrationAudit();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(MARKDOWN_PATH, buildMarkdown(result), "utf8");

  console.log(`Model Calibration Audit ${result.version}`);
  console.log(`  Verdict: ${result.gateVerdict.level}`);
  console.log(`  Parameter set: ${result.parameterRegistry.currentVersion}`);
  console.log(`  Trajectories: ${result.summary.passedTrajectories}/${result.summary.trajectoryCount}`);
  console.log(`  Scenario projections: ${result.summary.scenarioProjectionCount}`);
  console.log(`  Relevant response rate: ${(result.summary.relevantScenarioResponseRate * 100).toFixed(1)}%`);
  console.log(`  Category decision coverage: ${result.summary.categoryDecisionCoveragePassed}/${result.categoryDecisionCoverage.length}`);
  console.log(`  Property sequences: ${result.summary.propertySequencesPassed}/${result.propertySequences.length}`);
  console.log(`  Metamorphic: ${result.summary.metamorphicChecksPassed}/${result.metamorphicChecks.length}`);
  console.log(`  Sensitivity: ${result.summary.sensitivityChecksPassed}/${result.sensitivityChecks.length}`);
  console.log(`  Assertions: ${result.summary.passedAssertions}/${result.summary.totalAssertions}`);
  if (result.failures.length > 0) console.log(`  Failures: ${result.failures.join("; ")}`);
  process.exitCode = result.gateVerdict.passed ? 0 : 1;
}

function buildMarkdown(result: ModelCalibrationAuditResult): string {
  const categoryRows = [...new Set(result.goldenTrajectories.map((item) => item.category))].map((category) => {
    const trajectories = result.goldenTrajectories.filter((item) => item.category === category);
    const coverage = result.categoryDecisionCoverage.find((item) => item.category === category);
    const responseRate = coverage?.responseRate === null
      ? "n/a"
      : `${((coverage?.responseRate ?? 0) * 100).toFixed(1)}%`;
    return `| ${category} | ${trajectories.filter((item) => item.passed).length}/${trajectories.length} | ${responseRate} | ${coverage?.maxFiveEventDistributionDistance ?? "n/a"} |`;
  });
  const lines = [
    "# Model Calibration Audit",
    "",
    `**Version:** ${result.version}`,
    `**Verdict:** ${result.gateVerdict.level}`,
    `**Parameter set:** ${result.parameterRegistry.currentVersion}`,
    `**Parameter fingerprint:** ${result.parameterRegistry.currentFingerprint}`,
    "",
    "## Coverage",
    "",
    `- Golden trajectories: ${result.summary.passedTrajectories}/${result.summary.trajectoryCount}`,
    `- Scenario projections: ${result.summary.scenarioProjectionCount}`,
    `- Relevant scenario response rate: ${(result.summary.relevantScenarioResponseRate * 100).toFixed(1)}%`,
    `- Category decision coverage: ${result.summary.categoryDecisionCoveragePassed}/${result.categoryDecisionCoverage.length}`,
    `- Generated property sequences: ${result.summary.propertySequencesPassed}/${result.propertySequences.length}`,
    `- Metamorphic checks: ${result.summary.metamorphicChecksPassed}/${result.metamorphicChecks.length}`,
    `- Sensitivity checks: ${result.summary.sensitivityChecksPassed}/${result.sensitivityChecks.length}`,
    `- Assertions: ${result.summary.passedAssertions}/${result.summary.totalAssertions}`,
    "",
    "| Event category | Passing trajectories | Relevant response | Max 5-event decision distance |",
    "|----------------|----------------------|-------------------|-------------------------------|",
    ...categoryRows,
    "",
    "## Repair Asymmetry",
    "",
    `- Damage: ${result.repairAsymmetry.damage}`,
    `- Repair: ${result.repairAsymmetry.repair}`,
    `- Scar retention ratio: ${result.repairAsymmetry.scarRetentionRatio}`,
    "",
    "## Sensitivity",
    "",
    "| Parameter | Lower metric | Baseline | Upper metric | Verdict |",
    "|-----------|--------------|----------|--------------|---------|",
    ...result.sensitivityChecks.map((item) => (
      `| ${item.parameterPath} | ${item.lowerMetric} | ${item.baselineMetric} | ${item.upperMetric} | ${item.passed ? "PASS" : "FAIL"} |`
    )),
    "",
    "## Known Limitations",
    "",
    ...result.knownLimitations.map((item) => `- ${item}`),
    "",
  ];
  if (result.failures.length > 0) {
    lines.push("## Failures", "", ...result.failures.map((item) => `- ${item}`), "");
  }
  return lines.join("\n");
}

main();
