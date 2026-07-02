import { clamp01, round4 as roundParameterValue } from "../parameters/parameterMath";
import { BASE_PERSONALITY_KEYS, type PersonalityDimensionKey } from "./dimensions";

export type PersonalityCoordinateValues = Record<PersonalityDimensionKey, number>;

export interface PersonalityCoordinate {
  values: PersonalityCoordinateValues;
}

export interface BigFiveVector {
  openness: number;
  conscientiousness: number;
  extroversion: number;
  agreeableness: number;
  neuroticism: number;
}

export function clip01(value: number): number {
  return clamp01(value);
}

export function round4(value: number): number {
  return roundParameterValue(value);
}

export function neutralCoordinate(): PersonalityCoordinate {
  return {
    values: Object.fromEntries(BASE_PERSONALITY_KEYS.map((key) => [key, 0.5])) as PersonalityCoordinateValues
  };
}

export function zeroCoordinateDelta(): PersonalityCoordinate {
  return {
    values: Object.fromEntries(BASE_PERSONALITY_KEYS.map((key) => [key, 0])) as PersonalityCoordinateValues
  };
}

export function addCoordinateDelta(
  coordinate: PersonalityCoordinate,
  delta: Partial<Record<PersonalityDimensionKey, number>>,
  scale = 1
): PersonalityCoordinate {
  const values = { ...coordinate.values };
  for (const key of Object.keys(delta) as PersonalityDimensionKey[]) {
    values[key] = clip01(values[key] + (delta[key] ?? 0) * scale);
  }
  return { values };
}

export function coordinateDistance(a: PersonalityCoordinate, b: PersonalityCoordinate): number {
  const squared = BASE_PERSONALITY_KEYS.reduce((sum, key) => {
    return sum + (a.values[key] - b.values[key]) ** 2;
  }, 0);
  return round4(Math.sqrt(squared));
}

export function coordinateToRecord(coordinate: PersonalityCoordinate): PersonalityCoordinateValues {
  return Object.fromEntries(
    BASE_PERSONALITY_KEYS.map((key) => [key, round4(coordinate.values[key])])
  ) as PersonalityCoordinateValues;
}

export function linFanInitialCoordinate(): PersonalityCoordinate {
  return {
    values: {
      openness: 0.42,
      conscientiousness: 0.56,
      extroversion: 0.24,
      agreeableness: 0.44,
      neuroticism: 0.78,
      trust: 0.26,
      attachment: 0.86,
      fear: 0.82,
      control: 0.68
    }
  };
}

export function bigFiveFromCoordinate(coordinate: PersonalityCoordinate): BigFiveVector {
  return {
    openness: coordinate.values.openness,
    conscientiousness: coordinate.values.conscientiousness,
    extroversion: coordinate.values.extroversion,
    agreeableness: coordinate.values.agreeableness,
    neuroticism: coordinate.values.neuroticism
  };
}

export function coordinateFromBigFive(vector: BigFiveVector): PersonalityCoordinate {
  const coordinate = neutralCoordinate();
  return {
    values: {
      ...coordinate.values,
      openness: vector.openness,
      conscientiousness: vector.conscientiousness,
      extroversion: vector.extroversion,
      agreeableness: vector.agreeableness,
      neuroticism: vector.neuroticism
    }
  };
}
