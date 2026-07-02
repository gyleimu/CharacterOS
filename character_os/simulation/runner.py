"""Run repeated Character Physics events and record snapshots."""

from __future__ import annotations

from dataclasses import dataclass

from memory.decay import decay_memories, effective_memory_weight
from physics_engine import (
    CharacterPhysicsEngine,
    CharacterPhysicsState,
    ExperienceEvent,
    PhysicsStepResult,
)


@dataclass(frozen=True)
class SimulationSnapshot:
    """A compact snapshot after one event step."""

    step: int
    event_id: str
    memory_id: str
    category: str
    impact_score: float
    memory_repetition_count: int
    memory_recency: float
    memory_effective_weight: float
    cluster_mass: float
    cluster_density: float
    cluster_stability: float
    cluster_age: int
    coordinate: dict[str, float]


@dataclass(frozen=True)
class SimulationResult:
    """Result of a repeated-event simulation."""

    snapshots: list[SimulationSnapshot]
    final_state: CharacterPhysicsState


def run_event_sequence(
    state: CharacterPhysicsState,
    events: list[ExperienceEvent],
    engine: CharacterPhysicsEngine | None = None,
    days_per_step: float = 0.0,
) -> SimulationResult:
    """Process events in order and record personality-space snapshots."""

    engine = engine or CharacterPhysicsEngine()
    snapshots: list[SimulationSnapshot] = []

    for index, event in enumerate(events, start=1):
        if days_per_step > 0 and state.memories:
            state.memories = decay_memories(state.memories, days_per_step)
        step = engine.process_event(state, event)
        snapshots.append(_snapshot(index, step, state))

    return SimulationResult(snapshots=snapshots, final_state=state)


def _snapshot(
    step_index: int,
    step: PhysicsStepResult,
    state: CharacterPhysicsState,
) -> SimulationSnapshot:
    """Create one simulation snapshot."""

    _ = state
    cluster = step.cluster
    return SimulationSnapshot(
        step=step_index,
        event_id=step.event.id,
        memory_id=step.memory_node.id,
        category=step.particle.category,
        impact_score=step.impact_score.value,
        memory_repetition_count=step.memory_node.repetition_count,
        memory_recency=step.memory_node.recency,
        memory_effective_weight=effective_memory_weight(step.memory_node),
        cluster_mass=cluster.mass,
        cluster_density=cluster.density,
        cluster_stability=cluster.stability,
        cluster_age=cluster.age,
        coordinate=step.coordinate_drift.after.to_dict(),
    )
