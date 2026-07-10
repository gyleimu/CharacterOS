/**
 * V13.5 — AST-based Determinism Scanner
 *
 * Replaces regex/path-based static scanning with TypeScript AST traversal.
 * Properly distinguishes:
 *   - Code vs comments (AST naturally excludes comments)
 *   - Code vs string literals (AST distinguishes StringLiteral from CallExpression)
 *   - Sensitive contexts (builder functions, preview paths) vs operational code
 *   - Allowlisted patterns vs genuinely forbidden non-determinism
 *
 * Uses only the TypeScript compiler API (already a devDependency).
 */

import * as ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

// ── Types ──

export type AstClassification = "allowed" | "warning" | "failure";

export interface AstFinding {
  filePath: string;
  line: number;
  column: number;
  expressionText: string;
  calleeKind: string;
  enclosingFunctionName: string | null;
  enclosingExportName: string | null;
  classification: AstClassification;
  reason: string;
  matchedAllowlistRuleId: string | null;
  isCommentOrString: false;
  isSensitiveContext: boolean;
}

export interface AllowlistRule {
  ruleId: string;
  pathPattern: RegExp;
  allowedExpressions: string[];
  whyAllowed: string;
  /** What classification to use even when matched (default "allowed") */
  maxSeverityIfMatched: AstClassification;
  /** If true, only match if in NON-sensitive context */
  nonSensitiveOnly: boolean;
}

export interface AstScanResult {
  scanEnabled: true;
  filesScanned: number;
  totalFindings: number;
  forbiddenFindings: AstFinding[];
  warningFindings: AstFinding[];
  allowedFindings: AstFinding[];
  sensitiveContextFailures: AstFinding[];
  allowlistCoverage: Record<string, number>;
}

// ── Constants ──

const SCAN_DIRS = ["src/core", "src/services"];

/** Expression patterns that indicate non-determinism */
const RUNTIME_CALLS: Array<{
  kind: string;
  /** Returns true if the call expression text matches this pattern */
  match: (text: string) => boolean;
}> = [
  { kind: "Date.now()", match: (t) => /\bDate\.now\s*\(\)/.test(t) },
  { kind: "Math.random()", match: (t) => /\bMath\.random\s*\(\)/.test(t) },
  { kind: "new Date()", match: (t) => /\bnew\s+Date\s*\(\s*\)/.test(t) },
  { kind: "crypto.randomUUID()", match: (t) => /\bcrypto\.randomUUID\s*\(\)/.test(t) },
  { kind: "performance.now()", match: (t) => /\bperformance\.now\s*\(\)/.test(t) },
];

/** Function name patterns that indicate sensitive (default/builder) context */
const SENSITIVE_FUNCTION_PATTERNS = [
  /^build/i,
  /^create/i,
  /^plan/i,
  /^preview/i,
  /^apply/i,
  /Id$/,
  /[Bb]uilder/,
  /^generate/i,
  /^make/i,
];

/** File path patterns for DTO/planner/preview modules — the core sensitive modules */
const SENSITIVE_FILE_PATTERNS = [
  /dtoBuilder/i,
  /replyPlanner/i,
  /writebackPlanner/i,
  /eventStudio/i,
  /agentSdk/i,
  /llmBoundary/i,
  /promptBuilder/i,
];

/** Operational modules where create/build/preview functions are NOT sensitive (they record operational data) */
const OPERATIONAL_MODULE_PATTERNS = [
  /\/memory\//,
  /\/life\//,
  /\/temporal\//,
  /\/parameters?\//,
  /\/editor\//,
  /\/export\//,
  /\/graph\//,
  /\/explainability\//,
  /\/benchmark\//,
  /\/explorer\/explainability/,
  /\/explorer\/timeMachine/,
  /characterPhysicsService/,
  /\/services\/explorerService/,
  /characterImportTransition/,
  /mindGalaxyView/,
  /mindGraphBuil/,
  /mindGraphLay/,
  /explanationTypes/,
  /lifeTick/,
  /determinismAstScanner/,  // Self-scan exclusion
  /mindGalaxyViewTypes/,
  /mindGraphBuilder/,
  /mindGraphLayout/,
  /\/graph\//,
];

// ── Allowlist Rules (V13.5 hardened) ──

const ALLOWLIST_RULES: AllowlistRule[] = [
  {
    ruleId: "time_machine_snapshot_capture_time",
    pathPattern: /timeMachine|timeMachineSnapshot/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Time Machine snapshot capturedAt — user-initiated history record",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "gate_report_generated_at",
    pathPattern: /(unifiedQualityGate|releaseCandidateFreezeAudit|qualityTrendBaseline|coreRealityRegressionGate)\.ts$/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Gate/report generatedAt/completedAt uses real time — runtime report",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "quality_trend_report_time",
    pathPattern: /qualityTrend/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Quality trend comparedAt uses real time — operational timestamp",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "determinism_audit_meta",
    pathPattern: /determinismBoundaryAudit\.ts$/,
    allowedExpressions: ["Date.now()", "Math.random()", "new Date()", "performance.now()"],
    whyAllowed: "Determinism audit records its own auditedAt + uses patterns for regex detection",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "event_studio_apply_applied_at",
    pathPattern: /eventStudioApply\.ts$/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Audit entry appliedAt records actual application time — runtime record (explicitly allowed by V13.3 policy)",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: false, // This is a documented exception even in sensitive contexts
  },
  {
    ruleId: "repository_temp_file_uniqueness",
    pathPattern: /(export|import|persistence|repository)/i,
    allowedExpressions: ["Date.now()", "Math.random()", "crypto.randomUUID()"],
    whyAllowed: "File system temp path or export file uniqueness — not a core default ID",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_benchmark_timestamps",
    pathPattern: /benchmark/,
    allowedExpressions: ["Date.now()"],
    whyAllowed: "Benchmark execution records when tests ran — operational, not default ID",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_editor_patch_id",
    pathPattern: /editor\/characterEditPatch/,
    allowedExpressions: ["Date.now()", "Math.random()"],
    whyAllowed: "Editor patch IDs for idempotent operations — not in default path builders",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_life_tick_timestamps",
    pathPattern: /life\//,
    allowedExpressions: ["Date.now()", "new Date()"],
    whyAllowed: "Life tick persistence records actual tick time — operational",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_memory_timestamps",
    pathPattern: /memory/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Memory creation records when memory was formed — operational",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_parameter_history",
    pathPattern: /parameters?\/parameter/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Parameter adjustment history records actual adjustment time — operational",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_temporal_internal_state",
    pathPattern: /temporal/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Internal state field records temporal snapshots — operational",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "operational_explainability_timestamps",
    pathPattern: /explainability/,
    allowedExpressions: ["Date.now()", "Math.random()", "new Date()"],
    whyAllowed: "Explainability modules record explanation generation time — operational",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "service_write_path_timestamp",
    pathPattern: /characterPhysicsService\.ts$/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Service-level operational timestamp — recording physics operations",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "frontend_animation_runtime",
    pathPattern: /(frontend|demo|canvas|animation|preview|component)/i,
    allowedExpressions: ["Date.now()", "Math.random()", "new Date()", "performance.now()", "crypto.randomUUID()"],
    whyAllowed: "Frontend/demo/canvas animation uses runtime randomness for visual effects — not core logic",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "test_fixture_runtime_only",
    pathPattern: /tests?\//,
    allowedExpressions: ["Date.now()", "Math.random()", "new Date()", "performance.now()", "crypto.randomUUID()"],
    whyAllowed: "Test fixtures may use runtime values for mock data — not production code",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "graph_view_snapshot_timestamp",
    pathPattern: /(mindGalaxyViewTypes|mindGraphBuilder|mindGraphLayout|graph)/i,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Graph snapshot timestamps for view rendering — visualization operational, not default builder ID",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "editor_patch_runtime_id",
    pathPattern: /characterEditPatch\.ts$/,
    allowedExpressions: ["Date.now()", "Math.random()", "new Date()"],
    whyAllowed: "Editor patch IDs for idempotent edit operations — operational, not core default path",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "explorer_service_time_machine_snapshot",
    pathPattern: /explorerService\.ts$/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Explorer service createTimeMachineSnapshot uses real time — user-initiated history record",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "benchmark_dto_report_timestamp",
    pathPattern: /benchmarkDto\.ts$/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Benchmark DTO report timestamp — runtime benchmark reporting, not default builder ID",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
  {
    ruleId: "export_import_transition_history_timestamp",
    pathPattern: /characterImportTransition/,
    allowedExpressions: ["new Date()"],
    whyAllowed: "Import transition history records actual import time — operational export/import",
    maxSeverityIfMatched: "allowed",
    nonSensitiveOnly: true,
  },
];

// ── Main Scanner ──

export function runAstScan(projectRoot: string): AstScanResult {
  const findings: AstFinding[] = [];
  const filesScanned: string[] = [];

  for (const scanDir of SCAN_DIRS) {
    const fullPath = resolve(projectRoot, scanDir);
    try {
      for (const filePath of collectSourceFiles(fullPath)) {
        filesScanned.push(filePath);
        const fileFindings = scanFile(filePath, projectRoot);
        findings.push(...fileFindings);
      }
    } catch {
      // Directory not found — skip
    }
  }

  // Classify findings
  for (const f of findings) {
    classifyAstFinding(f);
  }

  const forbiddenFindings = findings.filter((f) => f.classification === "failure");
  const warningFindings = findings.filter((f) => f.classification === "warning");
  const allowedFindings = findings.filter((f) => f.classification === "allowed");
  const sensitiveContextFailures = forbiddenFindings.filter((f) => f.isSensitiveContext);

  // Build allowlist coverage
  const allowlistCoverage: Record<string, number> = {};
  for (const f of allowedFindings) {
    const key = f.matchedAllowlistRuleId ?? "unclassified_allowed";
    allowlistCoverage[key] = (allowlistCoverage[key] ?? 0) + 1;
  }

  return {
    scanEnabled: true,
    filesScanned: filesScanned.length,
    totalFindings: findings.length,
    forbiddenFindings,
    warningFindings,
    allowedFindings,
    sensitiveContextFailures,
    allowlistCoverage,
  };
}

// ── File Scanner ──

function scanFile(filePath: string, projectRoot: string): AstFinding[] {
  const findings: AstFinding[] = [];
  const relativePath = relative(projectRoot, filePath).replace(/\\/g, "/");

  // Skip non-core files
  if (!shouldScanFile(relativePath)) return findings;

  let sourceText: string;
  try {
    sourceText = readFileSync(filePath, "utf-8");
  } catch {
    return findings;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  // Walk the AST
  visitNode(sourceFile);

  function visitNode(node: ts.Node): void {
    // Check CallExpression
    if (ts.isCallExpression(node)) {
      const exprText = node.getText(sourceFile);
      for (const pattern of RUNTIME_CALLS) {
        if (pattern.match(exprText)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const ctx = getContext(node, sourceFile);

          findings.push({
            filePath: relativePath,
            line: line + 1,
            column: character + 1,
            expressionText: exprText,
            calleeKind: pattern.kind,
            enclosingFunctionName: ctx.enclosingFunction,
            enclosingExportName: ctx.exportName,
            classification: "failure", // default, will be classified
            reason: "",
            matchedAllowlistRuleId: null,
            isCommentOrString: false,
            isSensitiveContext: ctx.isSensitive,
          });
          break;
        }
      }
    }

    // Check NewExpression (new Date())
    if (ts.isNewExpression(node)) {
      const exprText = node.getText(sourceFile);
      if (/\bnew\s+Date\s*\(\s*\)/.test(exprText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const ctx = getContext(node, sourceFile);

        findings.push({
          filePath: relativePath,
          line: line + 1,
          column: character + 1,
          expressionText: exprText,
          calleeKind: "new Date()",
          enclosingFunctionName: ctx.enclosingFunction,
          enclosingExportName: ctx.exportName,
          classification: "failure",
          reason: "",
          matchedAllowlistRuleId: null,
          isCommentOrString: false,
          isSensitiveContext: ctx.isSensitive,
        });
      }
    }

    // Check for string concatenation patterns that build IDs from runtime values
    // e.g., `draft_${Date.now()}` or `"audit_" + Date.now()`
    if (ts.isTemplateExpression(node) || ts.isBinaryExpression(node)) {
      const exprText = node.getText(sourceFile);
      // Template expressions with runtime calls inside
      if (/`.*\$\{.*(?:Date\.now|Math\.random|crypto\.randomUUID|performance\.now).*\}.*`/.test(exprText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const ctx = getContext(node, sourceFile);

        // Determine which runtime call is embedded
        let calleeKind = "runtime expression in template";
        if (/Date\.now/.test(exprText)) calleeKind = "Date.now() in template";
        if (/Math\.random/.test(exprText)) calleeKind = "Math.random() in template";
        if (/crypto\.randomUUID/.test(exprText)) calleeKind = "crypto.randomUUID() in template";
        if (/performance\.now/.test(exprText)) calleeKind = "performance.now() in template";

        findings.push({
          filePath: relativePath,
          line: line + 1,
          column: character + 1,
          expressionText: exprText.slice(0, 120),
          calleeKind,
          enclosingFunctionName: ctx.enclosingFunction,
          enclosingExportName: ctx.exportName,
          classification: "failure",
          reason: "",
          matchedAllowlistRuleId: null,
          isCommentOrString: false,
          isSensitiveContext: ctx.isSensitive,
        });
      }
    }

    // Check for "+" binary expressions combining runtime calls with string prefixes (ID generation)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const exprText = node.getText(sourceFile);
      if (/\b(Date\.now|Math\.random|crypto\.randomUUID|performance\.now)\b\s*\(\)/.test(exprText) &&
          /["'`]/.test(exprText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const ctx = getContext(node, sourceFile);

        let calleeKind = "runtime+string concat";
        if (/Date\.now/.test(exprText)) calleeKind = "Date.now() + string";
        if (/Math\.random/.test(exprText)) calleeKind = "Math.random() + string";

        findings.push({
          filePath: relativePath,
          line: line + 1,
          column: character + 1,
          expressionText: exprText.slice(0, 120),
          calleeKind,
          enclosingFunctionName: ctx.enclosingFunction,
          enclosingExportName: ctx.exportName,
          classification: "failure",
          reason: "",
          matchedAllowlistRuleId: null,
          isCommentOrString: false,
          isSensitiveContext: ctx.isSensitive,
        });
      }
    }

    // Recurse
    ts.forEachChild(node, visitNode);
  }

  return findings;
}

// ── Context Analysis ──

interface NodeContext {
  enclosingFunction: string | null;
  exportName: string | null;
  isSensitive: boolean;
}

function getContext(node: ts.Node, sourceFile: ts.SourceFile): NodeContext {
  let enclosingFunction: string | null = null;
  let exportName: string | null = null;
  let isSensitive = false;

  // Walk up to find enclosing function declaration
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      enclosingFunction = current.name.getText(sourceFile);
      // Check if this function is exported
      if (current.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        exportName = enclosingFunction;
      }
      // Check if function name matches sensitive patterns
      if (!isSensitive) {
        isSensitive = isSensitiveFunction(enclosingFunction);
      }
    }

    if (ts.isMethodDeclaration(current) && current.name) {
      enclosingFunction = current.name.getText(sourceFile);
      // Check parent class for export
      let classNode: ts.Node | undefined = current.parent;
      while (classNode) {
        if (ts.isClassDeclaration(classNode)) {
          if (classNode.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
            exportName = `${classNode.name?.getText(sourceFile) ?? "anonymous"}.${enclosingFunction}`;
          }
          break;
        }
        if (ts.isObjectLiteralExpression(classNode)) break;
        classNode = classNode.parent;
      }
      if (!isSensitive) {
        isSensitive = isSensitiveFunction(enclosingFunction);
      }
    }

    if (ts.isArrowFunction(current)) {
      // Try to get variable name for arrow function
      const parent = current.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        enclosingFunction = parent.name.getText(sourceFile);
        if (!isSensitive) {
          isSensitive = isSensitiveFunction(enclosingFunction);
        }
      }
    }

    // Check for export at module level
    if (ts.isVariableStatement(current)) {
      if (current.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const decls = current.declarationList.declarations;
        if (decls.length === 1 && decls[0]!.name && ts.isIdentifier(decls[0]!.name)) {
          exportName = exportName ?? decls[0]!.name.getText(sourceFile);
        }
      }
    }

    current = current.parent;
  }

  // Check file path for sensitive module pattern
  if (!isSensitive) {
    const fileName = sourceFile.fileName;
    isSensitive = SENSITIVE_FILE_PATTERNS.some((p) => p.test(fileName));
  }

  // Operational modules are NOT sensitive contexts even if function name matches create*/build*
  // (e.g., createMemoryNode is operational, not a default-path builder)
  if (isSensitive) {
    const fileName = sourceFile.fileName;
    if (OPERATIONAL_MODULE_PATTERNS.some((p) => p.test(fileName))) {
      isSensitive = false;
    }
  }

  return { enclosingFunction, exportName, isSensitive };
}

function isSensitiveFunction(name: string | null): boolean {
  if (!name) return false;
  return SENSITIVE_FUNCTION_PATTERNS.some((p) => p.test(name));
}

// ── Classification ──

/** Normalize template/concat variant calleeKind to base pattern for allowlist matching */
function normalizeCalleeKind(kind: string): string {
  if (kind.includes(" in template")) return kind.replace(" in template", "");
  if (kind.includes(" + string")) return kind.replace(" + string", "");
  if (kind.startsWith("runtime")) {
    if (/Date\.now/.test(kind)) return "Date.now()";
    if (/Math\.random/.test(kind)) return "Math.random()";
    if (/crypto\.randomUUID/.test(kind)) return "crypto.randomUUID()";
    if (/performance\.now/.test(kind)) return "performance.now()";
  }
  return kind;
}

function classifyAstFinding(finding: AstFinding): void {
  // Normalize calleeKind for template/concat variants when matching allowlist
  const normalizedKind = normalizeCalleeKind(finding.calleeKind);

  // Try each allowlist rule
  for (const rule of ALLOWLIST_RULES) {
    if (!rule.pathPattern.test(finding.filePath)) continue;
    if (!rule.allowedExpressions.some((expr) => expr === finding.calleeKind || expr === normalizedKind)) continue;

    // Check sensitive context restriction
    if (rule.nonSensitiveOnly && finding.isSensitiveContext) {
      // Allowlist rule doesn't apply in sensitive context — keep as failure
      continue;
    }

    finding.classification = rule.maxSeverityIfMatched;
    finding.reason = rule.whyAllowed;
    finding.matchedAllowlistRuleId = rule.ruleId;
    return;
  }

  // If we're in a sensitive context and no allowlist matched → failure
  if (finding.isSensitiveContext) {
    finding.classification = "failure";
    finding.reason = `Sensitive context: ${finding.enclosingFunctionName ?? "exported function"} uses ${finding.calleeKind} in default path — must be deterministic`;
    return;
  }

  // If it's an operational module file (non-sensitive) with no allowlist match → warning
  const isOperationalFile = /(benchmark|editor|explainability|export|life|memory|parameters?|temporal|recovery|llm|provider|db)/i.test(finding.filePath);
  if (isOperationalFile) {
    finding.classification = "warning";
    finding.reason = `Unclassified ${finding.calleeKind} in operational module — review and add to allowlist or make deterministic`;
    return;
  }

  // Default: failure for anything unclassified
  finding.classification = "failure";
  finding.reason = `Unclassified ${finding.calleeKind} in core path — must be allowlisted or made deterministic`;
}

// ── File Collection ──

function shouldScanFile(relativePath: string): boolean {
  // Only scan .ts/.tsx files in SCAN_DIRS
  if (!/^src\/(core|services)\//.test(relativePath)) return false;
  if (!/\.(ts|tsx)$/.test(relativePath)) return false;

  // Skip test files (handled by test scanner)
  if (/\.test\./.test(relativePath) || /\.spec\./.test(relativePath)) return false;

  // Skip declaration files
  if (/\.d\.ts$/.test(relativePath)) return false;

  // Skip the AST scanner itself (self-scan)
  if (/determinismAstScanner\.ts$/.test(relativePath)) return false;

  // Skip the audit parent module (uses Date for auditedAt — explicitly allowed)
  if (/determinismBoundaryAudit\.ts$/.test(relativePath)) return false;

  return true;
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
        } else if (st.isFile() && /\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
          results.push(full);
        }
      } catch {
        // skip
      }
    }
  } catch {
    // directory missing
  }
  return results;
}
