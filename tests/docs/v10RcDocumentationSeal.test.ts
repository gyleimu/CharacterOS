import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V10.79 RC Documentation Seal", () => {
  const readme = readFileSync(resolve("README.md"), "utf-8");

  it("README mentions V10 RC", () => {
    expect(readme).toMatch(/V10.*RC|Release Candidate|V10\.78/);
  });

  it("README mentions current test count", () => {
    expect(readme).toContain("2163 tests");
    expect(readme).toContain("170 files");
  });

  it("README states current version includes V10 RC and V11 RC", () => {
    expect(readme).toMatch(/V10.*RC|Release Candidate/);
  });

  it("README does not claim active warnings exist", () => {
    // Should not say there are active warnings (there are 0)
    const activeWarnMatch = readme.match(/active.*warning.*[1-9]/i);
    expect(activeWarnMatch).toBeNull();
  });

  it("README has gate status showing PASS", () => {
    expect(readme).toContain("Core Reality Gate");
    expect(readme).toContain("PASS");
    expect(readme).toContain("Unified Quality Gate");
  });

  it("README explicitly states V20/multi-character not started", () => {
    expect(readme).toContain("V20 未开始");
  });

  it("README states current project is single-character only", () => {
    expect(readme).toContain("单角色内核");
    expect(readme).toContain("不做多角色");
  });

  it("RC manifest exists and is valid", () => {
    const manifestPath = resolve("outputs/v10-rc-manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.rcVerdict).toBe("PASS");
    expect(manifest.releaseReady).toBe(true);
    expect(manifest.gates.coreRealityGate.activeWarnings).toBe(0);
    expect(manifest.gates.coreRealityGate.failures).toBe(0);
    expect(manifest.knownWarningRegistry.activeWarnings).toBe(0);
    expect(manifest.tests.failed).toBe(0);
    expect(manifest.releaseBoundary.v20NotStarted).toBe(true);
    expect(manifest.releaseBoundary.singleCharacterOnly).toBe(true);
  });

  it("manifest has all required sections", () => {
    const manifest = JSON.parse(
      readFileSync(resolve("outputs/v10-rc-manifest.json"), "utf-8"),
    );
    expect(manifest.tests).toBeDefined();
    expect(manifest.gates).toBeDefined();
    expect(manifest.knownWarningRegistry).toBeDefined();
    expect(manifest.benchmark).toBeDefined();
    expect(manifest.knownLimitations).toBeDefined();
    expect(manifest.releaseBoundary).toBeDefined();
    expect(manifest.sourceReports).toBeDefined();
    expect(manifest.apiRoutes).toBeGreaterThan(0);
    expect(manifest.eventTypes.length).toBe(10);
    expect(manifest.auditSuites).toBeGreaterThan(0);
  });

  it("latest V10 reports are present", () => {
    expect(existsSync(resolve("docs/v10.78_release_candidate_freeze_audit_report.md"))).toBe(true);
    expect(existsSync(resolve("docs/v10.77_known_warning_burndown_report.md"))).toBe(true);
  });

  it("docs no longer refer to old versions as current", () => {
    // README should not claim V10.29 as current
    expect(readme).not.toMatch(/当前阶段.*V10\.29/);
    // Should reference the RC
    expect(readme).toMatch(/V10\.78|RC/);
  });

  it("gate output files exist after running scripts", () => {
    expect(existsSync(resolve("outputs/core-reality-gate-report.json"))).toBe(true);
    expect(existsSync(resolve("outputs/unified-quality-gate-report.json"))).toBe(true);
  });
});
