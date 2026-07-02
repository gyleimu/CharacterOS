"""Tests for the Character Physics V1 foundation."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_OS = ROOT / "character_os"
sys.path.insert(0, str(CHARACTER_OS))

from benchmark.impact import ImpactInputs, calculate_impact_score
from cluster.impact_cluster import ImpactCluster, ImpactParticle
from drift.system import apply_personality_drift
from memory.decay import decay_memory, effective_memory_weight
from memory.node import MemoryNode
from personality.space import (
    base_dimension_keys,
    big_five_from_coordinate,
    lin_fan_initial_coordinate,
    neutral_coordinate,
    PersonalityCoordinate,
)
from personality.vector import PersonalityVector
from physics_engine import CharacterPhysicsEngine, CharacterPhysicsState, ExperienceEvent
from physics_types import EventImpactVector
from simulation.runner import run_event_sequence


class CharacterPhysicsTests(unittest.TestCase):
    def test_personality_coordinate_space_has_base_dimensions(self) -> None:
        keys = base_dimension_keys()

        self.assertIn("openness", keys)
        self.assertIn("neuroticism", keys)
        self.assertIn("trust", keys)
        self.assertIn("attachment", keys)
        self.assertIn("fear", keys)
        self.assertIn("control", keys)

    def test_lin_fan_initial_coordinate_matches_character_concept(self) -> None:
        coordinate = lin_fan_initial_coordinate()

        self.assertLess(coordinate.get("extroversion"), 0.4)
        self.assertLess(coordinate.get("trust"), 0.4)
        self.assertGreater(coordinate.get("attachment"), 0.8)
        self.assertGreater(coordinate.get("fear"), 0.8)
        self.assertGreater(coordinate.get("neuroticism"), 0.7)

    def test_coordinate_operations_support_distance_and_delta(self) -> None:
        neutral = neutral_coordinate()
        shifted = neutral.add_delta({"trust": -0.2, "fear": 0.2})

        self.assertAlmostEqual(shifted.get("trust"), 0.3)
        self.assertAlmostEqual(shifted.get("fear"), 0.7)
        self.assertGreater(neutral.distance_to(shifted), 0)

    def test_coordinate_can_project_to_big_five_vector(self) -> None:
        coordinate = lin_fan_initial_coordinate()
        vector = big_five_from_coordinate(coordinate)

        self.assertEqual(vector.openness, coordinate.get("openness"))
        self.assertEqual(vector.neuroticism, coordinate.get("neuroticism"))

    def test_impact_score_uses_shared_scale(self) -> None:
        score = calculate_impact_score(
            ImpactInputs(
                intensity=1.0,
                importance=1.0,
                relationship_weight=1.0,
                expectation_gap=1.0,
                personality_sensitivity=1.0,
            )
        )

        self.assertEqual(score.value, 1.0)
        self.assertEqual(score.band, "life_changing")

    def test_memory_decay_reduces_recency_and_effective_weight(self) -> None:
        memory = MemoryNode(
            id="memory_decay_test",
            content="test",
            vector=neutral_coordinate(),
            importance=0.8,
            emotion="fear",
            recency=1.0,
            repetition_count=2,
            belief_effect="test",
            time_stamp="2026-06-18T00:00:00",
            cluster_id="cluster_test",
        )

        decayed = decay_memory(memory, days_elapsed=30, decay_rate=0.03)

        self.assertLess(decayed.recency, memory.recency)
        self.assertLess(effective_memory_weight(decayed), effective_memory_weight(memory))

    def test_cluster_absorbs_event_impact_vector(self) -> None:
        cluster = ImpactCluster(id="cluster_abandonment", category="abandonment")
        particle = ImpactParticle(
            id="particle_1",
            description="important person disappeared",
            vector=EventImpactVector(
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
                category="abandonment",
                rationale="test",
            ),
            impact_score=0.6,
            emotion="fear",
            category="abandonment",
        )

        cluster.absorb(particle)

        self.assertEqual(cluster.mass, 0.6)
        self.assertEqual(cluster.particle_ids, ["particle_1"])
        self.assertAlmostEqual(cluster.center_coordinate.get("trust"), -0.09)
        self.assertAlmostEqual(cluster.center_coordinate.get("fear"), 0.08)
        self.assertAlmostEqual(cluster.center_vector.neuroticism, 0.08)

    def test_personality_drift_is_slow(self) -> None:
        cluster = ImpactCluster(id="cluster_abandonment", category="abandonment")
        cluster.center_vector = PersonalityVector(
            openness=-0.01,
            conscientiousness=0.0,
            extroversion=-0.04,
            agreeableness=-0.05,
            neuroticism=0.08,
        )
        cluster.mass = 1.0
        cluster.stability = 1.0
        personality = PersonalityVector(
            openness=0.5,
            conscientiousness=0.5,
            extroversion=0.5,
            agreeableness=0.5,
            neuroticism=0.5,
        )

        drift = apply_personality_drift(
            personality=personality,
            clusters=[cluster],
            learning_rate=0.03,
        )

        self.assertLess(drift.after.extroversion, personality.extroversion)
        self.assertGreater(drift.after.neuroticism, personality.neuroticism)
        self.assertLess(drift.after.neuroticism - personality.neuroticism, 0.01)

    def test_physics_engine_processes_event_without_prompt_dependency(self) -> None:
        state = CharacterPhysicsState(
            personality=PersonalityVector(
                openness=0.45,
                conscientiousness=0.48,
                extroversion=0.28,
                agreeableness=0.42,
                neuroticism=0.72,
            )
        )
        event = ExperienceEvent(
            id="event_1",
            description="王雪已经三天没有回复林凡的消息。",
            tags=["王雪", "失联", "等待", "亲密关系"],
            intensity=0.8,
            importance=0.8,
            relationship_weight=0.9,
            expectation_gap=0.8,
            personality_sensitivity=0.9,
        )

        result = CharacterPhysicsEngine().process_event(state, event)

        self.assertEqual(result.particle.category, "abandonment")
        self.assertEqual(result.emotion.primary, "fear")
        self.assertEqual(result.memory_node.id, "memory_event_1")
        self.assertEqual(result.memory_node.cluster_id, "cluster_abandonment")
        self.assertEqual(result.memory_node.repetition_count, 1)
        self.assertEqual(len(state.memories), 1)
        self.assertIn("abandonment", state.clusters)
        self.assertGreater(state.personality.neuroticism, 0.72)

    def test_physics_engine_updates_full_coordinate_slowly(self) -> None:
        coordinate = lin_fan_initial_coordinate()
        state = CharacterPhysicsState(
            coordinate=coordinate,
            personality=big_five_from_coordinate(coordinate),
            learning_rate=0.03,
        )
        event = ExperienceEvent(
            id="event_2",
            description="重要的人突然失联。",
            tags=["失联", "等待"],
            intensity=0.8,
            importance=0.8,
            relationship_weight=0.9,
            expectation_gap=0.8,
            personality_sensitivity=0.9,
        )

        CharacterPhysicsEngine().process_event(state, event)

        self.assertLess(state.coordinate.get("trust"), coordinate.get("trust"))
        self.assertGreater(state.coordinate.get("fear"), coordinate.get("fear"))
        self.assertLess(coordinate.get("trust") - state.coordinate.get("trust"), 0.01)
        self.assertLess(state.coordinate.get("fear") - coordinate.get("fear"), 0.01)
        self.assertAlmostEqual(
            state.clusters["abandonment"].center_coordinate.get("trust"),
            -0.09,
        )

    def test_repeated_events_accumulate_cluster_gravity(self) -> None:
        coordinate = lin_fan_initial_coordinate()
        state = CharacterPhysicsState(
            coordinate=coordinate,
            personality=big_five_from_coordinate(coordinate),
            learning_rate=0.03,
        )
        events = [
            ExperienceEvent(
                id="repeat_1",
                description="重要的人失联。",
                tags=["失联", "等待"],
                intensity=0.7,
                importance=0.75,
                relationship_weight=0.9,
                expectation_gap=0.8,
                personality_sensitivity=0.9,
            ),
            ExperienceEvent(
                id="repeat_2",
                description="重要的人再次失联。",
                tags=["失联", "等待"],
                intensity=0.72,
                importance=0.78,
                relationship_weight=0.9,
                expectation_gap=0.82,
                personality_sensitivity=0.9,
            ),
            ExperienceEvent(
                id="repeat_3",
                description="重要的人第三次失联。",
                tags=["失联", "等待"],
                intensity=0.74,
                importance=0.8,
                relationship_weight=0.9,
                expectation_gap=0.84,
                personality_sensitivity=0.9,
            ),
        ]

        result = run_event_sequence(state, events, days_per_step=7.0)
        first = result.snapshots[0]
        last = result.snapshots[-1]

        self.assertEqual(last.cluster_age, 3)
        self.assertEqual(last.memory_repetition_count, 3)
        self.assertEqual(len(result.final_state.memories), 3)
        self.assertLess(result.final_state.memories[0].recency, 1.0)
        self.assertEqual(result.final_state.memories[-1].recency, 1.0)
        self.assertGreater(last.cluster_mass, first.cluster_mass)
        self.assertGreater(last.cluster_stability, first.cluster_stability)
        self.assertLess(last.coordinate["trust"], first.coordinate["trust"])
        self.assertGreater(last.coordinate["fear"], first.coordinate["fear"])


if __name__ == "__main__":
    unittest.main()
