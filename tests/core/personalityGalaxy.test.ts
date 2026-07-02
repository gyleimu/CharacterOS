import { describe, expect, it } from "vitest";
import { createImpactCluster, absorbImpactParticle, type ImpactParticle } from "../../src/core/cluster/impactCluster";
import { calculateGalaxyClusterMetrics } from "../../src/core/galaxy/clusterMetrics";
import { ebbinghausDecay } from "../../src/core/galaxy/memoryDecay";
import { applyMomentumDrift } from "../../src/core/galaxy/momentumDrift";
import { createPersonalityCore } from "../../src/core/galaxy/personalityCore";
import { calculateClusterForce } from "../../src/core/galaxy/potentialField";
import { simulatePersonalityGalaxyStep } from "../../src/core/galaxy/personalityGalaxyEngine";
import type { MemoryNode } from "../../src/core/memory/memoryNode";
import { linFanInitialCoordinate, zeroCoordinateDelta, type PersonalityCoordinate } from "../../src/core/personality/coordinate";

describe("Personality Galaxy V2", () => {
  it("decays memory values with Ebbinghaus-style exponential decay", () => {
    expect(ebbinghausDecay(1, 0)).toBe(1);
    expect(ebbinghausDecay(1, 30, 0.03)).toBeLessThan(1);
    expect(ebbinghausDecay(1, 60, 0.03)).toBeLessThan(ebbinghausDecay(1, 30, 0.03));
  });

  it("computes cluster mass from importance and repetition count", () => {
    const cluster = createImpactCluster("cluster_abandonment", "abandonment");
    const memories: MemoryNode[] = [
      memory("m1", cluster.id, 0.8, 2),
      memory("m2", cluster.id, 0.9, 3)
    ];

    const metrics = calculateGalaxyClusterMetrics(cluster, memories);

    expect(metrics.mass).toBeCloseTo(4.3);
    expect(metrics.stability).toBeGreaterThan(0.99);
    expect(metrics.density).toBe(1);
  });

  it("keeps existing cluster metrics when no memories are attached", () => {
    const cluster = {
      ...createImpactCluster("cluster_abandonment", "abandonment"),
      mass: 0.7,
      density: 0.4,
      stability: 0.3
    };

    const metrics = calculateGalaxyClusterMetrics(cluster, []);

    expect(metrics.mass).toBe(0.7);
    expect(metrics.density).toBe(0.4);
    expect(metrics.stability).toBe(0.3);
    expect(metrics.variance).toBe(0);
  });

  it("gives concentrated memory clusters higher density and stability", () => {
    const cluster = createImpactCluster("cluster_support", "support");
    const concentrated = [
      memory("m1", cluster.id, 0.7, 1, zeroCoordinateDelta()),
      memory("m2", cluster.id, 0.8, 1, zeroCoordinateDelta())
    ];
    const dispersed = [
      memory("m3", cluster.id, 0.7, 1, farCoordinate()),
      memory("m4", cluster.id, 0.8, 1, farCoordinate())
    ];

    const concentratedMetrics = calculateGalaxyClusterMetrics(cluster, concentrated);
    const dispersedMetrics = calculateGalaxyClusterMetrics(cluster, dispersed);

    expect(concentratedMetrics.variance).toBeLessThan(dispersedMetrics.variance);
    expect(concentratedMetrics.density).toBeGreaterThan(dispersedMetrics.density);
    expect(concentratedMetrics.stability).toBeGreaterThan(dispersedMetrics.stability);
    expect(concentratedMetrics.mass).toBe(dispersedMetrics.mass);
  });

  it("calculates potential-field cluster force", () => {
    const core = linFanInitialCoordinate();
    const cluster = absorbImpactParticle(createImpactCluster("cluster_abandonment", "abandonment"), particle());

    const force = calculateClusterForce({ corePosition: core, cluster });

    expect(force.magnitude).toBeGreaterThan(0);
    expect(force.vector.values.trust).toBeLessThan(0);
    expect(force.vector.values.fear).toBeGreaterThan(0);
  });

  it("caps extreme cluster force near the personality core", () => {
    const core = linFanInitialCoordinate();
    const cluster = {
      ...createImpactCluster("cluster_extreme", "trauma"),
      centerCoordinate: core,
      mass: 100,
      density: 1,
      stability: 1
    };

    const force = calculateClusterForce({ corePosition: core, cluster });

    expect(force.magnitude).toBeLessThanOrEqual(0.35);
  });

  it("applies momentum drift with inertia", () => {
    const core = createPersonalityCore({
      position: linFanInitialCoordinate(),
      velocity: zeroCoordinateDelta(),
      learningRate: 0.03,
      momentumAlpha: 0.8
    });
    const force = zeroCoordinateDelta();
    force.values.trust = -0.5;

    const drift = applyMomentumDrift(core, force);

    expect(drift.nextVelocity.values.trust).toBeCloseTo(-0.015);
    expect(drift.after.values.trust).toBeLessThan(core.position.values.trust);
  });

  it("caps personality velocity so one step cannot rewrite the core", () => {
    const core = createPersonalityCore({
      position: linFanInitialCoordinate(),
      velocity: zeroCoordinateDelta(),
      learningRate: 1,
      momentumAlpha: 1
    });
    const force = zeroCoordinateDelta();
    force.values.trust = -10;

    const drift = applyMomentumDrift(core, force);

    expect(drift.nextVelocity.values.trust).toBe(-0.08);
  });

  it("simulates a full personality galaxy step", () => {
    const cluster = absorbImpactParticle(createImpactCluster("cluster_abandonment", "abandonment"), particle());
    const snapshot = simulatePersonalityGalaxyStep({
      corePosition: linFanInitialCoordinate(),
      clusters: [cluster],
      memories: [memory("m1", cluster.id, 0.9, 2)]
    });

    expect(snapshot.forces).toHaveLength(1);
    expect(snapshot.clusterMetrics[0]?.metrics.mass).toBeGreaterThan(cluster.mass);
    expect(snapshot.drift.after.values.trust).toBeLessThan(linFanInitialCoordinate().values.trust);
    expect(snapshot.drift.after.values.fear).toBeGreaterThan(linFanInitialCoordinate().values.fear);
  });
});

function memory(
  id: string,
  clusterId: string,
  importance: number,
  repetitionCount: number,
  vector: PersonalityCoordinate = particle().vector.delta
): MemoryNode {
  return {
    id,
    content: "重要的人失联。",
    vector,
    importance,
    emotion: "fear",
    recency: 1,
    repetitionCount,
    beliefEffect: "重要的人可能会突然离开",
    timeStamp: "2026-06-18T00:00:00Z",
    clusterId
  };
}

function farCoordinate(): PersonalityCoordinate {
  return {
    values: {
      openness: 0.8,
      conscientiousness: -0.7,
      extroversion: 0.6,
      agreeableness: -0.8,
      neuroticism: 0.9,
      trust: -0.9,
      attachment: 0.7,
      fear: 0.9,
      control: 0.8
    }
  };
}

function particle(): ImpactParticle {
  return {
    id: "particle_1",
    description: "重要的人失联。",
    impactScore: 0.9,
    emotion: "fear",
    category: "abandonment",
    vector: {
      category: "abandonment",
      rationale: "test",
      delta: {
        values: {
          openness: -0.01,
          conscientiousness: 0,
          extroversion: -0.04,
          agreeableness: -0.05,
          neuroticism: 0.08,
          trust: -0.09,
          attachment: 0.04,
          fear: 0.08,
          control: 0.05
        }
      }
    }
  };
}
