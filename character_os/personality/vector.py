"""Personality vector for Character Physics V1."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PersonalityVector:
    """Big Five personality core vector.

    Values are normalized to [0, 1]:
    O = openness
    C = conscientiousness
    E = extroversion
    A = agreeableness
    N = neuroticism
    """

    openness: float
    conscientiousness: float
    extroversion: float
    agreeableness: float
    neuroticism: float

    def add_scaled(self, other: "PersonalityVector", scale: float) -> "PersonalityVector":
        """Return a new vector after applying a scaled delta."""

        return PersonalityVector(
            openness=_clip(self.openness + other.openness * scale),
            conscientiousness=_clip(self.conscientiousness + other.conscientiousness * scale),
            extroversion=_clip(self.extroversion + other.extroversion * scale),
            agreeableness=_clip(self.agreeableness + other.agreeableness * scale),
            neuroticism=_clip(self.neuroticism + other.neuroticism * scale),
        )

    def multiply(self, scale: float) -> "PersonalityVector":
        """Scale this vector as a force or delta vector."""

        return PersonalityVector(
            openness=self.openness * scale,
            conscientiousness=self.conscientiousness * scale,
            extroversion=self.extroversion * scale,
            agreeableness=self.agreeableness * scale,
            neuroticism=self.neuroticism * scale,
        )

    def to_dict(self) -> dict[str, float]:
        """Serialize the vector."""

        return {
            "openness": round(self.openness, 4),
            "conscientiousness": round(self.conscientiousness, 4),
            "extroversion": round(self.extroversion, 4),
            "agreeableness": round(self.agreeableness, 4),
            "neuroticism": round(self.neuroticism, 4),
        }


def neutral_personality() -> PersonalityVector:
    """Return a neutral Big Five starting point."""

    return PersonalityVector(
        openness=0.5,
        conscientiousness=0.5,
        extroversion=0.5,
        agreeableness=0.5,
        neuroticism=0.5,
    )


def zero_personality_delta() -> PersonalityVector:
    """Return a zero delta vector."""

    return PersonalityVector(
        openness=0.0,
        conscientiousness=0.0,
        extroversion=0.0,
        agreeableness=0.0,
        neuroticism=0.0,
    )


def _clip(value: float) -> float:
    """Clip core personality values to [0, 1]."""

    return max(0.0, min(1.0, value))
