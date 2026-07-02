import { NextResponse } from "next/server";
import type { ApplyCharacterImportRequest, ApplyCharacterImportResponse } from "@/appContracts/characterPhysics";
import { serializeCharacterPhysicsState } from "@/core/physics/serialization";
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
  const bodyResult = await readJsonBody<ApplyCharacterImportRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const trace = characterPhysicsService.importCharacterPackage(characterId, body.package, body.confirmation);
  const response: ApplyCharacterImportResponse = {
    characterId,
    trace,
    state: serializeCharacterPhysicsState(characterPhysicsService.getState(characterId)),
    mutatesState: true
  };

  return NextResponse.json(response, { status: trace.status === "applied" ? 200 : 409 });
}
