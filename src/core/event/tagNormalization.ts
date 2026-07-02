/**
 * Tag normalization for multi-language event parsing and attention.
 *
 * CharacterOS currently uses Chinese canonical tags throughout the event
 * parser, attention system, and category physics. This module provides a
 * minimal normalization layer so that common English tags are mapped to
 * their Chinese canonical equivalents. Chinese tags pass through unchanged.
 *
 * This is NOT a full i18n system. It is a lightweight normalization step
 * that runs before tag-dependent logic (category inference, attention
 * channel selection, etc.) so that English-language API consumers can
 * use familiar keywords without the system silently ignoring them.
 *
 * Future: when a real i18n layer is needed, this module should be replaced
 * by a locale-aware tag registry. For now it keeps the surface area small.
 */

/**
 * English → Chinese canonical tag mapping.
 *
 * Only common tags that appear in event descriptions, attention channels,
 * and category physics are included. Tags not found in this map are assumed
 * to already be in canonical (Chinese) form and are passed through.
 */
const ENGLISH_TO_CANONICAL: Record<string, string> = {
  // Abandonment / loss
  abandonment: "失联",
  abandoned: "失联",
  leaving: "离开",
  left: "离开",
  disappeared: "消失",
  ignoring: "冷落",
  ignored: "冷落",
  silence: "等待",
  waiting: "等待",
  wait: "等待",
  "no reply": "不回复",
  "no response": "不回复",
  ghosting: "失联",
  "cold shoulder": "冷落",

  // Night / time / weather
  night: "夜晚",
  midnight: "深夜",
  "rainy night": "雨夜",
  rain: "雨夜",
  storm: "雨夜",

  // Support / care
  support: "支持",
  supported: "支持",
  comfort: "安慰",
  comforted: "安慰",
  warmth: "温暖",
  care: "照顾",
  "taking care": "照顾",
  staying: "留下",
  stay: "留下",
  "being there": "陪伴",
  accompanying: "陪伴",

  // Relationship / intimacy
  relationship: "关系",
  love: "爱",
  intimacy: "亲密关系",
  closeness: "亲密关系",
  loneliness: "孤独",
  lonely: "孤独",
  alone: "孤独",
  dependence: "依赖",
  dependent: "依赖",

  // Betrayal / deception
  betrayal: "背叛",
  betrayed: "背叛",
  deception: "欺骗",
  deceived: "欺骗",
  lying: "撒谎",
  lie: "撒谎",
  hidden: "隐瞒",
  hiding: "隐瞒",
  exploiting: "利用",
  exploited: "利用",

  // Danger / fear
  danger: "危险",
  fear: "恐惧",
  threat: "威胁",
  pain: "痛苦",
  painful: "痛苦",
  suffering: "痛苦",

  // Success / recognition
  success: "成功",
  recognition: "认可",
  recognized: "认可",
  praise: "表扬",
  praised: "表扬",
  victory: "胜利",
  achievement: "完成",
  promotion: "晋升",
  promoted: "晋升",
  "being seen": "被看见",

  // Novelty / change
  novelty: "新",
  new: "新",
  unfamiliar: "陌生",
  strange: "陌生",
  change: "变化",
  unknown: "未知",
  opportunity: "机会",

  // Control / explanation
  control: "掌控",
  explanation: "解释",
  explaining: "解释",
  promise: "承诺",
  promising: "承诺",
  planning: "计划",
  plan: "计划",
  arrangement: "安排",
  arranging: "安排",
};

/**
 * Normalize an array of tags to canonical (Chinese) form.
 *
 * - Chinese tags pass through unchanged.
 * - English tags found in the mapping are replaced with their canonical equivalent.
 * - English tags NOT in the mapping are kept as-is (future-proofing).
 * - Duplicates are removed.
 * - Empty strings are filtered out.
 * - Returns a new array; does not mutate the input.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    if (!tag || typeof tag !== "string") continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const canonical = ENGLISH_TO_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }
  return normalized;
}

/**
 * Check whether a tag (English or Chinese) maps to a specific canonical tag.
 * Useful for attention channel matching and category inference.
 */
export function tagMatchesCanonical(tag: string, canonical: string): boolean {
  if (!tag || !canonical) return false;
  const normalized = ENGLISH_TO_CANONICAL[tag.trim().toLowerCase()] ?? tag.trim();
  return normalized === canonical;
}

/**
 * Return the set of all known English tags. Useful for documentation and
 * API validation.
 */
export function knownEnglishTags(): string[] {
  return Object.keys(ENGLISH_TO_CANONICAL).sort();
}
