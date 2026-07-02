"""Memory clustering for CharacterOS v0.1.

Clusters are the first step from isolated memories toward personality structure.
This version uses transparent keyword rules over memory tags and beliefs. It is
small on purpose: later versions can replace these rules with a real memory
space without changing the rest of the pipeline much.
"""

from __future__ import annotations

from dataclasses import dataclass

from memory_engine import ScoredMemory
from models import Character, Memory, MemoryCluster


@dataclass(frozen=True)
class ClusterRule:
    """A rule that attracts related memories into a named cluster."""

    name: str
    description: str
    keywords: tuple[str, ...]


CLUSTER_RULES = (
    ClusterRule(
        name="抛弃创伤簇",
        description="围绕离开、失联、等待和被抛弃形成的核心创伤结构。",
        keywords=("抛弃", "被抛弃", "离开", "失联", "等待", "孤独", "没有结果"),
    ),
    ClusterRule(
        name="亲密关系不可靠簇",
        description="围绕亲密关系中的不稳定、沉默和不可预测形成的关系信念结构。",
        keywords=("亲密关系", "不可靠", "失联", "等待", "突然", "没有回应"),
    ),
    ClusterRule(
        name="王雪依赖簇",
        description="围绕王雪、温暖、被爱和依赖形成的特殊连接结构。",
        keywords=("王雪", "温暖", "被爱", "依赖", "靠近"),
    ),
)


def activate_clusters(
    character: Character,
    activated_memories: list[ScoredMemory],
    top_k: int = 5,
) -> list[MemoryCluster]:
    """Build current clusters and return those touched by active memories."""

    activated_ids = {item.memory.id for item in activated_memories}
    clusters: list[MemoryCluster] = []

    for rule in CLUSTER_RULES:
        cluster = _build_cluster(rule, character.memories)
        if cluster is None:
            continue
        if not activated_ids.intersection(cluster.memory_ids):
            continue
        clusters.append(cluster)

    clusters.sort(key=lambda item: item.strength, reverse=True)
    return clusters[:top_k]


def _build_cluster(
    rule: ClusterRule,
    memories: list[Memory],
) -> MemoryCluster | None:
    """Build one cluster from memories matching a rule."""

    memory_ids: list[str] = []
    matched_keywords: list[str] = []
    evidence: list[str] = []
    strength = 0.0

    for memory in memories:
        memory_text = _memory_search_text(memory)
        matches = [keyword for keyword in rule.keywords if keyword in memory_text]
        if not matches:
            continue

        memory_ids.append(memory.id)
        matched_keywords.extend(matches)
        strength += memory.impact + len(matches) * 5
        evidence.append(f"{memory.id}: {memory.content} -> {'、'.join(matches)}")

    if len(memory_ids) < 2:
        return None

    return MemoryCluster(
        name=rule.name,
        description=rule.description,
        strength=strength,
        memory_ids=memory_ids,
        matched_keywords=sorted(set(matched_keywords)),
        evidence=evidence,
    )


def _memory_search_text(memory: Memory) -> str:
    """Combine memory fields for simple keyword matching."""

    parts = [memory.content]
    parts.extend(memory.tags)
    parts.extend(memory.effects)
    parts.extend(memory.beliefs)
    return " ".join(parts)
