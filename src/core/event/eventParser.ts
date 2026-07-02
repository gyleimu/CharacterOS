import {
  eventCategoryPhysics,
  type EventCategory,
  type EventCategoryPhysicsTemplate
} from "./categoryPhysics";
import type { ExperienceEvent } from "./event";
import { normalizeTags } from "./tagNormalization";

export interface ParseExperienceEventInput {
  description: string;
  tags?: string[];
  categoryHint?: EventCategory | "auto";
}

export interface ParsedExperienceEvent extends ExperienceEvent {
  parser: {
    source: "rule" | "llm" | "rule_fallback";
    matchedKeywords: string[];
    confidence: number;
  };
}

const categoryKeywords: Record<EventCategory, string[]> = {
  abandonment: ["失联", "离开", "抛弃", "等待", "不回复", "消失", "冷落", "夜晚", "雨夜"],
  support: ["陪伴", "解释", "安慰", "留下", "靠近", "温暖", "支持", "照顾"],
  betrayal: ["欺骗", "背叛", "隐瞒", "利用", "撒谎", "出卖"],
  success: ["成功", "认可", "胜利", "晋升", "完成", "表扬", "被看见"],
  // V10.73: new event type keywords
  failure: ["失败", "搞砸", "失误", "考砸", "落选", "被否定", "没通过", "不如预期", "退步", "丢脸"],
  rejection: ["拒绝", "冷淡", "疏远", "推开", "避开", "不理会", "被忽略", "无视", "敷衍", "被排斥"],
  conflict: ["冲突", "指责", "争吵", "批评", "责怪", "埋怨", "对峙", "对立", "翻脸", "争执"],
  fatigue: ["疲劳", "累", "睡眠不足", "没睡好", "身体不适", "乏力", "困", "头昏", "体力", "筋疲力尽"],
  uncertainty: ["不确定", "模糊", "含糊", "矛盾", "犹豫", "摇摆", "说不清", "信号不明", "捉摸不透", "未知"],
  general: []
};

export function parseExperienceEvent(input: ParseExperienceEventInput): ParsedExperienceEvent {
  const tags = normalizeTags(input.tags ?? []);
  const text = `${input.description} ${tags.join(" ")}`;
  const inferred = inferCategory(text, input.categoryHint);
  const template = eventCategoryPhysics[inferred.category];
  const impact = inferImpact(text, tags, inferred.category);

  return {
    id: createEventId(input.description),
    description: input.description,
    tags,
    category: template.category,
    emotion: template.emotion,
    coordinateDelta: template.coordinateDelta,
    beliefEffect: template.beliefEffect,
    rationale: template.rationale,
    intensity: impact.intensity,
    importance: impact.importance,
    relationshipWeight: impact.relationshipWeight,
    expectationGap: impact.expectationGap,
    personalitySensitivity: impact.personalitySensitivity,
    parser: {
      source: "rule",
      matchedKeywords: inferred.matchedKeywords,
      confidence: inferred.confidence
    }
  };
}

function inferCategory(
  text: string,
  categoryHint?: EventCategory | "auto"
): { category: EventCategory; matchedKeywords: string[]; confidence: number } {
  if (categoryHint && categoryHint !== "auto") {
    return { category: categoryHint, matchedKeywords: [], confidence: 1 };
  }

  const ranked = (Object.entries(categoryKeywords) as Array<[EventCategory, string[]]>)
    .map(([category, keywords]) => {
      const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
      return {
        category,
        matchedKeywords,
        score: matchedKeywords.length
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score === 0) {
    return { category: "general", matchedKeywords: [], confidence: 0.2 };
  }

  return {
    category: best.category,
    matchedKeywords: best.matchedKeywords,
    confidence: Math.min(0.95, 0.45 + best.score * 0.15)
  };
}

function inferImpact(text: string, tags: string[], category: EventCategory) {
  const hasRelationship = hasAny(text, tags, ["王雪", "母亲", "初恋", "亲密关系", "朋友", "家人"]);
  const hasTimeStress = hasAny(text, tags, ["三天", "深夜", "雨夜", "整晚", "突然", "连续"]);
  const hasHighThreat = hasAny(text, tags, ["失联", "抛弃", "背叛", "欺骗", "死亡", "离开"]);

  const templateWeight = categoryTemplateWeight(eventCategoryPhysics[category]);
  const intensity = clamp01(0.45 + templateWeight + (hasHighThreat ? 0.18 : 0) + (hasTimeStress ? 0.08 : 0));
  const importance = clamp01(0.5 + templateWeight + (hasRelationship ? 0.18 : 0));
  const relationshipWeight = hasRelationship ? 0.9 : 0.45;
  const expectationGap = clamp01(0.45 + (hasHighThreat ? 0.22 : 0) + (hasTimeStress ? 0.12 : 0));
  const personalitySensitivity =
    category === "abandonment" || category === "betrayal" ? 0.9 :
    category === "failure" || category === "rejection" || category === "conflict" ? 0.75 :
    category === "fatigue" || category === "uncertainty" ? 0.5 :
    0.7;

  return {
    intensity,
    importance,
    relationshipWeight,
    expectationGap,
    personalitySensitivity
  };
}

function categoryTemplateWeight(template: EventCategoryPhysicsTemplate): number {
  if (template.category === "abandonment" || template.category === "betrayal") return 0.18;
  if (template.category === "support" || template.category === "success") return 0.1;
  // V10.73: moderate-weight categories
  if (template.category === "failure" || template.category === "rejection" || template.category === "conflict") return 0.12;
  // V10.73: light-weight categories
  if (template.category === "fatigue" || template.category === "uncertainty") return 0.04;
  return 0;
}

function hasAny(text: string, tags: string[], keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword) || tags.includes(keyword));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function createEventId(description: string): string {
  let hash = 0;
  for (let index = 0; index < description.length; index += 1) {
    hash = (hash * 31 + description.charCodeAt(index)) >>> 0;
  }
  return `parsed_${hash.toString(16)}`;
}
