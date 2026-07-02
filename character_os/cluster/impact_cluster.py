"""Impact particles and impact clusters."""

from __future__ import annotations

from dataclasses import dataclass, field

from personality.space import (
    PersonalityCoordinate,
    big_five_from_coordinate,
    zero_coordinate_delta,
)
from personality.vector import PersonalityVector, zero_personality_delta
from physics_types import EventImpactVector


@dataclass(frozen=True)
class ImpactParticle:
    """An event-derived particle with direction and mass."""

    id: str
    description: str
    vector: EventImpactVector
    impact_score: float
    emotion: str
    category: str


@dataclass
class ImpactCluster:
    """A cluster of similar impact particles."""

    id: str
    category: str
    center_coordinate: PersonalityCoordinate = field(default_factory=zero_coordinate_delta)
    center_vector: PersonalityVector = field(default_factory=zero_personality_delta)
    mass: float = 0.0
    density: float = 0.0
    stability: float = 0.0
    age: int = 0
    particle_ids: list[str] = field(default_factory=list)

    def absorb(self, particle: ImpactParticle) -> None:
        """Absorb one particle and update cluster statistics."""

        total_mass = self.mass + particle.impact_score
        if total_mass <= 0:
            return

        old_weight = self.mass / total_mass
        new_weight = particle.impact_score / total_mass
        coordinate_values = {}
        for key in set(self.center_coordinate.values) | set(particle.vector.delta.values):
            coordinate_values[key] = (
                self.center_coordinate.values.get(key, 0.0) * old_weight
                + particle.vector.delta.values.get(key, 0.0) * new_weight
            )
        self.center_coordinate = PersonalityCoordinate(values=coordinate_values)
        particle_big_five = big_five_from_coordinate(self.center_coordinate)
        self.center_vector = PersonalityVector(
            openness=particle_big_five.openness,
            conscientiousness=particle_big_five.conscientiousness,
            extroversion=particle_big_five.extroversion,
            agreeableness=particle_big_five.agreeableness,
            neuroticism=particle_big_five.neuroticism,
        )
        self.mass = round(total_mass, 4)
        self.particle_ids.append(particle.id)
        self.age += 1
        self.density = round(min(1.0, len(self.particle_ids) / 10), 4)
        self.stability = round(min(1.0, self.mass * self.density), 4)
