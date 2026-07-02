import type { CharacterPhysicsState } from "@/core/physics/physicsEngine";
import type {
  LongitudinalSimulationRequest,
  LongitudinalSimulationResult,
} from "@/core/life/longitudinalSimulation";

export interface LongitudinalCommitRouteSimulationBody {
  totalHours: number;
  stepHours: number;
  seed?: string;
  observed?: boolean;
  includeDecision?: boolean;
  includeExplanation?: boolean;
  commitPolicy?: LongitudinalSimulationRequest["commitPolicy"];
  lifeOptions?: LongitudinalSimulationRequest["lifeOptions"];
}

export function buildCommitSimulationRequest(
  characterId: string,
  body: LongitudinalCommitRouteSimulationBody
): LongitudinalSimulationRequest {
  const request: LongitudinalSimulationRequest = {
    characterId,
    totalHours: body.totalHours,
    stepHours: body.stepHours,
    seed: body.seed ?? `${characterId}:${body.totalHours}:${body.stepHours}:commit-preview`,
    observed: body.observed ?? true,
    includeDecision: body.includeDecision ?? false,
    includeExplanation: body.includeExplanation ?? false,
  };
  if (body.commitPolicy) request.commitPolicy = body.commitPolicy;
  if (body.lifeOptions) request.lifeOptions = body.lifeOptions;
  return request;
}

export function extractFinalCommittedState(
  result: LongitudinalSimulationResult,
  baseState: CharacterPhysicsState
): CharacterPhysicsState {
  for (let i = result.steps.length - 1; i >= 0; i--) {
    const committedState = result.steps[i]?.commitResult?.state;
    if (committedState) return committedState;
  }
  return baseState;
}
