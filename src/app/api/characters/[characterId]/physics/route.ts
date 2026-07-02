import { NextResponse } from "next/server";
import type { ProcessEventRequest } from "@/appContracts/characterPhysics";
import {
  toGetStateResponse,
  toProcessEventResponse
} from "@/services/characterPhysicsDto";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function GET(_request: Request, context: CharacterRouteContext) {
  const { characterId } = await resolveCharacterRouteParams(context);
  return NextResponse.json(toGetStateResponse(characterId, characterPhysicsService));
}

export async function POST(request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  const bodyResult = await readJsonBody<ProcessEventRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.event) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  const result = characterPhysicsService.processEvent(characterId, body.event);
  return NextResponse.json(
    toProcessEventResponse(characterId, characterPhysicsService, result)
  );
}

export async function DELETE(request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  const seedInitialExperiences = new URL(request.url).searchParams.get("seedInitialExperiences") === "true";
  characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences });
  return NextResponse.json(toGetStateResponse(characterId, characterPhysicsService));
}
