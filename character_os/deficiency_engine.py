"""Deficiency activation for CharacterOS v0.03.

Deficiencies are not manually chosen personality labels. In this small version,
they are inferred from activated beliefs: a belief about abandonment points to a
lack of stable attachment, while a belief about unreliable intimacy points to a
lack of relational safety.
"""

from __future__ import annotations

from dataclasses import dataclass

from models import ActivatedBelief, ActivatedDeficiency


@dataclass(frozen=True)
class DeficiencyRule:
    """A transparent keyword rule that maps beliefs to deficiencies."""

    name: str
    description: str
    keywords: tuple[str, ...]


DEFICIENCY_RULES = (
    DeficiencyRule(
        name="稳定关系的缺失",
        description="缺少一种重要的人不会突然离开的稳定感。",
        keywords=("离开", "抛弃", "失联", "不可靠"),
    ),
    DeficiencyRule(
        name="安全感的缺失",
        description="缺少在亲密关系中可以放下警觉的安全感。",
        keywords=("不可靠", "没有结果", "突然", "等待"),
    ),
    DeficiencyRule(
        name="被爱确认的缺失",
        description="缺少被持续选择、被明确回应和被珍视的确认。",
        keywords=("被爱", "靠近", "重要的人", "王雪", "亲密关系"),
    ),
)


def activate_deficiencies(
    activated_beliefs: list[ActivatedBelief],
    top_k: int = 5,
) -> list[ActivatedDeficiency]:
    """Infer current deficiencies from activated beliefs."""

    deficiency_map: dict[str, ActivatedDeficiency] = {}

    for belief in activated_beliefs:
        for rule in DEFICIENCY_RULES:
            matched_keywords = _matched_keywords(belief.content, rule.keywords)
            if not matched_keywords:
                continue

            strength = belief.strength + len(matched_keywords) * 5
            evidence = f"{belief.content} -> 命中: {'、'.join(matched_keywords)}"

            if rule.name not in deficiency_map:
                deficiency_map[rule.name] = ActivatedDeficiency(
                    name=rule.name,
                    description=rule.description,
                    strength=strength,
                    source_beliefs=[belief.content],
                    evidence=[evidence],
                )
                continue

            deficiency = deficiency_map[rule.name]
            deficiency.strength += strength
            if belief.content not in deficiency.source_beliefs:
                deficiency.source_beliefs.append(belief.content)
            if evidence not in deficiency.evidence:
                deficiency.evidence.append(evidence)

    deficiencies = list(deficiency_map.values())
    deficiencies.sort(key=lambda item: item.strength, reverse=True)
    return deficiencies[:top_k]


def _matched_keywords(content: str, keywords: tuple[str, ...]) -> list[str]:
    """Return rule keywords that appear in a belief."""

    return [keyword for keyword in keywords if keyword in content]
