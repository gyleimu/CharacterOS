import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/graph/route";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";
import type { MindGraphSnapshot } from "../../src/core/graph/mindGraphTypes";

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeRequest(characterId: string, query?: string): Request {
  const base = `http://localhost/api/characters/${characterId}/graph`;
  return new Request(query ? `${base}?${query}` : base);
}

describe("Graph Snapshot API", () => {
  it("GET returns 200 with valid snapshot for seeded character", async () => {
    const characterId = uniqueCharacterId("graph-seeded");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(makeRequest(characterId), { params: { characterId } });
    expect(response.status).toBe(200);

    const body = await response.json() as { snapshot: MindGraphSnapshot };
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.version).toBe("7.1.0");
    expect(body.snapshot.characterId.length).toBeGreaterThan(0);
    expect(body.snapshot.nodes.length).toBeGreaterThan(0);
    expect(body.snapshot.edges.length).toBeGreaterThan(0);
  });

  it("snapshot includes all expected node types", async () => {
    const characterId = uniqueCharacterId("graph-types");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(makeRequest(characterId), { params: { characterId } });
    const body = await response.json() as { snapshot: MindGraphSnapshot };
    const types = new Set(body.snapshot.nodes.map((n) => n.type));

    expect(types.has("personality_core")).toBe(true);
    expect(types.has("memory")).toBe(true);
    expect(types.has("impact_particle")).toBe(true);
    expect(types.has("impact_cluster")).toBe(true);
    expect(types.has("temporal_process")).toBe(true);
  });

  it("snapshot includes summary with counts", async () => {
    const characterId = uniqueCharacterId("graph-summary");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(makeRequest(characterId), { params: { characterId } });
    const body = await response.json() as { snapshot: MindGraphSnapshot };

    expect(body.snapshot.summary.nodeCount).toBe(body.snapshot.nodes.length);
    expect(body.snapshot.summary.edgeCount).toBe(body.snapshot.edges.length);
  });

  it("snapshot includes warnings and reasons", async () => {
    const characterId = uniqueCharacterId("graph-reasons");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(makeRequest(characterId), { params: { characterId } });
    const body = await response.json() as { snapshot: MindGraphSnapshot };

    expect(body.snapshot.reasons.length).toBeGreaterThan(0);
    // warnings may be empty or non-empty depending on state
    expect(Array.isArray(body.snapshot.warnings)).toBe(true);
  });

  it("includeISF=true adds internal state variable nodes", async () => {
    const characterId = uniqueCharacterId("graph-isf");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "includeISF=true"),
      { params: { characterId } }
    );
    const body = await response.json() as { snapshot: MindGraphSnapshot };

    const isvNodes = body.snapshot.nodes.filter((n) => n.type === "internal_state_variable");
    expect(isvNodes.length).toBeGreaterThan(0);
  });

  it("identical requests return identical snapshots", async () => {
    const characterId = uniqueCharacterId("graph-idempotent");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response1 = await GET(makeRequest(characterId), { params: { characterId } });
    const body1 = await response1.json() as { snapshot: MindGraphSnapshot };

    const response2 = await GET(makeRequest(characterId), { params: { characterId } });
    const body2 = await response2.json() as { snapshot: MindGraphSnapshot };

    expect(body1.snapshot.nodes.length).toBe(body2.snapshot.nodes.length);
    expect(body1.snapshot.edges.length).toBe(body2.snapshot.edges.length);
  });

  // ─── V8.3 SVG Export ────────────────────────────────────────────

  it("GET ?format=svg returns SVG content type", async () => {
    const characterId = uniqueCharacterId("graph-svg");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=svg"),
      { params: { characterId } }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it("GET ?format=svg returns valid SVG string", async () => {
    const characterId = uniqueCharacterId("graph-svg2");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=svg"),
      { params: { characterId } }
    );
    const svg = await response.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<circle");
  });

  // ─── V8.4 Bundle Format ──────────────────────────────────────────

  it("GET ?format=bundle returns graph + layout + SVG", async () => {
    const characterId = uniqueCharacterId("graph-bundle");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=bundle"),
      { params: { characterId } }
    );
    expect(response.status).toBe(200);

    const body = await response.json() as { graph: unknown; layout: unknown; svg: string };
    expect(body.graph).toBeDefined();
    expect(body.layout).toBeDefined();
    expect(body.svg).toContain("<svg");
    expect(body.svg).toContain("</svg>");
  });

  it("GET rejects invalid format", async () => {
    const characterId = uniqueCharacterId("graph-invalid-format");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=html"),
      { params: { characterId } }
    );

    expect(response.status).toBe(400);
  });

  it("GET rejects invalid SVG size", async () => {
    const characterId = uniqueCharacterId("graph-invalid-size");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=svg&width=huge"),
      { params: { characterId } }
    );

    expect(response.status).toBe(400);
  });

  it("GET rejects invalid boolean query", async () => {
    const characterId = uniqueCharacterId("graph-invalid-bool");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "showLabels=yes"),
      { params: { characterId } }
    );

    expect(response.status).toBe(400);
  });

  it("GET rejects invalid background color", async () => {
    const characterId = uniqueCharacterId("graph-invalid-bg");
    characterPhysicsService.resetCharacter(characterId, { seedInitialExperiences: true });

    const response = await GET(
      makeRequest(characterId, "format=svg&bg=blue"),
      { params: { characterId } }
    );

    expect(response.status).toBe(400);
  });
});
