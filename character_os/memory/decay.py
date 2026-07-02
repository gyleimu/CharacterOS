"""Memory decay helpers for Character Physics.

Memory decay changes memory availability, not personality directly. Personality
can only drift through clusters and repeated behavior.
"""

from __future__ import annotations

from dataclasses import replace
from math import exp

from memory.node import MemoryNode


def decay_memory(
    memory: MemoryNode,
    days_elapsed: float,
    decay_rate: float = 0.03,
) -> MemoryNode:
    """Return a memory with lower recency after elapsed days."""

    if days_elapsed <= 0:
        return memory

    recency = memory.recency * exp(-decay_rate * days_elapsed)
    return replace(memory, recency=round(max(0.0, min(1.0, recency)), 4))


def decay_memories(
    memories: list[MemoryNode],
    days_elapsed: float,
    decay_rate: float = 0.03,
) -> list[MemoryNode]:
    """Decay all memories by the same elapsed time."""

    return [decay_memory(memory, days_elapsed, decay_rate) for memory in memories]


def effective_memory_weight(memory: MemoryNode) -> float:
    """Calculate current memory influence for retrieval-like systems."""

    repetition_bonus = 1 + min(memory.repetition_count, 10) * 0.05
    return round(memory.importance * memory.recency * repetition_bonus, 4)
