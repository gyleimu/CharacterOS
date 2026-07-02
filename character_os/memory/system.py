"""Memory generation system for Character Physics."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from benchmark.impact import ImpactScore
from cluster.impact_cluster import ImpactParticle
from emotion.model import EmotionState
from memory.node import MemoryNode

if TYPE_CHECKING:
    from physics_engine import ExperienceEvent


def create_memory_node(
    event: "ExperienceEvent",
    particle: ImpactParticle,
    impact_score: ImpactScore,
    emotion: EmotionState,
    cluster_id: str,
    repetition_count: int,
    time_stamp: str | None = None,
) -> MemoryNode:
    """Create a memory node from one processed event."""

    return MemoryNode(
        id=f"memory_{event.id}",
        content=event.description,
        vector=particle.vector.delta,
        importance=impact_score.value,
        emotion=emotion.primary,
        recency=1.0,
        repetition_count=repetition_count,
        belief_effect=_belief_effect_for_category(particle.category),
        time_stamp=time_stamp or datetime.now().isoformat(timespec="seconds"),
        cluster_id=cluster_id,
    )


def _belief_effect_for_category(category: str) -> str:
    """Describe the first-order belief pressure created by a memory."""

    if category == "abandonment":
        return "重要的人可能会突然离开"
    if category == "betrayal":
        return "信任他人可能带来伤害"
    if category == "success":
        return "努力和表达可能带来正向结果"
    return "这段经历需要被继续解释"
