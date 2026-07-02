/**
 * useFactorDataTransform — converts CharacterOS data into MindSpace3D scene data.
 *
 * V2: Layered shell distribution with curated spherical coordinates.
 * Each display factor is placed on inner/middle/outer shells.
 * Generates connection streams from core to each factor.
 */

"use client";

import { useMemo } from "react";
import type { SerializedCharacterPhysicsState } from "@/core/physics/serialization";
import {
  DISPLAY_FACTOR_REGISTRY,
  SHELL_RADII,
  type MindSpace3DData,
  type FactorCloud3D,
  type ConnectionStreamData,
  type DisplayFactorId,
  type EventParticle3D,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Base halo particle count */
const BASE_HALO_COUNT = 250;
/** Base core particle count */
const BASE_CORE_COUNT = 120;
/** Extra particles per 0.1 value */
const EXTRA_PER_TENTH = 15;

// ═══════════════════════════════════════════════════════════════════════════
// Coordinate Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert spherical coordinates + shell radius to Cartesian [x, y, z].
 */
function sphericalToCartesian(
  radius: number,
  theta: number,
  phi: number
): [number, number, number] {
  return [
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta),
  ];
}

/**
 * Simple seeded PRNG (mulberry32) for deterministic particle generation.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection Stream Generation
// ═══════════════════════════════════════════════════════════════════════════

function generateConnectionStream(
  factorId: string,
  factorPos: [number, number, number],
  corePos: [number, number, number],
  color: string
): ConnectionStreamData {
  // Midpoint offset for bezier curve — arcs outward
  const midX = (factorPos[0] + corePos[0]) / 2 + (Math.random() - 0.5) * 1.2;
  const midY = (factorPos[1] + corePos[1]) / 2 + (Math.random() - 0.5) * 1.2 + 0.5;
  const midZ = (factorPos[2] + corePos[2]) / 2 + (Math.random() - 0.5) * 1.2;

  return {
    factorId,
    startPoint: corePos,
    endPoint: factorPos,
    midPoint: [midX, midY, midZ],
    particleCount: 60,
    color,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Display Factor → 3D Node Mapping (API values)
// ═══════════════════════════════════════════════════════════════════════════

/** Maps CharacterOS 9 personality dimensions to display factor IDs */
const API_DIMENSION_TO_DISPLAY: Record<string, string> = {
  openness: "curiosity",
  conscientiousness: "responsibility",
  extroversion: "loneliness",
  agreeableness: "security",
  neuroticism: "shame",
  trust: "trust",
  attachment: "attachment",
  fear: "fear",
  control: "control",
};

// ═══════════════════════════════════════════════════════════════════════════
// Transform (standalone)
// ═══════════════════════════════════════════════════════════════════════════

export function transformStateToData(
  state: SerializedCharacterPhysicsState
): MindSpace3DData {
  const coordinateValues = state.coordinate.values;

  // Map API dimensions to display factors
  const factorValues = new Map<string, number>();
  for (const [apiKey, displayId] of Object.entries(API_DIMENSION_TO_DISPLAY)) {
    const val = coordinateValues[apiKey as keyof typeof coordinateValues];
    factorValues.set(displayId, typeof val === "number" ? val : 0.5);
  }

  return buildMindSpaceData(
    factorValues,
    state.identity?.name ?? "Unknown",
    state.identity?.id ?? "default"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Hook variant
// ═══════════════════════════════════════════════════════════════════════════

export function useFactorDataTransform(
  state: SerializedCharacterPhysicsState | null | undefined
): MindSpace3DData | null {
  return useMemo(() => {
    if (!state) return null;
    return transformStateToData(state);
  }, [state]);
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildMindSpaceData(
  factorValues: Map<string, number>,
  characterName: string,
  characterId: string
): MindSpace3DData {
  const factorClouds: FactorCloud3D[] = [];
  const connectionStreams: ConnectionStreamData[] = [];
  const corePos: [number, number, number] = [0, 0, 0];

  // Dominant factors (top 3 by value)
  const sorted = [...factorValues.entries()].sort((a, b) => b[1] - a[1]);
  const dominantFactors = sorted.slice(0, 3).map(([id]) => id);

  // Derive status line
  const statusLine = deriveStatusLine(factorValues, dominantFactors);

  for (const config of DISPLAY_FACTOR_REGISTRY) {
    const value = factorValues.get(config.id) ?? 0.5;
    const radius = SHELL_RADII[config.layer];
    const position = sphericalToCartesian(radius, config.theta, config.phi);

    // Particle counts scale with value
    const extra = Math.round(value * 10 * EXTRA_PER_TENTH);
    const coreCount = BASE_CORE_COUNT + extra;
    const haloCount = BASE_HALO_COUNT + extra;
    const coreRadius = 0.15 + value * 0.2;
    const haloSpread = 0.8 + value * 1.2;

    // Derived metrics
    const distanceFromCore = Math.sqrt(
      position[0] ** 2 + position[1] ** 2 + position[2] ** 2
    );
    const strength = value;
    const activation = 0.3 + value * 0.7;
    const decay = 1 - activation;

    // Related memories (demo strings — would come from API)
    const relatedMemories = generateRelatedMemories(config.id, value);
    const influenceTags = generateInfluenceTags(config.id, value);
    const impactSummary = generateImpactSummary(config.id, value);

    factorClouds.push({
      id: config.id,
      labelZh: config.labelZh,
      labelEn: config.labelEn,
      layer: config.layer,
      color: config.color,
      accentColor: config.accentColor,
      position,
      haloSpread,
      coreRadius,
      coreParticleCount: coreCount,
      haloParticleCount: haloCount,
      value,
      strength,
      activation,
      decay,
      distanceFromCore,
      description: config.description,
      lowAnchor: config.lowAnchor,
      highAnchor: config.highAnchor,
      relatedMemories,
      influenceTags,
      impactSummary,
      events: generateEventParticles(config.id, position, config.color, haloSpread, value),
    });

    // Generate connection stream
    connectionStreams.push(
      generateConnectionStream(config.id, position, corePos, config.color)
    );
  }

  // Core intensity
  const allValues = [...factorValues.values()];
  const intensity = allValues.reduce((a, b) => a + b, 0) / allValues.length;

  return {
    characterName,
    characterId,
    core: {
      position: corePos,
      particleCount: 2500,
      intensity,
      label: characterName,
      statusLine,
      dominantFactors,
    },
    factorClouds,
    connectionStreams,
    backgroundStarCount: 2000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Line Derivation
// ═══════════════════════════════════════════════════════════════════════════

function deriveStatusLine(
  values: Map<string, number>,
  dominant: string[]
): string {
  const fear = values.get("fear") ?? 0.5;
  const security = values.get("security") ?? 0.5;
  const attachment = values.get("attachment") ?? 0.5;
  const trust = values.get("trust") ?? 0.5;

  if (fear > 0.7 && security < 0.4) return "边界脆弱 / 正在寻找关系安全感";
  if (attachment > 0.7 && trust < 0.4) return "高依恋低信任 / 害怕断联";
  if (security > 0.6 && trust > 0.6) return "内在稳定 / 关系安全感较强";
  if (fear < 0.3 && security > 0.6) return "低恐惧高安全 / 积极探索关系";
  return "人格系统稳定运行中";
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Content Generators
// ═══════════════════════════════════════════════════════════════════════════

function generateRelatedMemories(factorId: string, value: number): string[] {
  const templates: Record<string, string[]> = {
    trust: ["母亲在雨夜离开，之后再也没回来", "朋友王雪在我最低落时始终支持"],
    security: ["第一次独自睡觉时的不安", "找到稳定工作后的踏实感"],
    attachment: ["每次手机响起都会第一时间查看", "深夜独处时的空虚感"],
    fear: ["被当众批评的羞耻记忆", "关系中反复确认对方不会离开"],
    control: ["无法预测他人反应时的焦虑", "通过制定计划获得掌控感"],
    shame: ["被比较时的自我否定", "认为自己不够好的深层信念"],
    hope: ["看到改变可能性的那个瞬间", "相信未来关系会不同"],
    curiosity: ["阅读心理学书籍时的顿悟", "愿意尝试新的关系模式"],
    loneliness: ["人群中仍感到孤立", "无人真正理解自己的感受"],
    responsibility: ["对承诺的认真态度", "为他人负责带来的压力"],
  };
  const options = templates[factorId] ?? ["相关记忆"];
  return options.slice(0, value > 0.6 ? 2 : 1);
}

function generateInfluenceTags(factorId: string, _value: number): string[] {
  const tags: Record<string, string[]> = {
    trust: ["关系安全感", "背叛预期", "信任基线"],
    security: ["内在稳定", "安全基地", "依恋风格"],
    attachment: ["连接需求", "断联恐惧", "依赖模式"],
    fear: ["威胁感知", "风险回避", "焦虑激活"],
    control: ["可预测性", "边界需求", "秩序感"],
    shame: ["自我价值", "否定敏感", "内在批评"],
    hope: ["积极预期", "改变信念", "未来导向"],
    curiosity: ["开放性", "经验探索", "认知弹性"],
    loneliness: ["存在孤独", "理解需求", "连接渴望"],
    responsibility: ["承诺倾向", "秩序感", "自控力"],
  };
  return tags[factorId] ?? ["人格因子"];
}

function generateImpactSummary(factorId: string, value: number): string {
  const summaries: Record<string, string> = {
    trust: value < 0.3
      ? "低信任基线导致预设背叛，难以建立安全连接"
      : "信任能力较强，愿意相信他人善意",
    security: value < 0.4
      ? "内在安全感不足，需要外部持续确认"
      : "内在安全感稳定，较少依赖外部确认",
    attachment: value > 0.7
      ? "高依恋需求驱动强连接行为，害怕断联"
      : "依恋需求适中，可容忍适度独处",
    fear: value > 0.7
      ? "高恐惧基线使关系决策偏向回避和警觉"
      : "恐惧水平适中，可承担适度关系风险",
    control: value > 0.7
      ? "高控制需求驱动过度计划和边界强化"
      : "控制需求适中，能容忍一定不确定性",
    shame: value > 0.6
      ? "羞耻敏感度较高，容易自我否定和回避表达"
      : "自我价值感较稳定",
    hope: value > 0.5
      ? "对未来抱有积极预期，愿意尝试改变"
      : "对改变持保留态度，需要更多证据",
    curiosity: value > 0.5
      ? "对新经验保持开放，愿意重新理解过去"
      : "认知较为保守，抗拒新解释",
    loneliness: value > 0.6
      ? "持续感到不被理解，即使有人陪伴"
      : "内在较为充实，独处时仍感舒适",
    responsibility: value > 0.6
      ? "责任感强烈，重视承诺和秩序"
      : "责任感适中，较为灵活",
  };
  return summaries[factorId] ?? "该因子持续影响人格系统";
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Particle Generator (zoom-to-reveal)
// ═══════════════════════════════════════════════════════════════════════════

const EVENT_TEMPLATES: Record<string, { label: string; desc: string; emotion: string }[]> = {
  trust: [
    { label: "母亲离开", desc: "6岁，母亲在雨夜离开家，之后再也没回来", emotion: "被背叛" },
    { label: "王雪支持", desc: "17岁，朋友王雪在最低落时始终陪伴", emotion: "感激" },
    { label: "父亲沉默", desc: "每次试图沟通都被父亲回避", emotion: "失望" },
    { label: "初恋沉默", desc: "第一次表白后对方陷入三天沉默", emotion: "恐惧" },
  ],
  security: [
    { label: "独睡恐惧", desc: "7岁开始独自睡觉时的不安感", emotion: "焦虑" },
    { label: "工作稳定", desc: "24岁找到稳定工作后的踏实感", emotion: "安心" },
    { label: "搬家冲击", desc: "12岁搬家后失去熟悉环境的安全感", emotion: "失落" },
  ],
  attachment: [
    { label: "手机检查", desc: "每次手机响起都会第一时间查看", emotion: "焦虑" },
    { label: "深夜独处", desc: "深夜独处时的强烈空虚感", emotion: "孤独" },
    { label: "等待回复", desc: "发消息后反复检查对方是否回复", emotion: "不安" },
    { label: "离别焦虑", desc: "每次伴侣出差前的不安和失眠", emotion: "恐惧" },
  ],
  fear: [
    { label: "当众批评", desc: "12岁被老师当众批评的羞耻记忆", emotion: "羞耻" },
    { label: "关系确认", desc: "反复向伴侣确认不会离开自己", emotion: "焦虑" },
    { label: "社交回避", desc: "在新社交场合感到强烈的被审视感", emotion: "恐惧" },
    { label: "未来不确定", desc: "对未来关系走向的持续担忧", emotion: "忧虑" },
  ],
  control: [
    { label: "计划制定", desc: "通过制定详细计划来缓解焦虑", emotion: "紧张" },
    { label: "他人反应", desc: "无法预测他人反应时的失控感", emotion: "焦虑" },
    { label: "规则依赖", desc: "依赖规则和边界来获得心理安全感", emotion: "依赖" },
  ],
  shame: [
    { label: "被比较", desc: "父母常说'看看别人家的孩子'", emotion: "羞耻" },
    { label: "自我否定", desc: "内心深处'我不够好'的信念反复浮现", emotion: "悲伤" },
    { label: "犯错惩罚", desc: "8岁犯错后被长时间冷落的记忆", emotion: "羞耻" },
  ],
  hope: [
    { label: "看到改变", desc: "第一次看到心理学的书，意识到改变是可能的", emotion: "希望" },
    { label: "小进步", desc: "连续一周没有焦虑发作时的兴奋", emotion: "喜悦" },
  ],
  curiosity: [
    { label: "阅读顿悟", desc: "读到依恋理论时对自己的理解豁然开朗", emotion: "兴奋" },
    { label: "新尝试", desc: "愿意尝试新的关系模式，虽然害怕", emotion: "勇气" },
    { label: "自我探索", desc: "开始写日记记录自己的情绪和想法", emotion: "好奇" },
  ],
  loneliness: [
    { label: "人群孤立", desc: "即使和朋友在一起仍感到深深的孤立", emotion: "孤独" },
    { label: "不被理解", desc: "多次尝试表达内心感受却无人真正理解", emotion: "悲伤" },
    { label: "深夜失眠", desc: "深夜醒来感到全世界的孤独都压在身上", emotion: "绝望" },
  ],
  responsibility: [
    { label: "承诺压力", desc: "对每一个承诺都感到沉重的责任压力", emotion: "沉重" },
    { label: "他人期待", desc: "不想让他人失望的强烈驱动力", emotion: "紧张" },
    { label: "自我要求", desc: "对自己极高的标准和严苛的自我评判", emotion: "压力" },
  ],
};

function generateEventParticles(
  factorId: string,
  cloudPos: [number, number, number],
  color: string,
  spread: number,
  _value: number
): EventParticle3D[] {
  const templates = EVENT_TEMPLATES[factorId] ?? [
    { label: "事件", desc: "相关心理事件", emotion: "中性" },
  ];

  const rng = seededRandom(hashStr(factorId + "_events"));
  const particles: EventParticle3D[] = [];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i]!;
    // Place event within the cloud spread
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = spread * 0.4 * (0.3 + rng() * 0.7);

    particles.push({
      id: `${factorId}_event_${i}`,
      label: t.label,
      description: t.desc,
      position: [
        cloudPos[0] + Math.sin(phi) * Math.cos(theta) * r,
        cloudPos[1] + Math.sin(phi) * Math.sin(theta) * r,
        cloudPos[2] + Math.cos(phi) * r,
      ],
      color,
      intensity: 0.4 + rng() * 0.6,
      emotion: t.emotion,
      category: factorId,
    });
  }

  return particles;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Data
// ═══════════════════════════════════════════════════════════════════════════

export function generateDemoData(): MindSpace3DData {
  // Lin Fan's personality profile mapped to display factors
  const demoValues = new Map<string, number>([
    ["trust", 0.18],
    ["security", 0.22],
    ["attachment", 0.82],
    ["fear", 0.85],
    ["control", 0.72],
    ["shame", 0.68],
    ["hope", 0.30],
    ["curiosity", 0.45],
    ["loneliness", 0.75],
    ["responsibility", 0.60],
  ]);

  return buildMindSpaceData(demoValues, "林凡", "demo-lin-fan");
}
