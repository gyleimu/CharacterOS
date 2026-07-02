import type { ParameterAdjustmentPreviewTrace } from "./parameterAdjustmentPreview";
import { round4 } from "./parameterMath";

export type ParameterAdjustmentAuditStatus = "approved" | "needs_review" | "rejected";

export interface ParameterAdjustmentAuditIssue {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ParameterAdjustmentAuditTrace {
  status: ParameterAdjustmentAuditStatus;
  itemCount: number;
  totalAbsoluteDelta: number;
  maxSingleDelta: number;
  issues: ParameterAdjustmentAuditIssue[];
  reasons: string[];
}

export function auditParameterAdjustmentPreview(params: {
  preview: ParameterAdjustmentPreviewTrace;
  maxTotalDelta?: number;
  maxSingleDelta?: number;
}): ParameterAdjustmentAuditTrace {
  const maxTotalDelta = Math.max(0, params.maxTotalDelta ?? 0.08);
  const maxSingleDelta = Math.max(0, params.maxSingleDelta ?? 0.035);
  const totalAbsoluteDelta = round4(
    params.preview.items.reduce((sum, item) => sum + Math.abs(item.cappedDelta), 0)
  );
  const largestSingleDelta = round4(
    params.preview.items.reduce((largest, item) => Math.max(largest, Math.abs(item.cappedDelta)), 0)
  );
  const issues: ParameterAdjustmentAuditIssue[] = [];

  if (!params.preview.items.length) {
    issues.push({
      id: "no_preview_items",
      severity: "info",
      message: "没有可审计的调整预览项。"
    });
  }

  if (params.preview.items.some((item) => item.status === "blocked")) {
    issues.push({
      id: "blocked_preview_item",
      severity: "error",
      message: "存在缺少安全映射的预览项。"
    });
  }

  if (params.preview.items.some((item) => item.status === "manual_review")) {
    issues.push({
      id: "manual_review_required",
      severity: "warning",
      message: "存在需要人工复核的高风险预览项。"
    });
  }

  if (largestSingleDelta > maxSingleDelta) {
    issues.push({
      id: "single_delta_too_large",
      severity: "error",
      message: "单项调整步长超过审计限制。"
    });
  }

  if (totalAbsoluteDelta > maxTotalDelta) {
    issues.push({
      id: "total_delta_too_large",
      severity: "warning",
      message: "总调整幅度较大，应拆分为多次观察。"
    });
  }

  for (const targetPath of duplicateTargets(params.preview.items.map((item) => item.targetPath))) {
    issues.push({
      id: `duplicate_target_${targetPath}`,
      severity: "warning",
      message: `同一目标 ${targetPath} 出现多个预览项。`
    });
  }

  const status = statusFromIssues(issues);

  return {
    status,
    itemCount: params.preview.items.length,
    totalAbsoluteDelta,
    maxSingleDelta: largestSingleDelta,
    issues,
    reasons: buildReasons(status, issues)
  };
}

function duplicateTargets(targets: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const target of targets) {
    if (seen.has(target)) duplicates.add(target);
    seen.add(target);
  }
  return [...duplicates];
}

function statusFromIssues(issues: ParameterAdjustmentAuditIssue[]): ParameterAdjustmentAuditStatus {
  if (issues.some((issue) => issue.severity === "error")) return "rejected";
  if (issues.some((issue) => issue.severity === "warning")) return "needs_review";
  return "approved";
}

function buildReasons(
  status: ParameterAdjustmentAuditStatus,
  issues: ParameterAdjustmentAuditIssue[]
): string[] {
  if (status === "approved") {
    return ["adjustment preview passed audit, but still requires explicit human decision to apply"];
  }
  if (status === "needs_review") {
    return ["adjustment preview needs human review before any application"];
  }
  return ["adjustment preview rejected by safety audit"];
}
