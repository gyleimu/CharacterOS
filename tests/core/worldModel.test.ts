import { describe, expect, it } from "vitest";
import type { BeliefState } from "../../src/core/belief/beliefState";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState, linFanMetaState } from "../../src/core/meta/metaState";
import { linFanInitialCoordinate, neutralCoordinate } from "../../src/core/personality/coordinate";
import { interpretEvent } from "../../src/core/worldmodel/worldModel";

const abandonmentBelief: BeliefState = {
  id: "belief_abandonment",
  content: "重要的人可能会突然离开",
  strength: 0.82,
  evidenceCount: 3,
  sourceMemoryIds: ["memory_1"]
};

describe("WorldModel", () => {
  it("interprets ambiguous waiting through a rejection frame for Lin Fan", () => {
    const interpretation = interpretEvent({
      event: {
        id: "event_waiting",
        description: "王雪三天没有回复林凡。",
        tags: ["王雪", "失联", "等待", "亲密关系"],
        intensity: 0.86,
        importance: 0.9,
        relationshipWeight: 0.95,
        expectationGap: 0.88,
        personalitySensitivity: 0.9
      },
      emotion: { primary: "fear", valence: -0.8, arousal: 0.8, intensity: 0.86 },
      beliefs: [abandonmentBelief],
      coordinate: linFanInitialCoordinate(),
      meta: linFanMetaState(),
      boundary: createPsychologicalBoundary({ capacity: 0.45, stressLoad: 0.42 }),
      timePerception: {
        objectiveDuration: 3,
        subjectiveDuration: 5.6,
        multiplier: 1.86,
        mode: "stretched",
        waitingLoad: 0.8,
        lonelinessLoad: 0.6,
        absorptionLoad: 0,
        distressLoad: 0.8,
        reasons: ["等待感拉长了主观时间。"]
      }
    });

    expect(interpretation.frame).toBe("rejection");
    expect(interpretation.subjectiveReality).toContain("又一次被放在原地等待");
    expect(interpretation.distortionLevel).toBeGreaterThan(0.35);
    expect(interpretation.evidence).toContain("事件标签包含失联/等待。");
    expect(interpretation.alternatives).toContain("失联可能有外部原因");
  });

  it("can interpret explanation and support as repair when trust evidence is available", () => {
    const interpretation = interpretEvent({
      event: {
        id: "event_repair",
        description: "王雪解释了失联原因并陪伴林凡。",
        tags: ["王雪", "解释", "陪伴", "亲密关系"],
        intensity: 0.7,
        importance: 0.78,
        relationshipWeight: 0.9,
        expectationGap: 0.3,
        personalitySensitivity: 0.65
      },
      emotion: { primary: "relief", valence: 0.7, arousal: 0.4, intensity: 0.7 },
      beliefs: [{ ...abandonmentBelief, strength: 0.25 }],
      coordinate: { ...neutralCoordinate(), values: { ...neutralCoordinate().values, trust: 0.68, agreeableness: 0.7 } },
      meta: { ...defaultMetaState(), resilience: 0.72 },
      boundary: createPsychologicalBoundary({ stressLoad: 0.08, integrity: 0.96 }),
      timePerception: {
        objectiveDuration: 1,
        subjectiveDuration: 0.8,
        multiplier: 0.8,
        mode: "compressed",
        waitingLoad: 0,
        lonelinessLoad: 0,
        absorptionLoad: 0.5,
        distressLoad: 0.1,
        reasons: []
      }
    });

    expect(interpretation.frame).toBe("repair");
    expect(interpretation.trustBias).toBeGreaterThan(interpretation.threatBias);
    expect(interpretation.subjectiveReality).toContain("关系修复");
  });
});
