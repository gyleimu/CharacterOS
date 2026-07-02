export interface ImpactInputs {
  intensity: number;
  importance: number;
  relationshipWeight: number;
  expectationGap: number;
  personalitySensitivity: number;
}

export interface ImpactScore {
  value: number;
  band: ImpactBand;
  description: string;
}

export type ImpactBand =
  | "negligible"
  | "minor"
  | "normal"
  | "major"
  | "traumatic"
  | "life_changing";

export function calculateImpactScore(inputs: ImpactInputs): ImpactScore {
  const value =
    clip01(inputs.intensity) * 0.25 +
    clip01(inputs.importance) * 0.25 +
    clip01(inputs.relationshipWeight) * 0.2 +
    clip01(inputs.expectationGap) * 0.2 +
    clip01(inputs.personalitySensitivity) * 0.1;
  return impactScore(Math.round(clip01(value) * 1000) / 1000);
}

export function impactScore(value: number): ImpactScore {
  const clipped = clip01(value);
  const [band, description] = classifyImpact(clipped);
  return { value: clipped, band, description };
}

export function classifyImpact(value: number): [ImpactBand, string] {
  const clipped = clip01(value);
  if (clipped <= 0.05) return ["negligible", "几乎无影响"];
  if (clipped <= 0.15) return ["minor", "轻微影响"];
  if (clipped <= 0.3) return ["normal", "普通影响"];
  if (clipped <= 0.5) return ["major", "重大影响"];
  if (clipped <= 0.8) return ["traumatic", "创伤级"];
  return ["life_changing", "改变人生轨迹"];
}

function clip01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
