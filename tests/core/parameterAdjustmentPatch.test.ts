import { describe, expect, it } from "vitest";
import { buildParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import type { ParameterAdjustmentAuditTrace } from "../../src/core/parameters/parameterAdjustmentAudit";
import type { ParameterAdjustmentPreviewTrace } from "../../src/core/parameters/parameterAdjustmentPreview";

describe("parameter adjustment patch", () => {
  it("generates patch operations only after approved audit", () => {
    const patch = buildParameterAdjustmentPatchTrace({
      preview: previewTrace(),
      audit: auditTrace("approved")
    });

    expect(patch.status).toBe("ready");
    expect(patch.operations).toHaveLength(1);
    expect(patch.operations[0]?.path).toBe("metaState.selfControl");
  });

  it("holds patch operations when manual review is required", () => {
    const patch = buildParameterAdjustmentPatchTrace({
      preview: previewTrace(),
      audit: auditTrace("needs_review")
    });

    expect(patch.status).toBe("held_for_review");
    expect(patch.operations).toHaveLength(0);
  });

  it("rejects patch operations after failed audit", () => {
    const patch = buildParameterAdjustmentPatchTrace({
      preview: previewTrace(),
      audit: auditTrace("rejected")
    });

    expect(patch.status).toBe("rejected");
    expect(patch.operations).toHaveLength(0);
  });
});

function previewTrace(): ParameterAdjustmentPreviewTrace {
  return {
    applyBlocked: false,
    items: [
      {
        id: "preview_adjust_baseline_self_control",
        draftId: "adjust_baseline_self_control",
        targetPath: "metaState.selfControl",
        label: "自控力",
        currentValue: 0.52,
        draftSuggestedValue: 0.49,
        previewValue: 0.5,
        cappedDelta: -0.02,
        risk: "medium",
        status: "safe_preview",
        reasons: []
      }
    ],
    reasons: []
  };
}

function auditTrace(status: "approved" | "needs_review" | "rejected"): ParameterAdjustmentAuditTrace {
  return {
    status,
    itemCount: 1,
    totalAbsoluteDelta: 0.02,
    maxSingleDelta: 0.02,
    issues: [],
    reasons: []
  };
}
