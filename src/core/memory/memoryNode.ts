import type { PersonalityCoordinate } from "../personality/coordinate";

export interface MemoryNode {
  id: string;
  content: string;
  vector: PersonalityCoordinate;
  importance: number;
  emotion: string;
  recency: number;
  repetitionCount: number;
  beliefEffect: string;
  timeStamp: string;
  clusterId?: string;
}
