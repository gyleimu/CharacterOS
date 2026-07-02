import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import {
  toGetStateResponse,
  toApplyParameterAdjustmentResponse,
  toContinuousTickResponse,
  toGetParameterAdjustmentHistoryResponse,
  toProcessEventResponse,
  toRollbackParameterAdjustmentResponse,
  toSimulateEventsResponse
} from "../../src/services/characterPhysicsDto";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";
import type { ParameterAdjustmentApplyTrace } from "../../src/core/parameters/parameterAdjustmentApply";

const event: ExperienceEvent = {
  id: "dto_event_1",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "等待", "亲密关系"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9
};

describe("Character Physics DTO adapters", () => {
  it("creates JSON-safe process event responses", () => {
    const service = new InMemoryCharacterPhysicsService();
    const result = service.processEvent("lin_fan", event);
    const response = toProcessEventResponse("lin_fan", service, result);
    const encoded = JSON.stringify(response);

    expect(response.characterId).toBe("lin_fan");
    expect(response.memoryId).toBe("memory_dto_event_1");
    expect(response.state.clusters).toHaveLength(1);
    expect(response.galaxyTrace.clusterMetrics).toHaveLength(1);
    expect(response.proceduralActivations[0]?.routine.id).toBe("routine_check_message");
    expect(response.rewardResult.after.craving).toBeGreaterThanOrEqual(response.rewardResult.before.craving);
    expect(response.timePerception.subjectiveDuration).toBeGreaterThan(0);
    expect(response.worldInterpretation.frame).toBe("rejection");
    expect(response.galaxyTrace.totalForce.values.trust).toBeLessThan(0);
    expect(response.galaxyTrace.nextVelocity.values.trust).toBeLessThan(0);
    expect(encoded).toContain("memory_dto_event_1");
  });

  it("creates get state responses", () => {
    const service = new InMemoryCharacterPhysicsService();
    const response = toGetStateResponse("lin_fan", service);

    expect(response.characterId).toBe("lin_fan");
    expect(response.state.memories).toHaveLength(0);
    expect(response.integrity.valid).toBe(true);
    expect(response.integrity.summary.proceduralRoutineCount).toBeGreaterThan(0);
  });

  it("creates simulation responses", () => {
    const service = new InMemoryCharacterPhysicsService();
    const result = service.simulateEvents("lin_fan", [event], { daysPerStep: 7 });
    const response = toSimulateEventsResponse("lin_fan", result);

    expect(response.snapshots).toHaveLength(1);
    expect(response.state.memories).toHaveLength(1);
  });

  it("creates continuous tick responses", () => {
    const service = new InMemoryCharacterPhysicsService();
    service.processEvent("lin_fan", event);
    const trace = service.tickCharacter("lin_fan", { daysElapsed: 7 });
    const response = toContinuousTickResponse("lin_fan", service, trace);
    const encoded = JSON.stringify(response);

    expect(response.characterId).toBe("lin_fan");
    expect(response.trace.daysElapsed).toBe(7);
    expect(response.state.memories).toHaveLength(1);
    expect(response.state.metaState?.selfControl).toBeGreaterThan(0);
    expect(encoded).toContain("averageMemoryRecencyAfter");
  });

  it("creates parameter adjustment apply and rollback responses", () => {
    const service = new InMemoryCharacterPhysicsService();
    const trace: ParameterAdjustmentApplyTrace = {
      status: "applied",
      appliedOperations: [],
      snapshotId: "snapshot_test",
      reasons: ["test"]
    };

    const applyResponse = toApplyParameterAdjustmentResponse("lin_fan", service, trace);
    const rollbackResponse = toRollbackParameterAdjustmentResponse("lin_fan", service, trace);

    expect(applyResponse.characterId).toBe("lin_fan");
    expect(applyResponse.trace.snapshotId).toBe("snapshot_test");
    expect(rollbackResponse.state.metaState?.selfControl).toBeGreaterThan(0);
  });

  it("creates parameter adjustment history responses with summary", () => {
    const service = new InMemoryCharacterPhysicsService();
    const response = toGetParameterAdjustmentHistoryResponse("lin_fan", service);

    expect(response.characterId).toBe("lin_fan");
    expect(response.history).toHaveLength(0);
    expect(response.summary.stabilityRisk).toBe("low");
    expect(response.governance.recommendation).toBe("allow");
  });
});
