import type { ImpactCluster } from "../cluster/impactCluster";
import type { MemoryNode } from "../memory/memoryNode";
import { round4 } from "../parameters/parameterMath";
import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import type { PersonalityCoordinate } from "../personality/coordinate";

export interface GalaxyClusterMetrics {
  mass: number;
  density: number;
  stability: number;
  variance: number;
}

export function calculateGalaxyClusterMetrics(
  cluster: ImpactCluster,
  memories: MemoryNode[]
): GalaxyClusterMetrics {
  const clusterMemories = memories.filter((memory) => memory.clusterId === cluster.id);
  if (!clusterMemories.length) {
    return {
      mass: cluster.mass,
      density: cluster.density,
      stability: cluster.stability,
      variance: 0
    };
  }

  const mass = round4(
    clusterMemories.reduce((sum, memory) => {
      // Imported/seeded memories may summarize repeated experiences, while
      // runtime events are represented by one MemoryNode per occurrence.
      // Recency keeps old memories influential without giving them permanent
      // full-strength gravity.
      const recencyWeight = 0.25 + Math.max(0, Math.min(1, memory.recency)) * 0.75;
      return sum + memory.importance * Math.max(1, memory.repetitionCount) * recencyWeight;
    }, 0)
  );
  const variance = round4(calculateVariance(cluster.centerCoordinate, clusterMemories));
  const density = round4(clusterMemories.length / (1 + variance * 10));
  const stability = round4(1 / (1 + variance));

  return {
    mass,
    density: Math.min(1, density),
    stability,
    variance
  };
}

export function syncClusterWithGalaxyMetrics(
  cluster: ImpactCluster,
  memories: MemoryNode[]
): ImpactCluster {
  const metrics = calculateGalaxyClusterMetrics(cluster, memories);
  return {
    ...cluster,
    mass: metrics.mass,
    density: metrics.density,
    stability: metrics.stability
  };
}

export function syncClustersWithGalaxyMetrics(
  clusters: Map<string, ImpactCluster>,
  memories: MemoryNode[]
): Map<string, ImpactCluster> {
  return new Map(
    [...clusters.entries()].map(([category, cluster]) => [
      category,
      syncClusterWithGalaxyMetrics(cluster, memories)
    ])
  );
}

function calculateVariance(center: PersonalityCoordinate, memories: MemoryNode[]): number {
  if (!memories.length) return 0;
  const total = memories.reduce((sum, memory) => {
    const squared = BASE_PERSONALITY_KEYS.reduce((dimensionSum, key) => {
      return dimensionSum + (memory.vector.values[key] - center.values[key]) ** 2;
    }, 0);
    return sum + squared / BASE_PERSONALITY_KEYS.length;
  }, 0);
  return total / memories.length;
}
