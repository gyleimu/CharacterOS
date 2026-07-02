"""Personality coordinate space for Character Physics.

The core vector can start with Big Five, but the coordinate system must be able
to grow. This module defines named axes, initial presets, and basic coordinate
operations without replacing the existing Big Five drift vector yet.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from personality.vector import PersonalityVector


@dataclass(frozen=True)
class PersonalityDimension:
    """Metadata for one personality-space axis."""

    key: str
    label: str
    description: str
    low_anchor: str
    high_anchor: str


@dataclass(frozen=True)
class PersonalityCoordinate:
    """A named coordinate in personality space."""

    values: dict[str, float]

    def get(self, key: str) -> float:
        """Read one axis value."""

        return self.values[key]

    def add_delta(self, delta: dict[str, float], scale: float = 1.0) -> "PersonalityCoordinate":
        """Return a new coordinate after applying a scaled delta."""

        values = dict(self.values)
        for key, value in delta.items():
            values[key] = _clip(values.get(key, 0.5) + value * scale)
        return PersonalityCoordinate(values=values)

    def distance_to(self, other: "PersonalityCoordinate") -> float:
        """Euclidean distance across shared axes."""

        keys = sorted(set(self.values) & set(other.values))
        if not keys:
            return 0.0
        squared = sum((self.values[key] - other.values[key]) ** 2 for key in keys)
        return round(sqrt(squared), 4)

    def to_dict(self) -> dict[str, float]:
        """Serialize with stable ordering and rounded values."""

        return {key: round(self.values[key], 4) for key in sorted(self.values)}


BASE_PERSONALITY_DIMENSIONS = (
    PersonalityDimension(
        key="openness",
        label="开放性",
        description="对新经验、新解释和复杂性的接受程度。",
        low_anchor="保守、封闭、抗拒新解释",
        high_anchor="开放、好奇、愿意重新理解",
    ),
    PersonalityDimension(
        key="conscientiousness",
        label="尽责性",
        description="秩序感、自控和对承诺的执行倾向。",
        low_anchor="松散、冲动、低规划",
        high_anchor="克制、有序、重视承诺",
    ),
    PersonalityDimension(
        key="extroversion",
        label="外向性",
        description="主动表达、社交能量和外部探索倾向。",
        low_anchor="内向、退缩、少表达",
        high_anchor="外向、主动、外显表达",
    ),
    PersonalityDimension(
        key="agreeableness",
        label="宜人性",
        description="信任、合作、柔和回应和关系修复倾向。",
        low_anchor="防御、怀疑、关系中较硬",
        high_anchor="信任、体谅、关系中较软",
    ),
    PersonalityDimension(
        key="neuroticism",
        label="神经质",
        description="威胁敏感、焦虑、情绪波动和痛苦记忆唤起倾向。",
        low_anchor="稳定、低焦虑、恢复快",
        high_anchor="敏感、高焦虑、恢复慢",
    ),
    PersonalityDimension(
        key="trust",
        label="信任",
        description="相信他人不会伤害、欺骗或突然离开的倾向。",
        low_anchor="不信任、预设背叛或离开",
        high_anchor="信任、愿意相信善意",
    ),
    PersonalityDimension(
        key="attachment",
        label="依恋",
        description="对少数亲密对象形成依赖和连接需求的强度。",
        low_anchor="低依赖、可独处、关系需求弱",
        high_anchor="高依赖、强连接需求、害怕断联",
    ),
    PersonalityDimension(
        key="fear",
        label="恐惧",
        description="面对关系风险和不确定事件时的恐惧基线。",
        low_anchor="低恐惧、敢冒关系风险",
        high_anchor="高恐惧、回避风险、警觉",
    ),
    PersonalityDimension(
        key="control",
        label="控制感",
        description="希望关系和事件可预测、可解释、可掌控的倾向。",
        low_anchor="接受混乱、不强求解释",
        high_anchor="需要解释、边界和可预测性",
    ),
)


def base_dimension_keys() -> list[str]:
    """Return the active V1 coordinate keys."""

    return [dimension.key for dimension in BASE_PERSONALITY_DIMENSIONS]


def neutral_coordinate() -> PersonalityCoordinate:
    """Return neutral coordinates across all active axes."""

    return PersonalityCoordinate(values={key: 0.5 for key in base_dimension_keys()})


def zero_coordinate_delta() -> PersonalityCoordinate:
    """Return a zero delta across all active axes."""

    return PersonalityCoordinate(values={key: 0.0 for key in base_dimension_keys()})


def lin_fan_initial_coordinate() -> PersonalityCoordinate:
    """Initial personality-space coordinate for Lin Fan."""

    return PersonalityCoordinate(
        values={
            "openness": 0.42,
            "conscientiousness": 0.56,
            "extroversion": 0.24,
            "agreeableness": 0.44,
            "neuroticism": 0.78,
            "trust": 0.26,
            "attachment": 0.86,
            "fear": 0.82,
            "control": 0.68,
        }
    )


def big_five_from_coordinate(coordinate: PersonalityCoordinate) -> PersonalityVector:
    """Extract the current Big Five drift vector from a wider coordinate."""

    return PersonalityVector(
        openness=coordinate.get("openness"),
        conscientiousness=coordinate.get("conscientiousness"),
        extroversion=coordinate.get("extroversion"),
        agreeableness=coordinate.get("agreeableness"),
        neuroticism=coordinate.get("neuroticism"),
    )


def coordinate_from_big_five(vector: PersonalityVector) -> PersonalityCoordinate:
    """Create a wider coordinate from a Big Five vector and neutral extra axes."""

    coordinate = neutral_coordinate()
    return coordinate.add_delta(
        {
            "openness": vector.openness - 0.5,
            "conscientiousness": vector.conscientiousness - 0.5,
            "extroversion": vector.extroversion - 0.5,
            "agreeableness": vector.agreeableness - 0.5,
            "neuroticism": vector.neuroticism - 0.5,
        }
    )


def _clip(value: float) -> float:
    """Clip coordinate values to [0, 1]."""

    return max(0.0, min(1.0, value))
