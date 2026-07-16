import { describe, expect, it } from "vitest";
import {
  runDeterminismBoundaryAudit,
  summarizeDeterminismAudit,
} from "../../../src/core/audit/determinismBoundaryAudit";

describe("V13.5 Determinism Boundary Audit", () => {
  const result = runDeterminismBoundaryAudit();

  // ── Audit structure ──

  it("produces structured audit result", () => {
    expect(result.auditVersion).toBe("13.5.0");
    expect(result.auditedAt).toBeTruthy();
    expect(Array.isArray(result.checkedModules)).toBe(true);
    expect(result.checkedModules.length).toBeGreaterThanOrEqual(6);
    expect(typeof result.passed).toBe("boolean");
    expect(Array.isArray(result.failures)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.allowedRuntimeSources)).toBe(true);
    expect(Array.isArray(result.forbiddenPatternFindings)).toBe(true);
    expect(Array.isArray(result.deterministicReplayResults)).toBe(true);
    expect(typeof result.releaseReady).toBe("boolean");
  });

  // ── V13.5 AST scan metadata ──

  it("has AST scan enabled", () => {
    expect(result.astScanEnabled).toBe(true);
  });

  it("has AST findings count", () => {
    expect(typeof result.astFindingsCount).toBe("number");
    expect(result.astFindingsCount).toBeGreaterThan(0);
  });

  it("has zero sensitive context failures", () => {
    expect(result.sensitiveContextFailures).toBe(0);
  });

  it("has allowlist coverage populated", () => {
    expect(typeof result.allowlistCoverage).toBe("object");
    const totalCovered = Object.values(result.allowlistCoverage).reduce((a, b) => a + b, 0);
    expect(totalCovered).toBeGreaterThan(0);
  });

  it("has AST forbidden findings list", () => {
    expect(Array.isArray(result.astForbiddenFindings)).toBe(true);
  });

  // ── Module coverage ──

  it("checks all required modules", () => {
    const moduleNames = result.checkedModules.map((m) => m.moduleName);
    expect(moduleNames).toContain("explorerDtoBuilders");
    expect(moduleNames).toContain("eventStudioPreview");
    expect(moduleNames).toContain("eventStudioApply");
    expect(moduleNames).toContain("agentDtoBuilders");
    expect(moduleNames).toContain("replyPlanner");
    expect(moduleNames).toContain("writebackPlanner");
    expect(moduleNames).toContain("llmBoundaryInstructions");
  });

  // ── Replay determinism ──

  it("all deterministic replay checks pass", () => {
    const replays = result.deterministicReplayResults;
    expect(replays.length).toBeGreaterThanOrEqual(8);

    for (const r of replays) {
      expect(r.passed, `${r.functionName}: ${r.note}`).toBe(true);
    }
  });

  it("buildEventStudioDraft is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildEventStudioDraft",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
    expect(replay!.identical).toBe(true);
  });

  it("buildEventStudioPreview is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildEventStudioPreview_full",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("applyEventStudioEvent auditId is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "applyEventStudioEvent_auditId",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("buildAgentSessionConfig is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildAgentSessionConfig",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("buildAgentTurnInput is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildAgentTurnInput",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("buildAgentReplyPlan is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildAgentReplyPlan",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("buildLLMBoundaryInstructions is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildLLMBoundaryInstructions",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  it("buildAgentWritebackPlan is deterministic", () => {
    const replay = result.deterministicReplayResults.find(
      (r) => r.functionName === "buildAgentWritebackPlan",
    );
    expect(replay).toBeDefined();
    expect(replay!.passed).toBe(true);
  });

  // ── Static scan ──

  it("has allowed runtime sources classified as allowed", () => {
    expect(result.allowedRuntimeSources.length).toBeGreaterThan(0);
    // All allowed sources must have a justification
    for (const src of result.allowedRuntimeSources) {
      expect(src.justification.length).toBeGreaterThan(10);
    }
  });

  it("forbidden findings list exists (may be zero if already clean)", () => {
    expect(Array.isArray(result.forbiddenPatternFindings)).toBe(true);
    // If there are forbidden findings, each must have a reason
    for (const f of result.forbiddenPatternFindings) {
      expect(f.reason.length).toBeGreaterThan(5);
      expect(f.classification).toBe("failure");
    }
  });

  // ── Allowed runtime patterns ──

  it("Time Machine snapshot capturedAt is allowed", () => {
    const tmFindings = result.allowedRuntimeSources.filter(
      (s) => s.file.includes("timeMachineSnapshot") && s.source.includes("Date"),
    );
    // Time Machine timestamps should be in the allowlist
    const tmForbidden = result.forbiddenPatternFindings.filter(
      (s) => s.file.includes("timeMachineSnapshot"),
    );
    expect(tmForbidden).toHaveLength(0);
  });

  it("gate generatedAt/completedAt is allowed", () => {
    const gateForbidden = result.forbiddenPatternFindings.filter(
      (s) =>
        s.file.includes("unifiedQualityGate") ||
        s.file.includes("releaseCandidateFreezeAudit"),
    );
    // Gate timestamps should not be forbidden
    const gateSpecificFailures = gateForbidden.filter(
      (f) =>
        f.context.includes("generatedAt") ||
        f.context.includes("completedAt") ||
        f.context.includes("auditedAt") ||
        f.context.includes("startedAt"),
    );
    expect(gateSpecificFailures).toHaveLength(0);
  });

  it("audit entry appliedAt in eventStudioApply is allowed", () => {
    const applyForbidden = result.forbiddenPatternFindings.filter(
      (s) => s.file.includes("eventStudioApply") && s.context.includes("appliedAt"),
    );
    expect(applyForbidden).toHaveLength(0);
  });

  it("comment mentions of Date.now / Math.random are ignored", () => {
    // The static scanner skips lines starting with //, /**, *, etc.
    // Verify no findings are from comment-only lines
    for (const f of result.forbiddenPatternFindings) {
      expect(f.context.trim().startsWith("//")).toBe(false);
      expect(f.context.trim().startsWith("/**")).toBe(false);
      expect(f.context.trim().startsWith("*")).toBe(false);
    }
  });

  it("demo files are excluded from failures", () => {
    const demoForbidden = result.forbiddenPatternFindings.filter(
      (s) => s.file.includes("/demo/"),
    );
    expect(demoForbidden).toHaveLength(0);
  });

  it("test files are excluded from failures", () => {
    const testForbidden = result.forbiddenPatternFindings.filter(
      (s) => s.file.includes(".test.") || s.file.includes("tests/"),
    );
    expect(testForbidden).toHaveLength(0);
  });

  // ── Release readiness ──

  it("releaseReady is false if failures present", () => {
    if (result.failures.length > 0) {
      expect(result.releaseReady).toBe(false);
    }
  });

  it("releaseReady is true only if no failures and no warnings", () => {
    if (result.failures.length === 0 && result.warnings.length === 0) {
      expect(result.releaseReady).toBe(true);
    }
  });

  // ── Summary ──

  it("summarizeDeterminismAudit returns summary lines", () => {
    const summary = summarizeDeterminismAudit(result);
    expect(summary.length).toBeGreaterThanOrEqual(5);
    expect(summary.some((s) => s.includes("Determinism Boundary Audit"))).toBe(true);
    expect(summary.some((s) => s.includes("Passed:"))).toBe(true);
  });
});
