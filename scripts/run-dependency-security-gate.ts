#!/usr/bin/env npx tsx
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateDependencySecurityGate,
  type DependencyRiskRegister,
  type NpmAuditReport,
} from "../src/core/audit/dependencySecurityGate";

const OUTPUT_DIR = resolve("outputs");
const REGISTRY_PATH = resolve(OUTPUT_DIR, "dependency-risk-register.json");
const REPORT_JSON = resolve(OUTPUT_DIR, "dependency-security-gate.json");
const REPORT_MARKDOWN = resolve(OUTPUT_DIR, "dependency-security-gate.md");

function main(): void {
  const audit = runNpmAudit();
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as DependencyRiskRegister;
  const result = evaluateDependencySecurityGate(audit, registry);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(REPORT_MARKDOWN, buildMarkdown(result), "utf8");

  console.log(`Dependency Security Gate ${result.version}`);
  console.log(`  Verdict: ${result.gateVerdict.level}`);
  console.log(`  Critical: ${result.liveSummary.critical}`);
  console.log(`  High: ${result.liveSummary.high}`);
  console.log(`  Moderate: ${result.liveSummary.moderate}`);
  console.log(`  Low: ${result.liveSummary.low}`);
  console.log(`  Registered: ${result.registeredFindings.length}/${result.liveSummary.total}`);
  if (result.failures.length > 0) console.log(`  Failures: ${result.failures.join("; ")}`);

  process.exitCode = result.gateVerdict.passed ? 0 : 1;
}

function runNpmAudit(): NpmAuditReport {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("npm_execpath is required to run the dependency security gate");
  const result = spawnSync(process.execPath, [npmCli, "audit", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (!result.stdout.trim()) {
    throw new Error(`npm audit did not return JSON: ${result.stderr.trim()}`);
  }
  const parsed = JSON.parse(result.stdout) as NpmAuditReport & { error?: unknown };
  if (parsed.error || !parsed.vulnerabilities) {
    throw new Error("npm audit returned an error payload instead of a vulnerability report");
  }
  return parsed;
}

function buildMarkdown(result: ReturnType<typeof evaluateDependencySecurityGate>): string {
  const lines = [
    "# Dependency Security Gate",
    "",
    `**Verdict:** ${result.gateVerdict.level}`,
    "",
    "| Severity | Count |",
    "|----------|-------|",
    `| Critical | ${result.liveSummary.critical} |`,
    `| High | ${result.liveSummary.high} |`,
    `| Moderate | ${result.liveSummary.moderate} |`,
    `| Low | ${result.liveSummary.low} |`,
    `| Total | ${result.liveSummary.total} |`,
    "",
    `Registered findings: ${result.registeredFindings.length}/${result.liveSummary.total}`,
    `Registry count matches: ${result.registryCountMatches ? "yes" : "no"}`,
    "",
  ];
  if (result.failures.length > 0) {
    lines.push("## Failures", "", ...result.failures.map((failure) => `- ${failure}`), "");
  }
  if (result.resolvedCandidates.length > 0) {
    lines.push(
      "## Resolution Candidates",
      "",
      ...result.resolvedCandidates.map((risk) => `- ${risk}`),
      "",
    );
  }
  return lines.join("\n");
}

main();
