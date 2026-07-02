import { NextResponse } from "next/server";
import { computeCharacterExportPackageDigest } from "@/core/export/characterExportPackageDigest";
import { serializeCharacterPhysicsState } from "@/core/physics/serialization";
import { inspectCharacterStateIntegrity } from "@/core/state/stateIntegrity";
import { toGetParameterAdjustmentHistoryResponse } from "@/services/characterPhysicsDto";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export async function GET(_request: Request, context: CharacterRouteContext) {
  const { characterId } = await resolveCharacterRouteParams(context);
  const characterState = characterPhysicsService.getState(characterId);
  const state = serializeCharacterPhysicsState(characterState);
  const stateIntegrity = inspectCharacterStateIntegrity(characterState);
  const adjustmentHistory = toGetParameterAdjustmentHistoryResponse(characterId, characterPhysicsService);

  const exportPackage = {
    exportedAt: new Date().toISOString(),
    characterId,
    version: "1.1",
    state,
    stateIntegrity,
    adjustmentHistory: {
      history: adjustmentHistory.history,
      summary: adjustmentHistory.summary,
      governance: adjustmentHistory.governance
    }
  };

  return NextResponse.json({
    ...exportPackage,
    packageDigest: computeCharacterExportPackageDigest(exportPackage)
  });
}
