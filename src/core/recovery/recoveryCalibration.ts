import type { RecoveryTrace } from "./recoveryTrace";

export type RecoveryHintSeverity = "info" | "watch" | "adjust";

export interface RecoveryCalibrationHint {
  id: string;
  severity: RecoveryHintSeverity;
  title: string;
  message: string;
  value: number;
}

export function buildRecoveryCalibrationHints(trace: RecoveryTrace): RecoveryCalibrationHint[] {
  const hints: RecoveryCalibrationHint[] = [];
  const blocked = trace.dimensions.filter((dimension) => dimension.blocked);
  const averageRecovered = trace.dimensions.reduce((sum, dimension) => (
    sum + dimension.recoveredAmount
  ), 0) / Math.max(1, trace.dimensions.length);

  if (trace.safetyFactor >= 0.62) {
    hints.push({
      id: "recovery_window_open",
      severity: "info",
      title: "恢复窗口打开",
      message: "安全因子较高，适合观察自然恢复、信念松动和边界修复。",
      value: trace.safetyFactor
    });
  }

  if (trace.obstacleFactor >= 0.48) {
    hints.push({
      id: "recovery_obstacle_high",
      severity: trace.obstacleFactor >= 0.7 ? "adjust" : "watch",
      title: "恢复阻碍偏高",
      message: "恢复可能被裂纹、创伤放大、渴求或持续压力拖慢。",
      value: trace.obstacleFactor
    });
  }

  if (blocked.length) {
    hints.push({
      id: "recovery_dimension_blocked",
      severity: "watch",
      title: "存在恢复阻塞",
      message: `${blocked.map((dimension) => dimension.label).join("、")} 慢于恢复曲线预期。`,
      value: blocked.length
    });
  }

  if (trace.scarRetention >= 0.5) {
    hints.push({
      id: "recovery_scar_retention_high",
      severity: "watch",
      title: "伤痕保留影响恢复",
      message: "恢复不会完全抹除历史，后续应观察新基线是否形成。",
      value: trace.scarRetention
    });
  }

  if (!hints.length) {
    hints.push({
      id: "recovery_expected",
      severity: "info",
      title: "恢复接近预期",
      message: "当前恢复轨迹接近模型预期，没有明显阻塞。",
      value: averageRecovered
    });
  }

  return hints;
}
