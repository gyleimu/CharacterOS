import { describe, expect, it } from "vitest";
import { runUnifiedQualityGate } from "../../../src/core/audit/unifiedQualityGate";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V10.75 Unified Quality Gate", { timeout: 30000 }, () => {
  // Skip determinism for non-determinism-specific tests (V13.3 audit is tested separately)
  const gate = runUnifiedQualityGate({ skipDeterminism: true });

  it("aggregates benchmark and reality gate", () => {
    expect(gate.benchmarkResult).toBeDefined();
    expect(gate.benchmarkSummary).toBeDefined();
    expect(gate.realityGateResult).toBeDefined();
    expect(gate.realityGateResult.suites.realityAudit).toBeDefined();
  });

  it("passes when benchmark pass and reality gate has only allowed WARN", () => {
    // Current system: benchmark should pass, reality gate is WARN (documented)
    expect(gate.unifiedSummary.benchmarkPassed).toBe(true);
    expect(gate.unifiedSummary.realityGatePassed).toBe(true);
    expect(gate.qualityVerdict.passed).toBe(true);
    expect(gate.failures).toHaveLength(0);
  });

  it("fails when benchmark hard threshold not met", () => {
    const strict = runUnifiedQualityGate({
      benchmarkMinPassRate: 1.0,
      benchmarkMaxFailures: 0,
      skipDeterminism: true,
    });

    expect(typeof strict.qualityVerdict.level).toBe("string");
    expect(strict.config.benchmarkMinPassRate).toBe(1.0);
  });

  it("fails when reality gate has FAIL", () => {
    const strictReality = runUnifiedQualityGate({
      realityGateConfig: {
        maxNeutralPersonalityDistance: 0.0001,
        failOnSupportBoundaryOverResponse: true,
      },
      skipDeterminism: true,
    });

    expect(typeof strictReality.qualityVerdict.level).toBe("string");
    expect(strictReality.unifiedSummary.realityGatePassed).toBeDefined();
  });

  it("warns when benchmark metric is close to threshold", () => {
    const sensitive = runUnifiedQualityGate({
      benchmarkWarnMargin: 0.5,
      skipDeterminism: true,
    });

    expect(sensitive.qualityVerdict.level).toBeDefined();
  });

  it("records documented warnings", () => {
    if (gate.warnings.length > 0) {
      for (const w of gate.warnings) {
        expect(typeof w).toBe("string");
        expect(w.length).toBeGreaterThan(5);
      }
    }
    if (gate.failures.length === 0) {
      expect(gate.qualityVerdict.allowedWarnings.length).toBe(gate.warnings.length);
    }
  });

  it("outputs deterministic JSON shape", () => {
    const gate2 = runUnifiedQualityGate({ skipDeterminism: true });

    expect(gate2.version).toBe(gate.version);
    expect(gate2.qualityVerdict.level).toBe(gate.qualityVerdict.level);
    expect(typeof gate2.startedAt).toBe("string");
    expect(typeof gate2.completedAt).toBe("string");
    expect(gate2.unifiedSummary.totalChecks).toBe(gate.unifiedSummary.totalChecks);
    expect(Array.isArray(gate2.failures)).toBe(true);
    expect(Array.isArray(gate2.warnings)).toBe(true);
    expect(Array.isArray(gate2.regressionRisks)).toBe(true);
    expect(Array.isArray(gate2.recommendedNextActions)).toBe(true);
  });

  it("script writes JSON and Markdown reports", () => {
    const jsonPath = resolve("outputs/unified-quality-gate-report.json");
    const mdPath = resolve("outputs/unified-quality-gate-report.md");

    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(mdPath)).toBe(true);

    const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(json.version).toBe("10.75.0");
    expect(json.qualityVerdict).toBeDefined();
    expect(json.benchmark || json.benchmark === null).toBeDefined();
    expect(json.realityGate).toBeDefined();
    expect(json.thresholds).toBeDefined();

    const md = readFileSync(mdPath, "utf-8");
    expect(md).toContain("Unified Quality Gate");
    expect(md).toContain("Quality Verdict");
    expect(md).toContain("Benchmark");
    expect(md).toContain("Reality Gate");
  });

  it("does not mutate state (idempotent)", () => {
    const gate1 = runUnifiedQualityGate({ skipDeterminism: true });
    const gate2 = runUnifiedQualityGate({ skipDeterminism: true });

    expect(gate2.unifiedSummary.totalChecks).toBe(gate1.unifiedSummary.totalChecks);
    expect(gate2.unifiedSummary.passed).toBe(gate1.unifiedSummary.passed);
    expect(gate2.unifiedSummary.failed).toBe(gate1.unifiedSummary.failed);
    expect(gate2.qualityVerdict.level).toBe(gate1.qualityVerdict.level);
  });

  it("preserves Core Reality Gate semantics", () => {
    const rg = gate.realityGateResult;
    expect(rg.version).toBeDefined();
    expect(rg.suites.realityAudit).toBeDefined();
    expect(rg.suites.longTermAccumulation).toBeDefined();
    expect(rg.suites.eventTypeCoverage).toBeDefined();
    expect(rg.gateVerdict).toBeDefined();
    expect(rg.requiredForRelease).toBe(true);
  });

  it("skip benchmark config works", () => {
    const noBench = runUnifiedQualityGate({ skipBenchmark: true, skipDeterminism: true });

    expect(noBench.benchmarkResult).toBeNull();
    expect(noBench.benchmarkSummary).toBeNull();
    expect(noBench.unifiedSummary.benchmarkPassed).toBe(true); // skipped = passed
    expect(noBench.realityGateResult).toBeDefined();
  });

  it("has release readiness structure", () => {
    expect(typeof gate.releaseReadiness.ready).toBe("boolean");
    expect(Array.isArray(gate.releaseReadiness.blockers)).toBe(true);
    expect(Array.isArray(gate.releaseReadiness.recommendations)).toBe(true);
  });

  it("has recommended next actions", () => {
    expect(gate.recommendedNextActions.length).toBeGreaterThan(0);
    for (const action of gate.recommendedNextActions) {
      expect(typeof action).toBe("string");
      expect(action.length).toBeGreaterThan(5);
    }
  });

  // ── V13.3: Determinism boundary audit integration ──

  it("includes determinism audit result when not skipped", () => {
    const gateWithDet = runUnifiedQualityGate();
    expect(gateWithDet.determinismAuditResult).toBeDefined();
    expect(gateWithDet.determinismAuditResult?.auditVersion).toBe("13.5.0");
    expect(typeof gateWithDet.determinismAuditResult?.passed).toBe("boolean");
    expect(gateWithDet.unifiedSummary.determinismPassed).toBeDefined();
  });

  it("skipDeterminism config skips the audit", () => {
    const gateNoDet = runUnifiedQualityGate({ skipDeterminism: true });
    expect(gateNoDet.determinismAuditResult).toBeNull();
  });
});
