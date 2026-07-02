"""Memory reinforcement for CharacterOS v0.05.

Frequently activated memories should gain influence, while unused memories
slowly drift toward the boundary. This first version keeps the rule tiny and
visible: activated memories gain impact, inactive memories decay slightly.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from memory_engine import ScoredMemory
from models import Character


@dataclass
class MemoryChange:
    """A visible record of one memory impact update."""

    memory_id: str
    old_impact: int
    new_impact: int
    reason: str


def reinforce_memories(
    character: Character,
    activated_memories: list[ScoredMemory],
    activated_delta: int = 2,
    inactive_delta: int = -1,
) -> list[MemoryChange]:
    """Update memory impact after an event and return a change summary."""

    activated_ids = {item.memory.id for item in activated_memories}
    now = datetime.now().isoformat(timespec="seconds")
    changes: list[MemoryChange] = []

    for memory in character.memories:
        old_impact = memory.impact

        if memory.id in activated_ids:
            memory.impact = min(100, memory.impact + activated_delta)
            memory.activation_count += 1
            memory.last_activated = now
            reason = "activated"
        else:
            memory.impact = max(0, memory.impact + inactive_delta)
            reason = "inactive_decay"

        if memory.impact != old_impact:
            changes.append(
                MemoryChange(
                    memory_id=memory.id,
                    old_impact=old_impact,
                    new_impact=memory.impact,
                    reason=reason,
                )
            )

    return changes
