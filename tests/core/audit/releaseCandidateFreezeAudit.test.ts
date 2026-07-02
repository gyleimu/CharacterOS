import { describe, expect, it } from "vitest";
import { runReleaseCandidateFreezeAudit } from "../../../src/core/audit/releaseCandidateFreezeAudit";

describe("V10.78 Release Candidate Freeze Audit", () => {
  const rc = runReleaseCandidateFreezeAudit();

  it("core reality gate PASS", () => {
    expect(rc.gates.coreRealityGate.verdict).toBe("PASS");
    expect(rc.gates.coreRealityGate.passed).toBe(true);
    expect(rc.gates.coreRealityGate.failures).toBe(0);
  });

  it("unified quality gate PASS", () => {
    expect(rc.gates.unifiedQualityGate.verdict).toBe("PASS");
    expect(rc.gates.unifiedQualityGate.passed).toBe(true);
    expect(rc.gates.unifiedQualityGate.releaseReady).toBe(true);
    expect(rc.gates.unifiedQualityGate.failures).toBe(0);
  });

  it("quality trend not regressed", () => {
    expect(rc.gates.qualityTrend.verdict).not.toBe("REGRESSED");
    expect(rc.gates.qualityTrend.regressionFlags).toBe(0);
  });

  it("active warnings zero", () => {
    expect(rc.registryHealth.activeCount).toBe(0);
    expect(rc.registryHealth.healthy).toBe(true);
  });

  it("registry has no resolvedWarningRegressions", () => {
    expect(rc.registryHealth.resolvedRegressions).toBe(0);
  });

  it("releaseReady is true", () => {
    expect(rc.gates.unifiedQualityGate.releaseReady).toBe(true);
  });

  it("deterministic: second run summary is stable", () => {
    expect(rc.determinism.passed).toBe(true);
    expect(rc.determinism.summaryStable).toBe(true);
    expect(rc.determinism.verdictStable).toBe(true);
  });

  it("mutation safety: audit does not mutate state", () => {
    expect(rc.mutationSafety.passed).toBe(true);
  });

  it("all checks pass", () => {
    for (const check of rc.checks) {
      expect(check.passed).toBe(true);
    }
  });

  it("RC verdict is PASS", () => {
    expect(rc.rcVerdict).toBe("PASS");
  });

  it("RC recommendation is positive", () => {
    expect(rc.rcRecommendation).toContain("stable");
    expect(rc.rcRecommendation).toContain("ready");
  });

  it("remaining limitations are documented", () => {
    expect(rc.remainingLimitations.length).toBeGreaterThan(0);
    for (const lim of rc.remainingLimitations) {
      expect(typeof lim).toBe("string");
      expect(lim.length).toBeGreaterThan(10);
    }
  });

  it("audit has version and timestamp", () => {
    expect(rc.auditVersion).toBe("10.78.0");
    expect(typeof rc.auditedAt).toBe("string");
    expect(rc.targetVersion).toContain("RC");
  });

  it("gate result does not expose raw state payload", () => {
    const json = JSON.stringify(rc);
    // Should not contain raw coordinate values or internal state
    expect(json).not.toContain("boundaryStressLoad");
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("memories");
  });
});
