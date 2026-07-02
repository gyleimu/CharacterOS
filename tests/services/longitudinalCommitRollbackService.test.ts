import { describe, expect, it } from "vitest";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import { computeLongitudinalStateFingerprint } from "../../src/core/life/finalStateForCommit";
import { LONGITUDINAL_ROLLBACK_CONFIRMATION } from "../../src/core/life/longitudinalCommitRollback";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";
import {
  buildLongitudinalCommitHandoff,
  cloneWithGeneratedMemory,
} from "../helpers/longitudinalCommitTestUtils";

function applyGeneratedCommit(service: InMemoryCharacterPhysicsService, characterId: string) {
  service.resetCharacter(characterId);
  const baseState = service.getState(characterId);
  const finalState = cloneWithGeneratedMemory(baseState, "life-service-rollback-1");
  const handoff = buildLongitudinalCommitHandoff(characterId, baseState, finalState);
  const applyResult = service.applyLongitudinalCommit(handoff, {
    confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    appliedAt: "2026-06-28T01:00:00.000Z",
  });
  expect(applyResult.status).toBe("applied");
  return { baseState, finalState, handoff, applyResult };
}

describe("InMemoryCharacterPhysicsService.rollbackLongitudinalCommit", () => {
  it("rolls back an applied commit by removing generated memories and marking audit", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-rollback-char";
    const { baseState, handoff } = applyGeneratedCommit(service, characterId);

    const result = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      {
        confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
        rolledBackAt: "2026-06-28T02:00:00.000Z",
      }
    );

    expect(result.status).toBe("rolled_back");
    expect(result.rolledBack).toBe(true);
    expect(result.mutation?.removedMemoryIds).toEqual(["life-service-rollback-1"]);
    expect(service.getState(characterId).memories.map((memory) => memory.id)).not.toContain("life-service-rollback-1");
    expect(computeLongitudinalStateFingerprint(service.getState(characterId)))
      .toEqual(computeLongitudinalStateFingerprint(baseState));
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("rolled_back");
  });

  it("blocks without rollback confirmation and leaves applied state intact", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-rollback-no-confirm";
    const { handoff } = applyGeneratedCommit(service, characterId);

    const result = service.rollbackLongitudinalCommit(characterId, { simulationId: handoff.simulationId });

    expect(result.status).toBe("blocked");
    expect(result.rolledBack).toBe(false);
    expect(result.readiness?.blockers.join(" ")).toContain("confirmation");
    expect(service.getState(characterId).memories.map((memory) => memory.id)).toContain("life-service-rollback-1");
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("applied");
  });

  it("returns conflict when current state changed after commit apply", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-rollback-conflict";
    const { handoff } = applyGeneratedCommit(service, characterId);
    const changed = service.getState(characterId);
    changed.coordinate.values.trust = 0.99;
    service.replaceState(characterId, changed);

    const result = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      { confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION }
    );

    expect(result.status).toBe("conflict");
    expect(result.rolledBack).toBe(false);
    expect(service.getState(characterId).memories.map((memory) => memory.id)).toContain("life-service-rollback-1");
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("applied");
  });

  it("blocks a second rollback because the audit is no longer applied", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-rollback-second";
    const { handoff } = applyGeneratedCommit(service, characterId);

    const first = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      { confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION }
    );
    const second = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      { confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION }
    );

    expect(first.status).toBe("rolled_back");
    expect(second.status).toBe("blocked");
    expect(second.readiness?.blockers.join(" ")).toContain("rolled_back");
  });

  it("returns not_found for missing audit", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-rollback-missing-audit";
    service.resetCharacter(characterId);

    const result = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: "missing-simulation" },
      { confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION }
    );

    expect(result.status).toBe("not_found");
    expect(result.rolledBack).toBe(false);
  });
});
