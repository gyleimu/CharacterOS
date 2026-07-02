"""Minimal Character Physics V1 demo."""

from __future__ import annotations

from physics_engine import CharacterPhysicsEngine, CharacterPhysicsState, ExperienceEvent
from personality.space import (
    BASE_PERSONALITY_DIMENSIONS,
    big_five_from_coordinate,
    lin_fan_initial_coordinate,
)


def main() -> None:
    """Run one event through the non-prompt physics engine."""

    coordinate = lin_fan_initial_coordinate()
    state = CharacterPhysicsState(
        coordinate=coordinate,
        personality=big_five_from_coordinate(coordinate),
        learning_rate=0.03,
    )
    event = ExperienceEvent(
        id="event_wangxue_no_reply",
        description="王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。",
        tags=["王雪", "失联", "等待", "亲密关系", "夜晚"],
        intensity=0.82,
        importance=0.86,
        relationship_weight=0.95,
        expectation_gap=0.78,
        personality_sensitivity=0.9,
    )

    result = CharacterPhysicsEngine().process_event(state, event)

    print("Character Physics V1 Demo")
    print("\nPersonality Coordinate System:")
    print(f"dimensions={[dimension.key for dimension in BASE_PERSONALITY_DIMENSIONS]}")
    print(f"lin_fan_initial_coordinate={coordinate.to_dict()}")
    print("\nEvent:")
    print(result.event.description)
    print("\nImpact:")
    print(
        f"score={result.impact_score.value}, "
        f"band={result.impact_score.band}, "
        f"description={result.impact_score.description}"
    )
    print("\nEmotion:")
    print(
        f"primary={result.emotion.primary}, "
        f"valence={result.emotion.valence}, "
        f"arousal={result.emotion.arousal}, "
        f"intensity={result.emotion.intensity}"
    )
    print("\nImpact Particle:")
    print(
        f"category={result.particle.category}, "
        f"coordinate_delta={result.particle.vector.delta.to_dict()}, "
        f"rationale={result.particle.vector.rationale}"
    )
    print("\nMemory Node:")
    print(
        f"id={result.memory_node.id}, "
        f"importance={result.memory_node.importance}, "
        f"emotion={result.memory_node.emotion}, "
        f"repetition={result.memory_node.repetition_count}, "
        f"cluster_id={result.memory_node.cluster_id}, "
        f"belief_effect={result.memory_node.belief_effect}"
    )
    print("\nImpact Cluster:")
    print(
        f"id={result.cluster.id}, mass={result.cluster.mass}, "
        f"density={result.cluster.density}, stability={result.cluster.stability}"
    )
    print(f"center_coordinate={result.cluster.center_coordinate.to_dict()}")
    print("\nPersonality Drift:")
    print(f"before={result.drift.before.to_dict()}")
    print(f"force={result.drift.total_force.to_dict()}")
    print(f"after={result.drift.after.to_dict()}")
    print("\nCoordinate Drift:")
    print(f"before={result.coordinate_drift.before.to_dict()}")
    print(f"force={result.coordinate_drift.total_force.to_dict()}")
    print(f"after={result.coordinate_drift.after.to_dict()}")


if __name__ == "__main__":
    main()
