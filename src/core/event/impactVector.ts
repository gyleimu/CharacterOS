import type { PersonalityCoordinate } from "../personality/coordinate";

export interface EventImpactVector {
  delta: PersonalityCoordinate;
  category: string;
  rationale: string;
}
