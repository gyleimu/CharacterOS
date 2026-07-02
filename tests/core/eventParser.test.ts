import { describe, expect, it } from "vitest";
import { parseExperienceEvent } from "../../src/core/event/eventParser";

describe("parseExperienceEvent", () => {
  it("infers abandonment physics from event text and tags", () => {
    const event = parseExperienceEvent({
      description: "王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。",
      tags: ["王雪", "失联", "等待", "亲密关系", "夜晚"],
      categoryHint: "auto"
    });

    expect(event.category).toBe("abandonment");
    expect(event.emotion).toBe("fear");
    expect(event.coordinateDelta?.trust).toBeLessThan(0);
    expect(event.intensity).toBeGreaterThan(0.8);
    expect(event.parser.confidence).toBeGreaterThan(0.7);
  });

  it("uses category hints when the caller already knows the event class", () => {
    const event = parseExperienceEvent({
      description: "王雪解释了原因，并认真陪林凡度过那个夜晚。",
      tags: ["王雪", "解释", "陪伴"],
      categoryHint: "support"
    });

    expect(event.category).toBe("support");
    expect(event.emotion).toBe("relief");
    expect(event.coordinateDelta?.trust).toBeGreaterThan(0);
    expect(event.parser.confidence).toBe(1);
  });

  it("falls back to general when no category signal is found", () => {
    const event = parseExperienceEvent({
      description: "林凡今天整理了书桌。",
      tags: ["日常"],
      categoryHint: "auto"
    });

    expect(event.category).toBe("general");
    expect(event.emotion).toBe("uncertainty");
    expect(event.parser.confidence).toBe(0.2);
  });
});
