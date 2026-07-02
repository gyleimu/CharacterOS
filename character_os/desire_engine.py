"""Desire activation for CharacterOS v0.04.

Desires should emerge from deficiencies. This module keeps that idea explicit:
it does not assign goals to a character directly, but maps current deficiencies
to the desires most likely to shape behavior in the current event.
"""

from __future__ import annotations

from dataclasses import dataclass

from models import ActivatedDeficiency, ActivatedDesire


@dataclass(frozen=True)
class DesireRule:
    """A transparent rule that maps a deficiency to an emerging desire."""

    deficiency_name: str
    desire_name: str
    description: str
    likely_behavior: str


DESIRE_RULES = (
    DesireRule(
        deficiency_name="稳定关系的缺失",
        desire_name="渴望关系变得可预测",
        description="希望对方给出明确解释，让关系重新变得稳定、可判断。",
        likely_behavior="会追求解释和边界，但表达方式偏克制。",
    ),
    DesireRule(
        deficiency_name="安全感的缺失",
        desire_name="渴望确认自己不会被抛下",
        description="希望获得不会被突然离开、不会被再次丢下的确认。",
        likely_behavior="会先观察对方态度，再决定是否靠近。",
    ),
    DesireRule(
        deficiency_name="被爱确认的缺失",
        desire_name="渴望被选择和被在乎",
        description="希望确认自己对对方仍然重要，而不是可有可无。",
        likely_behavior="会等待对方主动说明和安抚，很难直接索取。",
    ),
)


def activate_desires(
    activated_deficiencies: list[ActivatedDeficiency],
    top_k: int = 5,
) -> list[ActivatedDesire]:
    """Infer desires from activated deficiencies."""

    desires: list[ActivatedDesire] = []

    for deficiency in activated_deficiencies:
        rule = _find_rule(deficiency.name)
        if rule is None:
            continue

        desires.append(
            ActivatedDesire(
                name=rule.desire_name,
                description=rule.description,
                strength=deficiency.strength,
                source_deficiencies=[deficiency.name],
                likely_behavior=rule.likely_behavior,
            )
        )

    desires.sort(key=lambda item: item.strength, reverse=True)
    return desires[:top_k]


def _find_rule(deficiency_name: str) -> DesireRule | None:
    """Find the desire rule for a deficiency name."""

    for rule in DESIRE_RULES:
        if rule.deficiency_name == deficiency_name:
            return rule
    return None
