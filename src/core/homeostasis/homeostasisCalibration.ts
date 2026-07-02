import type { HomeostasisTrace } from "./homeostasis";
import { round4 } from "../parameters/parameterMath";

export type HomeostasisHintSeverity = "info" | "watch" | "adjust";

export interface HomeostasisCalibrationHint {
  id: string;
  severity: HomeostasisHintSeverity;
  title: string;
  message: string;
  value: number;
}

export function buildHomeostasisCalibrationHints(
  trace: HomeostasisTrace
): HomeostasisCalibrationHint[] {
  const hints: HomeostasisCalibrationHint[] = [];
  const stressRecovery = round4(trace.before.stabilitySetPoint - trace.pressure);
  const boundaryStressDrop = round4(trace.regulatedBoundary.stressLoad);

  if (trace.pressure >= 0.45) {
    hints.push({
      id: "homeostasis_pressure_high",
      severity: trace.pressure >= 0.7 ? "adjust" : "watch",
      title: "稳态压力偏高",
      message: "系统明显偏离平衡，需要观察恢复速度、边界压力和奖励状态是否长期不回落。",
      value: trace.pressure
    });
  }

  if (trace.resistance >= 0.62) {
    hints.push({
      id: "change_resistance_high",
      severity: trace.resistance >= 0.78 ? "adjust" : "watch",
      title: "变化阻力偏高",
      message: "角色不会快速恢复或改变，短期事件不应被解释成人格重写。",
      value: trace.resistance
    });
  }

  if (trace.before.scarRetention >= 0.42) {
    hints.push({
      id: "scar_retention_high",
      severity: trace.before.scarRetention >= 0.65 ? "adjust" : "watch",
      title: "伤痕保留偏高",
      message: "恢复会保留更多历史影响，适合观察信念和边界是否形成长期新基线。",
      value: trace.before.scarRetention
    });
  }

  if (trace.regulatedBoundary.phase === "overflow") {
    hints.push({
      id: "boundary_still_overflowing",
      severity: "adjust",
      title: "边界仍在溢出",
      message: "稳态调节后心理边界仍未回到承压范围，后续事件应更容易触发防御反应。",
      value: boundaryStressDrop
    });
  }

  if (stressRecovery > 0.2 && trace.resistance < 0.45) {
    hints.push({
      id: "recovery_window_open",
      severity: "info",
      title: "恢复窗口打开",
      message: "当前压力低于稳定点且变化阻力不高，适合观察自然恢复与信念松动。",
      value: stressRecovery
    });
  }

  if (!hints.length) {
    hints.push({
      id: "homeostasis_balanced",
      severity: "info",
      title: "稳态接近平衡",
      message: "当前稳态层没有明显异常压力，可作为相对稳定状态观察。",
      value: 0
    });
  }

  return hints;
}
