import type { PersonalityCoordinateValues } from "../personality/coordinate";

export interface ExperienceEvent {
  id: string;
  description: string;
  tags: string[];
  intensity: number;
  importance: number;
  relationshipWeight: number;
  expectationGap: number;
  personalitySensitivity: number;
  category?: string;
  emotion?: string;
  emotionValence?: number;
  emotionArousal?: number;
  coordinateDelta?: Partial<PersonalityCoordinateValues>;
  beliefEffect?: string;
  rationale?: string;
  /** Optional ISO-8601 event time consumed by Temporal Semantics. */
  occurredAt?: string;
}
