import { NextResponse } from "next/server";
import type { ApplyParameterAdjustmentRequest } from "@/appContracts/characterPhysics";
import { toApplyParameterAdjustmentResponse } from "@/services/characterPhysicsDto";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function POST(request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  const bodyResult = await readJsonBody<ApplyParameterAdjustmentRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  if (!body.patch || !body.snapshot) {
    return NextResponse.json({ error: "patch and snapshot are required" }, { status: 400 });
  }
  const trace = characterPhysicsService.applyParameterAdjustment(
    characterId,
    body.patch,
    body.snapshot,
    body.governanceOverride
  );
  return NextResponse.json(toApplyParameterAdjustmentResponse(characterId, characterPhysicsService, trace));
}
