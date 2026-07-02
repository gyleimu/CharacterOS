import type { BeliefState } from "../belief/beliefState";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { NeedDeficiency } from "../need/needDeficiency";
import type { DesireState } from "../desire/desireState";
import type { LifeDecisionContext } from "./lifeDecisionContext";

export interface PersonaSeed {
  id: string;
  name: string;
  group: string;
  initialTraits: string;
  coreExperience: string;
  dominantBelief: string;
  needGap: string;
  defaultDefense: string;
  risk: string;
  trust: string;
  growth: string;
}

export interface EnvironmentSeed {
  id: string;
  name: string;
  trigger: string;
  stressor: string;
  testFocus: string;
}

export type ActivatedSchemaSource = "trait" | "experience" | "belief" | "need" | "environment";

export type ActivatedSchemaId =
  | "betrayal_schema"
  | "abandonment_schema"
  | "scarcity_schema"
  | "shame_schema"
  | "failure_identity_schema"
  | "control_loss_schema"
  | "authority_threat_schema"
  | "moral_conflict_schema"
  | "attachment_threat_schema"
  | "exploitation_schema"
  | "responsibility_overload_schema"
  | "freedom_constraint_schema"
  | "recognition_hunger_schema"
  | "competition_schema"
  | "idealism_schema"
  | "opportunistic_gain_schema"
  | "recovery_growth_schema"
  | "emotional_suppression_schema"
  | "revenge_correction_schema"
  | "safety_seeking_schema";

export interface ActivatedSchema {
  id: ActivatedSchemaId;
  label: string;
  intensity: number;
  source: ActivatedSchemaSource;
  matchedPersonaKeys: string[];
  matchedEnvironmentKeys: string[];
  coreInterpretation: string;
}

export interface NeedProfile {
  id: string;
  label: string;
  intensity: number;
  basedOnSchemas: ActivatedSchemaId[];
  reason: string;
}

export interface DesireProfile {
  id: string;
  label: string;
  intensity: number;
  basedOnSchemas: ActivatedSchemaId[];
  basedOnNeeds: string[];
  intent: string;
}

export type BehaviorStrategyId =
  | "verify_before_commitment"
  | "small_scale_trial"
  | "negotiate_control"
  | "demand_written_terms"
  | "delay_decision"
  | "direct_join"
  | "impulsive_join"
  | "moral_reject"
  | "resource_protective_refusal"
  | "emotional_withdrawal"
  | "attachment_checking"
  | "seek_support"
  | "confront_directly"
  | "appease_then_observe"
  | "overcompensate_to_prove_self"
  | "avoid_dependency"
  | "self_sacrifice"
  | "boundary_assertion"
  | "exploit_opportunity"
  | "reframe_as_growth"
  | "responsibility_first"
  | "freedom_preserving_choice"
  | "power_grab"
  | "fairness_correction"
  | "revenge_or_rectify";

export interface BehaviorStrategy {
  id: BehaviorStrategyId;
  label: string;
  direction: string;
  intensity: number;
  basedOnSchemas: ActivatedSchemaId[];
  basedOnNeeds: string[];
  basedOnDesires: string[];
  coreReason: string;
  actionIntent: string;
}

export interface ActionSurface {
  action: string;
  direction: string;
  strategyId: BehaviorStrategyId;
  reason: string;
  templatePenalty: number;
  referencesEnvironment: boolean;
  referencesPersona: boolean;
  referencesNeedOrDesire: boolean;
}

export interface DifferentiatedDecision {
  schemas: ActivatedSchema[];
  needs: NeedProfile[];
  desires: DesireProfile[];
  strategies: BehaviorStrategy[];
  selectedStrategy: BehaviorStrategy;
  actionSurface: ActionSurface;
  perception: string;
  emotion: string;
  memoryTrigger: string;
  belief: string;
  /** V10.15: Life signal influences on this decision (empty if no life context). */
  lifeInfluences: string[];
}

interface SchemaDefinition {
  id: ActivatedSchemaId;
  label: string;
  personaKeys: string[];
  environmentKeys: string[];
  needs: string[];
  desires: string[];
  interpretation: string;
}

const SCHEMAS: SchemaDefinition[] = [
  schema("betrayal_schema", "背叛图式", ["被背叛", "背叛", "欺骗", "泄露"], ["欺骗", "利用", "甩锅", "伤害", "复联"], ["安全感", "证据感", "可控感", "退出权"], ["核验对方是否可信", "保留退出机制", "避免再次被利用"], "先把靠近、机会或请求理解为潜在利用。"),
  schema("abandonment_schema", "遗弃图式", ["抛弃", "失联", "焦虑依恋", "孤独"], ["冷淡", "失联", "复联", "亲密"], ["关系稳定", "归属感", "安全感"], ["确认关系是否仍在", "避免再次被突然放下"], "不确定的关系信号会被读取成离开风险。"),
  schema("scarcity_schema", "匮乏图式", ["贫困", "资源", "匮乏", "稀缺"], ["金钱", "收益", "借钱", "高风险", "欠债"], ["资源安全", "损失控制", "低风险恢复"], ["保住现金流", "避免不可逆投入", "只接受小规模试水"], "任何机会都先被换算成最坏情况下的生存余量。"),
  schema("shame_schema", "羞耻图式", ["完美", "羞耻", "冒名", "低自我价值"], ["失败", "错误", "评价", "比较", "公开"], ["自尊保护", "避免羞耻", "被认可"], ["在准备充分前不暴露失败可能", "避免再次证明自己不够好"], "压力事件会先触发自我价值被否定的担忧。"),
  schema("failure_identity_schema", "失败身份图式", ["失败", "习得性无助", "悲观", "长期失败"], ["失败", "高风险", "挑战", "机会"], ["成就感", "低风险恢复", "自尊保护"], ["降低再次失败的可见度", "寻找可控的小成功"], "新任务会被旧失败身份过滤。"),
  schema("control_loss_schema", "失控图式", ["控制", "计划", "规则", "过度保护"], ["不合理", "高风险", "不透明", "权威", "突然"], ["可控感", "主导权", "退出权"], ["掌握决策权", "要求明确规则", "拒绝被动加入"], "模糊安排会被解释为主导权丧失。"),
  schema("authority_threat_schema", "权威威胁图式", ["权威", "服从", "顺从"], ["权威", "服从", "安排", "代价"], ["边界保护", "权力感", "公平感"], ["要求责任边界", "避免替权威背锅"], "权力压力先被理解成风险转嫁。"),
  schema("moral_conflict_schema", "道德冲突图式", ["原则", "理想", "道德", "正义"], ["道德", "灰色", "伤害", "底线", "规则"], ["道德一致性", "意义感", "公平感"], ["确认是否伤害他人", "拒绝不干净收益"], "收益会先接受价值边界审查。"),
  schema("attachment_threat_schema", "依恋威胁图式", ["依恋", "亲密", "孤独", "被忽视"], ["亲密", "朋友", "复联", "冷淡"], ["关系稳定", "被看见", "归属感"], ["确认对方真实意图", "保留靠近但降低暴露"], "关系变化会被人格化为自己是否重要。"),
  schema("exploitation_schema", "被利用图式", ["利用", "讨好", "照顾", "被索取"], ["借钱", "帮忙", "要求", "机会"], ["边界保护", "证据感", "责任减负"], ["确认责任归属", "避免被情绪勒索"], "请求背后可能藏着单向索取。"),
  schema("responsibility_overload_schema", "责任过载图式", ["责任", "照顾", "家人", "团队"], ["责任", "甩锅", "借钱", "帮忙", "团队"], ["责任减负", "边界保护", "公平感"], ["承担有限责任", "区分自己的责任与他人的责任"], "选择会先被计算成会让谁承担后果。"),
  schema("freedom_constraint_schema", "自由受限图式", ["自由", "回避", "独立", "反抗"], ["权威", "绑定", "安排", "承诺"], ["自由感", "退出权", "避免依赖"], ["保留自由空间", "拒绝被动绑定"], "承诺被看作可能限制自由的绳结。"),
  schema("recognition_hunger_schema", "认可饥饿图式", ["认可", "被看见", "忽视", "成就"], ["认可", "比较", "贡献", "公开"], ["被认可", "被看见", "成就感"], ["让贡献被具体看见", "避免被再次跳过"], "外部评价会触发被看见的强烈需求。"),
  schema("competition_schema", "竞争图式", ["竞争", "比较", "地位", "证明"], ["比较", "竞争", "团队", "替代"], ["自尊保护", "成就感", "权力感"], ["证明自己的位置", "争取贡献空间"], "他人优势会被体验成自我位置受威胁。"),
  schema("idealism_schema", "理想主义图式", ["理想", "意义", "价值"], ["机会", "道德", "长期意义"], ["意义感", "道德一致性", "成就感"], ["确认事情是否有真实价值", "为了价值接受有限风险"], "行动先被放进意义和价值排序中。"),
  schema("opportunistic_gain_schema", "机会收益图式", ["冒险", "功利", "现实", "收益"], ["机会", "收益", "翻身", "项目"], ["成就感", "资源安全", "主导权"], ["计算收益率", "抓住可控收益", "比较替代机会"], "压力中仍会看到翻身机会。"),
  schema("recovery_growth_schema", "成长修复图式", ["成长", "修复", "整合", "二次成长"], ["新证据", "修复", "机会", "复联", "支持"], ["低风险恢复", "恢复感", "方向感"], ["让旧模式接受新证据检验", "用低风险尝试代替完全回避"], "旧防御仍在，但可以被证据调节。"),
  schema("emotional_suppression_schema", "情绪压抑图式", ["压抑", "冷静", "理性", "克制"], ["哭诉", "情绪", "公开", "冲突"], ["情绪释放", "可控感", "自尊保护"], ["先维持稳定", "用可控方式表达一点真实感受"], "情绪会先被收拢成可管理问题。"),
  schema("revenge_correction_schema", "纠偏复仇图式", ["正义", "愤怒", "报复", "纠偏"], ["不公", "甩锅", "伤害", "规则"], ["公平感", "复仇/纠偏", "权力感"], ["收集证据", "正式纠偏", "必要时反击"], "不公会激活修正秩序的冲动。"),
  schema("safety_seeking_schema", "安全寻求图式", ["谨慎", "安全", "低信任", "未修复"], ["风险", "不确定", "借钱", "权威", "冷淡"], ["安全感", "证据感", "边界保护"], ["先降低风险", "要求可验证证据", "保留退路"], "安全优先于快速承诺。")
];

const NEED_WEIGHTS: Record<string, number> = {
  安全感: 0.9,
  可控感: 0.84,
  证据感: 0.82,
  资源安全: 0.86,
  归属感: 0.74,
  被认可: 0.78,
  自尊保护: 0.82,
  避免羞耻: 0.8,
  道德一致性: 0.86,
  自由感: 0.78,
  权力感: 0.74,
  成就感: 0.76,
  公平感: 0.82,
  意义感: 0.8,
  关系稳定: 0.82,
  边界保护: 0.86,
  情绪释放: 0.7,
  责任减负: 0.78,
  "复仇/纠偏": 0.76,
  低风险恢复: 0.84,
  避免依赖: 0.78,
  被看见: 0.74,
  损失控制: 0.86,
  退出权: 0.84,
  主导权: 0.82
};

// ── V10.15 Life Modifiers ──────────────────────────────────────────────────

/**
 * Apply life context as modifiers to behavior strategy intensities.
 * Life signals are MODIFIERS, not primary drivers — they adjust weights
 * but never override personality-driven schema/need/desire selection.
 */
function applyLifeModifiers(
  strategies: BehaviorStrategy[],
  lifeCtx: LifeDecisionContext,
  influences: string[]
): BehaviorStrategy[] {
  return strategies.map((s) => {
    let modifier = 1.0;

    // Fatigue/sleep pressure: favor safety, delay, withdrawal; suppress impulsive/confront
    if (lifeCtx.fatigue > 0.55 || lifeCtx.sleepPressure > 0.55) {
      if (s.id === "delay_decision" || s.id === "resource_protective_refusal" || s.id === "emotional_withdrawal") {
        modifier += 0.08;
      }
      if (s.id === "impulsive_join" || s.id === "direct_join" || s.id === "confront_directly" || s.id === "power_grab") {
        modifier -= 0.1;
      }
    }

    // Boredom/restlessness: favor exploration, small trial, growth reframing
    if (lifeCtx.boredom > 0.4 || lifeCtx.restlessness > 0.4) {
      if (s.id === "small_scale_trial" || s.id === "reframe_as_growth" || s.id === "exploit_opportunity" || s.id === "freedom_preserving_choice") {
        modifier += 0.06;
      }
    }

    // Inspiration: favor creative, growth, meaning-oriented strategies
    if (lifeCtx.strongestInspirationStrength > 0.4) {
      if (s.id === "reframe_as_growth" || s.id === "small_scale_trial") {
        modifier += 0.06;
      }
    }

    // Irritability: favor confront/fairness, but suppress if already high friction signals
    if (lifeCtx.irritability > 0.45) {
      if (s.id === "fairness_correction" || s.id === "confront_directly" || s.id === "revenge_or_rectify") {
        modifier += 0.05;
      }
    }

    // Worry random thought: increase safety/verification
    if (lifeCtx.strongestRandomThoughtKind === "worry") {
      if (s.id === "verify_before_commitment" || s.id === "seek_support") {
        modifier += 0.06;
      }
    }

    // Memory echo thought: increase revisit/reflection tendency
    if (lifeCtx.strongestRandomThoughtKind === "memory_echo") {
      if (s.id === "reframe_as_growth" || s.id === "attachment_checking") {
        modifier += 0.04;
      }
    }

    // Sleep phase: if actually asleep, non-rest actions are suppressed
    if (lifeCtx.sleepPhase === "deep_sleep" || lifeCtx.sleepPhase === "light_sleep") {
      if (s.id !== "delay_decision" && s.id !== "emotional_withdrawal" && s.id !== "resource_protective_refusal") {
        modifier -= 0.15;
      }
    }

    const adjusted = round4(clamp01(clamp01(s.intensity) * Math.max(0.5, modifier)));
    if (Math.abs(adjusted - s.intensity) > 0.005) {
      influences.push(
        `${s.label}: intensity ${s.intensity.toFixed(2)} → ${adjusted.toFixed(2)} (life modifier ${modifier.toFixed(2)})`
      );
    }
    return { ...s, intensity: adjusted };
  }).sort((a, b) => b.intensity - a.intensity);
}

export function buildDifferentiatedDecision(params: {
  persona: PersonaSeed;
  environment: EnvironmentSeed;
  state: CharacterPhysicsState;
  beliefs?: readonly BeliefState[];
  legacyNeeds?: readonly NeedDeficiency[];
  legacyDesires?: readonly DesireState[];
  previousActionsInEnvironment?: readonly string[];
  previousStrategiesInEnvironment?: readonly string[];
  previousActionsForPersona?: readonly string[];
  /** V10.15: Optional life context from dry-run — modifies strategies, never overrides schemas. */
  lifeContext?: LifeDecisionContext;
}): DifferentiatedDecision {
  const beliefs = params.beliefs ?? params.state.beliefStates;
  const schemas = activateSchemas({
    persona: params.persona,
    environment: params.environment,
    state: params.state,
    beliefs
  });
  const needs = deriveNeedProfile({ schemas, persona: params.persona, environment: params.environment });
  const desires = deriveDesireProfile({ schemas, needs });
  const strategies = deriveBehaviorStrategies({
    schemas,
    needs,
    desires,
    persona: params.persona,
    environment: params.environment,
    previousActionsInEnvironment: params.previousActionsInEnvironment ?? [],
    previousStrategiesInEnvironment: params.previousStrategiesInEnvironment ?? [],
    previousActionsForPersona: params.previousActionsForPersona ?? []
  });
  // V10.15: Apply life context modifiers to strategies
  const lifeInfluences: string[] = [];
  const lifeCtx = params.lifeContext;
  const modifiedStrategies = lifeCtx
    ? applyLifeModifiers(strategies, lifeCtx, lifeInfluences)
    : strategies;

  const selectedStrategy = modifiedStrategies[0] ?? fallbackStrategy(schemas, needs, desires, params.environment);
  const actionSurface = buildActionSurface({
    strategy: selectedStrategy,
    schemas,
    needs,
    desires,
    persona: params.persona,
    environment: params.environment
  });
  return {
    schemas,
    needs,
    desires,
    strategies: modifiedStrategies,
    selectedStrategy,
    actionSurface,
    perception: buildPerception(params.environment, schemas),
    emotion: buildEmotion(schemas, params.persona),
    memoryTrigger: buildMemoryTrigger(params.persona, schemas),
    belief: buildBelief(params.persona, beliefs, schemas),
    lifeInfluences,
  };
}

export function activateSchemas(params: {
  persona: PersonaSeed;
  environment: EnvironmentSeed;
  state: CharacterPhysicsState;
  beliefs?: readonly BeliefState[];
}): ActivatedSchema[] {
  const personaText = personaTextFor(params.persona);
  const envText = environmentTextFor(params.environment);
  const beliefText = (params.beliefs ?? []).map((belief) => belief.content).join(" ");
  const stateSignals = [
    params.state.coordinate.values.trust < 0.35 ? "低信任" : "",
    params.state.coordinate.values.fear > 0.68 ? "高恐惧" : "",
    params.state.coordinate.values.control > 0.7 ? "控制" : "",
    params.state.metaState.resilience > 0.62 ? "成长 修复" : ""
  ].join(" ");
  const activated: ActivatedSchema[] = [];

  for (const definition of SCHEMAS) {
    const matchedPersonaKeys = definition.personaKeys.filter((key) =>
      personaText.includes(key) || beliefText.includes(key) || stateSignals.includes(key)
    );
    const matchedEnvironmentKeys = definition.environmentKeys.filter((key) => envText.includes(key));
    const personaHit = matchedPersonaKeys.length > 0;
    const envHit = matchedEnvironmentKeys.length > 0;
    if (!personaHit && !envHit) continue;
    const intensity = clamp01(
      0.18 +
      matchedPersonaKeys.length * 0.16 +
      matchedEnvironmentKeys.length * 0.14 +
      (personaHit && envHit ? 0.18 : 0) +
      schemaStateBoost(definition.id, params.state)
    );
    activated.push({
      id: definition.id,
      label: definition.label,
      intensity,
      source: personaHit ? "experience" : "environment",
      matchedPersonaKeys,
      matchedEnvironmentKeys,
      coreInterpretation: definition.interpretation
    });
  }

  if (!activated.some((schema) => schema.id === "safety_seeking_schema")) {
    activated.push({
      id: "safety_seeking_schema",
      label: "安全寻求图式",
      intensity: clamp01(0.42 + params.state.coordinate.values.fear * 0.25 + (1 - params.state.coordinate.values.trust) * 0.2),
      source: "need",
      matchedPersonaKeys: ["fallback_safety"],
      matchedEnvironmentKeys: [],
      coreInterpretation: "安全优先于快速承诺。"
    });
  }

  return activated
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);
}

export function deriveNeedProfile(params: {
  schemas: readonly ActivatedSchema[];
  persona: PersonaSeed;
  environment: EnvironmentSeed;
}): NeedProfile[] {
  const needs = new Map<string, NeedProfile>();
  for (const schema of params.schemas) {
    const definition = definitionFor(schema.id);
    for (const label of definition.needs) {
      const id = `need_${stableId(label)}`;
      const current = needs.get(id);
      const intensity = clamp01(schema.intensity * (NEED_WEIGHTS[label] ?? 0.7));
      if (!current || intensity > current.intensity) {
        needs.set(id, {
          id,
          label,
          intensity,
          basedOnSchemas: [schema.id],
          reason: `${schema.label}把${params.environment.name}中的${params.environment.stressor}压力转化为${label}需求。`
        });
      } else if (!current.basedOnSchemas.includes(schema.id)) {
        current.basedOnSchemas.push(schema.id);
      }
    }
  }
  return [...needs.values()].sort((a, b) => b.intensity - a.intensity).slice(0, 8);
}

export function deriveDesireProfile(params: {
  schemas: readonly ActivatedSchema[];
  needs: readonly NeedProfile[];
}): DesireProfile[] {
  const desires = new Map<string, DesireProfile>();
  for (const schema of params.schemas) {
    const definition = definitionFor(schema.id);
    const schemaNeeds = params.needs.filter((need) => need.basedOnSchemas.includes(schema.id));
    for (const label of definition.desires) {
      const id = `desire_${stableId(label)}`;
      const current = desires.get(id);
      const intensity = clamp01(schema.intensity * 0.74 + (schemaNeeds[0]?.intensity ?? 0.4) * 0.26);
      if (!current || intensity > current.intensity) {
        desires.set(id, {
          id,
          label,
          intensity,
          basedOnSchemas: [schema.id],
          basedOnNeeds: schemaNeeds.map((need) => need.id),
          intent: `${definition.label}推动角色${label}。`
        });
      } else if (!current.basedOnSchemas.includes(schema.id)) {
        current.basedOnSchemas.push(schema.id);
      }
    }
  }
  return [...desires.values()].sort((a, b) => b.intensity - a.intensity).slice(0, 8);
}

export function deriveBehaviorStrategies(params: {
  schemas: readonly ActivatedSchema[];
  needs: readonly NeedProfile[];
  desires: readonly DesireProfile[];
  persona: PersonaSeed;
  environment: EnvironmentSeed;
  previousActionsInEnvironment?: readonly string[];
  previousStrategiesInEnvironment?: readonly string[];
  previousActionsForPersona?: readonly string[];
}): BehaviorStrategy[] {
  const candidates = strategyCandidates(params);
  const previousActions = new Set(params.previousActionsInEnvironment ?? []);
  const previousStrategies = new Set(params.previousStrategiesInEnvironment ?? []);
  const previousPersonaActions = new Set(params.previousActionsForPersona ?? []);
  return candidates
    .map((strategy) => {
      let intensity = strategy.intensity;
      if (previousStrategies.has(strategy.id)) intensity *= 0.82;
      if (previousActions.has(strategy.actionIntent)) intensity *= 0.78;
      if (previousPersonaActions.has(strategy.actionIntent)) intensity *= 0.88;
      if (!strategy.basedOnSchemas.length) intensity *= 0.6;
      if (!strategy.basedOnNeeds.length || !strategy.basedOnDesires.length) intensity *= 0.7;
      if (isGenericAction(strategy.actionIntent)) intensity *= 0.55;
      return { ...strategy, intensity: round4(clamp01(intensity)) };
    })
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 6);
}

function strategyCandidates(params: {
  schemas: readonly ActivatedSchema[];
  needs: readonly NeedProfile[];
  desires: readonly DesireProfile[];
  persona: PersonaSeed;
  environment: EnvironmentSeed;
}): BehaviorStrategy[] {
  const bySchema = new Set(params.schemas.map((schema) => schema.id));
  const byNeed = new Set(params.needs.map((need) => need.label));
  const list: BehaviorStrategy[] = [];
  const add = (id: BehaviorStrategyId, base: number, label: string, direction: string, reason: string, intent: string) => {
    list.push({
      id,
      label,
      direction,
      intensity: clamp01(base + schemaIntensity(params.schemas, strategySchemas(id)) * 0.4),
      basedOnSchemas: params.schemas.filter((schema) => strategySchemas(id).includes(schema.id)).map((schema) => schema.id),
      basedOnNeeds: params.needs.slice(0, 4).map((need) => need.id),
      basedOnDesires: params.desires.slice(0, 4).map((desire) => desire.id),
      coreReason: reason,
      actionIntent: intent
    });
  };

  if (bySchema.has("betrayal_schema") || byNeed.has("证据感")) {
    add("verify_before_commitment", 0.55, "核验后再承诺", "核验后有限合作", "背叛/证据图式要求先确认可信度。", "要求核验合同、资金流、对方背景与退出机制。");
    add("demand_written_terms", 0.48, "要求书面条款", "条件性行动", "证据感和退出权需求要求把承诺外化成条款。", "把口头承诺改成书面约定、节点检查和责任边界。");
  }
  if (bySchema.has("scarcity_schema")) {
    add("resource_protective_refusal", 0.62, "资源保护性拒绝", "延迟/拒绝", "匮乏图式把不可逆投入视为生存风险。", "拒绝投入关键资源，只保留不伤安全垫的选择。");
    add("small_scale_trial", 0.58, "小规模试水", "核验后有限合作", "低风险恢复需求允许小额、可退出的尝试。", "只接受低成本试水，并预设最坏情况下的生活底线。");
  }
  if (bySchema.has("shame_schema") || bySchema.has("failure_identity_schema")) {
    add("overcompensate_to_prove_self", 0.5, "过度证明自己", "条件性行动", "羞耻和失败身份让角色先保护自尊再行动。", "先拆解成功条件和失败后果，准备充分前不公开承诺。");
    add("delay_decision", 0.45, "延迟决策", "延迟/拒绝", "避免羞耻需求使角色拖延暴露失败可能。", "要求更多时间评估，避免在不确定中立即表态。");
  }
  if (bySchema.has("control_loss_schema")) {
    add("negotiate_control", 0.62, "谈判主导权", "条件性行动", "失控图式要求重新获得关键变量。", "提出必须拥有关键决策权、退出权或明确规则。");
    add("power_grab", 0.42, "争夺权力", "条件性行动", "主导权需求把机会转换成控制权谈判。", "争取关键权限，否则降低参与程度。");
  }
  if (bySchema.has("moral_conflict_schema") || bySchema.has("idealism_schema")) {
    add("moral_reject", 0.62, "道德性拒绝", "延迟/拒绝", "道德一致性优先于短期收益。", "先审查项目是否伤害他人，不干净则拒绝。");
    add("reframe_as_growth", 0.45, "成长性重构", "条件性行动", "意义感需求允许为价值承担有限风险。", "若价值真实且边界清楚，就把风险视为成长练习。");
  }
  if (bySchema.has("attachment_threat_schema") || bySchema.has("abandonment_schema")) {
    add("attachment_checking", 0.58, "确认关系信号", "关系确认/防御", "依恋威胁要求先确认关系安全。", "询问对方意图和稳定性，但不马上暴露全部需求。");
    add("emotional_withdrawal", 0.42, "情绪撤退", "延迟/拒绝", "遗弃图式让角色用距离减少受伤概率。", "暂时拉开距离，等待对方用行动补足安全证据。");
  }
  if (bySchema.has("responsibility_overload_schema")) {
    add("responsibility_first", 0.6, "责任优先", "条件性行动", "责任过载图式先计算后果归属。", "愿意承担有限责任，但先划清不可替代边界。");
    add("self_sacrifice", 0.4, "自我牺牲", "条件性行动", "旧责任模式会推高过度承担冲动。", "先接住最紧急部分，但保留后续减负条件。");
  }
  if (bySchema.has("freedom_constraint_schema")) {
    add("freedom_preserving_choice", 0.58, "保留自由", "条件性行动", "自由受限图式要求不被承诺绑定。", "只接受可退出、可调整、不侵占自由的安排。");
    add("avoid_dependency", 0.5, "避免依赖", "延迟/拒绝", "避免依赖需求降低长期绑定意愿。", "减少交换和承诺，避免让自己欠下关系债。");
  }
  if (bySchema.has("revenge_correction_schema")) {
    add("fairness_correction", 0.58, "纠偏公平", "强反击倾向", "公平感和纠偏需求推动正式申诉。", "收集证据并要求公开修正责任分配。");
    add("revenge_or_rectify", 0.45, "纠正/反击", "强反击倾向", "被伤害后的纠偏冲动推动直接反击。", "在证据足够时强硬对质并要求补偿。");
  }
  if (bySchema.has("opportunistic_gain_schema")) {
    add("exploit_opportunity", 0.5, "利用机会", "主动进入", "机会收益图式看到翻身窗口。", "计算收益率和失败概率，若收益足够则有限加入。");
    add("direct_join", 0.36, "直接加入", "主动进入", "高风险偏好可能压过安全犹豫。", "在可见收益强时快速进入并边做边调。");
  }
  if (bySchema.has("exploitation_schema")) {
    add("boundary_assertion", 0.56, "边界表达", "条件性行动", "被利用图式要求限制单向索取。", "说明自己能提供的范围，并拒绝超出边界的部分。");
    add("appease_then_observe", 0.38, "表面迎合但观察", "条件性行动", "讨好和防御并存，先维持关系再观察。", "先给出礼貌回应，但用后续行为验证对方。");
  }
  if (bySchema.has("authority_threat_schema")) {
    add("confront_directly", 0.44, "直接质问", "强反击倾向", "权威威胁触发责任边界争夺。", "直接要求说明依据、责任归属和拒绝后果。");
    add("seek_support", 0.4, "寻求他人意见", "条件性行动", "权力压力下需要外部证据降低个人风险。", "先找第三方确认规则和风险，再决定是否执行。");
  }
  if (bySchema.has("recovery_growth_schema")) {
    add("reframe_as_growth", 0.62, "成长性重构", "条件性行动", "成长修复图式让角色用新证据校正旧防御。", "把触发点拆成旧风险和新证据，选择低风险尝试。");
    add("small_scale_trial", 0.52, "小规模试水", "核验后有限合作", "低风险恢复允许行动但保留边界。", "先做可撤回的小尝试，再根据结果调整信任。");
  }
  if (bySchema.has("emotional_suppression_schema")) {
    add("delay_decision", 0.38, "延迟决策", "延迟/拒绝", "情绪压抑使角色先把情绪收束。", "先暂停表态，等情绪可控后再回应。");
  }

  if (!list.length) {
    add("verify_before_commitment", 0.45, "核验后再承诺", "条件性行动", "默认安全图式要求证据先于承诺。", "先获取更多信息，再做有限承诺。");
  }
  return list;
}

function buildActionSurface(params: {
  strategy: BehaviorStrategy;
  schemas: readonly ActivatedSchema[];
  needs: readonly NeedProfile[];
  desires: readonly DesireProfile[];
  persona: PersonaSeed;
  environment: EnvironmentSeed;
}): ActionSurface {
  const persona = params.persona.name;
  const env = params.environment.name;
  const stressor = params.environment.stressor;
  const need = params.needs[0]?.label ?? "安全感";
  const desire = params.desires[0]?.label ?? "保留退路";
  const schema = params.schemas[0]?.label ?? "安全寻求图式";
  const action = actionForStrategy(params.strategy.id, { persona, env, stressor, need, desire, schema });
  const genericPenalty = isGenericAction(action) ? 0.55 : 0;
  const referencePenalty = [action.includes(env), action.includes(persona) || action.includes(schema), action.includes(need) || action.includes(desire)]
    .filter((matched) => !matched).length * 0.12;
  return {
    action,
    direction: params.strategy.direction,
    strategyId: params.strategy.id,
    reason: `${schema}激活了${need}需求，并把${desire}欲望转译为${params.strategy.label}策略。`,
    templatePenalty: round4(clamp01(genericPenalty + referencePenalty)),
    referencesEnvironment: action.includes(env) || action.includes(stressor.split(" / ")[0] ?? stressor),
    referencesPersona: action.includes(persona) || action.includes(schema),
    referencesNeedOrDesire: action.includes(need) || action.includes(desire)
  };
}

function actionForStrategy(
  strategy: BehaviorStrategyId,
  context: { persona: string; env: string; stressor: string; need: string; desire: string; schema: string }
): string {
  const { persona, env, stressor, need, desire, schema } = context;
  const firstStressor = stressor.split(" / ")[0] ?? stressor;
  const prefix = `${persona}在“${env}”里会先被${schema}牵动，为了守住${need}，`;
  const map: Record<BehaviorStrategyId, string> = {
    verify_before_commitment: `${prefix}不会立刻承诺；会核验${firstStressor}相关证据、对方背景、资金或责任流向，再决定是否低风险推进。`,
    small_scale_trial: `${prefix}只接受小规模试水；先把投入压到可承受范围，并保留随时退出的条件。`,
    negotiate_control: `${prefix}会谈判主导权；如果关键变量、规则和退出权不清楚，就不会进入。`,
    demand_written_terms: `${prefix}要求书面条款、节点检查和责任边界；口头保证不足以让他承担${firstStressor}风险。`,
    delay_decision: `${prefix}会延迟决策；先把${desire}整理清楚，避免在压力里做不可逆选择。`,
    direct_join: `${prefix}会直接加入一部分行动；但仍会盯住${firstStressor}带来的关键收益和风险。`,
    impulsive_join: `${prefix}可能冲动加入；机会感短暂压过风险评估，事后才补做控制。`,
    moral_reject: `${prefix}会先审查价值底线；只要${firstStressor}会伤害他人或规则不干净，就拒绝收益。`,
    resource_protective_refusal: `${prefix}不会押上关键资源；最坏情况下守住生活底线比翻身诱惑更重要。`,
    emotional_withdrawal: `${prefix}会先撤回情绪投入；让距离替自己争取更多观察时间。`,
    attachment_checking: `${prefix}会确认关系信号；询问对方真实意图，同时避免一次性暴露全部需求。`,
    seek_support: `${prefix}会先寻求第三方意见；用外部规则和证据降低自己单独承担的风险。`,
    confront_directly: `${prefix}会直接质问关键矛盾；要求说明依据、责任和后果，而不是默默吞下。`,
    appease_then_observe: `${prefix}表面保持配合，但把重点放在观察对方是否继续越界或索取。`,
    overcompensate_to_prove_self: `${prefix}会过度准备和证明自己；在无法掌控失败后果前迟迟不公开承诺。`,
    avoid_dependency: `${prefix}会避免形成依赖；宁愿减少交换，也不让自己被${firstStressor}绑定。`,
    self_sacrifice: `${prefix}会先接住最紧急部分；但成熟时会给出后续减负和边界条件。`,
    boundary_assertion: `${prefix}会明确边界；说明自己能承担的范围，拒绝超出${need}底线的部分。`,
    exploit_opportunity: `${prefix}会计算收益率、投入成本和替代机会；只有预期收益足够高才推进。`,
    reframe_as_growth: `${prefix}会把旧触发和新证据分开；选择一个有边界的小尝试来测试成长是否成立。`,
    responsibility_first: `${prefix}会先计算谁承担后果；愿意负有限责任，但不会替所有人兜底。`,
    freedom_preserving_choice: `${prefix}会保留自由；只接受可退出、可调整、不侵占自主权的安排。`,
    power_grab: `${prefix}会争取关键权限；如果无法掌握主导权，就降低参与或拒绝。`,
    fairness_correction: `${prefix}会收集证据并要求公平修正；重点是把${firstStressor}中的责任重新摆正。`,
    revenge_or_rectify: `${prefix}会把愤怒转成纠偏行动；证据足够时直接反击并要求补偿。`
  };
  return map[strategy];
}

function buildPerception(environment: EnvironmentSeed, schemas: readonly ActivatedSchema[]): string {
  const primary = schemas[0];
  if (!primary) return `把“${environment.name}”暂时理解为需要更多证据的压力事件。`;
  return `把“${environment.name}”首先解释为${primary.coreInterpretation} 同时注意到${environment.stressor}压力。`;
}

function buildEmotion(schemas: readonly ActivatedSchema[], persona: PersonaSeed): string {
  const ids = new Set(schemas.map((schema) => schema.id));
  if (ids.has("shame_schema") || ids.has("failure_identity_schema")) return "羞耻、紧绷，并夹杂自我证明冲动。";
  if (ids.has("betrayal_schema") || ids.has("exploitation_schema")) return "警惕、紧张，并压着一部分愤怒。";
  if (ids.has("attachment_threat_schema") || ids.has("abandonment_schema")) return "不安、期待和撤退冲动同时出现。";
  if (ids.has("moral_conflict_schema")) return "道德紧张、克制的愤怒和清晰拒斥。";
  if (ids.has("opportunistic_gain_schema")) return "期待、兴奋和风险焦虑并存。";
  if (persona.growth === "未修复") return "紧张、抵触，防御反应较强。";
  return "紧张、期待或抵触，强度与核心图式一致。";
}

function buildMemoryTrigger(persona: PersonaSeed, schemas: readonly ActivatedSchema[]): string {
  const labels = schemas.map((schema) => schema.label).join("、");
  return `${persona.coreExperience} 当前触发${labels || "安全寻求图式"}。`;
}

function buildBelief(persona: PersonaSeed, beliefs: readonly BeliefState[], schemas: readonly ActivatedSchema[]): string {
  const belief = beliefs[0]?.content || persona.dominantBelief;
  const schema = schemas[0]?.label ?? "安全寻求图式";
  return `${belief} 这一次由${schema}主导解释。`;
}

function schema(
  id: ActivatedSchemaId,
  label: string,
  personaKeys: string[],
  environmentKeys: string[],
  needs: string[],
  desires: string[],
  interpretation: string
): SchemaDefinition {
  return { id, label, personaKeys, environmentKeys, needs, desires, interpretation };
}

function definitionFor(id: ActivatedSchemaId): SchemaDefinition {
  return SCHEMAS.find((schemaDef) => schemaDef.id === id)!;
}

function personaTextFor(persona: PersonaSeed): string {
  return `${persona.id} ${persona.name} ${persona.group} ${persona.initialTraits} ${persona.coreExperience} ${persona.dominantBelief} ${persona.needGap} ${persona.defaultDefense} ${persona.risk} ${persona.trust} ${persona.growth}`;
}

function environmentTextFor(environment: EnvironmentSeed): string {
  return `${environment.id} ${environment.name} ${environment.trigger} ${environment.stressor} ${environment.testFocus}`;
}

function schemaStateBoost(id: ActivatedSchemaId, state: CharacterPhysicsState): number {
  if (id === "safety_seeking_schema") return state.coordinate.values.fear * 0.08 + (1 - state.coordinate.values.trust) * 0.08;
  if (id === "control_loss_schema") return state.coordinate.values.control * 0.08;
  if (id === "attachment_threat_schema") return state.coordinate.values.attachment * 0.08;
  if (id === "recovery_growth_schema") return state.metaState.resilience * 0.08;
  if (id === "opportunistic_gain_schema") return state.coordinate.values.openness * 0.06;
  return 0;
}

function schemaIntensity(schemas: readonly ActivatedSchema[], ids: readonly ActivatedSchemaId[]): number {
  return schemas
    .filter((schema) => ids.includes(schema.id))
    .reduce((sum, schema) => sum + schema.intensity, 0) / Math.max(1, ids.length);
}

function strategySchemas(id: BehaviorStrategyId): ActivatedSchemaId[] {
  const map: Record<BehaviorStrategyId, ActivatedSchemaId[]> = {
    verify_before_commitment: ["betrayal_schema", "safety_seeking_schema", "exploitation_schema"],
    small_scale_trial: ["scarcity_schema", "recovery_growth_schema", "opportunistic_gain_schema"],
    negotiate_control: ["control_loss_schema"],
    demand_written_terms: ["betrayal_schema", "control_loss_schema", "authority_threat_schema"],
    delay_decision: ["shame_schema", "failure_identity_schema", "emotional_suppression_schema"],
    direct_join: ["opportunistic_gain_schema", "idealism_schema"],
    impulsive_join: ["opportunistic_gain_schema"],
    moral_reject: ["moral_conflict_schema", "idealism_schema"],
    resource_protective_refusal: ["scarcity_schema", "safety_seeking_schema"],
    emotional_withdrawal: ["abandonment_schema", "attachment_threat_schema", "emotional_suppression_schema"],
    attachment_checking: ["attachment_threat_schema", "abandonment_schema"],
    seek_support: ["authority_threat_schema", "safety_seeking_schema"],
    confront_directly: ["authority_threat_schema", "revenge_correction_schema"],
    appease_then_observe: ["exploitation_schema", "responsibility_overload_schema"],
    overcompensate_to_prove_self: ["shame_schema", "failure_identity_schema", "competition_schema"],
    avoid_dependency: ["freedom_constraint_schema", "attachment_threat_schema"],
    self_sacrifice: ["responsibility_overload_schema"],
    boundary_assertion: ["exploitation_schema", "responsibility_overload_schema", "safety_seeking_schema"],
    exploit_opportunity: ["opportunistic_gain_schema"],
    reframe_as_growth: ["recovery_growth_schema", "idealism_schema"],
    responsibility_first: ["responsibility_overload_schema"],
    freedom_preserving_choice: ["freedom_constraint_schema"],
    power_grab: ["control_loss_schema", "competition_schema"],
    fairness_correction: ["revenge_correction_schema", "moral_conflict_schema"],
    revenge_or_rectify: ["revenge_correction_schema"]
  };
  return map[id];
}

function fallbackStrategy(
  schemas: readonly ActivatedSchema[],
  needs: readonly NeedProfile[],
  desires: readonly DesireProfile[],
  environment: EnvironmentSeed
): BehaviorStrategy {
  return {
    id: "verify_before_commitment",
    label: "核验后再承诺",
    direction: "条件性行动",
    intensity: 0.5,
    basedOnSchemas: schemas.map((schema) => schema.id),
    basedOnNeeds: needs.map((need) => need.id),
    basedOnDesires: desires.map((desire) => desire.id),
    coreReason: "默认安全图式要求证据先于承诺。",
    actionIntent: `先核验${environment.stressor}相关证据，再做有限承诺。`
  };
}

function isGenericAction(action: string): boolean {
  return action.includes("谨慎观察") || action.includes("保持边界") || action.includes("逐步信任") ||
    action.includes("压住情绪") || action.includes("克制、冷淡");
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function stableId(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
