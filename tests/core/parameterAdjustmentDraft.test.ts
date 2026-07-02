import { describe, expect, it } from "vitest";
import { buildParameterAdjustmentDraftTrace } from "../../src/core/parameters/parameterAdjustmentDraft";
import type { BaselineDriftTrace } from "../../src/core/parameters/baselineDrift";
import type { ParameterAccumulationTrace } from "../../src/core/parameters/parameterAccumulation";

describe("parameter adjustment draft", () => {
  it("does not generate drafts when accumulation buckets are not ready", () => {
    const trace = buildParameterAdjustmentDraftTrace({
      baselineDrift: baselineDriftTrace(),
      accumulation: accumulationTrace(0.4)
    });

    expect(trace.reviewRecommended).toBe(false);
    expect(trace.drafts).toHaveLength(0);
  });

  it("generates human review drafts when baseline candidates and accumulation align", () => {
    const trace = buildParameterAdjustmentDraftTrace({
      baselineDrift: baselineDriftTrace(),
      accumulation: accumulationTrace(1)
    });

    expect(trace.reviewRecommended).toBe(true);
    expect(trace.drafts).toHaveLength(1);
    expect(trace.drafts[0]?.target).toBe("baseline_boundary_integrity");
  });
});

function baselineDriftTrace(): BaselineDriftTrace {
  return {
    accumulatedDays: 180,
    repetitionCount: 5,
    eligible: true,
    candidates: [
      {
        id: "baseline_boundary_integrity",
        label: "心理边界完整度基线",
        currentBaseline: 1,
        observedValue: 0.5,
        suggestedBaseline: 0.98,
        direction: "down",
        pressure: 0.72,
        resistance: 0.4,
        reasons: ["边界修复长期受阻时，角色可能形成更低的边界完整度基线。"]
      }
    ],
    reasons: []
  };
}

function accumulationTrace(progress: number): ParameterAccumulationTrace {
  return {
    buckets: [
      {
        id: "boundary_pressure",
        label: "心理边界压力积累",
        accumulated: progress,
        threshold: 1,
        progress,
        readyForReview: progress >= 1,
        reasons: []
      }
    ],
    reviewCount: progress >= 1 ? 1 : 0,
    reasons: []
  };
}
