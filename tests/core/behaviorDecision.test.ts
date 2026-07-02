import { describe, expect, it } from "vitest";
import { parseExperienceEvent } from "../../src/core/event/eventParser";
import { linFanInitialCoordinate } from "../../src/core/personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { deriveCharacterState } from "../../src/core/state/derivedCharacterState";

describe("BehaviorDecision", () => {
  it("turns derived character state into a psychologically consistent decision", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    const engine = new CharacterPhysicsEngine();

    engine.processEvent(
      state,
      parseExperienceEvent({
        description: "王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。",
        tags: ["王雪", "失联", "等待", "亲密关系", "夜晚"],
        categoryHint: "auto"
      })
    );
    engine.processEvent(
      state,
      parseExperienceEvent({
        description: "王雪又一次突然失联，没有说明原因。",
        tags: ["王雪", "失联", "等待"],
        categoryHint: "auto"
      })
    );

    const decision = deriveCharacterState(state).decision;

    expect(decision.innerThoughts.length).toBeGreaterThanOrEqual(3);
    expect(decision.emotionalReaction).toContain("不安");
    expect(decision.willNotDo).toContain("不会真的完全无所谓。");
    expect(decision.willNotDo).toContain("不会立刻失控式爆发。");
    expect(decision.mostLikelyAction).toContain("压住情绪");
    expect(decision.rationale).toContain("信任");
    expect(decision.confidence).toBeGreaterThan(0.5);
  });
});
