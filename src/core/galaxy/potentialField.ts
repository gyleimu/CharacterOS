import type { ImpactCluster } from "../cluster/impactCluster";
import { clamp01, round4 } from "../parameters/parameterMath";
import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import { coordinateDistance, zeroCoordinateDelta, type PersonalityCoordinate } from "../personality/coordinate";

export interface ClusterForce {
  clusterId: string;
  category: string;
  distance: number;
  magnitude: number;
  vector: PersonalityCoordinate;
}

/** Reference mass for sqrt saturation — at this mass, effectiveMass = mass. */
const MASS_SATURATION_REF = 5;

/**
 * Convert raw cluster mass into effective mass with diminishing returns.
 * Uses sqrt saturation: effectiveMass = sqrt(mass * ref).
 * At mass=ref, effectiveMass = ref (identity).
 * At mass=4*ref, effectiveMass = 2*ref (only 2× instead of 4×).
 * This prevents unbounded force growth from repeated similar events.
 */
export function saturatedMass(mass: number): number {
  return Math.sqrt(Math.max(0, mass) * MASS_SATURATION_REF);
}

export function calculateClusterForce(params: {
  corePosition: PersonalityCoordinate;
  cluster: ImpactCluster;
  gravitationalConstant?: number;
  minDistance?: number;
  maxMagnitude?: number;
}): ClusterForce {
  const gravitationalConstant = params.gravitationalConstant ?? 0.08;
  const minDistance = params.minDistance ?? 0.08;
  const maxMagnitude = params.maxMagnitude ?? 0.35;
  const distance = Math.max(
    minDistance,
    coordinateDistance(params.corePosition, params.cluster.centerCoordinate)
  );
  const densityFactor = 0.72 + clamp01(params.cluster.density) * 0.28;
  // V10.72: use sqrt-saturated mass so repeated similar events have diminishing marginal force
  const effectiveMass = saturatedMass(params.cluster.mass);
  const rawMagnitude =
    gravitationalConstant *
    effectiveMass *
    Math.max(params.cluster.stability, 0.05) *
    densityFactor /
    (distance ** 2);
  const magnitude = round4(Math.min(maxMagnitude, rawMagnitude));
  const vector = zeroCoordinateDelta();

  for (const key of BASE_PERSONALITY_KEYS) {
    const direction = params.cluster.centerCoordinate.values[key];
    vector.values[key] = round4(direction * magnitude);
  }

  return {
    clusterId: params.cluster.id,
    category: params.cluster.category,
    distance: round4(distance),
    magnitude,
    vector
  };
}

export function sumClusterForces(forces: ClusterForce[]): PersonalityCoordinate {
  const total = zeroCoordinateDelta();
  for (const force of forces) {
    for (const key of BASE_PERSONALITY_KEYS) {
      total.values[key] = round4(total.values[key] + force.vector.values[key]);
    }
  }
  return total;
}
