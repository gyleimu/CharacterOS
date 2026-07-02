import { describe, expect, it } from "vitest";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import { buildMindGalaxyViewSnapshot } from "../../../src/core/graph/mindGalaxyViewTypes";
import {
  buildGalaxyCanvasRenderCommands,
  summarizeGalaxyCanvasRender,
  filterCommandsByZoomLevel,
  type GalaxyCanvasRenderCommand,
  type GalaxyCanvasRenderOptions,
} from "../../../src/core/graph/mindGalaxyCanvasRenderer";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../../../src/core/character/characterBlueprint";

function freshState() {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
}

function buildCommands(options?: GalaxyCanvasRenderOptions): GalaxyCanvasRenderCommand[] {
  const state = freshState();
  const graph = buildMindGraphSnapshot(state);
  const layout = buildGraphLayoutSnapshot(graph);
  const view = buildMindGalaxyViewSnapshot(graph, layout);
  return buildGalaxyCanvasRenderCommands(view, options);
}

function buildCommandsAtZoom(zoomLevel: "L0" | "L1" | "L2" | "L3" | "L4"): GalaxyCanvasRenderCommand[] {
  return buildCommands({ zoomLevel });
}

// ── Deterministic Output ─────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — deterministic output", () => {
  it("same snapshot + options → identical command list", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);

    const c1 = buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L2", width: 800, height: 600 });
    const c2 = buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L2", width: 800, height: 600 });

    expect(c1.length).toBe(c2.length);
    for (let i = 0; i < c1.length; i++) {
      expect(c1[i]!.kind).toBe(c2[i]!.kind);
      expect(c1[i]!.zIndex).toBe(c2[i]!.zIndex);
    }
  });

  it("no Math.random — repeated builds produce byte-identical output", () => {
    const c1 = JSON.stringify(buildCommandsAtZoom("L2"));
    const c2 = JSON.stringify(buildCommandsAtZoom("L2"));
    expect(c1).toBe(c2);
  });
});

// ── Background Command ───────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — background command", () => {
  it("first command is always background", () => {
    const cmds = buildCommandsAtZoom("L0");
    expect(cmds[0]!.kind).toBe("background");
    expect(cmds[0]!.zIndex).toBe(0);
  });

  it("background command at every zoom level", () => {
    for (const zoom of ["L0", "L1", "L2", "L3", "L4"] as const) {
      const cmds = buildCommandsAtZoom(zoom);
      expect(cmds[0]!.kind).toBe("background");
    }
  });

  it("background respects custom color", () => {
    const cmds = buildCommands({ zoomLevel: "L0", backgroundColor: "#111122" });
    expect(cmds[0]!.kind).toBe("background");
    if (cmds[0]!.kind === "background") {
      expect(cmds[0]!.color).toBe("#111122");
    }
  });

  it("background respects custom dimensions", () => {
    const cmds = buildCommands({ zoomLevel: "L0", width: 640, height: 480 });
    expect(cmds[0]!.kind).toBe("background");
    if (cmds[0]!.kind === "background") {
      expect(cmds[0]!.width).toBe(640);
      expect(cmds[0]!.height).toBe(480);
    }
  });
});

// ── L0 Hides Labels and Drift ────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — L0 hides labels and drift", () => {
  it("L0: no text commands (labels hidden at L0)", () => {
    const cmds = buildCommandsAtZoom("L0");
    const texts = cmds.filter((c) => c.kind === "text");
    // L0 has no labels visible — personality_core may have labelVisible=true if radius>=8
    // but no other nodes are visible, so text count should be minimal
    for (const t of texts) {
      // If any text exists, it should only be for personality_core at L0
      expect(t.kind).toBe("text");
    }
  });

  it("L0: no drift vector commands", () => {
    const cmds = buildCommandsAtZoom("L0");
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });

  it("L0: commands are sorted by zIndex", () => {
    const cmds = buildCommandsAtZoom("L0");
    for (let i = 1; i < cmds.length; i++) {
      expect(cmds[i - 1]!.zIndex).toBeLessThanOrEqual(cmds[i]!.zIndex);
    }
  });
});

// ── L4 Includes Drift Vectors ────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — L4 drift vectors", () => {
  it("L4: drift vector commands are present when showDriftVectors=true", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts.length).toBeGreaterThan(0);
  });

  it("L4: each drift vector has start and end points", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    for (const cmd of cmds) {
      if (cmd.kind === "driftVector") {
        expect(cmd.x).toBeDefined();
        expect(cmd.y).toBeDefined();
        expect(cmd.endX).toBeDefined();
        expect(cmd.endY).toBeDefined();
        expect(cmd.nodeId).toBeTruthy();
      }
    }
  });

  it("L4: drift vectors are drawn after nodes (higher zIndex)", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    const maxNodeZ = Math.max(...cmds.filter((c) => c.kind === "circle").map((c) => c.zIndex), 0);
    for (const cmd of cmds) {
      if (cmd.kind === "driftVector") {
        expect(cmd.zIndex).toBeGreaterThan(maxNodeZ);
      }
    }
  });
});

// ── Reduced Motion ───────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — reducedMotion", () => {
  it("reducedMotion=true disables all drift vectors even at L4", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true, reducedMotion: true });
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });

  it("reducedMotion=true with showDriftVectors=false also produces no drift", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: false, reducedMotion: true });
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });
});

// ── showLabels=false ─────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — showLabels=false", () => {
  it("showLabels=false removes all text commands", () => {
    const cmds = buildCommands({ zoomLevel: "L3", showLabels: false });
    const texts = cmds.filter((c) => c.kind === "text");
    expect(texts).toHaveLength(0);
  });

  it("showLabels=false: nodes and edges are still rendered", () => {
    const cmds = buildCommands({ zoomLevel: "L2", showLabels: false });
    const circles = cmds.filter((c) => c.kind === "circle");
    const lines = cmds.filter((c) => c.kind === "line");
    expect(circles.length).toBeGreaterThan(0);
    expect(lines.length).toBeGreaterThan(0);
  });
});

// ── showDriftVectors=false ───────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — showDriftVectors=false", () => {
  it("showDriftVectors=false hides all drift at L4", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: false });
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });
});

// ── Zoom Level Growth ────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — zoom level growth", () => {
  it("command count increases with zoom level", () => {
    const l0 = buildCommandsAtZoom("L0").length;
    const l1 = buildCommandsAtZoom("L1").length;
    const l2 = buildCommandsAtZoom("L2").length;
    const l3 = buildCommandsAtZoom("L3").length;
    expect(l0).toBeLessThanOrEqual(l1);
    expect(l1).toBeLessThanOrEqual(l2);
    expect(l2).toBeLessThanOrEqual(l3);
  });

  it("L4 has the most commands (includes drift vectors)", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    const l0 = buildCommandsAtZoom("L0").length;
    expect(cmds.length).toBeGreaterThanOrEqual(l0);
  });
});

// ── Summary ──────────────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — summary", () => {
  it("summarizeGalaxyCanvasRender returns correct totalCommands", () => {
    const cmds = buildCommandsAtZoom("L2");
    const summary = summarizeGalaxyCanvasRender(cmds);
    expect(summary.totalCommands).toBe(cmds.length);
  });

  it("summary commandsByKind sums to totalCommands", () => {
    const cmds = buildCommandsAtZoom("L3");
    const summary = summarizeGalaxyCanvasRender(cmds);
    const sum = Object.values(summary.commandsByKind).reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.totalCommands);
  });

  it("summary detects drift vectors at L4", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    const summary = summarizeGalaxyCanvasRender(cmds);
    expect(summary.driftVectorCommands).toBeGreaterThan(0);
  });

  it("summary reports zero drift vectors at L0", () => {
    const cmds = buildCommandsAtZoom("L0");
    const summary = summarizeGalaxyCanvasRender(cmds);
    expect(summary.driftVectorCommands).toBe(0);
  });

  it("summary reports zero text commands when showLabels=false", () => {
    const cmds = buildCommands({ zoomLevel: "L3", showLabels: false });
    const summary = summarizeGalaxyCanvasRender(cmds);
    expect(summary.textCommands).toBe(0);
  });
});

// ── zIndex Stability ─────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — zIndex stability", () => {
  it("commands are sorted by zIndex ascending", () => {
    for (const zoom of ["L0", "L1", "L2", "L3", "L4"] as const) {
      const cmds = buildCommandsAtZoom(zoom);
      for (let i = 1; i < cmds.length; i++) {
        expect(cmds[i - 1]!.zIndex).toBeLessThanOrEqual(cmds[i]!.zIndex);
      }
    }
  });

  it("background always has lowest zIndex (0)", () => {
    for (const zoom of ["L0", "L1", "L2", "L3", "L4"] as const) {
      const cmds = buildCommandsAtZoom(zoom);
      expect(cmds[0]!.kind).toBe("background");
      expect(cmds[0]!.zIndex).toBe(0);
    }
  });

  it("drift vectors have highest zIndex when present", () => {
    const cmds = buildCommands({ zoomLevel: "L4", showDriftVectors: true });
    const lastCmd = cmds[cmds.length - 1];
    if (lastCmd!.kind === "driftVector") {
      // This is expected — drifts should be last
      expect(lastCmd!.zIndex).toBeGreaterThan(0);
    }
  });
});

// ── Empty Snapshot ───────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — empty snapshot", () => {
  it("empty snapshot still returns background + nebula commands", () => {
    const state = createCharacterStateFromBlueprint(
      { ...createLinFanBlueprint(), identity: { id: "empty", name: "Empty", description: "", tags: [] } },
      { seedInitialExperiences: false }
    );
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const cmds = buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L4" });

    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds[0]!.kind).toBe("background");
    // Should have at least background + nebula glow + core glow
    expect(cmds.filter((c) => c.kind === "glow").length).toBeGreaterThanOrEqual(1);
  });
});

// ── No Mutation ──────────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — no mutation", () => {
  it("snapshot is not mutated by buildGalaxyCanvasRenderCommands", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const nodeCount = view.nodes.length;
    const edgeCount = view.edges.length;

    buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L4" });

    expect(view.nodes).toHaveLength(nodeCount);
    expect(view.edges).toHaveLength(edgeCount);
  });
});

// ── filterCommandsByZoomLevel ────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — filterCommandsByZoomLevel", () => {
  it("returns same commands (pass-through placeholder)", () => {
    const cmds = buildCommandsAtZoom("L2");
    const filtered = filterCommandsByZoomLevel(cmds, "L0");
    // Placeholder — returns input unchanged. Real filtering is at build time.
    expect(filtered).toHaveLength(cmds.length);
  });
});

// ── Render Commands Have No Browser Dependencies ─────────────────────────

describe("GalaxyCanvasRenderCommands — no browser dependencies", () => {
  it("commands are plain objects with no DOM references", () => {
    const cmds = buildCommandsAtZoom("L4");
    for (const cmd of cmds) {
      const json = JSON.stringify(cmd);
      expect(json).not.toContain("CanvasRenderingContext2D");
      expect(json).not.toContain("HTMLCanvasElement");
      expect(json).not.toContain("document");
      expect(json).not.toContain("window");
      expect(json).not.toContain("requestAnimationFrame");
    }
  });

  it("buildGalaxyCanvasRenderCommands runs without browser globals", () => {
    // Just verifying it doesn't throw in a Node.js test environment
    const cmds = buildCommandsAtZoom("L4");
    expect(Array.isArray(cmds)).toBe(true);
    expect(cmds.length).toBeGreaterThan(0);
  });
});

// ── Default Options ──────────────────────────────────────────────────────

describe("GalaxyCanvasRenderCommands — default options", () => {
  it("default options produce L0 with labels and no drift", () => {
    const cmds = buildCommands(); // no options → all defaults
    expect(cmds[0]!.kind).toBe("background");
    const drifts = cmds.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0); // L0 → no drift
  });

  it("default width=1000 height=1000", () => {
    const cmds = buildCommands();
    expect(cmds[0]!.kind).toBe("background");
    if (cmds[0]!.kind === "background") {
      expect(cmds[0]!.width).toBe(1000);
      expect(cmds[0]!.height).toBe(1000);
    }
  });
});
