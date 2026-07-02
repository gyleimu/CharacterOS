/**
 * MindSpace3D — 3D type definitions (V2 optimized)
 *
 * Extended type system for the product-grade CharacterOS MindSpace:
 * - Display factor registry with layer assignments
 * - Energy node structure (mini-core + halo)
 * - Connection stream data
 * - UI panel types
 */

// ═══════════════════════════════════════════════════════════════════════════
// Factor Layer System
// ═══════════════════════════════════════════════════════════════════════════

export type FactorLayer = "inner" | "middle" | "outer";

export const SHELL_RADII: Record<FactorLayer, number> = {
  inner: 4.8,
  middle: 7.5,
  outer: 10.5,
};

// ═══════════════════════════════════════════════════════════════════════════
// Display Factor Registry
// ═══════════════════════════════════════════════════════════════════════════

export interface DisplayFactorConfig {
  id: string;
  labelZh: string;
  labelEn: string;
  layer: FactorLayer;
  color: string;
  accentColor: string;
  description: string;
  lowAnchor: string;
  highAnchor: string;
  /** Spherical coordinates for deterministic placement */
  theta: number;   // azimuth (around Y)
  phi: number;     // elevation
}

/** 10 display factors — the authoritative factor set for MindSpace visualization */
export const DISPLAY_FACTOR_REGISTRY: readonly DisplayFactorConfig[] = [
  // ── Inner layer: core relational factors ──
  {
    id: "trust",
    labelZh: "信任感",
    labelEn: "Trust",
    layer: "inner",
    color: "#64B5F6",
    accentColor: "#42A5F5",
    theta: 0.0, phi: 0.25,
    description: "相信他人不会伤害、欺骗或突然离开的倾向。",
    lowAnchor: "不信任、预设背叛或离开",
    highAnchor: "信任、愿意相信善意",
  },
  {
    id: "security",
    labelZh: "安全感",
    labelEn: "Security",
    layer: "inner",
    color: "#FFD54F",
    accentColor: "#FFC107",
    theta: 2.1, phi: -0.15,
    description: "内在的安全基地感受，对关系稳定性的基本信心。",
    lowAnchor: "缺乏安全感、预期失去",
    highAnchor: "内在稳定、相信关系持续",
  },
  {
    id: "attachment",
    labelZh: "依恋",
    labelEn: "Attachment",
    layer: "inner",
    color: "#BCAAA4",
    accentColor: "#A1887F",
    theta: 4.2, phi: 0.12,
    description: "对少数亲密对象形成依赖和连接需求的强度。",
    lowAnchor: "低依赖、可独处",
    highAnchor: "高依赖、害怕断联",
  },

  // ── Middle layer: defense & regulation factors ──
  {
    id: "fear",
    labelZh: "恐惧",
    labelEn: "Fear",
    layer: "middle",
    color: "#E57373",
    accentColor: "#EF5350",
    theta: 0.8, phi: 0.45,
    description: "面对关系风险和不确定事件时的恐惧基线。",
    lowAnchor: "低恐惧、敢冒关系风险",
    highAnchor: "高恐惧、回避风险、警觉",
  },
  {
    id: "control",
    labelZh: "控制感",
    labelEn: "Control",
    layer: "middle",
    color: "#CE93D8",
    accentColor: "#BA68C8",
    theta: 2.9, phi: -0.35,
    description: "希望关系和事件可预测、可解释、可掌控的倾向。",
    lowAnchor: "接受混乱、不强求解释",
    highAnchor: "需要解释、边界和可预测性",
  },
  {
    id: "shame",
    labelZh: "羞耻",
    labelEn: "Shame",
    layer: "middle",
    color: "#9FA5D5",
    accentColor: "#7986CB",
    theta: 5.0, phi: 0.15,
    description: "对自我价值的怀疑、对被否定或被看低的敏感度。",
    lowAnchor: "自我认同稳定、不易羞耻",
    highAnchor: "易自我怀疑、害怕被否定",
  },

  // ── Outer layer: growth & exploration factors ──
  {
    id: "hope",
    labelZh: "希望感",
    labelEn: "Hope",
    layer: "outer",
    color: "#66BB6A",
    accentColor: "#4CAF50",
    theta: 1.4, phi: 0.55,
    description: "对未来关系和自身改变持积极预期的倾向。",
    lowAnchor: "悲观、看不到出路",
    highAnchor: "积极预期、相信改变可能",
  },
  {
    id: "curiosity",
    labelZh: "好奇心",
    labelEn: "Curiosity",
    layer: "outer",
    color: "#4DD0E1",
    accentColor: "#26C6DA",
    theta: 3.2, phi: -0.5,
    description: "对新经验、新解释和复杂性的接受与探索倾向。",
    lowAnchor: "保守、抗拒新解释",
    highAnchor: "开放、好奇、愿意重新理解",
  },
  {
    id: "loneliness",
    labelZh: "孤独感",
    labelEn: "Loneliness",
    layer: "outer",
    color: "#90CAF9",
    accentColor: "#64B5F6",
    theta: 5.4, phi: 0.3,
    description: "即使有人陪伴仍感到内在孤独、不被真正理解的体验。",
    lowAnchor: "独处舒适、内在充实",
    highAnchor: "持续孤独、不被理解",
  },
  {
    id: "responsibility",
    labelZh: "责任感",
    labelEn: "Responsibility",
    layer: "outer",
    color: "#FFB74D",
    accentColor: "#FFA726",
    theta: 0.3, phi: -0.55,
    description: "对自身行为后果和关系承诺的承担倾向。",
    lowAnchor: "松散、冲动、低规划",
    highAnchor: "克制、有序、重视承诺",
  },
] as const;

export type DisplayFactorId = (typeof DISPLAY_FACTOR_REGISTRY)[number]["id"];

// ═══════════════════════════════════════════════════════════════════════════
// Factor Cloud 3D (energy node)
// ═══════════════════════════════════════════════════════════════════════════

export interface FactorCloud3D {
  id: string;
  labelZh: string;
  labelEn: string;
  layer: FactorLayer;
  color: string;
  accentColor: string;
  /** 3D position of the node center */
  position: [number, number, number];
  /** Spread of the halo particles (sigma) */
  haloSpread: number;
  /** Radius of the dense inner core */
  coreRadius: number;
  /** Number of particles in mini-core */
  coreParticleCount: number;
  /** Number of particles in halo */
  haloParticleCount: number;
  /** Personality value [0, 1] */
  value: number;
  /** Derived metrics for inspector */
  strength: number;
  activation: number;
  decay: number;
  distanceFromCore: number;
  description: string;
  lowAnchor: string;
  highAnchor: string;
  /** Related memory IDs for inspector */
  relatedMemories: string[];
  /** Influence tags */
  influenceTags: string[];
  /** One-line impact summary */
  impactSummary: string;
  /** Event particles — revealed when camera zooms close */
  events: EventParticle3D[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Particle (zoom-to-reveal)
// ═══════════════════════════════════════════════════════════════════════════

export interface EventParticle3D {
  id: string;
  label: string;
  description: string;
  /** Position relative to factor cloud center */
  position: [number, number, number];
  color: string;
  intensity: number;  // 0-1
  emotion: string;
  category: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection Stream
// ═══════════════════════════════════════════════════════════════════════════

export interface ConnectionStreamData {
  factorId: string;
  /** Control points for bezier curve */
  startPoint: [number, number, number];   // core surface
  endPoint: [number, number, number];     // factor node
  midPoint: [number, number, number];     // bezier control
  particleCount: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core 3D
// ═══════════════════════════════════════════════════════════════════════════

export interface Core3D {
  position: [number, number, number];
  particleCount: number;
  /** Overall personality intensity [0, 1] */
  intensity: number;
  /** Character name for label display */
  label: string;
  /** Status line (e.g. "边界脆弱 / 正在寻找关系安全感") */
  statusLine: string;
  /** Dominant factor IDs */
  dominantFactors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MindSpace Scene Data
// ═══════════════════════════════════════════════════════════════════════════

export interface MindSpace3DData {
  characterName: string;
  characterId: string;
  core: Core3D;
  factorClouds: FactorCloud3D[];
  connectionStreams: ConnectionStreamData[];
  backgroundStarCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Camera View State
// ═══════════════════════════════════════════════════════════════════════════

export type CameraView =
  | { mode: "overview"; resetKey?: number }
  | { mode: "core"; resetKey?: number }
  | { mode: "factor"; factorId: string; resetKey?: number }
  | {
      mode: "target";
      targetType: string;
      targetId: string;
      position: [number, number, number];
      parentFactorId?: string | undefined;
      resetKey?: number;
    };

// ═══════════════════════════════════════════════════════════════════════════
// Factor Cloud Handle (for camera transitions)
// ═══════════════════════════════════════════════════════════════════════════

export interface FactorCloudHandle {
  id: string;
  position: [number, number, number];
  boundingRadius: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy color constants (for core / stars / nebula)
// ═══════════════════════════════════════════════════════════════════════════

export const CORE_COLORS = ["#FFD700", "#C9A95C", "#B8943E", "#D4A843", "#C8A44E"];
export const STAR_TINTS = ["#8899CC", "#AABBEE", "#CCDDFF", "#99AACC", "#BBDDFF"];
