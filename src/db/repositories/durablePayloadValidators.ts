import { BASE_PERSONALITY_KEYS } from "../../core/personality/dimensions";
import {
  buildDurableValidationResult,
  type DurableValidationIssue,
  type DurableValidationResult,
} from "./durableValidationTypes";

const BIG_FIVE_KEYS = [
  "openness",
  "conscientiousness",
  "extroversion",
  "agreeableness",
  "neuroticism",
] as const;

const IMPORT_STEP_NAMES = new Set([
  "authorization_checked",
  "before_state_integrity_inspected",
  "state_deserialized",
  "after_state_integrity_inspected",
  "pre_mutation_snapshot_captured",
  "state_replaced",
  "adjustment_history_replaced",
  "apply_failed",
  "history_recorded",
]);

export function validateCharacterPhysicsPayload(value: unknown): DurableValidationResult {
  const issues: DurableValidationIssue[] = [];
  validateStore(value, issues, (state, path) => validateSerializedCharacterState(state, path, issues));
  return buildDurableValidationResult(issues);
}

export function validateParameterAdjustmentHistoryPayload(value: unknown): DurableValidationResult {
  const issues: DurableValidationIssue[] = [];
  validateStore(value, issues, (entries, path) => {
    validateEntryArray(entries, path, issues, validateParameterAdjustmentEntry);
  });
  return buildDurableValidationResult(issues);
}

export function validateCharacterImportTransitionHistoryPayload(value: unknown): DurableValidationResult {
  const issues: DurableValidationIssue[] = [];
  validateStore(value, issues, (entries, path) => {
    validateEntryArray(entries, path, issues, validateImportTransitionEntry);
  });
  return buildDurableValidationResult(issues);
}

export function validateLongitudinalCommitAuditPayload(value: unknown): DurableValidationResult {
  const issues: DurableValidationIssue[] = [];
  validateStore(value, issues, (entries, path) => {
    validateEntryArray(entries, path, issues, validateLongitudinalCommitAuditEntry);
  });
  return buildDurableValidationResult(issues);
}

function validateStore(
  value: unknown,
  issues: DurableValidationIssue[],
  validateRecordValue: (recordValue: unknown, path: string) => void,
): void {
  if (!isRecord(value)) {
    addIssue(issues, "STORE_ROOT_OBJECT_REQUIRED", "$", "Repository payload must be an object.");
    return;
  }
  const entries = Object.entries(value).sort(([left], [right]) => compareText(left, right));
  entries.forEach(([key, recordValue], index) => {
    const path = `records[${index}]`;
    if (key.length === 0) {
      addIssue(issues, "STORE_KEY_REQUIRED", `${path}.key`, "Repository record key must be non-empty.");
    }
    validateRecordValue(recordValue, `${path}.value`);
  });
}

function validateSerializedCharacterState(
  value: unknown,
  path: string,
  issues: DurableValidationIssue[],
): void {
  if (!expectRecord(value, path, "CHARACTER_STATE_OBJECT_REQUIRED", issues)) return;

  validateOptionalIdentity(value.identity, `${path}.identity`, issues);
  validateCoordinate(value.coordinate, `${path}.coordinate`, issues);
  if (value.velocity !== undefined) validateCoordinate(value.velocity, `${path}.velocity`, issues);
  validateBigFive(value.personality, `${path}.personality`, issues);
  validateArray(value.clusters, `${path}.clusters`, "CHARACTER_CLUSTERS_ARRAY_REQUIRED", issues, validateCluster);
  validateArray(value.particles, `${path}.particles`, "CHARACTER_PARTICLES_ARRAY_REQUIRED", issues, validateParticle);
  validateArray(value.memories, `${path}.memories`, "CHARACTER_MEMORIES_ARRAY_REQUIRED", issues, validateMemory);
  if (value.beliefStates !== undefined) {
    validateArray(value.beliefStates, `${path}.beliefStates`, "CHARACTER_BELIEFS_ARRAY_REQUIRED", issues, validateBelief);
  }
  if (value.proceduralRoutines !== undefined) {
    validateArray(
      value.proceduralRoutines,
      `${path}.proceduralRoutines`,
      "CHARACTER_ROUTINES_ARRAY_REQUIRED",
      issues,
      validateProceduralRoutine,
    );
  }
  expectFiniteNumber(value.learningRate, `${path}.learningRate`, "CHARACTER_LEARNING_RATE_REQUIRED", issues);
  expectRecord(value.derived, `${path}.derived`, "CHARACTER_DERIVED_OBJECT_REQUIRED", issues);
  expectRecord(value.galaxy, `${path}.galaxy`, "CHARACTER_GALAXY_OBJECT_REQUIRED", issues);
  if (value.parameterSetVersion !== undefined) {
    expectNonEmptyString(
      value.parameterSetVersion,
      `${path}.parameterSetVersion`,
      "CHARACTER_PARAMETER_SET_VERSION_INVALID",
      issues,
    );
  }
  if (value.temporal !== undefined) validateTemporalState(value.temporal, `${path}.temporal`, issues);
  for (const optionalObject of ["metaState", "biologicalNature", "boundary", "rewardState", "homeostasisState", "boredomState"] as const) {
    if (value[optionalObject] !== undefined) {
      expectRecord(value[optionalObject], `${path}.${optionalObject}`, "CHARACTER_OPTIONAL_OBJECT_INVALID", issues);
    }
  }
}

function validateOptionalIdentity(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (value === undefined) return;
  if (!expectRecord(value, path, "CHARACTER_IDENTITY_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "CHARACTER_IDENTITY_ID_REQUIRED", issues);
  expectNonEmptyString(value.name, `${path}.name`, "CHARACTER_IDENTITY_NAME_REQUIRED", issues);
}

function validateCoordinate(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "COORDINATE_OBJECT_REQUIRED", issues)) return;
  if (!expectRecord(value.values, `${path}.values`, "COORDINATE_VALUES_REQUIRED", issues)) return;
  for (const key of BASE_PERSONALITY_KEYS) {
    expectFiniteNumber(value.values[key], `${path}.values.${key}`, "COORDINATE_DIMENSION_REQUIRED", issues);
  }
}

function validateBigFive(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "BIG_FIVE_OBJECT_REQUIRED", issues)) return;
  for (const key of BIG_FIVE_KEYS) {
    expectFiniteNumber(value[key], `${path}.${key}`, "BIG_FIVE_DIMENSION_REQUIRED", issues);
  }
}

function validateCluster(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "CLUSTER_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "CLUSTER_ID_REQUIRED", issues);
  expectNonEmptyString(value.category, `${path}.category`, "CLUSTER_CATEGORY_REQUIRED", issues);
  validateCoordinate(value.centerCoordinate, `${path}.centerCoordinate`, issues);
  validateBigFive(value.centerVector, `${path}.centerVector`, issues);
  for (const field of ["mass", "density", "stability", "age"] as const) {
    expectFiniteNumber(value[field], `${path}.${field}`, "CLUSTER_NUMBER_REQUIRED", issues);
  }
  expectStringArray(value.particleIds, `${path}.particleIds`, "CLUSTER_PARTICLE_IDS_REQUIRED", issues);
}

function validateParticle(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "PARTICLE_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "PARTICLE_ID_REQUIRED", issues);
  expectString(value.description, `${path}.description`, "PARTICLE_DESCRIPTION_REQUIRED", issues);
  expectFiniteNumber(value.impactScore, `${path}.impactScore`, "PARTICLE_IMPACT_SCORE_REQUIRED", issues);
  expectString(value.emotion, `${path}.emotion`, "PARTICLE_EMOTION_REQUIRED", issues);
  expectNonEmptyString(value.category, `${path}.category`, "PARTICLE_CATEGORY_REQUIRED", issues);
  if (!expectRecord(value.vector, `${path}.vector`, "PARTICLE_VECTOR_REQUIRED", issues)) return;
  validateCoordinate(value.vector.delta, `${path}.vector.delta`, issues);
  expectNonEmptyString(value.vector.category, `${path}.vector.category`, "PARTICLE_VECTOR_CATEGORY_REQUIRED", issues);
  expectString(value.vector.rationale, `${path}.vector.rationale`, "PARTICLE_VECTOR_RATIONALE_REQUIRED", issues);
}

function validateMemory(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "MEMORY_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "MEMORY_ID_REQUIRED", issues);
  expectString(value.content, `${path}.content`, "MEMORY_CONTENT_REQUIRED", issues);
  validateCoordinate(value.vector, `${path}.vector`, issues);
  for (const field of ["importance", "recency", "repetitionCount"] as const) {
    expectFiniteNumber(value[field], `${path}.${field}`, "MEMORY_NUMBER_REQUIRED", issues);
  }
  for (const field of ["emotion", "beliefEffect", "timeStamp"] as const) {
    expectString(value[field], `${path}.${field}`, "MEMORY_STRING_REQUIRED", issues);
  }
  if (value.clusterId !== undefined) {
    expectNonEmptyString(value.clusterId, `${path}.clusterId`, "MEMORY_CLUSTER_ID_INVALID", issues);
  }
}

function validateBelief(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "BELIEF_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "BELIEF_ID_REQUIRED", issues);
  expectString(value.content, `${path}.content`, "BELIEF_CONTENT_REQUIRED", issues);
  expectFiniteNumber(value.strength, `${path}.strength`, "BELIEF_STRENGTH_REQUIRED", issues);
  expectFiniteNumber(value.evidenceCount, `${path}.evidenceCount`, "BELIEF_EVIDENCE_COUNT_REQUIRED", issues);
  expectStringArray(value.sourceMemoryIds, `${path}.sourceMemoryIds`, "BELIEF_SOURCE_IDS_REQUIRED", issues);
}

function validateProceduralRoutine(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "ROUTINE_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "ROUTINE_ID_REQUIRED", issues);
  expectStringArray(value.cueTags, `${path}.cueTags`, "ROUTINE_CUE_TAGS_REQUIRED", issues);
  expectString(value.action, `${path}.action`, "ROUTINE_ACTION_REQUIRED", issues);
  expectFiniteNumber(value.strength, `${path}.strength`, "ROUTINE_STRENGTH_REQUIRED", issues);
  expectFiniteNumber(value.repetitionCount, `${path}.repetitionCount`, "ROUTINE_REPETITION_COUNT_REQUIRED", issues);
  if (value.lastTriggeredAt !== undefined) {
    expectFiniteNumber(value.lastTriggeredAt, `${path}.lastTriggeredAt`, "ROUTINE_LAST_TRIGGERED_AT_INVALID", issues);
  }
}

function validateTemporalState(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "TEMPORAL_STATE_OBJECT_REQUIRED", issues)) return;
  if (value.lastProcessedAt !== null) {
    expectString(value.lastProcessedAt, `${path}.lastProcessedAt`, "TEMPORAL_LAST_PROCESSED_AT_INVALID", issues);
  }
  for (const field of ["totalElapsedDays", "processedEventCount", "timedEventCount"] as const) {
    expectFiniteNumber(value[field], `${path}.${field}`, "TEMPORAL_NUMBER_REQUIRED", issues);
  }
  validateArray(value.recentEvents, `${path}.recentEvents`, "TEMPORAL_EVENTS_ARRAY_REQUIRED", issues, (event, eventPath, target) => {
    if (!expectRecord(event, eventPath, "TEMPORAL_EVENT_OBJECT_REQUIRED", target)) return;
    expectFiniteNumber(event.sequence, `${eventPath}.sequence`, "TEMPORAL_EVENT_SEQUENCE_REQUIRED", target);
    for (const field of ["eventId", "signature", "category", "occurredAt"] as const) {
      expectString(event[field], `${eventPath}.${field}`, "TEMPORAL_EVENT_STRING_REQUIRED", target);
    }
    for (const field of ["rawImpact", "effectiveImpact", "densityScale"] as const) {
      expectFiniteNumber(event[field], `${eventPath}.${field}`, "TEMPORAL_EVENT_NUMBER_REQUIRED", target);
    }
  });
}

function validateParameterAdjustmentEntry(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "ADJUSTMENT_ENTRY_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "ADJUSTMENT_ID_REQUIRED", issues);
  expectNonEmptyString(value.characterId, `${path}.characterId`, "ADJUSTMENT_CHARACTER_ID_REQUIRED", issues);
  expectEnum(value.action, ["apply", "rollback"], `${path}.action`, "ADJUSTMENT_ACTION_INVALID", issues);
  expectEnum(value.status, ["applied", "blocked"], `${path}.status`, "ADJUSTMENT_STATUS_INVALID", issues);
  expectString(value.snapshotId, `${path}.snapshotId`, "ADJUSTMENT_SNAPSHOT_ID_REQUIRED", issues);
  expectNonNegativeInteger(value.operationCount, `${path}.operationCount`, "ADJUSTMENT_OPERATION_COUNT_INVALID", issues);
  expectStringArray(value.targetPaths, `${path}.targetPaths`, "ADJUSTMENT_TARGET_PATHS_REQUIRED", issues);
  expectNonEmptyString(value.createdAt, `${path}.createdAt`, "ADJUSTMENT_CREATED_AT_REQUIRED", issues);
  expectStringArray(value.reasons, `${path}.reasons`, "ADJUSTMENT_REASONS_REQUIRED", issues);
  if (value.governanceOverride !== undefined) {
    if (expectRecord(value.governanceOverride, `${path}.governanceOverride`, "ADJUSTMENT_OVERRIDE_OBJECT_REQUIRED", issues)) {
      expectBoolean(value.governanceOverride.used, `${path}.governanceOverride.used`, "ADJUSTMENT_OVERRIDE_USED_REQUIRED", issues);
      if (value.governanceOverride.reason !== undefined) {
        expectString(value.governanceOverride.reason, `${path}.governanceOverride.reason`, "ADJUSTMENT_OVERRIDE_REASON_INVALID", issues);
      }
    }
  }
}

function validateImportTransitionEntry(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "IMPORT_ENTRY_OBJECT_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "IMPORT_ID_REQUIRED", issues);
  expectNonEmptyString(value.characterId, `${path}.characterId`, "IMPORT_CHARACTER_ID_REQUIRED", issues);
  expectNonEmptyString(value.createdAt, `${path}.createdAt`, "IMPORT_CREATED_AT_REQUIRED", issues);
  expectEnum(value.status, ["applied", "blocked"], `${path}.status`, "IMPORT_STATUS_INVALID", issues);
  for (const field of ["transitionId", "sourceCharacterId"] as const) {
    if (value[field] !== undefined) expectString(value[field], `${path}.${field}`, "IMPORT_OPTIONAL_ID_INVALID", issues);
  }
  expectNonEmptyString(value.confirmationRequired, `${path}.confirmationRequired`, "IMPORT_CONFIRMATION_REQUIRED", issues);
  validateImportTrace(value.trace, `${path}.trace`, issues);
}

function validateImportTrace(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "IMPORT_TRACE_OBJECT_REQUIRED", issues)) return;
  expectEnum(value.status, ["applied", "blocked"], `${path}.status`, "IMPORT_TRACE_STATUS_INVALID", issues);
  expectNonEmptyString(value.targetCharacterId, `${path}.targetCharacterId`, "IMPORT_TRACE_TARGET_ID_REQUIRED", issues);
  expectNonEmptyString(value.confirmationRequired, `${path}.confirmationRequired`, "IMPORT_TRACE_CONFIRMATION_REQUIRED", issues);
  expectRecord(value.plan, `${path}.plan`, "IMPORT_TRACE_PLAN_REQUIRED", issues);
  validateArray(value.transactionSteps, `${path}.transactionSteps`, "IMPORT_TRACE_STEPS_REQUIRED", issues, (step, stepPath, target) => {
    if (!expectRecord(step, stepPath, "IMPORT_STEP_OBJECT_REQUIRED", target)) return;
    if (typeof step.name !== "string" || !IMPORT_STEP_NAMES.has(step.name)) {
      addIssue(target, "IMPORT_STEP_NAME_INVALID", `${stepPath}.name`, "Import transaction step name is invalid.");
    }
    expectEnum(step.status, ["completed", "blocked", "failed"], `${stepPath}.status`, "IMPORT_STEP_STATUS_INVALID", target);
    expectString(step.message, `${stepPath}.message`, "IMPORT_STEP_MESSAGE_REQUIRED", target);
    if (step.details !== undefined) expectRecord(step.details, `${stepPath}.details`, "IMPORT_STEP_DETAILS_INVALID", target);
  });
  if (expectRecord(value.transactionSummary, `${path}.transactionSummary`, "IMPORT_TRACE_SUMMARY_REQUIRED", issues)) {
    expectEnum(
      value.transactionSummary.terminalStatus,
      ["completed", "blocked", "failed"],
      `${path}.transactionSummary.terminalStatus`,
      "IMPORT_SUMMARY_STATUS_INVALID",
      issues,
    );
    for (const field of ["totalSteps", "completedSteps", "blockedSteps", "failedSteps"] as const) {
      expectNonNegativeInteger(
        value.transactionSummary[field],
        `${path}.transactionSummary.${field}`,
        "IMPORT_SUMMARY_COUNT_INVALID",
        issues,
      );
    }
    for (const field of ["stateMutated", "adjustmentHistoryMutated", "historyRecorded"] as const) {
      expectBoolean(
        value.transactionSummary[field],
        `${path}.transactionSummary.${field}`,
        "IMPORT_SUMMARY_BOOLEAN_REQUIRED",
        issues,
      );
    }
    expectStringArray(value.transactionSummary.reasons, `${path}.transactionSummary.reasons`, "IMPORT_SUMMARY_REASONS_REQUIRED", issues);
  }
  expectStringArray(value.reasons, `${path}.reasons`, "IMPORT_TRACE_REASONS_REQUIRED", issues);
  expectStringArray(value.errors, `${path}.errors`, "IMPORT_TRACE_ERRORS_REQUIRED", issues);
  for (const field of ["sourceCharacterId", "historyEntryId", "historyRecordedAt", "transitionId", "appliedAt"] as const) {
    if (value[field] !== undefined) expectString(value[field], `${path}.${field}`, "IMPORT_TRACE_OPTIONAL_STRING_INVALID", issues);
  }
  if (value.mutationOutcome !== undefined) {
    if (expectRecord(value.mutationOutcome, `${path}.mutationOutcome`, "IMPORT_MUTATION_OUTCOME_INVALID", issues)) {
      for (const field of ["stateReplaced", "adjustmentHistoryReplaced", "historyRecorded", "fullyApplied"] as const) {
        expectBoolean(value.mutationOutcome[field], `${path}.mutationOutcome.${field}`, "IMPORT_MUTATION_BOOLEAN_REQUIRED", issues);
      }
      expectString(value.mutationOutcome.description, `${path}.mutationOutcome.description`, "IMPORT_MUTATION_DESCRIPTION_REQUIRED", issues);
    }
  }
}

function validateLongitudinalCommitAuditEntry(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "LONGITUDINAL_ENTRY_OBJECT_REQUIRED", issues)) return;
  expectEnum(value.version, ["v10.24"], `${path}.version`, "LONGITUDINAL_VERSION_INVALID", issues);
  for (const field of ["id", "characterId", "simulationId", "createdAt", "updatedAt"] as const) {
    expectNonEmptyString(value[field], `${path}.${field}`, "LONGITUDINAL_STRING_REQUIRED", issues);
  }
  expectEnum(
    value.status,
    ["previewed", "applied", "rolled_back", "blocked"],
    `${path}.status`,
    "LONGITUDINAL_STATUS_INVALID",
    issues,
  );
  for (const field of ["appliedAt", "rolledBackAt"] as const) {
    if (value[field] !== undefined) expectString(value[field], `${path}.${field}`, "LONGITUDINAL_TIMESTAMP_INVALID", issues);
  }
  validateDigest(value.requestDigest, `${path}.requestDigest`, issues);
  validateDigest(value.baseStateFingerprint, `${path}.baseStateFingerprint`, issues);
  validateDigest(value.finalStateFingerprint, `${path}.finalStateFingerprint`, issues);
  expectRecord(value.commitPolicy, `${path}.commitPolicy`, "LONGITUDINAL_POLICY_REQUIRED", issues);
  expectStringArray(value.changedPaths, `${path}.changedPaths`, "LONGITUDINAL_CHANGED_PATHS_REQUIRED", issues);
  expectStringArray(value.generatedMemoryIds, `${path}.generatedMemoryIds`, "LONGITUDINAL_MEMORY_IDS_REQUIRED", issues);
  expectRecord(value.beforeSummary, `${path}.beforeSummary`, "LONGITUDINAL_BEFORE_SUMMARY_REQUIRED", issues);
  expectRecord(value.afterSummary, `${path}.afterSummary`, "LONGITUDINAL_AFTER_SUMMARY_REQUIRED", issues);
  expectEnum(value.governanceStatus, ["pass", "warning", "block"], `${path}.governanceStatus`, "LONGITUDINAL_GOVERNANCE_INVALID", issues);
  for (const field of ["governanceBlockers", "governanceWarnings", "warnings", "reasons"] as const) {
    expectStringArray(value[field], `${path}.${field}`, "LONGITUDINAL_STRING_ARRAY_REQUIRED", issues);
  }
  validateRollbackPlan(value.rollbackPlan, `${path}.rollbackPlan`, issues);
}

function validateDigest(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "LONGITUDINAL_DIGEST_REQUIRED", issues)) return;
  expectEnum(value.algorithm, ["sha256"], `${path}.algorithm`, "LONGITUDINAL_DIGEST_ALGORITHM_INVALID", issues);
  expectNonEmptyString(value.canonicalization, `${path}.canonicalization`, "LONGITUDINAL_DIGEST_CANONICALIZATION_REQUIRED", issues);
  if (typeof value.value !== "string" || !/^[a-f0-9]{64}$/u.test(value.value)) {
    addIssue(issues, "LONGITUDINAL_DIGEST_VALUE_INVALID", `${path}.value`, "Digest value must be a lowercase SHA-256 hex string.");
  }
}

function validateRollbackPlan(value: unknown, path: string, issues: DurableValidationIssue[]): void {
  if (!expectRecord(value, path, "LONGITUDINAL_ROLLBACK_PLAN_REQUIRED", issues)) return;
  expectNonEmptyString(value.id, `${path}.id`, "LONGITUDINAL_ROLLBACK_ID_REQUIRED", issues);
  expectNonEmptyString(value.simulationId, `${path}.simulationId`, "LONGITUDINAL_ROLLBACK_SIMULATION_ID_REQUIRED", issues);
  expectEnum(value.type, ["remove_generated_memories"], `${path}.type`, "LONGITUDINAL_ROLLBACK_TYPE_INVALID", issues);
  expectStringArray(value.generatedMemoryIds, `${path}.generatedMemoryIds`, "LONGITUDINAL_ROLLBACK_MEMORY_IDS_REQUIRED", issues);
  validateDigest(value.baseStateFingerprint, `${path}.baseStateFingerprint`, issues);
  validateDigest(value.finalStateFingerprint, `${path}.finalStateFingerprint`, issues);
  expectEnum(value.staleWritePolicy, ["block_if_changed"], `${path}.staleWritePolicy`, "LONGITUDINAL_STALE_POLICY_INVALID", issues);
  expectStringArray(value.warnings, `${path}.warnings`, "LONGITUDINAL_ROLLBACK_WARNINGS_REQUIRED", issues);
  expectStringArray(value.reasons, `${path}.reasons`, "LONGITUDINAL_ROLLBACK_REASONS_REQUIRED", issues);
}

function validateEntryArray(
  value: unknown,
  path: string,
  issues: DurableValidationIssue[],
  validateEntry: (entry: unknown, entryPath: string, target: DurableValidationIssue[]) => void,
): void {
  validateArray(value, path, "HISTORY_ARRAY_REQUIRED", issues, validateEntry);
}

function validateArray(
  value: unknown,
  path: string,
  code: string,
  issues: DurableValidationIssue[],
  validateItem: (item: unknown, itemPath: string, target: DurableValidationIssue[]) => void,
): void {
  if (!Array.isArray(value)) {
    addIssue(issues, code, path, "Expected an array.");
    return;
  }
  value.forEach((item, index) => validateItem(item, `${path}[${index}]`, issues));
}

function expectRecord(
  value: unknown,
  path: string,
  code: string,
  issues: DurableValidationIssue[],
): value is Record<string, unknown> {
  if (isRecord(value)) return true;
  addIssue(issues, code, path, "Expected an object.");
  return false;
}

function expectString(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (typeof value !== "string") addIssue(issues, code, path, "Expected a string.");
}

function expectNonEmptyString(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (typeof value !== "string" || value.length === 0) {
    addIssue(issues, code, path, "Expected a non-empty string.");
  }
}

function expectFiniteNumber(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, code, path, "Expected a finite number.");
  }
}

function expectNonNegativeInteger(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    addIssue(issues, code, path, "Expected a non-negative integer.");
  }
}

function expectBoolean(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (typeof value !== "boolean") addIssue(issues, code, path, "Expected a boolean.");
}

function expectEnum(
  value: unknown,
  allowed: readonly string[],
  path: string,
  code: string,
  issues: DurableValidationIssue[],
): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    addIssue(issues, code, path, "Value is not part of the supported enum.");
  }
}

function expectStringArray(value: unknown, path: string, code: string, issues: DurableValidationIssue[]): void {
  if (!Array.isArray(value)) {
    addIssue(issues, code, path, "Expected an array of strings.");
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") addIssue(issues, code, `${path}[${index}]`, "Expected a string.");
  });
}

function addIssue(
  issues: DurableValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, severity: "ERROR", message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
