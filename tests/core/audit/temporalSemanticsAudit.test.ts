import { describe, expect, it } from "vitest";
import { runTemporalSemanticsAudit } from "../../../src/core/audit/temporalSemanticsAudit";

describe("Temporal Semantics Audit", () => {
  const audit = runTemporalSemanticsAudit();

  it("uses the V14 temporal audit contract", () => {
    expect(audit.version).toBe("14.0.0");
    expect(audit.requiredForRelease).toBe(true);
  });

  it("passes every temporal case", () => {
    expect(audit.gateVerdict).toEqual(expect.objectContaining({ level: "PASS", passed: true }));
    expect(audit.summary.failedCases).toBe(0);
    expect(audit.failures).toHaveLength(0);
  });

  it("covers repeat saturation", () => {
    expectCasePasses("repeat_saturation");
  });

  it("covers recovery between spaced events", () => {
    expectCasePasses("spaced_recovery");
    expectCasePasses("passive_recovery");
  });

  it("distinguishes concentrated and spaced trajectories", () => {
    const result = expectCasePasses("concentrated_vs_spaced");
    expect(Number(result.metrics.denseDose)).toBeLessThan(Number(result.metrics.spacedDose));
    expect(Number(result.metrics.finalDistance)).toBeGreaterThan(0);
  });

  it("guards neutral-event stability", () => {
    const result = expectCasePasses("neutral_stability");
    expect(Number(result.metrics.personalityDistance)).toBeLessThan(0.02);
  });

  it("guards out-of-order clock safety", () => {
    const result = expectCasePasses("out_of_order_protection");
    expect(result.metrics.mode).toBe("out_of_order");
    expect(result.metrics.recoveryApplied).toBe(false);
  });

  it("guards exact deterministic replay", () => {
    const result = expectCasePasses("deterministic_replay");
    expect(result.metrics.identical).toBe(true);
  });

  it("reports internally consistent summary counts", () => {
    expect(audit.summary.totalCases).toBe(audit.cases.length);
    expect(audit.summary.passedCases + audit.summary.failedCases).toBe(audit.summary.totalCases);
    expect(audit.summary.passedAssertions).toBe(audit.summary.totalAssertions);
  });

  it("is deterministic across repeated runs", () => {
    expect(runTemporalSemanticsAudit()).toEqual(audit);
  });

  it("documents calibration and ordering limitations", () => {
    expect(audit.knownLimitations.some((item) => item.includes("24-hour"))).toBe(true);
    expect(audit.knownLimitations.some((item) => item.includes("Out-of-order"))).toBe(true);
  });

  function expectCasePasses(id: string) {
    const result = audit.cases.find((item) => item.id === id);
    expect(result, `missing audit case ${id}`).toBeDefined();
    expect(result?.passed, result?.failures.join("; ")).toBe(true);
    return result!;
  }
});
