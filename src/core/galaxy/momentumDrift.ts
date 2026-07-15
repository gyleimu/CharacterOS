import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import { zeroCoordinateDelta, type PersonalityCoordinate } from "../personality/coordinate";
import type { PersonalityCore } from "./personalityCore";

export interface MomentumDriftResult {
  before: PersonalityCoordinate;
  after: PersonalityCoordinate;
  previousVelocity: PersonalityCoordinate;
  nextVelocity: PersonalityCoordinate;
  force: PersonalityCoordinate;
}

export function applyMomentumDrift(core: PersonalityCore, force: PersonalityCoordinate): MomentumDriftResult {
  const nextVelocity = zeroCoordinateDelta();

  for (const key of BASE_PERSONALITY_KEYS) {
    nextVelocity.values[key] = clampSigned(
      core.velocity.values[key] * core.momentumAlpha +
      force.values[key] * core.learningRate,
      0.08
    );
  }

  const after: PersonalityCoordinate = { values: { ...core.position.values } };
  for (const key of BASE_PERSONALITY_KEYS) {
    after.values[key] = clamp01Precise(core.position.values[key] + nextVelocity.values[key]);
  }
  return {
    before: core.position,
    after,
    previousVelocity: core.velocity,
    nextVelocity,
    force
  };
}

function clampSigned(value: number, limit: number): number {
  if (value > limit) return round8(limit);
  if (value < -limit) return round8(-limit);
  return round8(value);
}

function clamp01Precise(value: number): number {
  return Math.max(0, Math.min(1, round8(value)));
}

function round8(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
