export interface PersonalityDimension {
  key: string;
  label: string;
  description: string;
  lowAnchor: string;
  highAnchor: string;
}

export const BASE_PERSONALITY_DIMENSIONS = [
  {
    key: "openness",
    label: "开放性",
    description: "对新经验、新解释和复杂性的接受程度。",
    lowAnchor: "保守、封闭、抗拒新解释",
    highAnchor: "开放、好奇、愿意重新理解"
  },
  {
    key: "conscientiousness",
    label: "尽责性",
    description: "秩序感、自控和对承诺的执行倾向。",
    lowAnchor: "松散、冲动、低规划",
    highAnchor: "克制、有序、重视承诺"
  },
  {
    key: "extroversion",
    label: "外向性",
    description: "主动表达、社交能量和外部探索倾向。",
    lowAnchor: "内向、退缩、少表达",
    highAnchor: "外向、主动、外显表达"
  },
  {
    key: "agreeableness",
    label: "宜人性",
    description: "信任、合作、柔和回应和关系修复倾向。",
    lowAnchor: "防御、怀疑、关系中较硬",
    highAnchor: "信任、体谅、关系中较软"
  },
  {
    key: "neuroticism",
    label: "神经质",
    description: "威胁敏感、焦虑、情绪波动和痛苦记忆唤起倾向。",
    lowAnchor: "稳定、低焦虑、恢复快",
    highAnchor: "敏感、高焦虑、恢复慢"
  },
  {
    key: "trust",
    label: "信任",
    description: "相信他人不会伤害、欺骗或突然离开的倾向。",
    lowAnchor: "不信任、预设背叛或离开",
    highAnchor: "信任、愿意相信善意"
  },
  {
    key: "attachment",
    label: "依恋",
    description: "对少数亲密对象形成依赖和连接需求的强度。",
    lowAnchor: "低依赖、可独处、关系需求弱",
    highAnchor: "高依赖、强连接需求、害怕断联"
  },
  {
    key: "fear",
    label: "恐惧",
    description: "面对关系风险和不确定事件时的恐惧基线。",
    lowAnchor: "低恐惧、敢冒关系风险",
    highAnchor: "高恐惧、回避风险、警觉"
  },
  {
    key: "control",
    label: "控制感",
    description: "希望关系和事件可预测、可解释、可掌控的倾向。",
    lowAnchor: "接受混乱、不强求解释",
    highAnchor: "需要解释、边界和可预测性"
  }
] as const satisfies readonly PersonalityDimension[];

export type PersonalityDimensionKey = (typeof BASE_PERSONALITY_DIMENSIONS)[number]["key"];

export const BASE_PERSONALITY_KEYS = BASE_PERSONALITY_DIMENSIONS.map(
  (dimension) => dimension.key
) as PersonalityDimensionKey[];
