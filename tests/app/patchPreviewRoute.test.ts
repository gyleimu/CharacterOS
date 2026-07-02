import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/characters/[characterId]/editor/preview/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `preview-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

describe("Patch Preview API", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.CHARACTEROS_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("POST returns 401 when API key is configured and header is missing", async () => {
    process.env.CHARACTEROS_API_KEY = "preview-secret";
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            { path: "coordinate.values.trust", from: 0.5, to: 0.3, reason: "Testing" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(401);
  });

  it("POST returns 200 with valid preview for a simple patch", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const trustBefore = characterPhysicsService.getState(characterId)!.coordinate.values.trust;

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Test trust decrease",
          changes: [
            { path: "coordinate.values.trust", from: trustBefore, to: 0.3, reason: "Testing" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.valid).toBe(true);
    expect(body.projectedState).toBeUndefined();
    expect(body.projectedStateSummary).toBeDefined();
    expect(body.integrity).toBeDefined();
    expect(body.changedPaths).toEqual(["coordinate.values.trust"]);
    expect(body.patch).toBeDefined();
  });

  it("POST returns 422 when patch from value is stale", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const trustBefore = characterPhysicsService.getState(characterId)!.coordinate.values.trust;

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            { path: "coordinate.values.trust", from: trustBefore + 0.123, to: 0.3, reason: "stale" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(422);
    const body = await response.json() as { valid: boolean; validation: { summary: string } };
    expect(body.valid).toBe(false);
    expect(body.validation.summary).toContain("error");
  });

  it("POST returns 422 for invalid patch (bad path)", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            { path: "memories.0.recency", from: 0.5, to: 0.3, reason: "Not editable" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(422);
    const body = await response.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
  });

  it("POST returns 400 for empty changes", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: [] })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(400);
  });

  it("valid response includes affectedDomains, riskSummary, clampedChanges", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const st = characterPhysicsService.getState(characterId)!;
    const t = st.coordinate.values.trust;
    const f = st.coordinate.values.fear;

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
        body: JSON.stringify({
          changes: [
            { path: "coordinate.values.trust", from: t, to: 0.25, reason: "Testing" },
            { path: "coordinate.values.fear", from: f, to: 0.55, reason: "Testing" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.affectedDomains).toBeDefined();
    expect(body.riskSummary).toBeDefined();
    expect(body.clampedChanges).toBeDefined();
    expect(body.projectedStateSummary).toBeDefined();
    expect(body.projectedState).toBeUndefined(); // never include full state
  });

  it("invalid response includes affectedDomains, riskSummary, clampedChanges", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
        body: JSON.stringify({
          changes: [
            { path: "invalid.path", from: 0, to: 0, reason: "bad" }
          ]
        })
      }),
      { params: { characterId } }
    );

    expect(response.status).toBe(422);
    const body = await response.json() as Record<string, unknown>;
    expect(body.valid).toBe(false);
    expect(body.affectedDomains).toBeDefined();
    expect(body.riskSummary).toBeDefined();
    expect(body.clampedChanges).toBeDefined();
    expect(body.projectedState).toBeUndefined();
  });

  it("POST does not mutate the real character state", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const stateBefore = characterPhysicsService.getState(characterId)!;
    const trustBefore = stateBefore.coordinate.values.trust;

    await POST(
      new Request("http://localhost/api/characters/test/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            { path: "coordinate.values.trust", from: trustBefore, to: 0.01, reason: "should not persist" }
          ]
        })
      }),
      { params: { characterId } }
    );

    const stateAfter = characterPhysicsService.getState(characterId)!;
    expect(stateAfter.coordinate.values.trust).toBe(trustBefore);
  });
});
