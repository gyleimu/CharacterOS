import type { EventCategory } from "./categoryPhysics";
import type { ExperienceEvent } from "./event";

export interface EventCategoryMatch {
  category: EventCategory;
  matchedKeywords: string[];
  confidence: number;
}

const CATEGORY_KEYWORDS: Record<EventCategory, string[]> = {
  abandonment: ["失联", "离开", "抛弃", "等待", "不回复", "消失", "冷落", "夜晚", "雨夜"],
  support: ["陪伴", "解释", "安慰", "留下", "靠近", "温暖", "支持", "照顾"],
  betrayal: ["欺骗", "背叛", "隐瞒", "利用", "撒谎", "出卖"],
  success: ["成功", "认可", "胜利", "晋升", "完成", "表扬", "被看见"],
  failure: ["失败", "搞砸", "失误", "考砸", "落选", "被否定", "没通过", "不如预期", "退步", "丢脸"],
  rejection: ["拒绝", "冷淡", "疏远", "推开", "避开", "不理会", "被忽略", "无视", "敷衍", "被排斥"],
  conflict: ["冲突", "指责", "争吵", "批评", "责怪", "埋怨", "对峙", "对立", "翻脸", "争执"],
  fatigue: ["疲劳", "累", "睡眠不足", "没睡好", "身体不适", "乏力", "困", "头昏", "体力", "筋疲力尽"],
  uncertainty: ["不确定", "模糊", "含糊", "矛盾", "犹豫", "摇摆", "说不清", "信号不明", "捉摸不透", "未知"],
  general: [],
};

export function classifyEventCategory(
  text: string,
  categoryHint?: EventCategory | "auto",
): EventCategoryMatch {
  if (categoryHint && categoryHint !== "auto") {
    return { category: categoryHint, matchedKeywords: [], confidence: 1 };
  }

  const ranked = (Object.entries(CATEGORY_KEYWORDS) as Array<[EventCategory, string[]]>)
    .map(([category, keywords]) => {
      const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
      return { category, matchedKeywords, score: matchedKeywords.length };
    })
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];

  if (!best || best.score === 0) {
    return { category: "general", matchedKeywords: [], confidence: 0.2 };
  }

  return {
    category: best.category,
    matchedKeywords: best.matchedKeywords,
    confidence: Math.min(0.95, 0.45 + best.score * 0.15),
  };
}

export function resolveEventCategory(event: ExperienceEvent): string {
  if (event.category) return event.category;
  return classifyEventCategory(`${event.description} ${event.tags.join(" ")}`).category;
}
