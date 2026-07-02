import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import type { CharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { InMemoryCharacterPhysicsRepository } from "../../src/db/repositories/characterPhysicsRepository";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { InMemoryParameterAdjustmentHistoryRepository } from "../../src/db/repositories/parameterAdjustmentHistoryRepository";
import {
  createParameterAdjustmentHistoryEntry,
  type ParameterAdjustmentHistoryEntry
} from "../../src/core/parameters/parameterAdjustmentHistory";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import { buildImportConfirmationPhrase } from "../../src/core/export/characterImportApply";

const event: ExperienceEvent = {
  id: "service_event_1",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "等待", "亲密关系"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9
};

describe("InMemoryCharacterPhysicsService", () => {
  it("keeps physics state per character id", () => {
    const service = new InMemoryCharacterPhysicsService();

    service.processEvent("lin_fan", event);
    service.processEvent("lin_fan", { ...event, id: "service_event_2" });
    const state = service.getState("lin_fan");

    expect(state.memories).toHaveLength(2);
    expect(state.clusters.get("abandonment")?.age).toBe(2);
  });

  it("isolates different character ids", () => {
    const service = new InMemoryCharacterPhysicsService();

    service.processEvent("lin_fan", event);
    const linFan = service.getState("lin_fan");
    const other = service.getState("other_character");

    expect(linFan.memories).toHaveLength(1);
    expect(other.memories).toHaveLength(0);
  });

  it("returns a defensive copy of character state", () => {
    const service = new InMemoryCharacterPhysicsService();
    service.processEvent("lin_fan", event);

    const exposed = service.getState("lin_fan");
    exposed.memories.length = 0;
    exposed.clusters.clear();
    exposed.coordinate.values.trust = 123;

    const internal = service.getState("lin_fan");

    expect(internal.memories).toHaveLength(1);
    expect(internal.clusters.size).toBe(1);
    expect(internal.coordinate.values.trust).not.toBe(123);
  });

  it("resets a character state", () => {
    const service = new InMemoryCharacterPhysicsService();

    service.processEvent("lin_fan", event);
    service.resetCharacter("lin_fan");

    expect(service.getState("lin_fan").memories).toHaveLength(0);
    expect(service.getState("lin_fan").clusters.size).toBe(0);
  });

  it("can reset a character with blueprint origin experiences", () => {
    const service = new InMemoryCharacterPhysicsService();

    service.resetCharacter("lin_fan", { seedInitialExperiences: true });

    expect(service.getState("lin_fan").identity.name).toBe("林凡");
    expect(service.getState("lin_fan").memories).toHaveLength(3);
    expect(service.getState("lin_fan").clusters.get("abandonment")?.age).toBe(2);
    expect(service.getState("lin_fan").clusters.get("support")?.age).toBe(1);
  });

  it("can use an injected repository", () => {
    const repository = new InMemoryCharacterPhysicsRepository();
    const service = new InMemoryCharacterPhysicsService(repository);

    service.processEvent("lin_fan", event);

    expect(repository.get("lin_fan")?.memories).toHaveLength(1);
  });

  it("ticks a character forward and persists continuous living changes", () => {
    const service = new InMemoryCharacterPhysicsService();
    service.processEvent("lin_fan", event);
    const before = service.getState("lin_fan").memories[0]?.recency ?? 0;

    const trace = service.tickCharacter("lin_fan", { daysElapsed: 14 });
    const after = service.getState("lin_fan").memories[0]?.recency ?? 0;

    expect(trace.daysElapsed).toBe(14);
    expect(after).toBeLessThan(before);
    expect(trace.averageMemoryRecencyAfter).toBe(after);
  });

  it("reinforces procedural routines when event cues match automatic habits", () => {
    const service = new InMemoryCharacterPhysicsService();
    const before = service
      .getState("lin_fan")
      .proceduralRoutines.find((routine) => routine.id === "routine_check_message");

    const result = service.processEvent("lin_fan", event);
    const after = service
      .getState("lin_fan")
      .proceduralRoutines.find((routine) => routine.id === "routine_check_message");

    expect(result.proceduralActivations[0]?.routine.id).toBe("routine_check_message");
    expect(after?.strength).toBeGreaterThan(before?.strength ?? 0);
    expect(after?.repetitionCount).toBe((before?.repetitionCount ?? 0) + 1);
  });

  it("explicitly applies and rolls back parameter adjustment patches", () => {
    const service = new InMemoryCharacterPhysicsService();
    const before = service.getState("lin_fan").metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({
      state: service.getState("lin_fan"),
      patch
    });

    const applyTrace = service.applyParameterAdjustment("lin_fan", patch, snapshot);

    expect(applyTrace.status).toBe("applied");
    expect(service.getState("lin_fan").metaState.selfControl).toBeCloseTo(before - 0.02);

    const rollbackTrace = service.rollbackParameterAdjustment("lin_fan", snapshot);

    expect(rollbackTrace.status).toBe("applied");
    expect(service.getState("lin_fan").metaState.selfControl).toBe(before);
    expect(service.getParameterAdjustmentHistory("lin_fan")).toHaveLength(2);
  });

  it("blocks manual adjustment during active governance cooldown unless explicitly overridden", () => {
    const historyRepository = new InMemoryParameterAdjustmentHistoryRepository();
    const service = new InMemoryCharacterPhysicsService(
      new InMemoryCharacterPhysicsRepository(),
      historyRepository
    );
    service.getState("lin_fan");
    for (let index = 0; index < 4; index += 1) {
      historyRepository.append(createParameterAdjustmentHistoryEntry({
        characterId: "lin_fan",
        action: "apply",
        trace: {
          status: "applied",
          snapshotId: `snapshot_${index}`,
          appliedOperations: [
            {
              op: "replace",
              path: "metaState.selfControl",
              from: 0.5,
              value: 0.48,
              reason: "test"
            }
          ],
          reasons: ["test"]
        }
      }));
    }
    const before = service.getState("lin_fan").metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({
      state: service.getState("lin_fan"),
      patch
    });

    const blocked = service.applyParameterAdjustment("lin_fan", patch, snapshot);
    const applied = service.applyParameterAdjustment("lin_fan", patch, snapshot, {
      enabled: true,
      reason: "manual correction after verified bad calibration"
    });

    expect(blocked.status).toBe("blocked");
    expect(blocked.reasons[0]).toBe("manual adjustment blocked by active governance cooldown");
    expect(applied.status).toBe("applied");
    expect(applied.reasons).toContain("active governance cooldown overridden by explicit human reason");
    expect(applied.governanceOverride).toEqual({
      used: true,
      reason: "manual correction after verified bad calibration"
    });
    expect(service.getParameterAdjustmentHistory("lin_fan").at(-1)?.governanceOverride).toEqual({
      used: true,
      reason: "manual correction after verified bad calibration"
    });
  });

  it("imports a confirmed export package and replaces state plus adjustment history", () => {
    const sourceService = new InMemoryCharacterPhysicsService();
    sourceService.processEvent("source_character", event);
    const sourceHistoryEntry = createParameterAdjustmentHistoryEntry({
      characterId: "source_character",
      action: "apply",
      createdAt: "2026-06-21T00:00:00.000Z",
      trace: {
        status: "applied",
        snapshotId: "snapshot_imported",
        appliedOperations: [],
        reasons: ["source adjustment"]
      }
    });
    const sourcePackage = exportPackage({
      characterId: "source_character",
      state: sourceService.getState("source_character"),
      history: [sourceHistoryEntry]
    });
    const targetService = new InMemoryCharacterPhysicsService();
    targetService.resetCharacter("target_character");

    const trace = targetService.importCharacterPackage(
      "target_character",
      sourcePackage,
      buildImportConfirmationPhrase("target_character")
    );

    expect(trace.status).toBe("applied");
    expect(trace.transactionSteps.map((step) => step.name)).toEqual([
      "authorization_checked",
      "before_state_integrity_inspected",
      "state_deserialized",
      "after_state_integrity_inspected",
      "pre_mutation_snapshot_captured",
      "state_replaced",
      "adjustment_history_replaced",
      "history_recorded"
    ]);
    expect(trace.transactionSteps.every((step) => step.status === "completed")).toBe(true);
    expect(trace.transactionSummary).toMatchObject({
      terminalStatus: "completed",
      totalSteps: 8,
      completedSteps: 8,
      blockedSteps: 0,
      failedSteps: 0,
      stateMutated: true,
      adjustmentHistoryMutated: true,
      historyRecorded: true,
      lastStep: "history_recorded"
    });
    expect(trace.historyEntryId).toMatch(/^import_history_[0-9a-f]{16}$/);
    expect(trace.historyRecordedAt).toBeDefined();
    expect(trace.transitionId).toMatch(/^import_[0-9a-f]{16}$/);
    expect(trace.appliedAt).toBeDefined();
    expect(trace.transitionSummary?.delta.memoryCount).toBe(1);
    expect(trace.transitionSummary?.delta.particleCount).toBe(1);
    expect(trace.transitionSummary?.afterValid).toBe(true);
    expect(trace.transitionSummary?.packageDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(trace.beforeStateIntegrity?.summary.memoryCount).toBe(0);
    expect(trace.afterStateIntegrity?.summary.memoryCount).toBe(1);
    expect(trace.afterStateIntegrity?.valid).toBe(true);
    expect(trace.reasons).toContain("character import replaced state and adjustment history");
    expect(targetService.getState("target_character").memories).toHaveLength(1);
    expect(targetService.getParameterAdjustmentHistory("target_character")).toHaveLength(1);
    expect(targetService.getParameterAdjustmentHistory("target_character")[0]?.characterId).toBe("target_character");
    expect(targetService.getImportTransitionHistory("target_character")).toHaveLength(1);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.status).toBe("applied");
    expect(targetService.getImportTransitionHistory("target_character")[0]?.id).toBe(trace.historyEntryId);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.createdAt).toBe(trace.historyRecordedAt);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.trace.historyEntryId).toBe(trace.historyEntryId);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.trace.transactionSteps.at(-1)?.name).toBe("history_recorded");
    expect(targetService.getImportTransitionHistory("target_character")[0]?.transitionId).toBe(trace.transitionId);

    // V3.11: mutation outcome and rollback snapshot
    expect(trace.mutationOutcome).toBeDefined();
    expect(trace.mutationOutcome?.fullyApplied).toBe(true);
    expect(trace.mutationOutcome?.stateReplaced).toBe(true);
    expect(trace.mutationOutcome?.adjustmentHistoryReplaced).toBe(true);
    expect(trace.mutationOutcome?.historyRecorded).toBe(true);
    expect(trace.mutationOutcome?.description).toBe("all mutations applied successfully");
    expect(trace.stateRollbackSnapshot).toBeDefined();
  });

  it("exposes mutationOutcome and stateRollbackSnapshot even when import is blocked early", () => {
    const targetService = new InMemoryCharacterPhysicsService();
    targetService.resetCharacter("target_character");

    // Import without confirmation → blocked at authorization
    const trace = targetService.importCharacterPackage(
      "target_character",
      exportPackage({
        characterId: "source_character",
        state: targetService.getState("target_character"),
        history: []
      })
      // No confirmation → blocked
    );

    expect(trace.status).toBe("blocked");
    // When blocked at authorization, mutationOutcome should reflect zero mutations
    expect(trace.mutationOutcome).toBeDefined();
    expect(trace.mutationOutcome?.fullyApplied).toBe(false);
    expect(trace.mutationOutcome?.stateReplaced).toBe(false);
    expect(trace.mutationOutcome?.adjustmentHistoryReplaced).toBe(false);
    // stateRollbackSnapshot is NOT present because no mutation was attempted
    expect(trace.stateRollbackSnapshot).toBeUndefined();
    // transactionSummary should correctly report no mutations
    expect(trace.transactionSummary.stateMutated).toBe(false);
    expect(trace.transactionSummary.adjustmentHistoryMutated).toBe(false);
  });

  it("blocks a confirmed package when adjustment history entries are not safely shaped", () => {
    const sourceService = new InMemoryCharacterPhysicsService();
    sourceService.processEvent("source_character", event);
    const sourceHistoryEntry = createParameterAdjustmentHistoryEntry({
      characterId: "source_character",
      action: "apply",
      createdAt: "2026-06-21T00:00:00.000Z",
      trace: {
        status: "applied",
        snapshotId: "snapshot_imported",
        appliedOperations: [],
        reasons: ["source adjustment"]
      }
    });
    const basePackage = exportPackage({
      characterId: "source_character",
      state: sourceService.getState("source_character"),
      history: [sourceHistoryEntry]
    });
    const malformedPackage = {
      ...basePackage,
      adjustmentHistory: {
        ...basePackage.adjustmentHistory,
        history: [
          {
            ...sourceHistoryEntry,
            targetPaths: [123]
          }
        ]
      }
    };
    const targetService = new InMemoryCharacterPhysicsService();
    targetService.resetCharacter("target_character");

    const trace = targetService.importCharacterPackage(
      "target_character",
      malformedPackage,
      buildImportConfirmationPhrase("target_character")
    );

    expect(trace.status).toBe("blocked");
    expect(trace.transactionSteps.map((step) => step.name)).toEqual([
      "authorization_checked",
      "before_state_integrity_inspected",
      "apply_failed",
      "history_recorded"
    ]);
    expect(trace.transactionSummary).toMatchObject({
      terminalStatus: "failed",
      stateMutated: false,
      adjustmentHistoryMutated: false,
      historyRecorded: true,
      lastStep: "history_recorded"
    });
    expect(trace.reasons).toContain("import package shape was not available");
    expect(targetService.getState("target_character").memories).toHaveLength(0);
    expect(targetService.getParameterAdjustmentHistory("target_character")).toHaveLength(0);
    expect(targetService.getImportTransitionHistory("target_character")).toHaveLength(1);
  });

  it("does not import a package when confirmation is missing", () => {
    const sourceService = new InMemoryCharacterPhysicsService();
    sourceService.processEvent("source_character", event);
    const sourcePackage = exportPackage({
      characterId: "source_character",
      state: sourceService.getState("source_character"),
      history: []
    });
    const targetService = new InMemoryCharacterPhysicsService();
    targetService.resetCharacter("target_character");

    const trace = targetService.importCharacterPackage("target_character", sourcePackage);

    expect(trace.status).toBe("blocked");
    expect(trace.transactionSteps.map((step) => step.name)).toEqual([
      "authorization_checked",
      "history_recorded"
    ]);
    expect(trace.transactionSteps[0]?.status).toBe("blocked");
    expect(trace.transactionSteps[1]?.status).toBe("completed");
    expect(trace.transactionSummary).toMatchObject({
      terminalStatus: "blocked",
      totalSteps: 2,
      completedSteps: 1,
      blockedSteps: 1,
      failedSteps: 0,
      stateMutated: false,
      adjustmentHistoryMutated: false,
      historyRecorded: true,
      lastStep: "history_recorded"
    });
    expect(trace.historyEntryId).toMatch(/^import_history_[0-9a-f]{16}$/);
    expect(trace.historyRecordedAt).toBeDefined();
    expect(trace.transitionId).toBeUndefined();
    expect(trace.appliedAt).toBeUndefined();
    expect(trace.transitionSummary).toBeUndefined();
    expect(trace.beforeStateIntegrity).toBeUndefined();
    expect(trace.afterStateIntegrity).toBeUndefined();
    expect(targetService.getState("target_character").memories).toHaveLength(0);
    expect(targetService.getImportTransitionHistory("target_character")).toHaveLength(1);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.status).toBe("blocked");
    expect(targetService.getImportTransitionHistory("target_character")[0]?.id).toBe(trace.historyEntryId);
    expect(targetService.getImportTransitionHistory("target_character")[0]?.trace.historyEntryId).toBe(trace.historyEntryId);
  });
});

function patchTrace(from: number, value: number): ParameterAdjustmentPatchTrace {
  return {
    status: "ready",
    operations: [
      {
        op: "replace",
        path: "metaState.selfControl",
        from,
        value,
        reason: "test"
      }
    ],
    reasons: []
  };
}

function exportPackage(params: {
  characterId: string;
  state: CharacterPhysicsState;
  history: ParameterAdjustmentHistoryEntry[];
}): CharacterPhysicsExportResponse {
  return {
    exportedAt: "2026-06-21T00:00:00.000Z",
    characterId: params.characterId,
    version: "1.1",
    state: serializeCharacterPhysicsState(params.state),
    adjustmentHistory: {
      history: params.history,
      summary: {
        totalEntries: params.history.length,
        appliedCount: params.history.filter((entry) => entry.action === "apply").length,
        rollbackCount: params.history.filter((entry) => entry.action === "rollback").length,
        blockedCount: 0,
        overrideCount: 0,
        totalOperations: 0,
        uniqueTargetPaths: [],
        latestTargetPaths: [],
        frequentTargetPaths: [],
        stabilityRisk: "low",
        reasons: ["test export package"]
      },
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: ["test export package"]
      }
    }
  };
}
