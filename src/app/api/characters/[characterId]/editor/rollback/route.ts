/**
 * V9.7 Minimal Patch Rollback API
 *
 * POST /api/characters/[characterId]/editor/rollback
 *
 * Rolls back a previously applied patch by creating a reverse patch
 * from its audit entry and applying it through the standard
 * validate → apply → audit pipeline.
 *
 * Rollback is NOT a time machine. It is a new, recorded edit
 * that reverses a prior edit. History preserves both.
 *
 * Auth required (x-api-key or CHARACTEROS_API_KEY).
 *
 * Options:
 *   dryRun=true — run full pipeline but don't persist
 */

import { NextResponse } from "next/server";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";
import {
  applyValidatedPatch,
  validatePatchAgainstState,
  buildPostEditIntegrityReport,
  createPatchId,
  getAffectedDomainsForPatch,
  summarizePatchRisk,
  getClampedChangesForPatch,
  buildProjectedStateSummary,
  getChangedPathsFromPatch,
  evaluatePatchIntegrityPolicy,
  createAuditEntryId,
  createRollbackPatchFromAuditEntry,
  type PatchAuditEntry
} from "@/core/editor/characterEditPatch";
import { explainPatchApply } from "@/core/explainability/patchExplanation";

export async function POST(
  request: Request,
  context: CharacterRouteContext
) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);

  const state = characterPhysicsService.getState(characterId);
  if (!state) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  const bodyResult = await readJsonBody<{
    auditEntryId: string;
    dryRun?: boolean;
  }>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.auditEntryId || typeof body.auditEntryId !== "string") {
    return NextResponse.json(
      { error: "Request body must contain a non-empty 'auditEntryId' string." },
      { status: 400 }
    );
  }

  const dryRun = body.dryRun ?? false;

  // Find the audit entry
  const history = characterPhysicsService.getPatchAuditHistory(characterId) as Record<string, unknown>[];
  const rawEntry = history.find((e) => e.id === body.auditEntryId);

  if (!rawEntry) {
    return NextResponse.json(
      { error: `Audit entry "${body.auditEntryId}" not found for character "${characterId}".` },
      { status: 404 }
    );
  }

  // Augment the raw entry with characterId so it satisfies PatchAuditEntry
  const entry: PatchAuditEntry = {
    ...rawEntry,
    characterId
  } as unknown as PatchAuditEntry;

  // Create reverse patch
  let rollbackPatch;
  try {
    rollbackPatch = createRollbackPatchFromAuditEntry(entry);
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot rollback: ${(err as Error).message}` },
      { status: 422 }
    );
  }

  // Validate against current state (stale-write protection)
  const validation = validatePatchAgainstState(state, rollbackPatch);
  const affectedDomains = getAffectedDomainsForPatch(rollbackPatch);
  const riskSummary = summarizePatchRisk(validation);
  const clampedChanges = getClampedChangesForPatch(rollbackPatch);
  const changedPaths = getChangedPathsFromPatch(rollbackPatch);

  // Gate: error → no write
  if (!validation.valid || riskSummary.severity === "error") {
    return NextResponse.json(
      {
        valid: false, rolledBack: false, dryRun,
        auditEntryId: body.auditEntryId,
        rollbackPatch: { id: rollbackPatch.id, description: rollbackPatch.description, changes: rollbackPatch.changes.length },
        validation, changedPaths, affectedDomains, riskSummary, clampedChanges
      },
      { status: 422 }
    );
  }

  // Apply to clone
  const applyResult = applyValidatedPatch(state, rollbackPatch);
  if (!applyResult.newState) {
    return NextResponse.json(
      {
        valid: false, rolledBack: false, dryRun,
        auditEntryId: body.auditEntryId,
        rollbackPatch: { id: rollbackPatch.id, description: rollbackPatch.description, changes: rollbackPatch.changes.length },
        errors: applyResult.errors, validation, changedPaths, affectedDomains, riskSummary, clampedChanges
      },
      { status: 500 }
    );
  }

  const integrity = buildPostEditIntegrityReport(applyResult.newState);
  const integrityPolicy = evaluatePatchIntegrityPolicy(integrity);
  const projectedStateSummary = buildProjectedStateSummary(applyResult.newState, changedPaths);
  const beforeSummary = buildProjectedStateSummary(state, changedPaths);

  const warnings = [
    ...riskSummary.messages.slice(0, riskSummary.warningCount),
    `This is a rollback of audit entry ${entry.id} (original patch ${entry.patchId}).`
  ];
  const reasons = [dryRun
    ? `Dry run completed. Rollback of audit entry ${entry.id} would reverse ${applyResult.changesApplied} change(s). No state was modified.`
    : `Rollback of audit entry ${entry.id} applied. ${applyResult.changesApplied} change(s) reversed.`];

  const audit = {
    id: createAuditEntryId(),
    patchId: rollbackPatch.id,
    timestamp: new Date().toISOString(),
    description: rollbackPatch.description,
    changedPaths,
    applied: !dryRun,
    dryRun,
    riskSummary,
    clampedChanges,
    beforeSummary,
    afterSummary: projectedStateSummary,
    validationSummary: validation.summary,
    integrityPolicy,
    warnings,
    reasons
  };

  if (!dryRun) {
    characterPhysicsService.recordPatchAudit(characterId, audit);
    characterPhysicsService.replaceState(characterId, applyResult.newState);
  }

  return NextResponse.json({
    valid: true, rolledBack: !dryRun, dryRun,
    auditEntryId: body.auditEntryId,
    rollbackPatch: { id: rollbackPatch.id, description: rollbackPatch.description, changes: rollbackPatch.changes.length },
    validation, integrity, integrityPolicy, changedPaths, affectedDomains, riskSummary, clampedChanges,
    projectedStateSummary, warnings, reasons,
    audit: { id: audit.id, recorded: !dryRun, timestamp: audit.timestamp },
    explanation: (() => {
      try {
        return explainPatchApply({
          patch: rollbackPatch,
          applied: !dryRun,
          validation,
          affectedDomains,
          riskSummary,
          clampedChanges,
          integrityPolicy
        });
      } catch {
        return null;
      }
    })()
  });
}
