import { NextResponse } from "next/server";
import type { SimulateEventsRequest } from "@/appContracts/characterPhysics";
import { toSimulateEventsResponse } from "@/services/characterPhysicsDto";
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
  const bodyResult = await readJsonBody<SimulateEventsRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;

  if (!body.events) {
    return NextResponse.json({ error: "Missing events" }, { status: 400 });
  }

  const options = body.daysPerStep === undefined ? {} : { daysPerStep: body.daysPerStep };
  const result = characterPhysicsService.simulateEvents(characterId, body.events, options);
  return NextResponse.json(toSimulateEventsResponse(characterId, result));
}
