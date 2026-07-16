import { beforeAll, describe, expect, it } from "vitest";
import {
  runModelCalibrationAudit,
  type ModelCalibrationAuditResult,
} from "../../../src/core/audit/modelCalibrationAudit";

describe("model calibration audit", () => {
  let result: ModelCalibrationAuditResult;

  beforeAll(() => {
    result = runModelCalibrationAudit();
  });

  it("passes the release gate", () => {
    expect(result.gateVerdict.level).toBe("PASS");
    expect(result.failures).toEqual([]);
  });

  it("validates the complete parameter registry", () => {
    expect(result.parameterRegistry.allSetsValid).toBe(true);
    expect(result.parameterRegistry.numericParameterCount).toBe(result.parameterRegistry.descriptorCount);
  });

  it("keeps parameter sets immutable", () => {
    expect(result.parameterRegistry.immutable).toBe(true);
    expect(result.parameterRegistry.descriptorsImmutable).toBe(true);
  });

  it("covers 10 categories, 4 baselines, and 4 horizons", () => {
    expect(result.goldenTrajectories).toHaveLength(160);
    expect(new Set(result.goldenTrajectories.map((item) => item.category))).toHaveLength(10);
    expect(new Set(result.goldenTrajectories.map((item) => item.baselineId))).toHaveLength(4);
    expect(new Set(result.goldenTrajectories.map((item) => item.horizon))).toHaveLength(4);
  });

  it("projects every trajectory into four decision scenarios", () => {
    expect(result.summary.scenarioProjectionCount).toBe(640);
    expect(result.goldenTrajectories.every((item) => item.scenarios.length === 4)).toBe(true);
  });

  it("passes every golden trajectory interval", () => {
    expect(result.summary.failedTrajectories).toBe(0);
    expect(result.summary.passedTrajectories).toBe(160);
  });

  it("keeps relevant decision surfaces responsive", () => {
    expect(result.summary.relevantScenarioResponseRate).toBeGreaterThanOrEqual(0.5);
  });

  it("prevents aggregate response from hiding a failed event category", () => {
    expect(result.categoryDecisionCoverage).toHaveLength(10);
    expect(result.summary.categoryDecisionCoveragePassed).toBe(10);
    expect(result.categoryDecisionCoverage.every((item) => item.responseFloorPassed)).toBe(true);
  });

  it("bounds five-event decision-surface movement per category", () => {
    expect(result.categoryDecisionCoverage.every((item) => item.overreactionGuardPassed)).toBe(true);
  });

  it("passes generated-sequence properties", () => {
    expect(result.propertySequences).toHaveLength(16);
    expect(result.summary.propertySequencesPassed).toBe(16);
  });

  it("replays every generated sequence deterministically", () => {
    expect(result.propertySequences.every((item) => item.deterministic)).toBe(true);
  });

  it("keeps generated states finite, bounded, unique, and valid", () => {
    expect(result.propertySequences.every((item) => (
      item.integrityValid && item.uniqueIds && item.finiteCoordinates
    ))).toBe(true);
  });

  it("passes all metamorphic relations", () => {
    expect(result.metamorphicChecks).toHaveLength(5);
    expect(result.summary.metamorphicChecksPassed).toBe(5);
  });

  it("passes all +/-10 percent sensitivity probes", () => {
    expect(result.sensitivityChecks).toHaveLength(7);
    expect(result.summary.sensitivityChecksPassed).toBe(7);
    expect(result.sensitivityChecks.every((item) => item.normalizedSpread <= 1.5)).toBe(true);
  });

  it("keeps semantic directions stable under sensitivity changes", () => {
    expect(result.sensitivityChecks.every((item) => item.directionStable)).toBe(true);
  });

  it("models damage, repair, and retained scar explicitly", () => {
    expect(result.repairAsymmetry.passed).toBe(true);
    expect(result.repairAsymmetry.damage).toBeGreaterThan(0);
    expect(result.repairAsymmetry.repair).toBeGreaterThan(0);
    expect(result.repairAsymmetry.scarRetentionRatio).toBeGreaterThan(0);
    expect(result.repairAsymmetry.scarRetentionRatio).toBeLessThan(1);
  });

  it("passes every structured assertion", () => {
    expect(result.summary.passedAssertions).toBe(result.summary.totalAssertions);
  });

  it("is deterministic as a complete audit artifact", () => {
    expect(runModelCalibrationAudit()).toEqual(result);
  });

  it("retains explicit epistemic limitations", () => {
    expect(result.knownLimitations.some((item) => item.includes("not clinical"))).toBe(true);
    expect(result.knownLimitations.some((item) => item.includes("transient state"))).toBe(true);
    expect(result.requiredForRelease).toBe(true);
  });
});
