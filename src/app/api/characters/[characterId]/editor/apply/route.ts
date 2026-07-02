/**
 * V9.4 Patch Apply API
 *
 * POST /api/characters/[characterId]/editor/apply
 *
 * Applies a validated patch to the real character state.
 * This is the FIRST mutation endpoint in the Character Editor.
 *
 * Auth required (x-api-key or CHARACTEROS_API_KEY).
 *
 * Options:
 *   dryRun=true        — run full pipeline but don't persist
 *   allowWarnings=true — allow warning-level changes (default)
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
  type CharacterEditPatch
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
    description?: string;
    changes: Array<{ path: string; from: unknown; to: unknown; reason: string }>;
    options?: { dryRun?: boolean; allowWarnings?: boolean };
  }>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.changes || !Array.isArray(body.changes) || body.changes.length === 0) {
    return NextResponse.json(
      { error: "Request body must contain a non-empty 'changes' array." },
      { status: 400 }
    );
  }

  const dryRun = body.options?.dryRun ?? false;
  const allowWarnings = body.options?.allowWarnings ?? true;

  const patch: CharacterEditPatch = {
    id: createPatchId(),
    appliedAt: new Date().toISOString(),
    description: body.description ?? "Applied patch",
    changes: body.changes.map((c) => ({ path: c.path, from: c.from, to: c.to, reason: c.reason })),
    metadata: { source: "manual", characterId }
  };

  const validation = validatePatchAgainstState(state, patch);
  const affectedDomains = getAffectedDomainsForPatch(patch);
  const riskSummary = summarizePatchRisk(validation);
  const clampedChanges = getClampedChangesForPatch(patch);
  const changedPaths = getChangedPathsFromPatch(patch);

  // Gate: error → no write
  if (!validation.valid || riskSummary.severity === "error") {
    return NextResponse.json(
      { valid: false, applied: false, errors: [validation.summary], validation, changedPaths, affectedDomains, riskSummary, clampedChanges },
      { status: 422 }
    );
  }

  // Gate: warning with allowWarnings=false → no write
  if (riskSummary.severity === "warning" && !allowWarnings) {
    return NextResponse.json(
      { valid: false, applied: false, errors: ["Warnings present and allowWarnings is false."], validation, changedPaths, affectedDomains, riskSummary, clampedChanges },
      { status: 422 }
    );
  }

  // Apply to clone
  const applyResult = applyValidatedPatch(state, patch);
  if (!applyResult.newState) {
    return NextResponse.json(
      { valid: false, applied: false, errors: applyResult.errors, validation, changedPaths, affectedDomains, riskSummary, clampedChanges },
      { status: 500 }
    );
  }

  const integrity = buildPostEditIntegrityReport(applyResult.newState);
  const integrityPolicy = evaluatePatchIntegrityPolicy(integrity);
  const projectedStateSummary = buildProjectedStateSummary(applyResult.newState, changedPaths);
  const beforeSummary = buildProjectedStateSummary(state, changedPaths);

  const warnings = [...riskSummary.messages.slice(0, riskSummary.warningCount)];
  const reasons = [dryRun
    ? `Dry run completed. ${applyResult.changesApplied} change(s) would be applied. No state was modified.`
    : `Applied ${applyResult.changesApplied} change(s) successfully.`];

  const audit = {
    id: createAuditEntryId(),
    patchId: patch.id,
    timestamp: new Date().toISOString(),
    description: patch.description,
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
    valid: true, applied: !dryRun, dryRun,
    patch: { id: patch.id, description: patch.description, changes: patch.changes.length },
    validation, integrity, integrityPolicy, changedPaths, affectedDomains, riskSummary, clampedChanges,
    projectedStateSummary, warnings, reasons,
    audit: { id: audit.id, recorded: !dryRun, timestamp: audit.timestamp },
    explanation: (() => {
      try {
        return explainPatchApply({
          patch,
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
