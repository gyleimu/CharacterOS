/**
 * V9.1 Edit Patch Types & Validation Core.
 *
 * Pure type system + validators for character editing.
 * No API. No React. No mutation (except applyPatch which is intentional).
 *
 * Core flow: Draft → Validate → Preview → Apply → Audit
 */

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { clamp01 } from "../parameters/parameterMath";
import { inspectCharacterStateIntegrity } from "../state/stateIntegrity";

/** Maximum number of changes allowed in a single patch. */
export const MAX_CHANGES_PER_PATCH = 50;

// ─── Patch types ────────────────────────────────────────────────────────

export interface PatchChange {
  /** Dot-separated path (e.g. "coordinate.values.trust"). */
  path: string;
  /** Previous value (for audit trail). */
  from: unknown;
  /** New value to set. */
  to: unknown;
  /** Human-readable reason. */
  reason: string;
}

export interface CharacterEditPatch {
  /** Unique patch id. */
  id: string;
  /** ISO timestamp of application. */
  appliedAt: string;
  /** Human-readable description. */
  description: string;
  /** Field-level changes. */
  changes: PatchChange[];
  /** Source metadata. */
  metadata: PatchMetadata;
}

export interface PatchMetadata {
  source: "manual" | "import" | "blueprint" | "benchmark";
  characterId: string;
}

export interface PatchValidationResult {
  /** Whether the patch is valid. */
  valid: boolean;
  /** Per-change validation results. */
  changes: PatchChangeValidation[];
  /** Integrity report after simulating the patch. */
  integrity?: { valid: boolean; errorCount: number; warningCount: number };
  /** Human-readable summary. */
  summary: string;
}

export interface PatchChangeValidation {
  /** The change being validated. */
  change: PatchChange;
  /** Whether this individual change is valid. */
  valid: boolean;
  /** Severity if invalid. */
  severity: "error" | "warning" | "ok";
  /** Explanation. */
  message: string;
}

export interface PatchPreviewResult {
  /** Changes that would be applied. */
  patch: CharacterEditPatch;
  /** Validation before application. */
  validation: PatchValidationResult;
  /** State after applying the patch (shallow copy). */
  projectedState: CharacterPhysicsState | null;
  /** Human-readable preview explanation. */
  preview: string;
}

// ─── Valid editable paths ────────────────────────────────────────────────

const EDITABLE_PATHS = new Set([
  "coordinate.values.trust",
  "coordinate.values.fear",
  "coordinate.values.attachment",
  "coordinate.values.neuroticism",
  "coordinate.values.control",
  "boundary.stressLoad",
  "boundary.integrity",
  "boundary.cracks",
  "boundary.recoveryRate",
  "boundary.capacity",
  "boundary.resilience",
  "metaState.emotionalSensitivity",
  "metaState.resilience",
  "metaState.selfControl",
  "metaState.traumaAmplification",
  "metaState.memoryStrength",
  "metaState.forgettingSpeed",
  "metaState.attention",
  "metaState.curiosity",
  "rewardState.dopamineLevel",
  "rewardState.dopamineThreshold",
  "rewardState.rewardSensitivity",
  "rewardState.noveltyNeed",
  "rewardState.adaptationRate",
  "rewardState.craving",
  "homeostasisState.stabilitySetPoint",
  "homeostasisState.changeResistance",
  "homeostasisState.recoveryBias",
  "homeostasisState.moderationBias",
  "homeostasisState.scarRetention",
  "learningRate",
]);

function isAllowedPath(path: string): boolean {
  return EDITABLE_PATHS.has(path);
}

// ─── Validators ──────────────────────────────────────────────────────────

export function validatePatchChange(change: PatchChange): PatchChangeValidation {
  if (!change.reason || !change.reason.trim()) {
    return {
      change,
      valid: false,
      severity: "error",
      message: `Change to "${change.path}" must include a non-empty reason.`
    };
  }

  if (!isAllowedPath(change.path)) {
    return {
      change,
      valid: false,
      severity: "error",
      message: `Path "${change.path}" is not editable. Allowed paths are restricted to coordinate, boundary, meta, reward, homeostasis fields.`
    };
  }

  const value = change.to;
  if (typeof value !== "number") {
    return {
      change,
      valid: false,
      severity: "error",
      message: `Value for "${change.path}" must be a number, got ${typeof value}.`
    };
  }

  if (Number.isNaN(value)) {
    return {
      change,
      valid: false,
      severity: "error",
      message: `Value for "${change.path}" is NaN.`
    };
  }

  if (!isFinite(value)) {
    return {
      change,
      valid: false,
      severity: "error",
      message: `Value for "${change.path}" must be finite, got ${value}.`
    };
  }

  if (value < 0 || value > 1) {
    return {
      change,
      valid: true,
      severity: "warning",
      message: `Value ${value} for "${change.path}" is outside [0, 1] — will be clamped to ${clamp01(value)} on apply.`
    };
  }

  return {
    change,
    valid: true,
    severity: "ok",
    message: `Change to "${change.path}": ${change.from} → ${value} is valid.`
  };
}

export function validatePatch(patch: CharacterEditPatch): PatchValidationResult {
  if (!patch.changes.length) {
    return {
      valid: true,
      changes: [],
      summary: "Patch has no changes — nothing to validate."
    };
  }

  if (patch.changes.length > MAX_CHANGES_PER_PATCH) {
    return {
      valid: false,
      changes: [],
      summary: `Patch has ${patch.changes.length} changes, exceeding the limit of ${MAX_CHANGES_PER_PATCH}.`
    };
  }

  const changes = patch.changes.map(validatePatchChange);
  const allValid = changes.every((c) => c.valid);
  const errorCount = changes.filter((c) => c.severity === "error").length;
  const warningCount = changes.filter((c) => c.severity === "warning").length;

  // Detect duplicate paths
  const seenPaths = new Set<string>();
  const duplicates: string[] = [];
  for (const c of changes) {
    if (seenPaths.has(c.change.path)) {
      duplicates.push(c.change.path);
    }
    seenPaths.add(c.change.path);
  }
  if (duplicates.length > 0) {
    changes.push({
      change: { path: "", from: "", to: "", reason: "" },
      valid: false,
      severity: "error",
      message: `Duplicate path(s): ${duplicates.join(", ")}. Each path can only be changed once per patch.`
    });
  }

  return {
    valid: allValid && duplicates.length === 0,
    changes,
    summary: duplicates.length > 0
      ? `Duplicate path(s) detected: ${duplicates.join(", ")}.`
      : allValid
        ? `All ${changes.length} changes are valid${warningCount > 0 ? ` (${warningCount} warnings).` : "."}`
        : `${errorCount} error(s) must be fixed before applying.`
  };
}

/**
 * Validate a patch against a specific state.
 * Adds stale-write protection by checking PatchChange.from against the
 * current state value before preview/apply pipelines trust the change.
 */
export function validatePatchAgainstState(
  state: CharacterPhysicsState,
  patch: CharacterEditPatch
): PatchValidationResult {
  const validation = validatePatch(patch);
  const changes = [...validation.changes];

  for (const change of patch.changes) {
    const current = getStateValue(state, change.path);
    if (current.ok && !Object.is(current.value, change.from)) {
      changes.push({
        change,
        valid: false,
        severity: "error",
        message: `Stale patch for "${change.path}": expected current value ${String(change.from)}, actual value is ${String(current.value)}.`
      });
    }
  }

  const errorCount = changes.filter((c) => c.severity === "error").length;
  const warningCount = changes.filter((c) => c.severity === "warning").length;

  const result: PatchValidationResult = {
    valid: validation.valid && errorCount === 0,
    changes,
    summary: errorCount > 0
      ? `${errorCount} error(s) must be fixed before applying.`
      : `${patch.changes.length} change(s) match current state${warningCount > 0 ? ` (${warningCount} warnings).` : "."}`
  };
  if (validation.integrity) {
    result.integrity = validation.integrity;
  }
  return result;
}

// ─── Applier ─────────────────────────────────────────────────────────────

export function applyPatch(
  state: CharacterPhysicsState,
  patch: CharacterEditPatch
): { newState: CharacterPhysicsState; changesApplied: number; errors: string[] } {
  const errors: string[] = [];
  let changesApplied = 0;

  // Deep clone — manually preserve Map types (JSON loses them)
  const newState = cloneStateForEditing(state);

  for (const change of patch.changes) {
    const result = setStateValue(newState, change.path, change.to as number);
    if (result === true) {
      changesApplied++;
    } else {
      errors.push(result);
    }
  }

  return { newState, changesApplied, errors };
}

/**
 * Apply a validated patch to a state.
 * Runs validation first — rejects invalid patches before any mutation.
 * Does NOT mutate the original state (works on a deep clone).
 */
export function applyValidatedPatch(
  state: CharacterPhysicsState,
  patch: CharacterEditPatch
): { newState: CharacterPhysicsState | null; changesApplied: number; errors: string[]; validation: PatchValidationResult } {
  const validation = validatePatch(patch);
  if (!validation.valid) {
    return { newState: null, changesApplied: 0, errors: [validation.summary], validation };
  }

  const result = applyPatch(state, patch);
  return { ...result, validation };
}

/**
 * Build an integrity report for a post-edit state.
 * Pure function — does NOT mutate state.
 */
export function buildPostEditIntegrityReport(
  newState: CharacterPhysicsState
): { valid: boolean; errorCount: number; warningCount: number } {
  const report = inspectCharacterStateIntegrity(newState);
  return {
    valid: report.valid,
    errorCount: report.errorCount,
    warningCount: report.warningCount
  };
}

// ─── Preview ─────────────────────────────────────────────────────────────

export function previewPatch(
  state: CharacterPhysicsState,
  patch: CharacterEditPatch
): PatchPreviewResult {
  const validation = validatePatch(patch);
  if (!validation.valid) {
    return {
      patch,
      validation,
      projectedState: null,
      preview: "Patch validation failed. Cannot generate preview."
    };
  }

  const { newState, changesApplied, errors } = applyPatch(state, patch);

  return {
    patch,
    validation,
    projectedState: newState,
    preview: errors.length === 0
      ? `Patch would apply ${changesApplied} change(s) successfully.`
      : `${changesApplied} change(s) applied, ${errors.length} error(s): ${errors.join("; ")}`
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function cloneStateForEditing(state: CharacterPhysicsState): CharacterPhysicsState {
  const serialized = JSON.stringify(state);
  const parsed = JSON.parse(serialized);
  // Reconstruct Map objects from arrays
  if (parsed.clusters && !(parsed.clusters instanceof Map)) {
    const map = new Map<string, unknown>();
    if (Array.isArray(parsed.clusters)) {
      for (const entry of parsed.clusters as Array<[string, unknown]>) {
        if (Array.isArray(entry)) map.set(entry[0], entry[1]);
      }
    } else {
      for (const [key, value] of Object.entries(parsed.clusters as Record<string, unknown>)) {
        map.set(key, value);
      }
    }
    parsed.clusters = map;
  }
  return parsed as CharacterPhysicsState;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setStateValue(obj: any, path: string, value: number): true | string {
  const parts = path.split(".");
  let current: any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!current || !(key in current)) return `Path "${path}" not found at segment "${key}".`;
    current = current[key];
  }

  const lastKey = parts[parts.length - 1]!;
  if (!(lastKey in current)) return `Path "${path}" not found at final key "${lastKey}".`;

  const clamped = clamp01(value);
  current[lastKey] = clamped;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStateValue(obj: any, path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const parts = path.split(".");
  let current: any = obj;

  for (const key of parts) {
    if (!current || !(key in current)) {
      return { ok: false, error: `Path "${path}" not found at segment "${key}".` };
    }
    current = current[key];
  }

  return { ok: true, value: current };
}

export function createPatchId(): string {
  return `patch_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

// ─── V9.3.2 Domain / Risk / Clamp ───────────────────────────────────────

export type CharacterEditDomain =
  | "personality"
  | "boundary"
  | "meta_state"
  | "reward"
  | "homeostasis"
  | "unknown";

const DOMAIN_PREFIXES: [string, CharacterEditDomain][] = [
  ["coordinate.values.", "personality"],
  ["learningRate", "personality"],
  ["boundary.", "boundary"],
  ["metaState.", "meta_state"],
  ["rewardState.", "reward"],
  ["homeostasisState.", "homeostasis"],
];

/** Map a patch to the set of affected character domains, deduplicated and sorted. */
export function getAffectedDomainsForPatch(patch: CharacterEditPatch): CharacterEditDomain[] {
  const domains = new Set<CharacterEditDomain>();
  for (const change of patch.changes) {
    let found = false;
    for (const [prefix, domain] of DOMAIN_PREFIXES) {
      if (change.path.startsWith(prefix)) {
        domains.add(domain);
        found = true;
        break;
      }
    }
    if (!found) domains.add("unknown");
  }
  return [...domains].sort();
}

export interface PatchRiskSummary {
  severity: "ok" | "warning" | "error";
  errorCount: number;
  warningCount: number;
  okCount: number;
  messages: string[];
}

export function summarizePatchRisk(validation: PatchValidationResult): PatchRiskSummary {
  const errors = validation.changes.filter((c) => c.severity === "error");
  const warnings = validation.changes.filter((c) => c.severity === "warning");
  const oks = validation.changes.filter((c) => c.severity === "ok");
  const messages = validation.changes.map((c) => c.message);
  return {
    severity: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok",
    errorCount: errors.length,
    warningCount: warnings.length,
    okCount: oks.length,
    messages
  };
}

export interface PatchClampedChange {
  path: string;
  submittedValue: number;
  appliedValue: number;
  reason: string;
}

export function getClampedChangesForPatch(patch: CharacterEditPatch): PatchClampedChange[] {
  const results: PatchClampedChange[] = [];
  for (const change of patch.changes) {
    if (typeof change.to !== "number") continue;
    const v = change.to as number;
    if (v < 0) {
      results.push({ path: change.path, submittedValue: v, appliedValue: 0, reason: "below [0,1]" });
    } else if (v > 1) {
      results.push({ path: change.path, submittedValue: v, appliedValue: 1, reason: "above [0,1]" });
    }
  }
  return results;
}

/** Build a compact summary of the projected state for API responses. */
export function buildProjectedStateSummary(
  newState: CharacterPhysicsState,
  changedPaths: string[]
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const path of changedPaths) {
    const result = getStateValue(newState, path);
    if (result.ok && typeof result.value === "number") {
      summary[path] = result.value;
    }
  }
  return summary;
}

/** Collect changed paths from a patch. */
export function getChangedPathsFromPatch(patch: CharacterEditPatch): string[] {
  return patch.changes.map((c) => c.path);
}

// ─── V9.5 Audit & Integrity Policy ──────────────────────────────────────

export interface PatchIntegrityPolicyDecision {
  status: "pass" | "soft_warning" | "block";
  errorCount: number;
  warningCount: number;
  blockingReasons: string[];
  warnings: string[];
  reasons: string[];
}

export function evaluatePatchIntegrityPolicy(
  report: { valid: boolean; errorCount: number; warningCount: number }
): PatchIntegrityPolicyDecision {
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  if (report.errorCount > 0) {
    blockingReasons.push(`Integrity check found ${report.errorCount} error(s).`);
  }
  if (report.warningCount > 0) {
    warnings.push(`Integrity check found ${report.warningCount} warning(s).`);
  }

  const status = report.errorCount > 0 ? "block"
    : report.warningCount > 0 ? "soft_warning"
    : "pass";

  return {
    status,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    blockingReasons,
    warnings,
    reasons: status === "pass"
      ? ["Integrity check passed with no issues."]
      : status === "soft_warning"
        ? ["Integrity check passed with warnings — apply allowed."]
        : ["Integrity check failed — apply blocked."]
  };
}

export interface PatchAuditEntry {
  id: string;
  characterId: string;
  patchId: string;
  timestamp: string;
  description: string;
  changedPaths: string[];
  affectedDomains: CharacterEditDomain[];
  riskSummary: PatchRiskSummary;
  clampedChanges: PatchClampedChange[];
  beforeSummary: Record<string, unknown>;
  afterSummary: Record<string, unknown>;
  validationSummary: string;
  integrityPolicyDecision: PatchIntegrityPolicyDecision;
  applied: boolean;
  dryRun: boolean;
  warnings: string[];
  reasons: string[];
}

export function createAuditEntryId(): string {
  return `audit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

// ─── V9.7 Rollback ─────────────────────────────────────────────────────────

/**
 * Create a reverse patch from an audit entry.
 *
 * The rollback patch reverses each changed path: `from` = afterSummary value,
 * `to` = beforeSummary value. This patch then flows through the standard
 * validate → apply → audit pipeline, so rollback is simply a new, recorded
 * edit — not a time machine.
 *
 * @throws If any changed path is missing from beforeSummary or afterSummary.
 */
export function createRollbackPatchFromAuditEntry(
  entry: PatchAuditEntry
): CharacterEditPatch {
  const changes: PatchChange[] = [];
  const missing: string[] = [];

  for (const path of entry.changedPaths) {
    if (!(path in entry.beforeSummary) || !(path in entry.afterSummary)) {
      missing.push(path);
      continue;
    }
    changes.push({
      path,
      from: entry.afterSummary[path],
      to: entry.beforeSummary[path],
      reason: `Rollback audit entry ${entry.id}`
    });
  }

  if (missing.length > 0) {
    throw new Error(
      `Cannot create rollback patch: missing before/after summary for path(s): ${missing.join(", ")}. ` +
      `Audit entry ${entry.id} does not contain sufficient data for rollback.`
    );
  }

  if (changes.length === 0) {
    throw new Error(
      `Cannot create rollback patch: audit entry ${entry.id} has no changed paths.`
    );
  }

  return {
    id: createPatchId(),
    appliedAt: new Date().toISOString(),
    description: `Rollback ${entry.patchId}`,
    changes,
    metadata: { source: "manual", characterId: entry.characterId }
  };
}
