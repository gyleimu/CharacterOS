import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/editor/history/route";
import { POST } from "../../src/app/api/characters/[characterId]/editor/apply/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

function uniqueId(): string {
  return `hist-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
const headers = { "Content-Type": "application/json" };

describe("Patch History API", () => {
  it("GET returns entries for a character with edits", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const st = characterPhysicsService.getState(characterId)!;
    const t = st.coordinate.values.trust;

    // Apply a patch first
    await POST(
      new Request("http://localhost/api/characters/x/editor/apply", {
        method: "POST", headers,
        body: JSON.stringify({ changes: [{ path: "coordinate.values.trust", from: t, to: 0.1, reason: "Test" }] })
      }),
      { params: { characterId } }
    );

    const response = await GET(
      new Request("http://localhost/api/characters/x/editor/history"),
      { params: { characterId } }
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { entries: unknown[]; count: number };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.entries).toHaveLength(body.count);
  });

  it("GET returns empty history for new character", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      new Request("http://localhost/api/characters/x/editor/history"),
      { params: { characterId } }
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { entries: unknown[]; count: number };
    expect(body.count).toBe(0);
  });

  it("audit entries include changedPaths and not full state", async () => {
    const characterId = uniqueId();
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });
    const st = characterPhysicsService.getState(characterId)!;
    const t = st.coordinate.values.trust;

    await POST(
      new Request("http://localhost/api/characters/x/editor/apply", {
        method: "POST", headers,
        body: JSON.stringify({ changes: [{ path: "coordinate.values.trust", from: t, to: 0.15, reason: "Test" }] })
      }),
      { params: { characterId } }
    );

    const response = await GET(
      new Request("http://localhost/api/characters/x/editor/history"),
      { params: { characterId } }
    );
    const body = await response.json() as { entries: Array<{ changedPaths: string[]; applied: boolean }>; count: number };
    expect(body.entries[0]!.changedPaths).toContain("coordinate.values.trust");
    expect(body.entries[0]!.applied).toBe(true);
    // Full state should not be in the response
    expect((body.entries[0] as Record<string, unknown>).projectedState).toBeUndefined();
  });
});
