import { describe, expect, it } from "vitest";
import {
  createCharacterStateFromBlueprint,
  createLinFanBlueprint
} from "../../src/core/character/characterBlueprint";

describe("character blueprint", () => {
  it("defines Lin Fan as a reusable character seed", () => {
    const blueprint = createLinFanBlueprint();

    expect(blueprint.identity.id).toBe("lin_fan");
    expect(blueprint.identity.name).toBe("林凡");
    expect(blueprint.identity.tags).toContain("害怕被抛弃");
    expect(blueprint.initialCoordinate.values.trust).toBeLessThan(0.4);
    expect(blueprint.initialCoordinate.values.attachment).toBeGreaterThan(0.8);
    expect(blueprint.metaState.emotionalSensitivity).toBeGreaterThan(0.7);
    expect(blueprint.biologicalNature.attachment).toBeGreaterThan(0.8);
    expect(blueprint.boundary.capacity).toBeLessThan(0.6);
    expect(blueprint.rewardState.craving).toBeGreaterThan(0.3);
    expect(blueprint.homeostasisState.recoveryBias).toBeLessThan(0.4);
    expect(blueprint.proceduralRoutines.map((routine) => routine.id)).toContain("routine_check_message");
    expect(blueprint.initialExperiences.map((event) => event.id)).toEqual([
      "lin_fan_origin_mother_rain_night",
      "lin_fan_origin_first_love_silence",
      "lin_fan_origin_wang_xue_support"
    ]);
  });

  it("creates a physics state from the blueprint without adding memories", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint());

    expect(state.identity.name).toBe("林凡");
    expect(state.coordinate.values.fear).toBeGreaterThan(0.8);
    expect(state.memories).toHaveLength(0);
    expect(state.clusters.size).toBe(0);
    expect(state.rewardState.craving).toBeGreaterThan(0.3);
    expect(state.homeostasisState.scarRetention).toBeGreaterThan(0.4);
    expect(state.proceduralRoutines).toHaveLength(2);
  });

  it("can explicitly seed origin experiences into memory galaxy", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true
    });

    expect(state.identity.name).toBe("林凡");
    expect(state.memories).toHaveLength(3);
    expect(state.particles).toHaveLength(3);
    expect(state.clusters.get("abandonment")?.age).toBe(2);
    expect(state.clusters.get("support")?.age).toBe(1);
    expect(state.beliefStates.map((belief) => belief.content)).toContain("亲密关系并不可靠。");
    expect(state.beliefStates.map((belief) => belief.content)).toContain("王雪是少数真正靠近过他的人。");
  });
});
