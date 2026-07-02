"""Emotion state as a fast variable."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EmotionState:
    """A compact emotional state produced by an event."""

    primary: str
    valence: float
    arousal: float
    intensity: float
