"""Unified impact benchmark for Character Physics V1.

All fast variables should communicate through impact_score in [0, 1]. This
module is intentionally small and deterministic so every later subsystem can
share the same scale.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ImpactInputs:
    """Inputs used to calculate event impact on the character system."""

    intensity: float
    importance: float
    relationship_weight: float
    expectation_gap: float
    personality_sensitivity: float


@dataclass(frozen=True)
class ImpactScore:
    """A normalized impact score with a human-readable band."""

    value: float
    band: str
    description: str


def calculate_impact_score(inputs: ImpactInputs) -> ImpactScore:
    """Calculate impact_score in [0, 1] from shared benchmark factors."""

    value = (
        _clip(inputs.intensity) * 0.25
        + _clip(inputs.importance) * 0.25
        + _clip(inputs.relationship_weight) * 0.2
        + _clip(inputs.expectation_gap) * 0.2
        + _clip(inputs.personality_sensitivity) * 0.1
    )
    value = round(_clip(value), 3)
    band, description = classify_impact(value)
    return ImpactScore(value=value, band=band, description=description)


def classify_impact(value: float) -> tuple[str, str]:
    """Return the benchmark band for an impact value."""

    value = _clip(value)
    if value <= 0.05:
        return "negligible", "几乎无影响"
    if value <= 0.15:
        return "minor", "轻微影响"
    if value <= 0.3:
        return "normal", "普通影响"
    if value <= 0.5:
        return "major", "重大影响"
    if value <= 0.8:
        return "traumatic", "创伤级"
    return "life_changing", "改变人生轨迹"


def _clip(value: float) -> float:
    """Clip a number to the shared [0, 1] range."""

    return max(0.0, min(1.0, value))
