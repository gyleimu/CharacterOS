"""Repeated-event simulation demo for Character Physics."""

from __future__ import annotations

from personality.space import big_five_from_coordinate, lin_fan_initial_coordinate
from physics_engine import CharacterPhysicsState, ExperienceEvent
from simulation.runner import run_event_sequence


def main() -> None:
    """Run repeated abandonment-like events to show cluster accumulation."""

    coordinate = lin_fan_initial_coordinate()
    state = CharacterPhysicsState(
        coordinate=coordinate,
        personality=big_five_from_coordinate(coordinate),
        learning_rate=0.03,
    )
    events = [
        ExperienceEvent(
            id="abandonment_1",
            description="王雪三天没有回复消息。",
            tags=["王雪", "失联", "等待", "亲密关系"],
            intensity=0.75,
            importance=0.8,
            relationship_weight=0.9,
            expectation_gap=0.8,
            personality_sensitivity=0.9,
        ),
        ExperienceEvent(
            id="abandonment_2",
            description="王雪答应见面后临时消失。",
            tags=["王雪", "失联", "等待", "亲密关系"],
            intensity=0.7,
            importance=0.75,
            relationship_weight=0.9,
            expectation_gap=0.85,
            personality_sensitivity=0.9,
        ),
        ExperienceEvent(
            id="abandonment_3",
            description="林凡再次在深夜等待王雪的解释。",
            tags=["王雪", "等待", "被抛弃", "夜晚"],
            intensity=0.78,
            importance=0.82,
            relationship_weight=0.95,
            expectation_gap=0.82,
            personality_sensitivity=0.9,
        ),
    ]

    result = run_event_sequence(state, events, days_per_step=7.0)

    print("Character Physics Repeated Event Simulation")
    print(f"initial_coordinate={coordinate.to_dict()}")
    for snapshot in result.snapshots:
        print(
            "\n"
            f"step={snapshot.step}, event={snapshot.event_id}, "
            f"memory={snapshot.memory_id}, category={snapshot.category}, "
            f"impact={snapshot.impact_score}"
        )
        print(
            f"cluster_mass={snapshot.cluster_mass}, "
            f"density={snapshot.cluster_density}, "
            f"stability={snapshot.cluster_stability}, "
            f"age={snapshot.cluster_age}, "
            f"memory_repetition={snapshot.memory_repetition_count}, "
            f"memory_recency={snapshot.memory_recency}, "
            f"memory_weight={snapshot.memory_effective_weight}"
        )
        print(
            f"trust={snapshot.coordinate['trust']}, "
            f"fear={snapshot.coordinate['fear']}, "
            f"attachment={snapshot.coordinate['attachment']}, "
            f"control={snapshot.coordinate['control']}"
        )
    print(f"\nfinal_coordinate={result.final_state.coordinate.to_dict()}")
    print("\nfinal_memories:")
    for memory in result.final_state.memories:
        print(
            f"- {memory.id}: recency={memory.recency}, "
            f"repetition={memory.repetition_count}, cluster={memory.cluster_id}"
        )


if __name__ == "__main__":
    main()
