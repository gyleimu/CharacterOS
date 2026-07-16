import { describe, expect, it } from "vitest";
import { runLongTermAccumulationAudit } from "../../src/core/audit/longTermAccumulationAudit";
import { createPsychologicalBoundary, driftMultiplierFor } from "../../src/core/boundary/psychologicalBoundary";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../src/core/character/characterBlueprint";
import { absorbImpactParticle, createImpactCluster, type ImpactParticle } from "../../src/core/cluster/impactCluster";
import { parseExperienceEvent } from "../../src/core/event/eventParser";
import type { EventCategory } from "../../src/core/event/categoryPhysics";
import { calculateGalaxyClusterMetrics } from "../../src/core/galaxy/clusterMetrics";
import { calculateClusterForce } from "../../src/core/galaxy/potentialField";
import type { MemoryNode } from "../../src/core/memory/memoryNode";
import {
  coordinateDistance,
  linFanInitialCoordinate,
  neutralCoordinate,
  zeroCoordinateDelta,
} from "../../src/core/personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";

const relationshipScenario = {
  id: "relationship_followup",
  name: "亲密关系后续确认",
  trigger: "对方第二天只简单回复，没有解释昨晚为什么消失。",
  stressor: "亲密关系 / 信任 / 解释缺失",
  testFocus: "关系 信任 安全感 回复",
};

describe("Personality drift hardening", () => {
  it("resolves a tagged support event before emotion and boundary processing", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      boundary: createPsychologicalBoundary({ capacity: 0.6, stressLoad: 0.8, cracks: 0.3 }),
    });

    const result = new CharacterPhysicsEngine().processEvent(state, {
      id: "implicit_support",
      description: "朋友留下来解释并陪伴。",
      tags: ["朋友", "解释", "陪伴", "支持"],
      intensity: 0.7,
      importance: 0.7,
      relationshipWeight: 0.8,
      expectationGap: 0.2,
      personalitySensitivity: 0.6,
    });

    expect(result.event.category).toBe("support");
    expect(result.emotion.primary).toBe("relief");
    expect(result.boundaryImpact.incomingStress).toBeLessThanOrEqual(0);
    expect(result.boundaryImpact.after.stressLoad).toBeLessThan(result.boundaryImpact.before.stressLoad);
  });

  it("creates unique occurrence IDs and does not double-count runtime repetition", () => {
    const state = createCharacterPhysicsState({ coordinate: neutralCoordinate() });
    const engine = new CharacterPhysicsEngine();
    const event = {
      id: "same_betrayal",
      description: "同一段背叛经历被再次确认。",
      tags: ["背叛"],
      category: "betrayal",
      intensity: 0.8,
      importance: 0.8,
      relationshipWeight: 0.8,
      expectationGap: 0.8,
      personalitySensitivity: 0.8,
    };

    for (let i = 0; i < 10; i++) engine.processEvent(state, event);

    expect(new Set(state.particles.map((particle) => particle.id)).size).toBe(10);
    expect(new Set(state.memories.map((memory) => memory.id)).size).toBe(10);
    expect(state.memories.every((memory) => memory.repetitionCount === 1)).toBe(true);

    const cluster = state.clusters.get("betrayal")!;
    const expectedMass = state.memories
      .filter((memory) => memory.clusterId === cluster.id)
      .reduce((sum, memory) => sum + memory.importance, 0);
    expect(cluster.mass).toBeCloseTo(expectedMass, 3);
  });

  it("keeps one hundred neutral observations from rewriting personality", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const engine = new CharacterPhysicsEngine();
    const baselineCoordinate = { values: { ...state.coordinate.values } };
    const baselineStress = state.boundary.stressLoad;
    const baselineCracks = state.boundary.cracks;

    for (let i = 0; i < 100; i++) {
      engine.processEvent(state, parseExperienceEvent({
        description: `普通日常记录 ${i + 1}`,
        tags: ["日常"],
        categoryHint: "general",
      }));
    }

    expect(coordinateDistance(baselineCoordinate, state.coordinate)).toBeLessThan(0.03);
    expect(state.boundary.stressLoad).toBeLessThanOrEqual(baselineStress);
    expect(state.boundary.cracks).toBeLessThanOrEqual(baselineCracks);
    expect(state.coordinate.values.trust).toBeGreaterThan(0.1);
    expect(state.coordinate.values.fear).toBeLessThan(0.95);
  });

  it("saturates boundary amplification under extreme accumulated stress", () => {
    const multiplier = driftMultiplierFor(createPsychologicalBoundary({
      capacity: 0.2,
      stressLoad: 100,
      cracks: 1000,
    }));

    expect(multiplier).toBeGreaterThan(1);
    expect(multiplier).toBeLessThanOrEqual(1.75);
  });

  it("does not mix absolute core coordinates with directional cluster vectors", () => {
    const cluster = absorbImpactParticle(
      createImpactCluster("cluster_betrayal", "betrayal"),
      betrayalParticle(),
    );

    const neutralForce = calculateClusterForce({ corePosition: neutralCoordinate(), cluster });
    const sensitiveForce = calculateClusterForce({ corePosition: linFanInitialCoordinate(), cluster });

    expect(neutralForce.magnitude).toBe(sensitiveForce.magnitude);
    expect(neutralForce.distance).toBe(1);
    expect(sensitiveForce.distance).toBe(1);
  });

  it("reduces active cluster mass when memories become stale", () => {
    const cluster = createImpactCluster("cluster_support", "support");
    const fresh = memory("fresh", cluster.id, 1);
    const stale = { ...fresh, id: "stale", recency: 0 };

    const freshMetrics = calculateGalaxyClusterMetrics(cluster, [fresh]);
    const staleMetrics = calculateGalaxyClusterMetrics(cluster, [stale]);

    expect(staleMetrics.mass).toBeLessThan(freshMetrics.mass);
    expect(staleMetrics.mass).toBeGreaterThan(0);
  });

  it("keeps galaxy drift trace separate from the boundary repair nudge", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      boundary: createPsychologicalBoundary({ capacity: 0.6, stressLoad: 0.8 }),
    });

    const result = new CharacterPhysicsEngine().processEvent(state, {
      id: "trace_support",
      description: "朋友持续提供安全和支持。",
      tags: ["支持", "陪伴"],
      category: "support",
      intensity: 0.8,
      importance: 0.8,
      relationshipWeight: 0.8,
      expectationGap: 0.2,
      personalitySensitivity: 0.6,
    });

    const galaxyTrust = result.galaxyStep.drift.after.values.trust;
    expect(result.coordinateDrift.after.values.trust).toBeCloseTo(
      galaxyTrust + result.boundaryImpact.repairNudge.trust,
      4,
    );
    expect(result.coordinateDrift.after.values.trust).toBe(state.coordinate.values.trust);
  });

  it("compares actual before and after decisions in accumulation audit", () => {
    const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const result = runLongTermAccumulationAudit({
      baselineState: baseline,
      eventSequence: [{
        description: "亲密对象隐瞒事实并背叛承诺。",
        tags: ["背叛", "欺骗", "亲密关系"],
        categoryHint: "betrayal",
      }],
      followUpDecisionScenario: relationshipScenario,
    });

    const influence = result.stepResults[0]!.decisionInfluence;
    expect(influence.responsivenessAudit.candidateScoreChanged).toBe(true);
    expect(influence.responsivenessTrace.groundedDeltaPaths.length).toBeGreaterThan(0);
  });

  it("keeps a long mixed-category sequence finite and bounded", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true,
    });
    const engine = new CharacterPhysicsEngine();
    const categories: EventCategory[] = [
      "abandonment",
      "support",
      "betrayal",
      "success",
      "failure",
      "rejection",
      "conflict",
      "fatigue",
      "uncertainty",
      "general",
    ];

    for (let i = 0; i < 250; i++) {
      const category = categories[i % categories.length]!;
      engine.processEvent(state, parseExperienceEvent({
        description: `mixed ${category} ${i}`,
        tags: [category],
        categoryHint: category,
      }));
    }

    for (const value of Object.values(state.coordinate.values)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (const value of Object.values(state.velocity.values)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThanOrEqual(0.08);
    }
    expect(Number.isFinite(state.boundary.stressLoad)).toBe(true);
    expect(Number.isFinite(state.boundary.cracks)).toBe(true);
    expect(driftMultiplierFor(state.boundary)).toBeLessThanOrEqual(1.75);
    expect(new Set(state.memories.map((memory) => memory.id)).size).toBe(state.memories.length);
  });
});

function betrayalParticle(): ImpactParticle {
  const delta = zeroCoordinateDelta();
  delta.values.trust = -0.12;
  delta.values.fear = 0.06;
  return {
    id: "particle_betrayal",
    description: "背叛",
    vector: { category: "betrayal", rationale: "test", delta },
    impactScore: 0.9,
    emotion: "anger",
    category: "betrayal",
  };
}

function memory(id: string, clusterId: string, recency: number): MemoryNode {
  return {
    id,
    content: "支持记忆",
    vector: zeroCoordinateDelta(),
    importance: 0.8,
    emotion: "relief",
    recency,
    repetitionCount: 2,
    beliefEffect: "他人可能可靠",
    timeStamp: "2026-01-01T00:00:00.000Z",
    clusterId,
  };
}
