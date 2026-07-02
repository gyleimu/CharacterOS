"""Shared Character Physics V1 type aliases and value objects."""

from __future__ import annotations

from dataclasses import dataclass

from personality.space import PersonalityCoordinate


@dataclass(frozen=True)
class EventImpactVector:
    """A personality-space delta direction produced by an event.

    This vector is a direction and tendency, not an immediate personality edit.
    It becomes an impact particle and only affects personality through clusters
    and slow drift.
    """

    delta: PersonalityCoordinate
    category: str
    rationale: str
