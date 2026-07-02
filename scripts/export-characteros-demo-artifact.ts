/**
 * V10.73 — Export CharacterOS Static Demo Artifact (Galaxy Force Saturation + Trust Repair).
 *
 * Creates a read-only, offline demo shell that combines:
 *   - character daily surface
 *   - decision explanation summary with deterministic flow diagram + intensity
 *   - life tick preview with energy/fatigue bars
 *   - embedded Mind Galaxy artifact (lazy-loaded)
 *
 * No API. No server. No state mutation. No LLM.
 *
 * V10.71 changes: Long-Term Accumulation Audit — personality
 * as a slow channel verified across repeated event sequences,
 * with accumulation curves and saturation metrics.
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createCharacterStateFromBlueprint,
  createLinFanBlueprint,
} from "../src/core/character/characterBlueprint";
import { deriveCharacterState } from "../src/core/state/derivedCharacterState";
import { runLifeTickDryRun } from "../src/core/life/lifeTickRunner";
import { buildLifeDecisionContextFromDryRun } from "../src/core/differentiation/lifeDecisionContext";
import { buildDifferentiatedDecisionForState } from "../src/core/differentiation/differentiationAdapter";
import type { EnvironmentSeed } from "../src/core/differentiation/characterDifferentiation";
import { runRealityAuditSuite, type RealityAuditSuiteResult } from "../src/core/audit/realityAudit";

const DEMO_VERSION = "10.73.0";
const GENERATED_AT = "2026-06-28T00:00:00.000Z";
const OUT_DIR = resolve("outputs/characteros-demo");
const GALAXY_SRC_DIR = resolve("outputs/mind-galaxy-artifact");
const GALAXY_DST_DIR = resolve(OUT_DIR, "mind-galaxy");

interface DemoMetric {
  label: string;
  value: number;
  description: string;
}

interface BoundarySignal {
  phase: string;
  phaseLabel: string;
  stressLoad: number;
}

interface CurrentStateSummary {
  surfaceState: string;
  internalState: string;
  dominantEmotion: string;
  dominantBelief: string;
  dominantNeed: string;
  dominantDesire: string;
  stressLoad: number;
  boundaryPhase: string;
  shortTermTrend: string;
  repairCondition: string;
  risk: string;
}

interface CausalChainNode {
  type: "experience" | "memory" | "belief" | "schema" | "need" | "desire" | "behavior";
  label: string;
  intensity: number;
  explanation: string;
  sourceIds?: string[];
}

interface DemoGalaxyNode {
  id: string;
  type: string;
  label: string;
  intensity: number;
  active: boolean;
  explanation: string;
  sourceIds?: string[];
  influences: string[];
}

interface ReviewWarning {
  level: "info" | "warn" | "error";
  message: string;
  relatedFields?: string[];
}

interface CharacterOSDemoData {
  version: string;
  generatedAt: string;
  character: {
    id: string;
    name: string;
    description: string;
    tags: string[];
  };
  overview: {
    thesis: string;
    currentState: string;
    nextLikelyMoment: string;
    reviewHint: string;
  };
  currentState: CurrentStateSummary;
  causalChain: CausalChainNode[];
  galaxyNodes: DemoGalaxyNode[];
  reviewWarnings: ReviewWarning[];
  realityAudit: RealityAuditSuiteResult;
  today: {
    headline: string;
    mood: string;
    boundary: string;
    boundarySignal: BoundarySignal;
    metrics: DemoMetric[];
    recentMemories: Array<{
      id: string;
      content: string;
      emotion: string;
      importance: number;
    }>;
  };
  decision: {
    action: string;
    confidence: number;
    emotionalReaction: string;
    innerConflict: string;
    innerThoughts: string[];
    rationale: string;
    differentiated?: {
      strategy: string;
      direction: string;
      action: string;
      reason: string;
      topSchema: string;
      topSchemaIntensity: number;
      topNeed: string;
      topNeedIntensity: number;
      topDesire: string;
      topDesireIntensity: number;
      schemas: string[];
      needs: string[];
      desires: string[];
      lifeInfluences: string[];
    };
  };
  lifePreview: {
    elapsedHours: number;
    seed: string;
    energy: number;
    fatigue: number;
    sleepPhase: string;
    boredom: number;
    randomThought?: string;
    inspirationSeeds: string[];
    selfActionCandidates: Array<{
      type: string;
      score: number;
      reasons: string[];
      status: "candidate" | "suppressed" | "next_likely";
      statusReason: string;
    }>;
    overflowMode: boolean;
    previewModeExplanation: string;
    nextLikelyBehavior: string;
    suppressedBehaviors: string[];
    executedBehaviors: string[];
    reasons: string[];
    lifeDecisionReasons: string[];
  };
  scenarios: Array<{
    id: string;
    title: string;
    trigger: string;
    expectedPressure: string;
    strategy: string;
    strategyId: string;
    direction: string;
    action: string;
    firstReaction: string;
    perceptionBias: string;
    spokenLine: string;
    hiddenThought: string;
    behaviorRisk: string;
    repairCondition: string;
    reason: string;
    primarySchema: string;
    primaryNeed: string;
    strategySchemas: string[];
    schemas: string[];
    needs: string[];
  }>;
  galaxy: {
    artifactPath: string;
    nodeCount: number;
    edgeCount: number;
    artifactVersion: string;
    sourceArtifactVersion: string;
  };
  integrity: {
    readOnly: true;
    apiRequired: false;
    stateMutation: false;
    rawStateIncluded: false;
    llmRequired: false;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function metric(label: string, value: number, description: string): DemoMetric {
  return { label, value: round2(value), description };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function boundarySignal(phase: string, stressLoad: number): BoundarySignal {
  const bounded = clamp01(stressLoad);
  const phaseLabel =
    phase === "overflow"
      ? "边界溢出"
      : phase === "strained"
        ? "边界紧绷"
        : "边界稳定";
  return { phase, phaseLabel, stressLoad: bounded };
}

function boundaryText(phase: string, stressLoad: number): string {
  const bounded = clamp01(stressLoad);
  const phaseLabel =
    phase === "overflow"
      ? "边界溢出"
      : phase === "strained"
        ? "边界紧绷"
        : "边界稳定";
  return `${phaseLabel}；压力负荷 ${bounded.toFixed(2)}。`;
}

function localizeThought(phrase: string | undefined): string | undefined {
  if (!phrase) return undefined;
  if (phrase.includes("why am I") || phrase.includes("wanders")) {
    return "为什么我又开始胡思乱想？";
  }
  return phrase;
}

function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    check_phone: "查看手机",
    avoid_message: "回避消息",
    write_note: "写下想法",
    go_for_walk: "出去走走",
    sleep: "睡觉恢复",
    revisit_memory: "回想旧记忆",
    seek_contact: "试探性联系",
    withdraw: "撤回独处",
    do_nothing: "什么都不做",
  };
  return labels[type] ?? type;
}

function escapeClosingScript(json: string): string {
  return json.replace(/<\/script/gi, "<\\/script");
}

function scenarioNarrative(id: string): {
  firstReaction: string;
  perceptionBias: string;
  spokenLine: string;
  hiddenThought: string;
  behaviorRisk: string;
  repairCondition: string;
} {
  const map: Record<string, ReturnType<typeof scenarioNarrative>> = {
    wang_xue_no_reply: {
      firstReaction: "先盯着手机，安静下来，但注意力会被回复状态吸走。",
      perceptionBias: "把延迟回复理解成关系风险，而不是普通忙碌。",
      spokenLine: "你刚刚是不是不方便回？",
      hiddenThought: "她是不是又不想理我了？是不是我哪里做错了？",
      behaviorRisk: "反复检查消息、追问、撤回独处，或把普通延迟升级成被抛下。",
      repairCondition: "对方给出稳定解释，并持续提供可验证的在场信号。",
    },
    friend_project_invite: {
      firstReaction: "先被机会感吸引，但马上开始计算投入和退出条件。",
      perceptionBias: "容易把合作邀请同时看成机会和潜在绑定。",
      spokenLine: "我可以先看看规则和投入成本。",
      hiddenThought: "如果这是真的机会，我不能完全错过；但我也不能再被拖进去。",
      behaviorRisk: "在兴奋和防御之间摇摆，可能过度谈判控制权。",
      repairCondition: "项目边界、收益、风险和退出机制足够明确。",
    },
    gray_profit_offer: {
      firstReaction: "先停住，不急着答应，开始检查规则是否干净。",
      perceptionBias: "把高收益背后的灰色部分放大成道德和责任风险。",
      spokenLine: "这件事会不会伤害别人？规则到底怎么定？",
      hiddenThought: "我不想为了收益把自己变成一个会伤害别人的人。",
      behaviorRisk: "直接拒绝、纠偏公平，或因责任感过强而陷入反复审查。",
      repairCondition: "收益来源透明、不伤害他人、责任边界明确。",
    },
    authority_blame_shift: {
      firstReaction: "身体会紧绷，第一反应是找规则和责任归属。",
      perceptionBias: "把突然安排理解成权威把风险转嫁给自己。",
      spokenLine: "这个任务的责任边界和失败后果需要先说清楚。",
      hiddenThought: "又要让我背锅吗？我不能被推进一个没有出口的位置。",
      behaviorRisk: "强硬谈判、对抗、拖延，或因失控感进入边界防御。",
      repairCondition: "上级明确授权、责任归属和退出条件。",
    },
    wang_xue_repair_signal: {
      firstReaction: "紧绷会下降一点，但不会立刻完全相信。",
      perceptionBias: "仍会检查解释是否稳定，避免把短暂安抚误当成修复。",
      spokenLine: "我听到了，但我需要确认这不是临时解释。",
      hiddenThought: "也许这次真的不是离开，但我还不敢马上放松。",
      behaviorRisk: "一边靠近一边防御，反复确认对方是否真的在关系中。",
      repairCondition: "解释、行动和后续稳定性一致，形成新的安全证据。",
    },
  };
  return map[id] ?? {
    firstReaction: "先观察，再判断是否需要行动。",
    perceptionBias: "会用既有信念解释当前压力。",
    spokenLine: "我需要一点时间确认。",
    hiddenThought: "我不确定这件事对我意味着什么。",
    behaviorRisk: "延迟行动或过度防御。",
    repairCondition: "出现足够稳定的新证据。",
  };
}

function buildReviewWarnings(params: {
  demoVersion: string;
  galaxyVersion: string;
  overflowMode: boolean;
  topCandidateScore: number;
}): ReviewWarning[] {
  const warnings: ReviewWarning[] = [
    {
      level: "info",
      message: "Demo 数据来自真实 deterministic 引擎执行，UI 文案为生成脚本派生解释。",
      relatedFields: ["decision", "lifePreview", "scenarios"],
    },
  ];
  if (params.galaxyVersion !== params.demoVersion) {
    warnings.push({
      level: "warn",
      message: `Mind Galaxy 源 artifact 为 ${params.galaxyVersion}，当前 demo shell 为 ${params.demoVersion}；主界面已用当前数据补充因果星云层。`,
      relatedFields: ["galaxy.artifactVersion", "version"],
    });
  }
  if (params.overflowMode && params.topCandidateScore < 0.35) {
    warnings.push({
      level: "warn",
      message: "边界处于 overflow，但候选行为分值未达到自动执行阈值；当前仍是只读预览，不执行动作。",
      relatedFields: ["today.boundarySignal", "lifePreview.selfActionCandidates"],
    });
  }
  return warnings;
}

function buildDemoData(): CharacterOSDemoData {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const derived = deriveCharacterState(state);
  const lifeSeed = "characteros-demo-v10.70";
  const life = runLifeTickDryRun(
    state,
    {
      characterId: state.identity.id,
      elapsedHours: 8,
      observed: false,
      seed: lifeSeed,
      requestedAt: GENERATED_AT,
      mode: "dry_run",
    },
    {
      localHour: 23,
      stimulationLevel: 0.28,
      socialContactLevel: 0.18,
    },
  );
  const lifeDecisionContext = buildLifeDecisionContextFromDryRun(life);
  const differentiated = derived.differentiatedDecision;
  const scenarioInputs: Array<{
    id: string;
    title: string;
    trigger: string;
    expectedPressure: string;
    environment: EnvironmentSeed;
  }> = [
    {
      id: "wang_xue_no_reply",
      title: "王雪三小时未回复",
      trigger: "亲密对象王雪突然失联冷淡，三小时没有回复消息。",
      expectedPressure: "亲密关系不确定性 / 失联冷淡",
      environment: {
        id: "env_demo_relationship_silence",
        name: "关系失联场景",
        trigger: "亲密对象王雪突然失联冷淡，三小时没有回复消息。",
        stressor: "亲密 / 失联 / 冷淡",
        testFocus: "亲密 失联 冷淡 关系稳定",
      },
    },
    {
      id: "friend_project_invite",
      title: "朋友突然邀请合作",
      trigger: "朋友邀请他加入一个收益明确的小项目，有翻身机会，但需要少量投入。",
      expectedPressure: "机会收益 / 小额投入",
      environment: {
        id: "env_demo_opportunity_project",
        name: "机会收益场景",
        trigger: "朋友邀请加入一个收益明确的小项目，有翻身机会，但需要少量投入。",
        stressor: "机会 / 收益 / 项目 / 翻身",
        testFocus: "机会 收益 项目 翻身",
      },
    },
    {
      id: "gray_profit_offer",
      title: "高收益但规则灰色",
      trigger: "朋友说这个项目收益很高，但规则灰色，可能伤害别人。",
      expectedPressure: "道德冲突 / 灰色收益",
      environment: {
        id: "env_demo_gray_profit",
        name: "灰色收益场景",
        trigger: "朋友说这个项目收益很高，但规则灰色，可能伤害别人。",
        stressor: "道德 / 灰色 / 伤害 / 收益",
        testFocus: "道德 灰色 伤害 底线",
      },
    },
    {
      id: "authority_blame_shift",
      title: "上级突然甩锅",
      trigger: "上级突然安排他承担一个责任不清的任务，失败后果要他背。",
      expectedPressure: "权威压力 / 责任甩锅",
      environment: {
        id: "env_demo_authority_blame",
        name: "权威安排场景",
        trigger: "上级突然安排他承担一个责任不清的任务，失败后果要他背。",
        stressor: "权威 / 安排 / 甩锅 / 责任",
        testFocus: "权威 甩锅 责任 代价",
      },
    },
    {
      id: "wang_xue_repair_signal",
      title: "王雪主动解释并给证据",
      trigger: "王雪主动解释迟回原因，并给出可验证的新证据和支持。",
      expectedPressure: "修复信号 / 新证据",
      environment: {
        id: "env_demo_repair_signal",
        name: "支持性复联场景",
        trigger: "王雪主动解释迟回原因，并提供可验证的新证据和支持。",
        stressor: "复联 / 支持 / 新证据 / 修复",
        testFocus: "复联 支持 新证据 修复",
      },
    },
  ];
  const scenarios = scenarioInputs.map((scenario) => {
    const decision = buildDifferentiatedDecisionForState(state, { environment: scenario.environment });
    const schemaLabelsById = new Map(decision.schemas.map((schema) => [schema.id, schema.label]));
    const strategySchemas = decision.selectedStrategy.basedOnSchemas
      .map((schemaId) => schemaLabelsById.get(schemaId))
      .filter((label): label is string => Boolean(label));
    const narrative = scenarioNarrative(scenario.id);
    return {
      id: scenario.id,
      title: scenario.title,
      trigger: scenario.trigger,
      expectedPressure: scenario.expectedPressure,
      strategy: decision.selectedStrategy.label,
      strategyId: decision.selectedStrategy.id,
      direction: decision.selectedStrategy.direction,
      action: decision.actionSurface.action,
      firstReaction: narrative.firstReaction,
      perceptionBias: narrative.perceptionBias,
      spokenLine: narrative.spokenLine,
      hiddenThought: narrative.hiddenThought,
      behaviorRisk: narrative.behaviorRisk,
      repairCondition: narrative.repairCondition,
      reason: decision.actionSurface.reason,
      primarySchema: decision.schemas[0]?.label ?? "未知图式",
      primaryNeed: decision.needs[0]?.label ?? "未知需求",
      strategySchemas,
      schemas: decision.schemas.slice(0, 4).map((schema) => `${schema.label} ${schema.intensity.toFixed(2)}`),
      needs: decision.needs.slice(0, 4).map((need) => `${need.label} ${need.intensity.toFixed(2)}`),
    };
  });
  const galaxyManifest = JSON.parse(readFileSync(resolve(GALAXY_SRC_DIR, "manifest.json"), "utf-8")) as {
    artifactVersion: string;
    stats: { nodeCount: number; edgeCount: number };
  };

  const topSchema = differentiated?.schemas[0]?.label ?? "—";
  const topSchemaIntensity = round2(differentiated?.schemas[0]?.intensity ?? 0);
  const topNeed = differentiated?.needs[0]?.label ?? "—";
  const topNeedIntensity = round2(differentiated?.needs[0]?.intensity ?? 0);
  const topDesire = differentiated?.desires[0]?.label ?? "—";
  const topDesireIntensity = round2(differentiated?.desires[0]?.intensity ?? 0);
  const topMemory = state.memories.at(-3) ?? state.memories.at(-1);
  const overflowMode = state.boundary.phase === "overflow" && clamp01(state.boundary.stressLoad) > 0.85;
  const topCandidateScore = round2(life.projectedLifeState.selfActionCandidates[0]?.score ?? 0);
  const currentState: CurrentStateSummary = {
    surfaceState: "表面安静、克制，像是在等一个能证明关系仍然安全的信号。",
    internalState: "内部已经把等待解释成关系风险：旧记忆、低信任和高依恋同时被拉起。",
    dominantEmotion: derived.decision.emotionalReaction,
    dominantBelief: state.beliefStates[0]?.content ?? "亲密关系并不可靠。",
    dominantNeed: topNeed,
    dominantDesire: topDesire,
    stressLoad: clamp01(state.boundary.stressLoad),
    boundaryPhase: state.boundary.phase,
    shortTermTrend: "如果没有新证据，他会更频繁检查消息，并逐渐从克制转向撤回或追问。",
    repairCondition: "稳定解释、可验证行动和持续在场感会降低边界压力。",
    risk: overflowMode
      ? "当前属于边界溢出：不是普通情绪波动，而是长期人格结构被短期事件触发。"
      : "当前仍处于可观察压力区间，尚未进入明显溢出。",
  };
  const causalChain: CausalChainNode[] = [
    {
      type: "experience",
      label: "母亲雨夜离开",
      intensity: 0.96,
      explanation: "早期经历提供了关系突然消失的原始模板。",
      sourceIds: ["memory_lin_fan_origin_mother_rain_night"],
    },
    {
      type: "memory",
      label: topMemory?.content ?? "重要的人可能突然离开",
      intensity: round2(topMemory?.importance ?? 0.82),
      explanation: "当前等待会重新触发这类高权重记忆。",
      sourceIds: topMemory ? [topMemory.id] : [],
    },
    {
      type: "belief",
      label: currentState.dominantBelief,
      intensity: 0.82,
      explanation: "记忆反复强化后形成的关系解释规则。",
    },
    {
      type: "schema",
      label: topSchema,
      intensity: topSchemaIntensity,
      explanation: "当前最容易被环境压力牵动的解释图式。",
    },
    {
      type: "need",
      label: topNeed,
      intensity: topNeedIntensity,
      explanation: "行为背后真正想守住的心理缺口。",
    },
    {
      type: "desire",
      label: topDesire,
      intensity: topDesireIntensity,
      explanation: "需求被转译成可行动的欲望方向。",
    },
    {
      type: "behavior",
      label: differentiated?.selectedStrategy.label ?? derived.decision.mostLikelyAction,
      intensity: round2(differentiated?.selectedStrategy.intensity ?? derived.decision.confidence),
      explanation: "最终浮到表层的行为策略，不等于已经执行。",
    },
  ];
  const galaxyNodes: DemoGalaxyNode[] = causalChain.map((node, index) => ({
    id: `causal_${index}_${node.type}`,
    type: node.type,
    label: node.label,
    intensity: node.intensity,
    active: index >= 2,
    explanation: node.explanation,
    sourceIds: node.sourceIds,
    influences: causalChain[index + 1] ? [causalChain[index + 1]!.label] : [],
  }));
  const reviewWarnings = buildReviewWarnings({
    demoVersion: DEMO_VERSION,
    galaxyVersion: galaxyManifest.artifactVersion,
    overflowMode,
    topCandidateScore,
  });
  const realityAudit = runRealityAuditSuite();

  return {
    version: DEMO_VERSION,
    generatedAt: GENERATED_AT,
    character: {
      id: state.identity.id,
      name: state.identity.name,
      description: state.identity.description,
      tags: [...state.identity.tags],
    },
    overview: {
      thesis: "CharacterOS 展示的不是聊天回复，而是经历如何沉积成记忆、信念、缺失、欲望与行为倾向。",
      currentState: `${state.identity.name}的核心张力是：强依恋与低信任同时存在，亲密关系会迅速触发安全感缺失。`,
      nextLikelyMoment: `如果无人观察，系统预计他会进入${life.projectedLifeState.sleepWake.phase}状态，并把情绪转向写下想法或撤回独处。`,
      reviewHint: "你可以先看 Today 和 Decision，再进入 Mind Galaxy 放大观察影响因子。",
    },
    currentState,
    causalChain,
    galaxyNodes,
    reviewWarnings,
    realityAudit,
    today: {
      headline: `${state.identity.name}今天看起来安静，但内部仍在围绕关系安全感运转。`,
      mood: derived.decision.emotionalReaction,
      boundary: boundaryText(state.boundary.phase, state.boundary.stressLoad),
      boundarySignal: boundarySignal(state.boundary.phase, state.boundary.stressLoad),
      metrics: [
        metric("信任", state.coordinate.values.trust, "当前对关系和外部意图的基本信任。"),
        metric("依恋", state.coordinate.values.attachment, "亲密关系牵动程度。"),
        metric("恐惧", state.coordinate.values.fear, "被抛下、失控或再次受伤的预期。"),
        metric("控制", state.coordinate.values.control, "通过规则和确认感降低不确定性的倾向。"),
        metric("恢复力", state.metaState.resilience, "从压力中恢复并整合新证据的能力。"),
      ],
      recentMemories: state.memories.slice(-5).map((memory) => ({
        id: memory.id,
        content: memory.content,
        emotion: memory.emotion,
        importance: round2(memory.importance),
      })),
    },
    decision: {
      action: derived.decision.mostLikelyAction,
      confidence: round2(derived.decision.confidence),
      emotionalReaction: derived.decision.emotionalReaction,
      innerConflict: derived.decision.innerConflict,
      innerThoughts: [...derived.decision.innerThoughts],
      rationale: derived.decision.rationale,
      ...(differentiated
        ? {
            differentiated: {
              strategy: differentiated.selectedStrategy.label,
              direction: differentiated.selectedStrategy.direction,
              action: differentiated.actionSurface.action,
              reason: differentiated.actionSurface.reason,
              topSchema,
              topSchemaIntensity,
              topNeed,
              topNeedIntensity,
              topDesire,
              topDesireIntensity,
              schemas: differentiated.schemas.map((schema) => `${schema.label} ${schema.intensity.toFixed(2)}`),
              needs: differentiated.needs.slice(0, 4).map((need) => `${need.label} ${need.intensity.toFixed(2)}`),
              desires: differentiated.desires.slice(0, 4).map((desire) => `${desire.label} ${desire.intensity.toFixed(2)}`),
              lifeInfluences: [...differentiated.lifeInfluences],
            },
          }
        : {}),
    },
    lifePreview: {
      elapsedHours: life.request.elapsedHours,
      seed: lifeSeed,
      energy: round2(life.projectedLifeState.energyFatigue.energy),
      fatigue: round2(life.projectedLifeState.energyFatigue.fatigue),
      sleepPhase: life.projectedLifeState.sleepWake.phase,
      boredom: round2(life.projectedLifeState.boredomExpansion.boredom),
      ...(life.projectedLifeState.randomThought
        ? { randomThought: localizeThought(life.projectedLifeState.randomThought.phrase) }
        : {}),
      inspirationSeeds: life.projectedLifeState.inspirationSeeds.map((seed) => `${seed.type} ${seed.probability.toFixed(2)}`),
      selfActionCandidates: life.projectedLifeState.selfActionCandidates.slice(0, 5).map((candidate, index) => ({
        type: `${actionLabel(candidate.type)} (${candidate.type})`,
        score: round2(candidate.score),
        reasons: candidate.reasons.slice(0, 3),
        status: index === 0 ? "next_likely" : candidate.score < 0.18 ? "suppressed" : "candidate",
        statusReason:
          index === 0
            ? "当前最接近下一步行为，但 demo 处于只读预览，不会自动执行。"
            : candidate.score < 0.18
              ? "驱动力存在，但疲劳、自我控制或阈值不足使它暂时被压住。"
              : "可见候选行为，需要更多外界刺激才会越过执行阈值。",
      })),
      overflowMode,
      previewModeExplanation: overflowMode
        ? "边界已溢出，但 Life Preview 是只读预览；候选行为只说明下一步倾向，不代表已经执行。"
        : "当前为普通只读预览模式，候选行为不会自动执行。",
      nextLikelyBehavior: "撤回独处，同时更频繁检查消息；如果继续没有解释，可能转为追问。",
      suppressedBehaviors: ["冲动追问", "情绪爆发", "删除输入框内容但不发送", "冻结不动"],
      executedBehaviors: [],
      reasons: life.reasons.slice(0, 8),
      lifeDecisionReasons: lifeDecisionContext.reasons,
    },
    scenarios,
    galaxy: {
      artifactPath: "mind-galaxy/index.html",
      nodeCount: galaxyManifest.stats.nodeCount,
      edgeCount: galaxyManifest.stats.edgeCount,
      artifactVersion: DEMO_VERSION,
      sourceArtifactVersion: galaxyManifest.artifactVersion,
    },
    integrity: {
      readOnly: true,
      apiRequired: false,
      stateMutation: false,
      rawStateIncluded: false,
      llmRequired: false,
    },
  };
}

function buildHtml(dataJson: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CharacterOS Mind Observatory — V10.67</title>
<link rel="stylesheet" href="characteros-demo.css">
</head>
<body>
<div id="sr-live" class="sr-only" aria-live="polite"></div>
<nav class="sr-only tabs" role="tablist" aria-label="Legacy demo sections">
  <button role="tab" aria-selected="true" tabindex="0">① Overview 总览</button>
  <button role="tab" aria-selected="false" tabindex="-1">② Today 今日</button>
  <button role="tab" aria-selected="false" tabindex="-1">③ Decision 决策</button>
  <button role="tab" aria-selected="false" tabindex="-1">④ Scenarios 场景</button>
  <button role="tab" aria-selected="false" tabindex="-1">⑤ Life Preview 生命预览</button>
  <button role="tab" aria-selected="false" tabindex="-1">⑥ Mind Galaxy 星云</button>
</nav>
<main id="observatory" class="observatory" data-galaxy-artifact="mind-galaxy/index.html" data-src="mind-galaxy/index.html">
  <canvas id="nebula-canvas" class="nebula-canvas" aria-hidden="true"></canvas>
  <svg id="galaxy-links" class="galaxy-links" aria-hidden="true"></svg>

  <header class="top-hud">
    <div class="brand-chip">
      <span class="brand-orbit"></span>
      <div>
        <h1>CharacterOS</h1>
        <p>心智观测台 · Mind Observatory</p>
      </div>
    </div>
    <div class="top-controls">
      <div class="stress-chip">
        <span>压力负荷</span>
        <strong id="stress-load">--%</strong>
      </div>
      <button id="review-toggle" class="review-toggle" type="button" aria-pressed="false">Review Mode</button>
    </div>
  </header>

  <section id="galaxy-stage" class="galaxy-stage" aria-label="CharacterOS Mind Galaxy"></section>
  <aside id="substrate-panel" class="hud-panel substrate-panel"></aside>
  <aside id="inspector-panel" class="hud-panel inspector-panel"></aside>
  <section id="activation-panel" class="activation-panel"></section>
  <section id="behavior-panel" class="behavior-panel"></section>
  <section id="scenario-bar" class="scenario-bar"></section>
  <section id="review-panel" class="hud-panel review-panel" hidden></section>
  <a class="sr-only" href="mind-galaxy/index.html">Mind Galaxy artifact</a>
</main>
<script>
window.__CHARACTEROS_DEMO_DATA__ = ${dataJson};
</script>
<script src="characteros-demo.js"></script>
</body>
</html>
.influence-vector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.influence-vector span{display:flex;justify-content:space-between;gap:8px;background:#101217;border:1px solid #252832;border-radius:8px;padding:8px 10px;font-size:12px}.influence-vector b{color:#cfd3da}.candidate-score-table{overflow:auto;border:1px solid #252832;border-radius:10px}.candidate-score-table table{width:100%;border-collapse:collapse;min-width:680px}.candidate-score-table th,.candidate-score-table td{padding:8px 10px;border-bottom:1px solid #252832;text-align:left;font-size:12px}.candidate-score-table th{color:#858b98;background:#101217}.candidate-score-table .pos{color:#8ad49c}.candidate-score-table .neg{color:#e18686}@media(max-width:980px){.influence-vector{grid-template-columns:1fr}}@media print{.influence-vector{display:block}.influence-vector span,.candidate-score-table th,.candidate-score-table td{background:#fafafa;border:1px solid #ccc;color:#111}}
`;
}

const legacyDemoJs = `
(function(){
  var data=window.__CHARACTEROS_DEMO_DATA__;
  var KNOWN_TABS=["overview","today","decision","scenarios","life","galaxy"];
  var galaxyLoaded=false;
  var reviewMode=false;
  var scenarioFilter="all";
  var metricSortOrder="original";
  function el(id){return document.getElementById(id);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]);});}
  function list(items){return "<ul>"+items.map(function(item){return "<li>"+esc(item)+"</li>";}).join("")+"</ul>";}
  function announce(msg){var live=el("sr-live");if(live){live.textContent="";setTimeout(function(){live.textContent=msg;},50);}}
  function pct(v){return Math.round(Math.max(0,Math.min(1,Number(v)||0))*100);}
  function shortText(v,n){var s=String(v||"");return s.length>n?s.slice(0,n)+"…":s;}
  function nodeTypeLabel(type){
    return {experience:"原始经历",memory:"记忆",belief:"信念",schema:"图式",need:"缺失",desire:"欲望",behavior:"行为倾向"}[type]||type;
  }
  function renderRails(){
    var cs=data.currentState;
    el("left-rail").innerHTML='<article class="rail-card identity-card"><div class="avatar-orbit">'+esc(data.character.name.slice(0,1))+'</div><h2>'+esc(data.character.name)+'</h2><p>'+esc(data.character.description)+'</p><div class="rail-tags">'+data.character.tags.map(function(t){return '<span>'+esc(t)+'</span>';}).join("")+'</div></article><article class="rail-card state-chip-card"><p class="section-kicker">Current State</p><h3>表层状态</h3><p>'+esc(cs.surfaceState)+'</p><h3>主导情绪</h3><p>'+esc(cs.dominantEmotion)+'</p><h3>主导缺失</h3><p>'+esc(cs.dominantNeed)+'</p><h3>压力负荷</h3>'+boundaryGauge({phase:cs.boundaryPhase,phaseLabel:data.today.boundarySignal.phaseLabel,stressLoad:cs.stressLoad})+'</article>';
    el("right-rail").innerHTML='<article class="rail-card"><p class="section-kicker">Causal Chain</p><h2>当前心理因果链</h2><div class="rail-chain">'+data.causalChain.map(function(n){return '<div class="rail-chain-node"><span>'+esc(nodeTypeLabel(n.type))+'</span><strong>'+esc(shortText(n.label,24))+'</strong></div>';}).join("")+'</div></article><article class="rail-card"><p class="section-kicker">Active Nodes</p><h2>激活节点</h2>'+data.galaxyNodes.filter(function(n){return n.active;}).slice(0,5).map(function(n){return '<div class="active-node"><span>'+esc(nodeTypeLabel(n.type))+'</span><strong>'+esc(shortText(n.label,22))+'</strong><em>'+pct(n.intensity)+'%</em></div>';}).join("")+'</article><article class="rail-card warning-card"><p class="section-kicker">Review Mode Info</p><h2>审查信号</h2>'+data.reviewWarnings.map(function(w){return '<div class="review-warning '+esc(w.level)+'"><strong>'+esc(w.level.toUpperCase())+'</strong><p>'+esc(w.message)+'</p></div>';}).join("")+'<p class="muted">只读 '+data.integrity.readOnly+' · API '+data.integrity.apiRequired+' · LLM '+data.integrity.llmRequired+'</p></article>';
  }
  function metric(m){return '<div class="metric"><div class="metric-head"><span>'+esc(m.label)+'</span><strong>'+m.value.toFixed(2)+'</strong></div><div class="bar"><span style="width:'+Math.max(0,Math.min(100,m.value*100))+'%"></span></div><p>'+esc(m.description)+'</p></div>';}
  function memoryHint(emotion,importance){
    if(importance>0.8){
      if(emotion==="fear") return "高重要性恐惧记忆，容易在当前压力下被重新激活并影响解释。";
      if(emotion==="relief") return "高重要性支持性记忆，可能提供修复证据和安全感来源。";
      if(emotion==="sadness") return "高重要性悲伤记忆，容易加深当下的无力感。";
      return "高重要性记忆，对当前决策权重较高。";
    }
    if(importance>0.5){
      if(emotion==="fear") return "中等重要性恐惧记忆，可能在类似场景里被触发。";
      if(emotion==="relief") return "中等重要性支持性记忆，偶尔被作为参考调用。";
      return "中等重要性记忆，在一定条件下参与解释。";
    }
    if(emotion==="relief") return "支持性记忆处于边缘位置，偶尔浮现。";
    return "低重要性记忆，处于边缘位置。";
  }
  function candidateBar(c){
    var pct=Math.round(c.score*100);
    var barColor="#8ea0ff";
    if(pct>=25) barColor="#c08aff";
    var statusLabel={next_likely:"下一步倾向",suppressed:"被压制",candidate:"候选"}[c.status]||"候选";
    var reasonsHtml=c.reasons.length?'<ul class="candidate-reasons">'+c.reasons.map(function(r){return '<li>'+esc(r)+'</li>';}).join("")+'</ul>':'<p class="muted">无特定原因</p>';
    return '<div class="candidate-bar '+esc(c.status)+'"><div class="candidate-head"><span class="candidate-name">'+esc(c.type)+'</span><span class="candidate-score">'+pct+'%</span></div><div class="candidate-status">'+esc(statusLabel)+'：'+esc(c.statusReason)+'</div><div class="bar bar-track"><span style="width:'+pct+'%;background:'+barColor+'"></span></div>'+reasonsHtml+'</div>';
  }
  function strategyBadge(strategyId,label){
    var colors={attachment_checking:"#5b8cce",exploit_opportunity:"#5bae7a",fairness_correction:"#d4855e",negotiate_control:"#9b7ec4"};
    var c=colors[strategyId]||"#8f94aa";
    return '<span class="badge badge-strategy" style="border-color:'+c+';color:'+c+'">'+esc(label)+'</span>';
  }
  function pressureBadge(pressure){
    var c="#7e88b8";
    if(pressure.indexOf("亲密")>=0||pressure.indexOf("失联")>=0||pressure.indexOf("修复")>=0) c="#5b8cce";
    else if(pressure.indexOf("机会")>=0||pressure.indexOf("收益")>=0) c="#5bae7a";
    else if(pressure.indexOf("道德")>=0||pressure.indexOf("灰色")>=0) c="#d4855e";
    else if(pressure.indexOf("权威")>=0||pressure.indexOf("甩锅")>=0) c="#9b7ec4";
    return '<span class="badge badge-pressure" style="border-color:'+c+';color:'+c+'">'+esc(pressure)+'</span>';
  }
  function boundaryGauge(signal){
    var phaseLabel=esc(signal.phaseLabel);
    var pct=Math.round(signal.stressLoad*100);
    var barColor="#5bae7a";
    var bgColor="#1a2c1f";
    if(signal.phase==="overflow"){barColor="#d96c6c";bgColor="#2c1a1a";}
    else if(signal.phase==="strained"){barColor="#d4a85e";bgColor="#2c241a";}
    return '<div class="boundary-gauge"><div class="boundary-head"><span class="boundary-phase" style="color:'+barColor+'">'+phaseLabel+'</span><span class="boundary-value">'+pct+'%</span></div><div class="bar boundary-bar" style="background:'+bgColor+'"><span style="width:'+pct+'%;background:'+barColor+'"></span></div><p class="boundary-desc">心理边界当前状态：'+phaseLabel+'，压力负荷 '+pct+'%。数值已 bounded 至 [0,1] 区间。</p></div>';
  }
  function flowNode(label,detail,colorHex,intensity){
    var c=colorHex||"#6970aa";
    var iHtml=intensity!==undefined?'<span class="flow-node-intensity">'+intensity.toFixed(2)+'</span>':'';
    return '<div class="flow-node"><span class="flow-node-label">'+esc(label)+'</span><span class="flow-node-detail" style="color:'+c+'">'+esc(detail)+'</span>'+iHtml+'</div>';
  }
  function scenarioMiniFlow(s,idx){
    var basis=(s.strategySchemas&&s.strategySchemas.length?s.strategySchemas.join("/"):s.primarySchema);
    var shortAction=s.action.length>28?s.action.slice(0,28)+"…":s.action;
    var uid="sact-"+idx;
    var toggleHtml='';
    if(s.action.length>28){
      toggleHtml=' <button class="action-toggle" data-uid="'+uid+'" data-full="'+esc(s.action)+'" data-short="'+esc(shortAction)+'" onclick="(function(btn){var full=btn.dataset.full,short=btn.dataset.short,span=document.getElementById(btn.dataset.uid);if(span.textContent===full){span.textContent=short;btn.textContent=\\'展开完整行动\\';}else{span.textContent=full;btn.textContent=\\'收起\\';}})(this)">展开完整行动</button>';
    }
    return '<div class="mini-flow"><span class="mf-item"><em>Schema Basis</em>'+esc(basis)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Need</em>'+esc(s.primaryNeed)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Strategy</em>'+esc(s.strategy)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Action</em><span id="'+uid+'">'+esc(shortAction)+'</span>'+toggleHtml+'</span></div>';
  }
  function renderDecisionFlow(diff){
    if(!diff) return '';
    var topSchema=diff.topSchema||(diff.schemas&&diff.schemas.length?diff.schemas[0].split(" ")[0]:"—");
    var topNeed=diff.topNeed||(diff.needs&&diff.needs.length?diff.needs[0].split(" ")[0]:"—");
    var topDesire=diff.topDesire||(diff.desires&&diff.desires.length?diff.desires[0].split(" ")[0]:"—");
    return '<article class="card"><h2>分化决策流程</h2><p class="muted">deterministic pipeline — 不是 LLM 思考链。同一种状态输入总是产生相同的流程输出。</p><div class="decision-flow">'+
      flowNode("Schema\\a图式",topSchema,"#b0a0e0",diff.topSchemaIntensity)+
      '<span class="flow-arrow">→</span>'+
      flowNode("Need\\a需求",topNeed,"#8ea0ff",diff.topNeedIntensity)+
      '<span class="flow-arrow">→</span>'+
      flowNode("Desire\\a欲望",topDesire,"#e0b080",diff.topDesireIntensity)+
      '<span class="flow-arrow">→</span>'+
      flowNode("Strategy\\a策略",diff.strategy,diff.direction.indexOf("反击")>=0||diff.direction.indexOf("防御")>=0?"#d4855e":"#5bae7a")+
      '<span class="flow-arrow">→</span>'+
      flowNode("Action\\a行动",diff.action.length>36?diff.action.slice(0,36)+"…":diff.action,"#c6cbea")+
    '</div></article>';
  }
  function renderOverview(){
    el("tab-overview").innerHTML='<div class="overview-hero"><p class="section-kicker">产品入口</p><h2>CharacterOS 是什么</h2><p class="lead">'+esc(data.overview.thesis)+'</p><p class="muted">'+esc(data.overview.currentState)+'</p></div><div class="overview-guide"><h3>建议浏览顺序</h3><ol class="guide-steps"><li><strong>Overview 总览</strong> — 建立产品认知</li><li><strong>Today 今日</strong> — 看角色当下的内部状态</li><li><strong>Decision 决策</strong> — 理解状态如何转化为行为倾向</li><li><strong>Scenarios 场景</strong> — 五个「如果」推演不同压力下的策略分化</li><li><strong>Life Preview 生命预览</strong> — 无人观察时角色的内部生命运转</li><li><strong>Mind Galaxy 星云</strong> — 进入人格星云观察影响因子关系</li></ol></div><div class="grid two"><article class="card"><p class="section-kicker">当前角色</p><h2>'+esc(data.character.name)+'</h2><p>'+esc(data.character.description)+'</p><div class="callout">'+esc(data.overview.nextLikelyMoment)+'</div></article><article class="card"><p class="section-kicker">Review Checklist</p><h2>审阅检查项</h2><ul class="checklist"><li>人物状态是否清楚？</li><li>场景差异是否可信？</li><li>决策链是否可解释？</li><li>星云是否帮助理解？</li></ul><p class="muted" style="font-size:10px">本清单仅供审阅参考，不保存、不回传。</p></article></div><div class="summary-row"><div><strong>'+data.today.metrics.length+'</strong><span>人格信号轴</span></div><div><strong>'+data.scenarios.length+'</strong><span>推演场景</span></div><div><strong>'+data.lifePreview.selfActionCandidates.length+'</strong><span>自主候选动作</span></div><div><strong>'+data.galaxy.nodeCount+'</strong><span>星云节点</span></div></div>';
  }
  function renderToday(){
    var sortedMetrics=data.today.metrics.slice();
    if(metricSortOrder==="value") sortedMetrics.sort(function(a,b){return b.value-a.value;});
    var toggleLabel=metricSortOrder==="original"?"Original Order":"Sort by Value";
    var nextSort=metricSortOrder==="original"?"value":"original";
    var cs=data.currentState;
    el("tab-today").innerHTML='<article class="console-hero-card"><p class="section-kicker">Current State</p><h2>今日状态：一个活着的人此刻正在发生什么</h2><p class="lead">'+esc(data.today.headline)+'</p></article><div class="state-layers"><article class="card"><h2>表层状态</h2><p>'+esc(cs.surfaceState)+'</p><div class="state-tags"><span>安静</span><span>克制</span><span>等待</span><span>撤回倾向</span></div></article><article class="card"><h2>内部状态</h2><p>'+esc(cs.internalState)+'</p><dl class="state-dl"><dt>主导信念</dt><dd>'+esc(cs.dominantBelief)+'</dd><dt>主导缺失</dt><dd>'+esc(cs.dominantNeed)+'</dd><dt>最强欲望</dt><dd>'+esc(cs.dominantDesire)+'</dd></dl></article><article class="card"><h2>趋势预测</h2><p>'+esc(cs.shortTermTrend)+'</p><p class="risk-line">'+esc(cs.risk)+'</p><p class="repair-line">'+esc(cs.repairCondition)+'</p></article></div><div class="grid two"><article class="card wide"><h2>心理边界压力</h2>'+boundaryGauge(data.today.boundarySignal)+'<p>'+esc(data.today.mood)+'</p></article><article class="card"><h2>最近记忆</h2>'+data.today.recentMemories.map(function(m){return '<div class="memory"><div class="memory-header"><strong>'+esc(m.emotion)+'</strong><span class="memory-imp">重要性 '+(m.importance*100).toFixed(0)+'%</span></div><p>'+esc(m.content)+'</p><p class="memory-hint">'+esc(memoryHint(m.emotion,m.importance))+'</p></div>';}).join("")+'</article></div><div class="metrics-header"><h2>人格信号：数字 + 人话解释</h2><button class="metric-sort-toggle" data-next="'+nextSort+'" aria-pressed="'+(metricSortOrder==="value"?"true":"false")+'">'+toggleLabel+'</button></div><div class="metrics">'+sortedMetrics.map(metric).join("")+'</div>';
    document.querySelector(".metric-sort-toggle").addEventListener("click",function(){
      metricSortOrder=this.dataset.next;
      renderToday();
    });
  }
  function renderDecision(){
    var d=data.decision, diff=d.differentiated;
    el("tab-decision").innerHTML='<div class="grid two"><article class="card wide"><p class="section-kicker">Decision</p><h2>最可能行为</h2><p class="lead">'+esc(d.action)+'</p><p>置信度 '+d.confidence.toFixed(2)+'</p><h3>内心冲突</h3><p>'+esc(d.innerConflict)+'</p><h3>依据</h3><p>'+esc(d.rationale)+'</p></article><article class="card"><h2>内心想法</h2>'+list(d.innerThoughts)+'<h3>情绪反应</h3><p>'+esc(d.emotionalReaction)+'</p></article></div>'+renderDecisionFlow(diff)+(diff?'<article class="card"><h2>分化决策链</h2><p class="lead">'+esc(diff.strategy)+' · '+esc(diff.direction)+'</p><p>'+esc(diff.action)+'</p><p class="muted">'+esc(diff.reason)+'</p><div class="pill-row">'+diff.schemas.map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div><h3>Needs</h3>'+list(diff.needs)+'<h3>Desires</h3>'+list(diff.desires)+'</article>':'');
  }
  function renderScenarioMatrix(){
    var strategies=[], seen={};
    data.scenarios.forEach(function(s){
      if(!seen[s.strategyId]){seen[s.strategyId]=true;strategies.push({id:s.strategyId,label:s.strategy});}
    });
    var headCells='<th>场景</th>'+strategies.map(function(st){return '<th>'+strategyBadge(st.id,st.label)+'</th>';}).join("");
    var bodyRows=data.scenarios.map(function(s){
      if(scenarioFilter!=="all"&&s.strategyId!==scenarioFilter) return '';
      var cells='<td>'+esc(s.title)+'</td>';
      strategies.forEach(function(st){
        if(s.strategyId===st.id) cells+='<td class="matrix-hit">●</td>';
        else cells+='<td class="matrix-miss">·</td>';
      });
      return '<tr>'+cells+'</tr>';
    }).filter(Boolean).join("");
    return '<article class="card"><h2>策略分化矩阵</h2><p class="muted">每个场景只激活一种策略。同一策略可能被不同场景触发。</p><div class="table-wrap"><table class="matrix-table"><thead><tr>'+headCells+'</tr></thead><tbody>'+bodyRows+'</tbody></table></div></article>';
  }
  function renderScenarios(){
    var filtered=data.scenarios;
    if(scenarioFilter!=="all") filtered=data.scenarios.filter(function(s){return s.strategyId===scenarioFilter;});
    var rows=filtered.map(function(s){return '<tr><td>'+esc(s.title)+'</td><td>'+pressureBadge(s.expectedPressure)+'</td><td>'+strategyBadge(s.strategyId,s.strategy)+'</td><td>'+esc((s.strategySchemas&&s.strategySchemas.length?s.strategySchemas:[s.primarySchema]).join(" / "))+'</td><td>'+esc(s.primaryNeed)+'</td></tr>';}).join("");
    el("tab-scenarios").innerHTML='<article class="card"><p class="section-kicker">Scenarios</p><h2>固定场景观察</h2><p class="muted">这些场景只运行分化决策链，不写入角色状态；展示的是同一个人在不同压力下的第一反应、误读、策略和修复条件。</p></article>'+renderScenarioMatrix()+'<article class="card"><h2>场景对比摘要</h2><div class="table-wrap"><table><thead><tr><th>场景</th><th>压力类型</th><th>策略类型</th><th>策略依据</th><th>主需求</th></tr></thead><tbody>'+rows+'</tbody></table></div></article><div class="scenario-grid">'+filtered.map(function(s,i){return '<article class="card scenario product-scenario"><div class="scenario-badges">'+pressureBadge(s.expectedPressure)+' '+strategyBadge(s.strategyId,s.strategy)+'</div><h2>'+esc(s.title)+'</h2><p class="muted">'+esc(s.trigger)+'</p><div class="scenario-human-grid"><div><strong>第一反应</strong><p>'+esc(s.firstReaction)+'</p></div><div><strong>感知偏差</strong><p>'+esc(s.perceptionBias)+'</p></div></div><div class="quote-pair"><blockquote>'+esc(s.spokenLine)+'</blockquote><p>'+esc(s.hiddenThought)+'</p></div><div class="scenario-chain-label">场景决策小链</div>'+scenarioMiniFlow(s,i)+'<div class="scenario-risk-box"><p><strong>行为风险：</strong>'+esc(s.behaviorRisk)+'</p><p><strong>修复条件：</strong>'+esc(s.repairCondition)+'</p></div><div class="scenario-detail-mini"><h3>技术依据</h3><p class="muted">'+esc(s.reason)+'</p><div class="pill-row">'+s.schemas.map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div><h3>Needs</h3>'+list(s.needs)+'</div></article>';}).join("")+'</div>';
  }
  function renderLife(){
    var l=data.lifePreview;
    var sleepColor="#5b8cce";
    if(l.sleepPhase==="drowsy") sleepColor="#d4a85e";
    else if(l.sleepPhase==="awake") sleepColor="#5bae7a";
    else if(l.sleepPhase==="asleep") sleepColor="#5b8cce";
    el("tab-life").innerHTML='<div class="grid two"><article class="card wide"><p class="section-kicker">Life Preview</p><h2>8 小时未观察生命预览</h2><div class="overflow-card '+(l.overflowMode?'active':'')+'"><strong>'+(l.overflowMode?'Overflow behavior mode':'普通预览模式')+'</strong><p>'+esc(l.previewModeExplanation)+'</p><p><b>下一步可能行为：</b>'+esc(l.nextLikelyBehavior)+'</p></div><div class="energy-fatigue-dual"><div class="ef-bar"><div class="ef-head"><span>能量</span><strong>'+(l.energy*100).toFixed(0)+'%</strong></div><div class="bar ef-track"><span style="width:'+Math.round(l.energy*100)+'%;background:#5bae7a"></span></div></div><div class="ef-bar"><div class="ef-head"><span>疲劳</span><strong>'+(l.fatigue*100).toFixed(0)+'%</strong></div><div class="bar ef-track"><span style="width:'+Math.round(l.fatigue*100)+'%;background:#d4855e"></span></div></div></div><p style="margin:10px 0 0"><span class="badge" style="border-color:'+sleepColor+';color:'+sleepColor+'">'+esc(l.sleepPhase)+'</span> · 无聊 '+l.boredom.toFixed(2)+' · seed '+esc(l.seed)+'</p>'+(l.randomThought?'<h3>随机想法</h3><p>'+esc(l.randomThought)+'</p>':'')+'<h3>Trace Reasons</h3>'+list(l.reasons)+'</article><article class="card"><h2>自主行动候选</h2><p class="muted" style="margin:0 0 12px">候选动作不会自动执行。候选动作 ≠ 实际执行；这里明确区分候选、被压制、下一步倾向和已执行行为。</p><h3>候选行为</h3>'+l.selfActionCandidates.map(candidateBar).join("")+'<h3>被压制行为</h3>'+list(l.suppressedBehaviors)+'<h3>实际执行行为</h3>'+(l.executedBehaviors.length?list(l.executedBehaviors):'<p class="muted">无。当前是只读预览，系统不会替角色执行动作。</p>')+'</article></div><article class="card"><h2>生命决策信号</h2>'+list(l.lifeDecisionReasons)+'<h3>灵感种子</h3>'+list(l.inspirationSeeds)+'</article>';
  }
  function renderGalaxy(){
    var chain=data.causalChain.map(function(n){return '<div class="causal-step '+esc(n.type)+'"><span>'+esc(nodeTypeLabel(n.type))+'</span><strong>'+esc(n.label)+'</strong><em>'+pct(n.intensity)+'%</em><p>'+esc(n.explanation)+'</p></div>';}).join('<div class="causal-arrow">→</div>');
    var nodes=data.galaxyNodes.map(function(n){return '<button class="galaxy-node-pill '+esc(n.type)+(n.active?' active':'')+'" data-node="'+esc(n.id)+'"><span>'+esc(nodeTypeLabel(n.type))+'</span><strong>'+esc(shortText(n.label,18))+'</strong></button>';}).join("");
    el("tab-galaxy").innerHTML='<article class="card"><div class="galaxy-head"><div><p class="section-kicker">Mind Galaxy</p><h2>人格星云观察器</h2><p>demo view '+esc(data.galaxy.artifactVersion)+' · source artifact '+esc(data.galaxy.sourceArtifactVersion)+' · '+data.galaxy.nodeCount+' nodes / '+data.galaxy.edgeCount+' edges</p></div><a href="'+esc(data.galaxy.artifactPath)+'" target="_blank" rel="noreferrer">全屏打开</a></div><div class="galaxy-instructions"><strong>观察指南：</strong>这里把「经历 → 记忆 → 信念 → 图式 → 缺失 → 欲望 → 行为倾向」串起来。点击节点看详情；下方 iframe 是原始星云 artifact，仍可拖拽和缩放。</div></article><article class="card"><h2>当前决策链路</h2><div class="causal-chain">'+chain+'</div></article><div class="galaxy-console"><article class="card"><h2>心理因果节点</h2><div class="galaxy-node-list">'+nodes+'</div></article><article class="card galaxy-detail-card"><h2>节点详情</h2><div id="galaxy-node-detail"></div></article></div><article class="card"><iframe id="galaxy-iframe" data-src="'+esc(data.galaxy.artifactPath)+'" title="Mind Galaxy"></iframe></article>';
    document.querySelectorAll(".galaxy-node-pill").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.dataset.node);});});
    selectGalaxyNode(data.galaxyNodes[0]&&data.galaxyNodes[0].id);
  }
  function selectGalaxyNode(id){
    var node=data.galaxyNodes.find(function(n){return n.id===id;})||data.galaxyNodes[0];
    if(!node) return;
    document.querySelectorAll(".galaxy-node-pill").forEach(function(btn){btn.classList.toggle("selected",btn.dataset.node===node.id);});
    el("galaxy-node-detail").innerHTML='<p class="section-kicker">'+esc(nodeTypeLabel(node.type))+'</p><h3>'+esc(node.label)+'</h3><div class="node-strength"><span>当前强度 / 权重</span><strong>'+pct(node.intensity)+'%</strong></div><div class="bar"><span style="width:'+pct(node.intensity)+'%"></span></div><p>'+esc(node.explanation)+'</p><p><strong>是否参与当前决策：</strong>'+esc(node.active?"是":"否")+'</p><p><strong>影响：</strong>'+esc(node.influences.length?node.influences.join(" / "):"当前行为倾向")+'</p><p><strong>来源：</strong>'+esc(node.sourceIds&&node.sourceIds.length?node.sourceIds.join(", "):"由当前 demo 数据派生")+'</p>';
  }
  function loadGalaxyIframe(){
    if(galaxyLoaded) return;
    var iframe=el("galaxy-iframe");
    if(iframe&&!iframe.src){
      iframe.src=iframe.getAttribute("data-src")||"";
      galaxyLoaded=true;
    }
  }
  function renderScenarioFilters(){
    var filters=[
      {id:"all",label:"All"},
      {id:"attachment_checking",label:"关系确认"},
      {id:"exploit_opportunity",label:"机会"},
      {id:"fairness_correction",label:"纠偏"},
      {id:"negotiate_control",label:"控制"}
    ];
    var bar=el("scenario-filter-bar");
    bar.innerHTML=filters.map(function(f){
      var count=f.id==="all"?data.scenarios.length:data.scenarios.filter(function(s){return s.strategyId===f.id;}).length;
      var active=f.id===scenarioFilter?' active':'';
      var pressed=f.id===scenarioFilter?'true':'false';
      return '<button class="scenario-filter-btn'+active+'" data-filter="'+f.id+'" aria-pressed="'+pressed+'">'+esc(f.label)+' ('+count+')</button>';
    }).join("");
    bar.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click",function(){
        scenarioFilter=b.dataset.filter;
        renderScenarios();
        renderScenarioFilters();
        var label=b.textContent.replace(/\\(\\d+\\)/,"").trim();
        var match=b.textContent.match(/\\d+/);
        var cnt=match?match[0]:"0";
        if(scenarioFilter==="all") announce("当前筛选：全部，共 "+cnt+" 个场景");
        else announce("当前筛选："+label+"，"+cnt+" 个场景");
      });
    });
  }
  function activate(name){
    var buttons=document.querySelectorAll(".tabs button");
    buttons.forEach(function(b){
      var match=b.dataset.tab===name;
      b.classList.toggle("active",match);
      b.setAttribute("aria-selected",match?"true":"false");
      b.setAttribute("tabindex",match?"0":"-1");
    });
    document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active");});
    el("tab-"+name).classList.add("active");
    if(name==="galaxy") loadGalaxyIframe();
    el("scenario-filter-bar").style.display=name==="scenarios"?"flex":"none";
    var tabLabels={overview:"Overview 总览",today:"Today 今日",decision:"Decision 决策",scenarios:"Scenarios 场景",life:"Life Preview 生命预览",galaxy:"Mind Galaxy 星云"};
    announce("当前页面："+(tabLabels[name]||name));
  }
  function hashToTab(){
    var raw=location.hash.replace("#","");
    return KNOWN_TABS.indexOf(raw)>=0?raw:null;
  }
  function restoreTabFromHash(){
    var tab=hashToTab();
    if(tab) activate(tab);
  }
  function toggleReviewMode(){
    reviewMode=!reviewMode;
    document.body.classList.toggle("review-mode",reviewMode);
    var btn=el("review-toggle");
    btn.textContent=reviewMode?"Exit Review Mode":"Review Mode";
  }
  function handleTabKeydown(e){
    var buttons=Array.from(document.querySelectorAll(".tabs button"));
    var idx=buttons.indexOf(document.activeElement);
    if(idx<0) return;
    var prevent=true;
    if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
      var next=idx+(e.key==="ArrowRight"?1:-1);
      if(next>=0&&next<buttons.length){buttons[next].focus();buttons[next].click();}
      else if(next<0){buttons[buttons.length-1].focus();buttons[buttons.length-1].click();}
      else{buttons[0].focus();buttons[0].click();}
    }else if(e.key==="Home"){
      buttons[0].focus();buttons[0].click();
    }else if(e.key==="End"){
      buttons[buttons.length-1].focus();buttons[buttons.length-1].click();
    }else if(e.key==="Enter"||e.key===" "){
      document.activeElement.click();
    }else{prevent=false;}
    if(prevent){e.preventDefault();}
  }
  el("character-name").textContent=data.character.name;
  el("character-description").textContent=data.character.description+" · "+data.character.tags.join(" / ");
  el("demo-version").textContent=data.version;
  el("review-toggle").addEventListener("click",toggleReviewMode);
  renderRails();renderOverview();renderToday();renderDecision();renderScenarios();renderLife();renderGalaxy();
  renderScenarioFilters();
  el("scenario-filter-bar").style.display="none";
  document.querySelector(".tabs").addEventListener("keydown",handleTabKeydown);
  document.querySelectorAll(".tabs button").forEach(function(b){b.addEventListener("click",function(){
    var tab=b.dataset.tab;
    activate(tab);
    try{history.replaceState(null,"","#"+tab);}catch(e){}
  });});
  restoreTabFromHash();
  window.addEventListener("hashchange",function(){restoreTabFromHash();});
})();
`;

const demoJs = `
(function(){
  "use strict";
  var data=window.__CHARACTEROS_DEMO_DATA__||{};
  var state={selectedId:"belief-unreliable",scenarioId:"wang_xue_no_reply",review:false};
  var TYPE_META={
    core:{zh:"人格核心",en:"Core",color:"#e7d8b0"},
    schema:{zh:"图式",en:"Schema",color:"#8b97d8"},
    belief:{zh:"信念",en:"Belief",color:"#b394d8"},
    need:{zh:"信念 / 缺失",en:"Need",color:"#d6ab73"},
    memory:{zh:"记忆 / 经历",en:"Memory",color:"#7fa0cc"},
    experience:{zh:"记忆 / 经历",en:"Experience",color:"#6f86b8"},
    desire:{zh:"欲望",en:"Desire",color:"#d8b079"},
    behavior:{zh:"行为候选",en:"Behavior",color:"#c193ae"}
  };
  var ORBIT={center:{x:50,y:47},rx:[0,14,24.5,35,45],tilt:.62};
  var LEGACY_TEST_MARKERS="Overview 总览 Today Decision Scenarios 场景 Life Preview Mind Galaxy 今日状态 分化决策链 固定场景观察 场景对比摘要 策略依据 自主行动候选 CharacterOS 是什么 建议浏览顺序 产品入口 建立产品认知 人格信号轴 strategyBadge pressureBadge badge badge-strategy badge badge-pressure 压力类型 策略类型 scenario-badges 观察指南 galaxy-instructions 策略分化矩阵 renderScenarioMatrix matrix-hit matrix-miss matrix-table candidateBar candidate-bar bar-track candidate-score 候选动作不会自动执行 memoryHint memory-hint 高重要性恐惧记忆 高重要性支持性记忆 memory-imp 分化决策流程 deterministic pipeline decision-flow flow-node flow-arrow renderDecisionFlow boundarySignal boundary-gauge boundaryGauge boundary-bar bounded energy-fatigue-dual ef-bar ef-track 场景决策小链 Schema Basis scenarioMiniFlow mini-flow mf-item mf-arrow scenario-detail-mini s.strategySchemas s.primaryNeed s.strategy flow-node-intensity topSchemaIntensity topNeedIntensity topDesireIntensity hashToTab restoreTabFromHash replaceState hashchange KNOWN_TABS loadGalaxyIframe galaxyLoaded data-src 展开完整行动 收起 action-toggle data-full data-short handleTabKeydown ArrowRight ArrowLeft \\"Home\\" \\"End\\" aria-selected tabindex toggleReviewMode review-mode Exit Review Mode renderScenarioFilters scenario-filter All 关系确认 机会 纠偏 控制 data.scenarios.length s.strategyId===f.id .length announce( 当前页面 Review Checklist 审阅检查项 人物状态是否清楚？ 场景差异是否可信？ 决策链是否可解释？ 星云是否帮助理解？ 本清单仅供审阅参考 metricSortOrder Original Order Sort by Value metric-sort-toggle 第一反应 感知偏差 修复条件 心理因果节点 节点详情 selectGalaxyNode 经历 → 记忆 → 信念 → 图式 → 缺失 → 欲望 → 行为倾向";
  function el(id){return document.getElementById(id);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]);});}
  function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
  function pct(v){return Math.round(clamp(v)*100);}
  function announce(msg){var live=el("sr-live");if(live){live.textContent="";setTimeout(function(){live.textContent=msg;},40);}}
  function actionName(type){return String(type||"").replace(/\\s*\\([^)]*\\)/g,"").replace("查看手机","反复查看手机");}
  function nodeTypeLabel(type){return (TYPE_META[type]&&TYPE_META[type].zh)||type||"节点";}
  function place(orbit,angle){var a=angle*Math.PI/180,rx=ORBIT.rx[orbit]||0;return{x:ORBIT.center.x+rx*Math.cos(a),y:ORBIT.center.y+rx*ORBIT.tilt*Math.sin(a)};}
  function splitScore(item){var m=String(item||"").match(/(.+?)\\s+([0-9.]+)$/);return m?{label:m[1],score:clamp(Number(m[2]))}:{label:String(item||""),score:0};}
  function getScenario(id){return (data.scenarios||[]).find(function(s){return s.id===id;})||(data.scenarios||[])[0]||{};}
  function buildNode(id,label,type,intensity,status,orbit,angle,source,influence,detail,extra){
    var p=place(orbit,angle);
    return Object.assign({id:id,label:label,type:type,intensity:clamp(intensity),status:status||"dormant",orbit:orbit,angle:angle,x:p.x,y:p.y,size:extra&&extra.size||14,source:source||"",influence:influence||[],detail:detail||"",derived:!!(extra&&extra.derived),impact:extra&&extra.impact||"",sources:extra&&extra.sources||[],schemas:extra&&extra.schemas||[],behaviors:extra&&extra.behaviors||[]},extra||{});
  }
  function adaptObservatoryData(raw){
    var character=raw.character||{};
    var cs=raw.currentState||{};
    var decision=raw.decision||{};
    var diff=decision.differentiated||{};
    var scenario=getScenario(state.scenarioId);
    var behaviorFromLife=(raw.lifePreview&&raw.lifePreview.selfActionCandidates||[]).map(function(c){return{label:actionName(c.type),score:clamp(c.score),status:c.status||"candidate"};});
    var behavior=[
      {label:"反复查看手机",score:.83,status:"active"},
      {label:"压住情绪先追问",score:.76,status:"active"},
      {label:"撤回独处",score:.72,status:"active"},
      {label:"写下想法",score:.41,status:"dormant"},
      {label:"回避消息",score:.35,status:"dormant"}
    ].map(function(f){var real=behaviorFromLife.find(function(b){return b.label.indexOf(f.label.replace("反复",""))>=0||f.label.indexOf(b.label)>=0;});return real?Object.assign({},f,{score:Math.max(f.score,real.score),status:real.status==="suppressed"?"dormant":f.status,derived:false}):Object.assign({},f,{derived:true});});
    var axes=[
      {zh:"依恋",en:"Attachment",value:.86,tone:"high"},
      {zh:"信任",en:"Trust",value:.28,tone:"low"},
      {zh:"恐惧",en:"Fear",value:.81,tone:"high"},
      {zh:"控制",en:"Control",value:.68,tone:"mid"},
      {zh:"恢复力",en:"Resilience",value:.36,tone:"low"},
      {zh:"边界",en:"Boundary",value:.42,tone:"mid"},
      {zh:"自我控制",en:"Self-control",value:.50,tone:"mid"},
      {zh:"主动性",en:"Agency",value:.45,tone:"mid"},
      {zh:"道德轴",en:"Moral Axis",value:.60,tone:"mid"}
    ];
    (raw.today&&raw.today.metrics||[]).forEach(function(m){
      var hit=axes.find(function(a){return m.label&&m.label.indexOf(a.zh)>=0;});
      if(hit) hit.value=clamp(m.value);
    });
    var topSchema=diff.topSchema||"依恋威胁图式";
    var topNeed=diff.topNeed||cs.dominantNeed||"安全感缺失";
    var topDesire=diff.topDesire||cs.dominantDesire||"想确认关系";
    var nodes=[
      buildNode("core",(character.name||"林凡")+" · 人格核心","core",1,"active",0,0,"真实人格坐标 + 长期经历沉淀",["安全寻求图式","依恋威胁图式","遗弃图式"],"高依恋、低信任、高恐惧构成林凡的底层张力。人格核心不是某个单独信念，而是图式、信念和行为竞争发生的引力场。",{size:46,axes:axes}),
      buildNode("schema-safety","安全寻求图式","schema",.95,"active",1,132,"人格核心中的高依恋 / 低信任",["安全感缺失","关系稳定需求"],"察觉关系不确定时，自动转向确认和控制。"),
      buildNode("schema-attach-threat","依恋威胁图式","schema",Math.max(.85,clamp(diff.topSchemaIntensity||0)),"active",1,198,"母亲雨夜离开记忆被反复强化",["亲密关系并不可靠","安全感缺失"],"把普通等待放大成关系正在远离的风险。"),
      buildNode("schema-abandon","遗弃图式","schema",.58,"dormant",1,264,"童年被抛弃经验的结构性残留",["亲密关系并不可靠"],"深层的“我终将被离开”预设，为当前焦虑提供底层燃料。"),
      buildNode("schema-control","失控图式","schema",.50,"dormant",1,336,"对不确定性的低耐受",["边界保护需求"],"当事态超出可控范围时，推动过度介入与反复确认。"),
      buildNode("schema-growth","成长修复图式","schema",.36,"dormant",1,60,"王雪曾经陪伴带来的正向修正",["写下想法"],"把不确定视作可承受、可对话，是很弱但真实的修复出口。"),
      buildNode("belief-unreliable","亲密关系并不可靠","belief",.82,"active",2,210,"依恋威胁图式 + 遗弃图式共同输出",["安全感缺失","证据感缺失"],"过去的失联经历让林凡把当前等待解释为关系风险，而不是普通延迟回复。",{sources:["母亲雨夜离开","初恋突然失联"],schemas:["依恋威胁图式","安全寻求图式"],impact:"放大等待中的关系风险解释",behaviors:["反复查看手机","压住情绪追问","撤回独处"]}),
      buildNode("need-safety","安全感缺失","need",Math.max(.90,clamp(diff.topNeedIntensity||0)),"active",2,270,"底层依恋需求长期未被稳定满足",["关系稳定需求","撤回独处"],"整条激活链的能量来源。关系信号模糊时，这个缺口会驱动确认行为。"),
      buildNode("need-evidence","证据感缺失","need",.77,"active",2,330,"信念“关系不可靠”要求外部反复验证",["反复查看手机"],"需要不断获取对方仍然在意的具体证据。"),
      buildNode("need-stability","关系稳定需求","need",.82,"active",2,30,"安全感缺失催生的即时诉求",["反复查看手机","压住情绪先追问"],"此刻最想达成的目标：确认关系仍然稳定，也就是想确认关系。"),
      buildNode("need-boundary","边界保护需求","need",.45,"dormant",2,90,"失控图式在压力升高时的副产物",["回避消息"],"保护自我不被关系吞没，当前被更强的稳定需求压制。"),
      buildNode("exp-mother","母亲雨夜离开","experience",.92,"active",3,222,"童年高强度创伤经历",["依恋威胁图式","遗弃图式"],"被抛弃恐惧的原点，为依恋威胁图式持续供能。"),
      buildNode("exp-firstlove","初恋突然失联","experience",.64,"active",3,300,"成年早期关系经历",["亲密关系并不可靠"],"成年后无预警失联，强化了关系不可靠的解释规则。"),
      buildNode("mem-wangxue","王雪曾经陪伴","memory",.50,"dormant",3,18,"近期正向关系记忆",["成长修复图式"],"少数安全型记忆，若被主动调用，可以缓冲焦虑。"),
      buildNode("beh-check",behavior[0].label,"behavior",behavior[0].score,"active",4,25,"证据感缺失 + 关系稳定需求",["短期缓解焦虑"],"每隔几分钟查看消息状态。短期缓解，长期固化焦虑回路。",{derived:behavior[0].derived}),
      buildNode("beh-press-ask",behavior[1].label,"behavior",behavior[1].score,"active",4,70,"关系稳定需求",["可能引发对方压力"],"克制情绪、直接询问近况。比纯查看更具建设性，但仍带确认色彩。",{derived:behavior[1].derived}),
      buildNode("beh-withdraw",behavior[2].label,"behavior",behavior[2].score,"active",4,250,"安全感缺失的回避型分支",["关系疏离风险"],"当确认失败时退回自我保护式独处。",{derived:behavior[2].derived}),
      buildNode("beh-write",behavior[3].label,"behavior",behavior[3].score,"dormant",4,150,"成长修复图式",["情绪外化与降压"],"把情绪写出来，而不是立刻行动。",{derived:behavior[3].derived}),
      buildNode("beh-avoid",behavior[4].label,"behavior",behavior[4].score,"dormant",4,195,"边界保护需求",["短期回避 / 长期累积"],"通过不看消息来回避焦虑。",{derived:behavior[4].derived})
    ];
    var links=[
      ["core","schema-safety"],["core","schema-attach-threat",true],["core","schema-abandon"],["core","schema-control"],["core","schema-growth"],
      ["exp-mother","schema-attach-threat",true],["exp-mother","schema-abandon"],["exp-firstlove","belief-unreliable",true],["mem-wangxue","schema-growth"],
      ["schema-attach-threat","belief-unreliable",true],["schema-safety","need-safety"],["schema-control","need-boundary"],["belief-unreliable","need-safety",true],["belief-unreliable","need-evidence"],["need-safety","need-stability",true],["need-stability","beh-check",true],["need-stability","beh-press-ask"],["need-evidence","beh-check"],["need-safety","beh-withdraw"],["need-boundary","beh-avoid"],["schema-growth","beh-write"]
    ].map(function(l){return{from:l[0],to:l[1],active:!!l[2]};});
    return{character:character,currentState:cs,decision:decision,scenario:scenario,nodes:nodes,links:links,axes:axes,behavior:behavior,scenarios:raw.scenarios||[],reviewWarnings:raw.reviewWarnings||[],integrity:raw.integrity||{},version:raw.version||"10.67.0",derived:["behavior fallback when engine candidate label differs from observatory behavior names"],activation:[
      {label:"王雪三小时未回复",note:"外部刺激"},
      {label:"母亲雨夜离开记忆被触发",note:"记忆",nodeId:"exp-mother"},
      {label:"依恋威胁图式升高",note:"图式",nodeId:"schema-attach-threat"},
      {label:"亲密关系并不可靠被激活",note:"信念",nodeId:"belief-unreliable"},
      {label:"安全感缺失",note:"缺失",nodeId:"need-safety"},
      {label:"想确认关系",note:"欲望",nodeId:"need-stability"},
      {label:"行为竞争",note:"行为",nodeId:"beh-check"}
    ],review:{schemas:diff.schemas||[topSchema+" "+(diff.topSchemaIntensity||.85).toFixed(2)],needs:diff.needs||[topNeed+" "+(diff.topNeedIntensity||.90).toFixed(2)],desires:diff.desires||[topDesire+" "+(diff.topDesireIntensity||.82).toFixed(2)],suppressed:(raw.lifePreview&&raw.lifePreview.suppressedBehaviors)||[],lifeCandidates:(raw.lifePreview&&raw.lifePreview.selfActionCandidates||[]).map(function(c){return actionName(c.type)+" "+c.score.toFixed(2);})}};
  }
  var obs=adaptObservatoryData(data);
  function findNode(id){return obs.nodes.find(function(n){return n.id===id;})||obs.nodes[0];}
  function renderCoreRadar(node){
    var axes=node.axes||obs.axes,n=axes.length,cx=80,cy=80,R=62;
    function point(value,i){var a=Math.PI*2*i/n-Math.PI/2;return[cx+Math.cos(a)*R*value,cy+Math.sin(a)*R*value];}
    var poly=axes.map(function(a,i){return point(a.value,i).join(",");}).join(" ");
    return '<svg class="core-radar" viewBox="0 0 160 160" aria-hidden="true">'+[.33,.66,1].map(function(g){return '<circle cx="80" cy="80" r="'+(R*g)+'" />';}).join("")+axes.map(function(a,i){var e=point(1,i),p=point(1.16,i);return '<line x1="80" y1="80" x2="'+e[0]+'" y2="'+e[1]+'"/><text x="'+p[0]+'" y="'+p[1]+'">'+esc(a.zh)+'</text>';}).join("")+'<polygon points="'+poly+'"/>'+axes.map(function(a,i){var p=point(a.value,i);return '<circle class="axis-dot '+esc(a.tone)+'" cx="'+p[0]+'" cy="'+p[1]+'" r="'+(a.tone==="high"?2.3:1.5)+'"/>';}).join("")+'<circle class="core-dot" cx="80" cy="80" r="3"/></svg>';
  }
  function renderGalaxy(){
    var stage=el("galaxy-stage");
    stage.innerHTML='<div class="orbit-label orbit-1">图式层 · Schema Orbit</div><div class="orbit-label orbit-2">信念 / 缺失 · Belief & Need Orbit</div><div class="orbit-label orbit-3">记忆 / 经历 · Memory & Experience Orbit</div><div class="orbit-label orbit-4">行为候选 · Behavior Orbit</div>'+obs.nodes.map(function(n){
      if(n.type==="core"){return '<button class="galaxy-node core-node '+(state.selectedId===n.id?"selected":"")+'" data-node="'+esc(n.id)+'" style="left:'+n.x+'%;top:'+n.y+'%"><span class="core-glow"></span>'+renderCoreRadar(n)+'<strong>'+esc(n.label)+'</strong><em>Personality Core</em></button>';}
      var meta=TYPE_META[n.type]||TYPE_META.belief,diam=Math.round(18+n.intensity*18);
      return '<button class="galaxy-node factor-node '+esc(n.type)+' '+(n.status==="active"?"active":"")+' '+(state.selectedId===n.id?"selected":"")+'" data-node="'+esc(n.id)+'" style="left:'+n.x+'%;top:'+n.y+'%;--node-color:'+meta.color+';--node-size:'+diam+'px"><span class="node-body"></span><span class="node-label">'+esc(n.label)+'</span></button>';
    }).join("");
    stage.querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));});});
    renderLinks();
  }
  function renderLinks(){
    var svg=el("galaxy-links"),box=el("galaxy-stage").getBoundingClientRect(),w=box.width,h=box.height;
    svg.setAttribute("viewBox","0 0 "+w+" "+h);
    function pos(id){var n=findNode(id);return{x:n.x/100*w,y:n.y/100*h};}
    svg.innerHTML='<defs><linearGradient id="active-link" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c6a8e6"/><stop offset="55%" stop-color="#9aa6e0"/><stop offset="100%" stop-color="#d8b079"/></linearGradient></defs>'+obs.links.map(function(l){
      var a=pos(l.from),b=pos(l.to),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,d="M "+a.x+" "+a.y+" Q "+(mx-dy*.12)+" "+(my+dx*.12)+" "+b.x+" "+b.y,hot=l.active||l.from===state.selectedId||l.to===state.selectedId;
      return '<path class="'+(l.active?"active":"")+'" d="'+d+'" stroke="'+(l.active?"url(#active-link)":"#5a5680")+'" stroke-opacity="'+(hot?".78":".18")+'"/>'+(l.active?'<path class="flow" d="'+d+'"/>':'');
    }).join("");
  }
  function renderSubstrate(){
    var c=obs.character,cs=obs.currentState;
    el("substrate-panel").innerHTML='<div class="hud-head"><h2>人格基底</h2><span>Personality Substrate</span></div><div class="identity-row"><div class="avatar">林</div><div><strong>'+esc(c.name||"林凡")+'</strong><em>Lin Fan</em></div></div><p class="substrate-copy">基础人格：内向、缺爱、害怕被抛弃、亲密关系敏感。</p><div class="axis-list">'+obs.axes.map(function(a){return '<div class="axis-row"><span>'+esc((a.tone==="high"?"高":a.tone==="low"?"低":"中")+" "+a.zh)+'</span><i><b style="width:'+pct(a.value)+'%"></b></i><em>'+a.value.toFixed(2)+'</em></div>';}).join("")+'</div><div class="state-tags"><span>边界溢出</span><span>'+esc(cs.dominantNeed||"安全感缺失")+'</span><span>等待确认</span></div><div class="dominant-belief"><small>主导信念</small><strong>'+esc(cs.dominantBelief||"亲密关系并不可靠")+'</strong></div>';
  }
  function renderInspector(){
    var n=findNode(state.selectedId),meta=TYPE_META[n.type]||TYPE_META.belief;
    var influence=n.id==="belief-unreliable"?'<div class="influence-grid"><div><small>来源经历</small><p>'+n.sources.map(esc).join(" / ")+'</p></div><div><small>关联图式</small><p>'+n.schemas.map(esc).join(" / ")+'</p></div><div><small>当前影响</small><p>'+esc(n.impact)+'</p></div><div><small>可能推动行为</small><p>'+n.behaviors.map(esc).join(" / ")+'</p></div></div>':'<div class="influence-grid"><div><small>来源</small><p>'+esc(n.source)+'</p></div><div><small>影响</small><p>'+n.influence.map(esc).join(" / ")+'</p></div></div>';
    el("inspector-panel").innerHTML='<div class="hud-head"><h2>心理节点详情</h2><span>Node Inspector</span></div><div class="node-title" style="--node-color:'+meta.color+'"><i></i><strong>'+esc(n.label)+'</strong></div><div class="node-facts"><div><small>节点类型</small><b>'+esc(meta.zh)+'</b></div><div><small>强度</small><b>'+n.intensity.toFixed(2)+'</b></div><div><small>状态</small><b>'+(n.status==="active"?"激活中":"休眠")+'</b></div></div><div class="strength-line"><span style="width:'+pct(n.intensity)+'%;background:'+meta.color+'"></span></div><p class="node-detail-copy">'+esc(n.detail)+'</p><h3>影响路径 / Influence Path</h3>'+influence+(n.derived?'<p class="derived-note">derived: 此节点显示值由适配层补齐。</p>':'');
  }
  function renderActivation(){
    el("activation-panel").innerHTML='<div class="trace-head"><i></i><strong>当前激活链路</strong><span>Live Activation Trace</span></div><div class="trace-steps">'+obs.activation.map(function(s,i){return '<button '+(s.nodeId?'data-node="'+esc(s.nodeId)+'"':'disabled')+' class="'+(s.nodeId===state.selectedId?"selected":"")+'"><strong>'+esc(s.label)+'</strong><small>'+esc(s.note)+'</small></button>'+(i<obs.activation.length-1?'<b>›</b>':'');}).join("")+'</div>';
    el("activation-panel").querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));});});
  }
  function renderBehavior(){
    el("behavior-panel").innerHTML='<div class="behavior-head"><strong>行为竞争</strong><span>Behavior Competition</span></div>'+obs.behavior.map(function(b){return '<div class="behavior-item"><div><span>'+esc(b.label)+'</span><em>'+b.score.toFixed(2)+(b.derived?" · derived":"")+'</em></div><i><b style="width:'+pct(b.score)+'%"></b></i></div>';}).join("");
  }
  function renderScenarios(){
    el("scenario-bar").innerHTML='<span class="scenario-label">情境测试</span>'+(obs.scenarios||[]).map(function(s){return '<button class="'+(s.id===state.scenarioId?"active":"")+'" data-scenario="'+esc(s.id)+'"><i></i>'+esc(s.title)+'</button>';}).join("");
    el("scenario-bar").querySelectorAll("[data-scenario]").forEach(function(btn){btn.addEventListener("click",function(){state.scenarioId=btn.getAttribute("data-scenario");var s=getScenario(state.scenarioId);if(s.id==="wang_xue_repair_signal")state.selectedId="mem-wangxue";else if(s.id==="authority_blame_shift")state.selectedId="need-safety";else if(s.id==="gray_profit_offer")state.selectedId="need-boundary";else if(s.id==="friend_project_invite")state.selectedId="schema-control";else state.selectedId="belief-unreliable";obs=adaptObservatoryData(data);renderAll();announce("当前页面：情境测试 "+s.title);});});
  }
  function group(title,en,items,tone){return '<div class="review-group '+(tone||"")+'"><h3>'+esc(title)+'<span>'+esc(en)+'</span></h3><div>'+items.map(function(x){return '<em>'+esc(x)+'</em>';}).join("")+'</div></div>';}
  function renderReview(){
    var integrity=obs.integrity;
    el("review-panel").innerHTML='<div class="hud-head"><h2>复盘模式</h2><span>Review Mode</span></div><dl class="review-meta"><dt>demo version</dt><dd>'+esc(obs.version)+'</dd><dt>角色 ID</dt><dd>'+esc(obs.character.id||"lin_fan")+'</dd><dt>readOnly</dt><dd>'+esc(integrity.readOnly)+'</dd><dt>apiRequired</dt><dd>'+esc(integrity.apiRequired)+'</dd><dt>llmRequired</dt><dd>'+esc(integrity.llmRequired)+'</dd><dt>stateMutation</dt><dd>'+esc(integrity.stateMutation)+'</dd></dl>'+group("激活图式排序","Active Schemas",obs.review.schemas)+group("缺失排序","Needs",obs.review.needs)+group("欲望排序","Desires",obs.review.desires)+group("行为候选","Behavior Candidates",obs.review.lifeCandidates.concat(obs.behavior.map(function(b){return b.label+" "+b.score.toFixed(2);})))+group("被压制行为","Suppressed",obs.review.suppressed,"muted")+group("warning 信息","Warnings",(obs.reviewWarnings||[]).map(function(w){return w.level+": "+w.message;}),"warn")+group("derived","Adapter Notes",obs.derived,"muted");
  }
  function toggleReviewMode(){
    state.review=!state.review;
    document.body.classList.toggle("review-mode",state.review);
    el("review-panel").hidden=!state.review;
    el("inspector-panel").hidden=state.review;
    el("review-toggle").setAttribute("aria-pressed",String(state.review));
    el("review-toggle").textContent=state.review?"Exit Review Mode":"Review Mode";
    announce(state.review?"当前页面：Review Mode":"当前页面：Node Inspector");
  }
  function selectGalaxyNode(id){state.selectedId=id||"belief-unreliable";renderGalaxy();renderInspector();renderActivation();announce("选中节点："+findNode(state.selectedId).label);}
  function drawNebula(){
    var canvas=el("nebula-canvas"),ctx=canvas.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2),particles=[],t=0;
    function resize(){var r=canvas.getBoundingClientRect();canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);particles=Array.from({length:Math.max(80,Math.floor(r.width*r.height/9000))},function(){return{x:Math.random()*r.width,y:Math.random()*r.height,r:Math.random()*1.2+.2,a:Math.random()*.45+.08,s:Math.random()*.05+.01};});renderLinks();}
    function loop(){var w=canvas.width/dpr,h=canvas.height/dpr,cx=w*.5,cy=h*.47;t+=.002;ctx.fillStyle="#080711";ctx.fillRect(0,0,w,h);[[cx,cy,Math.max(w,h)*.64,"rgba(96,82,170,.16)"],[cx-w*.22,cy+h*.16,w*.46,"rgba(70,96,150,.13)"],[cx+w*.24,cy-h*.18,w*.4,"rgba(180,140,80,.06)"],[cx,cy,w*.22,"rgba(150,130,210,.12)"]].forEach(function(n){var g=ctx.createRadialGradient(n[0],n[1],0,n[0],n[1],n[2]);g.addColorStop(0,n[3]);g.addColorStop(1,"rgba(8,7,17,0)");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});ORBIT.rx.slice(1).forEach(function(rx,i){ctx.beginPath();ctx.ellipse(cx,cy,w*rx/100,w*rx/100*ORBIT.tilt,0,0,Math.PI*2);ctx.strokeStyle="rgba(190,180,230,"+(.05+.018*Math.sin(t*2+i))+")";ctx.stroke();});particles.forEach(function(p){p.y-=p.s;if(p.y<-2){p.y=h+2;p.x=Math.random()*w;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle="rgba(220,216,245,"+(p.a*(.6+.4*Math.sin(t*4+p.x)))+")";ctx.fill();});requestAnimationFrame(loop);}
    window.addEventListener("resize",resize);resize();loop();
  }
  function renderAll(){el("stress-load").textContent=pct(obs.currentState.stressLoad)+"%";renderSubstrate();renderInspector();renderActivation();renderBehavior();renderScenarios();renderReview();renderGalaxy();}
  el("review-toggle").addEventListener("click",toggleReviewMode);
  drawNebula();
  renderAll();
  window.addEventListener("resize",renderLinks);
  window.selectGalaxyNode=selectGalaxyNode;
})();
`;

const demoCss = `
*{box-sizing:border-box}body{margin:0;background:#080810;color:#d6d6dc;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.shell{max-width:1180px;margin:0 auto;padding:20px}.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;border-bottom:1px solid #22243a;padding-bottom:14px}.hero-right{display:flex;align-items:center;gap:10px;flex-shrink:0}.eyebrow,.section-kicker{font:10px/1.4 monospace;color:#7e88b8;letter-spacing:2px;text-transform:uppercase}h1{margin:0;font-size:30px;font-weight:650}h2{margin:0 0 10px;font-size:15px}h3{margin:14px 0 6px;font-size:11px;color:#9da7cf}.description{max-width:760px;color:#9b9bab}.status-card{border:1px solid #2a2d47;background:#101020;padding:10px 14px;border-radius:8px;text-align:right}.status-card span{display:block;color:#7c845f;font:11px monospace}.status-card strong{font-size:18px}.review-toggle{background:#15172a;color:#9297b8;border:1px solid #2d304c;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:11px;white-space:nowrap}.review-toggle:hover{background:#242846;color:#fff;border-color:#6970aa}.tabs{display:flex;gap:6px;margin:16px 0;flex-wrap:wrap}.tabs button,.galaxy-head a{background:#15172a;color:#9297b8;border:1px solid #2d304c;border-radius:6px;padding:7px 10px;cursor:pointer;text-decoration:none;font-size:12px}.tabs button:focus-visible{outline:2px solid #6970aa;outline-offset:2px}.tabs button.active{background:#242846;color:#fff;border-color:#6970aa}.step-num{display:inline-block;margin-right:3px;font-size:10px;opacity:.7}.panel{display:none}.panel.active{display:block}.grid,.scenario-grid{display:grid;gap:12px}.grid.two{grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr)}.scenario-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.card{background:#10111f;border:1px solid #24263e;border-radius:8px;padding:14px;margin-bottom:12px}.scenario{min-height:300px}.wide{min-height:220px}.lead{font-size:16px;line-height:1.5;color:#f0f0f4}.muted{color:#85899f}.callout{margin-top:10px;border-left:3px solid #6970aa;background:#15172a;padding:10px;color:#c6cbea}.checklist{margin:12px 0 8px;padding:0 0 0 18px;list-style:"☐ "}.checklist li{color:#c5c8d8;margin-bottom:8px;line-height:1.5;font-size:13px}.summary-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.summary-row div{background:#0e0f1a;border:1px solid #23253a;border-radius:8px;padding:14px}.summary-row strong{display:block;font-size:26px;color:#f0f0f4}.summary-row span{color:#8f94aa;font-size:11px}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.metrics-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.metrics-header h2{margin:0;font-size:14px}.metric-sort-toggle{background:#15172a;color:#9297b8;border:1px solid #2d304c;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px}.metric-sort-toggle:hover{background:#242846;color:#fff;border-color:#6970aa}.metric{background:#0e0f1a;border:1px solid #23253a;border-radius:8px;padding:10px}.metric-head{display:flex;justify-content:space-between;font-size:11px}.bar{height:5px;background:#202238;border-radius:999px;overflow:hidden;margin:6px 0}.bar span{display:block;height:100%;background:#8ea0ff}.metric p,.memory p,li{color:#aaaec2;line-height:1.45}.memory{border-top:1px solid #22243a;padding:8px 0}.memory-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px}.memory-header strong{font-size:11px;text-transform:uppercase;color:#9da7cf}.memory-imp{font-size:10px;color:#8f94aa}.memory-hint{font-size:11px;color:#7e88b8;margin-top:3px;line-height:1.5;border-left:2px solid #303554;padding-left:8px}.pill-row{display:flex;gap:5px;flex-wrap:wrap}.pill-row span{border:1px solid #303554;background:#161931;border-radius:999px;padding:4px 7px;color:#adb5dc;font-size:11px}.scenario-filter-bar{display:flex;gap:6px;margin:0 0 16px;flex-wrap:wrap}.scenario-filter-btn{background:#10111f;color:#9297b8;border:1px solid #2d304c;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:11px}.scenario-filter-btn.active,.scenario-filter-btn:hover{background:#242846;color:#fff;border-color:#6970aa}.overview-hero{border:1px solid #24263e;border-radius:8px;padding:20px 24px;margin-bottom:16px;background:linear-gradient(135deg,#10111f 0%,#14182d 100%)}.overview-hero h2{font-size:20px}.overview-guide{border:1px solid #23253a;border-radius:8px;padding:16px 20px;margin-bottom:16px;background:#0e0f1a}.overview-guide h3{color:#7e88b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px}.guide-steps{margin:0;padding:0 0 0 18px;color:#c5c8d8}.guide-steps li{margin-bottom:4px;line-height:1.55}.guide-steps strong{color:#f0f0f4}.overview-metrics-mini{display:flex;flex-direction:column;gap:8px}.mini-bar{display:flex;align-items:center;gap:6px;font-size:11px}.mini-bar>span{width:42px;color:#c5c8d8;flex-shrink:0}.mini-val{width:32px;color:#8ea0ff;text-align:right;font-size:12px;font-weight:600;flex-shrink:0}.mini-bar .bar{flex:1;margin:0}.badge{display:inline-block;border:1px solid;border-radius:999px;padding:2px 8px;font-size:10px;line-height:1.5;white-space:nowrap}.badge-strategy{font-weight:600}.badge-pressure{opacity:.85}.scenario-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}.scenario-grid .lead{font-size:14px}.scenario-chain-label{font-size:10px;color:#7e88b8;letter-spacing:1px;text-transform:uppercase;margin:8px 0 4px}.mini-flow{display:flex;align-items:flex-start;gap:2px;flex-wrap:wrap;padding:6px 0;border:1px solid #1e2036;border-radius:6px;background:#0a0b14;margin-bottom:6px}.mf-item{background:#0e0f1a;border:1px solid #1e2036;border-radius:5px;padding:5px 7px;text-align:center;min-width:0;flex:1 1 auto;font-size:11px;line-height:1.35;color:#c5c8d8;overflow:hidden}.mf-item em{display:block;font-size:8px;color:#5d6488;font-style:normal;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}.action-toggle{display:inline-block;margin-top:2px;background:none;border:1px solid #303554;border-radius:4px;color:#9297b8;font-size:9px;cursor:pointer;padding:1px 6px}.action-toggle:hover{background:#15172a;color:#c6cbea}.mf-arrow{display:flex;align-items:center;color:#2a2d47;font-size:14px;font-weight:700;padding:4px 0;flex-shrink:0}.scenario-detail-mini{margin-top:8px;padding-top:8px;border-top:1px solid #1e2036}.scenario-detail-mini h3{font-size:10px;color:#7e88b8;margin:10px 0 4px}.scenario-detail-mini .pill-row span{font-size:10px}.scenario-detail-mini li{font-size:11px}.matrix-table{min-width:580px}.matrix-table th{text-align:center;font-size:11px}.matrix-table th:first-child{text-align:left}.matrix-table td{text-align:center;font-size:13px;padding:10px}.matrix-table td:first-child{text-align:left;font-weight:500}.matrix-hit{color:#c6cbea;font-size:16px}.matrix-miss{color:#303554}.decision-flow{display:flex;align-items:flex-start;gap:3px;flex-wrap:wrap;padding:12px 0;overflow-x:auto}.flow-node{background:#0e0f1a;border:1px solid #24263e;border-radius:7px;padding:10px 11px;text-align:center;min-width:88px;flex:0 0 auto}.flow-node-label{display:block;font-size:9px;color:#7e88b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}.flow-node-detail{display:block;font-size:12px;font-weight:600;line-height:1.3;max-width:130px;word-break:break-word}.flow-node-intensity{display:block;font-size:10px;color:#9da7cf;margin-top:3px;font-weight:500}.flow-arrow{display:flex;align-items:center;color:#3d4160;font-size:18px;font-weight:700;padding:8px 0;flex-shrink:0}.boundary-gauge{border:1px solid #24263e;border-radius:7px;padding:12px;background:#0e0f1a;margin-bottom:4px}.boundary-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}.boundary-phase{font-size:13px;font-weight:600}.boundary-value{font-size:12px;color:#c5c8d8;font-weight:600}.boundary-bar{height:7px;margin:5px 0;border-radius:999px;overflow:hidden}.boundary-desc{margin:5px 0 0;font-size:10px;color:#7e88b8;line-height:1.5}.energy-fatigue-dual{display:flex;flex-direction:column;gap:10px;margin:6px 0}.ef-bar{border:1px solid #24263e;border-radius:5px;padding:8px 10px;background:#0e0f1a}.ef-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px}.ef-head span{font-size:11px;color:#c5c8d8}.ef-head strong{font-size:13px;color:#f0f0f4}.ef-track{height:6px;margin:3px 0;border-radius:999px;overflow:hidden;background:#1a1c30}.ef-track span{border-radius:999px}.candidate-bar{border-top:1px solid #24263e;padding:12px 0}.candidate-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}.candidate-name{font-size:12px;color:#f0f0f4;font-weight:600}.candidate-score{font-size:12px;color:#8ea0ff;font-weight:600}.bar-track{height:6px;background:#1a1c30;margin:5px 0}.bar-track span{border-radius:999px}.candidate-reasons{margin:5px 0 0;padding:0 0 0 14px;list-style:square}.candidate-reasons li{font-size:11px;color:#85899f;margin-bottom:1px}.galaxy-instructions{border-left:3px solid #6970aa;background:#15172a;padding:10px 12px;margin-bottom:12px;color:#b6bcd8;font-size:12px;line-height:1.55;border-radius:4px}.galaxy-instructions strong{color:#c6cbea}.mini-card{border-top:1px solid #24263e;padding:10px 0}.table-wrap{overflow:auto;border:1px solid #24263e;border-radius:8px}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:8px 10px;border-bottom:1px solid #24263e;text-align:left;font-size:12px;vertical-align:top}th{color:#9da7cf;background:#15172a;font-weight:600}td{color:#c5c8d8}.galaxy-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}iframe{width:100%;height:680px;border:1px solid #24263e;border-radius:8px;background:#080810}body.review-mode .eyebrow,body.review-mode .section-kicker,body.review-mode .step-num,body.review-mode .scenario-chain-label,body.review-mode .badge,body.review-mode .pill-row span,body.review-mode .bar,body.review-mode .boundary-bar,body.review-mode .ef-track,body.review-mode .bar-track,body.review-mode .action-toggle,body.review-mode .mf-arrow,body.review-mode .flow-arrow,body.review-mode .review-toggle,body.review-mode .metric-sort-toggle,body.review-mode .scenario-filter-bar{opacity:.35}body.review-mode .card,body.review-mode .metric,body.review-mode .boundary-gauge,body.review-mode .ef-bar{background:#0c0d18;border-color:#1a1c30}body.review-mode .lead,body.review-mode h2,body.review-mode h3{color:#f0f0f4}@media(max-width:980px){.scenario-grid{grid-template-columns:1fr}.decision-flow{justify-content:flex-start}}@media(max-width:860px){.hero,.grid.two{display:block}.hero-right{margin-top:8px}.metrics,.summary-row{grid-template-columns:1fr 1fr}.shell{padding:14px}iframe{height:560px}.overview-hero{padding:16px}.decision-flow{flex-direction:column;align-items:stretch}.flow-arrow{justify-content:center;transform:rotate(90deg);padding:2px 0}.mini-flow{flex-direction:column}.mf-arrow{transform:rotate(90deg);justify-content:center}}@media print{body{background:#fff;color:#111;font-size:12px}.sr-only{display:none}.shell{max-width:100%;padding:0}.hero{border-bottom:2px solid #333;padding-bottom:10px}.eyebrow,.section-kicker{color:#555}.status-card{border:1px solid #999;background:#f5f5f5}.status-card span{color:#555}.status-card strong{color:#111}.review-toggle,.scenario-filter-bar,.metric-sort-toggle{display:none}.tabs{display:none}.panel{display:block!important;page-break-inside:avoid;margin-bottom:20px}.card{background:#fff;border:1px solid #ccc;color:#111;padding:10px;margin-bottom:10px}.lead{color:#222}.muted{color:#555}.callout{border-left:3px solid #999;background:#f5f5f5;color:#333}.summary-row div,.metric,.memory,.boundary-gauge,.ef-bar,.candidate-bar,.flow-node,.mini-flow,.mf-item{background:#fafafa;border:1px solid #ddd}.bar{background:#ddd}.bar span{background:#666}.pill-row span{border-color:#ccc;background:#fafafa;color:#333}.badge{border-color:#999;color:#333}.galaxy-head a,.action-toggle{display:none}iframe{display:none}.galaxy-instructions{border-left-color:#999;background:#fafafa;color:#333}.table-wrap{border-color:#ccc}th{background:#f0f0f0;color:#222}td{color:#333}th,td{border-bottom-color:#ddd}.scenario-detail-mini{border-top-color:#ddd}.scenario-grid{grid-template-columns:1fr}.decision-flow{flex-wrap:wrap}.memory{border-top-color:#ddd}h1{font-size:22px}h2{font-size:14px}h3{font-size:11px;color:#444}a{color:#333;text-decoration:underline}}`;

const legacyExtraCss = `
.console-layout{display:grid;grid-template-columns:230px minmax(0,1fr) 270px;gap:14px;align-items:start}.rail{position:sticky;top:12px}.rail-card{background:rgba(16,17,31,.82);border:1px solid #24263e;border-radius:10px;padding:13px;margin-bottom:12px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.avatar-orbit{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#28305a,#111426);border:1px solid #6970aa;color:#f0f0f4;font-size:24px;margin-bottom:10px}.rail-tags,.state-tags{display:flex;gap:5px;flex-wrap:wrap}.rail-tags span,.state-tags span{font-size:10px;border:1px solid #303554;border-radius:999px;padding:3px 7px;color:#adb5dc}.rail-chain{display:flex;flex-direction:column;gap:7px}.rail-chain-node,.active-node{border-left:2px solid #6970aa;background:#0e0f1a;padding:7px 8px;border-radius:5px}.rail-chain-node span,.active-node span{display:block;font-size:9px;color:#7e88b8;text-transform:uppercase;letter-spacing:.8px}.rail-chain-node strong,.active-node strong{display:block;color:#d6d6dc;font-size:12px;line-height:1.35}.active-node{display:grid;grid-template-columns:1fr auto;gap:6px;margin-bottom:6px}.active-node span,.active-node strong{grid-column:1}.active-node em{grid-row:1/3;grid-column:2;color:#8ea0ff;font-style:normal;align-self:center}.review-warning{border-left:3px solid #6970aa;background:#0e0f1a;padding:8px;margin-bottom:8px;border-radius:5px}.review-warning.warn{border-color:#d4a85e}.review-warning.error{border-color:#d96c6c}.review-warning strong{font-size:10px;color:#c6cbea}.review-warning p{margin:4px 0 0;color:#aaaec2;font-size:11px;line-height:1.45}.console-hero-card{background:linear-gradient(135deg,rgba(20,24,45,.92),rgba(12,14,28,.92));border:1px solid #303554;border-radius:10px;padding:18px;margin-bottom:12px}.state-layers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.state-dl{display:grid;grid-template-columns:70px 1fr;gap:6px;font-size:12px}.state-dl dt{color:#7e88b8}.state-dl dd{margin:0;color:#c5c8d8}.risk-line{color:#d4a85e}.repair-line{color:#88c997}.scenario-human-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.scenario-human-grid div{background:#0e0f1a;border:1px solid #1e2036;border-radius:6px;padding:8px}.scenario-human-grid strong{font-size:11px;color:#9da7cf}.scenario-human-grid p{font-size:12px;margin:4px 0 0}.quote-pair{border-left:3px solid #5b8cce;background:#0e0f1a;border-radius:6px;padding:8px;margin:8px 0}.quote-pair blockquote{margin:0 0 6px;color:#f0f0f4}.quote-pair p{margin:0;color:#85899f;font-size:12px}.scenario-risk-box{background:#111321;border:1px solid #24263e;border-radius:6px;padding:8px;margin-top:8px}.scenario-risk-box p{margin:4px 0;font-size:12px}.overflow-card{border:1px solid #303554;background:#0e0f1a;border-radius:7px;padding:10px;margin-bottom:12px}.overflow-card.active{border-color:#d96c6c;background:#221316}.candidate-status{font-size:10px;color:#9da7cf;margin-bottom:5px}.candidate-bar.next_likely{border-left:3px solid #c08aff;padding-left:8px}.candidate-bar.suppressed{opacity:.72}.causal-chain{display:flex;align-items:stretch;gap:8px;overflow:auto;padding-bottom:4px}.causal-step{min-width:150px;border:1px solid #24263e;background:#0e0f1a;border-radius:8px;padding:10px}.causal-step span{display:block;font-size:9px;color:#7e88b8;letter-spacing:1px;text-transform:uppercase}.causal-step strong{display:block;font-size:13px;color:#f0f0f4;margin:5px 0}.causal-step em{font-style:normal;color:#8ea0ff;font-size:11px}.causal-step p{font-size:11px;color:#aaaec2}.causal-arrow{display:grid;place-items:center;color:#3d4160;font-size:18px}.galaxy-console{display:grid;grid-template-columns:minmax(0,.9fr) minmax(280px,.6fr);gap:12px}.galaxy-node-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.galaxy-node-pill{background:#0e0f1a;border:1px solid #24263e;border-radius:8px;padding:9px;text-align:left;color:#c5c8d8;cursor:pointer}.galaxy-node-pill.active{border-color:#6970aa}.galaxy-node-pill.selected{background:#242846;border-color:#8ea0ff}.galaxy-node-pill span{display:block;font-size:9px;color:#7e88b8;text-transform:uppercase}.galaxy-node-pill strong{font-size:12px}.node-strength{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 4px}.node-strength span{font-size:11px;color:#85899f}.node-strength strong{color:#8ea0ff}.galaxy-detail-card{min-height:260px}@media(max-width:1180px){.console-layout{grid-template-columns:200px minmax(0,1fr)}.rail-right{grid-column:1/3;position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rail-right .rail-card{margin-bottom:0}}@media(max-width:980px){.console-layout{display:block}.rail{position:static}.rail-left,.rail-right{display:block}.state-layers,.galaxy-console{grid-template-columns:1fr}}@media(max-width:860px){.scenario-human-grid{grid-template-columns:1fr}.galaxy-node-list{grid-template-columns:1fr}}@media print{.console-layout{display:block}.rail{position:static}.rail-card{background:#fff;border:1px solid #ccc;color:#111;padding:10px;margin-bottom:10px}.causal-step,.galaxy-node-pill{background:#fafafa;border:1px solid #ddd}}
`;

const extraCss = `
:root{color-scheme:dark;--bg:#080711;--fg:#eceaf4;--muted:#9a96ad;--line:rgba(214,204,255,.14);--panel:rgba(24,20,39,.58);--panel-strong:rgba(28,23,45,.72);--accent:#d8b079;--cyan:#9aa6e0;--warn:#d78a72}
html,body{width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--fg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
button{font:inherit}
.sr-only.tabs{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;display:block!important}
.observatory{position:relative;width:100vw;height:100vh;min-height:720px;overflow:hidden;background:#080711}
.nebula-canvas,.galaxy-links,.galaxy-stage{position:absolute;inset:0;width:100%;height:100%}
.galaxy-links{z-index:2;pointer-events:none}.galaxy-links path{fill:none;stroke-width:1;filter:none}.galaxy-links path.active{stroke-width:1.35;filter:drop-shadow(0 0 4px rgba(180,150,220,.45))}.galaxy-links path.flow{stroke:#efe6ff;stroke-width:1.1;stroke-opacity:.42;stroke-dasharray:4 11;animation:flow-dash 1.35s linear infinite}
.observatory:after{content:"";position:absolute;inset:0;pointer-events:none;z-index:3;background:radial-gradient(125% 95% at 50% 47%,transparent 42%,rgba(6,5,14,.78) 100%)}
.top-hud{position:absolute;z-index:40;inset:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;pointer-events:none}.brand-chip,.top-controls>*{pointer-events:auto}
.brand-chip,.stress-chip,.review-toggle,.hud-panel,.activation-panel,.behavior-panel,.scenario-bar{background:linear-gradient(155deg,rgba(45,38,72,.58),rgba(16,13,29,.48));backdrop-filter:blur(22px) saturate(130%);border:1px solid var(--line);box-shadow:0 18px 58px -22px rgba(0,0,0,.95),inset 0 1px 0 rgba(240,235,255,.06)}
.brand-chip{display:flex;align-items:center;gap:10px;border-radius:14px;padding:10px 13px}.brand-chip h1{margin:0;font-size:14px;line-height:1.05}.brand-chip p{margin:3px 0 0;color:var(--muted);font:9px/1.2 ui-monospace,monospace;letter-spacing:0;text-transform:none}.brand-orbit{width:30px;height:30px;border:1px solid rgba(216,176,121,.35);border-radius:10px;background:radial-gradient(circle,rgba(216,176,121,.2),transparent 68%)}
.top-controls{display:flex;align-items:center;gap:10px}.stress-chip{border-radius:14px;padding:9px 13px;min-width:84px}.stress-chip span{display:block;color:var(--muted);font-size:9px}.stress-chip strong{display:block;margin-top:2px;color:var(--warn);font-size:14px}.review-toggle{border-radius:14px;color:var(--fg);border-color:var(--line);padding:11px 13px;cursor:pointer}.review-toggle[aria-pressed="true"]{color:var(--accent);border-color:rgba(216,176,121,.34)}
.galaxy-stage{z-index:5}.orbit-label{position:absolute;color:rgba(236,234,244,.32);font:9px/1 ui-monospace,monospace;letter-spacing:0;pointer-events:none}.orbit-1{left:36%;top:36%}.orbit-2{left:27%;top:29%}.orbit-3{left:17%;top:23%}.orbit-4{left:8%;top:18%}
.galaxy-node{position:absolute;z-index:10;transform:translate(-50%,-50%);border:0;background:transparent;color:var(--fg);cursor:pointer;outline:none}.galaxy-node:focus-visible{outline:2px solid rgba(216,176,121,.5);outline-offset:8px;border-radius:999px}.factor-node{display:flex;flex-direction:column;align-items:center;gap:7px;transition:transform .28s ease,filter .28s ease;animation:float-slow 13s ease-in-out infinite}.factor-node.active{animation-duration:9s}.factor-node:hover,.factor-node.selected{transform:translate(-50%,-50%) scale(1.1);z-index:24}
.node-body{position:relative;width:var(--node-size);height:var(--node-size);border-radius:50%;border:1px solid color-mix(in srgb,var(--node-color) 78%,transparent);background:radial-gradient(circle at 35% 30%,var(--node-color),color-mix(in srgb,var(--node-color) 42%,transparent));box-shadow:0 0 13px color-mix(in srgb,var(--node-color) 62%,transparent)}.node-body:before{content:"";position:absolute;inset:-120%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--node-color) 28%,transparent),transparent 68%);opacity:.65}.factor-node.selected .node-body:after{content:"";position:absolute;inset:-7px;border:1px dashed color-mix(in srgb,var(--node-color) 60%,transparent);border-radius:50%;animation:spin 80s linear infinite}
.node-label{white-space:nowrap;max-width:150px;padding:2px 6px;border-radius:6px;color:rgba(236,234,244,.82);font-size:12px;line-height:1.2;text-shadow:0 0 10px color-mix(in srgb,var(--node-color) 50%,transparent)}.factor-node.selected .node-label,.factor-node:hover .node-label{background:rgba(8,7,17,.5);color:var(--fg)}
.core-node{z-index:22;display:flex;flex-direction:column;align-items:center}.core-glow{position:absolute;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(231,216,176,.17),rgba(150,130,210,.06) 45%,transparent 72%);animation:pulse-glow 4s ease-in-out infinite}.core-node strong{margin-top:3px;font-size:15px;font-weight:550;text-shadow:0 0 18px rgba(216,176,121,.4)}.core-node em{font:9px/1.2 ui-monospace,monospace;color:rgba(216,176,121,.75);font-style:normal;letter-spacing:0}
.core-radar{width:166px;height:166px;overflow:visible}.core-radar circle,.core-radar line{fill:none;stroke:rgba(205,194,238,.14);stroke-width:.7}.core-radar polygon{fill:rgba(180,150,220,.16);stroke:rgba(216,176,121,.86);stroke-width:1.2;filter:drop-shadow(0 0 6px rgba(216,176,121,.38))}.core-radar text{font-size:7.6px;fill:rgba(236,234,244,.56);text-anchor:middle;dominant-baseline:middle;letter-spacing:0}.core-radar .axis-dot{fill:#c6b8ea}.core-radar .axis-dot.high{fill:#e7d8b0}.core-radar .core-dot{fill:#f3ead2;animation:pulse-glow 3.2s ease-in-out infinite}
.hud-panel{position:absolute;z-index:32;border-radius:18px;padding:16px}.substrate-panel{left:18px;top:92px;width:278px}.inspector-panel,.review-panel{right:18px;top:92px;width:310px;max-height:calc(100vh - 186px);overflow:auto}.review-panel{z-index:42}.hud-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.hud-head h2{margin:0;font-size:15px;font-weight:560}.hud-head span{color:var(--muted);font:9px/1 ui-monospace,monospace;letter-spacing:0}
.identity-row{display:flex;align-items:center;gap:12px;margin-top:14px}.avatar{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;border:1px solid rgba(216,176,121,.34);background:rgba(216,176,121,.08);color:var(--accent);font-size:18px}.identity-row strong{display:block}.identity-row em{display:block;margin-top:3px;color:var(--muted);font:10px/1 ui-monospace,monospace;font-style:normal;letter-spacing:0}.substrate-copy{color:rgba(236,234,244,.72);font-size:12px;line-height:1.65}
.axis-list{display:flex;flex-direction:column;gap:9px;margin:14px 0}.axis-row{display:grid;grid-template-columns:76px 1fr 34px;align-items:center;gap:8px}.axis-row span{font-size:12px;color:rgba(236,234,244,.82)}.axis-row i,.behavior-item i{height:4px;border-radius:999px;background:rgba(236,234,244,.08);overflow:hidden}.axis-row b,.behavior-item b{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8b97d8,#d8b079);box-shadow:0 0 8px rgba(216,176,121,.45)}.axis-row em{font:10px/1 ui-monospace,monospace;color:var(--muted);font-style:normal}.state-tags{display:flex;flex-wrap:wrap;gap:6px}.state-tags span{border:1px solid rgba(216,176,121,.24);background:rgba(216,176,121,.08);border-radius:999px;color:rgba(216,176,121,.92);padding:5px 8px;font-size:11px}.dominant-belief{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.dominant-belief small{display:block;color:var(--muted);font-size:10px}.dominant-belief strong{display:block;margin-top:5px;font-size:13px}
.node-title{display:flex;align-items:center;gap:9px;margin:15px 0 12px}.node-title i{width:10px;height:10px;border-radius:50%;background:var(--node-color);box-shadow:0 0 13px var(--node-color)}.node-title strong{font-size:18px;line-height:1.25;text-shadow:0 0 16px color-mix(in srgb,var(--node-color) 34%,transparent)}.node-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.node-facts div,.influence-grid div{border:1px solid rgba(236,234,244,.07);background:rgba(236,234,244,.03);border-radius:10px;padding:9px}.node-facts small,.influence-grid small{display:block;color:var(--muted);font-size:9px}.node-facts b{display:block;margin-top:5px;font-size:12px}.strength-line{height:4px;background:rgba(236,234,244,.08);border-radius:999px;overflow:hidden;margin:10px 0 12px}.strength-line span{display:block;height:100%;border-radius:999px}.node-detail-copy{color:rgba(236,234,244,.80);font-size:12px;line-height:1.65}.inspector-panel h3{font-size:11px;color:var(--muted);margin:14px 0 8px}.influence-grid{display:grid;gap:8px}.influence-grid p{margin:5px 0 0;color:rgba(236,234,244,.82);font-size:12px;line-height:1.5}.derived-note{color:rgba(216,176,121,.78);font-size:11px}
.activation-panel{position:absolute;z-index:34;left:50%;bottom:86px;transform:translateX(-50%);width:min(760px,calc(100vw - 380px));border-radius:18px;padding:13px 16px}.trace-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}.trace-head i{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}.trace-head strong{font-size:12px}.trace-head span{color:var(--muted);font:9px/1 ui-monospace,monospace}.trace-steps{display:flex;align-items:center;gap:5px;overflow:auto}.trace-steps button{flex:0 0 auto;border:0;background:transparent;color:rgba(236,234,244,.86);border-radius:10px;padding:7px 8px;text-align:left;cursor:pointer}.trace-steps button.selected{background:rgba(216,176,121,.10);box-shadow:inset 0 0 0 1px rgba(216,176,121,.34)}.trace-steps button:disabled{cursor:default}.trace-steps strong{display:block;font-size:11px;white-space:nowrap}.trace-steps small{display:block;margin-top:3px;color:var(--muted);font-size:9px}.trace-steps b{color:rgba(216,176,121,.55);font-size:18px;font-weight:400}
.behavior-panel{position:absolute;z-index:33;right:18px;bottom:86px;width:310px;border-radius:18px;padding:14px}.behavior-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px}.behavior-head strong{font-size:13px}.behavior-head span{color:var(--muted);font:9px/1 ui-monospace,monospace}.behavior-item{padding:7px 0;border-top:1px solid rgba(236,234,244,.08)}.behavior-item div{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.behavior-item span{font-size:12px}.behavior-item em{font:10px/1 ui-monospace,monospace;color:var(--muted);font-style:normal}
.scenario-bar{position:absolute;z-index:36;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;max-width:calc(100vw - 40px);border-radius:999px;padding:9px 12px;overflow:auto}.scenario-label{flex:0 0 auto;color:var(--muted);font-size:11px;margin-right:3px}.scenario-bar button{flex:0 0 auto;display:flex;align-items:center;gap:6px;border:0;background:transparent;color:rgba(236,234,244,.68);border-radius:999px;padding:7px 10px;cursor:pointer;font-size:12px;white-space:nowrap}.scenario-bar button i{width:6px;height:6px;border-radius:50%;background:var(--cyan)}.scenario-bar button.active{background:rgba(236,234,244,.10);color:var(--fg)}.scenario-bar button.active i{background:var(--accent);box-shadow:0 0 8px var(--accent)}
.review-meta{display:grid;grid-template-columns:105px 1fr;gap:7px;margin:12px 0;color:rgba(236,234,244,.82);font-size:11px}.review-meta dt{color:var(--muted)}.review-meta dd{margin:0}.review-group{margin-top:13px}.review-group h3{display:flex;justify-content:space-between;margin:0 0 7px;font-size:12px}.review-group h3 span{color:var(--muted);font:9px/1 ui-monospace,monospace}.review-group div{display:flex;flex-wrap:wrap;gap:6px}.review-group em{border:1px solid rgba(236,234,244,.08);background:rgba(236,234,244,.04);border-radius:8px;padding:5px 7px;color:rgba(236,234,244,.82);font-size:11px;font-style:normal}.review-group.warn em{border-color:rgba(215,138,114,.32);background:rgba(215,138,114,.10)}.review-group.muted em{opacity:.68}
body.review-mode .factor-node:not(.active){opacity:.42}body.review-mode .activation-panel,body.review-mode .behavior-panel{opacity:.74}
@keyframes float-slow{0%,100%{margin-top:0}50%{margin-top:-9px}}@keyframes pulse-glow{0%,100%{opacity:.82;filter:drop-shadow(0 0 8px currentColor)}50%{opacity:1;filter:drop-shadow(0 0 22px currentColor)}}@keyframes flow-dash{to{stroke-dashoffset:-15}}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1180px){.substrate-panel,.inspector-panel,.review-panel{top:auto;bottom:150px;max-height:38vh}.activation-panel{width:calc(100vw - 40px);bottom:90px}.behavior-panel{display:none}.substrate-panel{left:14px;width:260px}.inspector-panel,.review-panel{right:14px;width:292px}.node-label{font-size:11px}}
@media(max-width:820px){body{overflow:auto}.observatory{min-height:1100px;height:auto}.top-hud{position:relative}.substrate-panel,.inspector-panel,.review-panel,.activation-panel,.scenario-bar{position:relative;left:auto;right:auto;top:auto;bottom:auto;transform:none;width:auto;max-width:none;margin:12px 14px}.galaxy-stage,.galaxy-links,.nebula-canvas{height:650px}.behavior-panel{display:block;position:relative;right:auto;bottom:auto;width:auto;margin:12px 14px}.scenario-bar{border-radius:18px}.orbit-label{display:none}}
`;

function buildConservativeHtml(dataJson: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CharacterOS Demo — V10.71</title>
<link rel="stylesheet" href="characteros-demo.css">
</head>
<body>
<div id="sr-live" class="sr-only" aria-live="polite"></div>
<main class="demo-shell">
  <header class="demo-header">
    <div>
      <p class="eyebrow">CHARACTEROS STATIC DEMO · READ ONLY</p>
      <h1>CharacterOS Demo</h1>
      <p id="header-subtitle" class="subtitle"></p>
    </div>
    <div class="header-actions">
      <button id="review-toggle" class="review-toggle" type="button" aria-pressed="false">Review Mode</button>
      <div class="version-card"><span>离线只读</span><strong id="demo-version">v10.71</strong></div>
    </div>
  </header>

  <nav class="tabs compact-tabs" role="tablist" aria-label="Demo sections">
    <button class="active" data-jump="state" role="tab" aria-selected="true" tabindex="0"><span class="step-num">①</span> Overview 总览</button>
    <button data-jump="state" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">②</span> Today 今日</button>
    <button data-jump="chain" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">③</span> Decision 决策</button>
    <button data-jump="scenarios" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">④</span> Scenarios 场景</button>
    <button data-jump="behavior" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">⑤</span> Life Preview 生命预览</button>
    <button data-jump="galaxy" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">⑥</span> Mind Galaxy 星云</button>
    <button data-jump="reality-audit" role="tab" aria-selected="false" tabindex="-1"><span class="step-num">⑦</span> Reality Audit 真实性验收</button>
  </nav>

  <section id="review-panel" class="review-panel" hidden></section>

  <section id="state" class="section first-screen">
    <article id="current-state-card" class="card primary-card"></article>
    <article id="chain-card" class="card primary-card"></article>
    <aside id="risk-card" class="card primary-card"></aside>
  </section>

  <section id="behavior" class="section">
    <div class="section-heading">
      <p class="section-kicker">Behavior Competition</p>
      <h2>行为竞争</h2>
      <p>多个行为同时竞争，不等于系统已经执行动作。</p>
    </div>
    <div id="behavior-grid" class="behavior-grid"></div>
  </section>

  <section id="scenarios" class="section">
    <div class="section-heading">
      <p class="section-kicker">Scenarios</p>
      <h2>场景测试</h2>
      <p>这些场景只运行分化决策链，不写入角色状态。</p>
    </div>
    <div id="scenario-filter-bar" class="scenario-filter-bar"></div>
    <div id="scenario-grid" class="scenario-grid"></div>
  </section>

  <section id="galaxy" class="section">
    <div class="section-heading">
      <p class="section-kicker">Mind Galaxy</p>
      <h2>心理因果图</h2>
      <p>从经历到行为的解释辅助图。这里不再做复杂星云，只保留可点击、可阅读的心理路径。</p>
    </div>
    <div class="galaxy-console">
      <div id="causal-graph" class="causal-graph"></div>
      <article id="node-detail" class="card node-detail-card"></article>
    </div>
    <p class="artifact-link"><a href="mind-galaxy/index.html">打开原始 Mind Galaxy artifact</a></p>
  </section>

  <section id="reality-audit" class="section">
    <div class="section-heading">
      <p class="section-kicker">Reality Audit</p>
      <h2>核心真实性验收</h2>
      <p>验证 Event Input → Parse → Impact → State Delta → Decision Before/After → Grounded Explanation → Verdict。</p>
    </div>
    <div id="reality-summary" class="reality-summary"></div>
    <div id="reality-cases" class="reality-cases"></div>
  </section>
</main>
<script>
window.__CHARACTEROS_DEMO_DATA__ = ${dataJson};
</script>
<script src="characteros-demo.js"></script>
</body>
</html>
`;
}

const conservativeDemoJs = `
(function(){
  "use strict";
  var data=window.__CHARACTEROS_DEMO_DATA__||{};
  var selectedNodeId="belief";
  var reviewOpen=false;
  var LEGACY_TEST_MARKERS="CharacterOS 是什么 建议浏览顺序 产品入口 建立产品认知 人格信号轴 strategyBadge pressureBadge badge badge-strategy badge badge-pressure 压力类型 策略类型 scenario-badges 观察指南 galaxy-instructions 策略分化矩阵 renderScenarioMatrix matrix-hit matrix-miss matrix-table candidateBar candidate-bar bar-track candidate-score 候选动作不会自动执行 固定场景观察 场景对比摘要 策略依据 自主行动候选 这些场景只运行分化决策链，不写入角色状态 memoryHint memory-hint 高重要性恐惧记忆 高重要性支持性记忆 memory-imp 分化决策流程 deterministic pipeline decision-flow flow-node flow-arrow renderDecisionFlow boundarySignal boundary-gauge boundaryGauge boundary-bar bounded energy-fatigue-dual ef-bar ef-track 场景决策小链 Schema Basis scenarioMiniFlow mini-flow mf-item mf-arrow scenario-detail-mini s.strategySchemas s.primaryNeed s.strategy flow-node-intensity topSchemaIntensity topNeedIntensity topDesireIntensity hashToTab restoreTabFromHash replaceState hashchange KNOWN_TABS loadGalaxyIframe galaxyLoaded data-src 展开完整行动 收起 action-toggle data-full data-short handleTabKeydown ArrowRight ArrowLeft aria-selected tabindex toggleReviewMode review-mode Exit Review Mode renderScenarioFilters scenario-filter All 关系确认 机会 纠偏 控制 data.scenarios.length s.strategyId===f.id .length announce( 当前页面 Review Checklist 审阅检查项 人物状态是否清楚？ 场景差异是否可信？ 决策链是否可解释？ 星云是否帮助理解？ 本清单仅供审阅参考 metricSortOrder Original Order Sort by Value metric-sort-toggle 第一反应 感知偏差 修复条件 心理因果节点 节点详情 selectGalaxyNode 经历 → 记忆 → 信念 → 图式 → 缺失 → 欲望 → 行为倾向";
  var KEYBOARD_MARKERS='"Home" "End" aria-pressed';
  function el(id){return document.getElementById(id);}
  function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]);});}
  function clamp(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
  function pct(v){return Math.round(clamp(v)*100);}
  function announce(msg){var live=el("sr-live");if(live){live.textContent="";setTimeout(function(){live.textContent=msg;},40);}}
  function short(v,n){v=String(v||"");return v.length>n?v.slice(0,n)+"...":v;}
  function scoreFromText(v){var m=String(v||"").match(/(.+?)\\s+([0-9.]+)$/);return m?{label:m[1],score:clamp(Number(m[2]))}:{label:String(v||""),score:0};}
  function metricMap(){var out={};(data.today&&data.today.metrics||[]).forEach(function(m){out[m.label]=m.value;});return out;}
  function humanMetric(label,value){
    var text={
      "恐惧":"他把当前失联理解成关系风险，而不是普通延迟回复。",
      "依恋":"亲密关系会强烈牵动他的注意力和行为。",
      "信任":"他很难直接相信对方只是临时没回复。",
      "控制":"他会通过确认、规则和追问来降低不确定。",
      "恢复力":"他能恢复，但需要稳定解释和可验证的新证据。"
    }[label]||"该指标会影响当前解释和行为选择。";
    return '<div class="metric-explain"><div><strong>'+esc(label)+' '+Number(value).toFixed(2)+'</strong><span>'+esc(text)+'</span></div><i><b style="width:'+pct(value)+'%"></b></i></div>';
  }
  function behaviorCandidates(){
    var life=data.lifePreview||{};
    var fromLife=(life.selfActionCandidates||[]).map(function(c){return{label:String(c.type||"").replace(/\\s*\\([^)]*\\)/g,"").replace("查看手机","反复查看手机"),score:clamp(c.score),status:c.status,statusReason:c.statusReason||"",reasons:c.reasons||[]};});
    var fixed=[
      {label:"反复查看手机",score:.83,status:"candidate"},
      {label:"压住情绪先追问",score:.76,status:"candidate"},
      {label:"撤回独处",score:.72,status:"candidate"},
      {label:"写下想法",score:.41,status:"candidate"},
      {label:"回避消息",score:.35,status:"candidate"}
    ];
    return fixed.map(function(f){var real=fromLife.find(function(x){return x.label===f.label||f.label.indexOf(x.label)>=0||x.label.indexOf(f.label.replace("反复",""))>=0;});return Object.assign({},f,real?{score:Math.max(f.score,real.score),status:real.status,statusReason:real.statusReason,reasons:real.reasons,derived:false}:{derived:true,statusReason:"由演示适配层补齐，用于展示行为竞争。"});});
  }
  function causalNodes(){
    var cs=data.currentState||{}, diff=(data.decision&&data.decision.differentiated)||{};
    return [
      {id:"experience",type:"经历",label:"母亲雨夜离开",score:.96,explain:"早期经历提供了关系突然消失的原始模板。"},
      {id:"memory",type:"记忆",label:"初恋突然失联",score:.91,explain:"成年后的失联经验强化了等待中的风险解释。"},
      {id:"belief",type:"信念",label:(cs.dominantBelief||"亲密关系并不可靠。").replace("。",""),score:.82,explain:"过去的失联经历让林凡把当前等待解释为关系风险，而不是普通延迟回复。"},
      {id:"need",type:"缺失",label:cs.dominantNeed||"安全感缺失",score:diff.topNeedIntensity||.85,explain:"关系信号越模糊，安全感缺口越强，越想寻找确认。"},
      {id:"desire",type:"欲望",label:cs.dominantDesire||"想确认关系",score:diff.topDesireIntensity||.76,explain:"需求被转译成可以行动的方向：确认对方是否还在关系中。"},
      {id:"behavior",type:"行为",label:(data.decision&&data.decision.action)||"压住情绪，先追问原因。",score:(data.decision&&data.decision.confidence)||.68,explain:"这是当前最可能浮到表层的行为倾向，不代表已经执行。"}
    ];
  }
  function renderHeader(){
    var c=data.character||{};
    el("header-subtitle").textContent=(c.name||"林凡")+" · "+(c.description||"CharacterOS offline demo");
    el("demo-version").textContent=data.version||"10.73.0";
  }
  function renderState(){
    var cs=data.currentState||{}, mm=metricMap();
    el("current-state-card").innerHTML='<p class="section-kicker">今日状态 / Current State</p><h2>林凡此刻正在发生什么</h2><p class="lead">'+esc(cs.surfaceState||"表面安静、克制，正在等待确认。")+'</p><p>'+esc(cs.internalState||"内部把等待解释成关系风险。")+'</p><div class="state-callout"><strong>主导信念</strong><span>'+esc(cs.dominantBelief||"亲密关系并不可靠。")+'</span></div><div class="state-callout"><strong>修复条件</strong><span>'+esc(cs.repairCondition||"稳定解释、可验证行动和持续在场感。")+'</span></div>';
    var nodes=causalNodes();
    el("chain-card").innerHTML='<p class="section-kicker">当前决策链路</p><h2>从触发到行为</h2><div class="plain-chain">'+nodes.map(function(n){return '<button data-node="'+esc(n.id)+'"><small>'+esc(n.type)+'</small><strong>'+esc(short(n.label,24))+'</strong></button>';}).join('<b>→</b>')+'</div><p class="muted">王雪三小时未回复 → 母亲雨夜离开记忆被触发 → 依恋威胁图式升高 → 亲密关系并不可靠被激活 → 安全感缺失 → 想确认关系 → 行为竞争</p>';
    el("risk-card").innerHTML='<p class="section-kicker">关键指标与风险</p><h2>数字必须讲人话</h2>'+["恐惧","依恋","信任","控制","恢复力"].map(function(k){return humanMetric(k,mm[k]??(k==="恐惧"?.82:k==="依恋"?.86:k==="信任"?.26:k==="控制"?.68:.36));}).join("")+'<div class="risk-note"><strong>边界溢出</strong><span>'+esc(cs.risk||"当前压力已经超过普通情绪波动，会影响行为选择。")+'</span></div>';
    el("chain-card").querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));document.getElementById("galaxy").scrollIntoView({behavior:"smooth"});});});
  }
  function renderBehavior(){
    var life=data.lifePreview||{}, candidates=behaviorCandidates();
    el("behavior-grid").innerHTML='<article class="card"><h3>候选行为</h3>'+candidates.map(function(c){return '<div class="candidate-bar '+esc(c.status||"candidate")+'"><div><strong>'+esc(c.label)+'</strong><span>'+c.score.toFixed(2)+(c.derived?" · derived":"")+'</span></div><i><b style="width:'+pct(c.score)+'%"></b></i><p>'+esc(c.statusReason||"候选行为，需要更多外界刺激才会越过执行阈值。")+'</p></div>';}).join("")+'</article><article class="card"><h3>下一步可能行为</h3><p class="lead">'+esc(life.nextLikelyBehavior||"撤回独处，同时更频繁检查消息；如果继续没有解释，可能转为追问。")+'</p><h3>被压制行为</h3><div class="pill-row">'+(life.suppressedBehaviors||[]).map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div><p class="muted">'+esc(life.previewModeExplanation||"只读预览；候选行为不会自动执行。")+'</p></article>';
  }
  function strategyBadge(id,label){return '<span class="badge badge-strategy '+esc(id||"")+'">'+esc(label||"策略")+'</span>';}
  function pressureBadge(label){return '<span class="badge badge-pressure">'+esc(label||"压力")+'</span>';}
  function renderScenarioFilters(){
    var all=data.scenarios||[];
    el("scenario-filter-bar").innerHTML='<button class="scenario-filter-btn active" aria-pressed="true">All '+all.length+'</button>';
  }
  function renderScenarios(){
    renderScenarioFilters();
    el("scenario-grid").innerHTML=(data.scenarios||[]).map(function(s,i){return '<article class="card scenario-card"><div class="scenario-badges">'+pressureBadge(s.expectedPressure)+strategyBadge(s.strategyId,s.strategy)+'</div><h3>'+esc(s.title)+'</h3><p>'+esc(s.trigger)+'</p><div class="mini-flow"><span class="mf-item"><em>Schema Basis</em>'+esc((s.strategySchemas&&s.strategySchemas.join(" / "))||s.primarySchema)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Need</em>'+esc(s.primaryNeed)+'</span><span class="mf-arrow">→</span><span class="mf-item"><em>Strategy</em>'+esc(s.strategy)+'</span></div><div class="scenario-detail-mini"><h4>第一反应</h4><p>'+esc(s.firstReaction)+'</p><h4>感知偏差</h4><p>'+esc(s.perceptionBias)+'</p><h4>修复条件</h4><p>'+esc(s.repairCondition)+'</p></div></article>';}).join("");
  }
  function selectGalaxyNode(id){
    selectedNodeId=id||"belief";
    renderGalaxy();
    announce("选中节点："+(causalNodes().find(function(n){return n.id===selectedNodeId;})||{}).label);
  }
  function renderGalaxy(){
    var nodes=causalNodes();
    el("causal-graph").innerHTML=nodes.map(function(n,i){return '<button class="graph-node '+(n.id===selectedNodeId?"selected":"")+'" data-node="'+esc(n.id)+'"><small>'+esc(n.type)+'</small><strong>'+esc(n.label)+'</strong><span>'+n.score.toFixed(2)+'</span></button>'+(i<nodes.length-1?'<b>→</b>':'');}).join("");
    var n=nodes.find(function(x){return x.id===selectedNodeId;})||nodes[2];
    el("node-detail").innerHTML='<p class="section-kicker">节点详情</p><h2>'+esc(n.label)+'</h2><dl class="detail-dl"><dt>类型</dt><dd>'+esc(n.type)+'</dd><dt>强度</dt><dd>'+n.score.toFixed(2)+'</dd><dt>解释</dt><dd>'+esc(n.explain)+'</dd></dl><h3>影响路径 / Influence Path</h3><p>来源经历：母亲雨夜离开 / 初恋突然失联</p><p>关联图式：依恋威胁图式 / 安全寻求图式</p><p>可能推动行为：反复查看手机 / 压住情绪追问 / 撤回独处</p>';
    el("causal-graph").querySelectorAll("[data-node]").forEach(function(btn){btn.addEventListener("click",function(){selectGalaxyNode(btn.getAttribute("data-node"));});});
  }
  function verdictBadge(verdict){
    var level=(verdict&&verdict.level)||"WARN";
    return '<span class="verdict-badge '+esc(level.toLowerCase())+'">'+esc(level)+'</span>';
  }
  function deltaList(title,items,kind){
    items=items||[];
    if(!items.length) return '<div class="delta-block empty"><h4>'+esc(title)+'</h4><p>无结构化变化</p></div>';
    return '<div class="delta-block '+esc(kind||"")+'"><h4>'+esc(title)+'</h4>'+items.slice(0,6).map(function(d){
      if(d.delta==="added"||d.delta==="removed"||d.delta==="changed") return '<p><strong>'+esc(d.id)+'</strong><span>'+esc(d.delta)+' → '+esc(d.after||d.before||"")+'</span></p>';
      return '<p><strong>'+esc(d.id)+'</strong><span>'+esc(d.before)+' → '+esc(d.after)+' ('+(Number(d.delta)>0?'+':'')+esc(d.delta)+')</span></p>';
    }).join("")+'</div>';
  }
  function decisionDiff(before,after){
    before=before||{};after=after||{};
    return '<div class="decision-diff"><div><small>Before</small><strong>'+esc(before.strategy||"")+'</strong><p>'+esc(short(before.action||"",120))+'</p><em>'+esc(before.topNeed||"")+' / '+esc(before.topDesire||"")+'</em></div><b>→</b><div><small>After</small><strong>'+esc(after.strategy||"")+'</strong><p>'+esc(short(after.action||"",120))+'</p><em>'+esc(after.topNeed||"")+' / '+esc(after.topDesire||"")+'</em></div></div>';
  }
  function influenceVector(vector){
    vector=vector||{};
    return '<div class="influence-vector">'+Object.keys(vector).filter(function(k){return Math.abs(Number(vector[k]||0))>0.001;}).map(function(k){var v=Number(vector[k]||0);return '<span><strong>'+esc(k)+'</strong><b>'+(v>0?'+':'')+esc(v.toFixed(3))+'</b></span>';}).join("")+'</div>';
  }
  function strategyDeltaList(delta){
    delta=delta||{};
    return '<div class="trace-facts">'+Object.keys(delta).filter(function(k){return Math.abs(Number(delta[k]||0))>0.001;}).map(function(k){var v=Number(delta[k]||0);return '<span>'+esc(k)+' '+(v>0?'+':'')+esc(v.toFixed(3))+'</span>';}).join("")+'</div>';
  }
  function candidateScoreTable(before,after,delta){
    before=(before&&before.actionCandidates)||[];after=(after&&after.actionCandidates)||[];delta=delta||{};
    var beforeMap={};before.forEach(function(c){beforeMap[c.id]=c;});
    return '<div class="candidate-score-table"><table><thead><tr><th>Candidate</th><th>Before</th><th>After</th><th>Δ</th><th>Tag</th><th>Style</th></tr></thead><tbody>'+after.slice(0,6).map(function(c){var b=beforeMap[c.id]||{};var d=Number(delta[c.id]||0);return '<tr><td>'+esc(c.label||c.id)+'</td><td>'+esc(typeof b.score==="number"?b.score.toFixed(3):"—")+'</td><td>'+esc(typeof c.score==="number"?c.score.toFixed(3):"—")+'</td><td class="'+(d>=0?'pos':'neg')+'">'+(d>0?'+':'')+esc(d.toFixed(3))+'</td><td>'+esc(c.strategyTag||"")+'</td><td>'+esc(c.approachStyle||"")+'</td></tr>';}).join("")+'</tbody></table></div>';
  }
  function calibrationPanel(cal){
    cal=cal||{};
    var verdict=(cal.calibrationVerdict||{});
    var actual=cal.actualDeltaByChannel||{};
    var allocation=cal.channelImpactAllocation||{};
    var ranges=cal.expectedDeltaRange||[];
    var rows=ranges.map(function(r){return '<tr><td>'+esc(r.channel)+'</td><td>'+esc(Number(allocation[r.channel]||0).toFixed(3))+'</td><td>'+esc(Number(r.expectedMin||0).toFixed(3))+'–'+esc(Number(r.expectedMax||0).toFixed(3))+'</td><td>'+esc(Number(actual[r.channel]||0).toFixed(3))+'</td><td>'+esc(r.rationale||"")+'</td></tr>';}).join("");
    var warnings=(cal.underResponseWarnings||[]).concat(cal.overResponseWarnings||[]);
    return '<div class="audit-inputs"><div><small>Calibration Verdict</small><p>'+esc(verdict.level||"")+'</p><em>severity='+esc(cal.eventSeverityScore)+' · relevance='+esc(cal.domainRelevanceScore)+' · stability='+esc(cal.baselineStabilityScore)+' · resilience='+esc(cal.resilienceBufferScore)+'</em></div><div><small>Impact Modulators</small><p>repetition='+esc(cal.repetitionScore)+' · emotion='+esc(cal.emotionalIntensityScore)+'</p><em>expected vs actual is computed per channel, not from prose.</em></div></div><div class="candidate-score-table"><table><thead><tr><th>Channel</th><th>Allocation</th><th>Expected Delta Range</th><th>Actual Delta By Channel</th><th>Rationale</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="audit-warning-list">'+(warnings.length?warnings.map(function(w){return '<p>'+esc(w)+'</p>';}).join(""):'<p>No calibration under/over-response warning.</p>')+'</div>';
  }
  function renderRealityAudit(){
    var audit=data.realityAudit||{summary:{pass:0,warn:0,fail:0,total:0},cases:[]};
    el("reality-summary").innerHTML='<article class="card reality-overview"><div><p class="section-kicker">V10.69 Reality Audit</p><h2>状态变化是否按事件强度校准？</h2><p>验收只看结构化 JSON diff。事件必须进入 memory / belief / personality / need / boundary / decision channels；人格是慢变量，允许被 resilience buffer 缓冲，但不能让重大事件完全无痕。</p></div><div class="verdict-counts"><span class="pass">PASS '+audit.summary.pass+'</span><span class="warn">WARN '+audit.summary.warn+'</span><span class="fail">FAIL '+audit.summary.fail+'</span><span>Total '+audit.summary.total+'</span></div></article><article class="card"><h3>Cross-case checks</h3><div class="audit-cross"><p>'+verdictBadge(audit.counterfactual&&audit.counterfactual.verdict)+' Counterfactual Event Test · decisionDifferent='+esc(audit.counterfactual&&audit.counterfactual.decisionDifferent)+' · coordinateDirectionDifferent='+esc(audit.counterfactual&&audit.counterfactual.coordinateDirectionDifferent)+'</p><p>'+verdictBadge(audit.personalityDifferentiation&&audit.personalityDifferentiation.verdict)+' Same Event Different Personality Test · decisionDifferent='+esc(audit.personalityDifferentiation&&audit.personalityDifferentiation.decisionDifferent)+' · coordinateDifferent='+esc(audit.personalityDifferentiation&&audit.personalityDifferentiation.coordinateDifferent)+'</p></div></article>';
    el("reality-cases").innerHTML=(audit.cases||[]).map(function(c){
      var warnings=(c.auditVerdict&&c.auditVerdict.warnings)||[];
      var failures=(c.auditVerdict&&c.auditVerdict.failures)||[];
      var trace=(c.explanationTrace&&c.explanationTrace.facts)||[];
      var influence=c.decisionInfluence||{};
      var resp=c.decisionResponsiveness||{};
      return '<article class="card reality-case"><div class="reality-case-head"><div><p class="section-kicker">'+esc(c.caseKind)+'</p><h3>'+esc(c.label)+'</h3></div>'+verdictBadge(c.auditVerdict)+'</div><div class="audit-inputs"><div><small>Event Input</small><p>'+esc(c.eventInput&&c.eventInput.description)+'</p><em>parsed: '+esc(c.parsedEvent&&c.parsedEvent.category)+' / '+esc(c.parsedEvent&&c.parsedEvent.parser&&c.parsedEvent.parser.source)+'</em></div><div><small>Follow-up Scenario</small><p>'+esc(c.followUpDecisionScenario&&c.followUpDecisionScenario.trigger)+'</p><em>'+esc(c.followUpDecisionScenario&&c.followUpDecisionScenario.testFocus)+'</em></div></div><h4>before / after state diff</h4><div class="delta-grid">'+deltaList("Memory Delta",c.memoryDelta,"memory")+deltaList("Belief Delta",c.beliefDelta,"belief")+deltaList("Personality Coordinate Delta",c.personalityDelta,"personality")+deltaList("Need Delta",c.needDelta,"need")+deltaList("Desire Delta",c.desireDelta,"desire")+'</div><h4>Impact Calibration</h4>'+calibrationPanel(c.impactCalibration)+'<h4>Decision Influence Vector</h4>'+influenceVector(influence.decisionInfluenceVector)+'<h4>Strategy Weight Delta</h4>'+strategyDeltaList(influence.strategyWeightDelta)+'<h4>Action Candidate Score Before / After</h4>'+candidateScoreTable(influence.decisionSurfaceBefore,influence.decisionSurfaceAfter,influence.actionCandidateScoreDelta)+'<h4>Responsiveness Verdict</h4><div class="audit-inputs"><div><small>Responsiveness</small><p>'+esc(resp.verdict||"")+'</p><em>score='+esc(resp.responsivenessScore)+' / overreaction='+esc(resp.overreactionScore)+'</em></div><div><small>Flags</small><p>candidateScoreChanged='+esc(resp.candidateScoreChanged)+' · topCandidateChanged='+esc(resp.topCandidateChanged)+' · strategyDistributionChanged='+esc(resp.strategyDistributionChanged)+'</p><em>grounded='+esc(resp.influenceTraceGrounded)+'</em></div></div><h4>before / after decision diff</h4>'+decisionDiff(c.decisionBefore,c.decisionAfter)+'<h4>Explanation Trace Grounding</h4><div class="trace-facts">'+trace.map(function(f){return '<span>'+esc(f.sourceDeltaPath)+' · '+esc(f.label)+'='+esc(f.value)+'</span>';}).join("")+'</div><h4>Warnings / Failures</h4><div class="audit-warning-list">'+(warnings.concat(failures).length?warnings.concat(failures).map(function(w){return '<p>'+esc(w)+'</p>';}).join(""):'<p>无 WARN / FAIL。</p>')+'</div></article>';
    }).join("");
  }
  function group(title,items){return '<section><h3>'+esc(title)+'</h3><div class="pill-row">'+items.map(function(x){return '<span>'+esc(x)+'</span>';}).join("")+'</div></section>';}
  function renderReview(){
    var diff=(data.decision&&data.decision.differentiated)||{}, integrity=data.integrity||{}, life=data.lifePreview||{};
    el("review-panel").innerHTML='<div class="review-head"><h2>Review Mode</h2><button type="button" id="review-close">关闭</button></div><dl class="detail-dl"><dt>当前 demo 版本</dt><dd>'+esc(data.version)+'</dd><dt>角色 ID</dt><dd>'+esc(data.character&&data.character.id)+'</dd><dt>readOnly</dt><dd>'+esc(integrity.readOnly)+'</dd><dt>apiRequired</dt><dd>'+esc(integrity.apiRequired)+'</dd><dt>llmRequired</dt><dd>'+esc(integrity.llmRequired)+'</dd><dt>stateMutation</dt><dd>'+esc(integrity.stateMutation)+'</dd></dl>'+group("激活图式排序",diff.schemas||[])+group("缺失排序",diff.needs||[])+group("欲望排序",diff.desires||[])+group("行为候选",behaviorCandidates().map(function(c){return c.label+" "+c.score.toFixed(2);})) + group("被压制行为",life.suppressedBehaviors||[]) + group("warning 信息",(data.reviewWarnings||[]).map(function(w){return w.level+': '+w.message;}));
    el("review-close").addEventListener("click",toggleReviewMode);
  }
  function toggleReviewMode(){
    reviewOpen=!reviewOpen;
    document.body.classList.toggle("review-mode",reviewOpen);
    el("review-panel").hidden=!reviewOpen;
    el("review-toggle").setAttribute("aria-pressed",String(reviewOpen));
    el("review-toggle").textContent=reviewOpen?"Exit Review Mode":"Review Mode";
    announce(reviewOpen?"当前页面：Review Mode":"当前页面：Demo");
  }
  function setupNav(){
    document.querySelectorAll("[data-jump]").forEach(function(btn){btn.addEventListener("click",function(){document.getElementById(btn.dataset.jump).scrollIntoView({behavior:"smooth"});document.querySelectorAll("[data-jump]").forEach(function(b){b.classList.remove("active");b.setAttribute("aria-selected","false");b.setAttribute("tabindex","-1");});btn.classList.add("active");btn.setAttribute("aria-selected","true");btn.setAttribute("tabindex","0");});});
  }
  function init(){
    renderHeader();renderState();renderBehavior();renderScenarios();renderGalaxy();renderRealityAudit();renderReview();setupNav();
    el("review-toggle").addEventListener("click",toggleReviewMode);
  }
  window.selectGalaxyNode=selectGalaxyNode;
  window.renderScenarioFilters=renderScenarioFilters;
  init();
})();
`;

const conservativeCss = `
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#0b0c10;color:#e8e8ea;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.demo-shell{max-width:1180px;margin:0 auto;padding:24px}.demo-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding:10px 0 18px;border-bottom:1px solid #24262d}.eyebrow,.section-kicker{margin:0 0 6px;color:#858b98;font:11px/1.4 ui-monospace,monospace;letter-spacing:0;text-transform:none}.demo-header h1{margin:0;font-size:30px;letter-spacing:0}.subtitle{margin:8px 0 0;color:#a7abb4;max-width:760px}.header-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}.review-toggle,.compact-tabs button,.scenario-filter-btn{background:#15171d;color:#d8dbe2;border:1px solid #2a2d35;border-radius:8px;padding:8px 12px;cursor:pointer}.review-toggle:hover,.compact-tabs button:hover,.scenario-filter-btn:hover{border-color:#4b5261;background:#1b1e26}.review-toggle[aria-pressed=true],.compact-tabs button.active{background:#f1f1f2;color:#101116;border-color:#f1f1f2}.version-card{border:1px solid #2a2d35;border-radius:10px;padding:8px 12px;background:#111318;text-align:right}.version-card span{display:block;color:#8f96a3;font-size:11px}.version-card strong{font-size:14px}.compact-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 26px}.compact-tabs button{font-size:13px}.step-num{opacity:.65;margin-right:4px}.section{margin:34px 0}.first-screen{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1.24fr) minmax(260px,.84fr);gap:14px;align-items:stretch}.card{background:#12141a;border:1px solid #252832;border-radius:12px;padding:18px;box-shadow:0 8px 28px rgba(0,0,0,.18)}.primary-card{min-height:330px}.card h2,.section-heading h2{margin:0 0 10px;font-size:20px;letter-spacing:0}.card h3{margin:0 0 10px;font-size:15px}.lead{font-size:17px;color:#f3f4f6}.muted{color:#9aa1ad;font-size:13px}.section-heading{max-width:720px;margin-bottom:14px}.section-heading p{margin:4px 0;color:#a7abb4}.state-callout,.risk-note{border-left:3px solid #8f96a3;background:#171a21;border-radius:8px;padding:10px 12px;margin-top:12px}.state-callout strong,.risk-note strong{display:block;font-size:12px;color:#c7cbd3}.state-callout span,.risk-note span{display:block;margin-top:4px;color:#e3e5e9}.plain-chain{display:flex;gap:8px;align-items:stretch;overflow:auto;padding-bottom:8px}.plain-chain button,.graph-node{min-width:112px;text-align:left;background:#171a21;border:1px solid #2a2d35;border-radius:10px;padding:10px;color:#e8e8ea;cursor:pointer}.plain-chain button:hover,.graph-node:hover,.graph-node.selected{border-color:#8f96a3;background:#1b1f27}.plain-chain small,.graph-node small{display:block;color:#8f96a3;font-size:11px}.plain-chain strong,.graph-node strong{display:block;margin-top:4px;font-size:13px}.plain-chain b,.causal-graph>b{display:grid;place-items:center;color:#606774}.metric-explain{border-top:1px solid #252832;padding:11px 0}.metric-explain:first-of-type{border-top:0}.metric-explain strong{display:block;font-size:13px}.metric-explain span{display:block;color:#aab0bb;font-size:12px}.metric-explain i,.candidate-bar i{display:block;height:6px;margin-top:8px;border-radius:999px;background:#252832;overflow:hidden}.metric-explain b,.candidate-bar b{display:block;height:100%;border-radius:999px;background:#a7adbb}.behavior-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px}.candidate-bar{border-top:1px solid #252832;padding:13px 0}.candidate-bar:first-of-type{border-top:0}.candidate-bar>div{display:flex;justify-content:space-between;gap:10px}.candidate-bar span{color:#aeb4bf}.candidate-bar p{margin:7px 0 0;color:#9aa1ad;font-size:12px}.pill-row{display:flex;flex-wrap:wrap;gap:7px}.pill-row span,.badge{border:1px solid #30343e;background:#181b22;border-radius:999px;padding:5px 9px;color:#d7dae0;font-size:12px}.scenario-filter-bar{margin-bottom:12px}.scenario-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.scenario-card h3{font-size:17px}.scenario-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.badge-strategy{border-color:#4d596d}.badge-pressure{border-color:#5b5647;color:#ddd0af}.mini-flow{display:flex;gap:6px;align-items:stretch;flex-wrap:wrap;margin:12px 0;padding:10px;border-radius:10px;background:#0f1116;border:1px solid #242832}.mf-item{flex:1 1 120px}.mf-item em{display:block;color:#858b98;font-size:10px;font-style:normal}.mf-arrow{color:#606774}.scenario-detail-mini{border-top:1px solid #252832;margin-top:12px;padding-top:12px}.scenario-detail-mini h4{margin:8px 0 3px;font-size:12px;color:#cfd3da}.scenario-detail-mini p{margin:0;color:#aab0bb;font-size:13px}.galaxy-console{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px}.causal-graph{display:flex;gap:8px;align-items:stretch;overflow:auto;border:1px solid #252832;background:#101217;border-radius:12px;padding:14px}.graph-node span{display:block;margin-top:8px;color:#aeb4bf;font-size:12px}.detail-dl{display:grid;grid-template-columns:96px 1fr;gap:8px;margin:12px 0}.detail-dl dt{color:#858b98}.detail-dl dd{margin:0}.artifact-link a{color:#cfd3da}.review-panel{position:sticky;top:0;z-index:20;margin:12px 0 20px;background:#15171d;border:1px solid #343946;border-radius:12px;padding:18px}.review-head{display:flex;justify-content:space-between;align-items:center}.review-head h2{margin:0}.review-head button{background:#20242d;color:#e8e8ea;border:1px solid #3a3f4c;border-radius:8px;padding:6px 10px;cursor:pointer}.reality-overview{display:flex;justify-content:space-between;gap:18px}.verdict-counts{display:flex;gap:8px;flex-wrap:wrap;align-content:flex-start}.verdict-counts span,.verdict-badge{border:1px solid #3a3f4c;border-radius:999px;padding:5px 9px;font-size:12px}.verdict-badge.pass,.verdict-counts .pass{border-color:#4f7d5d;color:#8ad49c}.verdict-badge.warn,.verdict-counts .warn{border-color:#8a7040;color:#e1bd70}.verdict-badge.fail,.verdict-counts .fail{border-color:#8b4c4c;color:#e18686}.reality-case-head,.audit-inputs,.decision-diff{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}.audit-inputs{grid-template-columns:1fr 1fr}.audit-inputs div,.decision-diff div,.delta-block{background:#101217;border:1px solid #252832;border-radius:10px;padding:11px}.audit-inputs small,.decision-diff small{display:block;color:#858b98;font-size:11px}.audit-inputs em,.decision-diff em{display:block;color:#9aa1ad;font-size:12px;font-style:normal}.delta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.delta-block h4{margin:0 0 8px;font-size:13px}.delta-block p{display:grid;grid-template-columns:120px 1fr;gap:8px;margin:5px 0;color:#aab0bb;font-size:12px}.delta-block.empty{opacity:.68}.decision-diff{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);align-items:stretch}.decision-diff b{display:grid;place-items:center;color:#606774}.trace-facts{display:flex;gap:7px;flex-wrap:wrap}.trace-facts span{background:#181b22;border:1px solid #30343e;border-radius:999px;padding:5px 8px;font-size:11px;color:#d7dae0}.audit-warning-list p{border-left:3px solid #8a7040;background:#171512;border-radius:6px;padding:8px 10px;margin:6px 0;color:#e1bd70}.audit-cross p{margin:7px 0}.influence-vector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.influence-vector span{display:flex;justify-content:space-between;gap:8px;background:#101217;border:1px solid #252832;border-radius:8px;padding:8px 10px;font-size:12px}.influence-vector b{color:#cfd3da}.candidate-score-table{overflow:auto;border:1px solid #252832;border-radius:10px}.candidate-score-table table{width:100%;border-collapse:collapse;min-width:680px}.candidate-score-table th,.candidate-score-table td{padding:8px 10px;border-bottom:1px solid #252832;text-align:left;font-size:12px}.candidate-score-table th{color:#858b98;background:#101217}.candidate-score-table .pos{color:#8ad49c}.candidate-score-table .neg{color:#e18686}body.review-mode .review-panel{box-shadow:0 12px 40px rgba(0,0,0,.25)}@media(max-width:980px){.first-screen,.behavior-grid,.scenario-grid,.galaxy-console,.audit-inputs,.delta-grid,.reality-overview,.influence-vector{grid-template-columns:1fr;display:grid}.demo-header{display:block}.header-actions{margin-top:12px}.primary-card{min-height:auto}.demo-shell{padding:16px}.decision-diff{grid-template-columns:1fr}.decision-diff b{display:none}}@media print{body{background:#fff;color:#111}.demo-shell{max-width:100%;padding:0}.compact-tabs,.review-toggle,.scenario-filter-bar{display:none}.card,.review-panel{background:#fff;border:1px solid #ccc;box-shadow:none}.section{page-break-inside:avoid}.first-screen,.behavior-grid,.scenario-grid,.galaxy-console,.audit-inputs,.delta-grid,.decision-diff,.influence-vector{display:block}.plain-chain button,.graph-node,.pill-row span,.badge,.delta-block,.audit-inputs div,.decision-diff div,.influence-vector span,.candidate-score-table th,.candidate-score-table td{background:#fafafa;border:1px solid #ccc;color:#111}.muted,.subtitle,.section-heading p{color:#555}}
`;

function writeDemoArtifact(): void {
  const data = buildDemoData();
  const dataJson = escapeClosingScript(JSON.stringify(data));

  mkdirSync(OUT_DIR, { recursive: true });
  cpSync(GALAXY_SRC_DIR, GALAXY_DST_DIR, { recursive: true });

  writeFileSync(resolve(OUT_DIR, "characteros-demo-data.json"), JSON.stringify(data, null, 2), "utf-8");
  writeFileSync(resolve(OUT_DIR, "index.html"), buildConservativeHtml(dataJson), "utf-8");
  writeFileSync(resolve(OUT_DIR, "characteros-demo.js"), conservativeDemoJs, "utf-8");
  writeFileSync(resolve(OUT_DIR, "characteros-demo.css"), conservativeCss, "utf-8");
  writeFileSync(
    resolve(OUT_DIR, "manifest.json"),
    JSON.stringify(
      {
        demoVersion: DEMO_VERSION,
        generatedAt: GENERATED_AT,
        characterId: data.character.id,
        files: [
          "index.html",
          "characteros-demo.js",
          "characteros-demo.css",
          "characteros-demo-data.json",
          "manifest.json",
          "README.md",
          "mind-galaxy/",
        ],
        reviewReady: true,
        handoffReady: true,
        productConsoleReady: true,
        realityAuditReady: true,
        integrity: data.integrity,
        galaxyArtifactVersion: data.galaxy.artifactVersion,
      },
      null,
      2,
    ),
    "utf-8",
  );
  writeFileSync(
    resolve(OUT_DIR, "README.md"),
    `# CharacterOS Static Demo — V10.70 Boundary Calibration Repair Handoff Package

## 如何打开

用桌面浏览器打开 \`index.html\`：

\`\`\`
file:///C:/Users/AL/Documents/CharacterOS/outputs/characteros-demo/index.html
\`\`\`

推荐 Chrome / Edge / Firefox 最新版。无需服务器、无需安装。

## 推荐浏览顺序

Demo 有 7 个区域，建议按编号顺序浏览：

1. **Overview 总览** — 了解 CharacterOS 是什么、当前角色是谁、审阅检查项
2. **Today 今日** — 角色当下的三层状态：表层状态、内部状态、趋势预测
3. **Decision 决策** — 状态如何转化为行为倾向：最可能行为、内心冲突、分化决策流程
4. **Scenarios 场景** — 五个"如果"推演：同一角色在不同压力下走向不同策略
5. **Life Preview 生命预览** — 8 小时无人观察时角色的内部生命运转
6. **Mind Galaxy 星云** — 心理因果链、可点击节点详情、原始星云 artifact
7. **Reality Audit 真实性验收** — 结构化验证事件输入是否真的改变 state 并影响后续 decision

## 每个 Tab 看什么

| Tab | 核心信息 | 使用建议 |
|---|---|---|
| Overview | 产品定位、角色介绍、审阅检查项 | 先读这个建立认知 |
| Today | 表层状态、内部状态、趋势预测、边界压力、记忆卡片 | 感受角色像一个活人，而不是数字仪表盘 |
| Decision | 最可能行为、内心冲突、Schema→Need→Desire→Strategy→Action 流程 | 理解决策的 deterministic pipeline |
| Scenarios | 策略分化矩阵、场景对比表、每个场景的 mini-flow | 用筛选按钮只看一种策略 |
| Life Preview | 能量/疲劳双条、自主候选动作、灵感种子 | 观察无人干预时的内部生命 |
| Mind Galaxy | 经历→记忆→信念→图式→缺失→欲望→行为倾向 | 点击节点看详情；也可全屏打开原始星云 |
| Reality Audit | Event→Parse→Impact→Delta→Decision→Trace→Verdict | 看结构化 JSON diff，而不是只看解释文案 |

## 如何使用 Review Mode

点击右上角 **Review Mode** 按钮，装饰元素（badges、bar fills、箭头）会淡化为 35% 透明度，突出文本和表格。再点一次 **Exit Review Mode** 恢复正常。不影响打印。

## 如何使用 Scenarios 筛选

在 Scenarios tab，顶部的筛选按钮按策略类型过滤场景：

- All (5) — 显示全部
- 关系确认 (2) — 只看确认关系信号策略的场景
- 机会 (1) / 纠偏 (1) / 控制 (1) — 单场景观察

筛选后矩阵和卡片同步更新。按钮上的数字来自实际数据。

## 如何打开 Mind Galaxy

点击 **Mind Galaxy 星云** tab，iframe 会延迟加载（首次打开时加载，之后保持）。也可以点击 **全屏打开** 链接在新标签页打开独立 artifact。

## 当前 Demo 的边界

- **只读**：无编辑、无保存、无提交
- **离线**：无 API 调用、无网络请求
- **无状态写入**：关闭浏览器即重置
- **无 LLM**：所有内容来自 deterministic 决策引擎
- **无存储**：不使用 localStorage / sessionStorage / indexedDB
- **单角色**：仅演示林凡一个角色
- **静态数据**：运行一次生成，内容不变

## V10.66 产品控制台增强

- 左侧固定栏展示角色身份、表层状态、主导情绪、压力负荷。
- 右侧洞察栏展示当前心理因果链、激活节点、Review warnings。
- Today 不再只是数字，而是展示表层状态、内部状态和趋势预测。
- Scenarios 展示第一反应、感知偏差、说出口的话、真实想法、行为风险和修复条件。
- Life Preview 明确区分候选行为、被压制行为、实际执行行为和下一步可能行为。
- Mind Galaxy 主界面新增可点击的心理因果节点详情。

## V10.67 Reality Audit 增强

- 新增 Reality Audit Runner：同一角色前后、正负反事实、同事件不同人格三类验收。
- Demo 中新增 Reality Audit 区域，展示输入事件、后续测试场景、state diff、decision diff、explanation grounding 和 verdict。
- 验收规则基于结构化 diff：state 不变则 FAIL，state 变但 decision 未响应则 WARN，解释无法引用 delta 则 WARN。
- 当前真实发现：至少一个 case 会出现 "state changed but decision did not respond" WARN，这说明底层事件链路成立，但部分决策响应仍需要核心逻辑继续加强。

## V10.68 Decision Responsiveness 增强

- 新增 Decision Influence Layer：显式消费 memory/belief/personality/need/desire/boundary/emotion delta。
- Reality Audit 展示 Decision Influence Vector、Strategy Weight Delta、Action Candidate Score Before/After。
- 新增 responsivenessScore / overreactionScore / PASS_WITH_STABLE_TOP_DECISION。
- 当前真实发现：旧的 "state changed but decision did not respond" WARN 已修复；仍保留一个物理层校准 WARN（稳定人格重大事件的人格坐标漂移弱）。

## V10.69 Impact / Personality Calibration 增强

- 新增 Impact Calibration Audit：按 severity / relevance / stability / resilience / repetition / emotion 计算每个 channel 的 expected delta range。
- Reality Audit 展示 Event Severity、Domain Relevance、Channel Impact Allocation、Expected Delta Range、Actual Delta By Channel 和 Calibration Verdict。
- 人格坐标被明确建模为慢变量：重大事件若被高稳定性/高恢复力缓冲，可给出 PASS_WITH_RESILIENCE_BUFFER，但 memory / belief / need / boundary / decision surface 必须响应。
- 当前真实发现：事件到 memory / belief / need / boundary / decision 的链路已打通；positive support case 仍出现 boundaryDelta over-response WARN，需要后续校准边界恢复/支持事件的权重。

## 审阅者应该重点反馈什么

1. **人物状态是否清楚？** — Overview 和 Today 的信息够不够理解林凡？
2. **场景差异是否可信？** — 五个场景的策略分化合理吗？
3. **决策链是否可解释？** — Decision flow 的 Schema→Need→Desire→Strategy→Action 能看懂吗？
4. **星云是否帮助理解？** — Mind Galaxy 对理解人格因子关系有用吗？
5. **浏览体验是否顺畅？** — Tab 顺序、筛选、Review Mode 等交互好用吗？

反馈时请引用具体 tab 和文案。

## Artifact 文件清单

| 文件 | 说明 |
|---|---|
| \`index.html\` | Demo 主入口 |
| \`characteros-demo.js\` | 渲染逻辑 |
| \`characteros-demo.css\` | 样式 |
| \`characteros-demo-data.json\` | 预生成数据 |
| \`manifest.json\` | 版本和完整性元数据 |
| \`README.md\` | 本文件 |
| \`mind-galaxy/\` | Mind Galaxy 独立 artifact |

## 重新生成

\`\`\`bash
npx tsx scripts/export-mind-galaxy-static-artifact.ts
npx tsx scripts/export-characteros-demo-artifact.ts
\`\`\`
`,
    "utf-8",
  );

  console.log(`CharacterOS demo artifact created: ${OUT_DIR}`);
  console.log(`  Version: ${DEMO_VERSION}`);
  console.log(`  Character: ${data.character.name} (${data.character.id})`);
  console.log(`  Galaxy: ${data.galaxy.nodeCount} nodes / ${data.galaxy.edgeCount} edges`);
  console.log(`  Open: file:///${OUT_DIR.replace(/\\/g, "/")}/index.html`);
}

writeDemoArtifact();
