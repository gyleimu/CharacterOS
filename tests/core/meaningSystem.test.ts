import { describe, expect, it } from "vitest";
import type { BeliefState } from "../../src/core/belief/beliefState";
import { deriveMeaningState } from "../../src/core/meaning/meaningSystem";
import type { NeedDeficiency } from "../../src/core/need/needDeficiency";
import { linFanInitialCoordinate, neutralCoordinate } from "../../src/core/personality/coordinate";
import { defaultRewardState } from "../../src/core/reward/rewardSystem";

describe("MeaningSystem", () => {
  it("derives meaning anchors that can override immediate reward seeking", () => {
    const beliefs: BeliefState[] = [
      {
        id: "belief_abandonment",
        content: "重要的人可能会突然离开",
        strength: 0.82,
        evidenceCount: 3,
        sourceMemoryIds: ["memory_1"]
      }
    ];
    const needs: NeedDeficiency[] = [
      {
        id: "need_attachment",
        name: "依恋确认缺失",
        intensity: 0.82,
        reason: "高依恋和等待经历。"
      },
      {
        id: "need_trust",
        name: "信任缺失",
        intensity: 0.74,
        reason: "需要解释。"
      }
    ];
    const meaning = deriveMeaningState({
      coordinate: linFanInitialCoordinate(),
      beliefs,
      needs,
      desires: [
        {
          id: "desire_attachment",
          content: "想确认自己没有再次被抛下。",
          intensity: 0.82,
          sourceNeedId: "need_attachment"
        },
        {
          id: "desire_trust",
          content: "想获得解释和一致性证据，而不是只听安慰。",
          intensity: 0.74,
          sourceNeedId: "need_trust"
        }
      ],
      reward: { ...defaultRewardState(), craving: 0.2 }
    });

    expect(meaning.anchors.length).toBeGreaterThan(1);
    expect(meaning.dominantAnchor?.kind).toBe("relationship");
    expect(meaning.meaningIntensity).toBeGreaterThan(0.45);
    expect(meaning.rewardOverride).toBeGreaterThan(0.25);
    expect(meaning.reasons[0]).toContain("主导意义锚点");
  });

  it("can represent low-clarity existence when anchors are weak", () => {
    const meaning = deriveMeaningState({
      coordinate: neutralCoordinate(),
      beliefs: [],
      needs: [],
      desires: [],
      reward: { ...defaultRewardState(), craving: 0.7 }
    });

    expect(meaning.anchors.length).toBeLessThanOrEqual(2);
    expect(meaning.existentialClarity).toBeLessThan(0.35);
    expect(meaning.reasons).toContain("意义感较低，角色可能处于迷茫或只是维持生活。");
  });
});
