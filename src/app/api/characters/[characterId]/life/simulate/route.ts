import { NextResponse } from "next/server";
import type { RunLongitudinalSimulationRequest } from "@/appContracts/characterPhysics";
import {
  MAX_LONGITUDINAL_STEP_HOURS,
  MAX_LONGITUDINAL_TOTAL_HOURS,
} from "@/core/life/longitudinalSimulationLimits";
import { runLongitudinalSimulation } from "@/core/life/longitudinalSimulation";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function POST(request: Request, context: CharacterRouteContext) {
  const { characterId } = await resolveCharacterRouteParams(context);

  // V10.19: Unknown character returns 404 — do not auto-create.
  if (!characterPhysicsService.hasCharacter(characterId)) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  // Load state (character is known to exist)
  const state = characterPhysicsService.getState(characterId);

  // Parse body
  const bodyResult = await readJsonBody<RunLongitudinalSimulationRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  // Validate required fields
  if (typeof body.totalHours !== "number" || body.totalHours <= 0) {
    return NextResponse.json(
      { error: "totalHours must be a positive number", received: body.totalHours },
      { status: 422 }
    );
  }
  if (typeof body.totalHours === "number" && body.totalHours > MAX_LONGITUDINAL_TOTAL_HOURS) {
    return NextResponse.json(
      { error: `totalHours exceeds maximum allowed (${MAX_LONGITUDINAL_TOTAL_HOURS}h). Simulation is capped at 720 steps.`, received: body.totalHours },
      { status: 422 }
    );
  }
  if (typeof body.stepHours !== "number" || body.stepHours <= 0) {
    return NextResponse.json(
      { error: "stepHours must be a positive number", received: body.stepHours },
      { status: 422 }
    );
  }
  if (typeof body.stepHours === "number" && body.stepHours > MAX_LONGITUDINAL_STEP_HOURS) {
    return NextResponse.json(
      { error: `stepHours must not exceed ${MAX_LONGITUDINAL_STEP_HOURS} (one step = at most one day)`, received: body.stepHours },
      { status: 422 }
    );
  }

  const commitEnabled = body.commitPolicy?.enabled ?? false;

  // Auth gate: commit requires auth
  if (commitEnabled) {
    const blocked = requireAuth(request);
    if (blocked) return blocked;
  }

  // V10.18 commit note: the longitudinal simulation harness commits on
  // an internal working clone but does not yet expose the final committed
  // state for external persistence. Safe commit is deferred to a future
  // core enhancement.
  if (commitEnabled) {
    // Run simulation to observe what WOULD happen, but do not persist
    const seed = body.seed ?? `${characterId}:${body.totalHours}:${body.stepHours}`;
    const simReq: Parameters<typeof runLongitudinalSimulation>[1] = {
      characterId,
      totalHours: body.totalHours,
      stepHours: body.stepHours,
      seed,
      observed: body.observed ?? true,
      includeDecision: body.includeDecision ?? false,
      includeExplanation: body.includeExplanation ?? false,
    };
    if (body.commitPolicy) simReq.commitPolicy = body.commitPolicy;
    if (body.lifeOptions) simReq.lifeOptions = body.lifeOptions;
    const result = runLongitudinalSimulation(state, simReq);

    return NextResponse.json({
      characterId,
      result,
      warnings: [
        ...result.warnings,
        "V10.18: Commit is deferred. The simulation ran with internal commit tracking but the final committed state is not yet exposable for persistence. See docs for details.",
      ],
      reasons: result.reasons,
    });
  }

  // Dry-run path (default)
  const seed = body.seed ?? `${characterId}:${body.totalHours}:${body.stepHours}`;
  const simReq: Parameters<typeof runLongitudinalSimulation>[1] = {
    characterId,
    totalHours: body.totalHours,
    stepHours: body.stepHours,
    seed,
    observed: body.observed ?? true,
    includeDecision: body.includeDecision ?? false,
    includeExplanation: body.includeExplanation ?? false,
  };
  if (body.lifeOptions) simReq.lifeOptions = body.lifeOptions;
  const result = runLongitudinalSimulation(state, simReq);

  return NextResponse.json({
    characterId,
    result,
    warnings: result.warnings,
    reasons: [
      ...result.reasons,
      "Dry-run only — no state mutation, no persistence.",
    ],
  });
}
