import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { buildAttentionProfile, evaluateEventAttention } from "../../src/core/attention/attentionSystem";
import { defaultMetaState } from "../../src/core/meta/metaState";
import { normalizeTags } from "../../src/core/event/tagNormalization";

describe("Attention System", () => {
  it("focuses on danger under high sensitivity and trauma amplification", () => {
    const meta = {
      ...defaultMetaState(),
      emotionalSensitivity: 0.92,
      traumaAmplification: 0.9,
      lonelinessTolerance: 0.8,
      attachmentStyle: 0.3
    };
    const boundary = createPsychologicalBoundary({ stressLoad: 0.82, capacity: 0.7, phase: "overflow" });
    const attention = evaluateEventAttention({
      meta,
      boundary,
      event: {
        id: "attention_danger_1",
        description: "对方突然失联。",
        tags: ["失联", "等待", "威胁"],
        category: "abandonment",
        intensity: 0.82,
        importance: 0.86,
        relationshipWeight: 0.9,
        expectationGap: 0.85,
        personalitySensitivity: 0.9
      }
    });

    expect(attention.dominantChannel).toBe("danger");
    expect(attention.noticedTags).toContain("失联");
    expect(attention.score).toBeGreaterThan(0.7);
  });

  it("focuses on relationship under loneliness and attachment pressure", () => {
    const meta = {
      ...defaultMetaState(),
      emotionalSensitivity: 0.45,
      traumaAmplification: 0.25,
      lonelinessTolerance: 0.12,
      attachmentStyle: 0.9,
      attention: 0.82
    };
    const boundary = createPsychologicalBoundary({ stressLoad: 0.2, capacity: 0.8, phase: "stable" });
    const attention = evaluateEventAttention({
      meta,
      boundary,
      event: {
        id: "attention_relation_1",
        description: "王雪主动陪林凡散步。",
        tags: ["王雪", "陪伴", "亲密关系"],
        category: "support",
        intensity: 0.68,
        importance: 0.72,
        relationshipWeight: 0.95,
        expectationGap: 0.42,
        personalitySensitivity: 0.72
      }
    });

    expect(attention.dominantChannel).toBe("relationship");
    expect(attention.noticedTags).toContain("王雪");
    expect(attention.noticedTags).toContain("陪伴");
  });

  it("builds a bounded attention profile", () => {
    const profile = buildAttentionProfile({
      meta: defaultMetaState(),
      boundary: createPsychologicalBoundary()
    });

    expect(Object.values(profile).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("correctly evaluates attention with English tags after normalization", () => {
    const meta = {
      ...defaultMetaState(),
      emotionalSensitivity: 0.88,
      traumaAmplification: 0.85,
      lonelinessTolerance: 0.15,
      attachmentStyle: 0.75
    };
    const boundary = createPsychologicalBoundary({ stressLoad: 0.7, capacity: 0.6, phase: "strained" });

    // Simulate what happens when event tags are normalized at parse time
    // (as done by eventParser, llmEventParser, and the service boundary).
    const rawTags = ["abandonment", "silence", "night", "relationship"];
    const canonicalTags = normalizeTags(rawTags);

    const attention = evaluateEventAttention({
      meta,
      boundary,
      event: {
        id: "attention_english_tags",
        description: "Wang Xue has not replied for three days. It is late at night.",
        tags: canonicalTags,
        category: "abandonment",
        intensity: 0.85,
        importance: 0.88,
        relationshipWeight: 0.9,
        expectationGap: 0.82,
        personalitySensitivity: 0.9
      }
    });

    // After normalization: "abandonment"→"失联", "silence"→"等待", "night"→"夜晚", "relationship"→"关系"
    // "等待" is in the relationship channel, "关系" is also in the relationship channel.
    // "失联" is in the danger channel. With 2 relationship tags vs 1 danger tag,
    // the channel score multiplication (profile * matchingCount) favors relationship.
    // This is correct behavior — more relationship-coded tags means relationship dominates.
    expect(attention.dominantChannel).toBe("relationship");
    // The dominant channel's tags appear in noticedTags
    expect(attention.noticedTags).toContain("等待");
    expect(attention.noticedTags).toContain("关系");
    // Danger profile should still be elevated (high sensitivity + trauma)
    expect(attention.profile.danger).toBeGreaterThan(0.5);
    // Attention score should be solid
    expect(attention.score).toBeGreaterThan(0.5);
  });
});
