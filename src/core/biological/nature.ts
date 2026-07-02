import { clamp01 } from "../parameters/parameterMath";

export interface BiologicalNature {
  survival: number;
  selfPreservation: number;
  selfInterest: number;
  reproduction: number;
  attachment: number;
  belonging: number;
  statusSeeking: number;
  control: number;
  curiosity: number;
  imagination: number;
  painAvoidance: number;
  rewardSeeking: number;
}

export function defaultBiologicalNature(): BiologicalNature {
  return {
    survival: 0.86,
    selfPreservation: 0.78,
    selfInterest: 0.58,
    reproduction: 0.45,
    attachment: 0.68,
    belonging: 0.62,
    statusSeeking: 0.5,
    control: 0.56,
    curiosity: 0.54,
    imagination: 0.58,
    painAvoidance: 0.74,
    rewardSeeking: 0.56
  };
}

export function linFanBiologicalNature(): BiologicalNature {
  return {
    ...defaultBiologicalNature(),
    attachment: 0.86,
    belonging: 0.76,
    control: 0.68,
    imagination: 0.72,
    painAvoidance: 0.82,
    rewardSeeking: 0.46
  };
}

export function biologicalStressSensitivity(nature: BiologicalNature): number {
  return clamp01(
    nature.survival * 0.18 +
    nature.selfPreservation * 0.18 +
    nature.attachment * 0.18 +
    nature.belonging * 0.12 +
    nature.control * 0.12 +
    nature.painAvoidance * 0.22
  );
}
