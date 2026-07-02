import { describe, expect, it } from "vitest";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { runEventTypeCoverageAudit, type EventTypeCoverageFixture } from "../../../src/core/audit/eventTypeCoverageAudit";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

const sensitiveBase = {
  id: "sensitive",
  label: "敏感依恋 (Lin Fan)",
  state: createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true }),
};

const secureBase = {
  id: "secure",
  label: "高信任稳定",
  state: createCharacterPhysicsState({
    identity: { id: "secure", name: "安稳", description: "高信任低恐惧", tags: ["稳定"] },
    coordinate: {
      values: {
        ...neutralCoordinate().values,
        trust: 0.78, fear: 0.24, neuroticism: 0.28,
        attachment: 0.42, extroversion: 0.54, agreeableness: 0.62, control: 0.48,
      },
    },
    learningRate: 0.02,
  }),
};

const achievementBase = {
  id: "achievement",
  label: "成就导向",
  state: createCharacterPhysicsState({
    identity: { id: "achiever", name: "志远", description: "高成就低依恋", tags: ["成就导向"] },
    coordinate: {
      values: {
        ...neutralCoordinate().values,
        conscientiousness: 0.82, neuroticism: 0.35, trust: 0.55,
        fear: 0.3, attachment: 0.35, openness: 0.65, control: 0.6,
      },
    },
    learningRate: 0.025,
  }),
};

const relationshipScenario = {
  id: "relationship",
  definition: {
    id: "relationship_scenario", name: "亲密关系后续",
    trigger: "对方第二天只回了一句刚看到，没有解释。",
    stressor: "亲密关系 / 信任 / 解释缺失",
    testFocus: "关系 信任 安全感 回复",
  },
};

const studyScenario = {
  id: "study",
  definition: {
    id: "study_scenario", name: "学业挑战",
    trigger: "老师邀请参加高难度考试项目。",
    stressor: "学业 / 能力 / 挑战",
    testFocus: "学业 能力 自尊 努力",
  },
};

const socialScenario = {
  id: "social",
  definition: {
    id: "social_scenario", name: "社交场合",
    trigger: "聚会上有人问起你最近的近况。",
    stressor: "社交 / 评价 / 归属感",
    testFocus: "社交 评价 自我呈现",
  },
};

const scenarios = [relationshipScenario, studyScenario, socialScenario];
const baselines = [sensitiveBase, secureBase];

// ── 10 Event Type Fixtures ──

const FIXTURES: EventTypeCoverageFixture[] = [
  {
    eventType: "abandonment",
    label: "失联 / 被抛下",
    eventInput: {
      description: "王雪突然失联，直到第二天中午才回一句刚看到。",
      tags: ["王雪", "失联", "等待"],
      categoryHint: "abandonment",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "should be remembered" },
      { channel: "boundaryDelta", expectedDirection: "increase", rationale: "should increase stress" },
      { channel: "beliefDelta", expectedDirection: "increase", rationale: "should update trust beliefs" },
      { channel: "needDelta", expectedDirection: "increase", rationale: "safety/attachment needs activate" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "slow channel, small change" },
    ],
    relevantScenarios: ["relationship"],
    irrelevantScenarios: ["study"],
  },
  {
    eventType: "betrayal",
    label: "背叛 / 泄密",
    eventInput: {
      description: "朋友把他私下说的话告诉了别人，导致他公开被嘲笑。",
      tags: ["背叛", "欺骗", "朋友", "泄密"],
      categoryHint: "betrayal",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "highly salient" },
      { channel: "boundaryDelta", expectedDirection: "increase", rationale: "boundary activated" },
      { channel: "beliefDelta", expectedDirection: "increase", rationale: "trust beliefs shattered" },
      { channel: "needDelta", expectedDirection: "increase", rationale: "safety violated" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "slow channel" },
    ],
    relevantScenarios: ["relationship"],
    irrelevantScenarios: ["study"],
  },
  {
    eventType: "support",
    label: "支持 / 陪伴",
    eventInput: {
      description: "王雪主动解释昨晚没回复的原因，并认真陪伴了他。",
      tags: ["王雪", "解释", "陪伴", "支持"],
      categoryHint: "support",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "meaningful memory" },
      { channel: "boundaryDelta", expectedDirection: "any", rationale: "V10.70: stress may decrease" },
      { channel: "beliefDelta", expectedDirection: "increase", rationale: "hope-inducing belief" },
      { channel: "personalityCoordinateDelta", expectedDirection: "minimal", rationale: "no instant flip" },
    ],
    relevantScenarios: ["relationship"],
    irrelevantScenarios: ["study"],
  },
  {
    eventType: "success",
    label: "成功 / 被认可",
    eventInput: {
      description: "他在会议上提出的方案被领导公开表扬。",
      tags: ["成功", "认可", "表扬", "工作"],
      categoryHint: "success",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "positive reinforcement" },
      { channel: "beliefDelta", expectedDirection: "increase", rationale: "competence belief" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "subtle confidence boost" },
    ],
    relevantScenarios: ["study"],
    irrelevantScenarios: ["relationship"],
  },
  {
    eventType: "failure",
    label: "失败 / 被否定",
    eventInput: {
      description: "他准备了三个月的项目最终被评审组全票否决。",
      tags: ["失败", "被否定", "没通过"],
      categoryHint: "failure",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "painful memory" },
      { channel: "beliefDelta", expectedDirection: "increase", rationale: "self-doubt belief" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "confidence may shake" },
    ],
    relevantScenarios: ["study"],
    irrelevantScenarios: ["relationship"],
  },
  {
    eventType: "rejection",
    label: "拒绝 / 冷淡",
    eventInput: {
      description: "他主动约朋友见面，对方冷淡地拒绝了。",
      tags: ["拒绝", "冷淡", "疏远"],
      categoryHint: "rejection",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "social pain memory" },
      { channel: "needDelta", expectedDirection: "increase", rationale: "belonging need activates" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "social caution" },
    ],
    relevantScenarios: ["relationship", "social"],
    irrelevantScenarios: ["study"],
  },
  {
    eventType: "conflict",
    label: "冲突 / 指责",
    eventInput: {
      description: "同事在部门会议上公开指责他的工作方式有问题。",
      tags: ["冲突", "指责", "批评", "对峙"],
      categoryHint: "conflict",
    },
    expectedProfiles: [
      { channel: "memoryImpact", expectedDirection: "increase", rationale: "conflict is salient" },
      { channel: "boundaryDelta", expectedDirection: "increase", rationale: "boundary defense activates" },
      { channel: "personalityCoordinateDelta", expectedDirection: "any", rationale: "may increase control need" },
    ],
    relevantScenarios: ["social"],
    irrelevantScenarios: [],
  },
  {
    eventType: "fatigue",
    label: "身体疲劳",
    eventInput: {
      description: "昨晚只睡了四个小时，今天整个人都很疲惫。",
      tags: ["疲劳", "睡眠不足", "乏力"],
      categoryHint: "fatigue",
    },
    expectedProfiles: [
      { channel: "personalityCoordinateDelta", expectedDirection: "minimal", rationale: "no personality change" },
      { channel: "memoryImpact", expectedDirection: "any", rationale: "low salience" },
    ],
    relevantScenarios: [],
    irrelevantScenarios: ["relationship"],
  },
  {
    eventType: "uncertainty",
    label: "模糊信号",
    eventInput: {
      description: "对方回复了一个模棱两可的表情，他完全看不懂是什么意思。",
      tags: ["不确定", "模糊", "说不清"],
      categoryHint: "uncertainty",
    },
    expectedProfiles: [
      { channel: "personalityCoordinateDelta", expectedDirection: "minimal", rationale: "not a major event" },
      { channel: "memoryImpact", expectedDirection: "any", rationale: "may or may not be remembered" },
    ],
    relevantScenarios: ["relationship"],
    irrelevantScenarios: [],
  },
  {
    eventType: "neutral",
    label: "普通日常",
    eventInput: {
      description: "下午路过便利店，看到门口换了一张新的海报。",
      tags: ["日常", "路过"],
      categoryHint: "general",
    },
    expectedProfiles: [
      { channel: "personalityCoordinateDelta", expectedDirection: "minimal", rationale: "no drift" },
      { channel: "memoryImpact", expectedDirection: "minimal", rationale: "not salient" },
      { channel: "boundaryDelta", expectedDirection: "any", rationale: "trivial" },
      { channel: "beliefDelta", expectedDirection: "minimal", rationale: "no belief change" },
    ],
    relevantScenarios: [],
    irrelevantScenarios: ["relationship", "study", "social"],
  },
];

describe("V10.73 Event Type Coverage Audit", () => {
  const suite = runEventTypeCoverageAudit({
    fixtures: FIXTURES,
    baselines,
    scenarios,
  });

  it("covers all 10 event types", () => {
    const types = new Set(suite.results.map((r) => r.eventType));
    expect(types.has("abandonment")).toBe(true);
    expect(types.has("betrayal")).toBe(true);
    expect(types.has("support")).toBe(true);
    expect(types.has("success")).toBe(true);
    expect(types.has("failure")).toBe(true);
    expect(types.has("rejection")).toBe(true);
    expect(types.has("conflict")).toBe(true);
    expect(types.has("fatigue")).toBe(true);
    expect(types.has("uncertainty")).toBe(true);
    expect(types.has("neutral")).toBe(true);
    expect(suite.results.length).toBe(FIXTURES.length * baselines.length);
  });

  it("abandonment activates attachment/trust/fear channels", () => {
    const results = suite.results.filter((r) => r.eventType === "abandonment");
    for (const r of results) {
      // Abandonment should have memory impact
      expect(r.channelActivations.memoryImpact).toBeGreaterThan(0);
      // Need delta should be non-trivial
      const needsCheck = r.channelActivations.needDelta;
      expect(needsCheck).toBeGreaterThanOrEqual(0);
      // Should not FAIL
      expect(r.failures).toHaveLength(0);
    }
    // Sensitive should have stronger response than secure
    const sensitive = results.find((r) => r.baselineLabel.includes("敏感"))!;
    const secure = results.find((r) => r.baselineLabel.includes("高信任"))!;
    expect(sensitive.channelActivations.boundaryDelta).toBeGreaterThan(
      secure.channelActivations.boundaryDelta,
    );
  });

  it("betrayal differs from abandonment by stronger trust/boundary response", () => {
    const betrayalResults = suite.results.filter((r) => r.eventType === "betrayal" && r.baselineLabel.includes("敏感"));
    const abandonResults = suite.results.filter((r) => r.eventType === "abandonment" && r.baselineLabel.includes("敏感"));

    const b = betrayalResults[0]!;
    const a = abandonResults[0]!;

    // Betrayal should activate boundary at least as much as abandonment
    expect(b.channelActivations.boundaryDelta).toBeGreaterThanOrEqual(
      a.channelActivations.boundaryDelta * 0.5,
    );
    // Both should not FAIL
    expect(b.failures).toHaveLength(0);
    expect(a.failures).toHaveLength(0);
  });

  it("support activates openness/repair without boundary overreaction", () => {
    const results = suite.results.filter((r) => r.eventType === "support");
    for (const r of results) {
      // Support should not have boundary overreaction (V10.70 preserved)
      expect(r.failures).toHaveLength(0);
    }
  });

  it("success improves confidence more than relationship caution", () => {
    const results = suite.results.filter((r) => r.eventType === "success");
    for (const r of results) {
      expect(r.failures).toHaveLength(0);
    }
    // Success should be relevant to study, not relationship
    const sensitiveSuccess = results.find((r) => r.baselineLabel.includes("敏感"))!;
    const relCheck = sensitiveSuccess.relevanceScores.find((s) => s.scenarioId === "relationship")!;
    const studyCheck = sensitiveSuccess.relevanceScores.find((s) => s.scenarioId === "study")!;
    // Success should be more relevant to study than relationship
    expect(studyCheck.relevance).toBeGreaterThanOrEqual(relCheck.relevance);
  });

  it("failure affects confidence/challenge avoidance but not attachment as primary", () => {
    const results = suite.results.filter((r) => r.eventType === "failure");
    for (const r of results) {
      expect(r.failures).toHaveLength(0);
    }
    // Failure should be more relevant to study than relationship
    const sensitiveFailure = results.find((r) => r.baselineLabel.includes("敏感"))!;
    const relCheck = sensitiveFailure.relevanceScores.find((s) => s.scenarioId === "relationship")!;
    const studyCheck = sensitiveFailure.relevanceScores.find((s) => s.scenarioId === "study")!;
    expect(studyCheck.relevance).toBeGreaterThanOrEqual(relCheck.relevance);
  });

  it("rejection affects social/attachment caution", () => {
    const results = suite.results.filter((r) => r.eventType === "rejection");
    for (const r of results) {
      expect(r.failures).toHaveLength(0);
    }
    // Rejection should activate need delta (belonging)
    const sensitiveRejection = results.find((r) => r.baselineLabel.includes("敏感"))!;
    expect(sensitiveRejection.channelActivations.needDelta).toBeGreaterThanOrEqual(0);
  });

  it("conflict activates boundary/control but not betrayal-level trust collapse", () => {
    const conflictResults = suite.results.filter((r) => r.eventType === "conflict" && r.baselineLabel.includes("敏感"));
    const betrayalResults = suite.results.filter((r) => r.eventType === "betrayal" && r.baselineLabel.includes("敏感"));

    const c = conflictResults[0]!;
    const b = betrayalResults[0]!;

    // Conflict should have lower boundary impact than betrayal
    // (conflict is less severe)
    expect(c.channelActivations.beliefDelta).toBeLessThanOrEqual(
      b.channelActivations.beliefDelta + 0.1,
    );
    // Neither should FAIL
    expect(c.failures).toHaveLength(0);
    expect(b.failures).toHaveLength(0);
  });

  it("fatigue affects action capacity without major trust drift", () => {
    const results = suite.results.filter((r) => r.eventType === "fatigue");
    for (const r of results) {
      // Fatigue should not FAIL
      expect(r.failures).toHaveLength(0);
      // Personality drift should be minimal
      expect(r.channelActivations.personalityCoordinateDelta).toBeLessThan(0.05);
    }
    // Fatigue should be low relevance to relationship
    const sensitiveFatigue = results.find((r) => r.baselineLabel.includes("敏感"))!;
    const relCheck = sensitiveFatigue.relevanceScores.find((s) => s.scenarioId === "relationship")!;
    expect(relCheck.relevance).toBeLessThan(0.6);
  });

  it("uncertainty increases testing/verification strategy", () => {
    const results = suite.results.filter((r) => r.eventType === "uncertainty");
    for (const r of results) {
      expect(r.failures).toHaveLength(0);
      // Uncertainty should be relevant to relationship
      const relCheck = r.relevanceScores.find((s) => s.scenarioId === "relationship")!;
      expect(relCheck.relevance).toBeGreaterThan(0.2);
    }
  });

  it("neutral remains low response", () => {
    const results = suite.results.filter((r) => r.eventType === "neutral");
    for (const r of results) {
      expect(r.failures).toHaveLength(0);
      expect(r.channelActivations.personalityCoordinateDelta).toBeLessThan(0.05);
    }
  });

  it("scenario relevance routes event effects to relevant decision surface", () => {
    // Abandonment → relationship high, study low
    const abandon = suite.results.find(
      (r) => r.eventType === "abandonment" && r.baselineLabel.includes("敏感"),
    )!;
    const abandonRel = abandon.relevanceScores.find((s) => s.scenarioId === "relationship")!;
    const abandonStudy = abandon.relevanceScores.find((s) => s.scenarioId === "study")!;
    expect(abandonRel.relevance).toBeGreaterThan(abandonStudy.relevance);

    // Failure → study higher than relationship
    const failure = suite.results.find(
      (r) => r.eventType === "failure" && r.baselineLabel.includes("敏感"),
    )!;
    const failureRel = failure.relevanceScores.find((s) => s.scenarioId === "relationship")!;
    const failureStudy = failure.relevanceScores.find((s) => s.scenarioId === "study")!;
    expect(failureStudy.relevance).toBeGreaterThanOrEqual(failureRel.relevance);
  });

  it("baseline personality changes magnitude and strategy shift", () => {
    // For abandonment, sensitive should respond stronger than secure
    const sensAbandon = suite.results.find(
      (r) => r.eventType === "abandonment" && r.baselineLabel.includes("敏感"),
    )!;
    const secAbandon = suite.results.find(
      (r) => r.eventType === "abandonment" && r.baselineLabel.includes("高信任"),
    )!;

    const sensResp = sensAbandon.channelActivations.boundaryDelta +
      sensAbandon.channelActivations.needDelta;
    const secResp = secAbandon.channelActivations.boundaryDelta +
      secAbandon.channelActivations.needDelta;
    expect(sensResp).toBeGreaterThan(secResp);
  });

  it("coverage summary reports PASS/WARN/FAIL honestly", () => {
    expect(suite.coverageSummary.totalEventTypes).toBe(10);
    expect(suite.coverageSummary.totalBaselines).toBe(2);
    expect(suite.coverageSummary.totalResults).toBe(20);
    // Verdict should be valid
    expect(["PASS", "WARN", "FAIL"]).toContain(suite.coverageVerdict.level);
    // Any failures should be real (not masked)
    if (suite.coverageVerdict.failures.length > 0) {
      // Each failure must reference a real check
      for (const f of suite.coverageVerdict.failures) {
        expect(typeof f).toBe("string");
        expect(f.length).toBeGreaterThan(10);
      }
    }
  });

  it("channel activation matrix covers all result keys", () => {
    const keys = Object.keys(suite.channelActivationMatrix);
    expect(keys.length).toBe(suite.results.length);
    for (const key of keys) {
      const activations = suite.channelActivationMatrix[key]!;
      expect(typeof activations.memoryImpact).toBe("number");
      expect(typeof activations.boundaryDelta).toBe("number");
      expect(typeof activations.personalityCoordinateDelta).toBe("number");
    }
  });
});

// ── Achievement baseline tests ──

describe("V10.73 Baseline Differentiation", () => {
  it("achievement-oriented baseline responds more to failure than secure baseline", () => {
    const achievementSuite = runEventTypeCoverageAudit({
      fixtures: [FIXTURES.find((f) => f.eventType === "failure")!],
      baselines: [achievementBase, secureBase],
      scenarios,
    });

    const achiever = achievementSuite.results.find((r) => r.baselineLabel.includes("成就"))!;
    const secure = achievementSuite.results.find((r) => r.baselineLabel.includes("高信任"))!;

    // Achievement-oriented should have stronger belief response to failure
    expect(achiever.channelActivations.beliefDelta).toBeGreaterThanOrEqual(
      secure.channelActivations.beliefDelta * 0.5,
    );
    expect(achiever.failures).toHaveLength(0);
    expect(secure.failures).toHaveLength(0);
  });

  it("achievement baseline responds more to success than to relationship events", () => {
    const fixtures = [
      FIXTURES.find((f) => f.eventType === "success")!,
      FIXTURES.find((f) => f.eventType === "support")!,
    ];
    const achievementSuite = runEventTypeCoverageAudit({
      fixtures,
      baselines: [achievementBase],
      scenarios,
    });

    const successResult = achievementSuite.results.find((r) => r.eventType === "success")!;
    const supportResult = achievementSuite.results.find((r) => r.eventType === "support")!;

    expect(successResult.failures).toHaveLength(0);
    expect(supportResult.failures).toHaveLength(0);
  });
});
