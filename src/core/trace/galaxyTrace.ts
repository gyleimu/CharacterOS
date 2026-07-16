import type { BoundaryImpactResult } from "../boundary/psychologicalBoundary";
import type { PersonalityCoordinate } from "../personality/coordinate";
import type { PhysicsStepResult } from "../physics/physicsEngine";
import type { EventTemporalTrace } from "../time/eventTemporalSemantics";

export interface GalaxyStepTrace {
  forces: Array<{
    clusterId: string;
    category: string;
    distance: number;
    magnitude: number;
    vector: PersonalityCoordinate;
  }>;
  totalForce: PersonalityCoordinate;
  previousVelocity: PersonalityCoordinate;
  nextVelocity: PersonalityCoordinate;
  before: PersonalityCoordinate;
  after: PersonalityCoordinate;
  clusterMetrics: Array<{
    clusterId: string;
    category: string;
    mass: number;
    density: number;
    stability: number;
    variance: number;
  }>;
}

export interface PhysicsStepTrace {
  eventId: string;
  category: string;
  impactScore: number;
  boundaryImpact: BoundaryImpactResult;
  galaxyTrace: GalaxyStepTrace;
  temporalSemantics: EventTemporalTrace;
}

export function toGalaxyStepTrace(result: PhysicsStepResult): GalaxyStepTrace {
  return {
    forces: result.galaxyStep.forces.map((force) => ({
      clusterId: force.clusterId,
      category: force.category,
      distance: force.distance,
      magnitude: force.magnitude,
      vector: force.vector
    })),
    totalForce: result.galaxyStep.totalForce,
    previousVelocity: result.galaxyStep.drift.previousVelocity,
    nextVelocity: result.galaxyStep.drift.nextVelocity,
    before: result.galaxyStep.drift.before,
    after: result.galaxyStep.drift.after,
    clusterMetrics: result.galaxyStep.clusterMetrics.map((item) => ({
      clusterId: item.clusterId,
      category: item.category,
      mass: item.metrics.mass,
      density: item.metrics.density,
      stability: item.metrics.stability,
      variance: item.metrics.variance
    }))
  };
}

export function toPhysicsStepTrace(result: PhysicsStepResult): PhysicsStepTrace {
  return {
    eventId: result.event.id,
    category: result.particle.category,
    impactScore: result.impactScore.value,
    boundaryImpact: result.boundaryImpact,
    galaxyTrace: toGalaxyStepTrace(result),
    temporalSemantics: result.temporalSemantics,
  };
}
