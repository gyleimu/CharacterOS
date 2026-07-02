"""Full personality-coordinate drift for Character Physics."""

from __future__ import annotations

from dataclasses import dataclass

from cluster.impact_cluster import ImpactCluster
from personality.space import PersonalityCoordinate, zero_coordinate_delta


@dataclass(frozen=True)
class CoordinateDriftResult:
    """Result of one slow drift step in the full coordinate space."""

    before: PersonalityCoordinate
    after: PersonalityCoordinate
    total_force: PersonalityCoordinate
    learning_rate: float


def apply_coordinate_drift(
    coordinate: PersonalityCoordinate,
    clusters: list[ImpactCluster],
    learning_rate: float = 0.03,
) -> CoordinateDriftResult:
    """Move full personality coordinates slowly under cluster gravity."""

    force_values = zero_coordinate_delta().values

    for cluster in clusters:
        force_scale = cluster.mass * max(cluster.stability, 0.1)
        for key, value in cluster.center_coordinate.values.items():
            force_values[key] = force_values.get(key, 0.0) + value * force_scale

    total_force = PersonalityCoordinate(values=force_values)
    after = coordinate.add_delta(total_force.values, scale=learning_rate)

    return CoordinateDriftResult(
        before=coordinate,
        after=after,
        total_force=total_force,
        learning_rate=learning_rate,
    )
