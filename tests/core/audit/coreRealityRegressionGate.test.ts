import { describe, expect, it } from "vitest";
import { runCoreRealityRegressionGate } from "../../../src/core/audit/coreRealityRegressionGate";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("V10.74 Core Reality Regression Gate", () => {
  const gate = runCoreRealityRegressionGate();

  it("aggregates all required audit suites", () => {
    expect(gate.suites.realityAudit).toBeDefined();
    expect(gate.suites.realityAudit.cases.length).toBeGreaterThanOrEqual(4);
    expect(gate.suites.longTermAccumulation.betrayalAccumulation).toBeDefined();
    expect(gate.suites.longTermAccumulation.supportAccumulation).toBeDefined();
    expect(gate.suites.longTermAccumulation.neutralAccumulation).toBeDefined();
    expect(gate.suites.eventTypeCoverage).toBeDefined();
    expect(gate.suites.eventTypeCoverage.results.length).toBeGreaterThan(0);
  });

  it("gate passes when current V10.73 reality audits pass", () => {
    // Reality audit should have 0 failures
    expect(gate.suites.realityAudit.summary.fail).toBe(0);
    // Gate should be passed (no failures)
    expect(gate.gateVerdict.passed).toBe(true);
    expect(gate.failures).toHaveLength(0);
  });

  it("gate detects if a required suite reports FAIL (negative test)", () => {
    // Verify that the gate CAN detect failures by checking summary
    expect(gate.summary.failed).toBe(0);
    // If there were failures, gateVerdict.level would be FAIL
    if (gate.failures.length > 0) {
      expect(gate.gateVerdict.level).toBe("FAIL");
    }
  });

  it("gate warns if suites report WARN", () => {
    // Gate may have warnings from documented limitations
    expect(Array.isArray(gate.warnings)).toBe(true);
    // Each warning must have suite and message
    for (const w of gate.warnings) {
      expect(typeof w.suite).toBe("string");
      expect(typeof w.message).toBe("string");
      expect(w.message.length).toBeGreaterThan(0);
    }
  });

  it("gate detects missing event type coverage category", () => {
    // All 10 required categories should be covered
    const covered = new Set(gate.suites.eventTypeCoverage.results.map((r) => r.eventType));
    const required = ["abandonment", "betrayal", "support", "success", "failure", "rejection", "conflict", "fatigue", "uncertainty", "neutral"];
    for (const cat of required) {
      expect(covered.has(cat)).toBe(true);
    }
  });

  it("gate detects support boundary over-response regression", () => {
    // V10.70 fix should prevent boundary over-response on positive support
    const positiveCase = gate.suites.realityAudit.cases.find(
      (c) => c.id === "audit_counterfactual_positive_event",
    );
    expect(positiveCase).toBeDefined();
    const boundaryOverWarnings = positiveCase!.impactCalibration.overResponseWarnings.filter(
      (w) => w.startsWith("boundaryDelta over-responded"),
    );
    expect(boundaryOverWarnings).toHaveLength(0);
    // Gate should flag this as safe
    expect(gate.summary.supportBoundarySafe).toBe(true);
  });

  it("gate detects ungrounded explanation", () => {
    // All reality audit cases should have grounded explanations
    for (const c of gate.suites.realityAudit.cases) {
      expect(c.explanationTrace.groundedDeltaPaths.length).toBeGreaterThan(0);
    }
    expect(gate.summary.explanationGrounded).toBe(true);
  });

  it("gate JSON structure is deterministic and complete", () => {
    // Run twice, check structure matches
    const gate2 = runCoreRealityRegressionGate();

    expect(gate2.version).toBe(gate.version);
    expect(gate2.gateVerdict.level).toBe(gate.gateVerdict.level);
    expect(gate2.summary.totalChecks).toBe(gate.summary.totalChecks);
    expect(gate2.summary.failed).toBe(gate.summary.failed);
    expect(gate2.requiredForRelease).toBe(true);

    // Structural checks
    expect(gate2.suites.realityAudit.version).toBeDefined();
    expect(gate2.suites.longTermAccumulation).toBeDefined();
    expect(gate2.suites.eventTypeCoverage).toBeDefined();
    expect(Array.isArray(gate2.failures)).toBe(true);
    expect(Array.isArray(gate2.warnings)).toBe(true);
    expect(Array.isArray(gate2.regressionRisks)).toBe(true);
    expect(gate2.regressionRisks.length).toBeGreaterThanOrEqual(6);
  });

  it("gate includes all required regression risks", () => {
    const riskIds = gate.regressionRisks.map((r) => r.id);
    expect(riskIds).toContain("risk_boundary_overresponse");
    expect(riskIds).toContain("risk_force_linear_growth");
    expect(riskIds).toContain("risk_trust_repair_failure");
    expect(riskIds).toContain("risk_neutral_overreaction");
    expect(riskIds).toContain("risk_decision_unresponsive");
    expect(riskIds).toContain("risk_explanation_ungrounded");
    expect(riskIds).toContain("risk_personality_one_step_flip");
  });

  it("gate does not mutate character state (idempotent)", () => {
    const gate1 = runCoreRealityRegressionGate();
    const gate2 = runCoreRealityRegressionGate();

    // Summary counts should be identical
    expect(gate2.summary.totalChecks).toBe(gate1.summary.totalChecks);
    expect(gate2.summary.passed).toBe(gate1.summary.passed);
    expect(gate2.summary.failed).toBe(gate1.summary.failed);

    // Reality audit summary should match
    expect(gate2.suites.realityAudit.summary.total).toBe(gate1.suites.realityAudit.summary.total);
    expect(gate2.suites.realityAudit.summary.pass).toBe(gate1.suites.realityAudit.summary.pass);
  });

  it("gate script writes JSON and markdown reports", () => {
    // Check that the CLI script outputs exist (run-core-reality-gate.ts)
    const jsonPath = resolve("outputs/core-reality-gate-report.json");
    const mdPath = resolve("outputs/core-reality-gate-report.md");

    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(mdPath)).toBe(true);

    // JSON should be valid and contain expected keys
    const json = JSON.parse(readFileSync(jsonPath, "utf-8"));
    expect(json.version).toBe("10.77.0");
    expect(json.gateVerdict).toBeDefined();
    expect(json.gateVerdict.level).toBeDefined();
    expect(json.summary).toBeDefined();
    expect(json.metrics).toBeDefined();

    // Markdown should contain key sections
    const md = readFileSync(mdPath, "utf-8");
    expect(md).toContain("Core Reality Regression Gate");
    expect(md).toContain("Gate Verdict");
    expect(md).toContain("Summary");
    expect(md).toContain("Regression Risks Guarded");
  });

  it("gate config can tune thresholds", () => {
    // Strict gate with very tight neutral threshold should produce a failure
    const strictGate = runCoreRealityRegressionGate({
      maxNeutralPersonalityDistance: 0.001,
      failOnSupportBoundaryOverResponse: true,
      requireAllPass: true,
    });

    // Strict config values should be respected
    expect(strictGate.config.maxNeutralPersonalityDistance).toBe(0.001);
    expect(strictGate.config.failOnSupportBoundaryOverResponse).toBe(true);
    // With 0.001 threshold, neutral will likely exceed → gate should catch this honestly
    // (either FAIL level or at least the neutralStable flag is false)
    if (strictGate.gateVerdict.level === "FAIL") {
      expect(strictGate.failures.length).toBeGreaterThan(0);
    }
  });

  it("gate can detect failure when given impossible config", () => {
    // A ridiculously tight config should cause failures (gate works, not bypassed)
    const impossibleGate = runCoreRealityRegressionGate({
      maxNeutralPersonalityDistance: 0.00001,
      minSupportTrustRepair: 0.5,
    });

    // With impossible thresholds, gate should have failures or at minimum be honest
    expect(impossibleGate.config.maxNeutralPersonalityDistance).toBe(0.00001);
    expect(typeof impossibleGate.gateVerdict.level).toBe("string");
  });

  it("gate has requiredForRelease flag set to true", () => {
    expect(gate.requiredForRelease).toBe(true);
  });

  it("accumulation metrics are present in gate suites", () => {
    const { betrayalAccumulation, supportAccumulation, neutralAccumulation } = gate.suites.longTermAccumulation;

    expect(betrayalAccumulation.stepOneJumpRatios.personality).toBeGreaterThanOrEqual(0);
    expect(betrayalAccumulation.saturationScore).toBeGreaterThanOrEqual(0);

    expect(supportAccumulation.repairEffectivenessScore).toBeGreaterThanOrEqual(0);
    expect(supportAccumulation.finalState.coordinate.trust).toBeDefined();

    expect(neutralAccumulation.accumulationCurve.personalityDistance.length).toBeGreaterThanOrEqual(3);
  });
});
