"""Runtime memory space for CharacterOS v0.2.

The memory space is not a visualization yet. It is a simple hierarchy that
places memories closer to or farther from the personality core based on impact
and activation history.
"""

from __future__ import annotations

from models import Character, Memory, MemorySpaceNode


def build_memory_space(character: Character) -> list[MemorySpaceNode]:
    """Build memory space nodes for all memories in a character."""

    nodes = [_build_node(memory) for memory in character.memories]
    nodes.sort(key=lambda item: item.core_distance)
    return nodes


def get_activated_space_nodes(
    memory_space: list[MemorySpaceNode],
    activated_memory_ids: set[str],
) -> list[MemorySpaceNode]:
    """Return space nodes for memories touched by the current event."""

    return [node for node in memory_space if node.memory_id in activated_memory_ids]


def _build_node(memory: Memory) -> MemorySpaceNode:
    """Calculate one memory's runtime space position."""

    influence = _memory_influence(memory)
    layer = _layer_for_influence(influence)
    core_distance = round(max(0.0, 1.0 - influence / 100), 3)

    reason = (
        f"impact={memory.impact}, activation_count={memory.activation_count}, "
        f"influence={influence:.1f}"
    )

    return MemorySpaceNode(
        memory_id=memory.id,
        layer=layer,
        core_distance=core_distance,
        influence=influence,
        reason=reason,
    )


def _memory_influence(memory: Memory) -> float:
    """Estimate how close a memory is to the personality core."""

    activation_bonus = min(memory.activation_count * 3, 15)
    return min(100.0, memory.impact + activation_bonus)


def _layer_for_influence(influence: float) -> str:
    """Map influence to a simple memory-space layer."""

    if influence >= 90:
        return "core"
    if influence >= 70:
        return "near_core"
    if influence >= 40:
        return "middle"
    return "boundary"
