import type { CharacterPhysicsState } from "../physics/physicsEngine";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
} from "../physics/serialization";
import type { LongitudinalStateFingerprint } from "./finalStateForCommit";
import { computeLongitudinalStateFingerprint } from "./finalStateForCommit";
import type { LongitudinalCommitAuditEntry } from "./longitudinalCommitAudit";

export const LONGITUDINAL_ROLLBACK_CONFIRMATION = "ROLLBACK_LONGITUDINAL_COMMIT";

export type LongitudinalCommitRollbackReadinessStatus = "ready" | "blocked" | "conflict";
export type LongitudinalCommitRollbackStatus = "rolled_back" | "blocked" | "conflict" | "not_found";

export interface LongitudinalCommitRollbackOptions {
  confirmation?: string;
  rolledBackAt?: string;
}

export interface LongitudinalCommitRollbackTarget {
  auditId?: string;
  simulationId?: string;
}

export interface LongitudinalCommitRollbackReadiness {
  status: LongitudinalCommitRollbackReadinessStatus;
  blockers: string[];
  warnings: string[];
  reasons: string[];
  expectedFinalStateFingerprint: LongitudinalStateFingerprint;
  actualStateFingerprint: LongitudinalStateFingerprint;
}

export interface LongitudinalCommitRollbackMutation {
  state: CharacterPhysicsState;
  removedMemoryIds: string[];
  missingMemoryIds: string[];
  afterStateFingerprint: LongitudinalStateFingerprint;
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalCommitRollbackResult {
  status: LongitudinalCommitRollbackStatus;
  rolledBack: boolean;
  characterId: string;
  simulationId?: string;
  audit?: LongitudinalCommitAuditEntry;
  readiness?: LongitudinalCommitRollbackReadiness;
  mutation?: Omit<LongitudinalCommitRollbackMutation, "state">;
  warnings: string[];
  reasons: string[];
}

export function evaluateLongitudinalCommitRollbackReadiness(params: {
  audit: LongitudinalCommitAuditEntry;
  currentStateFingerprint: LongitudinalStateFingerprint;
  confirmation?: string;
}): LongitudinalCommitRollbackReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];
  const { audit } = params;

  if (params.confirmation !== LONGITUDINAL_ROLLBACK_CONFIRMATION) {
    blockers.push(`confirmation must equal ${LONGITUDINAL_ROLLBACK_CONFIRMATION}`);
  } else {
    reasons.push("Explicit longitudinal rollback confirmation matched.");
  }

  if (audit.status !== "applied") {
    blockers.push(`rollback requires an applied audit entry; current status is ${audit.status}.`);
  } else {
    reasons.push("Audit entry is applied and can be considered for rollback.");
  }

  if (audit.rollbackPlan.type !== "remove_generated_memories") {
    blockers.push(`unsupported rollback plan type: ${audit.rollbackPlan.type}.`);
  } else {
    reasons.push("Rollback plan removes generated memories only.");
  }

  if (audit.rollbackPlan.staleWritePolicy !== "block_if_changed") {
    blockers.push(`unsupported stale write policy: ${audit.rollbackPlan.staleWritePolicy}.`);
  } else {
    reasons.push("Rollback will block if current state differs from the applied final state.");
  }

  if (audit.rollbackPlan.generatedMemoryIds.length === 0) {
    blockers.push("rollback plan has no generated memory ids to remove.");
  }

  const fingerprintChanged = params.currentStateFingerprint.value !== audit.finalStateFingerprint.value;
  if (fingerprintChanged && audit.status === "applied") {
    reasons.push("Current state fingerprint differs from the applied final state; rollback must be retried after review.");
  } else if (fingerprintChanged) {
    blockers.push("current state fingerprint does not match applied final state fingerprint.");
  } else {
    reasons.push("Current state fingerprint matches applied final state fingerprint.");
  }

  warnings.push(...audit.rollbackPlan.warnings);
  warnings.push(...audit.governanceWarnings);

  const status: LongitudinalCommitRollbackReadinessStatus =
    audit.status === "applied" && fingerprintChanged
      ? "conflict"
      : blockers.length > 0
        ? "blocked"
        : "ready";

  return {
    status,
    blockers,
    warnings,
    reasons,
    expectedFinalStateFingerprint: audit.finalStateFingerprint,
    actualStateFingerprint: params.currentStateFingerprint,
  };
}

export function applyLongitudinalCommitRollbackToState(
  state: CharacterPhysicsState,
  audit: LongitudinalCommitAuditEntry
): LongitudinalCommitRollbackMutation {
  const next = cloneCharacterPhysicsState(state);
  const generatedIds = new Set(audit.rollbackPlan.generatedMemoryIds);
  const removedMemoryIds: string[] = [];

  next.memories = next.memories.filter((memory) => {
    if (!generatedIds.has(memory.id)) return true;
    removedMemoryIds.push(memory.id);
    return false;
  });

  const removed = new Set(removedMemoryIds);
  const missingMemoryIds = audit.rollbackPlan.generatedMemoryIds.filter((id) => !removed.has(id));
  const warnings = missingMemoryIds.length > 0
    ? [`${missingMemoryIds.length} generated memory id(s) were not present during rollback.`]
    : [];
  const reasons = [
    `Removed ${removedMemoryIds.length} generated memory seed(s) from the applied longitudinal commit.`,
    "Rollback did not restore a full snapshot; it only removed generated memories listed in the audit plan.",
  ];

  return {
    state: next,
    removedMemoryIds,
    missingMemoryIds,
    afterStateFingerprint: computeLongitudinalStateFingerprint(next),
    warnings,
    reasons,
  };
}

function cloneCharacterPhysicsState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(serializeCharacterPhysicsState(state));
}
