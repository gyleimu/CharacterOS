/**
 * Future interface: calibration hints for baseline drift.
 *
 * Currently only exercised in tests. Not yet wired into the API
 * calibration route or replay dashboard. When the calibration report
 * endpoint is expanded, these hints should be included so operators
 * can review whether a character's baselines are drifting too fast
 * or too slow relative to lived experience.
 */
import type { BaselineDriftTrace } from "./baselineDrift";

export interface BaselineDriftCalibrationHint {
  id: string;
  severity: "info" | "watch" | "adjust";
  title: string;
  message: string;
  value: number;
}

export function buildBaselineDriftCalibrationHints(
  trace: BaselineDriftTrace
): BaselineDriftCalibrationHint[] {
  if (!trace.eligible) {
    return [
      {
        id: "baseline_drift_not_ready",
        severity: "info",
        title: "基线漂移仍在等待证据",
        message: "当前持续时间或重复次数不足，不应根据短期波动调整角色基线。",
        value: Math.max(trace.accumulatedDays / 90, trace.repetitionCount / 3)
      }
    ];
  }

  if (!trace.candidates.length) {
    return [
      {
        id: "baseline_drift_no_candidate",
        severity: "info",
        title: "暂无基线漂移候选",
        message: "观察窗口已开启，但当前压力、阻力和恢复迹象还不足以提示基线变化。",
        value: 0
      }
    ];
  }

  return trace.candidates.slice(0, 4).map((candidate) => ({
    id: `baseline_drift_${candidate.id}`,
    severity: candidate.pressure >= 0.62 ? "adjust" : "watch",
    title: `${candidate.label}${candidate.direction === "up" ? "可能上移" : "可能下移"}`,
    message:
      candidate.pressure >= 0.62
        ? "这是较强的长期漂移候选，适合人工检查是否需要调整角色基线或继续收集样本。"
        : "这是轻中度漂移候选，建议继续观察，不要立刻写入角色基线。",
    value: candidate.pressure
  }));
}
