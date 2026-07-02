import { describe, expect, it } from "vitest";
import { auditParameterAdjustmentPreview } from "../../src/core/parameters/parameterAdjustmentAudit";
import type { ParameterAdjustmentPreviewTrace } from "../../src/core/parameters/parameterAdjustmentPreview";

describe("parameter adjustment audit", () => {
  it("approves low-risk capped previews while keeping them non-applied", () => {
    const audit = auditParameterAdjustmentPreview({
      preview: previewTrace({
        status: "safe_preview",
        cappedDelta: 0.02
      })
    });

    expect(audit.status).toBe("approved");
    expect(audit.totalAbsoluteDelta).toBe(0.02);
  });

  it("requires review for high-risk manual preview items", () => {
    const audit = auditParameterAdjustmentPreview({
      preview: previewTrace({
        status: "manual_review",
        cappedDelta: 0.02
      })
    });

    expect(audit.status).toBe("needs_review");
    expect(audit.issues.some((issue) => issue.id === "manual_review_required")).toBe(true);
  });

  it("rejects blocked preview items", () => {
    const audit = auditParameterAdjustmentPreview({
      preview: previewTrace({
        status: "blocked",
        cappedDelta: 0
      })
    });

    expect(audit.status).toBe("rejected");
    expect(audit.issues.some((issue) => issue.id === "blocked_preview_item")).toBe(true);
  });
});

function previewTrace(params: {
  status: "safe_preview" | "manual_review" | "blocked";
  cappedDelta: number;
}): ParameterAdjustmentPreviewTrace {
  return {
    applyBlocked: params.status !== "safe_preview",
    items: [
      {
        id: "preview_adjust_baseline_self_control",
        draftId: "adjust_baseline_self_control",
        targetPath: "metaState.selfControl",
        label: "自控力",
        currentValue: 0.5,
        draftSuggestedValue: 0.4,
        previewValue: 0.5 + params.cappedDelta,
        cappedDelta: params.cappedDelta,
        risk: params.status === "manual_review" ? "high" : "medium",
        status: params.status,
        reasons: []
      }
    ],
    reasons: []
  };
}
