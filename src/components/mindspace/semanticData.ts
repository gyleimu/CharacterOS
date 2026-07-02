/**
 * semanticData.ts — 林凡 demo semantic mind data.
 *
 * Every object has psychological meaning. No decorative particles.
 * Structure: Character → Factors → Memories/Beliefs/Needs → Behaviors
 */

import type {
  SemanticMindData, SemanticCharacter, SemanticFactor,
  SemanticMemory, SemanticBelief, SemanticNeed, SemanticBehavior, FactorTrace,
  FactorLayer,
} from "./semanticTypes";

// ═══════════════════════════════════════════════════════════════════════════
// Factor Registry — positions on 3 shells
// ═══════════════════════════════════════════════════════════════════════════

const SHELL: Record<FactorLayer, number> = { inner: 4.8, middle: 7.5, outer: 10.5 };

function pos(radius: number, theta: number, phi: number): [number, number, number] {
  return [
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta),
  ];
}

let jitterCursor = 0;

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 9283.31) * 43758.5453123;
  return x - Math.floor(x);
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 10007;
  return hash;
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Character
// ═══════════════════════════════════════════════════════════════════════════

function buildCharacter(): SemanticCharacter {
  return {
    id: "core",
    name: "林凡",
    currentState: "边界脆弱 / 正在寻找关系安全感",
    emotionalTone: "不安、压抑、警觉",
    dominantFactorIds: ["attachment", "fear", "security"],
    summary: "林凡当前处于关系安全感不足状态。他并不是单纯想要得到回复，而是在确认关系是否仍然稳定。他的行为由深层的不安全感驱动，而非表面的需求。",
    position: [0, 0, 0],
    particleCount: 3500,
    color: "#FFD700",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Factors
// ═══════════════════════════════════════════════════════════════════════════

function buildFactors(): SemanticFactor[] {
  const defs: Omit<SemanticFactor, "position" | "memoryIds" | "beliefIds" | "needIds" | "behaviorIds">[] = [
    {
      id: "trust", name: "Trust", zhName: "信任感", layer: "inner",
      strength: 0.18, activation: 0.22, decay: 0.78, distance: 4.8, disturbance: 0.65,
      color: "#64B5F6", accentColor: "#42A5F5",
      description: "相信他人不会伤害、欺骗或突然离开的倾向。",
      lowAnchor: "不信任、预设背叛或离开", highAnchor: "信任、愿意相信善意",
      explanation: "林凡的信任基线很低。他预设重要关系可能随时断裂，即使对方没有表现出任何离开的迹象。这种低信任来自童年被遗弃的经验。",
      coreParticleCount: 130, haloParticleCount: 280, coreRadius: 0.18, haloSpread: 1.1,
      influenceTags: ["关系安全感","背叛预期","信任基线"],
      traceEvent: "深夜没有收到回复",
      traceBelief: "重要关系可能随时断开",
      traceNeed: "关系确认 / 安全感补偿",
    },
    {
      id: "security", name: "Security", zhName: "安全感", layer: "inner",
      strength: 0.22, activation: 0.35, decay: 0.65, distance: 4.8, disturbance: 0.55,
      color: "#FFD54F", accentColor: "#FFC107",
      description: "内在的安全基地感受，对关系稳定性的基本信心。",
      lowAnchor: "缺乏安全感、预期失去", highAnchor: "内在稳定、相信关系持续",
      explanation: "林凡的内在安全感很脆弱。他需要通过外部信号反复确认关系还在，否则会陷入强烈不安。这种不安全感在独处或对方沉默时急剧上升。",
      coreParticleCount: 135, haloParticleCount: 290, coreRadius: 0.19, haloSpread: 1.2,
      influenceTags: ["内在稳定","安全基地","依恋风格"],
      traceEvent: "伴侣长时间未回应",
      traceBelief: "沉默意味着关系出现了问题",
      traceNeed: "需要明确的关系确认信号",
    },
    {
      id: "attachment", name: "Attachment", zhName: "依恋", layer: "inner",
      strength: 0.82, activation: 0.88, decay: 0.12, distance: 4.8, disturbance: 0.75,
      color: "#BCAAA4", accentColor: "#A1887F",
      description: "对少数亲密对象形成依赖和连接需求的强度。",
      lowAnchor: "低依赖、可独处", highAnchor: "高依赖、害怕断联",
      explanation: "林凡对关系反馈高度敏感。当前依恋因子被高度激活后，他会把'没有回复'解读为关系不稳定的信号。他的安全感高度依赖外部确认。这种模式来自童年被遗弃的经验——母亲在雨夜离开，之后再也没回来。",
      coreParticleCount: 180, haloParticleCount: 380, coreRadius: 0.28, haloSpread: 1.8,
      influenceTags: ["连接需求","断联恐惧","依赖模式"],
      traceEvent: "深夜没有收到期待的回复",
      traceBelief: "重要关系可能随时断开",
      traceNeed: "关系确认 / 安全感补偿",
    },
    {
      id: "fear", name: "Fear", zhName: "恐惧", layer: "middle",
      strength: 0.85, activation: 0.78, decay: 0.22, distance: 7.5, disturbance: 0.70,
      color: "#E57373", accentColor: "#EF5350",
      description: "面对关系风险和不确定事件时的恐惧基线。",
      lowAnchor: "低恐惧、敢冒关系风险", highAnchor: "高恐惧、回避风险、警觉",
      explanation: "林凡的恐惧基线很高。他对关系中任何不确定信号都高度警觉，倾向于把模糊信号解读为威胁。这使得他在关系中总是处于防御状态。",
      coreParticleCount: 175, haloParticleCount: 370, coreRadius: 0.27, haloSpread: 1.7,
      influenceTags: ["威胁感知","风险回避","焦虑激活"],
      traceEvent: "对方语气或节奏发生变化",
      traceBelief: "变化意味着危险正在接近",
      traceNeed: "需要恢复可预测的安全感",
    },
    {
      id: "control", name: "Control", zhName: "控制感", layer: "middle",
      strength: 0.72, activation: 0.65, decay: 0.35, distance: 7.5, disturbance: 0.50,
      color: "#CE93D8", accentColor: "#BA68C8",
      description: "希望关系和事件可预测、可解释、可掌控的倾向。",
      lowAnchor: "接受混乱、不强求解释", highAnchor: "需要解释、边界和可预测性",
      explanation: "林凡需要关系可预测。当对方行为模式发生变化时，他会感到失控，并通过各种方式（如反复检查、试探）来恢复控制感。这是一种对不确定性的补偿。",
      coreParticleCount: 165, haloParticleCount: 350, coreRadius: 0.25, haloSpread: 1.5,
      influenceTags: ["可预测性","边界需求","秩序感"],
      traceEvent: "对方的行为模式发生变化",
      traceBelief: "失去控制意味着可能受到伤害",
      traceNeed: "恢复对关系的预测能力",
    },
    {
      id: "shame", name: "Shame", zhName: "羞耻", layer: "middle",
      strength: 0.68, activation: 0.55, decay: 0.45, distance: 7.5, disturbance: 0.45,
      color: "#9FA5D5", accentColor: "#7986CB",
      description: "对自我价值的怀疑、对被否定或被看低的敏感度。",
      lowAnchor: "自我认同稳定、不易羞耻", highAnchor: "易自我怀疑、害怕被否定",
      explanation: "林凡内心深处对自己不够好有深层信念。当关系出现波折时，他不仅担心失去对方，还会激活'是不是我不够好'的自我怀疑。这种羞耻感让他更难以直接表达需求。",
      coreParticleCount: 160, haloParticleCount: 340, coreRadius: 0.24, haloSpread: 1.4,
      influenceTags: ["自我价值","否定敏感","内在批评"],
      traceEvent: "感觉到被忽视或被比较",
      traceBelief: "我不够好，所以不值得被爱",
      traceNeed: "需要被看见、被肯定",
    },
    {
      id: "hope", name: "Hope", zhName: "希望感", layer: "outer",
      strength: 0.30, activation: 0.28, decay: 0.72, distance: 10.5, disturbance: 0.30,
      color: "#66BB6A", accentColor: "#4CAF50",
      description: "对未来关系和自身改变持积极预期的倾向。",
      lowAnchor: "悲观、看不到出路", highAnchor: "积极预期、相信改变可能",
      explanation: "林凡的希望感较弱，但他内心仍有一小部分相信改变是可能的。正是这一丝希望驱动他愿意探索和理解自己的心理模式。",
      coreParticleCount: 125, haloParticleCount: 260, coreRadius: 0.16, haloSpread: 0.9,
      influenceTags: ["积极预期","改变信念","未来导向"],
      traceEvent: "意识到自己的模式可能来源于过去",
      traceBelief: "理解和觉察是改变的开始",
      traceNeed: "相信改变有可能实现",
    },
    {
      id: "curiosity", name: "Curiosity", zhName: "好奇心", layer: "outer",
      strength: 0.45, activation: 0.40, decay: 0.60, distance: 10.5, disturbance: 0.25,
      color: "#4DD0E1", accentColor: "#26C6DA",
      description: "对新经验、新解释和复杂性的接受与探索倾向。",
      lowAnchor: "保守、抗拒新解释", highAnchor: "开放、好奇、愿意重新理解",
      explanation: "林凡有一定的好奇心，愿意通过阅读和反思来理解自己的心理。但这种好奇心有时会被恐惧压制——知道得太清楚也会让他感到痛苦。",
      coreParticleCount: 130, haloParticleCount: 270, coreRadius: 0.17, haloSpread: 1.0,
      influenceTags: ["开放性","经验探索","认知弹性"],
      traceEvent: "接触到心理学或自我探索的内容",
      traceBelief: "理解自己的模式可以减轻痛苦",
      traceNeed: "获得对自己更清晰的认识",
    },
    {
      id: "loneliness", name: "Loneliness", zhName: "孤独感", layer: "outer",
      strength: 0.75, activation: 0.70, decay: 0.30, distance: 10.5, disturbance: 0.55,
      color: "#90CAF9", accentColor: "#64B5F6",
      description: "即使有人陪伴仍感到内在孤独、不被真正理解的体验。",
      lowAnchor: "独处舒适、内在充实", highAnchor: "持续孤独、不被理解",
      explanation: "林凡即使在关系中也会感到深深的孤独。他渴望被真正理解，但同时又害怕敞开会把对方推开。这种内在孤独让他的依恋需求更加强烈。",
      coreParticleCount: 160, haloParticleCount: 340, coreRadius: 0.24, haloSpread: 1.4,
      influenceTags: ["存在孤独","理解需求","连接渴望"],
      traceEvent: "尝试表达内心但感到对方没有真正理解",
      traceBelief: "没有人能完全理解我",
      traceNeed: "渴望被深刻理解",
    },
    {
      id: "responsibility", name: "Responsibility", zhName: "责任感", layer: "outer",
      strength: 0.60, activation: 0.55, decay: 0.45, distance: 10.5, disturbance: 0.20,
      color: "#FFB74D", accentColor: "#FFA726",
      description: "对自身行为后果和关系承诺的承担倾向。",
      lowAnchor: "松散、冲动、低规划", highAnchor: "克制、有序、重视承诺",
      explanation: "林凡重视关系承诺，但这种责任感有时会变成负担——他不仅为自己的行为负责，还为他人的情绪和关系的稳定负责。这会增加他的焦虑。",
      coreParticleCount: 140, haloParticleCount: 300, coreRadius: 0.20, haloSpread: 1.1,
      influenceTags: ["承诺倾向","秩序感","自控力"],
      traceEvent: "关系中出现了需要承担的后果",
      traceBelief: "我必须为关系的稳定负责",
      traceNeed: "减轻不必要的责任负担",
    },
  ];

  // Assign 3D positions based on layer + predefined angles
  const angles: Record<string, [number, number]> = {
    trust: [0.0, 0.25],
    security: [2.1, -0.15],
    attachment: [4.2, 0.12],
    fear: [0.8, 0.45],
    control: [2.9, -0.35],
    shame: [5.0, 0.15],
    hope: [1.4, 0.55],
    curiosity: [3.2, -0.5],
    loneliness: [5.4, 0.3],
    responsibility: [0.3, -0.55],
  };

  // Memory/belief/need/behavior IDs per factor
  const memoryMap: Record<string, string[]> = {
    trust: ["mem_trust_1", "mem_trust_2"],
    security: ["mem_sec_1", "mem_sec_2"],
    attachment: ["mem_att_1", "mem_att_2", "mem_att_3"],
    fear: ["mem_fear_1", "mem_fear_2"],
    control: ["mem_ctrl_1", "mem_ctrl_2"],
    shame: ["mem_shame_1", "mem_shame_2"],
    hope: ["mem_hope_1"],
    curiosity: ["mem_cur_1"],
    loneliness: ["mem_lone_1", "mem_lone_2"],
    responsibility: ["mem_resp_1"],
  };
  const beliefMap: Record<string, string[]> = {
    trust: ["bel_trust_1"],
    security: ["bel_sec_1"],
    attachment: ["bel_att_1"],
    fear: ["bel_fear_1"],
    control: ["bel_ctrl_1"],
    shame: ["bel_shame_1"],
    hope: ["bel_hope_1"],
    curiosity: ["bel_cur_1"],
    loneliness: ["bel_lone_1"],
    responsibility: ["bel_resp_1"],
  };
  const needMap: Record<string, string[]> = {
    trust: ["need_trust_1"],
    security: ["need_sec_1"],
    attachment: ["need_att_1", "need_att_2"],
    fear: ["need_fear_1"],
    control: ["need_ctrl_1"],
    shame: ["need_shame_1"],
    hope: ["need_hope_1"],
    curiosity: ["need_cur_1"],
    loneliness: ["need_lone_1"],
    responsibility: ["need_resp_1"],
  };
  const behaviorMap: Record<string, string[]> = {
    attachment: ["beh_check", "beh_test", "beh_pretend"],
    fear: ["beh_avoid"],
    control: ["beh_plan"],
    loneliness: ["beh_withdraw"],
    responsibility: ["beh_overcommit"],
  };

  return defs.map((d) => {
    const fallbackSeed = hashSeed(d.id);
    const [theta, phi] = angles[d.id] ?? [seededUnit(fallbackSeed) * Math.PI * 2, 0];
    return {
      ...d,
      position: pos(SHELL[d.layer], theta, phi),
      memoryIds: memoryMap[d.id] ?? [],
      beliefIds: beliefMap[d.id] ?? [],
      needIds: needMap[d.id] ?? [],
      behaviorIds: behaviorMap[d.id] ?? [],
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Memories
// ═══════════════════════════════════════════════════════════════════════════

function buildMemories(factors: SemanticFactor[]): SemanticMemory[] {
  const factorPos = (id: string) => factors.find((f) => f.id === id)?.position ?? [0,0,0];
  const factorColor = (id: string) => factors.find((f) => f.id === id)?.color ?? "#888";

  return [
    { id: "mem_att_1", summary: "母亲在雨夜离开，之后再也没回来", emotion: "被遗弃", valence: -0.9, factorId: "attachment", activation: 0.95, timestamp: "6岁", offset: jitter(factorPos("attachment"), 1.2), color: factorColor("attachment") },
    { id: "mem_att_2", summary: "第一次表白后对方沉默了三天", emotion: "恐惧", valence: -0.8, factorId: "attachment", activation: 0.85, timestamp: "17岁", offset: jitter(factorPos("attachment"), 1.4), color: factorColor("attachment") },
    { id: "mem_att_3", summary: "每次深夜等待回复时的不安感", emotion: "焦虑", valence: -0.6, factorId: "attachment", activation: 0.75, timestamp: "反复发生", offset: jitter(factorPos("attachment"), 1.0), color: factorColor("attachment") },
    { id: "mem_trust_1", summary: "父亲多次承诺但从未兑现", emotion: "失望", valence: -0.7, factorId: "trust", activation: 0.80, timestamp: "童年", offset: jitter(factorPos("trust"), 1.0), color: factorColor("trust") },
    { id: "mem_trust_2", summary: "朋友王雪在最低落时始终陪伴", emotion: "感激", valence: 0.6, factorId: "trust", activation: 0.50, timestamp: "17岁", offset: jitter(factorPos("trust"), 0.9), color: factorColor("trust") },
    { id: "mem_sec_1", summary: "7岁开始独自睡觉时的恐惧", emotion: "恐惧", valence: -0.7, factorId: "security", activation: 0.70, timestamp: "7岁", offset: jitter(factorPos("security"), 1.0), color: factorColor("security") },
    { id: "mem_sec_2", summary: "找到稳定工作后短暂的安全感", emotion: "安心", valence: 0.5, factorId: "security", activation: 0.40, timestamp: "24岁", offset: jitter(factorPos("security"), 0.8), color: factorColor("security") },
    { id: "mem_fear_1", summary: "12岁被老师当众批评的羞耻记忆", emotion: "羞耻", valence: -0.8, factorId: "fear", activation: 0.75, timestamp: "12岁", offset: jitter(factorPos("fear"), 1.1), color: factorColor("fear") },
    { id: "mem_fear_2", summary: "关系中反复确认对方不会离开", emotion: "焦虑", valence: -0.5, factorId: "fear", activation: 0.80, timestamp: "反复发生", offset: jitter(factorPos("fear"), 1.3), color: factorColor("fear") },
    { id: "mem_ctrl_1", summary: "通过制定详细计划来缓解焦虑", emotion: "紧张", valence: 0.0, factorId: "control", activation: 0.60, timestamp: "成年后", offset: jitter(factorPos("control"), 0.9), color: factorColor("control") },
    { id: "mem_ctrl_2", summary: "无法预测他人反应时的失控感", emotion: "焦虑", valence: -0.6, factorId: "control", activation: 0.65, timestamp: "反复发生", offset: jitter(factorPos("control"), 1.0), color: factorColor("control") },
    { id: "mem_shame_1", summary: "父母常说'看看别人家的孩子'", emotion: "羞耻", valence: -0.7, factorId: "shame", activation: 0.70, timestamp: "童年", offset: jitter(factorPos("shame"), 1.0), color: factorColor("shame") },
    { id: "mem_shame_2", summary: "8岁犯错后被长时间冷落的记忆", emotion: "羞耻", valence: -0.8, factorId: "shame", activation: 0.65, timestamp: "8岁", offset: jitter(factorPos("shame"), 0.9), color: factorColor("shame") },
    { id: "mem_hope_1", summary: "第一次读到心理学书籍时的顿悟", emotion: "希望", valence: 0.7, factorId: "hope", activation: 0.45, timestamp: "22岁", offset: jitter(factorPos("hope"), 0.8), color: factorColor("hope") },
    { id: "mem_cur_1", summary: "开始写日记记录自己的情绪和想法", emotion: "好奇", valence: 0.4, factorId: "curiosity", activation: 0.50, timestamp: "近期", offset: jitter(factorPos("curiosity"), 0.7), color: factorColor("curiosity") },
    { id: "mem_lone_1", summary: "即使和朋友在一起仍感到深深的孤立", emotion: "孤独", valence: -0.6, factorId: "loneliness", activation: 0.75, timestamp: "反复发生", offset: jitter(factorPos("loneliness"), 1.1), color: factorColor("loneliness") },
    { id: "mem_lone_2", summary: "深夜醒来感到全世界的孤独都压在身上", emotion: "绝望", valence: -0.9, factorId: "loneliness", activation: 0.60, timestamp: "反复发生", offset: jitter(factorPos("loneliness"), 1.2), color: factorColor("loneliness") },
    { id: "mem_resp_1", summary: "对每一个承诺都感到沉重的责任压力", emotion: "沉重", valence: -0.4, factorId: "responsibility", activation: 0.55, timestamp: "成年后", offset: jitter(factorPos("responsibility"), 0.8), color: factorColor("responsibility") },
  ];
}

function jitter(base: [number, number, number], spread: number): [number, number, number] {
  const seed = ++jitterCursor;
  return [
    base[0] + (seededUnit(seed + 0.11) - 0.5) * spread * 2,
    base[1] + (seededUnit(seed + 0.37) - 0.5) * spread * 2,
    base[2] + (seededUnit(seed + 0.73) - 0.5) * spread * 2,
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Beliefs
// ═══════════════════════════════════════════════════════════════════════════

function buildBeliefs(factors: SemanticFactor[]): SemanticBelief[] {
  const fPos = (id: string) => factors.find((f) => f.id === id)?.position ?? [0,0,0];
  const fCol = (id: string) => factors.find((f) => f.id === id)?.color ?? "#888";

  return [
    { id: "bel_att_1", text: "重要关系可能随时断开", strength: 0.88, sourceMemoryIds: ["mem_att_1","mem_att_2"], factorId: "attachment", position: jitter(fPos("attachment"), 2.0), color: fCol("attachment") },
    { id: "bel_trust_1", text: "他人的承诺不可信", strength: 0.78, sourceMemoryIds: ["mem_trust_1"], factorId: "trust", position: jitter(fPos("trust"), 1.8), color: fCol("trust") },
    { id: "bel_sec_1", text: "安全感必须从外部获取", strength: 0.72, sourceMemoryIds: ["mem_sec_1"], factorId: "security", position: jitter(fPos("security"), 1.8), color: fCol("security") },
    { id: "bel_fear_1", text: "变化意味着危险正在接近", strength: 0.82, sourceMemoryIds: ["mem_fear_1","mem_fear_2"], factorId: "fear", position: jitter(fPos("fear"), 2.0), color: fCol("fear") },
    { id: "bel_ctrl_1", text: "失去控制意味着可能受到伤害", strength: 0.68, sourceMemoryIds: ["mem_ctrl_1","mem_ctrl_2"], factorId: "control", position: jitter(fPos("control"), 1.8), color: fCol("control") },
    { id: "bel_shame_1", text: "我不够好，所以不值得被爱", strength: 0.65, sourceMemoryIds: ["mem_shame_1","mem_shame_2"], factorId: "shame", position: jitter(fPos("shame"), 1.8), color: fCol("shame") },
    { id: "bel_hope_1", text: "理解和觉察是改变的开始", strength: 0.40, sourceMemoryIds: ["mem_hope_1"], factorId: "hope", position: jitter(fPos("hope"), 1.5), color: fCol("hope") },
    { id: "bel_cur_1", text: "了解自己可以减轻痛苦", strength: 0.48, sourceMemoryIds: ["mem_cur_1"], factorId: "curiosity", position: jitter(fPos("curiosity"), 1.5), color: fCol("curiosity") },
    { id: "bel_lone_1", text: "没有人能完全理解我", strength: 0.72, sourceMemoryIds: ["mem_lone_1","mem_lone_2"], factorId: "loneliness", position: jitter(fPos("loneliness"), 1.8), color: fCol("loneliness") },
    { id: "bel_resp_1", text: "我必须为关系的稳定负责", strength: 0.55, sourceMemoryIds: ["mem_resp_1"], factorId: "responsibility", position: jitter(fPos("responsibility"), 1.5), color: fCol("responsibility") },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Needs
// ═══════════════════════════════════════════════════════════════════════════

function buildNeeds(factors: SemanticFactor[]): SemanticNeed[] {
  const fp = (id: string) => factors.find((f) => f.id === id)?.position ?? [0,0,0];
  const fc = (id: string) => factors.find((f) => f.id === id)?.color ?? "#888";

  return [
    { id: "need_att_1", name: "Relationship Reassurance", zhName: "关系确认", deficiency: 0.85, urgency: 0.90, factorId: "attachment", position: jitter(fp("attachment"), 2.5), color: fc("attachment") },
    { id: "need_att_2", name: "Safety Compensation", zhName: "安全感补偿", deficiency: 0.80, urgency: 0.85, factorId: "attachment", position: jitter(fp("attachment"), 2.3), color: fc("attachment") },
    { id: "need_trust_1", name: "Trust Evidence", zhName: "可信证据", deficiency: 0.75, urgency: 0.70, factorId: "trust", position: jitter(fp("trust"), 2.2), color: fc("trust") },
    { id: "need_sec_1", name: "Stability Signal", zhName: "稳定信号", deficiency: 0.70, urgency: 0.75, factorId: "security", position: jitter(fp("security"), 2.2), color: fc("security") },
    { id: "need_fear_1", name: "Safety Restoration", zhName: "安全恢复", deficiency: 0.78, urgency: 0.80, factorId: "fear", position: jitter(fp("fear"), 2.5), color: fc("fear") },
    { id: "need_ctrl_1", name: "Predictability", zhName: "可预测性", deficiency: 0.65, urgency: 0.70, factorId: "control", position: jitter(fp("control"), 2.2), color: fc("control") },
    { id: "need_shame_1", name: "Validation", zhName: "被肯定", deficiency: 0.62, urgency: 0.60, factorId: "shame", position: jitter(fp("shame"), 2.0), color: fc("shame") },
    { id: "need_hope_1", name: "Change Evidence", zhName: "改变证据", deficiency: 0.55, urgency: 0.45, factorId: "hope", position: jitter(fp("hope"), 1.8), color: fc("hope") },
    { id: "need_cur_1", name: "Self-Understanding", zhName: "自我理解", deficiency: 0.50, urgency: 0.50, factorId: "curiosity", position: jitter(fp("curiosity"), 1.8), color: fc("curiosity") },
    { id: "need_lone_1", name: "Deep Connection", zhName: "深层连接", deficiency: 0.72, urgency: 0.75, factorId: "loneliness", position: jitter(fp("loneliness"), 2.3), color: fc("loneliness") },
    { id: "need_resp_1", name: "Burden Relief", zhName: "责任减轻", deficiency: 0.55, urgency: 0.50, factorId: "responsibility", position: jitter(fp("responsibility"), 1.8), color: fc("responsibility") },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Behaviors
// ═══════════════════════════════════════════════════════════════════════════

function buildBehaviors(factors: SemanticFactor[]): SemanticBehavior[] {
  const fp = (id: string) => factors.find((f) => f.id === id)?.position ?? [0,0,0];
  const fc = (id: string) => factors.find((f) => f.id === id)?.color ?? "#888";

  return [
    { id: "beh_check", name: "Check Phone", zhName: "反复检查手机", probability: 0.82, reason: "确认对方是否回复，缓解不确定性焦虑", sourceFactorIds: ["attachment","fear","security"], position: jitter(fp("attachment"), 3.5), color: fc("attachment") },
    { id: "beh_test", name: "Send Test Message", zhName: "发消息试探", probability: 0.64, reason: "通过主动联系测试关系是否还在", sourceFactorIds: ["attachment","security"], position: jitter(fp("attachment"), 3.2), color: fc("attachment") },
    { id: "beh_pretend", name: "Pretend Not to Care", zhName: "假装无所谓", probability: 0.41, reason: "用冷漠掩饰不安，避免暴露脆弱", sourceFactorIds: ["attachment","shame"], position: jitter(fp("attachment"), 3.0), color: fc("attachment") },
    { id: "beh_avoid", name: "Avoid Confrontation", zhName: "逃避回应", probability: 0.55, reason: "面对不确定时选择回避而非面对", sourceFactorIds: ["fear","control"], position: jitter(fp("fear"), 3.3), color: fc("fear") },
    { id: "beh_plan", name: "Make Plans", zhName: "制定计划", probability: 0.58, reason: "通过制定详细计划来恢复控制感", sourceFactorIds: ["control","fear"], position: jitter(fp("control"), 3.0), color: fc("control") },
    { id: "beh_withdraw", name: "Withdraw", zhName: "缩回内心", probability: 0.48, reason: "感到不被理解时退回自己的世界", sourceFactorIds: ["loneliness","shame"], position: jitter(fp("loneliness"), 3.0), color: fc("loneliness") },
    { id: "beh_overcommit", name: "Over-commit", zhName: "过度承诺", probability: 0.38, reason: "通过过度承担责任来维护关系稳定", sourceFactorIds: ["responsibility","security"], position: jitter(fp("responsibility"), 2.8), color: fc("responsibility") },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Unified Data
// ═══════════════════════════════════════════════════════════════════════════

export function buildSemanticMindData(): SemanticMindData {
  jitterCursor = 0;
  const character = buildCharacter();
  const factors = buildFactors();
  const memories = buildMemories(factors);
  const beliefs = buildBeliefs(factors);
  const needs = buildNeeds(factors);
  const behaviors = buildBehaviors(factors);

  return { character, factors, memories, beliefs, needs, behaviors };
}

// ═══════════════════════════════════════════════════════════════════════════
// Trace Builder
// ═══════════════════════════════════════════════════════════════════════════

export function buildFactorTrace(factor: SemanticFactor, behaviors: SemanticBehavior[]): import("./semanticTypes").FactorTrace {
  const factorBehaviors = behaviors.filter((b) => b.sourceFactorIds.includes(factor.id));
  const topBehaviors = [...factorBehaviors].sort((a, b) => b.probability - a.probability).slice(0, 3);

  const topBehavior = topBehaviors[0];

  return {
    factorId: factor.id,
    steps: [
      { key: "event", label: "事件", detail: factor.traceEvent },
      { key: "factor", label: "影响因子", detail: `${factor.zhName}被激活`, targetId: factor.id, targetType: "factor" },
      { key: "belief", label: "信念触发", detail: factor.traceBelief, targetId: factor.beliefIds[0], targetType: "belief" },
      { key: "need", label: "需求激活", detail: factor.traceNeed, targetId: factor.needIds[0], targetType: "need" },
      {
        key: "behavior",
        label: "行为倾向",
        detail: topBehaviors.map((b) => `${b.zhName} ${Math.round(b.probability*100)}%`).join(" · "),
        targetId: topBehavior?.id,
        targetType: topBehavior ? "behavior" : undefined,
      },
    ],
  };
}
