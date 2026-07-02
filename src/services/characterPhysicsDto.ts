import type {
  ContinuousTickResponse,
  GetCharacterImportTransitionHistoryResponse,
  GetCharacterPhysicsStateResponse,
  ApplyParameterAdjustmentResponse,
  GetParameterAdjustmentHistoryResponse,
  ProcessEventResponse,
  RollbackParameterAdjustmentResponse,
  SimulateEventsResponse
} from "../appContracts/characterPhysics";
import { summarizeCharacterImportTransitionHistory } from "../core/export/characterImportTransitionHistory";
import type { ParameterAdjustmentApplyTrace } from "../core/parameters/parameterAdjustmentApply";
import { summarizeParameterAdjustmentHistory } from "../core/parameters/parameterAdjustmentHistory";
import { evaluateParameterAdjustmentGovernance } from "../core/parameters/parameterAdjustmentGovernance";
import type { ContinuousTickTrace } from "../core/time/continuousTick";
import type { PhysicsStepResult } from "../core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../core/physics/serialization";
import type { SimulationResult } from "../core/simulation/runner";
import { inspectCharacterStateIntegrity } from "../core/state/stateIntegrity";
import { toGalaxyStepTrace } from "../core/trace/galaxyTrace";
import type { CharacterPhysicsService } from "./characterPhysicsService";

export function toGetStateResponse(
  characterId: string,
  service: CharacterPhysicsService
): GetCharacterPhysicsStateResponse {
  const state = service.getState(characterId);
  return {
    characterId,
    state: serializeCharacterPhysicsState(state),
    integrity: inspectCharacterStateIntegrity(state)
  };
}

export function toProcessEventResponse(
  characterId: string,
  service: CharacterPhysicsService,
  result: PhysicsStepResult
): ProcessEventResponse {
  return {
    characterId,
    eventId: result.event.id,
    memoryId: result.memoryNode.id,
    category: result.particle.category,
    impactScore: result.impactScore.value,
    clusterId: result.cluster.id,
    clusterMass: result.cluster.mass,
    clusterStability: result.cluster.stability,
    boundaryImpact: result.boundaryImpact,
    galaxyTrace: toGalaxyStepTrace(result),
    proceduralActivations: result.proceduralActivations,
    rewardResult: result.rewardResult,
    timePerception: result.timePerception,
    worldInterpretation: result.worldInterpretation,
    attentionEvaluation: result.attentionEvaluation,
    state: serializeCharacterPhysicsState(service.getState(characterId))
  };
}

export function toSimulateEventsResponse(
  characterId: string,
  result: SimulationResult
): SimulateEventsResponse {
  return {
    characterId,
    snapshots: result.snapshots,
    state: serializeCharacterPhysicsState(result.finalState)
  };
}

export function toContinuousTickResponse(
  characterId: string,
  service: CharacterPhysicsService,
  trace: ContinuousTickTrace
): ContinuousTickResponse {
  return {
    characterId,
    trace,
    state: serializeCharacterPhysicsState(service.getState(characterId))
  };
}

export function toApplyParameterAdjustmentResponse(
  characterId: string,
  service: CharacterPhysicsService,
  trace: ParameterAdjustmentApplyTrace
): ApplyParameterAdjustmentResponse {
  return {
    characterId,
    trace,
    state: serializeCharacterPhysicsState(service.getState(characterId))
  };
}

export function toRollbackParameterAdjustmentResponse(
  characterId: string,
  service: CharacterPhysicsService,
  trace: ParameterAdjustmentApplyTrace
): RollbackParameterAdjustmentResponse {
  return {
    characterId,
    trace,
    state: serializeCharacterPhysicsState(service.getState(characterId))
  };
}

export function toGetParameterAdjustmentHistoryResponse(
  characterId: string,
  service: CharacterPhysicsService
): GetParameterAdjustmentHistoryResponse {
  const history = service.getParameterAdjustmentHistory(characterId);
  const summary = summarizeParameterAdjustmentHistory(history);
  return {
    characterId,
    history,
    summary,
    governance: evaluateParameterAdjustmentGovernance(summary)
  };
}

export function toGetCharacterImportTransitionHistoryResponse(
  characterId: string,
  service: CharacterPhysicsService
): GetCharacterImportTransitionHistoryResponse {
  const history = service.getImportTransitionHistory(characterId);
  return {
    characterId,
    history,
    summary: summarizeCharacterImportTransitionHistory(history)
  };
}
