import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/life/simulate/commit/preview/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `commit-preview-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeRequest(
  body: unknown,
  characterId?: string,
  headers: Record<string, string> = {}
): [Request, { params: { characterId: string } }] {
  return [
    new Request("http://localhost/api/characters/x/life/simulate/commit/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: { characterId: characterId ?? uniqueId() } },
  ];
}

async function post(body: unknown, characterId?: string, headers?: Record<string, string>) {
  const cid = characterId ?? uniqueId();
  if (!characterId) {
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
  }
  const [req, ctx] = makeRequest(body, cid, headers);
  return POST(req, ctx);
}

const baseBody = {
  totalHours: 8,
  stepHours: 4,
  seed: "commit-preview-seed",
  commitPolicy: {
    enabled: true,
    commitDreams: true,
    commitRandomThoughts: true,
    commitInspirationSeeds: true,
  },
};

describe("POST /api/characters/[characterId]/life/simulate/commit/preview", () => {
  it("returns a public commit preview for explicit commit policy", async () => {
    const res = await post(baseBody);
    expect(res.status).toBe(200);

    const body = await res.json() as Record<string, unknown>;
    const preview = body.preview as Record<string, unknown>;
    expect(body.result).toBeUndefined();
    expect(preview.version).toBe("v10.21");
    expect(preview.commitSurface).toBeDefined();
    expect(preview.auditSummary).toBeDefined();
    expect(preview.rollbackSummary).toBeDefined();
    expect(preview.governance).toBeDefined();
    expect(preview).not.toHaveProperty("finalState");
  });

  it("requires commitPolicy.enabled=true", async () => {
    const res = await post({ totalHours: 4, stepHours: 2 });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("commitPolicy.enabled");
  });

  it("returns 404 for unknown character", async () => {
    const cid = `unknown-preview-${Date.now()}`;
    const [req, ctx] = makeRequest(baseBody, cid);
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("validates simulation bounds", async () => {
    const overTotal = await post({ ...baseBody, totalHours: 999999 });
    expect(overTotal.status).toBe(422);

    const overStep = await post({ ...baseBody, stepHours: 48 });
    expect(overStep.status).toBe(422);
  });

  it("does not persist projected commit state", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
    const before = characterPhysicsService.getState(cid);
    const beforeMemoryCount = before.memories.length;

    const res = await post(baseBody, cid);
    expect(res.status).toBe(200);

    const after = characterPhysicsService.getState(cid);
    expect(after.memories.length).toBe(beforeMemoryCount);
    expect(after.memories.map((memory) => memory.id)).toEqual(before.memories.map((memory) => memory.id));
  });

  it("does not expose private final state or raw simulation result", async () => {
    const res = await post({ ...baseBody, includeDecision: true, includeExplanation: true });
    expect(res.status).toBe(200);
    const responseText = JSON.stringify(await res.json());

    expect(responseText).not.toContain("\"finalState\"");
    expect(responseText).not.toContain("\"result\"");
    expect(responseText).not.toContain("\"commitResult\"");
    expect(responseText).not.toContain("\"clusters\"");
    expect(responseText).not.toContain("\"proceduralRoutines\"");
  });

  it("is deterministic for the same character and seed", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
    const body = {
      totalHours: 4,
      stepHours: 2,
      seed: "deterministic-preview",
      commitPolicy: { enabled: true },
    };

    const r1 = await post(body, cid);
    const r2 = await post(body, cid);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const d1 = await r1.json() as Record<string, unknown>;
    const d2 = await r2.json() as Record<string, unknown>;
    const p1 = d1.preview as Record<string, unknown>;
    const p2 = d2.preview as Record<string, unknown>;
    expect(p1.simulationId).toBe(p2.simulationId);
    expect(p1.requestDigest).toEqual(p2.requestDigest);
    expect(p1.baseStateFingerprint).toEqual(p2.baseStateFingerprint);
    expect(p1.finalStateFingerprint).toEqual(p2.finalStateFingerprint);
  });

  it("requires auth when CHARACTEROS_API_KEY is configured", async () => {
    const previous = process.env.CHARACTEROS_API_KEY;
    process.env.CHARACTEROS_API_KEY = "preview-secret";
    try {
      const res = await post(baseBody);
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
    process.env.CHARACTEROS_API_KEY = "preview-secret";
    try {
      const res = await post(baseBody, undefined, { "x-api-key": "preview-secret" });
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
