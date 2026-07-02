import { NextResponse } from "next/server";
import type { ValidateCharacterImportRequest, ValidateCharacterImportResponse } from "@/appContracts/characterPhysics";
import { buildCharacterImportPlan } from "@/core/export/characterImportPlan";
import {
  summarizeCharacterExportPackage,
  validateCharacterExportPackage
} from "@/core/export/characterExportValidation";
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
  const bodyResult = await readJsonBody<ValidateCharacterImportRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.body;
  const candidate = body.package;
  const validation = validateCharacterExportPackage(candidate);
  const plan = buildCharacterImportPlan({
    targetCharacterId: characterId,
    package: candidate
  });
  const importable = validation.valid && plan.status !== "blocked";
  const response: ValidateCharacterImportResponse = {
    characterId,
    valid: importable,
    errors: [...validation.errors, ...plan.errors],
    summary: summarizeCharacterExportPackage(candidate),
    plan,
    mutatesState: false
  };

  return NextResponse.json(response, { status: importable ? 200 : 422 });
}
