import { NextResponse } from "next/server";
import type { PreviewLongitudinalCommitRequest, PreviewLongitudinalCommitResponse } from "@/appContracts/characterPhysics";
import {
  buildLongitudinalFinalStateForCommit,
  stripFinalStateForPublicPreview,
} from "@/core/life/finalStateForCommit";
import { runLongitudinalSimulation } from "@/core/life/longitudinalSimulation";
import {
  MAX_LONGITUDINAL_STEP_HOURS,
  MAX_LONGITUDINAL_TOTAL_HOURS,
} from "@/core/life/longitudinalSimulationLimits";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext,
} from "@/app/api/_shared/routeUtils";
import {
  buildCommitSimulationRequest,
  extractFinalCommittedState,
} from "@/app/api/_shared/longitudinalCommitRouteUtils";

const PREVIEW_TIMESTAMP = "2026-06-28T00:00:00.000Z";

type ValidPreviewRequest =
  Omit<PreviewLongitudinalCommitRequest, "totalHours" | "stepHours" | "commitPolicy"> & {
    totalHours: number;
    stepHours: number;
    commitPolicy: NonNullable<PreviewLongitudinalCommitRequest["commitPolicy"]> & { enabled: true };
  };

export async function POST(request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  if (!characterPhysicsService.hasCharacter(characterId)) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  const bodyResult = await readJsonBody<PreviewLongitudinalCommitRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  const parsedBody = parsePreviewRequest(body);
  if (!parsedBody.ok) return parsedBody.response;

  const baseState = characterPhysicsService.getState(characterId);
  const simulationRequest = buildCommitSimulationRequest(characterId, parsedBody.body);
  const result = runLongitudinalSimulation(baseState, simulationRequest);
  const finalState = extractFinalCommittedState(result, baseState);
  const handoff = buildLongitudinalFinalStateForCommit({
    characterId,
    request: simulationRequest,
    baseState,
    finalState,
    result,
    timestamp: PREVIEW_TIMESTAMP,
  });
  const preview = stripFinalStateForPublicPreview(handoff);

  const response: PreviewLongitudinalCommitResponse = {
    characterId,
    preview,
    warnings: [
      ...preview.warnings,
      "V10.22: Commit preview only - no state mutation, no persistence.",
    ],
    reasons: [
      ...preview.reasons,
      "Preview was built from a private finalStateForCommit handoff and stripped before response.",
    ],
  };
  return NextResponse.json(response);
}

function parsePreviewRequest(body: Partial<PreviewLongitudinalCommitRequest>):
  | { ok: true; body: ValidPreviewRequest }
  | { ok: false; response: NextResponse } {
  if (typeof body.totalHours !== "number" || body.totalHours <= 0) {
    return { ok: false, response: NextResponse.json(
      { error: "totalHours must be a positive number", received: body.totalHours },
      { status: 422 }
    ) };
  }
  if (body.totalHours > MAX_LONGITUDINAL_TOTAL_HOURS) {
    return { ok: false, response: NextResponse.json(
      {
        error: `totalHours exceeds maximum allowed (${MAX_LONGITUDINAL_TOTAL_HOURS}h). Simulation is capped at 720 steps.`,
        received: body.totalHours,
      },
      { status: 422 }
    ) };
  }
  if (typeof body.stepHours !== "number" || body.stepHours <= 0) {
    return { ok: false, response: NextResponse.json(
      { error: "stepHours must be a positive number", received: body.stepHours },
      { status: 422 }
    ) };
  }
  if (body.stepHours > MAX_LONGITUDINAL_STEP_HOURS) {
    return { ok: false, response: NextResponse.json(
      { error: `stepHours must not exceed ${MAX_LONGITUDINAL_STEP_HOURS} (one step = at most one day)`, received: body.stepHours },
      { status: 422 }
    ) };
  }
  if (body.commitPolicy?.enabled !== true) {
    return { ok: false, response: NextResponse.json(
      { error: "commitPolicy.enabled must be true for commit preview" },
      { status: 422 }
    ) };
  }

  const parsed: ValidPreviewRequest = {
    totalHours: body.totalHours,
    stepHours: body.stepHours,
    commitPolicy: body.commitPolicy as ValidPreviewRequest["commitPolicy"],
  };
  if (body.seed !== undefined) parsed.seed = body.seed;
  if (body.observed !== undefined) parsed.observed = body.observed;
  if (body.includeDecision !== undefined) parsed.includeDecision = body.includeDecision;
  if (body.includeExplanation !== undefined) parsed.includeExplanation = body.includeExplanation;
  if (body.lifeOptions !== undefined) parsed.lifeOptions = body.lifeOptions;

  return { ok: true, body: parsed };
}
