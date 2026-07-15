import type { CharacterImportTransitionHistoryEntry } from "../../core/export/characterImportTransitionHistory";
import type { LongitudinalCommitAuditEntry } from "../../core/life/longitudinalCommitAudit";
import type { ParameterAdjustmentHistoryEntry } from "../../core/parameters/parameterAdjustmentHistory";
import {
  deserializeCharacterPhysicsState,
  type SerializedCharacterPhysicsState,
} from "../../core/physics/serialization";
import { inspectCharacterStateIntegrity } from "../../core/state/stateIntegrity";
import {
  validateCharacterImportTransitionHistoryPayload,
  validateCharacterPhysicsPayload,
  validateLongitudinalCommitAuditPayload,
  validateParameterAdjustmentHistoryPayload,
} from "./durablePayloadValidators";
import {
  buildDurableValidationResult,
  type DurableValidationIssue,
  type DurableValidationResult,
  type DurableValidationSeverity,
} from "./durableValidationTypes";

export function inspectCharacterPhysicsDomainIntegrity(value: unknown): DurableValidationResult {
  return inspectClonedPayload(value, validateCharacterPhysicsPayload, (clone, issues) => {
    const entries = sortedStoreEntries(clone);
    entries.forEach(([characterId, serialized], index) => {
      const path = `records[${index}].value`;
      const statePayload = serialized as SerializedCharacterPhysicsState;
      if (statePayload.identity?.id && statePayload.identity.id !== characterId) {
        addIssue(
          issues,
          "CHARACTER_IDENTITY_KEY_MISMATCH",
          `${path}.identity.id`,
          "ERROR",
          "Stored identity does not match its repository record key.",
        );
      }
      try {
        const state = deserializeCharacterPhysicsState(statePayload);
        const integrity = inspectCharacterStateIntegrity(state);
        integrity.issues.forEach((issue) => {
          const severity = issue.severity === "error" ? "ERROR" : "WARNING";
          const bucket = integrityPathBucket(issue.path);
          addIssue(
            issues,
            severity === "ERROR" ? "CHARACTER_STATE_INTEGRITY_ERROR" : "CHARACTER_STATE_INTEGRITY_WARNING",
            `${path}.integrity.${bucket}`,
            severity,
            severity === "ERROR"
              ? "Character state violates a domain integrity invariant."
              : "Character state has a non-blocking domain integrity warning.",
          );
        });
      } catch {
        addIssue(
          issues,
          "CHARACTER_STATE_DESERIALIZATION_FAILED",
          path,
          "CRITICAL",
          "Character state could not be deserialized for domain inspection.",
        );
      }
    });
  });
}

export function inspectParameterAdjustmentHistoryDomainIntegrity(value: unknown): DurableValidationResult {
  return inspectClonedPayload(value, validateParameterAdjustmentHistoryPayload, (clone, issues) => {
    const seenIds = new Set<string>();
    sortedStoreEntries(clone).forEach(([characterId, rawEntries], recordIndex) => {
      const entries = rawEntries as ParameterAdjustmentHistoryEntry[];
      let previousTime = Number.NEGATIVE_INFINITY;
      entries.forEach((entry, entryIndex) => {
        const path = `records[${recordIndex}].value[${entryIndex}]`;
        checkRecordIdentity(entry.characterId, characterId, `${path}.characterId`, "ADJUSTMENT", issues);
        checkUniqueId(entry.id, seenIds, `${path}.id`, "ADJUSTMENT", issues);
        const timestamp = checkTimestamp(entry.createdAt, `${path}.createdAt`, "ADJUSTMENT", issues);
        if (timestamp !== null && timestamp < previousTime) {
          addIssue(
            issues,
            "ADJUSTMENT_HISTORY_TIME_ORDER_WARNING",
            `${path}.createdAt`,
            "WARNING",
            "History entries are not in chronological order.",
          );
        }
        if (timestamp !== null) previousTime = timestamp;
        if (entry.operationCount !== entry.targetPaths.length) {
          addIssue(
            issues,
            "ADJUSTMENT_OPERATION_COUNT_MISMATCH",
            `${path}.operationCount`,
            "ERROR",
            "Operation count does not match the number of target paths.",
          );
        }
        if (new Set(entry.targetPaths).size !== entry.targetPaths.length) {
          addIssue(
            issues,
            "ADJUSTMENT_DUPLICATE_TARGET_WARNING",
            `${path}.targetPaths`,
            "WARNING",
            "Adjustment entry contains duplicate target paths.",
          );
        }
      });
    });
  });
}

export function inspectCharacterImportTransitionHistoryDomainIntegrity(value: unknown): DurableValidationResult {
  return inspectClonedPayload(value, validateCharacterImportTransitionHistoryPayload, (clone, issues) => {
    const seenIds = new Set<string>();
    sortedStoreEntries(clone).forEach(([characterId, rawEntries], recordIndex) => {
      const entries = rawEntries as CharacterImportTransitionHistoryEntry[];
      entries.forEach((entry, entryIndex) => {
        const path = `records[${recordIndex}].value[${entryIndex}]`;
        checkRecordIdentity(entry.characterId, characterId, `${path}.characterId`, "IMPORT", issues);
        checkUniqueId(entry.id, seenIds, `${path}.id`, "IMPORT", issues);
        checkTimestamp(entry.createdAt, `${path}.createdAt`, "IMPORT", issues);
        if (entry.status !== entry.trace.status) {
          addIssue(issues, "IMPORT_STATUS_MISMATCH", `${path}.status`, "ERROR", "History and trace statuses do not match.");
        }
        if (entry.confirmationRequired !== entry.trace.confirmationRequired) {
          addIssue(
            issues,
            "IMPORT_CONFIRMATION_MISMATCH",
            `${path}.confirmationRequired`,
            "ERROR",
            "History and trace confirmation requirements do not match.",
          );
        }
        if (entry.trace.targetCharacterId !== characterId) {
          addIssue(
            issues,
            "IMPORT_TARGET_KEY_MISMATCH",
            `${path}.trace.targetCharacterId`,
            "ERROR",
            "Import target does not match its repository record key.",
          );
        }
        if (entry.transitionId !== undefined && entry.trace.transitionId !== entry.transitionId) {
          addIssue(
            issues,
            "IMPORT_TRANSITION_ID_MISMATCH",
            `${path}.transitionId`,
            "ERROR",
            "History and trace transition identifiers do not match.",
          );
        }
        inspectImportTransactionSummary(entry, path, issues);
      });
    });
  });
}

export function inspectLongitudinalCommitAuditDomainIntegrity(value: unknown): DurableValidationResult {
  return inspectClonedPayload(value, validateLongitudinalCommitAuditPayload, (clone, issues) => {
    const seenIds = new Set<string>();
    const seenSimulations = new Set<string>();
    sortedStoreEntries(clone).forEach(([characterId, rawEntries], recordIndex) => {
      const entries = rawEntries as LongitudinalCommitAuditEntry[];
      entries.forEach((entry, entryIndex) => {
        const path = `records[${recordIndex}].value[${entryIndex}]`;
        checkRecordIdentity(entry.characterId, characterId, `${path}.characterId`, "LONGITUDINAL", issues);
        checkUniqueId(entry.id, seenIds, `${path}.id`, "LONGITUDINAL", issues);
        checkUniqueId(entry.simulationId, seenSimulations, `${path}.simulationId`, "LONGITUDINAL_SIMULATION", issues);
        const createdAt = checkTimestamp(entry.createdAt, `${path}.createdAt`, "LONGITUDINAL", issues);
        const updatedAt = checkTimestamp(entry.updatedAt, `${path}.updatedAt`, "LONGITUDINAL", issues);
        if (createdAt !== null && updatedAt !== null && updatedAt < createdAt) {
          addIssue(
            issues,
            "LONGITUDINAL_TIME_ORDER_INVALID",
            `${path}.updatedAt`,
            "ERROR",
            "Audit update time precedes its creation time.",
          );
        }
        inspectLongitudinalStatus(entry, path, issues);
        if (entry.rollbackPlan.simulationId !== entry.simulationId) {
          addIssue(
            issues,
            "LONGITUDINAL_ROLLBACK_SIMULATION_MISMATCH",
            `${path}.rollbackPlan.simulationId`,
            "ERROR",
            "Rollback plan references a different simulation.",
          );
        }
        if (
          entry.rollbackPlan.baseStateFingerprint.value !== entry.baseStateFingerprint.value
          || entry.rollbackPlan.finalStateFingerprint.value !== entry.finalStateFingerprint.value
        ) {
          addIssue(
            issues,
            "LONGITUDINAL_ROLLBACK_FINGERPRINT_MISMATCH",
            `${path}.rollbackPlan`,
            "ERROR",
            "Rollback plan fingerprints do not match the audit entry.",
          );
        }
        if (entry.status === "blocked" && entry.governanceStatus !== "block") {
          addIssue(
            issues,
            "LONGITUDINAL_GOVERNANCE_STATUS_MISMATCH",
            `${path}.governanceStatus`,
            "ERROR",
            "Blocked audit status requires blocked governance.",
          );
        }
      });
    });
  });
}

function inspectClonedPayload(
  value: unknown,
  validatePayload: (candidate: unknown) => DurableValidationResult,
  inspect: (clone: Record<string, unknown>, issues: DurableValidationIssue[]) => void,
): DurableValidationResult {
  const validation = validatePayload(value);
  if (!validation.valid) {
    return buildDurableValidationResult([{
      code: "DOMAIN_PAYLOAD_PRECONDITION_FAILED",
      path: "$",
      severity: "CRITICAL",
      message: "Domain inspection requires a structurally valid repository payload.",
    }]);
  }

  let clone: Record<string, unknown>;
  try {
    clone = structuredClone(value) as Record<string, unknown>;
  } catch {
    return buildDurableValidationResult([{
      code: "DOMAIN_PAYLOAD_CLONE_FAILED",
      path: "$",
      severity: "CRITICAL",
      message: "Repository payload could not be cloned for read-only inspection.",
    }]);
  }

  const issues: DurableValidationIssue[] = [];
  inspect(clone, issues);
  return buildDurableValidationResult(issues);
}

function inspectImportTransactionSummary(
  entry: CharacterImportTransitionHistoryEntry,
  path: string,
  issues: DurableValidationIssue[],
): void {
  const summary = entry.trace.transactionSummary;
  const steps = entry.trace.transactionSteps;
  const counts = {
    completed: steps.filter((step) => step.status === "completed").length,
    blocked: steps.filter((step) => step.status === "blocked").length,
    failed: steps.filter((step) => step.status === "failed").length,
  };
  if (
    summary.totalSteps !== steps.length
    || summary.completedSteps !== counts.completed
    || summary.blockedSteps !== counts.blocked
    || summary.failedSteps !== counts.failed
  ) {
    addIssue(
      issues,
      "IMPORT_TRANSACTION_COUNT_MISMATCH",
      `${path}.trace.transactionSummary`,
      "ERROR",
      "Transaction summary counts do not match transaction steps.",
    );
  }
  if (entry.status === "applied" && entry.trace.mutationOutcome && !entry.trace.mutationOutcome.fullyApplied) {
    addIssue(
      issues,
      "IMPORT_APPLIED_OUTCOME_MISMATCH",
      `${path}.trace.mutationOutcome`,
      "ERROR",
      "Applied import status conflicts with its mutation outcome.",
    );
  }
}

function inspectLongitudinalStatus(
  entry: LongitudinalCommitAuditEntry,
  path: string,
  issues: DurableValidationIssue[],
): void {
  if (entry.status === "applied" && !entry.appliedAt) {
    addIssue(issues, "LONGITUDINAL_APPLIED_AT_REQUIRED", `${path}.appliedAt`, "ERROR", "Applied audit entry requires an applied timestamp.");
  }
  if (entry.status === "rolled_back" && !entry.rolledBackAt) {
    addIssue(issues, "LONGITUDINAL_ROLLBACK_AT_REQUIRED", `${path}.rolledBackAt`, "ERROR", "Rolled-back audit entry requires a rollback timestamp.");
  }
  if (entry.appliedAt) checkTimestamp(entry.appliedAt, `${path}.appliedAt`, "LONGITUDINAL", issues);
  if (entry.rolledBackAt) checkTimestamp(entry.rolledBackAt, `${path}.rolledBackAt`, "LONGITUDINAL", issues);
}

function checkRecordIdentity(
  entryCharacterId: string,
  recordCharacterId: string,
  path: string,
  prefix: string,
  issues: DurableValidationIssue[],
): void {
  if (entryCharacterId !== recordCharacterId) {
    addIssue(issues, `${prefix}_CHARACTER_KEY_MISMATCH`, path, "ERROR", "Entry character does not match its repository record key.");
  }
}

function checkUniqueId(
  id: string,
  seen: Set<string>,
  path: string,
  prefix: string,
  issues: DurableValidationIssue[],
): void {
  if (seen.has(id)) {
    addIssue(issues, `${prefix}_DUPLICATE_ID`, path, "ERROR", "Repository contains a duplicate identifier.");
  }
  seen.add(id);
}

function checkTimestamp(
  value: string,
  path: string,
  prefix: string,
  issues: DurableValidationIssue[],
): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    addIssue(issues, `${prefix}_TIMESTAMP_INVALID`, path, "ERROR", "Timestamp is not a valid date-time value.");
    return null;
  }
  return timestamp;
}

function sortedStoreEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).sort(([left], [right]) => compareText(left, right));
}

function integrityPathBucket(path: string): string {
  if (path.startsWith("coordinate")) return "coordinate";
  if (path.startsWith("velocity")) return "velocity";
  if (path.startsWith("clusters")) return "clusters";
  if (path.startsWith("particles")) return "particles";
  if (path.startsWith("memories")) return "memories";
  if (path.startsWith("beliefStates")) return "beliefStates";
  if (path.startsWith("proceduralRoutines")) return "proceduralRoutines";
  if (path.startsWith("temporal")) return "temporal";
  if (path.startsWith("parameterSet")) return "parameterSet";
  if (path.startsWith("identity")) return "identity";
  return "state";
}

function addIssue(
  issues: DurableValidationIssue[],
  code: string,
  path: string,
  severity: DurableValidationSeverity,
  message: string,
): void {
  issues.push({ code, path, severity, message });
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
