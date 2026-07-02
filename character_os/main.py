"""Command-line entry point for CharacterOS.

Run this file, enter one event and its tags, then CharacterOS retrieves the most
relevant memories and asks the LLM to simulate the character's decision.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from belief_engine import activate_beliefs
from cluster_engine import activate_clusters
from deficiency_engine import activate_deficiencies
from desire_engine import activate_desires
from llm_client import generate_response
from memory_engine import retrieve_relevant_memories
from models import Character
from prompt_builder import build_prompt
from reinforcement_engine import reinforce_memories
from space_engine import build_memory_space, get_activated_space_nodes


DEFAULT_CHARACTER_PATH = Path(__file__).parent / "data" / "sample_character.json"


def main() -> None:
    """Load sample character, collect an event, and print the analysis."""

    configure_text_io()
    character = load_character(DEFAULT_CHARACTER_PATH)

    print("CharacterOS v0.2")
    print("目标：模拟人物心理和抉择，不写故事。\n")
    print(f"当前人物：{character.name}")
    print(f"人物描述：{character.description}\n")

    event_text = input("请输入当前事件：").strip()
    tags_text = input("请输入事件 tags（英文逗号或中文逗号分割）：").strip()
    event_tags = parse_tags(tags_text)

    memory_space = build_memory_space(character)

    print("\n记忆空间：")
    for node in memory_space:
        print(
            f"- {node.memory_id}: layer={node.layer}, "
            f"core_distance={node.core_distance:.3f}, influence={node.influence:.1f}"
        )

    activated_memories = retrieve_relevant_memories(
        event_text=event_text,
        event_tags=event_tags,
        memories=character.memories,
        top_k=3,
    )

    print("\n已激活记忆：")
    for item in activated_memories:
        matched = "、".join(item.matched_tags) if item.matched_tags else "无"
        print(f"- {item.memory.id}: score={item.score:.1f}, matched_tags={matched}")

    activated_memory_ids = {item.memory.id for item in activated_memories}
    activated_space_nodes = get_activated_space_nodes(memory_space, activated_memory_ids)

    print("\n已激活空间节点：")
    for node in activated_space_nodes:
        print(
            f"- {node.memory_id}: layer={node.layer}, "
            f"core_distance={node.core_distance:.3f}, influence={node.influence:.1f}"
        )

    activated_clusters = activate_clusters(character, activated_memories)

    print("\n已激活记忆簇：")
    for item in activated_clusters:
        memory_ids = "、".join(item.memory_ids)
        print(f"- {item.name}: strength={item.strength:.1f}, memories={memory_ids}")

    activated_beliefs = activate_beliefs(activated_memories)

    print("\n已激活信念：")
    for item in activated_beliefs:
        source_ids = "、".join(item.source_memory_ids)
        print(f"- {item.content}: strength={item.strength:.1f}, source={source_ids}")

    activated_deficiencies = activate_deficiencies(activated_beliefs)

    print("\n已激活缺失：")
    for item in activated_deficiencies:
        source_beliefs = "；".join(item.source_beliefs)
        print(f"- {item.name}: strength={item.strength:.1f}, source={source_beliefs}")

    activated_desires = activate_desires(activated_deficiencies)

    print("\n已激活欲望：")
    for item in activated_desires:
        source_deficiencies = "；".join(item.source_deficiencies)
        print(f"- {item.name}: strength={item.strength:.1f}, source={source_deficiencies}")

    prompt = build_prompt(
        character=character,
        event_text=event_text,
        event_tags=event_tags,
        activated_memories=activated_memories,
        activated_space_nodes=activated_space_nodes,
        activated_clusters=activated_clusters,
        activated_beliefs=activated_beliefs,
        activated_deficiencies=activated_deficiencies,
        activated_desires=activated_desires,
    )
    result = generate_response(prompt)

    print("\n========== CharacterOS 输出 ==========\n")
    print(result)

    if not should_reinforce(result):
        print("\n========== 记忆强化 ==========\n")
        print("LLM 未成功返回心理分析，本次不更新记忆。")
        return

    memory_changes = reinforce_memories(character, activated_memories)
    save_character(DEFAULT_CHARACTER_PATH, character)
    print("\n========== 记忆强化 ==========\n")
    for change in memory_changes:
        print(
            f"- {change.memory_id}: impact {change.old_impact} -> "
            f"{change.new_impact} ({change.reason})"
        )


def load_character(path: Path) -> Character:
    """Load the sample character JSON file."""

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return Character.from_dict(data)


def save_character(path: Path, character: Character) -> None:
    """Persist the character state after memory reinforcement."""

    with path.open("w", encoding="utf-8") as file:
        json.dump(character.to_dict(), file, ensure_ascii=False, indent=2)
        file.write("\n")


def should_reinforce(result: str) -> bool:
    """Only reinforce memory after a successful LLM analysis."""

    failure_prefixes = ("未检测到 LLM_API_KEY", "LLM 请求失败", "LLM 请求超时")
    return not result.startswith(failure_prefixes)


def parse_tags(tags_text: str) -> list[str]:
    """Parse tags separated by English or Chinese commas."""

    normalized = tags_text.replace("，", ",")
    return [tag.strip() for tag in normalized.split(",") if tag.strip()]


def configure_text_io() -> None:
    """Use UTF-8 for Chinese command-line input and output when possible."""

    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


if __name__ == "__main__":
    main()
