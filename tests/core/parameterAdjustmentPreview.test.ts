import { describe, expect, it } from "vitest";
import { buildParameterAdjustmentPreviewTrace } from "../../src/core/parameters/parameterAdjustmentPreview";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import type { ParameterAdjustmentDraftTrace } from "../../src/core/parameters/parameterAdjustmentDraft";

describe("parameter adjustment preview", () => {
  it("creates capped non-mutating previews for adjustment drafts", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const preview = buildParameterAdjustmentPreviewTrace({
      state,
      drafts: draftTrace({
        target: "baseline_self_control",
        suggestedValue: 0.1,
        risk: "medium"
      }),
      maxDelta: 0.025
    });

    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]?.targetPath).toBe("metaState.selfControl");
    expect(preview.items[0]?.cappedDelta).toBe(-0.025);
    expect(state.metaState.selfControl).toBe(before);
  });

  it("marks high risk previews for manual review", () => {
    const state = createCharacterPhysicsState();
    const preview = buildParameterAdjustmentPreviewTrace({
      state,
      drafts: draftTrace({
        target: "baseline_boundary_integrity",
        suggestedValue: 0.1,
        risk: "high"
      })
    });

    expect(preview.applyBlocked).toBe(true);
    expect(preview.items[0]?.status).toBe("manual_review");
  });
});

function draftTrace(params: {
  target: string;
  suggestedValue: number;
  risk: "low" | "medium" | "high";
}): ParameterAdjustmentDraftTrace {
  return {
    reviewRecommended: true,
    drafts: [
      {
        id: `adjust_${params.target}`,
        target: params.target,
        label: "测试草案",
        currentValue: 0.5,
        suggestedValue: params.suggestedValue,
        confidence: 0.7,
        risk: params.risk,
        reasons: []
      }
    ],
    reasons: []
  };
}
