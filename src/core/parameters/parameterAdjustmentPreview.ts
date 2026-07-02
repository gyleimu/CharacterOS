import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { ParameterAdjustmentDraftTrace, ParameterAdjustmentRisk } from "./parameterAdjustmentDraft";
import { clamp01, round4 } from "./parameterMath";

export type ParameterAdjustmentPreviewStatus = "safe_preview" | "manual_review" | "blocked";

export interface ParameterAdjustmentPreviewItem {
  id: string;
  draftId: string;
  targetPath: string;
  label: string;
  currentValue: number;
  draftSuggestedValue: number;
  previewValue: number;
  cappedDelta: number;
  risk: ParameterAdjustmentRisk;
  status: ParameterAdjustmentPreviewStatus;
  reasons: string[];
}

export interface ParameterAdjustmentPreviewTrace {
  items: ParameterAdjustmentPreviewItem[];
  applyBlocked: boolean;
  reasons: string[];
}

export function buildParameterAdjustmentPreviewTrace(params: {
  state: CharacterPhysicsState;
  drafts: ParameterAdjustmentDraftTrace;
  maxDelta?: number;
}): ParameterAdjustmentPreviewTrace {
  const maxDelta = Math.max(0, Math.min(0.08, params.maxDelta ?? 0.025));
  const items = params.drafts.drafts.map((draft) => {
    const target = targetForDraft(params.state, draft.target);
    if (!target) {
      return {
        id: `preview_${draft.id}`,
        draftId: draft.id,
        targetPath: draft.target,
        label: draft.label,
        currentValue: draft.currentValue,
        draftSuggestedValue: draft.suggestedValue,
        previewValue: draft.currentValue,
        cappedDelta: 0,
        risk: draft.risk,
        status: "blocked" as const,
        reasons: ["当前状态结构中没有可安全映射的目标字段。"]
      };
    }

    const delta = clampDelta(draft.suggestedValue - target.currentValue, maxDelta);
    const previewValue = round4(clamp01(target.currentValue + delta));
    return {
      id: `preview_${draft.id}`,
      draftId: draft.id,
      targetPath: target.path,
      label: target.label,
      currentValue: target.currentValue,
      draftSuggestedValue: draft.suggestedValue,
      previewValue,
      cappedDelta: round4(delta),
      risk: draft.risk,
      status: draft.risk === "high" ? "manual_review" as const : "safe_preview" as const,
      reasons: [
        "这是受步长限制的预览值，不会自动写入角色状态。",
        `单次最大调整步长限制为 ${maxDelta.toFixed(3)}。`
      ]
    };
  });

  return {
    items,
    applyBlocked: items.some((item) => item.status === "blocked") || items.some((item) => item.status === "manual_review"),
    reasons: buildReasons(items)
  };
}

function targetForDraft(
  state: CharacterPhysicsState,
  target: string
): { path: string; label: string; currentValue: number } | undefined {
  const targets: Record<string, { path: string; label: string; currentValue: number }> = {
    baseline_self_control: {
      path: "metaState.selfControl",
      label: "自控力",
      currentValue: state.metaState.selfControl
    },
    baseline_boundary_integrity: {
      path: "boundary.integrity",
      label: "心理边界完整度",
      currentValue: state.boundary.integrity
    },
    baseline_emotional_amplification: {
      path: "metaState.emotionalSensitivity",
      label: "情绪敏感度",
      currentValue: state.metaState.emotionalSensitivity
    },
    baseline_craving: {
      path: "rewardState.craving",
      label: "渴求",
      currentValue: state.rewardState.craving
    }
  };
  return targets[target];
}

function clampDelta(delta: number, maxDelta: number): number {
  if (delta > maxDelta) return maxDelta;
  if (delta < -maxDelta) return -maxDelta;
  return delta;
}

function buildReasons(items: ParameterAdjustmentPreviewItem[]): string[] {
  if (!items.length) return ["no adjustment preview generated"];
  const reasons = ["adjustment preview generated without mutating character state"];
  if (items.some((item) => item.status === "manual_review")) {
    reasons.push("one or more preview items require manual review because risk is high");
  }
  if (items.some((item) => item.status === "blocked")) {
    reasons.push("one or more preview items are blocked because no safe target mapping exists");
  }
  return reasons;
}
