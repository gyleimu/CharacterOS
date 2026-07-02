"""Simple tag-based memory retrieval for CharacterOS v0.01.

No embeddings, no vector database, no hidden machinery. The first version only
answers one question: which memories are most psychologically relevant now?
"""

from __future__ import annotations

from dataclasses import dataclass

from models import Memory


@dataclass
class ScoredMemory:
    """A memory with the retrieval score that activated it."""

    memory: Memory
    score: float
    matched_tags: list[str]


def retrieve_relevant_memories(
    event_text: str,
    event_tags: list[str],
    memories: list[Memory],
    top_k: int = 3,
) -> list[ScoredMemory]:
    """Return the top memories using a simple tag match plus impact score.

    Formula:
        score = tag_match_count * 10 + impact * 0.2

    The event text is accepted for future readability, but v0.01 deliberately
    uses only explicit event tags to keep behavior transparent.
    """

    _ = event_text
    normalized_event_tags = {_normalize_tag(tag) for tag in event_tags if tag.strip()}
    scored_memories: list[ScoredMemory] = []

    for memory in memories:
        normalized_memory_tags = {_normalize_tag(tag) for tag in memory.tags}
        matched_normalized = normalized_event_tags & normalized_memory_tags
        matched_tags = [tag for tag in memory.tags if _normalize_tag(tag) in matched_normalized]
        score = len(matched_tags) * 10 + memory.impact * 0.2
        scored_memories.append(
            ScoredMemory(memory=memory, score=score, matched_tags=matched_tags)
        )

    scored_memories.sort(key=lambda item: item.score, reverse=True)
    return scored_memories[:top_k]


def _normalize_tag(tag: str) -> str:
    """Normalize tags enough for Chinese and English comma-separated input."""

    return tag.strip().lower()
