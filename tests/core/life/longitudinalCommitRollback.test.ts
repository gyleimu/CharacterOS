import { describe, expect, it } from "vitest";
import {
  applyLongitudinalCommitRollbackToState,
  evaluateLongitudinalCommitRollbackReadiness,
  LONGITUDINAL_ROLLBACK_CONFIRMATION,
} from "../../../src/core/life/longitudinalCommitRollback";
import { createLongitudinalCommitAuditEntry, markLongitudinalCommitAuditApplied } from "../../../src/core/life/longitudinalCommitAudit";
import { computeLongitudinalStateFingerprint } from "../../../src/core/life/finalStateForCommit";
import { createDefaultState } from "../../../src/services/characterPhysicsService";
import {
  buildLongitudinalCommitHandoff,
  cloneWithGeneratedMemory,
} from "../../helpers/longitudinalCommitTestUtils";

function appliedAudit(characterId = "rollback-core-char") {
  const baseState = createDefaultState(characterId);
  const finalState = cloneWithGeneratedMemory(baseState, "life-core-rollback-1");
  const handoff = buildLongitudinalCommitHandoff(characterId, baseState, finalState);
  return {
    baseState,
    finalState,
    audit: markLongitudinalCommitAuditApplied(
      createLongitudinalCommitAuditEntry(handoff),
      "2026-06-28T01:00:00.000Z"
    ),
  };
}

describe("longitudinal commit rollback core", () => {
  it("reports ready for an applied audit with matching final fingerprint", () => {
    const { finalState, audit } = appliedAudit();

    const readiness = evaluateLongitudinalCommitRollbackReadiness({
      audit,
      currentStateFingerprint: computeLongitudinalStateFingerprint(finalState),
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.blockers).toHaveLength(0);
  });

  it("blocks when confirmation is missing", () => {
    const { finalState, audit } = appliedAudit();

    const readiness = evaluateLongitudinalCommitRollbackReadiness({
      audit,
      currentStateFingerprint: computeLongitudinalStateFingerprint(finalState),
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockers.join(" ")).toContain("confirmation");
  });

  it("returns conflict when current state differs from the applied final state", () => {
    const { finalState, audit } = appliedAudit();
    const changed = cloneWithGeneratedMemory(finalState, "life-core-extra-memory");

    const readiness = evaluateLongitudinalCommitRollbackReadiness({
      audit,
      currentStateFingerprint: computeLongitudinalStateFingerprint(changed),
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    });

    expect(readiness.status).toBe("conflict");
    expect(readiness.reasons.join(" ")).toContain("fingerprint");
  });

  it("removes generated memories without mutating the original state", () => {
    const { baseState, finalState, audit } = appliedAudit();

    const mutation = applyLongitudinalCommitRollbackToState(finalState, audit);

    expect(mutation.removedMemoryIds).toEqual(["life-core-rollback-1"]);
    expect(mutation.missingMemoryIds).toEqual([]);
    expect(mutation.state.memories.map((memory) => memory.id)).not.toContain("life-core-rollback-1");
    expect(finalState.memories.map((memory) => memory.id)).toContain("life-core-rollback-1");
    expect(computeLongitudinalStateFingerprint(mutation.state)).toEqual(computeLongitudinalStateFingerprint(baseState));
  });
});
