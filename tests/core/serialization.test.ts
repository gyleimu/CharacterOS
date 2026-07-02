import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import { linFanInitialCoordinate } from "../../src/core/personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState
} from "../../src/core/physics/serialization";

describe("CharacterPhysicsState serialization", () => {
  it("roundtrips state through JSON-safe data", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      proceduralRoutines: [
        {
          id: "routine_check_message",
          cueTags: ["手机震动", "消息"],
          action: "查看消息。",
          strength: 0.7,
          repetitionCount: 12
        }
      ]
    });
    const event: ExperienceEvent = {
      id: "serialization_event_1",
      description: "王雪三天没有回复林凡的消息。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      intensity: 0.8,
      importance: 0.8,
      relationshipWeight: 0.9,
      expectationGap: 0.8,
      personalitySensitivity: 0.9
    };
    new CharacterPhysicsEngine().processEvent(state, event);

    const serialized = serializeCharacterPhysicsState(state);
    const encoded = JSON.stringify(serialized);
    const decoded = JSON.parse(encoded);
    const restored = deserializeCharacterPhysicsState(decoded);

    expect(restored.memories).toHaveLength(1);
    expect(restored.identity.name).toBe("Anonymous");
    expect(serialized.identity?.id).toBe("anonymous");
    expect(restored.particles).toHaveLength(1);
    expect(restored.boundary.stressLoad).toBeGreaterThan(0);
    expect(restored.biologicalNature.survival).toBeGreaterThan(0);
    expect(restored.metaState.selfControl).toBe(state.metaState.selfControl);
    expect(restored.beliefStates[0]?.content).toBe(state.beliefStates[0]?.content);
    expect(restored.proceduralRoutines[0]?.id).toBe("routine_check_message");
    expect(restored.rewardState.dopamineLevel).toBe(state.rewardState.dopamineLevel);
    expect(restored.homeostasisState.changeResistance).toBe(state.homeostasisState.changeResistance);
    expect(restored.boredomState.boredomLevel).toBe(state.boredomState.boredomLevel);
    expect(restored.clusters.get("abandonment")?.age).toBe(1);
    expect(restored.coordinate.values.trust).toBeCloseTo(state.coordinate.values.trust);
    expect(serialized.galaxy.forces).toHaveLength(1);
    expect(serialized.galaxy.clusterMetrics[0]?.metrics.mass).toBeGreaterThan(0);
  });
});
