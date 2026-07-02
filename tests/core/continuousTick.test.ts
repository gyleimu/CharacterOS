import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState, linFanMetaState } from "../../src/core/meta/metaState";
import { runContinuousTick } from "../../src/core/time/continuousTick";
import { CharacterPhysicsEngine, createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { linFanInitialCoordinate } from "../../src/core/personality/coordinate";
import type { BoundaryRecoverySubProcessTrace } from "../../src/core/temporal/subProcessTrace";
import type { RewardRecoverySubProcessTrace } from "../../src/core/temporal/subProcessTrace";

describe("Continuous Tick System", () => {
  it("reports an explicit phase order for continuous living", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    expect(trace.phases.map((phase) => phase.name)).toEqual([
      "snapshot",
      "meta_drift",
      "decay_and_recovery",
      "homeostasis",
      "recovery_trace",
      "parameter_network",
      "baseline_drift",
      "parameter_accumulation",
      "parameter_adjustment_draft",
      "parameter_adjustment_preview",
      "parameter_adjustment_audit",
      "parameter_adjustment_patch",
      "parameter_adjustment_snapshot",
      "boredom",
      "belief_evolution",
      "attention_and_reflection",
      "time_perception"
    ]);
    expect(trace.phases.every((phase) => Array.isArray(phase.changedStates))).toBe(true);
    expect(trace.phases.every((phase) => phase.reasons.length > 0)).toBe(true);
    expect(trace.parameterNetwork.influences.length).toBeGreaterThan(0);
    expect(trace.recovery.dimensions.length).toBeGreaterThan(0);
    expect(trace.baselineDrift.reasons.length).toBeGreaterThan(0);
    expect(trace.parameterAccumulation.buckets.length).toBeGreaterThan(0);
    expect(trace.parameterAdjustmentDraft.reasons.length).toBeGreaterThan(0);
    expect(trace.parameterAdjustmentPreview.reasons.length).toBeGreaterThan(0);
    expect(trace.parameterAdjustmentAudit.reasons.length).toBeGreaterThan(0);
    expect(trace.parameterAdjustmentPatch.reasons.length).toBeGreaterThan(0);
    expect(trace.parameterAdjustmentSnapshot.reasons.length).toBeGreaterThan(0);
  });

  it("lets temporary fatigue and sleep debt shape observable parameter network trace", () => {
    const restedState = createCharacterPhysicsState();
    const exhaustedState = createCharacterPhysicsState();

    const restedTrace = runContinuousTick(restedState, {
      daysElapsed: 1,
      fatigue: 0.05,
      sleepDebt: 0.05
    });
    const exhaustedTrace = runContinuousTick(exhaustedState, {
      daysElapsed: 1,
      fatigue: 0.9,
      sleepDebt: 0.85
    });

    expect(exhaustedTrace.parameterNetwork.before.fatigue).toBe(0.9);
    expect(exhaustedTrace.parameterNetwork.before.sleepDebt).toBe(0.85);
    expect(exhaustedTrace.parameterNetwork.after.selfControl).toBeLessThan(
      restedTrace.parameterNetwork.after.selfControl
    );
    expect(exhaustedTrace.parameterNetwork.after.actionNoise).toBeGreaterThan(
      restedTrace.parameterNetwork.after.actionNoise
    );
  });

  it("normalizes unsafe tick controls at the core boundary", () => {
    const state = createCharacterPhysicsState();

    const trace = runContinuousTick(state, {
      daysElapsed: -5,
      memoryDecayRate: -1,
      deepThinkingThreshold: 3,
      fatigue: 5,
      sleepDebt: -2
    });

    expect(trace.daysElapsed).toBe(0);
    expect(trace.effectiveMemoryDecayRate).toBe(0);
    expect(trace.effectiveDeepThinkingThreshold).toBeLessThanOrEqual(1);
    expect(trace.parameterNetwork.before.fatigue).toBe(1);
    expect(trace.parameterNetwork.before.sleepDebt).toBe(0);
  });

  it("decays memories and recovers boundary without directly changing personality", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      boundary: createPsychologicalBoundary({
        stressLoad: 0.8,
        cracks: 0.4,
        integrity: 0.72,
        phase: "overflow"
      })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "tick_memory_1",
      description: "王雪三天没有回复林凡。",
      tags: ["王雪", "失联", "等待"],
      category: "abandonment",
      intensity: 0.8,
      importance: 0.86,
      relationshipWeight: 0.95,
      expectationGap: 0.82,
      personalitySensitivity: 0.9
    });
    const trustBefore = state.coordinate.values.trust;
    const fearBefore = state.coordinate.values.fear;
    const stressBefore = state.boundary.stressLoad;

    const trace = runContinuousTick(state, { daysElapsed: 14, memoryDecayRate: 0.03 });

    expect(trace.memoryCount).toBe(1);
    expect(trace.averageMemoryRecencyAfter).toBeLessThan(trace.averageMemoryRecencyBefore);
    expect(trace.averageMemoryWeightAfter).toBeLessThan(trace.averageMemoryWeightBefore);
    expect(trace.boundaryAfter.stressLoad).toBeLessThan(stressBefore);
    expect(state.coordinate.values.trust).toBe(trustBefore);
    expect(state.coordinate.values.fear).toBe(fearBefore);
  });

  it("recommends deep thinking only when accumulated pressure crosses a threshold", () => {
    const calmState = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.1, cracks: 0.05, phase: "stable" })
    });
    const strainedState = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.95, cracks: 0.9, phase: "overflow" })
    });

    const calmTrace = runContinuousTick(calmState, { daysElapsed: 1, deepThinkingThreshold: 0.7 });
    const strainedTrace = runContinuousTick(strainedState, { daysElapsed: 1, deepThinkingThreshold: 0.7 });

    expect(calmTrace.deepThinkingRecommended).toBe(false);
    expect(strainedTrace.deepThinkingRecommended).toBe(true);
    expect(strainedTrace.reasons.length).toBeGreaterThan(0);
  });

  it("lets meta state influence forgetting speed", () => {
    const strongMemoryState = createCharacterPhysicsState({
      metaState: {
        ...defaultMetaState(),
        memoryStrength: 0.95,
        forgettingSpeed: 0.12
      }
    });
    const weakMemoryState = createCharacterPhysicsState({
      metaState: {
        ...defaultMetaState(),
        memoryStrength: 0.2,
        forgettingSpeed: 0.9
      }
    });
    const event = {
      id: "meta_memory_1",
      description: "林凡又一次等到深夜。",
      tags: ["等待", "失联"],
      category: "abandonment",
      intensity: 0.72,
      importance: 0.78,
      relationshipWeight: 0.86,
      expectationGap: 0.82,
      personalitySensitivity: 0.9
    };
    new CharacterPhysicsEngine().processEvent(strongMemoryState, event);
    new CharacterPhysicsEngine().processEvent(weakMemoryState, { ...event, id: "meta_memory_2" });

    const strongTrace = runContinuousTick(strongMemoryState, { daysElapsed: 30, memoryDecayRate: 0.03 });
    const weakTrace = runContinuousTick(weakMemoryState, { daysElapsed: 30, memoryDecayRate: 0.03 });

    expect(strongTrace.effectiveMemoryDecayRate).toBeLessThan(weakTrace.effectiveMemoryDecayRate);
    expect(strongTrace.averageMemoryRecencyAfter).toBeGreaterThan(weakTrace.averageMemoryRecencyAfter);
  });

  it("drifts meta parameters under sustained pressure", () => {
    const state = createCharacterPhysicsState({
      metaState: defaultMetaState(),
      boundary: createPsychologicalBoundary({
        stressLoad: 0.95,
        cracks: 0.5,
        integrity: 0.45,
        phase: "overflow"
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    expect(trace.metaState.after.emotionalSensitivity).toBeGreaterThan(trace.metaState.before.emotionalSensitivity);
    expect(trace.metaState.after.traumaAmplification).toBeGreaterThan(trace.metaState.before.traumaAmplification);
    expect(trace.metaState.after.resilience).toBeLessThan(trace.metaState.before.resilience);
    expect(trace.metaState.after.selfControl).toBeLessThan(trace.metaState.before.selfControl);
  });

  it("exposes attention profile before and after a continuous tick", () => {
    const state = createCharacterPhysicsState({
      metaState: defaultMetaState(),
      boundary: createPsychologicalBoundary({
        stressLoad: 0.8,
        capacity: 0.7,
        phase: "overflow"
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    expect(trace.attentionProfileBefore.danger).toBeGreaterThan(0);
    expect(trace.attentionProfileAfter.danger).toBeGreaterThan(0);
    expect(Object.values(trace.attentionProfileAfter).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("decays procedural routines during continuous living ticks", () => {
    const state = createCharacterPhysicsState({
      proceduralRoutines: [
        {
          id: "routine_check_message",
          cueTags: ["手机震动", "消息"],
          action: "查看消息。",
          strength: 0.72,
          repetitionCount: 20
        }
      ]
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    expect(trace.proceduralRoutineCount).toBe(1);
    expect(trace.averageProceduralStrengthBefore).toBe(0.72);
    expect(trace.averageProceduralStrengthAfter).toBeLessThan(0.72);
    expect(state.proceduralRoutines[0]?.strength).toBe(trace.averageProceduralStrengthAfter);
  });

  it("recovers reward state toward baseline during continuous ticks", () => {
    const state = createCharacterPhysicsState({
      rewardState: {
        dopamineLevel: 0.9,
        dopamineThreshold: 0.82,
        rewardSensitivity: 0.2,
        noveltyNeed: 0.88,
        adaptationRate: 0.08,
        craving: 0.76
      }
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    expect(trace.rewardAfter.dopamineLevel).toBeLessThan(trace.rewardBefore.dopamineLevel);
    expect(trace.rewardAfter.dopamineThreshold).toBeLessThan(trace.rewardBefore.dopamineThreshold);
    expect(trace.rewardAfter.rewardSensitivity).toBeGreaterThan(trace.rewardBefore.rewardSensitivity);
    expect(trace.rewardAfter.craving).toBeLessThan(trace.rewardBefore.craving);
  });

  it("applies homeostasis regulation during continuous ticks", () => {
    const state = createCharacterPhysicsState({
      metaState: {
        ...defaultMetaState(),
        emotionalSensitivity: 0.92,
        selfControl: 0.2,
        resilience: 0.18,
        traumaAmplification: 0.88
      },
      boundary: createPsychologicalBoundary({
        stressLoad: 0.86,
        cracks: 0.45,
        integrity: 0.52,
        phase: "overflow"
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    expect(trace.homeostasis.pressure).toBeGreaterThan(0);
    expect(state.metaState.emotionalSensitivity).toBeLessThan(trace.metaState.after.emotionalSensitivity);
    expect(state.homeostasisState.scarRetention).not.toBe(trace.homeostasis.before.scarRetention);
  });

  it("reports subjective time perception for continuous living", () => {
    const state = createCharacterPhysicsState({
      metaState: linFanMetaState(),
      boundary: createPsychologicalBoundary({ capacity: 0.5, stressLoad: 0.44 })
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    expect(trace.timePerception.objectiveDuration).toBe(7);
    expect(trace.timePerception.subjectiveDuration).toBeGreaterThan(0);
    expect(trace.timePerception.multiplier).toBeGreaterThan(0);
  });

  it("updates boredom and inspiration pressure during continuous living", () => {
    const state = createCharacterPhysicsState({
      metaState: {
        ...linFanMetaState(),
        curiosity: 0.86,
        resilience: 0.72
      },
      boundary: createPsychologicalBoundary({ stressLoad: 0.1, integrity: 0.9 }),
      rewardState: {
        dopamineLevel: 0.14,
        dopamineThreshold: 0.72,
        rewardSensitivity: 0.42,
        noveltyNeed: 0.9,
        adaptationRate: 0.06,
        craving: 0.08
      }
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    expect(trace.boredom.after.boredomLevel).not.toBe(trace.boredom.before.boredomLevel);
    expect(trace.boredom.explorationDrive).toBeGreaterThan(0);
    expect(trace.boredom.inspirationChance).toBeGreaterThan(0);
    expect(state.boredomState.boredomLevel).toBe(trace.boredom.after.boredomLevel);
  });

  it("evolves belief strength from decayed memory evidence", () => {
    const state = createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "belief_tick_1",
      description: "王雪又一次没有解释就消失。",
      tags: ["王雪", "失联", "亲密关系"],
      category: "abandonment",
      intensity: 0.78,
      importance: 0.82,
      relationshipWeight: 0.9,
      expectationGap: 0.86,
      personalitySensitivity: 0.88,
      beliefEffect: "亲密关系并不可靠"
    });
    const beforeStrength = state.beliefStates[0]?.strength ?? 0;

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    expect(trace.beliefEvolution.before.length).toBeGreaterThan(0);
    expect(trace.beliefEvolution.after.length).toBeGreaterThan(0);
    expect(state.beliefStates[0]?.strength).not.toBe(beforeStrength);
  });

  it("keeps zero-day ticks effectively stable", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      boundary: createPsychologicalBoundary({ stressLoad: 0.4, cracks: 0.2, integrity: 0.72 })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "zero_tick_event",
      description: "林凡收到一条含糊的消息。",
      tags: ["王雪", "消息", "亲密关系"],
      intensity: 0.45,
      importance: 0.5,
      relationshipWeight: 0.8,
      expectationGap: 0.5,
      personalitySensitivity: 0.6
    });
    const recencyBefore = state.memories[0]?.recency;
    const stressBefore = state.boundary.stressLoad;
    const trustBefore = state.coordinate.values.trust;
    const beliefBefore = state.beliefStates[0]?.strength;

    const trace = runContinuousTick(state, { daysElapsed: 0 });

    expect(trace.daysElapsed).toBe(0);
    expect(state.memories[0]?.recency).toBe(recencyBefore);
    expect(state.boundary.stressLoad).toBe(stressBefore);
    expect(state.coordinate.values.trust).toBe(trustBefore);
    expect(state.beliefStates[0]?.strength).toBe(beliefBefore);
  });

  it("supports long recovery windows without direct personality drift", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      metaState: {
        ...linFanMetaState(),
        emotionalSensitivity: 0.9,
        selfControl: 0.24,
        resilience: 0.22
      },
      boundary: createPsychologicalBoundary({
        stressLoad: 0.92,
        cracks: 0.55,
        integrity: 0.42,
        phase: "overflow"
      }),
      rewardState: {
        dopamineLevel: 0.18,
        dopamineThreshold: 0.82,
        rewardSensitivity: 0.22,
        noveltyNeed: 0.76,
        adaptationRate: 0.07,
        craving: 0.68
      }
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "long_tick_memory",
      description: "王雪长期没有解释那次消失。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      category: "abandonment",
      intensity: 0.82,
      importance: 0.86,
      relationshipWeight: 0.92,
      expectationGap: 0.88,
      personalitySensitivity: 0.9
    });
    const coordinateBefore = state.coordinate;
    const stressBefore = state.boundary.stressLoad;
    const cracksBefore = state.boundary.cracks;
    const recencyBefore = state.memories[0]?.recency ?? 0;

    const trace = runContinuousTick(state, { daysElapsed: 180 });

    expect(trace.averageMemoryRecencyAfter).toBeLessThan(recencyBefore);
    expect(state.boundary.stressLoad).toBeLessThan(stressBefore);
    expect(state.boundary.cracks).toBeLessThan(cracksBefore);
    expect(state.coordinate.values.trust).toBe(coordinateBefore.values.trust);
    expect(state.coordinate.values.fear).toBe(coordinateBefore.values.fear);
    expect(trace.timePerception.objectiveDuration).toBe(180);
  });

  // ─── V5.2-V5.5 SubProcess Instrumentation ───────────────────────────────

  it("includes all 4 subProcesses in Phase 3 decay_and_recovery", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "v5.5_test_memory",
      description: "测试 V5.5 subprocess instrumentation。",
      tags: ["测试"],
      category: "neutral",
      intensity: 0.5,
      importance: 0.5,
      relationshipWeight: 0.8,
      expectationGap: 0.5,
      personalitySensitivity: 0.5
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    // Phase 3 should exist and have subProcesses
    const phase3 = trace.phases[2]!;
    expect(phase3.name).toBe("decay_and_recovery");
    expect(phase3.subProcesses).toBeDefined();
    expect(phase3.subProcesses!.length).toBe(4);
  });

  it("Phase 3 subProcesses order: memory_decay → procedural_decay → boundary_recovery → reward_recovery", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "v5.5_order_test",
      description: "测试 subprocess 顺序。",
      tags: ["测试"],
      category: "neutral",
      intensity: 0.5,
      importance: 0.5,
      relationshipWeight: 0.8,
      expectationGap: 0.5,
      personalitySensitivity: 0.5
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const subs = trace.phases[2]!.subProcesses!;
    expect(subs[0]!.kind).toBe("memory_decay");
    expect(subs[1]!.kind).toBe("procedural_decay");
    expect(subs[2]!.kind).toBe("boundary_recovery");
    expect(subs[3]!.kind).toBe("reward_recovery");
  });

  it("Phase 3 subProcess memory_decay kind and metrics are populated", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "v5.3_kind_test",
      description: "测试 subprocess kind。",
      tags: ["测试"],
      category: "neutral",
      intensity: 0.5,
      importance: 0.5,
      relationshipWeight: 0.8,
      expectationGap: 0.5,
      personalitySensitivity: 0.5
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const sub = trace.phases[2]!.subProcesses![0]!;
    expect(sub.kind).toBe("memory_decay");
    expect(sub.id).toBe("decay_and_recovery.memory_decay");
    expect(sub.metrics.memoryCount).toBe(1);
    expect(sub.metrics.averageRecencyBefore).toBeGreaterThan(0);
    expect(sub.metrics.averageRecencyAfter).toBeGreaterThan(0);
    expect(sub.metrics.averageEffectiveWeightBefore).toBeGreaterThan(0);
    expect(sub.metrics.averageEffectiveWeightAfter).toBeGreaterThan(0);
  });

  it("Phase 3 original fields unchanged by subProcess instrumentation", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const phase3 = trace.phases[2]!;
    // Original fields must be preserved exactly
    expect(phase3.name).toBe("decay_and_recovery");
    expect(phase3.changedStates).toEqual([
      "memories",
      "proceduralRoutines",
      "rewardState",
      "boundary"
    ]);
    expect(phase3.reasons.length).toBe(3);
    expect(phase3.reasons[0]).toContain("Memory recency");
    expect(phase3.reasons[1]).toContain("Procedural routines");
    expect(phase3.reasons[2]).toContain("Reward state");
  });

  it("memory decay behavior unchanged after V5.2 instrumentation", () => {
    const state = createCharacterPhysicsState({
      coordinate: linFanInitialCoordinate(),
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    new CharacterPhysicsEngine().processEvent(state, {
      id: "v5.2_behavior_test",
      description: "验证 V5.2 不改行为。",
      tags: ["测试"],
      category: "neutral",
      intensity: 0.5,
      importance: 0.5,
      relationshipWeight: 0.8,
      expectationGap: 0.5,
      personalitySensitivity: 0.5
    });

    const recencyBefore = state.memories[0]!.recency;
    const trace = runContinuousTick(state, { daysElapsed: 14, memoryDecayRate: 0.03 });

    // Same behavior assertions as V4
    expect(trace.memoryCount).toBe(1);
    expect(trace.averageMemoryRecencyAfter).toBeLessThan(trace.averageMemoryRecencyBefore);
    expect(trace.averageMemoryWeightAfter).toBeLessThan(trace.averageMemoryWeightBefore);
    // Subprocess metrics should match the trace-level averages
    const sub = trace.phases[2]!.subProcesses![0]!;
    expect(sub.metrics.averageRecencyBefore).toBe(trace.averageMemoryRecencyBefore);
    expect(sub.metrics.averageRecencyAfter).toBe(trace.averageMemoryRecencyAfter);
  });

  it("empty memories produce memory_decay subProcess with count=0", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    // No events → no memories

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const sub = trace.phases[2]!.subProcesses![0]!;
    expect(sub.kind).toBe("memory_decay");
    expect(sub.metrics.memoryCount).toBe(0);
    expect(sub.metrics.averageRecencyBefore).toBe(0);
    expect(sub.metrics.averageRecencyAfter).toBe(0);
    expect(sub.reasons.some((r) => r.includes("No memories"))).toBe(true);
  });

  // ─── V5.3 Procedural Decay SubProcess Integration ──────────────────

  it("Phase 3 subProcess procedural_decay kind and metrics are populated", () => {
    const state = createCharacterPhysicsState({
      proceduralRoutines: [
        {
          id: "routine_v5.3",
          cueTags: ["测试"],
          action: "测试。",
          strength: 0.72,
          repetitionCount: 10
        }
      ]
    });

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const sub = trace.phases[2]!.subProcesses![1]!;
    expect(sub.kind).toBe("procedural_decay");
    expect(sub.id).toBe("decay_and_recovery.procedural_decay");
    expect(sub.changedStates).toEqual(["proceduralRoutines"]);
    expect(sub.metrics.routineCount).toBe(1);
    expect(sub.metrics.averageStrengthBefore).toBeGreaterThan(0);
    expect(sub.metrics.averageStrengthAfter).toBeGreaterThan(0);
  });

  it("procedural routine decay behavior unchanged after V5.3 instrumentation", () => {
    const state = createCharacterPhysicsState({
      proceduralRoutines: [
        {
          id: "routine_behavior_v5.3",
          cueTags: ["手机震动"],
          action: "查看消息。",
          strength: 0.72,
          repetitionCount: 20
        }
      ]
    });

    const strengthBefore = state.proceduralRoutines[0]!.strength;
    const trace = runContinuousTick(state, { daysElapsed: 14 });

    // Same behavior assertions as V4
    expect(trace.proceduralRoutineCount).toBe(1);
    expect(trace.averageProceduralStrengthBefore).toBe(strengthBefore);
    expect(trace.averageProceduralStrengthAfter).toBeLessThan(strengthBefore);
    expect(state.proceduralRoutines[0]?.strength).toBe(trace.averageProceduralStrengthAfter);
    // Subprocess metrics should match trace-level averages
    const sub = trace.phases[2]!.subProcesses![1]!;
    expect(sub.metrics.averageStrengthBefore).toBe(trace.averageProceduralStrengthBefore);
    expect(sub.metrics.averageStrengthAfter).toBe(trace.averageProceduralStrengthAfter);
  });

  it("empty routines produce procedural_decay subProcess with count=0", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45, integrity: 0.8 })
    });
    // No procedural routines

    const trace = runContinuousTick(state, { daysElapsed: 7 });

    const sub = trace.phases[2]!.subProcesses![1]!;
    expect(sub.kind).toBe("procedural_decay");
    expect(sub.metrics.routineCount).toBe(0);
    expect(sub.metrics.averageStrengthBefore).toBe(0);
    expect(sub.metrics.averageStrengthAfter).toBe(0);
    expect(sub.reasons.some((r) => r.includes("No procedural routines"))).toBe(true);
  });

  // ─── V5.4 Boundary Recovery SubProcess Integration ──────────────────

  it("Phase 3 subProcess boundary_recovery kind and metrics are populated", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({
        stressLoad: 0.8,
        integrity: 0.52,
        cracks: 0.35,
        recoveryRate: 0.035
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    const sub = trace.phases[2]!.subProcesses![2]! as BoundaryRecoverySubProcessTrace;
    expect(sub.kind).toBe("boundary_recovery");
    expect(sub.id).toBe("decay_and_recovery.boundary_recovery");
    expect(sub.changedStates).toEqual(["boundary"]);
    expect(sub.metrics.stressLoadBefore).toBeGreaterThan(0);
    expect(sub.metrics.integrityBefore).toBeGreaterThan(0);
    expect(sub.metrics.cracksBefore).toBeGreaterThan(0);
    // Recovery should reduce stress and cracks, increase integrity
    expect(sub.metrics.stressLoadAfter).toBeLessThan(sub.metrics.stressLoadBefore);
    expect(sub.metrics.integrityAfter).toBeGreaterThanOrEqual(sub.metrics.integrityBefore);
    expect(sub.metrics.cracksAfter).toBeLessThanOrEqual(sub.metrics.cracksBefore);
    // D10 note must be present
    expect(sub.reasons.some((r) => r.includes("D10"))).toBe(true);
  });

  it("boundary recovery behavior unchanged after V5.4 instrumentation", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({
        stressLoad: 0.92,
        cracks: 0.5,
        integrity: 0.42,
        recoveryRate: 0.035,
        phase: "overflow"
      })
    });
    const stressBefore = state.boundary.stressLoad;
    const cracksBefore = state.boundary.cracks;

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    // Phase 3 recovery metrics
    const sub = trace.phases[2]!.subProcesses![2]! as BoundaryRecoverySubProcessTrace;
    expect(sub.metrics.stressLoadBefore).toBe(stressBefore);
    // D10: Phase 3 subprocess records recoverBoundary result, NOT final boundary
    // Final boundary AFTER homeostasis may differ from recoverBoundary output
    expect(sub.metrics.stressLoadAfter).toBeLessThan(sub.metrics.stressLoadBefore);
  });

  it("D10: Phase 4 homeostasis still overwrites Phase 3 boundary recovery result", () => {
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({
        stressLoad: 0.85,
        cracks: 0.4,
        integrity: 0.45,
        recoveryRate: 0.035,
        phase: "overflow"
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    // Phase 3 subprocess records recoverBoundary() intermediate
    const sub = trace.phases[2]!.subProcesses![2]! as BoundaryRecoverySubProcessTrace;
    const phase3StressLoad = sub.metrics.stressLoadAfter;

    // Final state.boundary is regulatedBoundary from homeostasis (Phase 4 overwrite)
    // D10: state.boundary must equal regulatedBoundary, NOT the Phase 3 intermediate
    expect(state.boundary.stressLoad).toBe(trace.homeostasis.regulatedBoundary.stressLoad);
    expect(trace.boundaryAfter.stressLoad).toBe(state.boundary.stressLoad);

    // The Phase 3 intermediate may differ from the final boundary
    // (they are different operations: Phase 3 is recovery, Phase 4 is homeostatic regulation)
    // We don't assert equality — they are distinct processes
  });

  it("D10: boundary_recovery subProcess does not interfere with homeostasis overwrite", () => {
    // Verify that adding the subProcess trace didn't alter the overwrite behavior
    const state = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({
        stressLoad: 0.75,
        cracks: 0.3,
        integrity: 0.55,
        recoveryRate: 0.035
      })
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    // D10-1: final state.boundary === regulatedBoundary (overwrite occurred)
    expect(state.boundary).toEqual(trace.homeostasis.regulatedBoundary);
    // D10-3: regulatedBoundary is not just a pass-through of Phase 3 recovery
    // Phase 4 homeostatic regulation is independent of Phase 3 recovery
    const sub = trace.phases[2]!.subProcesses![2]! as BoundaryRecoverySubProcessTrace;
    expect(sub.kind).toBe("boundary_recovery");
    // The subprocess exists and records the intermediate — overwrite still works
  });

  // ─── V5.5 Reward Recovery SubProcess Integration ──────────────────

  it("Phase 3 subProcess reward_recovery kind and metrics are populated", () => {
    const state = createCharacterPhysicsState({
      rewardState: {
        dopamineLevel: 0.75,
        dopamineThreshold: 0.82,
        rewardSensitivity: 0.3,
        noveltyNeed: 0.6,
        adaptationRate: 0.08,
        craving: 0.65
      }
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    const sub = trace.phases[2]!.subProcesses![3]! as RewardRecoverySubProcessTrace;
    expect(sub.kind).toBe("reward_recovery");
    expect(sub.id).toBe("decay_and_recovery.reward_recovery");
    expect(sub.changedStates).toEqual(["rewardState"]);
    expect(sub.metrics.dopamineBefore).toBeGreaterThan(0);
    expect(sub.metrics.thresholdBefore).toBeGreaterThan(0);
    expect(sub.metrics.cravingBefore).toBeGreaterThan(0);
    // Recovery should move elevated values toward baseline
    expect(sub.metrics.dopamineAfter).toBeLessThan(sub.metrics.dopamineBefore);
    expect(sub.metrics.thresholdAfter).toBeLessThan(sub.metrics.thresholdBefore);
    expect(sub.metrics.cravingAfter).toBeLessThan(sub.metrics.cravingBefore);
    // D10 note must be present
    expect(sub.reasons.some((r) => r.includes("D10"))).toBe(true);
  });

  it("reward recovery behavior unchanged after V5.5 instrumentation", () => {
    const state = createCharacterPhysicsState({
      rewardState: {
        dopamineLevel: 0.9,
        dopamineThreshold: 0.82,
        rewardSensitivity: 0.2,
        noveltyNeed: 0.88,
        adaptationRate: 0.08,
        craving: 0.76
      }
    });

    const dopamineBefore = state.rewardState.dopamineLevel;
    const trace = runContinuousTick(state, { daysElapsed: 30 });

    // Same behavior assertions as V4
    expect(trace.rewardAfter.dopamineLevel).toBeLessThan(trace.rewardBefore.dopamineLevel);
    expect(trace.rewardAfter.dopamineThreshold).toBeLessThan(trace.rewardBefore.dopamineThreshold);
    expect(trace.rewardAfter.craving).toBeLessThan(trace.rewardBefore.craving);
  });

  it("D10: Phase 4 homeostasis still overwrites Phase 3 reward recovery result", () => {
    const state = createCharacterPhysicsState({
      rewardState: {
        dopamineLevel: 0.85,
        dopamineThreshold: 0.78,
        rewardSensitivity: 0.25,
        noveltyNeed: 0.85,
        adaptationRate: 0.08,
        craving: 0.7
      }
    });

    const trace = runContinuousTick(state, { daysElapsed: 30 });

    // D10: state.rewardState must equal regulatedRewardState (Phase 4 overwrite)
    expect(state.rewardState).toEqual(trace.homeostasis.regulatedRewardState);
    // Verify subprocess exists at index 3
    const sub = trace.phases[2]!.subProcesses![3]! as RewardRecoverySubProcessTrace;
    expect(sub.kind).toBe("reward_recovery");
    // The subprocess records the intermediate — overwrite still works
  });

  it("D10: reward_recovery subProcess does not interfere with homeostasis overwrite", () => {
    const state = createCharacterPhysicsState({
      rewardState: {
        dopamineLevel: 0.72,
        dopamineThreshold: 0.68,
        rewardSensitivity: 0.35,
        noveltyNeed: 0.62,
        adaptationRate: 0.08,
        craving: 0.55
      }
    });

    const trace = runContinuousTick(state, { daysElapsed: 14 });

    // D10-3: final state.rewardState === regulatedRewardState (overwrite occurred)
    expect(state.rewardState).toEqual(trace.homeostasis.regulatedRewardState);
    // Subprocess exists at index 3
    const sub = trace.phases[2]!.subProcesses![3]!;
    expect(sub.kind).toBe("reward_recovery");
  });
});
