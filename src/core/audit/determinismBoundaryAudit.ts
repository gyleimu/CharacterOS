/**
 * V13.3 — Determinism Boundary Audit
 *
 * Formalizes "core default paths MUST be deterministic" as an auditable layer.
 *
 * Checks:
 *  - Explorer DTO builders
 *  - Event Studio Preview
 *  - Event Studio Apply audit ID
 *  - Agent DTO builders
 *  - Reply Planner
 *  - Agent SDK Service preview-only path
 *  - LLM Boundary builders
 *  - LLM Prompt Builder
 *
 * Outputs structured audit with:
 *  - Static scan of Date.now / Math.random / new Date in core sources
 *  - Replay determinism checks
 *  - Allowlist classification
 *  - Forbidden pattern findings
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildEventStudioDraft } from "../explorer/explorerDtoBuilders";
import { buildCharacterStateSurfaceFromState, buildEventStudioPreview as buildPreviewDto } from "../explorer/explorerDtoBuilders";
import { buildEventStudioPreview } from "../explorer/eventStudioPreview";
import { applyEventStudioEvent } from "../explorer/eventStudioApply";
import { buildAgentSessionConfig } from "../agent/agentDtoBuilders";
import { buildAgentTurnInput } from "../agent/agentDtoBuilders";
import { buildAgentReplyPlan } from "../agent/replyPlanner";
import { buildAgentWritebackPlan } from "../agent/writebackPlanner";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../character/characterBlueprint";
import { buildLLMBoundaryInstructions } from "../agent/replyPlanner";
import { runAstScan, type AstFinding, type AstScanResult } from "./determinismAstScanner";
import type { EventStudioDraft, EventStudioPreview } from "../explorer/explorerTypes";
import type {
  AgentSessionConfig, AgentTurnInput,
  AgentReplyPlan, AgentWritebackPlan, AgentPolicyDecision, AgentGroundingBundle, AgentEventCandidate,
} from "../agent/agentTypes";

// ── Core types ──

export type FindingSeverity = "allowed" | "warning" | "failure";

export interface StaticScanFinding {
  file: string;
  line: number;
  pattern: string;
  context: string;
  classification: FindingSeverity;
  reason: string;
}

export interface DeterminismReplayResult {
  functionName: string;
  passed: boolean;
  run1: string;
  run2: string;
  identical: boolean;
  note: string;
}

export interface AllowedRuntimeSource {
  source: string;
  file: string;
  line: number;
  justification: string;
}

export interface CheckedModule {
  moduleName: string;
  passed: boolean;
  staticFindings: number;
  forbiddenFindings: number;
  replayResults: DeterminismReplayResult[];
}

export interface DeterminismBoundaryAuditResult {
  auditVersion: string;
  auditedAt: string;
  checkedModules: CheckedModule[];
  passed: boolean;
  failures: string[];
  warnings: string[];
  allowedRuntimeSources: AllowedRuntimeSource[];
  forbiddenPatternFindings: StaticScanFinding[];
  deterministicReplayResults: DeterminismReplayResult[];
  releaseReady: boolean;
  /** V13.5: AST-based scan metadata */
  astScanEnabled: boolean;
  astFindingsCount: number;
  sensitiveContextFailures: number;
  allowlistCoverage: Record<string, number>;
  astForbiddenFindings: AstFinding[];
}

// ── Allowlist ──
//
// Patterns classified as "allowed" include:
//   A. Runtime audit/gate/report timestamps
//   B. User-initiated write paths (time machine, apply event)
//   C. Operational modules that record when something actually happened
//      (memory creation, life ticks, benchmark runs, editor patches,
//       parameter adjustments, exports, explanations, persistence)
//   D. Test files, demo files, scripts
//   E. The determinismBoundaryAudit itself (uses Date for auditedAt)
//
// Patterns classified as "failure" are ONLY those where:
//   Date.now() / Math.random() / new Date() is used as a DEFAULT value
//   in a builder function / ID generation / preview path.

const OPERATIONAL_MODULES = [
  "benchmark",
  "editor",
  "explainability",
  "export",
  "life",
  "memory",
  "parameters",
  "temporal",
  "recovery",
];

const ALLOWED_RUNTIME_PATTERNS: Array<{
  filePattern: RegExp;
  linePattern: RegExp;
  justification: string;
}> = [
  {
    // Time Machine snapshot capturedAt — user-initiated history capture
    filePattern: /timeMachineSnapshot\.ts$/,
    linePattern: /capturedAt.*new Date\(\)/,
    justification: "Time Machine snapshot capturedAt uses real time — user actively creates history record",
  },
  {
    // Time Machine service — user-initiated snapshot creation
    filePattern: /explorerService\.ts$/,
    linePattern: /capturedAt.*new Date\(\)/,
    justification: "User-initiated Time Machine snapshot creation from service",
  },
  {
    // Gate/report generatedAt/completedAt — runtime reports
    filePattern: /(unifiedQualityGate|releaseCandidateFreezeAudit|qualityTrendBaseline)\.ts$/,
    linePattern: /(generatedAt|completedAt|auditedAt|startedAt).*new Date\(\)/,
    justification: "Gate/report generatedAt uses real time — this is a runtime report, not core logic",
  },
  {
    // Audit entry appliedAt — runtime audit record
    filePattern: /eventStudioApply\.ts$/,
    linePattern: /appliedAt.*new Date\(\)/,
    justification: "Audit entry appliedAt records actual application time — runtime record",
  },
  {
    // Build-time export scripts — timestamped artifacts
    filePattern: /scripts\/export-/,
    linePattern: /new Date\(\)/,
    justification: "Export scripts produce timestamped artifacts — build tooling, not core logic",
  },
  {
    // Demo files — non-core presentation
    filePattern: /src\/core\/demo\//,
    linePattern: /(Date\.now|Math\.random|new Date)/,
    justification: "Demo files in core/demo are presentation/visualization, not core logic",
  },
  {
    // Old frontend/demo/preview — not core audit scope
    filePattern: /(frontend|preview|components)\//,
    linePattern: /(Date\.now|Math\.random|new Date)/,
    justification: "Frontend and preview components are not core audit scope",
  },
  {
    // DeterminismBoundaryAudit itself — auditedAt and pattern regex definitions
    filePattern: /determinismBoundaryAudit\.ts$/,
    linePattern: /(Date\.now|Math\.random|new Date)/,
    justification: "Determinism audit records its own auditedAt and uses patterns for detection — audit meta",
  },
  {
    // Service-level write paths — operational
    filePattern: /characterPhysicsService\.ts$/,
    linePattern: /(new Date\(\)|Date\.now)/,
    justification: "Service-level operational timestamp — recording when physics operations occur",
  },
  {
    // Character edit patches — idempotent patch IDs
    filePattern: /characterEditPatch\.ts$/,
    linePattern: /(Date\.now\(\)|Math\.random\(\))/,
    justification: "Editor patch IDs for idempotency — not a default builder path",
  },
  {
    // Explanation types — operational timestamps
    filePattern: /explanationTypes\.ts$/,
    linePattern: /(Date\.now\(\)|Math\.random\(\))/,
    justification: "Explanation type factory — operational IDs, not default builder IDs",
  },
  {
    // writeback audit draft — runtime status recording
    filePattern: /writebackPlanner\.ts$/,
    linePattern: /createdAtPolicy.*runtime/,
    justification: "Writeback audit draft has explicit runtime policy flag — intentional runtime classification",
  },
  {
    // CLI scripts reporting — runtime execution tools
    filePattern: /scripts\//,
    linePattern: /(generatedAt|new Date\(\))/,
    justification: "CLI scripts produce runtime reports — not core default paths",
  },
  {
    // Explainability timeline — operational explanation generation timestamps
    filePattern: /explainabilityTimeline\.ts$/,
    linePattern: /new Date\(\)/,
    justification: "Explainability timeline uses timestamps for causal step recording — operational, not default ID",
  },
];

// ── Static scan paths ──

const SCAN_DIRS = [
  "src/core",
  "src/services",
];

const FORBIDDEN_PATTERNS = [
  { regex: /\bDate\.now\b\s*\(\)/g, name: "Date.now()" },
  { regex: /\bMath\.random\b\s*\(\)/g, name: "Math.random()" },
  { regex: /\bnew\s+Date\b\s*\(\)/g, name: "new Date()" },
];

// ── Replay interface ──

interface ReplayInput {
  functionName: string;
  fn: () => unknown;
}

// ── Main audit ──

export function runDeterminismBoundaryAudit(
  projectRoot?: string,
): DeterminismBoundaryAuditResult {
  const root = projectRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const auditedAt = new Date().toISOString();
  const failures: string[] = [];
  const warnings: string[] = [];
  const checkedModules: CheckedModule[] = [];

  // ── 1. AST-based static scan (V13.5) ──
  const astResult = runAstScan(root);
  const astForbiddenFindings = astResult.forbiddenFindings;
  const astWarningFindings = astResult.warningFindings;

  // Build backward-compatible StaticScanFinding list from AST results
  const forbiddenFindings: StaticScanFinding[] = astForbiddenFindings.map((f) => ({
    file: f.filePath,
    line: f.line,
    pattern: f.calleeKind,
    context: `${f.enclosingFunctionName ?? "(top-level)"}: ${f.expressionText}`,
    classification: "failure" as FindingSeverity,
    reason: f.reason,
  }));

  const allAstFindings = [...astForbiddenFindings, ...astWarningFindings, ...astResult.allowedFindings];
  const allowedRuntimes: AllowedRuntimeSource[] = astResult.allowedFindings.map((f) => ({
    source: f.calleeKind,
    file: f.filePath,
    line: f.line,
    justification: f.reason,
  }));

  if (astForbiddenFindings.length > 0) {
    failures.push(
      ...astForbiddenFindings.map((f) => `[determinism] ${f.filePath}:${f.line} — ${f.calleeKind} in ${f.enclosingFunctionName ?? "default path"} (${f.reason})`),
    );
  }
  if (astWarningFindings.length > 0) {
    warnings.push(
      ...astWarningFindings.map((f) => `[determinism] ${f.filePath}:${f.line} — ${f.calleeKind} needs review (${f.reason})`),
    );
  }

  // ── 2. Replay tests ──
  const replays = runAllReplayTests();
  deterministicReplayLoop: for (const r of replays) {
    if (!r.passed) {
      failures.push(`[determinism-replay] ${r.functionName}: ${r.note}`);
    }
  }

  // ── 3. Module checks ──
  const moduleNames = [
    "explorerDtoBuilders",
    "eventStudioPreview",
    "eventStudioApply",
    "agentDtoBuilders",
    "replyPlanner",
    "writebackPlanner",
    "llmBoundaryInstructions",
    "agentSdkService",
  ];

  for (const modName of moduleNames) {
    // Use AST findings for module-level checks
    const allModFindings = [...astForbiddenFindings, ...astWarningFindings, ...astResult.allowedFindings]
      .filter((f) => f.filePath.toLowerCase().includes(modName.toLowerCase()));
    const modStaticFindings = allModFindings;
    const modForbiddenFindings = modStaticFindings.filter((f) => f.classification === "failure");

    const modReplays = replays.filter((r) => {
      const fn = r.functionName.toLowerCase();
      const ml = modName.toLowerCase();
      return fn.includes(ml) || ml.includes(fn) ||
        (modName === "llmBoundaryInstructions" && fn.includes("llm")) ||
        (modName === "agentSdkService" && fn.includes("agent"));
    });
    const modPassed = modForbiddenFindings.length === 0 &&
      modReplays.every((r) => r.passed);

    checkedModules.push({
      moduleName: modName,
      passed: modPassed,
      staticFindings: modStaticFindings.length,
      forbiddenFindings: modForbiddenFindings.length,
      replayResults: modReplays,
    });
  }

  // ── 4. Pass/fail ──
  const passed = failures.length === 0;

  return {
    auditVersion: "13.5.0",
    auditedAt,
    checkedModules,
    passed,
    failures,
    warnings,
    allowedRuntimeSources: allowedRuntimes,
    forbiddenPatternFindings: forbiddenFindings,
    deterministicReplayResults: replays,
    releaseReady: passed && warnings.length === 0,
    astScanEnabled: true,
    astFindingsCount: astResult.totalFindings,
    sensitiveContextFailures: astResult.sensitiveContextFailures.length,
    allowlistCoverage: astResult.allowlistCoverage,
    astForbiddenFindings: astForbiddenFindings,
  };
}

// ── Static Scanner ──

interface RawFinding {
  file: string;
  line: number;
  pattern: string;
  context: string;
}

function scanForbiddenPatterns(root: string): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const scanDir of SCAN_DIRS) {
    const fullPath = resolve(root, scanDir);
    try {
      collectSourceFiles(fullPath).forEach((filePath) => {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (const pattern of FORBIDDEN_PATTERNS) {
          // Reset regex state
          pattern.regex.lastIndex = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            const trimmed = line.trim();

            // Skip comment lines
            if (
              trimmed.startsWith("//") ||
              trimmed.startsWith("*") ||
              trimmed.startsWith("/*") ||
              trimmed.startsWith("/**") ||
              trimmed === "*/" ||
              isInsideBlockComment(lines, i)
            ) {
              continue;
            }

            // Check for the pattern in the non-comment portion
            const codePart = removeInlineComment(trimmed);
            const match = pattern.regex.exec(codePart);
            if (match) {
              findings.push({
                file: relative(root, filePath).replace(/\\/g, "/"),
                line: i + 1,
                pattern: pattern.name,
                context: trimmed.slice(0, 120),
              });
            }
            pattern.regex.lastIndex = 0;
          }
        }
      });
    } catch {
      // Directory may not exist; skip
    }
  }

  return findings;
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
          results.push(...collectSourceFiles(full));
        } else if (st.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
          results.push(full);
        }
      } catch {
        // Permission or missing file — skip
      }
    }
  } catch {
    // Directory missing
  }
  return results;
}

function isInsideBlockComment(lines: string[], currentIndex: number): boolean {
  // Simple heuristic: look backward for unclosed /*
  let inBlock = false;
  for (let i = 0; i <= currentIndex; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("/*") || line.trim().includes("/*")) {
      inBlock = true;
    }
    if (line.trim().includes("*/")) {
      inBlock = false;
    }
  }
  return inBlock;
}

function removeInlineComment(line: string): string {
  // Remove // comments from the line, but preserve strings
  let inString = false;
  let stringChar = "";
  let result = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    const next = line[i + 1];

    if (!inString && ch === "/" && next === "/") {
      break; // rest is comment
    }
    if (!inString && (ch === "'" || ch === '"' || ch === "`")) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar && line[i - 1] !== "\\") {
      inString = false;
      stringChar = "";
    }
    result += ch;
  }

  return result;
}

// ── Classification ──

function classifyFindings(raw: RawFinding[]): StaticScanFinding[] {
  return raw.map((f) => {
    const classification = matchAllowlist(f);
    return {
      ...f,
      classification: classification.severity,
      reason: classification.reason,
    };
  });
}

function matchAllowlist(finding: RawFinding): { severity: FindingSeverity; reason: string } {
  // Check explicit allowlist patterns first
  for (const allow of ALLOWED_RUNTIME_PATTERNS) {
    if (allow.filePattern.test(finding.file) && allow.linePattern.test(finding.context)) {
      return { severity: "allowed", reason: allow.justification };
    }
  }

  // Check if in a test file — always allowed
  if (/tests?\//.test(finding.file) || /\.test\.ts/.test(finding.file) || /\.spec\.ts/.test(finding.file)) {
    return { severity: "allowed", reason: "Test files are exempt from determinism audit scope" };
  }

  // Check if in demo directory
  if (/\/demo\//.test(finding.file)) {
    return { severity: "allowed", reason: "Demo files are presentation files, not core default paths" };
  }

  // Check if in scripts directory
  if (/^scripts\//.test(finding.file)) {
    return { severity: "allowed", reason: "Scripts are runtime execution tools, not core default paths" };
  }

  // Check if it's a timestamp used in an audit entry or reporting context (appliedAt, generatedAt, etc.)
  if (/(appliedAt|generatedAt|completedAt|startedAt|auditedAt|timestamp|exportedAt|recordedAt|snapshottedAt|comparedAt)/.test(finding.context)) {
    return { severity: "allowed", reason: "Audit/report timestamp — runtime operational record, not core default path" };
  }

  // Check if it's in a service-level write path (not default/preview)
  if (/createTimeMachineSnapshot|applyEvent|applyWriteback/.test(finding.context)) {
    return { severity: "allowed", reason: "Write-path timestamp in service — user-initiated action, not default path" };
  }

  // Check if it's in an operational module (benchmark, editor, explainability, export, life, memory, parameters, temporal, recovery)
  for (const mod of OPERATIONAL_MODULES) {
    if (finding.file.includes(`/core/${mod}/`) || finding.file.includes(`/${mod}/`)) {
      // In operational modules, Date usage is for recording operational timestamps (e.g., memory creation time, life tick time, benchmark run time)
      return {
        severity: "allowed",
        reason: `Operational module (${mod}) — timestamps record when operations actually occurred, not default builder IDs`,
      };
    }
  }

  // Default: FAIL — it's in a core path without allowlist match
  return {
    severity: "failure",
    reason: "Unclassified Date.now/Math.random/new Date in core default path — must be allowlisted or made deterministic",
  };
}

function buildAllowedRuntimeList(classified: StaticScanFinding[]): AllowedRuntimeSource[] {
  return classified
    .filter((f) => f.classification === "allowed")
    .map((f) => ({
      source: f.pattern,
      file: f.file,
      line: f.line,
      justification: f.reason,
    }));
}

// ── Replay Tests ──

function runAllReplayTests(): DeterminismReplayResult[] {
  const results: DeterminismReplayResult[] = [];

  // Helper: run a function twice and compare JSON outputs
  const replay = (name: string, fn: () => unknown, note?: string): DeterminismReplayResult => {
    let run1: string, run2: string;
    let identical = false;
    let error: string | null = null;

    try {
      run1 = JSON.stringify(fn());
      run2 = JSON.stringify(fn());
      identical = run1 === run2;
    } catch (e) {
      run1 = "error";
      run2 = "error";
      error = String(e);
    }

    let resultNote = "";
    if (identical) {
      resultNote = note ?? "Deterministic — outputs match";
    } else if (error) {
      resultNote = `Error: ${error}`;
    } else {
      resultNote = note ?? `NON-DETERMINISTIC — outputs differ between runs`;
    }

    return {
      functionName: name,
      passed: identical,
      run1: run1.slice(0, 200),
      run2: run2.slice(0, 200),
      identical,
      note: resultNote,
    };
  };

  // ── Explorer DTO builders ──
  results.push(replay(
    "buildEventStudioDraft",
    () => buildEventStudioDraft({ naturalLanguageInput: "测试事件", sourceId: "test_src", occurredAt: "2026-01-01T00:00:00.000Z" }),
    "Explorer DTO draft deterministic with all fields provided",
  ));

  results.push(replay(
    "buildEventStudioPreview",
    () => buildPreviewDto({
      draftId: "draft_test_001",
      parsed: { category: "support", emotion: "relief", intensity: 0.6, importance: 0.7, parserConfidence: 0.9 },
      impact: { expectedMemoryImpact: "moderate", expectedBoundaryImpact: "low", expectedBeliefImpact: "moderate", expectedPersonalityImpact: "subtle" },
      memory: { willCreateMemory: true, estimatedSalience: "moderate", relatedExistingMemories: 2 },
      belief: { likelyNewBelief: null, likelyStrengthenedBeliefs: [], likelyWeakenedBeliefs: [] },
      need: { likelyActivatedNeeds: [], likelyDeactivatedNeeds: [] },
      personality: { direction: "trust increasing", affectedDimensions: ["trust"], estimatedMagnitude: "subtle" },
      decision: { likelyStrategyShift: "stable", likelyActionChange: "none" },
      auditWarnings: [],
    }),
    "Explorer preview DTO deterministic",
  ));

  // ── Event Studio Preview ──
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const draft: EventStudioDraft = {
    naturalLanguageInput: "王雪发了一条关心的消息。",
    occurredAt: "2026-01-01T00:00:00.000Z",
    location: "家",
    people: ["王雪"],
    intensity: 0.4,
    repetitionCount: 1,
    sourceType: "user_input",
    sourceId: "test_event_001",
    tags: ["关心", "支持"],
    status: "draft",
  };

  const followUpScenario = {
    id: "test_scenario",
    name: "测试场景",
    trigger: "对方发来关心消息",
    stressor: "一般互动",
    testFocus: "信任 安全感",
  };

  results.push(replay(
    "buildEventStudioPreview_full",
    () => {
      const preview = buildEventStudioPreview({
        draft,
        baselineState: state,
        followUpScenario,
        previewMode: "full_preview",
      });
      // Only compare deterministic fields (exclude audit warnings that may depend on state)
      return {
        draftId: preview.draftId,
        parsedEvent: preview.parsedEvent,
        impactPreview: preview.impactPreview,
        memoryPreview: preview.memoryPreview,
        requiresConfirmation: preview.requiresConfirmation,
      };
    },
    "Event Studio full preview deterministic with same state + draft",
  ));

  // ── Event Studio Apply auditId ──
  results.push(replay(
    "applyEventStudioEvent_auditId",
    () => {
      const preview = buildEventStudioPreview({
        draft,
        baselineState: state,
        followUpScenario,
        previewMode: "full_preview",
      });
      // Only call apply with auditSeed to force deterministic auditId
      const result = applyEventStudioEvent({
        baselineState: state,
        draft: { ...draft, status: "previewed" },
        preview,
        confirmation: "apply",
        applyReason: "测试应用",
        actorId: "test_user",
        options: { auditSeed: "deterministic_seed_001", overrideAuditFail: true },
      });
      return result.auditEntry?.auditId ?? null;
    },
    "Event Studio apply auditId deterministic with auditSeed",
  ));

  // ── Agent DTO builders ──
  results.push(replay(
    "buildAgentSessionConfig",
    () => buildAgentSessionConfig({
      sessionId: "test_session_001",
      characterId: "lin_fan",
      inputMode: "chat",
      writebackPolicy: "preview_only",
    }),
    "Agent session config deterministic with explicit sessionId",
  ));

  results.push(replay(
    "buildAgentTurnInput",
    () => buildAgentTurnInput({
      turnId: "test_turn_001",
      sessionId: "test_session_001",
      content: "你好",
      occurredAt: "2026-01-01T00:00:00.000Z",
    }),
    "Agent turn input deterministic with explicit IDs",
  ));

  // ── Reply Planner ──
  const mockSession: AgentSessionConfig = {
    sessionId: "test_session_001",
    characterId: "lin_fan",
    inputMode: "chat",
    writebackPolicy: "preview_only",
    safetyMode: "strict",
    llmMode: "disabled",
    createdAtPolicy: "deterministic_timestamp",
    readOnlyDefault: true,
    noMultiCharacter: true,
    noDiagnosis: true,
  };

  const mockPolicy: AgentPolicyDecision = {
    decision: "preview_only",
    reasons: ["test"],
    warnings: [],
    writebackAllowed: false,
    safetyLevel: "safe",
    auditRequired: true,
  };

  const mockBundle: AgentGroundingBundle = {
    characterStateSurface: buildCharacterStateSurfaceFromState(state),
    timeMachineRefs: [],
    evidenceRefs: [],
    omittedRawState: true,
  };

  results.push(replay(
    "buildAgentReplyPlan",
    () => buildAgentReplyPlan({
      session: mockSession,
      policy: mockPolicy,
      bundle: mockBundle,
    }),
    "Reply plan must be deterministic",
  ));

  // ── LLM Boundary Instructions ──
  results.push(replay(
    "buildLLMBoundaryInstructions",
    () => buildLLMBoundaryInstructions(),
    "LLM boundary instructions are static text",
  ));

  // ── Writeback Plan (deterministic path) ──
  const mockTurn: AgentTurnInput = {
    turnId: "test_turn_001",
    sessionId: "test_session_001",
    inputMode: "chat",
    content: "你好",
    occurredAt: "2026-01-01T00:00:00.000Z",
    speakerLabel: "user",
    sourceRef: "",
    metadata: {},
    consentForWriteback: false,
  };

  const mockCandidates: AgentEventCandidate[] = [];

  results.push(replay(
    "buildAgentWritebackPlan",
    () => buildAgentWritebackPlan({
      session: mockSession,
      turn: mockTurn,
      candidates: mockCandidates,
      policy: mockPolicy,
    }),
    "Writeback plan deterministic with turn ID-based writebackId",
  ));

  // ── Event Studio Preview ID stability without sourceId ──
  results.push(replay(
    "eventStudioPreview_draftId_without_sourceId",
    () => {
      const draftWithoutSource: EventStudioDraft = {
        ...draft,
        sourceId: "",
      };
      const preview = buildEventStudioPreview({
        draft: draftWithoutSource,
        baselineState: state,
        previewMode: "parse_only",
      });
      return { draftId: preview.draftId };
    },
    "Preview draftId stable without sourceId",
  ));

  return results;
}

// ── Summary ──

export function summarizeDeterminismAudit(
  result: DeterminismBoundaryAuditResult,
): string[] {
  return [
    `Determinism Boundary Audit v${result.auditVersion}`,
    `Passed: ${result.passed ? "✅ YES" : "❌ NO"}`,
    `Release Ready: ${result.releaseReady ? "✅ YES" : "❌ NO"}`,
    `Modules checked: ${result.checkedModules.length}`,
    `Modules passed: ${result.checkedModules.filter((m) => m.passed).length}`,
    `Static scan findings: ${result.forbiddenPatternFindings.length} forbidden, ${result.warnings.length} warnings`,
    `Allowed runtime sources: ${result.allowedRuntimeSources.length}`,
    `Replay tests: ${result.deterministicReplayResults.filter((r) => r.passed).length}/${result.deterministicReplayResults.length} passed`,
    ...(result.failures.length > 0
      ? [`Failures:\n  ${result.failures.join("\n  ")}`]
      : []),
    ...(result.warnings.length > 0
      ? [`Warnings:\n  ${result.warnings.join("\n  ")}`]
      : []),
  ];
}
