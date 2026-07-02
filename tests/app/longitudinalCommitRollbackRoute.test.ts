import { describe, expect, it } from "vitest";
import { POST as APPLY } from "../../src/app/api/characters/[characterId]/life/simulate/commit/apply/route";
import { POST as PREVIEW } from "../../src/app/api/characters/[characterId]/life/simulate/commit/preview/route";
import { POST as ROLLBACK } from "../../src/app/api/characters/[characterId]/life/simulate/commit/rollback/route";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import { LONGITUDINAL_ROLLBACK_CONFIRMATION } from "../../src/core/life/longitudinalCommitRollback";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `commit-rollback-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeRequest(
  path: string,
  body: unknown,
  characterId: string,
  headers: Record<string, string> = {}
): [Request, { params: { characterId: string } }] {
  return [
    new Request(`http://localhost/api/characters/${characterId}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: { characterId } },
  ];
}

async function preview(body: unknown, characterId: string, headers?: Record<string, string>) {
  const [req, ctx] = makeRequest("/life/simulate/commit/preview", body, characterId, headers);
  return PREVIEW(req, ctx);
}

async function apply(body: unknown, characterId: string, headers?: Record<string, string>) {
  const [req, ctx] = makeRequest("/life/simulate/commit/apply", body, characterId, headers);
  return APPLY(req, ctx);
}

async function rollback(body: unknown, characterId: string, headers?: Record<string, string>) {
  const [req, ctx] = makeRequest("/life/simulate/commit/rollback", body, characterId, headers);
  return ROLLBACK(req, ctx);
}

const simulationBody = {
  totalHours: 12,
  stepHours: 4,
  seed: "route-rollback-seed",
  commitPolicy: {
    enabled: true,
    commitDreams: true,
    commitRandomThoughts: true,
    commitInspirationSeeds: true,
  },
};

async function applyFromPreview(characterId: string, headers?: Record<string, string>) {
  const previewRes = await preview(simulationBody, characterId, headers);
  expect(previewRes.status).toBe(200);
  const previewBody = await previewRes.json() as Record<string, unknown>;
  const p = previewBody.preview as Record<string, unknown>;
  const applyRes = await apply({
    ...simulationBody,
    simulationId: p.simulationId,
    requestDigest: p.requestDigest,
    baseStateFingerprint: p.baseStateFingerprint,
    confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
  }, characterId, headers);
  expect(applyRes.status).toBe(200);
  const applyBody = await applyRes.json() as Record<string, unknown>;
  const audit = applyBody.audit as Record<string, unknown>;
  return {
    simulationId: p.simulationId as string,
    auditId: audit.id as string,
    applyBody,
  };
}

describe("POST /api/characters/[characterId]/life/simulate/commit/rollback", () => {
  it("rolls back a previously applied commit without exposing private state", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const beforeCount = characterPhysicsService.getState(characterId).memories.length;
    const fields = await applyFromPreview(characterId);
    expect(characterPhysicsService.getState(characterId).memories.length).toBeGreaterThan(beforeCount);

    const res = await rollback({
      simulationId: fields.simulationId,
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("rolled_back");
    expect(body.rolledBack).toBe(true);
    expect(body.removedMemoryCount).toBeGreaterThan(0);

    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain("\"finalState\"");
    expect(bodyText).not.toContain("\"result\"");
    expect(bodyText).not.toContain("\"commitResult\"");
    expect(bodyText).not.toContain("\"clusters\"");

    expect(characterPhysicsService.getState(characterId).memories.length).toBe(beforeCount);
    expect(characterPhysicsService.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("rolled_back");
  });

  it("can roll back by auditId", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const fields = await applyFromPreview(characterId);

    const res = await rollback({
      auditId: fields.auditId,
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("rolled_back");
  });

  it("requires simulationId or auditId", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId);

    const res = await rollback({
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(422);
  });

  it("returns 422 when confirmation is missing", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const fields = await applyFromPreview(characterId);

    const res = await rollback({ simulationId: fields.simulationId }, characterId);

    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("blocked");
    expect(JSON.stringify(body.readiness)).toContain("confirmation");
    expect(characterPhysicsService.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("applied");
  });

  it("returns 409 when state changed after commit apply", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const fields = await applyFromPreview(characterId);
    const changed = characterPhysicsService.getState(characterId);
    changed.coordinate.values.trust = 0.99;
    characterPhysicsService.replaceState(characterId, changed);

    const res = await rollback({
      simulationId: fields.simulationId,
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("conflict");
    expect(characterPhysicsService.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("applied");
  });

  it("returns 404 for unknown character", async () => {
    const characterId = `missing-${uniqueId()}`;

    const res = await rollback({
      simulationId: "missing-simulation",
      confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(404);
  });

  it("requires auth when CHARACTEROS_API_KEY is configured", async () => {
    const previous = process.env.CHARACTEROS_API_KEY;
    process.env.CHARACTEROS_API_KEY = "rollback-secret";
    try {
      const characterId = uniqueId();
      characterPhysicsService.resetCharacter(characterId);
      const res = await rollback({ simulationId: "sim" }, characterId);
      expect(res.status).toBe(401);
    } finally {
      if (previous === undefined) {
        delete process.env.CHARACTEROS_API_KEY;
      } else {
        process.env.CHARACTEROS_API_KEY = previous;
      }
    }
  });

  it("accepts the configured auth header", async () => {
    const previous = process.env.CHARACTEROS_API_KEY;
    process.env.CHARACTEROS_API_KEY = "rollback-secret";
    try {
      const characterId = uniqueId();
      characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
      const fields = await applyFromPreview(characterId, { "x-api-key": "rollback-secret" });

      const res = await rollback({
        simulationId: fields.simulationId,
        confirmation: LONGITUDINAL_ROLLBACK_CONFIRMATION,
      }, characterId, { "x-api-key": "rollback-secret" });

      expect(res.status).toBe(200);
    } finally {
      if (previous === undefined) {
        delete process.env.CHARACTEROS_API_KEY;
      } else {
        process.env.CHARACTEROS_API_KEY = previous;
      }
    }
  });
});
