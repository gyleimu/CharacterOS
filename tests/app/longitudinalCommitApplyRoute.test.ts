import { describe, expect, it } from "vitest";
import { POST as APPLY } from "../../src/app/api/characters/[characterId]/life/simulate/commit/apply/route";
import { POST as PREVIEW } from "../../src/app/api/characters/[characterId]/life/simulate/commit/preview/route";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import { computeLongitudinalStateFingerprint } from "../../src/core/life/finalStateForCommit";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `commit-apply-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

const simulationBody = {
  totalHours: 12,
  stepHours: 4,
  seed: "route-apply-seed",
  commitPolicy: {
    enabled: true,
    commitDreams: true,
    commitRandomThoughts: true,
    commitInspirationSeeds: true,
  },
};

async function previewPayload(characterId: string) {
  const res = await preview(simulationBody, characterId);
  expect(res.status).toBe(200);
  const body = await res.json() as Record<string, unknown>;
  const p = body.preview as Record<string, unknown>;
  return {
    simulationId: p.simulationId,
    requestDigest: p.requestDigest,
    baseStateFingerprint: p.baseStateFingerprint,
  };
}

describe("POST /api/characters/[characterId]/life/simulate/commit/apply", () => {
  it("applies from a matching preview digest without exposing private state", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const previewFields = await previewPayload(characterId);

    const res = await apply({
      ...simulationBody,
      ...previewFields,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("applied");
    expect(body.applied).toBe(true);
    expect(body.audit).toBeDefined();

    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain("\"finalState\"");
    expect(bodyText).not.toContain("\"result\"");
    expect(bodyText).not.toContain("\"commitResult\"");
    expect(bodyText).not.toContain("\"clusters\"");

    const audit = characterPhysicsService.getLongitudinalCommitAuditHistory(characterId)[0];
    expect(audit?.status).toBe("applied");
    expect(computeLongitudinalStateFingerprint(characterPhysicsService.getState(characterId)))
      .toEqual(audit?.finalStateFingerprint);
  });

  it("requires preview requestDigest and baseStateFingerprint", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId);

    const res = await apply({
      ...simulationBody,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("requestDigest");
  });

  it("returns 422 when request digest does not match", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId);
    const fields = await previewPayload(characterId);
    const badDigest = { ...(fields.requestDigest as Record<string, unknown>), value: "bad" };

    const res = await apply({
      ...simulationBody,
      ...fields,
      requestDigest: badDigest,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(422);
  });

  it("returns 409 when preview base state is stale", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId);
    const fields = await previewPayload(characterId);
    const changed = characterPhysicsService.getState(characterId);
    changed.coordinate.values.trust = 0.99;
    characterPhysicsService.replaceState(characterId, changed);

    const res = await apply({
      ...simulationBody,
      ...fields,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(409);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("stale");
  });

  it("returns 422 when confirmation is missing", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId);
    const fields = await previewPayload(characterId);

    const res = await apply({ ...simulationBody, ...fields }, characterId);

    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("blocked");
    expect(JSON.stringify(body.readiness)).toContain("confirmation");
  });

  it("returns 404 for unknown character", async () => {
    const characterId = `missing-${uniqueId()}`;
    const fields = {
      requestDigest: {
        algorithm: "sha256",
        canonicalization: "characteros-longitudinal-json-v1",
        value: "x",
      },
      baseStateFingerprint: {
        algorithm: "sha256",
        canonicalization: "characteros-longitudinal-json-v1",
        value: "y",
      },
    };

    const res = await apply({
      ...simulationBody,
      ...fields,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    }, characterId);

    expect(res.status).toBe(404);
  });

  it("requires auth when CHARACTEROS_API_KEY is configured", async () => {
    const previous = process.env.CHARACTEROS_API_KEY;
    process.env.CHARACTEROS_API_KEY = "apply-secret";
    try {
      const characterId = uniqueId();
      characterPhysicsService.resetCharacter(characterId);
      const res = await apply(simulationBody, characterId);
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
    process.env.CHARACTEROS_API_KEY = "apply-secret";
    try {
      const characterId = uniqueId();
      characterPhysicsService.resetCharacter(characterId);
      const fieldsRes = await preview(simulationBody, characterId, { "x-api-key": "apply-secret" });
      expect(fieldsRes.status).toBe(200);
      const fieldsBody = await fieldsRes.json() as Record<string, unknown>;
      const p = fieldsBody.preview as Record<string, unknown>;

      const res = await apply({
        ...simulationBody,
        simulationId: p.simulationId,
        requestDigest: p.requestDigest,
        baseStateFingerprint: p.baseStateFingerprint,
        confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      }, characterId, { "x-api-key": "apply-secret" });

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
