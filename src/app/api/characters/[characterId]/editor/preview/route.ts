/**
 * V9.3.2 Patch Preview API
 *
 * POST /api/characters/[characterId]/editor/preview
 *
 * Accepts a proposed CharacterEditPatch, validates it against the
 * current character state, and returns a rich preview — without
 * applying the patch to the real character.
 *
 * Auth required. Read-only on real state.
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
  previewPatch,
  validatePatchAgainstState,
  buildPostEditIntegrityReport,
  createPatchId,
  getAffectedDomainsForPatch,
  summarizePatchRisk,
  getClampedChangesForPatch,
  buildProjectedStateSummary,
  getChangedPathsFromPatch,
  type CharacterEditPatch
} from "@/core/editor/characterEditPatch";
import { explainPatchPreview } from "@/core/explainability/patchExplanation";

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

  const bodyResult = await readJsonBody<{ description?: string; changes: Array<{ path: string; from: unknown; to: unknown; reason: string }> }>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.changes || !Array.isArray(body.changes) || body.changes.length === 0) {
    return NextResponse.json(
      { error: "Request body must contain a non-empty 'changes' array." },
      { status: 400 }
    );
  }

  const patch: CharacterEditPatch = {
    id: createPatchId(),
    appliedAt: new Date().toISOString(),
    description: body.description ?? "Preview patch",
    changes: body.changes.map((c) => ({ path: c.path, from: c.from, to: c.to, reason: c.reason })),
    metadata: { source: "manual", characterId }
  };

  const validation = validatePatchAgainstState(state, patch);
  const affectedDomains = getAffectedDomainsForPatch(patch);
  const riskSummary = summarizePatchRisk(validation);
  const clampedChanges = getClampedChangesForPatch(patch);
  const changedPaths = getChangedPathsFromPatch(patch);

  if (!validation.valid) {
    return NextResponse.json(
      { valid: false, errors: [validation.summary], validation, changedPaths, affectedDomains, riskSummary, clampedChanges },
      { status: 422 }
    );
  }

  const preview = previewPatch(state, patch);
  const integrity = preview.projectedState
    ? buildPostEditIntegrityReport(preview.projectedState)
    : { valid: false, errorCount: 1, warningCount: 0 };
  const projectedStateSummary = preview.projectedState
    ? buildProjectedStateSummary(preview.projectedState, changedPaths)
    : null;

  return NextResponse.json({
    valid: true,
    patch: { id: patch.id, description: patch.description, changes: patch.changes.length },
    validation,
    integrity,
    changedPaths,
    affectedDomains,
    riskSummary,
    clampedChanges,
    projectedStateSummary,
    preview: preview.preview,
    explanation: (() => {
      try {
        return explainPatchPreview({
          patch,
          validation,
          affectedDomains,
          riskSummary,
          clampedChanges,
          integrity
        });
      } catch {
        return null;
      }
    })()
  });
}
