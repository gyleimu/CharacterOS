import { describe, expect, it } from "vitest";
import {
  activateSchemas,
  buildDifferentiatedDecision,
  deriveBehaviorStrategies,
  deriveDesireProfile,
  deriveNeedProfile,
  type EnvironmentSeed,
  type PersonaSeed,
} from "../../../src/core/differentiation/characterDifferentiation";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";
import { defaultMetaState } from "../../../src/core/meta/metaState";

function makeState(overrides: { trust?: number; fear?: number; control?: number; resilience?: number } = {}) {
  const coordinate = neutralCoordinate();
  coordinate.values.trust = overrides.trust ?? 0.35;
  coordinate.values.fear = overrides.fear ?? 0.7;
  coordinate.values.control = overrides.control ?? 0.5;
  const metaState = defaultMetaState();
  metaState.resilience = overrides.resilience ?? 0.35;
  return createCharacterPhysicsState({ coordinate, metaState });
}

const ventureEnvironment: EnvironmentSeed = {
  id: "ENV_TEST_001",
  name: "高回报合作邀约",
  trigger: "陌生人提出高收益合作，但要求先投入资源。",
  stressor: "高收益承诺与投入风险",
  testFocus: "信任、资源、风险选择",
};

const betrayalPersona: PersonaSeed = {
  id: "PID_TEST_BETRAYAL",
  name: "被背叛后的低信任者",
  group: "创伤防御",
  initialTraits: "谨慎、低信任、需要证据",
  coreExperience: "曾经被背叛和欺骗，关系中很难再次相信承诺。",
  dominantBelief: "没有证据的承诺都可能是陷阱。",
  needGap: "安全感、证据感、退出权",
  defaultDefense: "先验证再靠近",
  risk: "高",
  trust: "低",
  growth: "防御期",
};

const scarcityPersona: PersonaSeed = {
  id: "PID_TEST_SCARCITY",
  name: "贫困经历后的资源保护者",
  group: "匮乏防御",
  initialTraits: "节制、保守、害怕失去安全垫",
  coreExperience: "童年长期贫困，任何损失都会被体验为生存威胁。",
  dominantBelief: "资源一旦失去就很难回来。",
  needGap: "资源安全、损失控制、低风险恢复",
  defaultDefense: "保护资源",
  risk: "高",
  trust: "中低",
  growth: "觉察期",
};

const idealistPersona: PersonaSeed = {
  id: "PID_TEST_IDEALIST",
  name: "价值驱动的理想主义者",
  group: "意义驱动",
  initialTraits: "理想主义、重视道德一致性",
  coreExperience: "曾经因为坚持价值而得到修复和成长。",
  dominantBelief: "值得的事情可以承担有限风险。",
  needGap: "意义感、道德一致性、成长",
  defaultDefense: "价值审查",
  risk: "中",
  trust: "中高",
  growth: "整合期",
};

describe("characterDifferentiation", () => {
  it("activates trauma-specific schemas from persona and environment", () => {
    const schemas = activateSchemas({
      persona: betrayalPersona,
      environment: ventureEnvironment,
      state: makeState({ trust: 0.22, fear: 0.82 }),
    });

    expect(schemas.map((schema) => schema.id)).toContain("betrayal_schema");
    expect(schemas.map((schema) => schema.id)).toContain("safety_seeking_schema");
    expect(schemas[0]!.intensity).toBeGreaterThan(0.5);
  });

  it("derives distinct need and desire profiles from schemas", () => {
    const schemas = activateSchemas({
      persona: scarcityPersona,
      environment: ventureEnvironment,
      state: makeState({ trust: 0.42, fear: 0.74 }),
    });
    const needs = deriveNeedProfile({ schemas, persona: scarcityPersona, environment: ventureEnvironment });
    const desires = deriveDesireProfile({ schemas, needs });

    expect(needs.map((need) => need.label)).toContain("资源安全");
    expect(desires.some((desire) => desire.intent.includes("匮乏") || desire.label.includes("损失"))).toBe(true);
  });

  it("selects different strategies for different personas in the same environment", () => {
    const state = makeState();
    const betrayalDecision = buildDifferentiatedDecision({
      persona: betrayalPersona,
      environment: ventureEnvironment,
      state,
    });
    const scarcityDecision = buildDifferentiatedDecision({
      persona: scarcityPersona,
      environment: ventureEnvironment,
      state,
    });
    const idealistDecision = buildDifferentiatedDecision({
      persona: idealistPersona,
      environment: ventureEnvironment,
      state: makeState({ trust: 0.68, fear: 0.35, resilience: 0.78 }),
    });

    expect(new Set([
      betrayalDecision.selectedStrategy.id,
      scarcityDecision.selectedStrategy.id,
      idealistDecision.selectedStrategy.id,
    ]).size).toBeGreaterThanOrEqual(2);
    expect(betrayalDecision.actionSurface.action).not.toEqual(scarcityDecision.actionSurface.action);
  });

  it("uses diversity penalties to avoid repeating the same strategy as the only answer", () => {
    const schemas = activateSchemas({
      persona: betrayalPersona,
      environment: ventureEnvironment,
      state: makeState({ trust: 0.2, fear: 0.84 }),
    });
    const needs = deriveNeedProfile({ schemas, persona: betrayalPersona, environment: ventureEnvironment });
    const desires = deriveDesireProfile({ schemas, needs });
    const strategies = deriveBehaviorStrategies({
      schemas,
      needs,
      desires,
      persona: betrayalPersona,
      environment: ventureEnvironment,
      previousStrategiesInEnvironment: ["verify_before_commitment"],
    });

    expect(strategies.length).toBeGreaterThan(1);
    expect(strategies[0]!.id).not.toEqual("verify_before_commitment");
  });

  it("builds an action surface with explicit causal chain references", () => {
    const decision = buildDifferentiatedDecision({
      persona: betrayalPersona,
      environment: ventureEnvironment,
      state: makeState({ trust: 0.2, fear: 0.84 }),
    });

    expect(decision.actionSurface.action).toContain(ventureEnvironment.name);
    expect(decision.actionSurface.reason).toContain(decision.schemas[0]!.label);
    expect(decision.actionSurface.reason).toContain(decision.needs[0]!.label);
    expect(decision.actionSurface.templatePenalty).toBeLessThan(0.2);
  });
});
