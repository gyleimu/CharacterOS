#!/usr/bin/env npx tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runTemporalSemanticsAudit,
  type TemporalSemanticsAuditResult,
} from "../src/core/audit/temporalSemanticsAudit";

const OUTPUT_DIR = resolve("outputs");
const JSON_PATH = resolve(OUTPUT_DIR, "temporal-semantics-audit.json");
const MARKDOWN_PATH = resolve(OUTPUT_DIR, "temporal-semantics-audit.md");

function main(): void {
  const result = runTemporalSemanticsAudit();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(MARKDOWN_PATH, buildMarkdown(result), "utf8");

  console.log(`Temporal Semantics Audit ${result.version}`);
  console.log(`  Verdict: ${result.gateVerdict.level}`);
  console.log(`  Cases: ${result.summary.passedCases}/${result.summary.totalCases}`);
  console.log(`  Assertions: ${result.summary.passedAssertions}/${result.summary.totalAssertions}`);
  if (result.failures.length > 0) console.log(`  Failures: ${result.failures.join("; ")}`);
  process.exitCode = result.gateVerdict.passed ? 0 : 1;
}

function buildMarkdown(result: TemporalSemanticsAuditResult): string {
  const lines = [
    "# Temporal Semantics Audit",
    "",
    `**Version:** ${result.version}`,
    `**Verdict:** ${result.gateVerdict.level}`,
    "",
    "| Case | Verdict | Assertions |",
    "|------|---------|------------|",
    ...result.cases.map((item) => (
      `| ${item.id} | ${item.passed ? "PASS" : "FAIL"} | ${item.assertions.filter((assertion) => assertion.passed).length}/${item.assertions.length} |`
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
