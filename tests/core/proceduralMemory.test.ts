import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import {
  activateProceduralMemory,
  decayProceduralRoutine,
  reinforceProceduralRoutine,
  type ProceduralRoutine
} from "../../src/core/procedural/proceduralMemory";
import { defaultMetaState } from "../../src/core/meta/metaState";

describe("ProceduralMemory", () => {
  const routines: ProceduralRoutine[] = [
    {
      id: "routine_check_message",
      cueTags: ["手机震动", "消息"],
      action: "立刻查看消息。",
      strength: 0.7,
      repetitionCount: 18
    },
    {
      id: "routine_make_tea",
      cueTags: ["疲惫", "夜晚"],
      action: "给自己倒一杯热水。",
      strength: 0.42,
      repetitionCount: 6
    }
  ];

  it("activates routines whose cue tags match the current situation", () => {
    const activations = activateProceduralMemory({
      routines,
      cue: { tags: ["手机震动", "消息", "夜晚"] },
      meta: defaultMetaState(),
      boundary: createPsychologicalBoundary({ stressLoad: 0.1 }),
      topK: 2
    });

    expect(activations[0]?.routine.id).toBe("routine_check_message");
    expect(activations[0]?.cueMatch).toBe(1);
    expect(activations[0]?.automaticity).toBeGreaterThan(0.55);
    expect(activations[0]?.reasons).toContain("当前 cue 与习惯触发条件高度重合。");
  });

  it("raises automaticity when pressure is high and self-control is low", () => {
    const stable = activateProceduralMemory({
      routines: [routines[0] as ProceduralRoutine],
      cue: { tags: ["手机震动", "消息"] },
      meta: { ...defaultMetaState(), selfControl: 0.82 },
      boundary: createPsychologicalBoundary({ capacity: 0.8, stressLoad: 0.1 }),
      topK: 1
    })[0];
    const pressured = activateProceduralMemory({
      routines: [routines[0] as ProceduralRoutine],
      cue: { tags: ["手机震动", "消息"] },
      meta: { ...defaultMetaState(), selfControl: 0.24 },
      boundary: createPsychologicalBoundary({ capacity: 0.45, stressLoad: 0.46 }),
      topK: 1
    })[0];

    expect(pressured?.automaticity).toBeGreaterThan(stable?.automaticity ?? 0);
    expect(pressured?.reasons).toContain("压力较高，角色更容易退回熟悉的自动行为。");
  });

  it("reinforces repeated routines and lets unused routines decay slowly", () => {
    const routine = routines[1] as ProceduralRoutine;
    const reinforced = reinforceProceduralRoutine({
      routine,
      success: 0.8,
      timestamp: 42
    });
    const decayed = decayProceduralRoutine(reinforced, 30);

    expect(reinforced.repetitionCount).toBe(routine.repetitionCount + 1);
    expect(reinforced.strength).toBeGreaterThan(routine.strength);
    expect(reinforced.lastTriggeredAt).toBe(42);
    expect(decayed.strength).toBeLessThan(reinforced.strength);
    expect(decayed.strength).toBeGreaterThan(0);
  });

  it("deduplicates cue tags and allows explicit zero activations", () => {
    const activations = activateProceduralMemory({
      routines: [
        {
          id: "routine_duplicate_cue",
          cueTags: ["消息", "消息", "失联"],
          action: "反复查看消息。",
          strength: 0.7,
          repetitionCount: 12
        }
      ],
      cue: { tags: ["消息"] },
      meta: defaultMetaState(),
      boundary: createPsychologicalBoundary({ stressLoad: 0.1 }),
      topK: 1
    });
    const none = activateProceduralMemory({
      routines,
      cue: { tags: ["手机震动", "消息"] },
      meta: defaultMetaState(),
      boundary: createPsychologicalBoundary({ stressLoad: 0.1 }),
      topK: 0
    });

    expect(activations[0]?.cueMatch).toBe(0.5);
    expect(none).toEqual([]);
  });
});
