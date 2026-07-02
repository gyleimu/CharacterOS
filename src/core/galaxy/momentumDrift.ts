import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import { addCoordinateDelta, zeroCoordinateDelta, type PersonalityCoordinate } from "../personality/coordinate";
import { round4 } from "../parameters/parameterMath";
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

  const after = addCoordinateDelta(core.position, nextVelocity.values, 1);
  return {
    before: core.position,
    after,
    previousVelocity: core.velocity,
    nextVelocity,
    force
  };
}

function clampSigned(value: number, limit: number): number {
  if (value > limit) return round4(limit);
  if (value < -limit) return round4(-limit);
  return round4(value);
}
