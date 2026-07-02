import { describe, expect, it } from "vitest";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { runRealityAudit, runRealityAuditSuite } from "../../../src/core/audit/realityAudit";

const followUpScenario = {
  id: "follow_up_test",
  name: "同一个后续关系场景",
  trigger: "王雪第二天只回复“刚看到”，没有解释昨晚为什么消失。",
  stressor: "亲密关系解释缺失",
  testFocus: "信任 / 安全感 / 后续行为",
};

describe("V10.67-V10.69 Reality Audit", () => {
  it("proves event input mutates real state and exposes before/after deltas", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const result = runRealityAudit({
      id: "same_character_before_after_test",
      label: "Same Character Before / After",
      baselineState: state,
      eventInput: {
        description: "王雪昨晚突然失联，直到第二天中午才回复一句刚看到。",
        tags: ["王雪", "失联", "等待", "亲密关系"],
        categoryHint: "abandonment",
      },
      followUpDecisionScenario: followUpScenario,
    });

    expect(result.parsedEvent.category).toBe("abandonment");
    expect(result.impactParticles[0]?.category).toBe("abandonment");
    expect(result.memoryDelta).toHaveLength(1);
    expect(result.beliefDelta.length).toBeGreaterThan(0);
    expect(result.personalityDelta.length).toBeGreaterThan(0);
    expect(result.needDelta.length).toBeGreaterThan(0);
    expect(result.desireDelta.length).toBeGreaterThan(0);
    expect(result.beforeState.memoryCount + 1).toBe(result.afterState.memoryCount);
    expect(result.auditVerdict.passed).toBe(true);
  });

  it("V10.68: major negative attachment event alters relationship decision surface", () => {
    const suite = runRealityAuditSuite();
    const beforeAfter = suite.cases.find((item) => item.id === "audit_same_character_negative_event");

    expect(beforeAfter).toBeDefined();
    expect(beforeAfter!.decisionBefore.strategyId.length).toBeGreaterThan(0);
    expect(beforeAfter!.decisionAfter.strategyId.length).toBeGreaterThan(0);
    expect(beforeAfter!.auditVerdict.warnings).not.toContain("state changed but decision did not respond");
    expect(beforeAfter!.decisionResponsiveness.candidateScoreChanged).toBe(true);
    expect(beforeAfter!.decisionResponsiveness.strategyDistributionChanged).toBe(true);
    expect(beforeAfter!.decisionResponsiveness.influenceTraceGrounded).toBe(true);
    expect(beforeAfter!.decisionResponsiveness.verdict).toBe("PASS_WITH_STABLE_TOP_DECISION");
    expect(beforeAfter!.decisionInfluence.decisionInfluenceVector.withdrawal).toBeGreaterThan(0);
    expect(beforeAfter!.decisionInfluence.actionCandidateScoreDelta.emotional_withdrawal).toBeGreaterThan(0);
  });

  it("requires explanation trace to cite concrete state diff paths", () => {
    const suite = runRealityAuditSuite();
    for (const result of suite.cases) {
      expect(result.explanationTrace.scope).toBe("reality_audit");
      expect(result.explanationTrace.facts.length).toBeGreaterThan(0);
      expect(result.explanationTrace.groundedDeltaPaths).toContain("memoryDelta[0]");
      if (result.personalityDelta.length > 0) {
        expect(result.explanationTrace.groundedDeltaPaths).toContain("personalityDelta[0]");
      }
      if (result.beliefDelta.length > 0) {
        expect(result.explanationTrace.groundedDeltaPaths).toContain("beliefDelta[0]");
      }
      if (result.needDelta.length > 0) {
        expect(result.explanationTrace.groundedDeltaPaths).toContain("needDelta[0]");
      }
      expect(result.auditVerdict.warnings).not.toContain("explanation is not grounded in state diff");
    }
  });

  it("runs the three required audit classes", () => {
    const suite = runRealityAuditSuite();
    const kinds = new Set(suite.cases.map((item) => item.caseKind));

    expect(kinds.has("same_character_before_after")).toBe(true);
    expect(kinds.has("counterfactual_event")).toBe(true);
    expect(kinds.has("same_event_different_personality")).toBe(true);
    expect(suite.counterfactual.negativeCaseId).toBe("audit_same_character_negative_event");
    expect(suite.counterfactual.positiveCaseId).toBe("audit_counterfactual_positive_event");
    expect(suite.personalityDifferentiation.sensitiveCaseId).toBe("audit_same_event_sensitive_personality");
    expect(suite.personalityDifferentiation.secureCaseId).toBe("audit_same_event_secure_personality");
  });

  it("V10.68: positive support event increases openness / repair relative to negative event", () => {
    const suite = runRealityAuditSuite();
    const negative = suite.cases.find((item) => item.id === suite.counterfactual.negativeCaseId)!;
    const positive = suite.cases.find((item) => item.id === suite.counterfactual.positiveCaseId)!;
    const negativeTrust = negative.personalityDelta.find((delta) => delta.id === "trust")?.delta ?? 0;
    const positiveTrust = positive.personalityDelta.find((delta) => delta.id === "trust")?.delta ?? 0;
    const negativeFear = negative.personalityDelta.find((delta) => delta.id === "fear")?.delta ?? 0;
    const positiveFear = positive.personalityDelta.find((delta) => delta.id === "fear")?.delta ?? 0;

    expect(negativeTrust).toBeLessThan(positiveTrust);
    expect(negativeFear).toBeGreaterThan(positiveFear);
    expect(suite.counterfactual.coordinateDirectionDifferent).toBe(true);
    expect(suite.counterfactual.decisionDifferent).toBe(true);
    expect(suite.counterfactual.verdict.level).toBe("PASS");
    expect(positive.decisionInfluence.decisionInfluenceVector.openness).toBeGreaterThan(
      negative.decisionInfluence.decisionInfluenceVector.openness,
    );
    expect(positive.decisionInfluence.decisionInfluenceVector.repair).toBeGreaterThan(
      negative.decisionInfluence.decisionInfluenceVector.repair,
    );
    expect(positive.decisionInfluence.actionCandidateScoreDelta.reframe_as_growth).toBeGreaterThan(0);
  });

  it("V10.68: same event produces different strategy shifts for different baseline personalities", () => {
    const suite = runRealityAuditSuite();
    const sensitive = suite.cases.find((item) => item.id === suite.personalityDifferentiation.sensitiveCaseId)!;
    const secure = suite.cases.find((item) => item.id === suite.personalityDifferentiation.secureCaseId)!;

    expect(sensitive.beforeState.coordinate.trust).toBeLessThan(secure.beforeState.coordinate.trust);
    expect(sensitive.beforeState.coordinate.fear).toBeGreaterThan(secure.beforeState.coordinate.fear);
    expect(suite.personalityDifferentiation.coordinateDifferent).toBe(true);
    expect(sensitive.decisionAfter.action).not.toEqual("");
    expect(secure.decisionAfter.action).not.toEqual("");
    expect(sensitive.decisionAfter.strategyId).not.toBe(secure.decisionAfter.strategyId);
    expect(suite.personalityDifferentiation.verdict.level).toBe("PASS");
  });

  it("V10.68: neutral event does not overreact", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const result = runRealityAudit({
      id: "neutral_low_impact_test",
      label: "Neutral Low Impact Test",
      baselineState: state,
      eventInput: {
        description: "下午路过一家普通便利店，看到门口换了新的海报。",
        tags: ["日常", "路过", "便利店"],
        categoryHint: "general",
      },
      followUpDecisionScenario: followUpScenario,
    });

    expect(result.parsedEvent.category).toBe("general");
    expect(result.decisionResponsiveness.overreactionScore).toBeLessThanOrEqual(0.35);
    expect(result.auditVerdict.warnings).not.toContain("neutral event caused large personality drift");
  });

  it("V10.68: explanation references actual influence vector grounding", () => {
    const suite = runRealityAuditSuite();
    const result = suite.cases.find((item) => item.id === "audit_same_character_negative_event")!;

    expect(result.decisionInfluence.responsivenessTrace.groundedDeltaPaths.length).toBeGreaterThan(0);
    expect(result.explanationTrace.facts.some((fact) => fact.id.endsWith("_decision_influence"))).toBe(true);
    expect(result.decisionResponsiveness.influenceTraceGrounded).toBe(true);
  });

  it("V10.68/V10.69: stable top decision can pass when grounded candidate surface changed", () => {
    const suite = runRealityAuditSuite();
    const stableTop = suite.cases.find((item) => item.decisionResponsiveness.verdict === "PASS_WITH_STABLE_TOP_DECISION");

    expect(stableTop).toBeDefined();
    expect(stableTop!.decisionBefore.strategyId).toBe(stableTop!.decisionAfter.strategyId);
    expect(stableTop!.decisionResponsiveness.candidateScoreChanged).toBe(true);
    expect(stableTop!.decisionResponsiveness.strategyDistributionChanged).toBe(true);
    expect(stableTop!.auditVerdict.passed).toBe(true);
    expect(stableTop!.impactCalibration.calibrationVerdict.failures).toHaveLength(0);
  });

  it("summarizes pass/warn/fail without requiring all cases to be perfect", () => {
    const suite = runRealityAuditSuite();

    expect(suite.version).toBe("10.73.0");
    expect(suite.summary.total).toBe(suite.cases.length + 2);
    expect(suite.summary.fail).toBe(0);
    expect(suite.summary.warn).toBeLessThanOrEqual(1);
    expect(suite.summary.pass + suite.summary.warn + suite.summary.fail).toBe(suite.summary.total);
  });

  it("V10.69: includes impact/personality calibration audit for every case", () => {
    const suite = runRealityAuditSuite();

    for (const result of suite.cases) {
      expect(result.impactCalibration.eventSeverityScore).toBeGreaterThanOrEqual(0);
      expect(result.impactCalibration.domainRelevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.impactCalibration.channelImpactAllocation.memoryImpact).toBeGreaterThanOrEqual(0);
      expect(result.impactCalibration.expectedDeltaRange.length).toBeGreaterThan(0);
      expect(result.impactCalibration.actualDeltaByChannel.decisionSurfaceDelta).toBeGreaterThanOrEqual(0);
      expect(result.explanationTrace.groundedDeltaPaths).toContain("impactCalibration.calibrationVerdict");
    }
  });
});
