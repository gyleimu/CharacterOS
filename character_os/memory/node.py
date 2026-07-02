"""Memory node for Character Physics V1."""

from __future__ import annotations

from dataclasses import dataclass

from personality.space import PersonalityCoordinate


@dataclass(frozen=True)
class MemoryNode:
    """A memory particle in the personality galaxy."""

    id: str
    content: str
    vector: PersonalityCoordinate
    importance: float
    emotion: str
    recency: float
    repetition_count: int
    belief_effect: str
    time_stamp: str
    cluster_id: str | None = None
