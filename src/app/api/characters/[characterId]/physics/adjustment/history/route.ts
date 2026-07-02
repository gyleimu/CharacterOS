import { NextResponse } from "next/server";
import { toGetParameterAdjustmentHistoryResponse } from "@/services/characterPhysicsDto";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function GET(_request: Request, context: CharacterRouteContext) {
  const { characterId } = await resolveCharacterRouteParams(context);
  return NextResponse.json(toGetParameterAdjustmentHistoryResponse(characterId, characterPhysicsService));
}
