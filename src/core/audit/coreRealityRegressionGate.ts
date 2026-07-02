import { runRealityAuditSuite, type RealityAuditSuiteResult } from "./realityAudit";
import { runLongTermAccumulationAudit, type LongTermAccumulationAuditResult } from "./longTermAccumulationAudit";
import { runEventTypeCoverageAudit, type EventTypeCoverageAuditResult } from "./eventTypeCoverageAudit";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../character/characterBlueprint";
import { createCharacterPhysicsState } from "../physics/physicsEngine";
import { neutralCoordinate } from "../personality/coordinate";
import { classifyWarnings, getKnownWarningSummary, type WarningRegistryResult } from "./knownWarningRegistry";

export type GateVerdictLevel = "PASS" | "WARN" | "FAIL";

export interface GateConfig {
  /** Whether to require all suites to pass (default true). */
  requireAllPass?: boolean;
  /** Maximum allowed personality distance for neutral events. */
  maxNeutralPersonalityDistance?: number;
  /** Maximum allowed boundaryDelta for positive support events. */
  maxSupportBoundaryDelta?: number;
  /** Whether support boundary over-response is a FAIL (default true). */
  failOnSupportBoundaryOverResponse?: boolean;
  /** Minimum trust repair over 5 support events to avoid WARN. */
  minSupportTrustRepair?: number;
  /** Required event type categories (default all 10). */
  requiredEventCategories?: string[];
}

export interface SuiteFailure {
  suite: string;
  caseId?: string;
  message: string;
}

export interface RegressionRisk {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  guardedBy: string;
}

export interface CoreRealityGateResult {
  version: string;
  startedAt: string;
  completedAt: string;
  config: GateConfig;
  suites: {
    realityAudit: RealityAuditSuiteResult;
    longTermAccumulation: {
      betrayalAccumulation: LongTermAccumulationAuditResult;
      supportAccumulation: LongTermAccumulationAuditResult;
      neutralAccumulation: LongTermAccumulationAuditResult;
    };
    eventTypeCoverage: EventTypeCoverageAuditResult;
  };
  summary: {
    totalChecks: number;
    passed: number;
    warned: number;
    failed: number;
    realityAuditPassed: boolean;
    accumulationPassed: boolean;
    coveragePassed: boolean;
    decisionResponsivenessPassed: boolean;
    explanationGrounded: boolean;
    supportBoundarySafe: boolean;
    neutralStable: boolean;
  };
  failures: SuiteFailure[];
  warnings: SuiteFailure[];
  regressionRisks: RegressionRisk[];
  warningRegistry: WarningRegistryResult;
  knownWarningSummary: ReturnType<typeof getKnownWarningSummary>;
  gateVerdict: {
    level: GateVerdictLevel;
    passed: boolean;
    reasons: string[];
    allowedWarnings: string[];
    knownLimitations: string[];
  };
  requiredForRelease: boolean;
}

export function runCoreRealityRegressionGate(config: GateConfig = {}): CoreRealityGateResult {
  const startedAt = new Date().toISOString();
  const cfg = normalizeConfig(config);
  const failures: SuiteFailure[] = [];
  const warnings: SuiteFailure[] = [];
  const risks: RegressionRisk[] = [];

  // ── Suite 1: Reality Audit ──
  const realityAudit = runRealityAuditSuite();

  for (const c of realityAudit.cases) {
    if (c.auditVerdict.level === "FAIL") {
      failures.push({ suite: "realityAudit", caseId: c.id, message: `case ${c.id} FAIL: ${c.auditVerdict.failures.join("; ")}` });
    }
    if (c.auditVerdict.level === "WARN") {
      warnings.push({ suite: "realityAudit", caseId: c.id, message: `case ${c.id} WARN: ${c.auditVerdict.warnings.join("; ")}` });
    }
    // Check decision responsiveness
    if (c.decisionResponsiveness.verdict === "FAIL") {
      failures.push({ suite: "realityAudit", caseId: c.id, message: `decision responsiveness FAIL` });
    }
    // Check explanation grounding
    if (c.explanationTrace.groundedDeltaPaths.length === 0) {
      failures.push({ suite: "realityAudit", caseId: c.id, message: `explanation not grounded` });
    }
  }

  // Counterfactual checks
  if (realityAudit.counterfactual.verdict.level === "FAIL") {
    failures.push({ suite: "realityAudit", caseId: "counterfactual", message: "counterfactual FAIL" });
  }
  if (realityAudit.personalityDifferentiation.verdict.level === "FAIL") {
    failures.push({ suite: "realityAudit", caseId: "personalityDiff", message: "personality differentiation FAIL" });
  }

  // ── Suite 2: Long-Term Accumulation ──
  const sensitiveBase = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const secureBase = createCharacterPhysicsState({
    identity: { id: "secure_gate", name: "安稳", description: "高信任", tags: ["稳定"] },
    coordinate: {
      values: {
        ...neutralCoordinate().values,
        trust: 0.78, fear: 0.24, neuroticism: 0.28, attachment: 0.42,
        extroversion: 0.54, agreeableness: 0.62, control: 0.48,
      },
    },
    learningRate: 0.02,
  });

  const relationshipScenario = {
    id: "follow_up",
    definition: {
      id: "gate_relationship", name: "关系场景",
      trigger: "王雪第二天只回了一句刚看到。",
      stressor: "亲密关系解释缺失",
      testFocus: "信任 / 安全感 / 行为策略",
    },
  };

  const betrayalAccumulation = runLongTermAccumulationAudit({
    baselineState: sensitiveBase,
    eventSequence: Array.from({ length: 5 }, (_, i) => ({
      description: `亲近的人第${i + 1}次让他失望。`,
      tags: ["失联", "失望", "亲密关系"],
      categoryHint: "abandonment" as const,
    })),
    followUpDecisionScenario: relationshipScenario.definition,
    expectedTrend: { trust: "decreasing", fear: "increasing", personalityDistance: "growing" },
    label: "Gate: Repeated Abandonment",
  });

  const supportAccumulation = runLongTermAccumulationAudit({
    baselineState: sensitiveBase,
    eventSequence: Array.from({ length: 5 }, (_, i) => ({
      description: `王雪第${i + 1}次主动解释并陪伴。`,
      tags: ["王雪", "解释", "陪伴", "支持"],
      categoryHint: "support" as const,
    })),
    followUpDecisionScenario: relationshipScenario.definition,
    expectedTrend: { trust: "increasing", fear: "decreasing" },
    label: "Gate: Repeated Support",
  });

  const neutralAccumulation = runLongTermAccumulationAudit({
    baselineState: sensitiveBase,
    eventSequence: Array.from({ length: 5 }, (_, i) => ({
      description: `平凡第${i + 1}天。`,
      tags: ["日常"],
      categoryHint: "general" as const,
    })),
    followUpDecisionScenario: relationshipScenario.definition,
    expectedTrend: { personalityDistance: "stable" },
    maxNeutralPersonalityDistance: cfg.maxNeutralPersonalityDistance,
    label: "Gate: Repeated Neutral",
  });

  // Check accumulation verdicts
  for (const [label, result] of [
    ["betrayalAccumulation", betrayalAccumulation],
    ["supportAccumulation", supportAccumulation],
    ["neutralAccumulation", neutralAccumulation],
  ] as const) {
    if (result.accumulationVerdict.level === "FAIL") {
      failures.push({ suite: "accumulation", caseId: label, message: `${label} FAIL: ${result.accumulationVerdict.failures.join("; ")}` });
    }
    if (result.accumulationVerdict.level === "WARN") {
      warnings.push({ suite: "accumulation", caseId: label, message: `${label} WARN: ${result.accumulationVerdict.warnings.join("; ")}` });
    }
  }

  // Check neutral stability
  const neutralFinalDist = neutralAccumulation.accumulationCurve.personalityDistance[
    neutralAccumulation.accumulationCurve.personalityDistance.length - 1
  ] ?? 0;
  if (neutralFinalDist > cfg.maxNeutralPersonalityDistance!) {
    failures.push({
      suite: "accumulation",
      caseId: "neutralAccumulation",
      message: `neutral personality distance ${neutralFinalDist.toFixed(4)} > ${cfg.maxNeutralPersonalityDistance}`,
    });
  }

  // Check support boundary over-response (V10.70 regression)
  const positiveCase = realityAudit.cases.find((c) => c.id === "audit_counterfactual_positive_event");
  if (positiveCase) {
    const boundaryWarnings = positiveCase.impactCalibration.overResponseWarnings.filter(
      (w) => w.startsWith("boundaryDelta over-responded"),
    );
    if (boundaryWarnings.length > 0) {
      const msg = `V10.70 regression: support boundary over-response detected`;
      if (cfg.failOnSupportBoundaryOverResponse) {
        failures.push({ suite: "realityAudit", caseId: "positiveSupport", message: msg });
      } else {
        warnings.push({ suite: "realityAudit", caseId: "positiveSupport", message: msg });
      }
    }
  }

  // Check trust repair (V10.72 regression)
  const supportTrustRepair = Math.abs(
    supportAccumulation.finalState.coordinate.trust - supportAccumulation.baselineState.coordinate.trust,
  );
  if (supportTrustRepair < cfg.minSupportTrustRepair!) {
    warnings.push({
      suite: "accumulation",
      caseId: "supportAccumulation",
      message: `trust repair over 5 support events (${supportTrustRepair.toFixed(4)}) < minimum (${cfg.minSupportTrustRepair})`,
    });
  }

  // ── Suite 3: Event Type Coverage ──
  const coverageFixtures = buildCoverageFixtures();
  const coverageResult = runEventTypeCoverageAudit({
    fixtures: coverageFixtures,
    baselines: [
      { id: "sensitive", label: "敏感", state: sensitiveBase },
      { id: "secure", label: "高信任", state: secureBase },
    ],
    scenarios: [
      {
        id: "relationship",
        definition: {
          id: "gate_rel", name: "关系", trigger: "对方没有回复。",
          stressor: "亲密关系", testFocus: "关系 信任 安全感",
        },
      },
      {
        id: "study",
        definition: {
          id: "gate_study", name: "学业", trigger: "老师邀请参加考试。",
          stressor: "学业挑战", testFocus: "学业 能力 自尊",
        },
      },
      {
        id: "social",
        definition: {
          id: "gate_social", name: "社交", trigger: "聚会上有人问起近况。",
          stressor: "社交评价", testFocus: "社交 评价 自我呈现",
        },
      },
    ],
  });

  if (coverageResult.coverageVerdict.level === "FAIL") {
    failures.push({ suite: "coverage", message: `event type coverage FAIL: ${coverageResult.coverageVerdict.failures.join("; ")}` });
  }
  if (coverageResult.coverageVerdict.level === "WARN") {
    warnings.push({ suite: "coverage", message: `event type coverage WARN: ${coverageResult.coverageVerdict.warnings.join("; ")}` });
  }

  // Check required event type categories
  const coveredCategories = new Set(coverageResult.results.map((r) => r.eventType));
  for (const required of cfg.requiredEventCategories!) {
    if (!coveredCategories.has(required)) {
      failures.push({ suite: "coverage", message: `missing required event category: ${required}` });
    }
  }

  // ── Build regression risks ──
  risks.push(
    { id: "risk_boundary_overresponse", description: "Positive support events over-shifting boundary pressure (V10.70 regression)", severity: "high", guardedBy: "realityAudit.positiveSupport.boundaryDelta" },
    { id: "risk_force_linear_growth", description: "Repeated event force growing unbounded (V10.72 regression)", severity: "medium", guardedBy: "accumulation.saturationScore" },
    { id: "risk_trust_repair_failure", description: "Support events not producing visible trust repair (V10.72 regression)", severity: "medium", guardedBy: "accumulation.supportAccumulation.trust" },
    { id: "risk_neutral_overreaction", description: "Neutral events accumulating personality drift", severity: "high", guardedBy: "accumulation.neutralAccumulation.personalityDistance" },
    { id: "risk_decision_unresponsive", description: "State changed but decision surface unchanged", severity: "high", guardedBy: "realityAudit.decisionResponsiveness" },
    { id: "risk_explanation_ungrounded", description: "Explanation trace not referencing concrete delta paths", severity: "high", guardedBy: "realityAudit.explanationTrace" },
    { id: "risk_category_coverage_gap", description: "Event type category not covered by calibration", severity: "medium", guardedBy: "coverage.requiredEventCategories" },
    { id: "risk_personality_one_step_flip", description: "Single event causing large personality coordinate change", severity: "high", guardedBy: "accumulation.stepOneJumpRatios" },
  );

  // V10.77: classify warnings through known warning registry
  const rawWarningMessages = warnings.map((w) => w.message);
  const warningRegistry = classifyWarnings(rawWarningMessages);
  const knownWarningSummary = getKnownWarningSummary(rawWarningMessages);

  // ── Compute summary ──
  const suiteWarnings = warningRegistry.activeWarnings.length;

  const suiteFails = realityAudit.summary.fail +
    (betrayalAccumulation.accumulationVerdict.level === "FAIL" ? 1 : 0) +
    (supportAccumulation.accumulationVerdict.level === "FAIL" ? 1 : 0) +
    (neutralAccumulation.accumulationVerdict.level === "FAIL" ? 1 : 0) +
    (coverageResult.coverageVerdict.level === "FAIL" ? 1 : 0);

  const totalChecks = realityAudit.summary.total + 3 + 1; // reality + 3 accumulation + coverage

  const summary = {
    totalChecks,
    passed: totalChecks - suiteWarnings - suiteFails,
    warned: suiteWarnings,
    failed: suiteFails,
    realityAuditPassed: realityAudit.summary.fail === 0,
    accumulationPassed: betrayalAccumulation.accumulationVerdict.passed && supportAccumulation.accumulationVerdict.passed && neutralAccumulation.accumulationVerdict.passed,
    coveragePassed: coverageResult.coverageVerdict.passed,
    decisionResponsivenessPassed: realityAudit.cases.every((c) => c.decisionResponsiveness.verdict !== "FAIL"),
    explanationGrounded: realityAudit.cases.every((c) => c.explanationTrace.groundedDeltaPaths.length > 0),
    supportBoundarySafe: !failures.some((f) => f.message.includes("support boundary over-response")),
    neutralStable: neutralFinalDist <= cfg.maxNeutralPersonalityDistance!,
  };

  // ── Gate verdict ──
  const gateFailures = failures.length > 0;
  // V10.77: only active (unknown/unmatched) warnings count toward WARN verdict.
  // Allowed warnings are documented and do not block release.
  const activeWarningCount = warningRegistry.activeWarnings.length;
  const gateWarnings = activeWarningCount > 0;
  const level: GateVerdictLevel = gateFailures ? "FAIL" : gateWarnings ? "WARN" : "PASS";

  const knownLimitations: string[] = [];
  if (betrayalAccumulation.accumulationVerdict.warnings.some((w) => w.includes("linear"))) {
    knownLimitations.push("V10.72: residual near-linear personality growth in repeated abandonment (documented)");
  }

  const gateVerdict = {
    level,
    passed: !gateFailures,
    reasons: [
      `Reality Audit: ${realityAudit.summary.pass}P/${realityAudit.summary.warn}W/${realityAudit.summary.fail}F`,
      `Accumulation: betrayal=${betrayalAccumulation.accumulationVerdict.level}, support=${supportAccumulation.accumulationVerdict.level}, neutral=${neutralAccumulation.accumulationVerdict.level}`,
      `Coverage: ${coverageResult.coverageVerdict.level}`,
      `Decision responsiveness: ${summary.decisionResponsivenessPassed ? "PASS" : "FAIL"}`,
      `Explanation grounded: ${summary.explanationGrounded}`,
      `Support boundary: ${summary.supportBoundarySafe ? "safe" : "REGRESSION"}`,
      `Neutral stable: ${summary.neutralStable}`,
    ],
    allowedWarnings: warnings.map((w) => w.message),
    knownLimitations,
  };

  return {
    version: "10.77.0",
    startedAt,
    completedAt: new Date().toISOString(),
    config: cfg,
    suites: {
      realityAudit,
      longTermAccumulation: {
        betrayalAccumulation,
        supportAccumulation,
        neutralAccumulation,
      },
      eventTypeCoverage: coverageResult,
    },
    summary,
    failures: failures.map((f) => ({ ...f })),
    warnings: warnings.map((w) => ({ ...w })),
    warningRegistry,
    knownWarningSummary,
    regressionRisks: risks,
    gateVerdict,
    requiredForRelease: true,
  };
}

function normalizeConfig(config: GateConfig): Required<GateConfig> {
  return {
    requireAllPass: config.requireAllPass ?? true,
    maxNeutralPersonalityDistance: config.maxNeutralPersonalityDistance ?? 0.06,
    maxSupportBoundaryDelta: config.maxSupportBoundaryDelta ?? 0.3,
    failOnSupportBoundaryOverResponse: config.failOnSupportBoundaryOverResponse ?? true,
    minSupportTrustRepair: config.minSupportTrustRepair ?? 0.005,
    requiredEventCategories: config.requiredEventCategories ?? [
      "abandonment", "betrayal", "support", "success",
      "failure", "rejection", "conflict", "fatigue", "uncertainty", "neutral",
    ],
  };
}

function buildCoverageFixtures(): Parameters<typeof runEventTypeCoverageAudit>[0]["fixtures"] {
  return [
    { eventType: "abandonment", label: "失联", eventInput: { description: "王雪突然失联。", tags: ["失联", "等待"], categoryHint: "abandonment" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["relationship"], irrelevantScenarios: ["study"] },
    { eventType: "betrayal", label: "背叛", eventInput: { description: "朋友泄密导致他被嘲笑。", tags: ["背叛", "欺骗"], categoryHint: "betrayal" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["relationship"], irrelevantScenarios: ["study"] },
    { eventType: "support", label: "支持", eventInput: { description: "王雪主动解释并陪伴。", tags: ["解释", "陪伴", "支持"], categoryHint: "support" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["relationship"], irrelevantScenarios: ["study"] },
    { eventType: "success", label: "成功", eventInput: { description: "被公开表扬。", tags: ["成功", "认可"], categoryHint: "success" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["study"], irrelevantScenarios: ["relationship"] },
    { eventType: "failure", label: "失败", eventInput: { description: "项目被否决。", tags: ["失败", "被否定"], categoryHint: "failure" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["study"], irrelevantScenarios: ["relationship"] },
    { eventType: "rejection", label: "拒绝", eventInput: { description: "被朋友冷淡拒绝。", tags: ["拒绝", "冷淡"], categoryHint: "rejection" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["relationship", "social"], irrelevantScenarios: ["study"] },
    { eventType: "conflict", label: "冲突", eventInput: { description: "被同事公开指责。", tags: ["冲突", "指责"], categoryHint: "conflict" }, expectedProfiles: [{ channel: "memoryImpact" as const, expectedDirection: "increase" as const, rationale: "" }], relevantScenarios: ["social"], irrelevantScenarios: [] },
    { eventType: "fatigue", label: "疲劳", eventInput: { description: "昨晚只睡了四小时。", tags: ["疲劳", "睡眠不足"], categoryHint: "fatigue" }, expectedProfiles: [{ channel: "personalityCoordinateDelta" as const, expectedDirection: "minimal" as const, rationale: "" }], relevantScenarios: [], irrelevantScenarios: ["relationship"] },
    { eventType: "uncertainty", label: "模糊信号", eventInput: { description: "对方回复模棱两可。", tags: ["不确定", "模糊"], categoryHint: "uncertainty" }, expectedProfiles: [{ channel: "personalityCoordinateDelta" as const, expectedDirection: "minimal" as const, rationale: "" }], relevantScenarios: ["relationship"], irrelevantScenarios: [] },
    { eventType: "neutral", label: "日常", eventInput: { description: "路过便利店看到新海报。", tags: ["日常", "路过"], categoryHint: "general" }, expectedProfiles: [{ channel: "personalityCoordinateDelta" as const, expectedDirection: "minimal" as const, rationale: "" }], relevantScenarios: [], irrelevantScenarios: ["relationship", "study", "social"] },
  ];
}
