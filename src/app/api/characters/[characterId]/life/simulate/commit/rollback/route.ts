import { NextResponse } from "next/server";
import type {
  RollbackLongitudinalCommitRequest,
  RollbackLongitudinalCommitResponse,
} from "@/appContracts/characterPhysics";
import type { LongitudinalCommitRollbackResult } from "@/core/life/longitudinalCommitRollback";
import type { LongitudinalCommitAuditEntry } from "@/core/life/longitudinalCommitAudit";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext,
} from "@/app/api/_shared/routeUtils";

type ValidRollbackRequest = RollbackLongitudinalCommitRequest & (
  | { simulationId: string }
  | { auditId: string }
);

export async function POST(request: Request, context: CharacterRouteContext) {
  const blocked = requireAuth(request);
  if (blocked) return blocked;

  const { characterId } = await resolveCharacterRouteParams(context);
  if (!characterPhysicsService.hasCharacter(characterId)) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  const bodyResult = await readJsonBody<RollbackLongitudinalCommitRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsedBody = parseRollbackRequest(bodyResult.body);
  if (!parsedBody.ok) return parsedBody.response;

  const body = parsedBody.body;
  const result = characterPhysicsService.rollbackLongitudinalCommit(
    characterId,
    {
      ...(body.auditId ? { auditId: body.auditId } : {}),
      ...(body.simulationId ? { simulationId: body.simulationId } : {}),
    },
    {
      ...(body.confirmation ? { confirmation: body.confirmation } : {}),
    }
  );

  return NextResponse.json(toResponse(characterId, result), { status: statusForRollbackResult(result) });
}

function parseRollbackRequest(body: Partial<RollbackLongitudinalCommitRequest>):
  | { ok: true; body: ValidRollbackRequest }
  | { ok: false; response: NextResponse } {
  const simulationId = typeof body.simulationId === "string" ? body.simulationId.trim() : "";
  const auditId = typeof body.auditId === "string" ? body.auditId.trim() : "";
  if (!simulationId && !auditId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "simulationId or auditId is required for longitudinal commit rollback" },
        { status: 422 }
      ),
    };
  }

  const parsed: RollbackLongitudinalCommitRequest = {};
  if (simulationId) parsed.simulationId = simulationId;
  if (auditId) parsed.auditId = auditId;
  if (body.confirmation !== undefined) parsed.confirmation = body.confirmation;
  return { ok: true, body: parsed as ValidRollbackRequest };
}

function toResponse(
  characterId: string,
  result: LongitudinalCommitRollbackResult
): RollbackLongitudinalCommitResponse {
  const response: RollbackLongitudinalCommitResponse = {
    characterId,
    status: result.status,
    rolledBack: result.rolledBack,
    removedMemoryCount: result.mutation?.removedMemoryIds.length ?? 0,
    missingMemoryCount: result.mutation?.missingMemoryIds.length ?? 0,
    warnings: [
      ...result.warnings,
      "V10.27: Rollback removes generated memory seeds only; no full snapshot restore is exposed.",
    ],
    reasons: [...result.reasons],
  };
  if (result.simulationId) response.simulationId = result.simulationId;
  if (result.audit) {
    response.audit = auditDto(result.audit);
    response.rollback = {
      id: result.audit.rollbackPlan.id,
      type: result.audit.rollbackPlan.type,
      generatedMemoryCount: result.audit.rollbackPlan.generatedMemoryIds.length,
      staleWritePolicy: result.audit.rollbackPlan.staleWritePolicy,
    };
  }
  if (result.readiness) {
    response.readiness = {
      status: result.readiness.status,
      blockers: [...result.readiness.blockers],
      warnings: [...result.readiness.warnings],
      reasons: [...result.readiness.reasons],
    };
  }
  return response;
}

function auditDto(entry: LongitudinalCommitAuditEntry): NonNullable<RollbackLongitudinalCommitResponse["audit"]> {
  const dto: NonNullable<RollbackLongitudinalCommitResponse["audit"]> = {
    id: entry.id,
    status: entry.status,
    simulationId: entry.simulationId,
    changedPathCount: entry.changedPaths.length,
    generatedMemoryCount: entry.generatedMemoryIds.length,
    governanceStatus: entry.governanceStatus,
    updatedAt: entry.updatedAt,
  };
  if (entry.appliedAt) dto.appliedAt = entry.appliedAt;
  return dto;
}

function statusForRollbackResult(result: LongitudinalCommitRollbackResult): number {
  if (result.status === "rolled_back") return 200;
  if (result.status === "conflict") return 409;
  if (result.status === "not_found") return 404;
  return 422;
}
