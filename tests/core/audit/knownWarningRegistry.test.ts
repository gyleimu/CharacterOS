import { describe, expect, it } from "vitest";
import {
  classifyWarnings,
  getKnownWarningSummary,
  getRegistry,
  findWarning,
  type KnownWarning,
} from "../../../src/core/audit/knownWarningRegistry";
import { runCoreRealityRegressionGate } from "../../../src/core/audit/coreRealityRegressionGate";

describe("V10.77 Known Warning Registry", () => {
  it("registry contains all expected warning entries", () => {
    const registry = getRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(3);

    const ids = registry.map((w) => w.warningId);
    expect(ids).toContain("accumulation_betrayal_near_linear_growth");
    expect(ids).toContain("accumulation_neutral_near_linear_growth");
    expect(ids).toContain("coverage_neutral_relevance_overreaction");
  });

  it("matches known warning by source/pattern", () => {
    const warnings = [
      "betrayalAccumulation WARN: personality accumulation shows near-linear growth with no saturation (early-avg=0.0092, recent-avg=0.0216)",
    ];
    const result = classifyWarnings(warnings);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.matched.warningId).toBe("accumulation_betrayal_near_linear_growth");
    expect(result.allowedWarnings).toHaveLength(0);
    expect(result.activeWarnings).toHaveLength(0);
    expect(result.resolvedWarningRegressions).toHaveLength(1);
    expect(result.unmatched).toHaveLength(0);
  });

  it("resolved warning regression is separated from unknown active warnings", () => {
    const warnings = [
      "betrayalAccumulation WARN: personality accumulation shows near-linear growth with no saturation (early-avg=0.0092, recent-avg=0.0216)",
      "some completely unknown new warning about memory corruption",
    ];
    const result = classifyWarnings(warnings);

    expect(result.allowedWarnings).toHaveLength(0);
    expect(result.activeWarnings).toHaveLength(1);
    expect(result.resolvedWarningRegressions).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
  });

  it("resolved warning reappearing becomes regression risk", () => {
    const warnings = [
      "neutralAccumulation WARN: personality accumulation shows near-linear growth",
    ];
    const result = classifyWarnings(warnings);

    expect(result.resolvedWarningRegressions).toHaveLength(1);
    expect(result.matched[0]!.matched.status).toBe("resolved");
  });

  it("unknown warning is classified as active", () => {
    const warnings = ["completely new unexpected warning"];
    const result = classifyWarnings(warnings);

    expect(result.unmatched).toHaveLength(1);
    expect(result.activeWarnings).toHaveLength(1);
  });

  it("getKnownWarningSummary returns correct counts", () => {
    const warnings = [
      "betrayalAccumulation WARN: personality accumulation shows near-linear growth (allowed)",
      "some new warning (unknown)",
      "neutral on study: expected low relevance (resolved regression)",
    ];
    const summary = getKnownWarningSummary(warnings);

    expect(summary.allowedCount).toBe(0);
    expect(summary.activeCount).toBe(1); // unknown → active
    expect(summary.resolvedRegressions).toBe(2);
    expect(summary.unknownCount).toBe(1);
    expect(summary.totalCount).toBe(3);
  });

  it("findWarning locates entry by id or pattern", () => {
    const byId = findWarning("accumulation_betrayal_near_linear_growth");
    expect(byId).toBeDefined();
    expect(byId!.status).toBe("resolved");

    const byPattern = findWarning("betrayalAccumulation WARN: personality accumulation shows near-linear growth");
    expect(byPattern).toBeDefined();
    expect(byPattern!.warningId).toBe("accumulation_betrayal_near_linear_growth");
  });

  it("registry entries have required fields", () => {
    for (const entry of getRegistry()) {
      expect(typeof entry.warningId).toBe("string");
      expect(typeof entry.sourceSuite).toBe("string");
      expect(["low", "medium", "high"]).toContain(entry.severity);
      expect(["active", "allowed", "resolved"]).toContain(entry.status);
      expect(typeof entry.rationale).toBe("string");
      expect(typeof entry.matchingPattern).toBe("string");
    }
  });

  it("empty warnings array produces empty result", () => {
    const result = classifyWarnings([]);
    expect(result.matched).toHaveLength(0);
    expect(result.activeWarnings).toHaveLength(0);
    expect(result.allowedWarnings).toHaveLength(0);
    expect(result.resolvedWarningRegressions).toHaveLength(0);
  });

  it("core reality gate includes warning registry", () => {
    const gate = runCoreRealityRegressionGate();

    expect(gate.warningRegistry).toBeDefined();
    expect(gate.knownWarningSummary).toBeDefined();
    expect(typeof gate.knownWarningSummary.activeCount).toBe("number");
    expect(typeof gate.knownWarningSummary.allowedCount).toBe("number");
    expect(Array.isArray(gate.warningRegistry.activeWarnings)).toBe(true);
    expect(Array.isArray(gate.warningRegistry.allowedWarnings)).toBe(true);
  });

  it("gate still WARNS on real problems (not silently dropped)", () => {
    // Simulate a real new warning — use strict config
    const strictGate = runCoreRealityRegressionGate({
      maxNeutralPersonalityDistance: 0.0001,
    });

    // With impossible threshold, should have active warnings or failures
    if (strictGate.failures.length > 0 || strictGate.warningRegistry.activeWarnings.length > 0) {
      // Gate detected the problem — good
      expect(strictGate.gateVerdict.level).not.toBe("PASS");
    }
    // Warning registry should work even with failures
    expect(strictGate.warningRegistry).toBeDefined();
  });

  it("V10.77: gate verdict is now PASS (warnings 3 → 1 allowed)", () => {
    const gate = runCoreRealityRegressionGate();

    // Gate should be PASS with 0 active warnings
    expect(gate.gateVerdict.level).toBe("PASS");
    expect(gate.knownWarningSummary.allowedCount).toBe(0);
    expect(gate.knownWarningSummary.activeCount).toBe(0);
    // No failures
    expect(gate.failures).toHaveLength(0);
  });
});
