import type { NeedDeficiency } from "../need/needDeficiency";

export interface DesireState {
  id: string;
  content: string;
  intensity: number;
  sourceNeedId: string;
}

const desireByNeed: Record<string, string> = {
  need_security: "想确认对方是否仍然安全、仍然在关系中。",
  need_trust: "想获得解释和一致性证据，而不是只听安慰。",
  need_attachment: "想确认自己没有再次被抛下。",
  need_control: "想通过克制、询问或拉开距离重新获得控制感。"
};

export function deriveDesires(needs: NeedDeficiency[]): DesireState[] {
  return needs.map((need) => ({
    id: `desire_${need.id.replace(/^need_/, "")}`,
    content: desireByNeed[need.id] ?? "想降低当前内在张力。",
    intensity: need.intensity,
    sourceNeedId: need.id
  }));
}
