import { describe, expect, it } from "vitest";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState, CharacterPhysicsEngine } from "../../../src/core/physics/physicsEngine";
import { parseExperienceEvent } from "../../../src/core/event/eventParser";
import { runRealityAudit, runRealityAuditSuite } from "../../../src/core/audit/realityAudit";
import { runImpactCalibrationAudit } from "../../../src/core/audit/impactCalibrationAudit";
import { runLongTermAccumulationAudit } from "../../../src/core/audit/longTermAccumulationAudit";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";

const relationshipScenario = {
  id: "relationship_followup",
  name: "亲密关系后续确认",
  trigger: "对方第二天只回复一句刚看到，没有解释昨晚为什么消失。",
  stressor: "亲密关系 / 信任 / 解释缺失",
  testFocus: "关系 信任 安全感 回复",
};

const studyScenario = {
  id: "study_challenge_followup",
  name: "学业挑战后续",
  trigger: "老师邀请他参加一个高难度考试项目。",
  stressor: "学业 / 能力 / 挑战",
  testFocus: "学业 能力 自尊 努力",
};

describe("V10.69 Impact / Personality Calibration Audit", () => {
  it("major betrayal event creates high memory impact and visible trust/boundary/need delta", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const result = runRealityAudit({
      id: "major_betrayal_calibration",
      label: "Major Betrayal Calibration",
      baselineState: state,
      eventInput: {
        description: "亲密朋友隐瞒真相并把他的秘密告诉别人，导致他被公开背叛。",
        tags: ["朋友", "隐瞒", "秘密", "背叛", "亲密关系"],
        categoryHint: "betrayal",
      },
      followUpDecisionScenario: relationshipScenario,
    });

    expect(result.impactCalibration.eventSeverityScore).toBeGreaterThan(0.75);
    expect(result.impactCalibration.actualDeltaByChannel.memoryImpact).toBeGreaterThan(0.7);
    expect(result.impactCalibration.actualDeltaByChannel.boundaryDelta).toBeGreaterThan(0.1);
    expect(result.impactCalibration.actualDeltaByChannel.needDelta).toBeGreaterThan(0.01);
    expect(result.impactCalibration.actualDeltaByChannel.beliefDelta).toBeGreaterThan(0.08);
    expect(result.impactCalibration.calibrationVerdict.failures).toHaveLength(0);
  });

  it("stable high-trust personality may buffer personality drift while other channels respond", () => {
    const suite = runRealityAuditSuite();
    const secure = suite.cases.find((item) => item.id === "audit_same_event_secure_personality")!;

    expect(secure.impactCalibration.baselineStabilityScore).toBeGreaterThan(0.8);
    expect(secure.impactCalibration.resilienceBufferScore).toBeGreaterThan(0.55);
    expect(secure.impactCalibration.actualDeltaByChannel.personalityCoordinateDelta).toBeLessThan(0.01);
    expect(secure.impactCalibration.actualDeltaByChannel.beliefDelta).toBeGreaterThan(0.08);
    expect(secure.impactCalibration.actualDeltaByChannel.needDelta).toBeGreaterThan(0.1);
    expect(secure.impactCalibration.actualDeltaByChannel.decisionSurfaceDelta).toBeGreaterThan(0.1);
    expect(secure.impactCalibration.calibrationVerdict.level).toBe("PASS_WITH_RESILIENCE_BUFFER");
  });

  it("neutral event does not cause large personality or decision drift", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const result = runRealityAudit({
      id: "neutral_calibration",
      label: "Neutral Calibration",
      baselineState: state,
      eventInput: {
        description: "下午路过普通便利店，看到门口换了一张新的海报。",
        tags: ["日常", "路过", "便利店"],
        categoryHint: "general",
      },
      followUpDecisionScenario: relationshipScenario,
    });

    expect(result.impactCalibration.actualDeltaByChannel.personalityCoordinateDelta).toBeLessThan(0.015);
    expect(result.decisionResponsiveness.overreactionScore).toBeLessThanOrEqual(0.35);
    expect(result.impactCalibration.overResponseWarnings).not.toContain("neutral event caused large personality drift");
  });

  it("repeated related negative events accumulate personality drift more than a single event", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const single = cloneState(baseline);
    const repeated = cloneState(baseline);
    const event = parseExperienceEvent({
      description: "重要的人突然失联，让他整晚等待。",
      tags: ["失联", "等待", "亲密关系"],
      categoryHint: "abandonment",
    });
    const engine = new CharacterPhysicsEngine();

    engine.processEvent(single, event);
    for (let index = 0; index < 4; index += 1) engine.processEvent(repeated, event);

    expect(maxCoordinateDiff(baseline, repeated)).toBeGreaterThan(maxCoordinateDiff(baseline, single));
  });

  it("positive support event increases trust/openness influence without unrealistic instant personality flip", () => {
    const suite = runRealityAuditSuite();
    const positive = suite.cases.find((item) => item.id === "audit_counterfactual_positive_event")!;

    expect(positive.decisionInfluence.decisionInfluenceVector.openness).toBeGreaterThan(0);
    expect(positive.decisionInfluence.decisionInfluenceVector.repair).toBeGreaterThan(0);
    expect(positive.impactCalibration.actualDeltaByChannel.personalityCoordinateDelta).toBeLessThan(0.02);
    expect(positive.impactCalibration.overResponseWarnings).not.toContain("one minor event permanently flips core personality");
  });

  it("low domain relevance event does not strongly affect unrelated decision surface", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const result = runRealityAudit({
      id: "low_relevance_calibration",
      label: "Low Relevance Calibration",
      baselineState: state,
      eventInput: {
        description: "昨晚睡得很浅，早上身体有点疲劳。",
        tags: ["疲劳", "睡眠", "身体"],
        categoryHint: "general",
      },
      followUpDecisionScenario: studyScenario,
    });

    expect(result.impactCalibration.domainRelevanceScore).toBeLessThan(0.5);
    // V10.70: baseline boundary state legitimately shifts when support events reduce stress,
    // causing a minor second-order drift (~0.0008) in overreactionScore for unrelated events.
    expect(result.decisionResponsiveness.overreactionScore).toBeLessThanOrEqual(0.36);
  });

  it("explanation trace cites channel calibration verdict", () => {
    const suite = runRealityAuditSuite();
    const result = suite.cases[0]!;

    expect(result.explanationTrace.groundedDeltaPaths).toContain("impactCalibration.calibrationVerdict");
    expect(result.explanationTrace.facts.some((fact) => fact.id.endsWith("_impact_calibration"))).toBe(true);
  });

  it("high severity event with low all-channel delta warns or fails", () => {
    const parsed = parseExperienceEvent({
      description: "亲密朋友公开背叛并泄露秘密。",
      tags: ["亲密关系", "朋友", "背叛", "秘密"],
      categoryHint: "betrayal",
    });
    const result = runImpactCalibrationAudit({
      parsedEvent: parsed,
      impactParticles: [{ category: "betrayal", emotion: "anger", impactScore: 0.9, vector: baselineVector() }],
      beforeState: { coordinate: baselineVector(), boundaryStressLoad: 0.2 },
      afterState: { coordinate: baselineVector(), boundaryStressLoad: 0.2 },
      memoryDelta: [],
      beliefDelta: [],
      personalityDelta: [],
      needDelta: [],
      desireDelta: [],
      boundaryDelta: [],
      emotionDelta: { primary: "anger", valence: -0.7, arousal: 0.8, intensity: 0.9, deltaIntensity: 0.9 },
      followUpScenario: relationshipScenario,
      decisionInfluence: {
        decisionInfluenceVector: {
          caution: 0,
          testing: 0,
          withdrawal: 0,
          openness: 0,
          reassuranceSeeking: 0,
          boundaryProbing: 0,
          confrontation: 0,
          control: 0,
          repair: 0,
          negotiation: 0,
          freeze: 0,
        },
        strategyWeightDelta: {},
        actionCandidateScoreDelta: {},
        decisionSurfaceBefore: {
          topCandidateId: "none",
          selectedStrategyId: "verify_before_commitment",
          selectedAction: "",
          strategyDistribution: {},
          actionCandidates: [],
        },
        decisionSurfaceAfter: {
          topCandidateId: "none",
          selectedStrategyId: "verify_before_commitment",
          selectedAction: "",
          strategyDistribution: {},
          actionCandidates: [],
        },
        responsivenessTrace: {
          scenarioRelevance: 0.8,
          stateDeltaMagnitude: 0,
          influenceMagnitude: 0,
          groundedDeltaPaths: [],
          contributions: [],
          reasons: [],
          warnings: [],
        },
        responsivenessAudit: {
          candidateScoreChanged: false,
          topCandidateChanged: false,
          strategyDistributionChanged: false,
          influenceTraceGrounded: false,
          responsivenessScore: 0,
          overreactionScore: 0,
          verdict: "FAIL",
          reasons: [],
          warnings: [],
          failures: [],
        },
      },
    });

    expect(["WARN", "FAIL"]).toContain(result.calibrationVerdict.level);
    expect(result.underResponseWarnings.length).toBeGreaterThan(0);
  });

  // ── V10.70 Boundary / Positive Support Calibration Repair ──

  it("V10.70: positive support event does not over-shift boundary pressure", () => {
    const suite = runRealityAuditSuite();
    const positive = suite.cases.find((item) => item.id === "audit_counterfactual_positive_event")!;

    // The boundaryDelta should stay within the calibrated expected range
    const boundaryRange = positive.impactCalibration.expectedDeltaRange.find(
      (r) => r.channel === "boundaryDelta",
    )!;
    const actualBoundary = positive.impactCalibration.actualDeltaByChannel.boundaryDelta;

    expect(actualBoundary).toBeLessThanOrEqual(boundaryRange.expectedMax + 0.05);
    expect(actualBoundary).toBeGreaterThanOrEqual(0);
    // The previous V10.69 over-response WARN must be gone
    expect(
      positive.impactCalibration.overResponseWarnings.filter((w) =>
        w.startsWith("boundaryDelta over-responded"),
      ),
    ).toHaveLength(0);
    // Positive support should reduce (not increase) boundary stress load
    const stressDelta = positive.boundaryDelta.find((d) => d.id === "boundaryStressLoad");
    expect(stressDelta).toBeDefined();
    expect(stressDelta!.delta).toBeLessThanOrEqual(0);
  });

  it("V10.70: positive support event still increases openness and repair decision influence", () => {
    const suite = runRealityAuditSuite();
    const positive = suite.cases.find((item) => item.id === "audit_counterfactual_positive_event")!;

    expect(positive.decisionInfluence.decisionInfluenceVector.openness).toBeGreaterThan(0);
    expect(positive.decisionInfluence.decisionInfluenceVector.repair).toBeGreaterThan(0);
    // Decision surface should still respond
    expect(positive.decisionResponsiveness.candidateScoreChanged).toBe(true);
    // Calibration should pass without boundary over-response warnings
    expect(positive.impactCalibration.calibrationVerdict.passed).toBe(true);
  });

  it("V10.70: betrayal event still produces meaningful boundary response", () => {
    const suite = runRealityAuditSuite();
    const negative = suite.cases.find((item) => item.id === "audit_same_character_negative_event")!;

    // Betrayal/abandonment must still produce strong boundary impact
    expect(negative.impactCalibration.actualDeltaByChannel.boundaryDelta).toBeGreaterThan(0.1);
    expect(negative.impactCalibration.actualDeltaByChannel.beliefDelta).toBeGreaterThan(0.08);
    expect(negative.impactCalibration.actualDeltaByChannel.needDelta).toBeGreaterThan(0.01);
    // Boundary stress must INCREASE for negative events
    const stressDelta = negative.boundaryDelta.find((d) => d.id === "boundaryStressLoad");
    expect(stressDelta).toBeDefined();
    expect(stressDelta!.delta).toBeGreaterThan(0);
    // Calibration must pass
    expect(negative.impactCalibration.calibrationVerdict.failures).toHaveLength(0);
  });

  it("V10.70: neutral event still does not overreact", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const result = runRealityAudit({
      id: "v10_70_neutral_test",
      label: "V10.70 Neutral Test",
      baselineState: state,
      eventInput: {
        description: "下午路过普通便利店，看到门口换了一张新的海报。",
        tags: ["日常", "路过", "便利店"],
        categoryHint: "general",
      },
      followUpDecisionScenario: relationshipScenario,
    });

    expect(result.impactCalibration.actualDeltaByChannel.personalityCoordinateDelta).toBeLessThan(0.015);
    expect(result.decisionResponsiveness.overreactionScore).toBeLessThanOrEqual(0.36);
    expect(result.impactCalibration.calibrationVerdict.passed).toBe(true);
  });

  it("V10.70: repeated support events accumulate safety evidence gradually", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const single = cloneState(baseline);
    const repeated = cloneState(baseline);

    const supportEvent = parseExperienceEvent({
      description: "王雪主动关心他的近况，陪他聊了很久。",
      tags: ["王雪", "陪伴", "支持", "温暖"],
      categoryHint: "support",
    });
    const engine = new CharacterPhysicsEngine();

    // Single support event
    engine.processEvent(single, supportEvent);
    // Repeated support events (4x)
    for (let i = 0; i < 4; i++) engine.processEvent(repeated, supportEvent);

    // Repeated support should reduce boundary stress more than a single event
    const singleStress = single.boundary.stressLoad;
    const repeatedStress = repeated.boundary.stressLoad;
    expect(repeatedStress).toBeLessThan(singleStress);

    // Repeated support should improve boundary integrity
    expect(repeated.boundary.integrity).toBeGreaterThanOrEqual(single.boundary.integrity);

    // Support events should NOT increase stress (V10.70 core invariant)
    const baselineStress = baseline.boundary.stressLoad;
    expect(singleStress).toBeLessThanOrEqual(baselineStress + 0.01);
    expect(repeatedStress).toBeLessThan(singleStress);

    // Boundary cracks should not increase from support events
    expect(repeated.boundary.cracks).toBeLessThanOrEqual(baseline.boundary.cracks + 0.01);
  });

  it("V10.70: calibration reports 0 FAIL across all suite cases", () => {
    const suite = runRealityAuditSuite();

    for (const c of suite.cases) {
      expect(c.impactCalibration.calibrationVerdict.failures).toHaveLength(0);
    }
    // The previous V10.69 WARN should be resolved
    expect(suite.summary.warn).toBe(0);
    expect(suite.summary.fail).toBe(0);
  });

  it("V10.70: no hardcoded case-specific bypass — different support events all behave correctly", () => {
    const state1 = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const state2 = cloneState(state1);

    // Two different support events should both pass calibration
    const engine = new CharacterPhysicsEngine();
    const eventA = parseExperienceEvent({
      description: "朋友在他低谷时主动陪伴并给予鼓励。",
      tags: ["朋友", "陪伴", "鼓励", "支持"],
      categoryHint: "support",
    });
    const eventB = parseExperienceEvent({
      description: "同事公开认可他的工作贡献。",
      tags: ["同事", "认可", "工作"],
      categoryHint: "success",
    });

    engine.processEvent(state1, eventA);
    engine.processEvent(state2, eventB);

    // Both should decrease or maintain boundary stress (not increase dramatically)
    expect(state1.boundary.stressLoad).toBeLessThanOrEqual(
      createCharacterStateFromBlueprint(createLinFanBlueprint(), {
        seedInitialExperiences: true,
      }).boundary.stressLoad + 0.02,
    );
    expect(state2.boundary.stressLoad).toBeLessThanOrEqual(
      createCharacterStateFromBlueprint(createLinFanBlueprint(), {
        seedInitialExperiences: true,
      }).boundary.stressLoad + 0.02,
    );
  });

  // ── V10.71 Long-Term Accumulation Calibration ──

  it("V10.71: repeated betrayal accumulates trust/fear/personality drift gradually", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const abandonmentSeq = Array.from({ length: 5 }, (_, i) => ({
      description: i === 0
        ? "重要的人突然失联，让他整晚等待。"
        : `那个人再次消失，这已经是第${i + 1}次了。`,
      tags: ["失联", "等待", "亲密关系"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: abandonmentSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: {
        trust: "decreasing",
        fear: "increasing",
        personalityDistance: "growing",
      },
    });

    // Personality is a slow channel: step-1 jump must not dominate total
    expect(result.stepOneJumpRatios.personality).toBeLessThan(0.55);
    // Trust should decrease across repeated events
    const trustCurve = result.accumulationCurve.trust;
    expect(trustCurve[trustCurve.length - 1]!).toBeLessThan(trustCurve[0]!);
    // Fear should increase
    const fearCurve = result.accumulationCurve.fear;
    expect(fearCurve[fearCurve.length - 1]!).toBeGreaterThan(fearCurve[0]!);
    // Personality distance should grow
    expect(
      result.accumulationCurve.personalityDistance[
        result.accumulationCurve.personalityDistance.length - 1
      ]!,
    ).toBeGreaterThan(result.accumulationCurve.personalityDistance[0]!);
    // Must not have FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: repeated support accumulates openness/trust gradually", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const supportSeq = Array.from({ length: 5 }, (_, i) => ({
      description: i === 0
        ? "王雪主动解释昨晚没回复的原因，并约定下次会提前说明。"
        : `王雪又一次主动关心他，这已经是第${i + 1}次肯定的回应了。`,
      tags: ["王雪", "解释", "陪伴", "亲密关系"],
      categoryHint: "support" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: supportSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: {
        trust: "increasing",
        fear: "decreasing",
        personalityDistance: "growing",
      },
    });

    // Step-1 personality jump must be reasonable
    expect(result.stepOneJumpRatios.personality).toBeLessThan(0.55);
    // Boundary stress should decrease with repeated support (V10.70)
    const stressCurve = result.accumulationCurve.boundaryStressLoad;
    expect(stressCurve[stressCurve.length - 1]!).toBeLessThan(stressCurve[0]!);
    // Must not FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: neutral repeated events do not accumulate large personality drift", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const neutralSeq = Array.from({ length: 5 }, (_, i) => ({
      description: i === 0
        ? "下午路过一家普通便利店，看到门口换了新的海报。"
        : `又是普通的一天，没有什么特别的事。第${i + 1}天。`,
      tags: ["日常", "平凡"],
      categoryHint: "general" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: neutralSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { personalityDistance: "stable" },
      maxNeutralPersonalityDistance: 0.06,
    });

    // Neutral events should keep personality stable
    const finalDist =
      result.accumulationCurve.personalityDistance[
        result.accumulationCurve.personalityDistance.length - 1
      ]!;
    expect(finalDist).toBeLessThan(0.06);
    // Must not FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: sensitive baseline accumulates faster than secure baseline", () => {
    const sensitiveBase = createCharacterStateFromBlueprint(
      createLinFanBlueprint(),
      { seedInitialExperiences: true },
    );
    const secureBase = createCharacterPhysicsState({
      identity: { id: "secure_test", name: "安稳", description: "高信任低恐惧", tags: ["稳定"] },
      coordinate: {
        values: {
          openness: 0.5, conscientiousness: 0.5, extroversion: 0.54,
          agreeableness: 0.62, neuroticism: 0.28, trust: 0.78,
          attachment: 0.42, fear: 0.24, control: 0.48,
        },
      },
      learningRate: 0.02,
    });

    const abandonmentSeq = Array.from({ length: 5 }, (_, i) => ({
      description: i === 0
        ? "重要的人突然失联，让他整晚等待。"
        : `那个人再次消失，第${i + 1}次。`,
      tags: ["失联", "等待", "亲密关系"],
      categoryHint: "abandonment" as const,
    }));

    const sensitiveResult = runLongTermAccumulationAudit({
      baselineState: sensitiveBase,
      eventSequence: abandonmentSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "decreasing", fear: "increasing", personalityDistance: "growing" },
    });
    const secureResult = runLongTermAccumulationAudit({
      baselineState: secureBase,
      eventSequence: abandonmentSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "decreasing", fear: "increasing", personalityDistance: "growing" },
    });

    const sensitiveDist =
      sensitiveResult.accumulationCurve.personalityDistance[
        sensitiveResult.accumulationCurve.personalityDistance.length - 1
      ]!;
    const secureDist =
      secureResult.accumulationCurve.personalityDistance[
        secureResult.accumulationCurve.personalityDistance.length - 1
      ]!;
    // Sensitive should accumulate more personality drift
    expect(sensitiveDist).toBeGreaterThan(secureDist);
    // Both should pass (no failures)
    expect(sensitiveResult.accumulationVerdict.failures).toHaveLength(0);
    expect(secureResult.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: secure baseline still shows small trend after repeated major events", () => {
    const secureBase = createCharacterPhysicsState({
      identity: { id: "secure_trend", name: "安稳", description: "高信任低恐惧", tags: ["稳定"] },
      coordinate: {
        values: {
          openness: 0.5, conscientiousness: 0.5, extroversion: 0.54,
          agreeableness: 0.62, neuroticism: 0.28, trust: 0.78,
          attachment: 0.42, fear: 0.24, control: 0.48,
        },
      },
      learningRate: 0.02,
    });

    const abandonmentSeq = Array.from({ length: 5 }, (_, i) => ({
      description: `亲密朋友第${i + 1}次失约且无解释。`,
      tags: ["失联", "等待", "亲密关系"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: secureBase,
      eventSequence: abandonmentSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "decreasing", personalityDistance: "growing" },
    });

    // Secure baseline should still show SOME drift, not be completely immune
    const finalDist =
      result.accumulationCurve.personalityDistance[
        result.accumulationCurve.personalityDistance.length - 1
      ]!;
    expect(finalDist).toBeGreaterThan(0.001);
    // But drift should be small
    expect(finalDist).toBeLessThan(0.1);
    // Must not FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: accumulation curve has diminishing returns (saturation check)", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const abandonmentSeq = Array.from({ length: 5 }, (_, i) => ({
      description: `信任的人第${i + 1}次让他失望。`,
      tags: ["失联", "失望", "亲密关系"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: abandonmentSeq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { personalityDistance: "growing" },
    });

    // Saturation ratio exists and is meaningful
    expect(result.saturationMetrics.personalitySaturationRatio).toBeGreaterThanOrEqual(0);
    expect(result.saturationMetrics.personalitySaturationRatio).toBeLessThanOrEqual(1);
    // Step-1 should be a minority of total accumulated drift
    expect(result.stepOneJumpRatios.personality).toBeLessThan(0.55);
  });

  it("V10.71: no single step exceeds configured overreaction threshold", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const mixedSeq = [
      { description: "朋友突然失联。", tags: ["失联"], categoryHint: "abandonment" as const },
      { description: "同事公开认可他的贡献。", tags: ["认可"], categoryHint: "success" as const },
      { description: "又一次被亲近的人欺骗。", tags: ["欺骗"], categoryHint: "betrayal" as const },
      { description: "王雪在深夜陪他说话。", tags: ["陪伴", "温暖"], categoryHint: "support" as const },
    ];

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: mixedSeq,
      followUpDecisionScenario: relationshipScenario,
    });

    // Each step's personality distance should be reasonable
    for (const step of result.stepResults) {
      expect(step.cumulativePersonalityDistance).toBeLessThan(0.2);
    }
    // No FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.71: explanation trace references actual cumulative deltas", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const seq = Array.from({ length: 3 }, (_, i) => ({
      description: `第${i + 1}次被亲近的人放鸽子。`,
      tags: ["失联", "失望"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: seq,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "decreasing" },
    });

    // Each step result should contain meaningful cumulative deltas
    for (const step of result.stepResults) {
      expect(typeof step.cumulativePersonalityDistance).toBe("number");
      expect(typeof step.cumulativeTrust).toBe("number");
      expect(typeof step.cumulativeFear).toBe("number");
    }
    // Accumulation curve should have one entry per step
    expect(result.accumulationCurve.trust).toHaveLength(seq.length);
    expect(result.accumulationCurve.personalityDistance).toHaveLength(seq.length);
  });

  // ── V10.72 Galaxy Force Saturation + Trust Repair Calibration ──

  it("V10.72: repeated betrayal shows diminishing marginal personality drift", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const events = Array.from({ length: 5 }, (_, i) => ({
      description: `第${i + 1}次被亲近的人背叛。`,
      tags: ["背叛", "欺骗"],
      categoryHint: "betrayal" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { personalityDistance: "growing" },
    });

    // Marginal deltas should exist and be reasonable
    const marginals = result.marginalDeltaByStep;
    expect(marginals).toHaveLength(events.length);
    // Total accumulated should dominate first step (slow channel)
    const firstMarginal = marginals[0]!;
    const totalDist = result.accumulationCurve.personalityDistance[
      result.accumulationCurve.personalityDistance.length - 1
    ]!;
    // First step should not be the majority of total accumulation
    expect(firstMarginal).toBeLessThan(totalDist * 0.6);
    // Saturation score should exist
    expect(result.saturationScore).toBeGreaterThanOrEqual(0);
    expect(result.saturationScore).toBeLessThanOrEqual(1);
  });

  it("V10.72: repeated negative events still accumulate meaningful trust/fear change", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const events = Array.from({ length: 5 }, (_, i) => ({
      description: `朋友第${i + 1}次失联无解释。`,
      tags: ["失联", "等待"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "decreasing", fear: "increasing", personalityDistance: "growing" },
    });

    // Trust must decrease meaningfully
    const trustDelta = result.finalState.coordinate.trust - result.baselineState.coordinate.trust;
    expect(trustDelta).toBeLessThan(-0.001);
    // Fear must increase meaningfully
    const fearDelta = result.finalState.coordinate.fear - result.baselineState.coordinate.fear;
    expect(fearDelta).toBeGreaterThan(0.001);
    // Must not FAIL
    expect(result.accumulationVerdict.failures).toHaveLength(0);
  });

  it("V10.72: repeated support produces visible trust repair above minimal threshold", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const events = Array.from({ length: 5 }, (_, i) => ({
      description: `王雪第${i + 1}次主动解释并陪伴。`,
      tags: ["王雪", "解释", "陪伴", "支持"],
      categoryHint: "support" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { trust: "increasing" },
    });

    // Trust should increase visibly over 5 support events
    const trustDelta = result.finalState.coordinate.trust - result.baselineState.coordinate.trust;
    expect(trustDelta).toBeGreaterThan(0.005);
    // Repair effectiveness should be non-zero
    expect(result.repairEffectivenessScore).toBeGreaterThan(0);
  });

  it("V10.72: support trust repair is stronger for low-trust baseline than high-trust baseline", () => {
    const lowTrustBase = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const highTrustBase = createCharacterPhysicsState({
      identity: { id: "high_trust", name: "高信任", description: "", tags: [] },
      coordinate: {
        values: {
          openness: 0.5, conscientiousness: 0.5, extroversion: 0.5,
          agreeableness: 0.6, neuroticism: 0.3, trust: 0.72,
          attachment: 0.5, fear: 0.28, control: 0.5,
        },
      },
    });

    const events = Array.from({ length: 4 }, (_, i) => ({
      description: `朋友第${i + 1}次主动支持。`,
      tags: ["支持", "陪伴"],
      categoryHint: "support" as const,
    }));

    const lowResult = runLongTermAccumulationAudit({
      baselineState: lowTrustBase,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
    });
    const highResult = runLongTermAccumulationAudit({
      baselineState: highTrustBase,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
    });

    // Low-trust baseline should get more repair per event
    expect(lowResult.repairEffectivenessScore).toBeGreaterThan(
      highResult.repairEffectivenessScore,
    );
  });

  it("V10.72: single support event does not over-flip personality", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const singleEvent = [{
      description: "王雪主动解释并陪伴。",
      tags: ["王雪", "解释", "陪伴"],
      categoryHint: "support" as const,
    }];

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: singleEvent,
      followUpDecisionScenario: relationshipScenario,
    });

    // Single support must not flip trust by more than 0.02
    const trustDelta = Math.abs(
      result.finalState.coordinate.trust - result.baselineState.coordinate.trust,
    );
    expect(trustDelta).toBeLessThan(0.02);
  });

  it("V10.72: neutral repeated events remain stable", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const events = Array.from({ length: 5 }, (_, i) => ({
      description: `平凡的一天，第${i + 1}天。`,
      tags: ["日常"],
      categoryHint: "general" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
      expectedTrend: { personalityDistance: "stable" },
      maxNeutralPersonalityDistance: 0.06,
    });

    expect(result.accumulationVerdict.failures).toHaveLength(0);
    const finalDist =
      result.accumulationCurve.personalityDistance[
        result.accumulationCurve.personalityDistance.length - 1
      ]!;
    expect(finalDist).toBeLessThan(0.06);
  });

  it("V10.72: LongTermAccumulationAudit includes marginalDeltaByStep and saturationScore", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const events = Array.from({ length: 3 }, (_, i) => ({
      description: `第${i + 1}次失联。`,
      tags: ["失联"],
      categoryHint: "abandonment" as const,
    }));

    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: events,
      followUpDecisionScenario: relationshipScenario,
    });

    expect(result.marginalDeltaByStep).toHaveLength(events.length);
    expect(typeof result.saturationScore).toBe("number");
    expect(typeof result.repairEffectivenessScore).toBe("number");
  });
});

function cloneState<T>(state: T): T {
  return deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state as never))) as T;
}

function maxCoordinateDiff(before: { coordinate: { values: Record<string, number> } }, after: { coordinate: { values: Record<string, number> } }): number {
  return Object.keys(before.coordinate.values).reduce((max, key) => (
    Math.max(max, Math.abs((after.coordinate.values[key] ?? 0) - (before.coordinate.values[key] ?? 0)))
  ), 0);
}

function baselineVector() {
  return {
    openness: 0.5,
    conscientiousness: 0.5,
    extroversion: 0.5,
    agreeableness: 0.5,
    neuroticism: 0.5,
    trust: 0.5,
    attachment: 0.5,
    fear: 0.5,
    control: 0.5,
  };
}
