import type { DesireState } from "../desire/desireState";
import { clamp01 } from "../parameters/parameterMath";
import type { PersonalityCoordinate } from "../personality/coordinate";

export interface BehaviorBias {
  id: string;
  tendency: string;
  likelihood: number;
  rationale: string;
}

export function deriveBehaviorBiases(params: {
  coordinate: PersonalityCoordinate;
  desires: DesireState[];
}): BehaviorBias[] {
  const { coordinate, desires } = params;
  const desirePressure = desires.reduce((sum, desire) => sum + desire.intensity, 0) / Math.max(1, desires.length);

  const biases: BehaviorBias[] = [
    {
      id: "behavior_controlled_questioning",
      tendency: "压住情绪，先追问原因。",
      likelihood: clamp01(0.1 + desirePressure * 0.35 + coordinate.values.control * 0.3 + coordinate.values.fear * 0.2),
      rationale: "高恐惧和控制需求会让人物先确认事实，但不一定直接爆发。"
    },
    {
      id: "behavior_cold_distance",
      tendency: "表现得克制、冷淡，避免暴露依赖。",
      likelihood: clamp01((1 - coordinate.values.trust) * 0.35 + coordinate.values.attachment * 0.25 + coordinate.values.fear * 0.2),
      rationale: "低信任与高依恋并存时，人物容易用冷淡保护自己。"
    },
    {
      id: "behavior_immediate_outburst",
      tendency: "立刻爆发质问。",
      likelihood: clamp01(coordinate.values.neuroticism * 0.25 + coordinate.values.fear * 0.2 - coordinate.values.control * 0.2),
      rationale: "情绪张力会推高爆发概率，但控制感会压低直接爆发。"
    },
    {
      id: "behavior_ignore",
      tendency: "完全无所谓地忽略这件事。",
      likelihood: clamp01((1 - coordinate.values.attachment) * 0.3 + coordinate.values.trust * 0.1 - coordinate.values.fear * 0.25),
      rationale: "高依恋和高恐惧会显著降低真正无所谓的可能性。"
    }
  ];

  return biases.sort((a, b) => b.likelihood - a.likelihood);
}
