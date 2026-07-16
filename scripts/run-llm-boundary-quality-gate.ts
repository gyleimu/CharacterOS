#!/usr/bin/env npx tsx
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runLlmBoundaryQualityGate,
  type LlmBoundaryQualityGateResult,
} from "../src/core/audit/llmBoundaryQualityGate";

const OUTPUT_DIR = resolve("outputs");
const HARNESS_DIR = resolve(OUTPUT_DIR, "llm-boundary-harness");
const REPORT_JSON = resolve(OUTPUT_DIR, "llm-boundary-quality-gate.json");
const REPORT_MARKDOWN = resolve(OUTPUT_DIR, "llm-boundary-quality-gate.md");
const RC_MANIFEST = resolve(OUTPUT_DIR, "v13-llm-boundary-rc-manifest.json");
const DEPENDENCY_RISK_REGISTER = resolve(OUTPUT_DIR, "dependency-risk-register.json");
const HARNESS_FILES = [
  "index.html",
  "llm-boundary-harness-data.json",
  "manifest.json",
  "README.md",
] as const;

async function main(): Promise<void> {
  const gate = await runLlmBoundaryQualityGate();
  const dependencyRisk = readDependencyRiskRegister();
  const artifactFiles = HARNESS_FILES.map((name) => {
    const path = resolve(HARNESS_DIR, name);
    if (!existsSync(path)) throw new Error(`Missing LLM boundary artifact: ${path}`);
    return {
      path: `outputs/llm-boundary-harness/${name}`,
      sha256: sha256(path),
    };
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(gate, null, 2), "utf8");
  writeFileSync(REPORT_MARKDOWN, buildMarkdown(gate), "utf8");
  writeFileSync(
    RC_MANIFEST,
    JSON.stringify(buildManifest(gate, artifactFiles, dependencyRisk), null, 2),
    "utf8",
  );

  console.log(`LLM Boundary Quality Gate ${gate.version}`);
  console.log(`  Verdict: ${gate.gateVerdict.level}`);
  console.log(`  Cases: ${gate.summary.passed}/${gate.summary.total} passed`);
  console.log(`  Unsafe deliveries: ${gate.summary.unsafeDeliveries}`);
  console.log(`  Replay failures: ${gate.summary.replayFailures}`);
  console.log(`  Mutation failures: ${gate.summary.mutationFailures}`);
  console.log(`  Network violations: ${gate.summary.networkViolations}`);
  console.log(`  RC manifest: ${RC_MANIFEST}`);

  process.exitCode = gate.releaseReady ? 0 : 1;
}

function buildManifest(
  gate: LlmBoundaryQualityGateResult,
  artifactFiles: Array<{ path: string; sha256: string }>,
  dependencyRisk: DependencyRiskRegister,
) {
  return {
    manifestVersion: "1.0.0",
    rcVersion: "V13.9",
    rcVerdict: gate.gateVerdict.level,
    generatedAt: gate.generatedAt,
    releaseReady: gate.releaseReady,
    modules: {
      llmBoundaryDto: { status: "stable", noRawState: true },
      promptBuilder: { status: "stable", redaction: true },
      mockProvider: { status: "stable", networkAllowed: false },
      outputValidator: { status: "stable", failClosed: true },
      groundingChecker: { status: "stable", evidenceRequired: true },
      deterministicFallback: { status: "stable", revalidated: true },
      boundaryService: { status: "stable", noMutation: true },
      staticHarness: { status: "stable", caseCount: 7 },
      qualityGate: { status: "stable", caseCount: gate.summary.total },
    },
    qualityGate: {
      summary: gate.summary,
      verdict: gate.gateVerdict,
      riskCoverage: gate.riskCoverage,
    },
    artifact: {
      path: "outputs/llm-boundary-harness",
      selfContained: true,
      files: artifactFiles,
    },
    dependencySecurity: dependencyRisk.summary,
    safetyBoundaries: {
      mockOnly: true,
      noNetwork: true,
      noRealProvider: true,
      allowLlmDefaultFalse: true,
      noRawState: true,
      noMutation: true,
      noWritebackAuthority: true,
      providerInputFrozen: true,
      diagnosisBlocked: true,
      unsupportedClaimsBlocked: true,
      finalFallbackRevalidated: true,
      simulationNotDiagnosis: true,
    },
    releaseBoundary: {
      singleCharacterOnly: true,
      realProviderDeferred: true,
      temporalSemanticsNext: true,
      multiCharacterProhibited: true,
      v20NotStarted: true,
    },
    knownLimitations: gate.knownLimitations,
    sourceReports: [
      "docs/v13.0_llm_boundary_adapter_design_charter.md",
      "docs/v13.1_llm_boundary_dto_types_report.md",
      "docs/v13.2_llm_boundary_prompt_builder_report.md",
      "docs/v13.7_llm_boundary_integration_qa_report.md",
      "docs/v13.8_mock_provider_harness_report.md",
      "docs/v13.9_llm_boundary_quality_gate_rc_report.md",
      "docs/core_calibration_durability_roadmap.md",
      "docs/dependency_security_policy.md",
    ],
  };
}

function buildMarkdown(gate: LlmBoundaryQualityGateResult): string {
  const lines = [
    "# LLM Boundary Quality Gate",
    "",
    `**Version:** ${gate.version}`,
    `**Verdict:** ${gate.gateVerdict.level}`,
    `**Release Ready:** ${gate.releaseReady ? "Yes" : "No"}`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Cases | ${gate.summary.passed}/${gate.summary.total} |`,
    `| Unsafe deliveries | ${gate.summary.unsafeDeliveries} |`,
    `| Replay failures | ${gate.summary.replayFailures} |`,
    `| Mutation failures | ${gate.summary.mutationFailures} |`,
    `| Network violations | ${gate.summary.networkViolations} |`,
    `| Unique execution IDs | ${gate.summary.uniqueExecutionIds ? "Yes" : "No"} |`,
    "",
    "## Cases",
    "",
    "| Case | Category | Result | Delivery | Replay |",
    "|------|----------|--------|----------|--------|",
    ...gate.cases.map((item) =>
      `| ${item.id} | ${item.category} | ${item.passed ? "PASS" : "FAIL"} | ${item.deliveredSafe ? "safe" : "unsafe"} | ${item.deterministicReplay ? "stable" : "mismatch"} |`
    ),
    "",
    "## Risk Coverage",
    "",
    ...gate.riskCoverage.map((risk) => `- ${risk}`),
    "",
    "## Known Limitations",
    "",
    ...gate.knownLimitations.map((limitation) => `- ${limitation}`),
    "",
  ];
  if (gate.failures.length > 0) {
    lines.push("## Failures", "", ...gate.failures.map((failure) => `- ${failure}`), "");
  }
  return lines.join("\n");
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

interface DependencyRiskRegister {
  readonly summary: {
    readonly critical: number;
    readonly high: number;
    readonly moderate: number;
    readonly low: number;
    readonly total: number;
    readonly releaseBlocking: number;
  };
}

function readDependencyRiskRegister(): DependencyRiskRegister {
  if (!existsSync(DEPENDENCY_RISK_REGISTER)) {
    throw new Error(`Missing dependency risk register: ${DEPENDENCY_RISK_REGISTER}`);
  }
  return JSON.parse(readFileSync(DEPENDENCY_RISK_REGISTER, "utf8")) as DependencyRiskRegister;
}

void main();
