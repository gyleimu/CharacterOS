/**
 * V9.5 Patch Audit History API
 *
 * GET /api/characters/[characterId]/editor/history
 *
 * Returns the audit log of all applied patches for a character.
 * Auth required (even for GET — this is edit history).
 */

import { NextResponse } from "next/server";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function GET(
  _request: Request,
  context: CharacterRouteContext
) {
  const blocked = requireAuth(_request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);

  const state = characterPhysicsService.getState(characterId);
  if (!state) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  const entries = characterPhysicsService.getPatchAuditHistory(characterId);
  return NextResponse.json({ characterId, entries, count: entries.length });
}
