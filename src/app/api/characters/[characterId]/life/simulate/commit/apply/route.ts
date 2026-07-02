import { NextResponse } from "next/server";
import type {
  ApplyLongitudinalCommitRequest,
  ApplyLongitudinalCommitResponse,
} from "@/appContracts/characterPhysics";
import {
  buildLongitudinalFinalStateForCommit,
  type LongitudinalDigest,
} from "@/core/life/finalStateForCommit";
import { runLongitudinalSimulation } from "@/core/life/longitudinalSimulation";
import {
  MAX_LONGITUDINAL_STEP_HOURS,
  MAX_LONGITUDINAL_TOTAL_HOURS,
} from "@/core/life/longitudinalSimulationLimits";
import type { LongitudinalCommitApplyResult } from "@/core/life/longitudinalCommitApply";
import type { LongitudinalCommitAuditEntry } from "@/core/life/longitudinalCommitAudit";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import { requireAuth } from "@/app/api/_shared/auth";
import {
  readJsonBody,
  resolveCharacterRouteParams,
  type CharacterRouteContext,
} from "@/app/api/_shared/routeUtils";
import {
  buildCommitSimulationRequest,
  extractFinalCommittedState,
} from "@/app/api/_shared/longitudinalCommitRouteUtils";

type RequiredDigest = LongitudinalDigest & { value: string };
type ValidApplyRequest =
  Omit<ApplyLongitudinalCommitRequest, "totalHours" | "stepHours" | "commitPolicy" | "requestDigest" | "baseStateFingerprint"> & {
    totalHours: number;
    stepHours: number;
    commitPolicy: NonNullable<ApplyLongitudinalCommitRequest["commitPolicy"]> & { enabled: true };
    requestDigest: RequiredDigest;
    baseStateFingerprint: RequiredDigest;
  };

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

  const bodyResult = await readJsonBody<ApplyLongitudinalCommitRequest>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsedBody = parseApplyRequest(bodyResult.body);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const baseState = characterPhysicsService.getState(characterId);
  const simulationRequest = buildCommitSimulationRequest(characterId, body);
  const result = runLongitudinalSimulation(baseState, simulationRequest);
  const finalState = extractFinalCommittedState(result, baseState);
  const appliedAt = new Date().toISOString();
  const handoff = buildLongitudinalFinalStateForCommit({
    characterId,
    request: simulationRequest,
    baseState,
    finalState,
    result,
    timestamp: appliedAt,
  });

  const digestError = validatePreviewDigests(body, handoff.requestDigest, handoff.baseStateFingerprint.value, handoff.simulationId);
  if (digestError) return digestError;

  const applyResult = characterPhysicsService.applyLongitudinalCommit(handoff, {
    ...(body.confirmation ? { confirmation: body.confirmation } : {}),
    ...(body.allowWarnings !== undefined ? { allowWarnings: body.allowWarnings } : {}),
    appliedAt,
  });

  return NextResponse.json(toResponse(characterId, applyResult), { status: statusForApplyResult(applyResult) });
}

function parseApplyRequest(body: Partial<ApplyLongitudinalCommitRequest>):
  | { ok: true; body: ValidApplyRequest }
  | { ok: false; response: NextResponse } {
  if (typeof body.totalHours !== "number" || body.totalHours <= 0) {
    return { ok: false, response: NextResponse.json(
      { error: "totalHours must be a positive number", received: body.totalHours },
      { status: 422 }
    ) };
  }
  if (body.totalHours > MAX_LONGITUDINAL_TOTAL_HOURS) {
    return { ok: false, response: NextResponse.json(
      {
        error: `totalHours exceeds maximum allowed (${MAX_LONGITUDINAL_TOTAL_HOURS}h). Simulation is capped at 720 steps.`,
        received: body.totalHours,
      },
      { status: 422 }
    ) };
  }
  if (typeof body.stepHours !== "number" || body.stepHours <= 0) {
    return { ok: false, response: NextResponse.json(
      { error: "stepHours must be a positive number", received: body.stepHours },
      { status: 422 }
    ) };
  }
  if (body.stepHours > MAX_LONGITUDINAL_STEP_HOURS) {
    return { ok: false, response: NextResponse.json(
      { error: `stepHours must not exceed ${MAX_LONGITUDINAL_STEP_HOURS} (one step = at most one day)`, received: body.stepHours },
      { status: 422 }
    ) };
  }
  if (body.commitPolicy?.enabled !== true) {
    return { ok: false, response: NextResponse.json(
      { error: "commitPolicy.enabled must be true for commit apply" },
      { status: 422 }
    ) };
  }
  if (!isDigest(body.requestDigest)) {
    return { ok: false, response: NextResponse.json(
      { error: "requestDigest from commit preview is required" },
      { status: 422 }
    ) };
  }
  if (!isDigest(body.baseStateFingerprint)) {
    return { ok: false, response: NextResponse.json(
      { error: "baseStateFingerprint from commit preview is required" },
      { status: 422 }
    ) };
  }

  const parsed: ValidApplyRequest = {
    totalHours: body.totalHours,
    stepHours: body.stepHours,
    commitPolicy: body.commitPolicy as ValidApplyRequest["commitPolicy"],
    requestDigest: body.requestDigest,
    baseStateFingerprint: body.baseStateFingerprint,
  };
  if (body.seed !== undefined) parsed.seed = body.seed;
  if (body.observed !== undefined) parsed.observed = body.observed;
  if (body.includeDecision !== undefined) parsed.includeDecision = body.includeDecision;
  if (body.includeExplanation !== undefined) parsed.includeExplanation = body.includeExplanation;
  if (body.lifeOptions !== undefined) parsed.lifeOptions = body.lifeOptions;
  if (body.confirmation !== undefined) parsed.confirmation = body.confirmation;
  if (body.allowWarnings !== undefined) parsed.allowWarnings = body.allowWarnings;
  if (body.simulationId !== undefined) parsed.simulationId = body.simulationId;
  return { ok: true, body: parsed };
}

function validatePreviewDigests(
  body: ValidApplyRequest,
  requestDigest: LongitudinalDigest,
  baseStateFingerprintValue: string,
  simulationId: string
): NextResponse | null {
  if (body.requestDigest.value !== requestDigest.value) {
    return NextResponse.json(
      { error: "requestDigest does not match recomputed simulation request" },
      { status: 422 }
    );
  }
  if (body.baseStateFingerprint.value !== baseStateFingerprintValue) {
    return NextResponse.json(
      { error: "baseStateFingerprint is stale; rerun commit preview before applying" },
      { status: 409 }
    );
  }
  if (body.simulationId !== undefined && body.simulationId !== simulationId) {
    return NextResponse.json(
      { error: "simulationId does not match recomputed simulation" },
      { status: 422 }
    );
  }
  return null;
}

function toResponse(characterId: string, result: LongitudinalCommitApplyResult): ApplyLongitudinalCommitResponse {
  const response: ApplyLongitudinalCommitResponse = {
    characterId,
    status: result.status,
    applied: result.applied,
    simulationId: result.simulationId,
    warnings: [
      ...result.warnings,
      "V10.26: Apply route uses server-recomputed finalStateForCommit; client finalState is never accepted.",
    ],
    reasons: [...result.reasons],
  };
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

function auditDto(entry: LongitudinalCommitAuditEntry): NonNullable<ApplyLongitudinalCommitResponse["audit"]> {
  const dto: NonNullable<ApplyLongitudinalCommitResponse["audit"]> = {
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

function statusForApplyResult(result: LongitudinalCommitApplyResult): number {
  if (result.status === "applied") return 200;
  if (result.status === "conflict") return 409;
  if (result.status === "not_found") return 404;
  return 422;
}

function isDigest(value: unknown): value is RequiredDigest {
  if (!value || typeof value !== "object") return false;
  const digest = value as Partial<LongitudinalDigest>;
  return (
    digest.algorithm === "sha256" &&
    digest.canonicalization === "characteros-longitudinal-json-v1" &&
    typeof digest.value === "string" &&
    digest.value.length > 0
  );
}
