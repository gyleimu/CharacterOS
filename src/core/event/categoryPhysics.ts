import type { PersonalityCoordinateValues } from "../personality/coordinate";

export type EventCategory =
  | "abandonment"
  | "support"
  | "betrayal"
  | "success"
  | "failure"
  | "rejection"
  | "conflict"
  | "fatigue"
  | "uncertainty"
  | "general";

export interface EventCategoryPhysicsTemplate {
  category: EventCategory;
  emotion: string;
  coordinateDelta: Partial<PersonalityCoordinateValues>;
  beliefEffect: string;
  rationale: string;
}

export const eventCategoryPhysics: Record<EventCategory, EventCategoryPhysicsTemplate> = {
  abandonment: {
    category: "abandonment",
    emotion: "fear",
    coordinateDelta: {
      openness: -0.01,
      conscientiousness: 0,
      extroversion: -0.04,
      agreeableness: -0.05,
      neuroticism: 0.08,
      trust: -0.09,
      attachment: 0.04,
      fear: 0.08,
      control: 0.05
    },
    beliefEffect: "重要的人可能会突然离开",
    rationale: "abandonment tends to reduce social openness and increase threat sensitivity"
  },
  support: {
    category: "support",
    emotion: "relief",
    coordinateDelta: {
      openness: 0.012,
      conscientiousness: 0,
      extroversion: 0.02,
      agreeableness: 0.03,
      neuroticism: -0.04,
      trust: 0.08,    // V10.72: 0.06→0.08 — closer to symmetric with betrayal (-0.09)
      attachment: -0.01,
      fear: -0.05,    // V10.72: -0.04→-0.05 — support slightly reduces fear
      control: -0.02
    },
    beliefEffect: "也许靠近并不一定意味着离开",
    rationale: "supportive attachment experiences can slowly restore trust and reduce threat sensitivity"
  },
  betrayal: {
    category: "betrayal",
    emotion: "anger",
    coordinateDelta: {
      openness: -0.02,
      conscientiousness: 0.01,
      extroversion: -0.03,
      agreeableness: -0.08,
      neuroticism: 0.07,
      trust: -0.12,
      attachment: -0.02,
      fear: 0.06,
      control: 0.04
    },
    beliefEffect: "信任他人可能带来伤害",
    rationale: "betrayal tends to reduce trust and agreeableness over repeated exposure"
  },
  success: {
    category: "success",
    emotion: "joy",
    coordinateDelta: {
      openness: 0.03,
      conscientiousness: 0.04,
      extroversion: 0.05,
      agreeableness: 0.01,
      neuroticism: -0.03,
      trust: 0.04,    // V10.72: 0.02→0.04 — success also builds modest trust
      attachment: 0,
      fear: -0.04,    // V10.72: -0.03→-0.04
      control: 0.03
    },
    beliefEffect: "努力和表达可能带来正向结果",
    rationale: "success tends to increase agency and reduce threat sensitivity"
  },
  general: {
    category: "general",
    emotion: "uncertainty",
    coordinateDelta: {
      neuroticism: 0.002,
      fear: 0.002
    },
    beliefEffect: "这段经历需要被继续解释",
    rationale: "general events only create weak mood-colored pressure"
  },
  // ── V10.73: new event types ──
  failure: {
    category: "failure",
    emotion: "shame",
    coordinateDelta: {
      openness: -0.01,
      conscientiousness: 0.03,
      extroversion: -0.02,
      agreeableness: 0,
      neuroticism: 0.04,
      trust: -0.02,
      attachment: 0,
      fear: 0.02,
      control: 0
    },
    beliefEffect: "失败意味着能力不足或不够努力",
    rationale: "failure increases self-doubt and fear of inadequacy; may drive compensatory effort"
  },
  rejection: {
    category: "rejection",
    emotion: "sadness",
    coordinateDelta: {
      openness: -0.01,
      conscientiousness: 0,
      extroversion: -0.03,
      agreeableness: -0.03,
      neuroticism: 0.03,
      trust: -0.04,
      attachment: 0.03,
      fear: 0.04,
      control: 0.01
    },
    beliefEffect: "主动靠近可能会被推开",
    rationale: "social rejection increases attachment anxiety and social caution without full trust collapse"
  },
  conflict: {
    category: "conflict",
    emotion: "anger",
    coordinateDelta: {
      openness: -0.01,
      conscientiousness: 0,
      extroversion: 0.01,
      agreeableness: -0.04,
      neuroticism: 0.03,
      trust: -0.03,
      attachment: 0,
      fear: 0.02,
      control: 0.05
    },
    beliefEffect: "意见不一致可能导致关系破裂",
    rationale: "conflict activates boundary defense and control need; trust erosion is moderate, not betrayal-level"
  },
  fatigue: {
    category: "fatigue",
    emotion: "fatigue",
    coordinateDelta: {
      openness: -0.01,
      conscientiousness: -0.02,
      extroversion: -0.02,
      agreeableness: -0.005,
      neuroticism: 0.01,
      trust: 0,
      attachment: 0,
      fear: 0.005,
      control: -0.01
    },
    beliefEffect: "身体状态会影响心理状态和判断",
    rationale: "fatigue reduces action capacity and patience without affecting core trust or attachment beliefs"
  },
  uncertainty: {
    category: "uncertainty",
    emotion: "uncertainty",
    coordinateDelta: {
      openness: 0,
      conscientiousness: 0,
      extroversion: 0,
      agreeableness: 0,
      neuroticism: 0.02,
      trust: -0.005,
      attachment: 0.005,
      fear: 0.02,
      control: 0.01
    },
    beliefEffect: "不确定的信息需要进一步验证",
    rationale: "uncertainty increases vigilance and information-seeking without strong directional personality shift"
  }
};

export function getEventCategoryPhysics(category: string): EventCategoryPhysicsTemplate | undefined {
  return eventCategoryPhysics[category as EventCategory];
}
