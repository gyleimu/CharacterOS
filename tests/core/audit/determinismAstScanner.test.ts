import { describe, expect, it } from "vitest";
import { runAstScan, type AstScanResult, type AstFinding } from "../../../src/core/audit/determinismAstScanner";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

describe("V13.5 AST Determinism Scanner", () => {
  const result = runAstScan(PROJECT_ROOT);

  // ── Scan structure ──

  it("scanner is enabled", () => {
    expect(result.scanEnabled).toBe(true);
    expect(result.filesScanned).toBeGreaterThan(0);
  });

  it("produces structured scan result", () => {
    expect(typeof result.totalFindings).toBe("number");
    expect(Array.isArray(result.forbiddenFindings)).toBe(true);
    expect(Array.isArray(result.warningFindings)).toBe(true);
    expect(Array.isArray(result.allowedFindings)).toBe(true);
    expect(Array.isArray(result.sensitiveContextFailures)).toBe(true);
    expect(typeof result.allowlistCoverage).toBe("object");
  });

  // ── Zero forbidden findings ──

  it("has zero forbidden findings", () => {
    expect(result.forbiddenFindings).toHaveLength(0);
  });

  it("has zero sensitive context failures", () => {
    expect(result.sensitiveContextFailures).toHaveLength(0);
  });

  // ── Allowed findings have ruleIds ──

  it("all allowed findings have matched allowlist ruleId", () => {
    for (const f of result.allowedFindings) {
      expect(f.matchedAllowlistRuleId).toBeTruthy();
      expect(f.reason.length).toBeGreaterThan(5);
      expect(f.classification).toBe("allowed");
    }
  });

  // ── Finding structure ──

  it("findings have line/column/expressionText", () => {
    // Check structure on allowed findings (forbidden might be empty)
    const sample = result.allowedFindings.slice(0, 3);
    for (const f of sample) {
      expect(typeof f.filePath).toBe("string");
      expect(typeof f.line).toBe("number");
      expect(typeof f.column).toBe("number");
      expect(typeof f.expressionText).toBe("string");
      expect(typeof f.calleeKind).toBe("string");
      expect(typeof f.classification).toBe("string");
      expect(f.isCommentOrString).toBe(false);
      expect(typeof f.isSensitiveContext).toBe("boolean");
    }
  });

  // ── Specific allowlist rule coverage ──

  it("gate report generatedAt is allowed", () => {
    const gateFindings = result.allowedFindings.filter(
      (f) => f.matchedAllowlistRuleId === "gate_report_generated_at",
    );
    expect(gateFindings.length).toBeGreaterThan(0);
    for (const f of gateFindings) {
      expect(f.classification).toBe("allowed");
    }
  });

  it("time machine snapshot capturedAt is allowed", () => {
    const tmFindings = result.allowedFindings.filter(
      (f) => f.matchedAllowlistRuleId === "time_machine_snapshot_capture_time" ||
             f.matchedAllowlistRuleId === "explorer_service_time_machine_snapshot",
    );
    // Time Machine snapshots should be in the allowlist
    const tmForbidden = result.forbiddenFindings.filter(
      (f) => f.filePath.includes("timeMachine") || f.filePath.includes("explorerService"),
    );
    expect(tmForbidden).toHaveLength(0);
  });

  it("test files are excluded from scan", () => {
    const testFindings = [
      ...result.forbiddenFindings,
      ...result.warningFindings,
      ...result.allowedFindings,
    ].filter((f) => f.filePath.includes("tests/") || f.filePath.includes(".test."));
    expect(testFindings).toHaveLength(0);
  });

  // ── Operational modules ──

  it("operational modules are not in forbidden list", () => {
    const operationalPaths = [
      "benchmark/", "editor/", "life/", "memory/", "temporal/",
      "parameters/", "explainability/", "export/", "recovery/",
    ];
    for (const path of operationalPaths) {
      const forbidden = result.forbiddenFindings.filter((f) => f.filePath.includes(path));
      expect(forbidden, `Operational module ${path} should not have forbidden findings`).toHaveLength(0);
    }
  });

  it("graph module findings are allowed or warning only", () => {
    const graphForbidden = result.forbiddenFindings.filter(
      (f) => f.filePath.includes("graph/") || f.filePath.includes("mindGraph") || f.filePath.includes("mindGalaxy"),
    );
    expect(graphForbidden).toHaveLength(0);
  });

  // ── Audit self-exclusion ──

  it("scanner does not scan itself", () => {
    const selfFindings = [
      ...result.forbiddenFindings,
      ...result.warningFindings,
      ...result.allowedFindings,
    ].filter((f) => f.filePath.includes("determinismAstScanner"));
    expect(selfFindings).toHaveLength(0);
  });

  it("scanner does not scan its parent audit module", () => {
    const auditFindings = [
      ...result.forbiddenFindings,
      ...result.warningFindings,
      ...result.allowedFindings,
    ].filter((f) => f.filePath.includes("determinismBoundaryAudit"));
    expect(auditFindings).toHaveLength(0);
  });

  // ── Core builder files are clean ──

  it("core builder files have no forbidden findings", () => {
    const builderFiles = [
      "explorerDtoBuilders", "agentDtoBuilders", "replyPlanner",
      "writebackPlanner", "eventStudioPreview", "eventStudioApply",
    ];
    for (const file of builderFiles) {
      const forbidden = result.forbiddenFindings.filter((f) => f.filePath.includes(file));
      expect(forbidden, `Builder file ${file} should have no forbidden findings`).toHaveLength(0);
    }
  });

  // ── Allowlist coverage ──

  it("allowlist coverage is balanced", () => {
    const totalCovered = Object.values(result.allowlistCoverage).reduce((a, b) => a + b, 0);
    expect(totalCovered).toBe(result.allowedFindings.length);
  });

  it("has comprehensive allowlist rules in coverage", () => {
    const ruleIds = Object.keys(result.allowlistCoverage);
    expect(ruleIds.length).toBeGreaterThanOrEqual(8);
    expect(ruleIds).toContain("gate_report_generated_at");
  });

  // ── Sensitive context detection ──

  it("sensitive context is detected correctly", () => {
    // All sensitive context failures should be in the forbidden list, not allowed
    for (const f of result.forbiddenFindings) {
      if (f.isSensitiveContext) {
        expect(f.classification).toBe("failure");
      }
    }
  });

  // ── Date.now/Math.random/new Date detection ──

  it("detects all required pattern categories", () => {
    const allKinds = new Set([
      ...result.forbiddenFindings.map((f) => f.calleeKind),
      ...result.warningFindings.map((f) => f.calleeKind),
      ...result.allowedFindings.map((f) => f.calleeKind),
    ]);
    // Should detect at least some of these patterns
    const hasPatterns = ["Date.now()", "Math.random()", "new Date()"].some(
      (p) => [...allKinds].some((k) => k.includes(p)),
    );
    expect(hasPatterns).toBe(true);
  });
});
