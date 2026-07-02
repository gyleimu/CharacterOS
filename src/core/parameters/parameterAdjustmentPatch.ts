import type { ParameterAdjustmentAuditTrace } from "./parameterAdjustmentAudit";
import type { ParameterAdjustmentPreviewTrace } from "./parameterAdjustmentPreview";

export type ParameterAdjustmentPatchStatus = "ready" | "held_for_review" | "rejected" | "empty";

export interface ParameterAdjustmentPatchOperation {
  op: "replace";
  path: string;
  from: number;
  value: number;
  reason: string;
}

export interface ParameterAdjustmentPatchTrace {
  status: ParameterAdjustmentPatchStatus;
  operations: ParameterAdjustmentPatchOperation[];
  reasons: string[];
}

export function buildParameterAdjustmentPatchTrace(params: {
  preview: ParameterAdjustmentPreviewTrace;
  audit: ParameterAdjustmentAuditTrace;
}): ParameterAdjustmentPatchTrace {
  if (!params.preview.items.length) {
    return {
      status: "empty",
      operations: [],
      reasons: ["no patch generated because there are no preview items"]
    };
  }

  if (params.audit.status === "rejected") {
    return {
      status: "rejected",
      operations: [],
      reasons: ["patch generation rejected by adjustment audit"]
    };
  }

  if (params.audit.status === "needs_review") {
    return {
      status: "held_for_review",
      operations: [],
      reasons: ["patch held because manual review is required"]
    };
  }

  return {
    status: "ready",
    operations: params.preview.items.map((item) => ({
      op: "replace",
      path: item.targetPath,
      from: item.currentValue,
      value: item.previewValue,
      reason: `Apply capped preview for ${item.label}.`
    })),
    reasons: [
      "patch operations generated from approved preview",
      "patch is not applied automatically"
    ]
  };
}
