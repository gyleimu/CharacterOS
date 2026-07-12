import { effectiveMemoryWeight, decayMemories } from "../memory/decay";
import { syncClustersWithGalaxyMetrics } from "../galaxy/clusterMetrics";
import type { BoundaryImpactResult } from "../boundary/psychologicalBoundary";
import {
  CharacterPhysicsEngine,
  type CharacterPhysicsState,
  type PhysicsStepResult
} from "../physics/physicsEngine";
import type { ExperienceEvent } from "../event/event";
import type { PersonalityCoordinateValues } from "../personality/coordinate";
import { coordinateToRecord } from "../personality/coordinate";
import { toGalaxyStepTrace, type GalaxyStepTrace } from "../trace/galaxyTrace";
import type { EventTemporalTrace } from "../time/eventTemporalSemantics";
import { UNKNOWN_EVENT_OCCURRED_AT } from "../time/eventTemporalSemantics";

export interface SimulationSnapshot {
  step: number;
  eventId: string;
  memoryId: string;
  category: string;
  impactScore: number;
  memoryRepetitionCount: number;
  memoryRecency: number;
  memoryEffectiveWeight: number;
  clusterMass: number;
  clusterDensity: number;
  clusterStability: number;
  clusterAge: number;
  force: PersonalityCoordinateValues;
  velocity: PersonalityCoordinateValues;
  coordinate: PersonalityCoordinateValues;
  boundaryImpact: BoundaryImpactResult;
  galaxyTrace: GalaxyStepTrace;
  temporalSemantics: EventTemporalTrace;
}

export interface SimulationResult {
  snapshots: SimulationSnapshot[];
  finalState: CharacterPhysicsState;
}

export function runEventSequence(params: {
  state: CharacterPhysicsState;
  events: ExperienceEvent[];
  engine?: CharacterPhysicsEngine;
  daysPerStep?: number;
}): SimulationResult {
  const engine = params.engine ?? new CharacterPhysicsEngine();
  const snapshots: SimulationSnapshot[] = [];

  params.events.forEach((event, index) => {
    const hasExplicitEventTime = Boolean(
      event.occurredAt &&
      event.occurredAt !== UNKNOWN_EVENT_OCCURRED_AT &&
      Number.isFinite(Date.parse(event.occurredAt)),
    );
    // daysPerStep is a legacy memory-only simulation control. Explicit event
    // timestamps own elapsed-time recovery and must not be decayed twice.
    if ((params.daysPerStep ?? 0) > 0 && params.state.memories.length > 0 && !hasExplicitEventTime) {
      params.state.memories = decayMemories(params.state.memories, params.daysPerStep ?? 0);
      params.state.clusters = syncClustersWithGalaxyMetrics(params.state.clusters, params.state.memories);
    }
    const step = engine.processEvent(params.state, event);
    snapshots.push(snapshot(index + 1, step, params.state));
  });

  return { snapshots, finalState: params.state };
}

function snapshot(
  stepIndex: number,
  step: PhysicsStepResult,
  state: CharacterPhysicsState
): SimulationSnapshot {
  return {
    step: stepIndex,
    eventId: step.event.id,
    memoryId: step.memoryNode.id,
    category: step.particle.category,
    impactScore: step.impactScore.value,
    memoryRepetitionCount: step.memoryNode.repetitionCount,
    memoryRecency: step.memoryNode.recency,
    memoryEffectiveWeight: effectiveMemoryWeight(step.memoryNode),
    clusterMass: step.cluster.mass,
    clusterDensity: step.cluster.density,
    clusterStability: step.cluster.stability,
    clusterAge: step.cluster.age,
    force: coordinateToRecord(step.coordinateDrift.totalForce),
    velocity: coordinateToRecord(state.velocity),
    coordinate: coordinateToRecord(step.coordinateDrift.after),
    boundaryImpact: step.boundaryImpact,
    galaxyTrace: toGalaxyStepTrace(step),
    temporalSemantics: step.temporalSemantics,
  };
}
