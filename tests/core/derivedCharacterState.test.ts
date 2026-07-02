import { describe, expect, it } from "vitest";
import { parseExperienceEvent } from "../../src/core/event/eventParser";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { deriveCharacterState } from "../../src/core/state/derivedCharacterState";

describe("deriveCharacterState", () => {
  it("derives beliefs, needs, desires, and behavior biases from accumulated memories", () => {
    const state = createCharacterPhysicsState({
      proceduralRoutines: [
        {
          id: "routine_check_message",
          cueTags: ["失联", "等待"],
          action: "反复查看手机消息。",
          strength: 0.68,
          repetitionCount: 16
        }
      ]
    });
    const engine = new CharacterPhysicsEngine();
    const events = [
      "王雪已经三天没有回复林凡的消息。",
      "王雪又一次突然失联，没有说明原因。"
    ];

    for (const description of events) {
      engine.processEvent(
        state,
        parseExperienceEvent({
          description,
          tags: ["王雪", "失联", "等待"],
          categoryHint: "auto"
        })
      );
    }

    const derived = deriveCharacterState(state);

    expect(derived.beliefs[0]?.content).toBe("重要的人可能会突然离开");
    expect(derived.beliefs[0]?.strength).toBeGreaterThan(0.4);
    expect(derived.needs[0]?.name).toBe("安全感缺失");
    expect(derived.desires[0]?.content).toContain("确认");
    expect(derived.meaning.meaningIntensity).toBeGreaterThan(0);
    expect(derived.meaning.anchors.length).toBeGreaterThan(0);
    expect(derived.worldInterpretation?.frame).toBe("rejection");
    expect(derived.worldInterpretation?.evidence).toContain("主观时间被拉长，事件心理重量上升。");
    expect(derived.behaviorBiases[0]?.tendency).toContain("压住情绪");
    expect(derived.behaviorBiases.at(-1)?.tendency).toContain("无所谓");
    expect(derived.embodiedAction.intendedAction).toBe(derived.decision.mostLikelyAction);
    expect(derived.embodiedAction.noiseLevel).toBeGreaterThanOrEqual(0);
    expect(derived.embodiedAction.misfireRisk).toBeGreaterThanOrEqual(0);
    expect(derived.socialExpression.trueState).toContain("真实");
    expect(derived.socialExpression.expressedState).toContain("表达状态");
    expect(derived.socialExpression.conflictLevel).toBeGreaterThanOrEqual(0);
    expect(derived.proceduralActivations[0]?.routine.id).toBe("routine_check_message");
    expect(derived.proceduralActivations[0]?.activationScore).toBeGreaterThan(0.5);
  });
});
