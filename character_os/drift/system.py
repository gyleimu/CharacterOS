"""Personality drift system for Character Physics V1."""

from __future__ import annotations

from dataclasses import dataclass

from cluster.impact_cluster import ImpactCluster
from personality.vector import PersonalityVector, zero_personality_delta


@dataclass(frozen=True)
class DriftResult:
    """Result of one personality drift step."""

    before: PersonalityVector
    after: PersonalityVector
    total_force: PersonalityVector
    learning_rate: float


def apply_personality_drift(
    personality: PersonalityVector,
    clusters: list[ImpactCluster],
    learning_rate: float = 0.03,
) -> DriftResult:
    """Move personality slowly under cluster gravity."""

    total_force = zero_personality_delta()

    for cluster in clusters:
        force_scale = cluster.mass * max(cluster.stability, 0.1)
        total_force = PersonalityVector(
            openness=total_force.openness + cluster.center_vector.openness * force_scale,
            conscientiousness=(
                total_force.conscientiousness
                + cluster.center_vector.conscientiousness * force_scale
            ),
            extroversion=total_force.extroversion + cluster.center_vector.extroversion * force_scale,
            agreeableness=total_force.agreeableness + cluster.center_vector.agreeableness * force_scale,
            neuroticism=total_force.neuroticism + cluster.center_vector.neuroticism * force_scale,
        )

    after = personality.add_scaled(total_force, learning_rate)
    return DriftResult(
        before=personality,
        after=after,
        total_force=total_force,
        learning_rate=learning_rate,
    )
