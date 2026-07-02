import { NextResponse } from "next/server";
import type { ContinuousTickRequest } from "@/appContracts/characterPhysics";
import { toContinuousTickResponse } from "@/services/characterPhysicsDto";
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
  const bodyResult = await readJsonBody<ContinuousTickRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const trace = characterPhysicsService.tickCharacter(characterId, body);
  return NextResponse.json(toContinuousTickResponse(characterId, characterPhysicsService, trace));
}
