"""Character Physics V1 engine.

This is the first non-prompt-centered personality engine. It does not replace
the old CLI yet; it establishes the physical path:

Event -> Emotion -> Impact Particle -> Impact Cluster -> Personality Drift
"""

from __future__ import annotations

from dataclasses import dataclass, field

from benchmark.impact import ImpactInputs, ImpactScore, calculate_impact_score
from cluster.impact_cluster import ImpactCluster, ImpactParticle
from drift.coordinate_drift import CoordinateDriftResult, apply_coordinate_drift
from drift.system import DriftResult, apply_personality_drift
from emotion.model import EmotionState
from memory.node import MemoryNode
from memory.system import create_memory_node
from physics_types import EventImpactVector
from personality.space import (
    PersonalityCoordinate,
    big_five_from_coordinate,
    coordinate_from_big_five,
    neutral_coordinate,
)
from personality.vector import PersonalityVector, neutral_personality


@dataclass(frozen=True)
class ExperienceEvent:
    """A normalized event entering the character physics system."""

    id: str
    description: str
    tags: list[str]
    intensity: float
    importance: float
    relationship_weight: float
    expectation_gap: float
    personality_sensitivity: float


@dataclass
class CharacterPhysicsState:
    """Runtime state for the personality galaxy."""

    personality: PersonalityVector = field(default_factory=neutral_personality)
    coordinate: PersonalityCoordinate | None = None
    clusters: dict[str, ImpactCluster] = field(default_factory=dict)
    particles: list[ImpactParticle] = field(default_factory=list)
    memories: list[MemoryNode] = field(default_factory=list)
    learning_rate: float = 0.03

    def __post_init__(self) -> None:
        """Keep legacy Big Five-only construction compatible."""

        if self.coordinate is None:
            self.coordinate = coordinate_from_big_five(self.personality)


@dataclass(frozen=True)
class PhysicsStepResult:
    """Result of processing one event through Character Physics."""

    event: ExperienceEvent
    emotion: EmotionState
    impact_score: ImpactScore
    particle: ImpactParticle
    memory_node: MemoryNode
    cluster: ImpactCluster
    drift: DriftResult
    coordinate_drift: CoordinateDriftResult


class CharacterPhysicsEngine:
    """Small ECS-like system coordinator for Character Physics V1."""

    def process_event(
        self,
        state: CharacterPhysicsState,
        event: ExperienceEvent,
    ) -> PhysicsStepResult:
        """Process an event and mutate the runtime physics state."""

        impact_score = calculate_impact_score(
            ImpactInputs(
                intensity=event.intensity,
                importance=event.importance,
                relationship_weight=event.relationship_weight,
                expectation_gap=event.expectation_gap,
                personality_sensitivity=event.personality_sensitivity,
            )
        )
        emotion = _infer_emotion(event, impact_score)
        category = _classify_category(event.tags)
        particle = ImpactParticle(
            id=f"particle_{event.id}",
            description=event.description,
            vector=_impact_vector(category, emotion),
            impact_score=impact_score.value,
            emotion=emotion.primary,
            category=category,
        )
        cluster = state.clusters.setdefault(
            category,
            ImpactCluster(id=f"cluster_{category}", category=category),
        )
        cluster.absorb(particle)
        state.particles.append(particle)
        memory_node = create_memory_node(
            event=event,
            particle=particle,
            impact_score=impact_score,
            emotion=emotion,
            cluster_id=cluster.id,
            repetition_count=cluster.age,
        )
        state.memories.append(memory_node)
        coordinate_drift = apply_coordinate_drift(
            coordinate=state.coordinate,
            clusters=list(state.clusters.values()),
            learning_rate=state.learning_rate,
        )
        state.coordinate = coordinate_drift.after
        drift = apply_personality_drift(
            personality=big_five_from_coordinate(state.coordinate),
            clusters=list(state.clusters.values()),
            learning_rate=state.learning_rate,
        )
        state.personality = drift.after

        return PhysicsStepResult(
            event=event,
            emotion=emotion,
            impact_score=impact_score,
            particle=particle,
            memory_node=memory_node,
            cluster=cluster,
            drift=drift,
            coordinate_drift=coordinate_drift,
        )


def _infer_emotion(event: ExperienceEvent, impact_score: ImpactScore) -> EmotionState:
    """Infer a first-pass emotion from tags and impact."""

    tags = set(event.tags)
    if {"失联", "抛弃", "被抛弃", "等待"} & tags:
        primary = "fear"
        valence = -0.8
        arousal = 0.8
    elif {"认可", "成功", "胜利"} & tags:
        primary = "joy"
        valence = 0.7
        arousal = 0.6
    else:
        primary = "uncertainty"
        valence = -0.2
        arousal = 0.4

    return EmotionState(
        primary=primary,
        valence=valence,
        arousal=arousal,
        intensity=impact_score.value,
    )


def _classify_category(tags: list[str]) -> str:
    """Classify event category for impact clustering."""

    tag_set = set(tags)
    if {"失联", "抛弃", "被抛弃", "等待"} & tag_set:
        return "abandonment"
    if {"欺骗", "背叛"} & tag_set:
        return "betrayal"
    if {"认可", "成功", "胜利", "晋升"} & tag_set:
        return "success"
    return "general"


def _impact_vector(category: str, emotion: EmotionState) -> EventImpactVector:
    """Map event category to a full personality-coordinate drift direction."""

    if category == "abandonment":
        return EventImpactVector(
            delta=PersonalityCoordinate(
                values={
                    "openness": -0.01,
                    "conscientiousness": 0.0,
                    "extroversion": -0.04,
                    "agreeableness": -0.05,
                    "neuroticism": 0.08,
                    "trust": -0.09,
                    "attachment": 0.04,
                    "fear": 0.08,
                    "control": 0.05,
                }
            ),
            category=category,
            rationale="abandonment tends to reduce social openness and increase threat sensitivity",
        )
    if category == "betrayal":
        return EventImpactVector(
            delta=PersonalityCoordinate(
                values={
                    "openness": -0.02,
                    "conscientiousness": 0.01,
                    "extroversion": -0.03,
                    "agreeableness": -0.08,
                    "neuroticism": 0.07,
                    "trust": -0.12,
                    "attachment": -0.02,
                    "fear": 0.06,
                    "control": 0.04,
                }
            ),
            category=category,
            rationale="betrayal tends to reduce trust and agreeableness over repeated exposure",
        )
    if category == "success":
        return EventImpactVector(
            delta=PersonalityCoordinate(
                values={
                    "openness": 0.03,
                    "conscientiousness": 0.04,
                    "extroversion": 0.05,
                    "agreeableness": 0.01,
                    "neuroticism": -0.03,
                    "trust": 0.02,
                    "attachment": 0.0,
                    "fear": -0.03,
                    "control": 0.03,
                }
            ),
            category=category,
            rationale="success tends to increase agency and reduce threat sensitivity",
        )
    return EventImpactVector(
        delta=PersonalityCoordinate(
            values={
                "openness": 0.0,
                "conscientiousness": 0.0,
                "extroversion": 0.0,
                "agreeableness": 0.0,
                "neuroticism": emotion.valence * -0.01,
                "trust": 0.0,
                "attachment": 0.0,
                "fear": abs(emotion.valence) * 0.01,
                "control": 0.0,
            }
        ),
        category=category,
        rationale="general events only create weak mood-colored pressure",
    )
