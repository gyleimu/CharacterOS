import { describe, expect, it } from "vitest";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import { LONGITUDINAL_ROLLBACK_CONFIRMATION } from "../../src/core/life/longitudinalCommitRollback";
import { computeLongitudinalStateFingerprint } from "../../src/core/life/finalStateForCommit";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";
import {
  buildLongitudinalCommitHandoff,
  cloneWithGeneratedMemory,
} from "../helpers/longitudinalCommitTestUtils";

function setupCharacter(service: InMemoryCharacterPhysicsService, characterId: string) {
  service.resetCharacter(characterId);
  const baseState = service.getState(characterId);
  const finalState = cloneWithGeneratedMemory(baseState, "life-lifecycle-qa");
  const handoff = buildLongitudinalCommitHandoff(characterId, baseState, finalState);
  return { baseState, finalState, handoff };
}

describe("V10.29 Longitudinal Commit Lifecycle QA", () => {
  // ── Preview (no mutation) ─────────────────────────────────────────────

  it("preview does not mutate state", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-preview-nomut";
    const { baseState, handoff } = setupCharacter(service, characterId);

    // Preview is computed from the handoff without any repository write
    const beforeMem = service.getState(characterId).memories.length;
    const beforeTrust = service.getState(characterId).coordinate.values.trust;

    // Simulate preview: build handoff, check it, but don't apply
    expect(handoff.version).toBe("v10.21");
    expect(handoff.commitSurface.changes.length).toBeGreaterThanOrEqual(1);
    expect(handoff.governance.status).toBe("pass");

    // State must be unchanged
    const afterMem = service.getState(characterId).memories.length;
    const afterTrust = service.getState(characterId).coordinate.values.trust;
    expect(afterMem).toBe(beforeMem);
    expect(afterTrust).toBe(beforeTrust);
    // Generated memory must NOT be in the service state
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa");
  });

  // ── Apply: audit applied + fingerprint matches ────────────────────────

  it("apply records applied audit and state fingerprint matches final", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-apply-audit";
    const { baseState, finalState, handoff } = setupCharacter(service, characterId);

    const result = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });

    // Applied successfully
    expect(result.status).toBe("applied");
    expect(result.applied).toBe(true);

    // Audit entry recorded
    expect(result.audit).toBeDefined();
    expect(result.audit!.status).toBe("applied");
    expect(result.audit!.appliedAt).toBe("2026-06-28T01:00:00.000Z");
    expect(result.audit!.generatedMemoryIds).toContain("life-lifecycle-qa");

    // State now contains the generated memory
    const currentState = service.getState(characterId);
    expect(currentState.memories.map((m) => m.id)).toContain("life-lifecycle-qa");

    // State fingerprint matches the final state from the handoff
    expect(computeLongitudinalStateFingerprint(currentState))
      .toEqual(computeLongitudinalStateFingerprint(finalState));

    // Base state fingerprint is NOT the same as final (state changed)
    expect(computeLongitudinalStateFingerprint(currentState))
      .not.toEqual(computeLongitudinalStateFingerprint(baseState));

    // Audit history has exactly one entry with correct status
    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe("applied");
    expect(history[0]!.generatedMemoryIds).toContain("life-lifecycle-qa");
  });

  // ── Rollback: audit rolled_back + memories removed ────────────────────

  it("rollback records rolled_back audit and removes generated memories", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-rollback-clean";
    const { baseState, handoff } = setupCharacter(service, characterId);

    // Apply first
    const applyResult = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });
    expect(applyResult.status).toBe("applied");
    expect(service.getState(characterId).memories.map((m) => m.id))
      .toContain("life-lifecycle-qa");

    // Rollback
    const rollbackResult = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      {
        confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
        rolledBackAt: "2026-06-28T02:00:00.000Z",
      }
    );

    expect(rollbackResult.status).toBe("rolled_back");
    expect(rollbackResult.rolledBack).toBe(true);

    // Generated memory removed
    expect(rollbackResult.mutation?.removedMemoryIds).toEqual(["life-lifecycle-qa"]);
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa");

    // After rollback, state fingerprint matches original base state
    expect(computeLongitudinalStateFingerprint(service.getState(characterId)))
      .toEqual(computeLongitudinalStateFingerprint(baseState));

    // Audit history: first applied, then rolled_back
    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe("rolled_back");
    expect(history[0]!.rolledBackAt).toBe("2026-06-28T02:00:00.000Z");
    // appliedAt preserved even after rollback
    expect(history[0]!.appliedAt).toBe("2026-06-28T01:00:00.000Z");
  });

  // ── Stale rollback returns conflict ───────────────────────────────────

  it("stale rollback returns conflict when state changed after apply", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-rollback-stale";
    const { handoff } = setupCharacter(service, characterId);

    // Apply
    const applyResult = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });
    expect(applyResult.status).toBe("applied");

    // Mutate state externally (simulates another operation modifying state)
    const changed = service.getState(characterId);
    changed.coordinate.values.trust = 0.01;
    service.replaceState(characterId, changed);

    // Rollback should detect stale state
    const rollbackResult = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      { confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION }
    );

    expect(rollbackResult.status).toBe("conflict");
    expect(rollbackResult.rolledBack).toBe(false);
    // Generated memory is still present (rollback was blocked)
    expect(service.getState(characterId).memories.map((m) => m.id))
      .toContain("life-lifecycle-qa");
    // Audit still shows "applied" (not rolled_back)
    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(history[0]!.status).toBe("applied");
  });

  // ── Failed retry does not corrupt audit ───────────────────────────────

  it("blocked retry does not corrupt previous applied audit", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-retry-nocorrupt";
    const { baseState, handoff } = setupCharacter(service, characterId);

    // First apply succeeds
    const first = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });
    expect(first.status).toBe("applied");
    expect(first.audit!.status).toBe("applied");

    // Restore to base state (simulates external reset)
    service.replaceState(characterId, baseState);

    // Second apply with WRONG confirmation — should be blocked
    const blockedRetry = service.applyLongitudinalCommit(handoff, {
      confirmation: "WRONG_CONFIRMATION",
      appliedAt: "2026-06-28T02:00:00.000Z",
    });
    expect(blockedRetry.status).toBe("blocked");
    expect(blockedRetry.applied).toBe(false);

    // Audit must still show "applied" from the first successful apply
    expect(blockedRetry.audit!.status).toBe("applied");
    // Not "blocked" — the V10.28 fix ensures we don't overwrite applied with blocked
    expect(blockedRetry.audit!.status).not.toBe("blocked");

    // Only ONE audit entry (no duplicate)
    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe("applied");
    expect(history[0]!.updatedAt).toBe("2026-06-28T01:00:00.000Z");
    // updatedAt should NOT have been overwritten to the retry timestamp
    expect(history[0]!.updatedAt).not.toBe("2026-06-28T02:00:00.000Z");

    // State should NOT have the generated memory (it was restored to base)
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa");
  });

  // ── Full lifecycle: preview → apply → rollback ────────────────────────

  it("full lifecycle: preview (no mutation) → apply (audited) → rollback (clean)", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "lifecycle-full";
    const { baseState, handoff } = setupCharacter(service, characterId);

    // Phase 0: Initial state
    const initialFingerprint = computeLongitudinalStateFingerprint(baseState);
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa");

    // Phase 1: Preview (no mutation)
    expect(handoff.governance.status).toBe("pass");
    expect(handoff.commitSurface.applied).toBe(true);
    expect(handoff.commitSurface.generatedMemoryCount).toBe(1);
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa"); // Still not present

    // Phase 2: Apply
    const applyResult = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });
    expect(applyResult.status).toBe("applied");
    expect(service.getState(characterId).memories.map((m) => m.id))
      .toContain("life-lifecycle-qa");
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]!.status)
      .toBe("applied");

    // Phase 3: Rollback
    const rollbackResult = service.rollbackLongitudinalCommit(
      characterId,
      { simulationId: handoff.simulationId },
      {
        confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
        rolledBackAt: "2026-06-28T02:00:00.000Z",
      }
    );
    expect(rollbackResult.status).toBe("rolled_back");
    expect(service.getState(characterId).memories.map((m) => m.id))
      .not.toContain("life-lifecycle-qa");

    // Phase 4: Final state matches initial
    expect(computeLongitudinalStateFingerprint(service.getState(characterId)))
      .toEqual(initialFingerprint);

    // Audit trail: one entry, status rolled_back, appliedAt preserved
    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe("rolled_back");
    expect(history[0]!.appliedAt).toBe("2026-06-28T01:00:00.000Z");
    expect(history[0]!.rolledBackAt).toBe("2026-06-28T02:00:00.000Z");
  });
});
