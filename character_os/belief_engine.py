"""Belief activation for CharacterOS v0.02.

V0.01 retrieved memories and let the LLM infer everything else. V0.02 makes
beliefs explicit: activated memories expose the beliefs currently shaping the
character's interpretation of an event.
"""

from __future__ import annotations

from models import ActivatedBelief
from memory_engine import ScoredMemory


def activate_beliefs(
    activated_memories: list[ScoredMemory],
    top_k: int = 5,
) -> list[ActivatedBelief]:
    """Extract, merge, and rank beliefs from activated memories.

    A belief gets stronger when it comes from highly relevant memories and when
    multiple memories support the same interpretation.
    """

    belief_map: dict[str, ActivatedBelief] = {}

    for item in activated_memories:
        memory = item.memory
        for belief in memory.beliefs:
            normalized_belief = belief.strip()
            if not normalized_belief:
                continue

            strength = _belief_strength(item)
            evidence = f"{memory.id}: {memory.content}"

            if normalized_belief not in belief_map:
                belief_map[normalized_belief] = ActivatedBelief(
                    content=normalized_belief,
                    strength=strength,
                    source_memory_ids=[memory.id],
                    evidence=[evidence],
                )
                continue

            activated_belief = belief_map[normalized_belief]
            activated_belief.strength += strength
            if memory.id not in activated_belief.source_memory_ids:
                activated_belief.source_memory_ids.append(memory.id)
            if evidence not in activated_belief.evidence:
                activated_belief.evidence.append(evidence)

    activated_beliefs = list(belief_map.values())
    activated_beliefs.sort(key=lambda item: item.strength, reverse=True)
    return activated_beliefs[:top_k]


def _belief_strength(item: ScoredMemory) -> float:
    """Calculate a transparent belief strength from the source memory."""

    return item.score + item.memory.impact * 0.1
