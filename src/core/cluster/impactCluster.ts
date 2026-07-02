import { bigFiveFromCoordinate, zeroCoordinateDelta, type BigFiveVector, type PersonalityCoordinate } from "../personality/coordinate";
import type { EventImpactVector } from "../event/impactVector";
import { round4 } from "../parameters/parameterMath";

export interface ImpactParticle {
  id: string;
  description: string;
  vector: EventImpactVector;
  impactScore: number;
  emotion: string;
  category: string;
}

export interface ImpactCluster {
  id: string;
  category: string;
  centerCoordinate: PersonalityCoordinate;
  centerVector: BigFiveVector;
  mass: number;
  density: number;
  stability: number;
  age: number;
  particleIds: string[];
}

export function createImpactCluster(id: string, category: string): ImpactCluster {
  const centerCoordinate = zeroCoordinateDelta();
  return {
    id,
    category,
    centerCoordinate,
    centerVector: bigFiveFromCoordinate(centerCoordinate),
    mass: 0,
    density: 0,
    stability: 0,
    age: 0,
    particleIds: []
  };
}

export function absorbImpactParticle(cluster: ImpactCluster, particle: ImpactParticle): ImpactCluster {
  const totalMass = cluster.mass + particle.impactScore;
  if (totalMass <= 0) return cluster;

  const oldWeight = cluster.mass / totalMass;
  const newWeight = particle.impactScore / totalMass;
  const values = { ...cluster.centerCoordinate.values };

  for (const key of Object.keys(values) as Array<keyof typeof values>) {
    values[key] =
      cluster.centerCoordinate.values[key] * oldWeight +
      particle.vector.delta.values[key] * newWeight;
  }

  const centerCoordinate = { values };
  const age = cluster.age + 1;
  const particleIds = [...cluster.particleIds, particle.id];
  const mass = round4(totalMass);
  const density = round4(Math.min(1, particleIds.length / 10));
  const stability = round4(Math.min(1, mass * density));

  return {
    ...cluster,
    centerCoordinate,
    centerVector: bigFiveFromCoordinate(centerCoordinate),
    mass,
    density,
    stability,
    age,
    particleIds
  };
}
