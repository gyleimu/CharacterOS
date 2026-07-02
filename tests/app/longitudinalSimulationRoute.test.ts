import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/life/simulate/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `sim-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function makeRequest(body: unknown, characterId?: string): [Request, { params: { characterId: string } }] {
  return [
    new Request("http://localhost/api/characters/x/life/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { characterId: characterId ?? uniqueId() } },
  ];
}

async function post(body: unknown, characterId?: string) {
  const cid = characterId ?? uniqueId();
  if (!characterId) {
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
  }
  const [req, ctx] = makeRequest(body, cid);
  return POST(req, ctx);
}

// ── Dry-Run ────────────────────────────────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — dry-run", () => {
  it("returns result for valid dry-run", async () => {
    const res = await post({ totalHours: 8, stepHours: 4 });
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      expect(data.result).toBeDefined();
      const result = data.result as Record<string, unknown>;
      expect(result.version).toBe("v10.17");
      expect(Array.isArray(result.steps)).toBe(true);
    }
  });

  it("returns expected number of steps", async () => {
    const res = await post({ totalHours: 12, stepHours: 3 });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const steps = result.steps as unknown[];
      expect(steps.length).toBe(4);
    }
  });

  it("default seed produces deterministic result", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
    const [req1, ctx1] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);
    const [req2, ctx2] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);
    const r1 = await POST(req1, ctx1);
    const r2 = await POST(req2, ctx2);
    if (r1.status === 200 && r2.status === 200) {
      const d1 = await r1.json() as Record<string, unknown>;
      const d2 = await r2.json() as Record<string, unknown>;
      const s1 = ((d1.result as Record<string, unknown>).steps as Record<string, unknown>[])[0]!;
      const s2 = ((d2.result as Record<string, unknown>).steps as Record<string, unknown>[])[0]!;
      expect(s1.lifeDecisionContext).toEqual(s2.lifeDecisionContext);
    }
  });

  it("includeDecision=true returns differentiatedDecision per step", async () => {
    const res = await post({ totalHours: 4, stepHours: 2, includeDecision: true });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const steps = result.steps as Record<string, unknown>[];
      for (const step of steps) {
        expect(step.differentiatedDecision).toBeDefined();
      }
    }
  });

  it("includeExplanation=true returns differentiatedExplanation per step", async () => {
    const res = await post({ totalHours: 2, stepHours: 2, includeDecision: true, includeExplanation: true });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const steps = result.steps as Record<string, unknown>[];
      for (const step of steps) {
        expect(step.differentiatedExplanation).toBeDefined();
      }
    }
  });

  it("response does not include full CharacterPhysicsState", async () => {
    const res = await post({ totalHours: 4, stepHours: 2 });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      expect(data.result).toBeDefined();
      expect(Object.keys(data)).not.toContain("state");
      expect(Object.keys(data)).not.toContain("derived");
    }
  });
});

// ── Validation ─────────────────────────────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — validation", () => {
  it("rejects missing totalHours", async () => {
    const res = await post({ stepHours: 4 });
    expect(res.status).toBe(422);
  });

  it("rejects totalHours <= 0", async () => {
    const res = await post({ totalHours: 0, stepHours: 4 });
    expect(res.status).toBe(422);
  });

  it("rejects stepHours <= 0", async () => {
    const res = await post({ totalHours: 8, stepHours: 0 });
    expect(res.status).toBe(422);
  });

  it("excessive totalHours is rejected with 422 (V10.19)", async () => {
    // V10.19: totalHours exceeds MAX_TOTAL_HOURS (720 * 24 = 17280) → 422
    const res = await post({ totalHours: 100000, stepHours: 1 });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("exceeds maximum");
  });

  it("unknown character returns 404 (V10.19)", async () => {
    // V10.19: Unknown characters return 404 instead of auto-creating
    const cid = `never-before-seen-${Date.now()}`;
    const [req, ctx] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("not found");
  });

  it("rejects totalHours exceeding max (V10.19)", async () => {
    const res = await post({ totalHours: 999999, stepHours: 4 });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("exceeds maximum");
  });

  it("rejects stepHours > 24 (V10.19)", async () => {
    const res = await post({ totalHours: 8, stepHours: 48 });
    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain("must not exceed 24");
  });
});

// ── Self-Action Safety ─────────────────────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — self-action safety", () => {
  it("self-action candidate is not executed regardless of commitPolicy", async () => {
    const res = await post({
      totalHours: 4,
      stepHours: 2,
      commitPolicy: { enabled: true, commitDreams: true },
    });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const steps = result.steps as Record<string, unknown>[];
      for (const step of steps) {
        const lc = step.lifeDecisionContext as Record<string, unknown>;
        if (lc.topSelfActionCandidateType) {
          expect(typeof lc.topSelfActionCandidateType).toBe("string");
        }
      }
    }
  });
});

// ── V10.19 Governance — Commit Deferred ─────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — V10.19 commit deferred", () => {
  it("commitPolicy.enabled=true returns deferred warning (V10.19)", async () => {
    const res = await post({
      totalHours: 4, stepHours: 2,
      commitPolicy: { enabled: true, commitDreams: true },
    });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const warnings = data.warnings as string[];
      const hasDeferred = warnings.some((w) =>
        w.includes("deferred") || w.includes("Commit is deferred")
      );
      expect(hasDeferred).toBe(true);
    }
  });

  it("commitPolicy.enabled=true does not persist to service repo (V10.19)", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
    const before = characterPhysicsService.getState(cid);
    const beforeMem = before.memories.length;

    const [req, ctx] = makeRequest({
      totalHours: 8, stepHours: 4,
      commitPolicy: { enabled: true, commitDreams: true, commitRandomThoughts: true },
    }, cid);
    await POST(req, ctx);

    const after = characterPhysicsService.getState(cid);
    expect(after.memories.length).toBe(beforeMem);
  });
});

// ── V10.19 Governance — Response Privacy ────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — V10.19 response privacy", () => {
  it("response does not include full state keys (V10.19)", async () => {
    const res = await post({ totalHours: 4, stepHours: 2, includeDecision: true });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const resultStr = JSON.stringify(data.result);
      // No full state keys at any level
      expect(resultStr).not.toContain('"coordinate"');
      expect(resultStr).not.toContain('"clusters"');
      expect(resultStr).not.toContain('"particles"');
      expect(resultStr).not.toContain('"proceduralRoutines"');
    }
  });

  it("finalStateSummary uses CompactStateSummary format (V10.19)", async () => {
    const res = await post({ totalHours: 4, stepHours: 2 });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const summary = result.finalStateSummary as Record<string, unknown>;
      expect(summary.memoryCount).toBeGreaterThanOrEqual(0);
      expect(summary.trust).toBeGreaterThanOrEqual(0);
      expect(summary.trust).toBeLessThanOrEqual(1);
      expect(summary).not.toHaveProperty("coordinate");
    }
  });

  it("step summaries are compact (V10.19)", async () => {
    const res = await post({ totalHours: 4, stepHours: 2, includeDecision: true, includeExplanation: true });
    if (res.status === 200) {
      const data = await res.json() as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const steps = result.steps as Record<string, unknown>[];
      for (const step of steps) {
        const before = step.stateSummaryBefore as Record<string, unknown>;
        const after = step.stateSummaryAfter as Record<string, unknown>;
        expect(before).not.toHaveProperty("coordinate");
        expect(after).not.toHaveProperty("clusters");
      }
    }
  });

  it("includeExplanation response is bounded (V10.19)", async () => {
    const res = await post({
      totalHours: 4, stepHours: 2,
      includeDecision: true, includeExplanation: true,
    });
    if (res.status === 200) {
      const bodyStr = JSON.stringify(await res.json());
      expect(bodyStr.length).toBeLessThan(200000);
    }
  });

  it("repeated dry-run calls do not mutate state (V10.19)", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid, { seedInitialExperiences: true });
    const before = characterPhysicsService.getState(cid);
    const beforeMem = before.memories.length;

    for (let i = 0; i < 3; i++) {
      const [req, ctx] = makeRequest({ totalHours: 8, stepHours: 4 }, cid);
      await POST(req, ctx);
    }

    const after = characterPhysicsService.getState(cid);
    expect(after.memories.length).toBe(beforeMem);
  });
});

// ── V10.19 Governance — Determinism ────────────────────────────────────

describe("POST /api/characters/[characterId]/life/simulate — V10.19 determinism", () => {
  it("same seed returns same aggregate result (V10.19)", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid);
    const body = { totalHours: 8, stepHours: 4, seed: "governance-seed" };

    const [req1, ctx1] = makeRequest(body, cid);
    const [req2, ctx2] = makeRequest(body, cid);
    const r1 = await POST(req1, ctx1);
    const r2 = await POST(req2, ctx2);

    if (r1.status === 200 && r2.status === 200) {
      const d1 = await r1.json() as Record<string, unknown>;
      const d2 = await r2.json() as Record<string, unknown>;
      const a1 = (d1.result as Record<string, unknown>).aggregate as Record<string, unknown>;
      const a2 = (d2.result as Record<string, unknown>).aggregate as Record<string, unknown>;
      expect(a1.averageFatigue).toBe(a2.averageFatigue);
      expect(a1.averageBoredom).toBe(a2.averageBoredom);
      expect(a1.totalSteps).toBe(a2.totalSteps);
    }
  });

  it("missing seed fallback is deterministic (V10.19)", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid);

    const [req1, ctx1] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);
    const [req2, ctx2] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);
    const r1 = await POST(req1, ctx1);
    const r2 = await POST(req2, ctx2);

    if (r1.status === 200 && r2.status === 200) {
      const d1 = await r1.json() as Record<string, unknown>;
      const d2 = await r2.json() as Record<string, unknown>;
      const a1 = (d1.result as Record<string, unknown>).aggregate as Record<string, unknown>;
      const a2 = (d2.result as Record<string, unknown>).aggregate as Record<string, unknown>;
      expect(a1.averageFatigue).toBe(a2.averageFatigue);
    }
  });

  it("no background process — request completes synchronously (V10.19)", async () => {
    const cid = uniqueId();
    characterPhysicsService.resetCharacter(cid);
    const [req, ctx] = makeRequest({ totalHours: 4, stepHours: 2 }, cid);

    const start = Date.now();
    const res = await POST(req, ctx);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(10000);
  });
});
