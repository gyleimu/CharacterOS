import type { ParameterNetworkTrace } from "./parameterNetwork";
import { round4 } from "./parameterMath";

export type ParameterNetworkHintSeverity = "info" | "watch" | "adjust";

export interface ParameterNetworkCalibrationHint {
  id: string;
  severity: ParameterNetworkHintSeverity;
  title: string;
  message: string;
  value: number;
}

export function buildParameterNetworkCalibrationHints(
  trace: ParameterNetworkTrace
): ParameterNetworkCalibrationHint[] {
  const hints: ParameterNetworkCalibrationHint[] = [];
  const selfControlDrop = round4(trace.before.selfControl - trace.after.selfControl);
  const boundaryDrop = round4(trace.before.boundaryIntegrity - trace.after.boundaryIntegrity);
  const emotionRise = round4(trace.after.emotionalAmplification - trace.before.emotionalAmplification);
  const actionNoiseRise = round4(trace.after.actionNoise - trace.before.actionNoise);

  if (trace.after.actionNoise >= 0.58 || actionNoiseRise >= 0.08) {
    hints.push({
      id: "action_noise_high",
      severity: trace.after.actionNoise >= 0.72 ? "adjust" : "watch",
      title: "行动噪声明显",
      message: "意图到行为的转译可能不稳定，适合观察 fatigue、sleepDebt 和 stress 是否过高。",
      value: trace.after.actionNoise
    });
  }

  if (selfControlDrop >= 0.06) {
    hints.push({
      id: "self_control_drop",
      severity: selfControlDrop >= 0.12 ? "adjust" : "watch",
      title: "自控力下滑",
      message: "自控力在本次网络传播中明显下降，疲劳和睡眠债可能正在放大行为误差。",
      value: selfControlDrop
    });
  }

  if (boundaryDrop >= 0.04) {
    hints.push({
      id: "boundary_integrity_drop",
      severity: boundaryDrop >= 0.1 ? "adjust" : "watch",
      title: "边界变薄",
      message: "心理边界完整度被压力牵引下行，后续事件更容易伤到角色。",
      value: boundaryDrop
    });
  }

  if (emotionRise >= 0.05) {
    hints.push({
      id: "emotion_amplification_rise",
      severity: emotionRise >= 0.12 ? "adjust" : "watch",
      title: "情绪放大增强",
      message: "角色对外界刺激的主观放大正在增强，同样事件可能被体验得更重。",
      value: emotionRise
    });
  }

  if (trace.after.recoveryCapacity <= 0.28) {
    hints.push({
      id: "recovery_capacity_low",
      severity: "adjust",
      title: "恢复容量偏低",
      message: "恢复容量很低，连续 tick 中应该重点观察 homeostasis 和 recovery 是否过慢。",
      value: trace.after.recoveryCapacity
    });
  }

  if (!hints.length) {
    hints.push({
      id: "network_stable",
      severity: "info",
      title: "网络接近平衡",
      message: "当前参数网络没有明显异常牵引，可以作为相对稳定状态观察。",
      value: 0
    });
  }

  return hints;
}
