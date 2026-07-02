import { zeroCoordinateDelta, type PersonalityCoordinate } from "../personality/coordinate";

export interface PersonalityCore {
  position: PersonalityCoordinate;
  velocity: PersonalityCoordinate;
  learningRate: number;
  momentumAlpha: number;
}

export function createPersonalityCore(params: {
  position: PersonalityCoordinate;
  learningRate?: number;
  momentumAlpha?: number;
  velocity?: PersonalityCoordinate;
}): PersonalityCore {
  return {
    position: params.position,
    velocity: params.velocity ?? zeroCoordinateDelta(),
    learningRate: params.learningRate ?? 0.03,
    momentumAlpha: params.momentumAlpha ?? 0.82
  };
}
