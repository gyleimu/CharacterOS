import { describe, expect, it } from "vitest";
import { normalizeTags, tagMatchesCanonical, knownEnglishTags } from "../../src/core/event/tagNormalization";

describe("tagNormalization", () => {
  describe("normalizeTags", () => {
    it("passes Chinese canonical tags through unchanged", () => {
      expect(normalizeTags(["失联", "等待", "夜晚"])).toEqual(["失联", "等待", "夜晚"]);
    });

    it("maps common English tags to Chinese canonical equivalents", () => {
      expect(normalizeTags(["abandonment", "silence", "night"])).toEqual(["失联", "等待", "夜晚"]);
    });

    it("handles mixed English and Chinese tags", () => {
      const result = normalizeTags(["王雪", "abandonment", "waiting", "陪伴"]);
      expect(result).toContain("王雪");
      expect(result).toContain("失联");
      expect(result).toContain("等待");
      expect(result).toContain("陪伴");
    });

    it("removes duplicates after normalization", () => {
      // "abandonment" and "失联" both normalize to "失联"
      expect(normalizeTags(["abandonment", "失联"])).toEqual(["失联"]);
    });

    it("filters out empty and whitespace-only tags", () => {
      expect(normalizeTags(["", "   ", "night"])).toEqual(["夜晚"]);
    });

    it("keeps unknown English tags as-is for future-proofing", () => {
      expect(normalizeTags(["quantum_entanglement"])).toEqual(["quantum_entanglement"]);
    });

    it("handles empty array", () => {
      expect(normalizeTags([])).toEqual([]);
    });

    it("does not mutate the input array", () => {
      const input = ["abandonment"];
      normalizeTags(input);
      expect(input).toEqual(["abandonment"]);
    });

    // Category-level mapping tests
    it("maps abandonment-category English tags", () => {
      const result = normalizeTags(["abandonment", "leaving", "disappeared", "ignoring", "no reply", "ghosting"]);
      expect(result).toEqual(["失联", "离开", "消失", "冷落", "不回复"]);
    });

    it("maps support-category English tags", () => {
      const result = normalizeTags(["support", "comfort", "warmth", "care", "staying", "being there"]);
      expect(result).toEqual(["支持", "安慰", "温暖", "照顾", "留下", "陪伴"]);
    });

    it("maps relationship-category English tags", () => {
      const result = normalizeTags(["love", "intimacy", "loneliness", "dependence"]);
      expect(result).toEqual(["爱", "亲密关系", "孤独", "依赖"]);
    });

    it("maps betrayal-category English tags", () => {
      const result = normalizeTags(["betrayal", "deception", "lying", "hidden", "exploiting"]);
      expect(result).toEqual(["背叛", "欺骗", "撒谎", "隐瞒", "利用"]);
    });

    it("maps danger-category English tags", () => {
      const result = normalizeTags(["danger", "fear", "threat", "pain", "suffering"]);
      expect(result).toEqual(["危险", "恐惧", "威胁", "痛苦"]);
    });

    it("maps success-category English tags", () => {
      const result = normalizeTags(["success", "recognition", "praise", "victory", "promotion"]);
      expect(result).toEqual(["成功", "认可", "表扬", "胜利", "晋升"]);
    });

    it("maps novelty-category English tags", () => {
      const result = normalizeTags(["novelty", "unfamiliar", "change", "unknown", "opportunity"]);
      expect(result).toEqual(["新", "陌生", "变化", "未知", "机会"]);
    });

    it("maps control-category English tags", () => {
      const result = normalizeTags(["control", "explanation", "promise", "planning", "arrangement"]);
      expect(result).toEqual(["掌控", "解释", "承诺", "计划", "安排"]);
    });
  });

  describe("tagMatchesCanonical", () => {
    it("returns true when English tag maps to the canonical tag", () => {
      expect(tagMatchesCanonical("abandonment", "失联")).toBe(true);
      expect(tagMatchesCanonical("waiting", "等待")).toBe(true);
      expect(tagMatchesCanonical("night", "夜晚")).toBe(true);
    });

    it("returns true when canonical tag matches itself", () => {
      expect(tagMatchesCanonical("失联", "失联")).toBe(true);
      expect(tagMatchesCanonical("等待", "等待")).toBe(true);
    });

    it("returns false when tags do not match", () => {
      expect(tagMatchesCanonical("abandonment", "等待")).toBe(false);
      expect(tagMatchesCanonical("love", "失联")).toBe(false);
    });

    it("returns false for empty inputs", () => {
      expect(tagMatchesCanonical("", "失联")).toBe(false);
      expect(tagMatchesCanonical("abandonment", "")).toBe(false);
    });
  });

  describe("knownEnglishTags", () => {
    it("returns a sorted list of supported English tags", () => {
      const tags = knownEnglishTags();
      expect(tags.length).toBeGreaterThan(40);
      // Verify sorted
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
      // Spot-check key entries
      expect(tags).toContain("abandonment");
      expect(tags).toContain("silence");
      expect(tags).toContain("night");
      expect(tags).toContain("relationship");
      expect(tags).toContain("support");
    });
  });
});
