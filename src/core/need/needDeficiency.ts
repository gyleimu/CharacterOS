import type { BeliefState } from "../belief/beliefState";
import type { ImpactCluster } from "../cluster/impactCluster";
import { clamp01 } from "../parameters/parameterMath";
import type { PersonalityCoordinate } from "../personality/coordinate";

export interface NeedDeficiency {
  id: string;
  name: string;
  intensity: number;
  reason: string;
}

export function deriveNeedDeficiencies(params: {
  coordinate: PersonalityCoordinate;
  beliefs: BeliefState[];
  clusters: ImpactCluster[];
}): NeedDeficiency[] {
  const { coordinate, beliefs, clusters } = params;
  const abandonment = clusters.find((cluster) => cluster.category === "abandonment");
  const support = clusters.find((cluster) => cluster.category === "support");
  const betrayal = clusters.find((cluster) => cluster.category === "betrayal");
  const strongestBelief = beliefs[0];

  const needs: NeedDeficiency[] = [
    {
      id: "need_security",
      name: "安全感缺失",
      intensity: clamp01(coordinate.values.fear * 0.45 + (abandonment?.stability ?? 0) * 0.35 + (strongestBelief?.strength ?? 0) * 0.2),
      reason: "恐惧水平、抛弃星团和核心信念共同提高安全感缺失。"
    },
    {
      id: "need_trust",
      name: "信任缺失",
      intensity: clamp01((1 - coordinate.values.trust) * 0.55 + (betrayal?.stability ?? 0) * 0.25 + (abandonment?.stability ?? 0) * 0.2),
      reason: "低信任坐标与失联/背叛经历会削弱亲密关系中的信任。"
    },
    {
      id: "need_attachment",
      name: "依恋确认缺失",
      intensity: clamp01(coordinate.values.attachment * 0.45 + (abandonment?.mass ?? 0) * 0.08 - (support?.stability ?? 0) * 0.2),
      reason: "高依恋与重复失联经历会强化对关系确认的需求。"
    },
    {
      id: "need_control",
      name: "控制感缺失",
      intensity: clamp01(coordinate.values.control * 0.35 + coordinate.values.fear * 0.25 + (abandonment?.stability ?? 0) * 0.2),
      reason: "当不确定性和恐惧升高时，人物会更想重新获得控制感。"
    }
  ];

  return needs
    .filter((need) => need.intensity >= 0.15)
    .sort((a, b) => b.intensity - a.intensity);
}
