"""Core data models for CharacterOS.

These models intentionally stay small. CharacterOS starts from memories and
uses them to reason about a character's psychological response to an event.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Memory:
    """A formative experience that may shape beliefs and choices."""

    id: str
    content: str
    tags: list[str]
    impact: int
    effects: list[str] = field(default_factory=list)
    beliefs: list[str] = field(default_factory=list)
    activation_count: int = 0
    last_activated: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Memory":
        """Create a Memory from JSON-compatible dictionary data."""

        return cls(
            id=str(data["id"]),
            content=str(data["content"]),
            tags=list(data.get("tags", [])),
            impact=int(data.get("impact", 0)),
            effects=list(data.get("effects", [])),
            beliefs=list(data.get("beliefs", [])),
            activation_count=int(data.get("activation_count", 0)),
            last_activated=data.get("last_activated"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert a Memory back to JSON-compatible dictionary data."""

        return {
            "id": self.id,
            "content": self.content,
            "tags": self.tags,
            "impact": self.impact,
            "effects": self.effects,
            "beliefs": self.beliefs,
            "activation_count": self.activation_count,
            "last_activated": self.last_activated,
        }


@dataclass
class Character:
    """A character defined by description, traits, and lived memories."""

    name: str
    description: str
    core_traits: list[str]
    memories: list[Memory]

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Character":
        """Create a Character and nested memories from JSON data."""

        return cls(
            name=str(data["name"]),
            description=str(data["description"]),
            core_traits=list(data.get("core_traits", [])),
            memories=[Memory.from_dict(item) for item in data.get("memories", [])],
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert a Character back to JSON-compatible dictionary data."""

        return {
            "name": self.name,
            "description": self.description,
            "core_traits": self.core_traits,
            "memories": [memory.to_dict() for memory in self.memories],
        }


@dataclass
class ActivatedBelief:
    """A belief currently activated by relevant memories."""

    content: str
    strength: float
    source_memory_ids: list[str]
    evidence: list[str]


@dataclass
class ActivatedDeficiency:
    """A psychological lack currently exposed by activated beliefs."""

    name: str
    description: str
    strength: float
    source_beliefs: list[str]
    evidence: list[str]


@dataclass
class ActivatedDesire:
    """A desire emerging from current deficiencies."""

    name: str
    description: str
    strength: float
    source_deficiencies: list[str]
    likely_behavior: str


@dataclass
class MemoryCluster:
    """A group of memories that reinforce a shared psychological pattern."""

    name: str
    description: str
    strength: float
    memory_ids: list[str]
    matched_keywords: list[str]
    evidence: list[str]


@dataclass
class MemorySpaceNode:
    """A memory's current runtime position in the memory space."""

    memory_id: str
    layer: str
    core_distance: float
    influence: float
    reason: str
