"""Prompt construction for psychological character simulation.

The prompt tells the LLM to simulate a person, not to write plot. It includes
the character profile, the current event, and the memories activated by tags.
"""

from __future__ import annotations

from models import (
    ActivatedBelief,
    ActivatedDeficiency,
    ActivatedDesire,
    Character,
    MemoryCluster,
    MemorySpaceNode,
)
from memory_engine import ScoredMemory


def build_prompt(
    character: Character,
    event_text: str,
    event_tags: list[str],
    activated_memories: list[ScoredMemory],
    activated_space_nodes: list[MemorySpaceNode],
    activated_clusters: list[MemoryCluster],
    activated_beliefs: list[ActivatedBelief],
    activated_deficiencies: list[ActivatedDeficiency],
    activated_desires: list[ActivatedDesire],
) -> str:
    """Build a single prompt for the LLM-compatible client."""

    traits = "、".join(character.core_traits) if character.core_traits else "无"
    tags = "、".join(event_tags) if event_tags else "无"
    memories_text = "\n".join(
        _format_scored_memory(index, item)
        for index, item in enumerate(activated_memories, start=1)
    )
    space_nodes_text = "\n".join(
        _format_memory_space_node(index, item)
        for index, item in enumerate(activated_space_nodes, start=1)
    )
    clusters_text = "\n".join(
        _format_memory_cluster(index, item)
        for index, item in enumerate(activated_clusters, start=1)
    )
    beliefs_text = "\n".join(
        _format_activated_belief(index, item)
        for index, item in enumerate(activated_beliefs, start=1)
    )
    deficiencies_text = "\n".join(
        _format_activated_deficiency(index, item)
        for index, item in enumerate(activated_deficiencies, start=1)
    )
    desires_text = "\n".join(
        _format_activated_desire(index, item)
        for index, item in enumerate(activated_desires, start=1)
    )

    return f"""你是 CharacterOS，一个 AI 小说人物决策引擎。

你的任务不是写剧情，也不是替作者制造戏剧性。
你的任务是模拟人物在当前事件面前的心理反应与最可能抉择。

核心链路：
经历 -> 记忆空间 -> 记忆 -> 记忆簇 -> 信念 -> 缺失 -> 欲望 -> 情绪 -> 抉择

请严格遵守：
- 不要追求戏剧性。
- 不要强行反转。
- 不要让人物服务剧情。
- 不要把人物写成普通聊天机器人。
- 只追求心理一致性。
- 输出分析，不输出小说正文。

人物资料：
姓名：{character.name}
描述：{character.description}
核心特质：{traits}

当前事件：
{event_text}

当前事件 tags：
{tags}

被激活的记忆：
{memories_text}

被激活的记忆空间节点：
{space_nodes_text}

被激活的记忆簇：
{clusters_text}

被激活的信念：
{beliefs_text}

被激活的缺失：
{deficiencies_text}

被激活的欲望：
{desires_text}

请按以下结构输出：

1. 被激活的记忆
说明哪些记忆被触发，以及它们为什么与当前事件有关。

2. 被激活的记忆空间节点
说明这些记忆处在核心、近核心、中层还是边界，以及这如何影响反应强度。

3. 被激活的记忆簇
说明这些记忆如何形成更大的心理结构，而不只是孤立片段。

4. 被激活的信念
说明这些信念如何影响人物对当前事件的解释。

5. 被激活的缺失
说明这些缺失如何让当前事件变得重要、危险或难以承受。

6. 被激活的欲望
说明这些欲望如何从缺失中产生，以及它们会把人物推向什么行为。

7. 情绪反应
说明人物此刻可能产生的主要情绪和强度。

8. 内心想法
说明人物可能如何解释当前事件。

9. 内心冲突
说明人物想靠近什么，又害怕什么。

10. 他不会做什么
说明哪些行为不符合他的经历、信念和情绪结构。

11. 最可能的抉择
给出最可能采取的行动，保持具体但不要写成剧情段落。

12. 为什么这个抉择符合他的人格
用经历、记忆空间、记忆、记忆簇、信念、缺失、欲望、情绪到抉择的链路解释。
"""


def _format_scored_memory(index: int, item: ScoredMemory) -> str:
    """Format one activated memory with retrieval details."""

    memory = item.memory
    matched_tags = "、".join(item.matched_tags) if item.matched_tags else "无"
    tags = "、".join(memory.tags) if memory.tags else "无"
    effects = "、".join(memory.effects) if memory.effects else "未显式记录"
    beliefs = "、".join(memory.beliefs) if memory.beliefs else "未显式记录"

    return f"""记忆 {index}
- id: {memory.id}
- 内容: {memory.content}
- tags: {tags}
- impact: {memory.impact}
- 匹配 tags: {matched_tags}
- 检索 score: {item.score:.1f}
- effects: {effects}
- beliefs: {beliefs}"""


def _format_memory_space_node(index: int, node: MemorySpaceNode) -> str:
    """Format one activated memory-space node for the prompt."""

    return f"""空间节点 {index}
- memory_id: {node.memory_id}
- layer: {node.layer}
- core_distance: {node.core_distance:.3f}
- influence: {node.influence:.1f}
- reason: {node.reason}"""


def _format_memory_cluster(index: int, cluster: MemoryCluster) -> str:
    """Format one activated memory cluster for the prompt."""

    memory_ids = "、".join(cluster.memory_ids)
    keywords = "、".join(cluster.matched_keywords)
    evidence = "\n".join(f"  - {item}" for item in cluster.evidence)

    return f"""记忆簇 {index}
- 名称: {cluster.name}
- 描述: {cluster.description}
- strength: {cluster.strength:.1f}
- 包含记忆: {memory_ids}
- 匹配关键词: {keywords}
- evidence:
{evidence}"""


def _format_activated_belief(index: int, belief: ActivatedBelief) -> str:
    """Format one activated belief for the prompt."""

    source_ids = "、".join(belief.source_memory_ids) if belief.source_memory_ids else "无"
    evidence = "\n".join(f"  - {item}" for item in belief.evidence)

    return f"""信念 {index}
- 内容: {belief.content}
- strength: {belief.strength:.1f}
- 来源记忆: {source_ids}
- evidence:
{evidence}"""


def _format_activated_deficiency(
    index: int,
    deficiency: ActivatedDeficiency,
) -> str:
    """Format one activated deficiency for the prompt."""

    source_beliefs = "；".join(deficiency.source_beliefs)
    evidence = "\n".join(f"  - {item}" for item in deficiency.evidence)

    return f"""缺失 {index}
- 名称: {deficiency.name}
- 描述: {deficiency.description}
- strength: {deficiency.strength:.1f}
- 来源信念: {source_beliefs}
- evidence:
{evidence}"""


def _format_activated_desire(index: int, desire: ActivatedDesire) -> str:
    """Format one activated desire for the prompt."""

    source_deficiencies = "；".join(desire.source_deficiencies)

    return f"""欲望 {index}
- 名称: {desire.name}
- 描述: {desire.description}
- strength: {desire.strength:.1f}
- 来源缺失: {source_deficiencies}
- 可能行为: {desire.likely_behavior}"""
