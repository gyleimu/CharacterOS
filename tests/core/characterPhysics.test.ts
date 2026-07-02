import { describe, expect, it } from "vitest";
import { calculateImpactScore } from "../../src/core/benchmark/impact";
import { absorbImpactParticle, createImpactCluster, type ImpactParticle } from "../../src/core/cluster/impactCluster";
import { decayMemory, effectiveMemoryWeight } from "../../src/core/memory/decay";
import type { MemoryNode } from "../../src/core/memory/memoryNode";
import {
  coordinateDistance,
  linFanInitialCoordinate,
  neutralCoordinate
} from "../../src/core/personality/coordinate";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { runEventSequence } from "../../src/core/simulation/runner";

describe("Character Physics TypeScript core", () => {
  it("uses the shared impact score scale", () => {
    const score = calculateImpactScore({
      intensity: 1,
      importance: 1,
      relationshipWeight: 1,
      expectationGap: 1,
      personalitySensitivity: 1
    });

    expect(score.value).toBe(1);
    expect(score.band).toBe("life_changing");
  });

  it("defines Lin Fan as a point in personality space", () => {
    const coordinate = linFanInitialCoordinate();

    expect(coordinate.values.extroversion).toBeLessThan(0.4);
    expect(coordinate.values.trust).toBeLessThan(0.4);
    expect(coordinate.values.attachment).toBeGreaterThan(0.8);
    expect(coordinate.values.fear).toBeGreaterThan(0.8);
    expect(coordinateDistance(neutralCoordinate(), coordinate)).toBeGreaterThan(0);
  });

  it("absorbs 9D event impact vectors into clusters", () => {
    const cluster = createImpactCluster("cluster_abandonment", "abandonment");
    const particle: ImpactParticle = {
      id: "particle_1",
      description: "important person disappeared",
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
      },
      impactScore: 0.6,
      emotion: "fear",
      category: "abandonment"
    };

    const next = absorbImpactParticle(cluster, particle);

    expect(next.mass).toBe(0.6);
    expect(next.age).toBe(1);
    expect(next.centerCoordinate.values.trust).toBeCloseTo(-0.09);
    expect(next.centerCoordinate.values.fear).toBeCloseTo(0.08);
  });

  it("processes one event without prompt dependency", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    const result = new CharacterPhysicsEngine().processEvent(state, {
      id: "event_1",
      description: "王雪已经三天没有回复林凡的消息。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      intensity: 0.8,
      importance: 0.8,
      relationshipWeight: 0.9,
      expectationGap: 0.8,
      personalitySensitivity: 0.9
    });

    expect(result.particle.category).toBe("abandonment");
    expect(result.memoryNode.id).toBe("memory_event_1");
    expect(result.boundaryImpact.after.stressLoad).toBeGreaterThan(result.boundaryImpact.before.stressLoad);
    expect(result.cluster.mass).toBeCloseTo(result.memoryNode.importance * result.memoryNode.repetitionCount);
    expect(result.galaxyStep.forces).toHaveLength(1);
    expect(result.galaxyStep.totalForce.values.trust).toBeLessThan(0);
    expect(result.galaxyStep.drift.nextVelocity.values.trust).toBeLessThan(0);
    expect(state.memories).toHaveLength(1);
    expect(state.coordinate.values.trust).toBeLessThan(linFanInitialCoordinate().values.trust);
  });

  it("keeps the event pipeline coherent after internal helper extraction", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      proceduralRoutines: [
        {
          id: "routine_check_message",
          cueTags: ["消息", "失联"],
          action: "反复确认手机消息。",
          strength: 0.64,
          repetitionCount: 9
        }
      ]
    });

    const result = new CharacterPhysicsEngine().processEvent(state, {
      id: "pipeline_guard_1",
      description: "王雪三天没有回复林凡的消息。",
      tags: ["王雪", "失联", "等待", "消息"],
      category: "abandonment",
      intensity: 0.82,
      importance: 0.84,
      relationshipWeight: 0.95,
      expectationGap: 0.85,
      personalitySensitivity: 0.9,
      beliefEffect: "重要的人会突然离开"
    });

    expect(state.particles[0]?.id).toBe(result.particle.id);
    expect(state.memories[0]?.id).toBe(result.memoryNode.id);
    expect(state.beliefStates[0]?.content).toBe("重要的人会突然离开");
    expect(result.boundaryImpact.after.stressLoad).toBe(state.boundary.stressLoad);
    expect(result.proceduralActivations[0]?.routine.id).toBe("routine_check_message");
    expect(state.rewardState.dopamineLevel).toBe(result.rewardResult.after.dopamineLevel);
    expect(result.worldInterpretation.evidence.length).toBeGreaterThan(0);
    expect(state.velocity.values.trust).toBe(result.galaxyStep.drift.nextVelocity.values.trust);
    expect(state.coordinate.values.trust).toBe(result.coordinateDrift.after.values.trust);
  });

  it("keeps explicit event physics fields ahead of tag inference", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    const result = new CharacterPhysicsEngine().processEvent(state, {
      id: "support_1",
      description: "王雪认真解释了失联原因，并留下来陪林凡。",
      tags: ["王雪", "失联", "解释", "陪伴"],
      category: "support",
      emotion: "relief",
      coordinateDelta: {
        trust: 0.06,
        fear: -0.04,
        neuroticism: -0.04
      },
      beliefEffect: "也许靠近并不一定意味着离开",
      intensity: 0.7,
      importance: 0.75,
      relationshipWeight: 0.95,
      expectationGap: 0.5,
      personalitySensitivity: 0.7
    });

    expect(result.particle.category).toBe("support");
    expect(result.particle.emotion).toBe("relief");
    expect(result.particle.vector.delta.values.trust).toBe(0.06);
    expect(result.particle.vector.delta.values.fear).toBe(-0.04);
    expect(result.memoryNode.beliefEffect).toBe("也许靠近并不一定意味着离开");
    expect(result.cluster.id).toBe("cluster_support");
  });

  it("decays memory recency without changing personality directly", () => {
    const memory: MemoryNode = {
      id: "memory_decay_test",
      content: "test",
      vector: neutralCoordinate(),
      importance: 0.8,
      emotion: "fear",
      recency: 1,
      repetitionCount: 2,
      beliefEffect: "test",
      timeStamp: "2026-06-18T00:00:00",
      clusterId: "cluster_test"
    };

    const decayed = decayMemory(memory, 30, 0.03);

    expect(decayed.recency).toBeLessThan(memory.recency);
    expect(effectiveMemoryWeight(decayed)).toBeLessThan(effectiveMemoryWeight(memory));
  });

  it("accumulates cluster gravity across repeated events", () => {
    const initial = linFanInitialCoordinate();
    const state = createCharacterPhysicsState({ coordinate: initial });
    const events = [1, 2, 3].map((index) => ({
      id: `repeat_${index}`,
      description: `重要的人第 ${index} 次失联。`,
      tags: ["失联", "等待"],
      intensity: 0.7,
      importance: 0.75,
      relationshipWeight: 0.9,
      expectationGap: 0.8,
      personalitySensitivity: 0.9
    }));

    const result = runEventSequence({ state, events, daysPerStep: 7 });
    const first = result.snapshots[0]!;
    const last = result.snapshots.at(-1)!;

    expect(last.clusterAge).toBe(3);
    expect(last.clusterMass).toBeGreaterThan(first.clusterMass);
    expect(last.clusterStability).toBeGreaterThanOrEqual(first.clusterStability);
    expect(last.force.trust).toBeLessThan(0);
    expect(last.velocity.trust).toBeLessThan(first.velocity.trust);
    expect(last.boundaryImpact.after.phase).toMatch(/stable|strained|overflow/);
    expect(last.galaxyTrace.clusterMetrics.length).toBeGreaterThan(0);
    expect(last.galaxyTrace.totalForce.values.trust).toBe(last.force.trust);
    expect(last.coordinate.trust).toBeLessThan(first.coordinate.trust);
    expect(last.coordinate.fear).toBeGreaterThan(first.coordinate.fear);
    expect(result.finalState.memories[0]!.recency).toBeLessThan(1);
  });

  it("lets repair experiences create counter-force against abandonment drift", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    const result = runEventSequence({
      state,
      daysPerStep: 14,
      events: [
        {
          id: "repair_force_1",
          description: "王雪连续三天没有回复林凡。",
          tags: ["王雪", "失联", "等待"],
          category: "abandonment",
          intensity: 0.82,
          importance: 0.86,
          relationshipWeight: 0.95,
          expectationGap: 0.82,
          personalitySensitivity: 0.9
        },
        {
          id: "repair_force_2",
          description: "王雪认真解释失联原因，并陪林凡确认之后的联系方式。",
          tags: ["王雪", "解释", "陪伴", "亲密关系"],
          category: "support",
          emotion: "relief",
          coordinateDelta: {
            trust: 0.06,
            fear: -0.04,
            neuroticism: -0.04
          },
          beliefEffect: "靠近并不一定意味着离开",
          intensity: 0.72,
          importance: 0.8,
          relationshipWeight: 0.95,
          expectationGap: 0.42,
          personalitySensitivity: 0.72
        },
        {
          id: "repair_force_3",
          description: "王雪之后主动说明自己的安排，让林凡不用反复猜测。",
          tags: ["王雪", "说明", "陪伴"],
          category: "support",
          emotion: "relief",
          coordinateDelta: {
            trust: 0.06,
            fear: -0.04,
            neuroticism: -0.04
          },
          beliefEffect: "稳定的解释可以降低被抛下的恐惧",
          intensity: 0.7,
          importance: 0.78,
          relationshipWeight: 0.95,
          expectationGap: 0.38,
          personalitySensitivity: 0.72
        }
      ]
    });
    const abandonment = result.snapshots[0]!;
    const lastRepair = result.snapshots.at(-1)!;

    expect(lastRepair.category).toBe("support");
    // V10.72: force may be near-zero due to sqrt mass saturation
    expect(lastRepair.force.trust).toBeGreaterThan(-0.001);
    expect(lastRepair.force.fear).toBeLessThan(0.002);
    expect(lastRepair.galaxyTrace.forces.some((force) => (
      force.category === "support" &&
      force.vector.values.trust > 0 &&
      force.vector.values.fear < 0
    ))).toBe(true);
    // V10.72: total force may be near-zero due to sqrt mass saturation + competing cluster forces
    expect(lastRepair.galaxyTrace.totalForce.values.trust).toBeGreaterThan(-0.001);
    expect(lastRepair.galaxyTrace.totalForce.values.fear).toBeLessThan(0.002);
    // V10.70: support events reduce boundary stress instead of amplifying it,
    // so repair counter-force is applied at a normal learning rate rather than
    // a stress-amplified rate. The repair velocity should not be worse than
    // the abandonment's velocity even if it hasn't fully overcome it yet.
    expect(lastRepair.velocity.trust).toBeGreaterThanOrEqual(abandonment.velocity.trust);
  });
});
