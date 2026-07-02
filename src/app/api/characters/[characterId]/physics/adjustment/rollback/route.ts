import { NextResponse } from "next/server";
import type { RollbackParameterAdjustmentRequest } from "@/appContracts/characterPhysics";
import { toRollbackParameterAdjustmentResponse } from "@/services/characterPhysicsDto";
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
  const bodyResult = await readJsonBody<RollbackParameterAdjustmentRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  if (!body.snapshot) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }
  const trace = characterPhysicsService.rollbackParameterAdjustment(characterId, body.snapshot);
  return NextResponse.json(toRollbackParameterAdjustmentResponse(characterId, characterPhysicsService, trace));
}
