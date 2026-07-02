import { describe, expect, it } from "vitest";
import { parseExperienceEventWithProvider } from "../../src/core/event/llmEventParser";
import type { LLMMessage, LLMProvider } from "../../src/llm/llmProvider";

class FakeProvider implements LLMProvider {
  constructor(private readonly response: string) {}

  generate(_messages: LLMMessage[]): Promise<string> {
    return Promise.resolve(this.response);
  }
}

describe("parseExperienceEventWithProvider", () => {
  it("normalizes LLM parser output into a ParsedExperienceEvent", async () => {
    const event = await parseExperienceEventWithProvider(
      {
        description: "王雪解释了失联原因，并认真陪林凡。",
        tags: ["王雪", "解释", "陪伴"],
        categoryHint: "auto"
      },
      new FakeProvider(JSON.stringify({
        category: "support",
        emotion: "relief",
        intensity: 0.67,
        importance: 0.76,
        relationshipWeight: 0.92,
        expectationGap: 0.45,
        personalitySensitivity: 0.7,
        beliefEffect: "靠近也可能是安全的",
        rationale: "supportive repair after absence",
        confidence: 0.88,
        matchedKeywords: ["解释", "陪伴"]
      }))
    );

    expect(event.category).toBe("support");
    expect(event.emotion).toBe("relief");
    expect(event.coordinateDelta?.trust).toBeGreaterThan(0);
    expect(event.beliefEffect).toBe("靠近也可能是安全的");
    expect(event.intensity).toBe(0.67);
    expect(event.parser.source).toBe("llm");
    expect(event.parser.confidence).toBe(0.88);
  });

  it("falls back to the rule parser when the LLM output is invalid", async () => {
    const event = await parseExperienceEventWithProvider(
      {
        description: "王雪已经三天没有回复林凡的消息。",
        tags: ["王雪", "失联"],
        categoryHint: "auto"
      },
      new FakeProvider("not json")
    );

    expect(event.category).toBe("abandonment");
    expect(event.parser.source).toBe("rule_fallback");
  });

  it("normalizes common English emotion variants from LLM output", async () => {
    const event = await parseExperienceEventWithProvider(
      {
        description: "王雪解释了失联原因，并认真陪林凡。",
        tags: ["王雪", "解释", "陪伴"],
        categoryHint: "support"
      },
      new FakeProvider(JSON.stringify({
        category: "support",
        emotion: "relieved",
        confidence: 0.8
      }))
    );

    expect(event.emotion).toBe("relief");
  });
});
