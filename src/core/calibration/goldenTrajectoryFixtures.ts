import { createPsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { PersonaSeed, EnvironmentSeed } from "../differentiation/characterDifferentiation";
import { getEventCategoryPhysics, type EventCategory } from "../event/categoryPhysics";
import type { ExperienceEvent } from "../event/event";
import { defaultMetaState } from "../meta/metaState";
import type { PersonalityCoordinate, PersonalityCoordinateValues } from "../personality/coordinate";
import { createCharacterPhysicsState, type CharacterPhysicsState } from "../physics/physicsEngine";

export const GOLDEN_TRAJECTORY_HORIZONS = [1, 5, 20, 100] as const;
export type GoldenTrajectoryHorizon = typeof GOLDEN_TRAJECTORY_HORIZONS[number];

export const GOLDEN_EVENT_CATEGORIES: readonly EventCategory[] = [
  "abandonment",
  "support",
  "betrayal",
  "success",
  "failure",
  "rejection",
  "conflict",
  "fatigue",
  "uncertainty",
  "general",
];

export interface GoldenBaselineFixture {
  readonly id: "secure" | "sensitive" | "achievement" | "adaptive";
  readonly label: string;
  readonly persona: PersonaSeed;
  readonly createState: () => CharacterPhysicsState;
}

export interface GoldenScenarioFixture {
  readonly id: "relationship" | "study" | "social" | "action";
  readonly environment: EnvironmentSeed;
}

export interface GoldenEventExpectation {
  readonly category: EventCategory;
  readonly primaryDimensions: ReadonlyArray<{
    readonly dimension: keyof PersonalityCoordinateValues;
    readonly direction: "increase" | "decrease" | "minimal";
  }>;
  readonly relevantScenarios: readonly GoldenScenarioFixture["id"][];
  readonly maxSingleStepDistance: number;
  readonly maxLongHorizonDistance: number;
}

export const GOLDEN_BASELINES: readonly GoldenBaselineFixture[] = [
  baseline("secure", "Secure / resilient", {
    openness: 0.68,
    conscientiousness: 0.62,
    extroversion: 0.6,
    agreeableness: 0.7,
    neuroticism: 0.28,
    trust: 0.74,
    attachment: 0.48,
    fear: 0.24,
    control: 0.42,
  }, { capacity: 0.78, resilience: 0.78, integrity: 0.92, stressLoad: 0.08 }, {
    emotionalSensitivity: 0.35,
    resilience: 0.8,
    trustGrowthRate: 0.68,
    trustDecayRate: 0.3,
    traumaAmplification: 0.25,
  }),
  baseline("sensitive", "Attachment-sensitive", {
    openness: 0.4,
    conscientiousness: 0.54,
    extroversion: 0.3,
    agreeableness: 0.48,
    neuroticism: 0.76,
    trust: 0.3,
    attachment: 0.84,
    fear: 0.78,
    control: 0.65,
  }, { capacity: 0.5, resilience: 0.34, integrity: 0.76, stressLoad: 0.22 }, {
    emotionalSensitivity: 0.8,
    resilience: 0.34,
    trustGrowthRate: 0.3,
    trustDecayRate: 0.74,
    traumaAmplification: 0.72,
  }),
  baseline("achievement", "Achievement-oriented", {
    openness: 0.58,
    conscientiousness: 0.82,
    extroversion: 0.52,
    agreeableness: 0.5,
    neuroticism: 0.5,
    trust: 0.56,
    attachment: 0.42,
    fear: 0.45,
    control: 0.72,
  }, { capacity: 0.68, resilience: 0.58, integrity: 0.86, stressLoad: 0.14 }, {
    emotionalSensitivity: 0.5,
    resilience: 0.6,
    selfControl: 0.78,
    trustGrowthRate: 0.48,
    trustDecayRate: 0.48,
  }),
  baseline("adaptive", "Adaptive / exploratory", {
    openness: 0.8,
    conscientiousness: 0.58,
    extroversion: 0.66,
    agreeableness: 0.62,
    neuroticism: 0.34,
    trust: 0.64,
    attachment: 0.5,
    fear: 0.3,
    control: 0.38,
  }, { capacity: 0.74, resilience: 0.7, integrity: 0.9, stressLoad: 0.1 }, {
    emotionalSensitivity: 0.42,
    resilience: 0.72,
    curiosity: 0.82,
    trustGrowthRate: 0.58,
    trustDecayRate: 0.38,
  }),
];

export const GOLDEN_SCENARIOS: readonly GoldenScenarioFixture[] = [
  scenario("relationship", "关系中的回应不确定", "亲密对象暂时没有回应", "信任、依恋与边界反应"),
  scenario("study", "重要学习挑战", "一次高难度任务需要再次尝试", "能力感、失败解释与努力策略"),
  scenario("social", "新的社交接触", "一群不熟悉的人发出邀请", "开放、拒绝敏感与确认策略"),
  scenario("action", "现实执行任务", "有限精力下仍需完成行动", "能量、风险和执行能力"),
];

export const GOLDEN_EVENT_EXPECTATIONS: Readonly<Record<EventCategory, GoldenEventExpectation>> = {
  abandonment: expectation("abandonment", [["trust", "decrease"], ["fear", "increase"]], ["relationship", "social"]),
  support: expectation("support", [["trust", "increase"], ["fear", "decrease"]], ["relationship", "social"]),
  betrayal: expectation("betrayal", [["trust", "decrease"], ["agreeableness", "decrease"]], ["relationship", "social"]),
  success: expectation("success", [["conscientiousness", "increase"], ["fear", "decrease"]], ["study", "action"]),
  failure: expectation("failure", [["neuroticism", "increase"], ["fear", "increase"]], ["study", "action"]),
  rejection: expectation("rejection", [["trust", "decrease"], ["attachment", "increase"]], ["relationship", "social"]),
  conflict: expectation("conflict", [["control", "increase"], ["agreeableness", "decrease"]], ["relationship", "social"]),
  fatigue: expectation("fatigue", [["trust", "minimal"], ["conscientiousness", "minimal"]], ["action"]),
  uncertainty: expectation("uncertainty", [["fear", "increase"], ["trust", "minimal"]], ["relationship", "study", "social"]),
  general: expectation("general", [["trust", "minimal"], ["fear", "minimal"]], []),
};

export function buildGoldenEvent(
  category: EventCategory,
  index: number,
  params: { startAt?: string; spacingDays?: number; wordingSuffix?: string } = {},
): ExperienceEvent {
  const template = getEventCategoryPhysics(category);
  if (!template) throw new Error(`Missing event physics template for ${category}`);
  const occurredAt = addDays(params.startAt ?? "2026-01-01T00:00:00.000Z", index * (params.spacingDays ?? 7));
  const magnitude = eventMagnitude(category);
  return {
    id: `golden_${category}_${index}`,
    description: `${eventDescription(category)}${params.wordingSuffix ?? ""}`,
    tags: [category, "golden-calibration"],
    category,
    emotion: template.emotion,
    coordinateDelta: template.coordinateDelta,
    beliefEffect: template.beliefEffect,
    rationale: template.rationale,
    intensity: magnitude.intensity,
    importance: magnitude.importance,
    relationshipWeight: magnitude.relationshipWeight,
    expectationGap: magnitude.expectationGap,
    personalitySensitivity: magnitude.personalitySensitivity,
    occurredAt,
  };
}

function baseline(
  id: GoldenBaselineFixture["id"],
  label: string,
  values: PersonalityCoordinateValues,
  boundary: { capacity: number; resilience: number; integrity: number; stressLoad: number },
  metaOverrides: Partial<ReturnType<typeof defaultMetaState>>,
): GoldenBaselineFixture {
  const persona: PersonaSeed = {
    id: `golden-${id}`,
    name: label,
    group: "golden calibration",
    initialTraits: label,
    coreExperience: id === "sensitive" ? "关系中曾经历不稳定回应" : "拥有可解释的生活经验",
    dominantBelief: id === "secure" || id === "adaptive" ? "新证据可以修正旧判断" : "结果需要通过行动验证",
    needGap: id === "sensitive" ? "安全与确认" : id === "achievement" ? "胜任与控制" : "理解与成长",
    defaultDefense: id === "sensitive" ? "确认后再靠近" : id === "achievement" ? "提高控制和投入" : "观察并协商",
    risk: id === "sensitive" ? "把不确定解释为关系威胁" : "在压力下沿用既有策略",
    trust: id === "sensitive" ? "低到中" : "中到高",
    growth: "允许稳定的新证据逐步改变策略",
  };
  return {
    id,
    label,
    persona,
    createState: () => createCharacterPhysicsState({
      coordinate: coordinate(values),
      boundary: createPsychologicalBoundary(boundary),
      metaState: { ...defaultMetaState(), ...metaOverrides },
    }),
  };
}

function scenario(
  id: GoldenScenarioFixture["id"],
  name: string,
  stressor: string,
  testFocus: string,
): GoldenScenarioFixture {
  return {
    id,
    environment: {
      id: `golden-${id}`,
      name,
      trigger: name,
      stressor,
      testFocus,
    },
  };
}

function expectation(
  category: EventCategory,
  dimensions: readonly [keyof PersonalityCoordinateValues, "increase" | "decrease" | "minimal"][],
  relevantScenarios: readonly GoldenScenarioFixture["id"][],
): GoldenEventExpectation {
  return {
    category,
    primaryDimensions: dimensions.map(([dimension, direction]) => ({ dimension, direction })),
    relevantScenarios,
    maxSingleStepDistance: category === "general" ? 0.01 : 0.08,
    maxLongHorizonDistance: category === "general" ? 0.12 : 1.25,
  };
}

function coordinate(values: PersonalityCoordinateValues): PersonalityCoordinate {
  return { values: { ...values } };
}

function eventMagnitude(category: EventCategory): {
  intensity: number;
  importance: number;
  relationshipWeight: number;
  expectationGap: number;
  personalitySensitivity: number;
} {
  if (category === "general") return { intensity: 0.06, importance: 0.06, relationshipWeight: 0, expectationGap: 0.02, personalitySensitivity: 0.1 };
  if (category === "fatigue" || category === "uncertainty") return { intensity: 0.48, importance: 0.5, relationshipWeight: 0.15, expectationGap: 0.35, personalitySensitivity: 0.5 };
  if (category === "support" || category === "success") return { intensity: 0.7, importance: 0.72, relationshipWeight: 0.7, expectationGap: 0.55, personalitySensitivity: 0.7 };
  if (category === "abandonment" || category === "betrayal") return { intensity: 0.84, importance: 0.88, relationshipWeight: 0.92, expectationGap: 0.82, personalitySensitivity: 0.9 };
  return { intensity: 0.68, importance: 0.72, relationshipWeight: 0.62, expectationGap: 0.58, personalitySensitivity: 0.75 };
}

function eventDescription(category: EventCategory): string {
  const descriptions: Record<EventCategory, string> = {
    abandonment: "An important person became unavailable without explanation.",
    support: "A trusted person offered steady and concrete support.",
    betrayal: "A trusted person broke an important agreement.",
    success: "Sustained effort produced a meaningful success.",
    failure: "An important attempt ended in failure despite effort.",
    rejection: "A social approach was clearly rejected.",
    conflict: "A disagreement escalated into direct conflict.",
    fatigue: "Extended effort produced significant physical fatigue.",
    uncertainty: "Important information remained incomplete and uncertain.",
    general: "An ordinary neutral detail was observed.",
  };
  return descriptions[category];
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}
