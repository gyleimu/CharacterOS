import type { ImpactScore } from "../benchmark/impact";
import type { ImpactParticle } from "../cluster/impactCluster";
import type { EmotionState } from "../emotion/emotion";
import { getEventCategoryPhysics } from "../event/categoryPhysics";
import type { ExperienceEvent } from "../event/event";
import type { MemoryNode } from "./memoryNode";

export function createMemoryNode(params: {
  event: ExperienceEvent;
  particle: ImpactParticle;
  impactScore: ImpactScore;
  emotion: EmotionState;
  clusterId: string;
  repetitionCount: number;
  timeStamp?: string;
}): MemoryNode {
  return {
    id: `memory_${params.event.id}`,
    content: params.event.description,
    vector: params.particle.vector.delta,
    importance: params.impactScore.value,
    emotion: params.emotion.primary,
    recency: 1,
    repetitionCount: params.repetitionCount,
    beliefEffect: params.event.beliefEffect ?? beliefEffectForCategory(params.particle.category),
    timeStamp: params.timeStamp ?? new Date().toISOString(),
    clusterId: params.clusterId
  };
}

function beliefEffectForCategory(category: string): string {
  return getEventCategoryPhysics(category)?.beliefEffect ?? "这段经历需要被继续解释";
}
