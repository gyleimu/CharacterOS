import type { ImpactCluster } from "../cluster/impactCluster";
import type { MemoryNode } from "../memory/memoryNode";
import type { PersonalityCoordinate } from "../personality/coordinate";
import { calculateGalaxyClusterMetrics, type GalaxyClusterMetrics } from "./clusterMetrics";
import { applyMomentumDrift, type MomentumDriftResult } from "./momentumDrift";
import { createPersonalityCore } from "./personalityCore";
import { calculateClusterForce, sumClusterForces, type ClusterForce } from "./potentialField";

export interface PersonalityGalaxySnapshot {
  forces: ClusterForce[];
  totalForce: PersonalityCoordinate;
  drift: MomentumDriftResult;
  clusterMetrics: Array<{
    clusterId: string;
    category: string;
    metrics: GalaxyClusterMetrics;
  }>;
}

export function simulatePersonalityGalaxyStep(params: {
  corePosition: PersonalityCoordinate;
  clusters: ImpactCluster[];
  memories: MemoryNode[];
  velocity?: PersonalityCoordinate;
  learningRate?: number;
  momentumAlpha?: number;
}): PersonalityGalaxySnapshot {
  const coreParams: Parameters<typeof createPersonalityCore>[0] = {
    position: params.corePosition
  };
  if (params.velocity) {
    coreParams.velocity = params.velocity;
  }
  if (params.learningRate !== undefined) {
    coreParams.learningRate = params.learningRate;
  }
  if (params.momentumAlpha !== undefined) {
    coreParams.momentumAlpha = params.momentumAlpha;
  }
  const core = createPersonalityCore(coreParams);
  const clusterMetrics = params.clusters.map((cluster) => ({
    clusterId: cluster.id,
    category: cluster.category,
    metrics: calculateGalaxyClusterMetrics(cluster, params.memories)
  }));
  const adjustedClusters = params.clusters.map((cluster) => {
    const metrics = clusterMetrics.find((item) => item.clusterId === cluster.id)?.metrics;
    return metrics
      ? { ...cluster, mass: metrics.mass, density: metrics.density, stability: metrics.stability }
      : cluster;
  });
  const forces = adjustedClusters.map((cluster) => calculateClusterForce({
    corePosition: params.corePosition,
    cluster
  }));
  const totalForce = sumClusterForces(forces);

  return {
    forces,
    totalForce,
    drift: applyMomentumDrift(core, totalForce),
    clusterMetrics
  };
}
