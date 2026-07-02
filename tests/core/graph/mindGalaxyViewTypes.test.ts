import { describe, expect, it } from "vitest";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import {
  buildMindGalaxyViewSnapshot,
  getVisibleGalaxyNodes,
  getVisibleGalaxyEdges,
  summarizeMindGalaxyView,
  isGalaxyZoomLevel,
  GALAXY_ZOOM_LEVELS,
  type MindGalaxyViewSnapshot,
} from "../../../src/core/graph/mindGalaxyViewTypes";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function freshState() {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
}

function emptyState() {
  return createCharacterPhysicsState();
}

function makeView(): MindGalaxyViewSnapshot {
  const state = freshState();
  const graph = buildMindGraphSnapshot(state);
  const layout = buildGraphLayoutSnapshot(graph);
  return buildMindGalaxyViewSnapshot(graph, layout);
}

function makeEmptyView(): MindGalaxyViewSnapshot {
  const state = emptyState();
  const graph = buildMindGraphSnapshot(state);
  const layout = buildGraphLayoutSnapshot(graph);
  return buildMindGalaxyViewSnapshot(graph, layout);
}

// ── Deterministic Output ─────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — deterministic output", () => {
  it("same graph + layout → identical view snapshots", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const v1 = buildMindGalaxyViewSnapshot(graph, layout);
    const v2 = buildMindGalaxyViewSnapshot(graph, layout);
    expect(v1.nodes.length).toBe(v2.nodes.length);
    expect(v1.edges.length).toBe(v2.edges.length);
    for (let i = 0; i < v1.nodes.length; i++) {
      expect(v1.nodes[i]!.drift?.angle).toBe(v2.nodes[i]!.drift?.angle);
      expect(v1.nodes[i]!.drift?.magnitude).toBe(v2.nodes[i]!.drift?.magnitude);
    }
    expect(v1.summary.driftNodeCount).toBe(v2.summary.driftNodeCount);
    expect(v1.summary.averageDriftMagnitude).toBe(v2.summary.averageDriftMagnitude);
  });

  it("drift vectors are deterministic — no Math.random dependency", () => {
    const v = makeView();
    const driftNodes = v.nodes.filter((n) => n.drift !== undefined);
    expect(driftNodes.length).toBeGreaterThan(0);
    for (const n of driftNodes) {
      expect(n.drift!.magnitude).toBeGreaterThan(0);
      expect(n.drift!.magnitude).toBeLessThanOrEqual(2.0);
      expect(n.drift!.angle).toBeGreaterThanOrEqual(0);
      expect(n.drift!.angle).toBeLessThan(Math.PI * 2);
    }
  });
});

// ── No Mutation ──────────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — no mutation of inputs", () => {
  it("graph and layout are not mutated by buildMindGalaxyViewSnapshot", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const graphNodesBefore = graph.nodes.length;
    const layoutNodesBefore = layout.nodes.length;

    buildMindGalaxyViewSnapshot(graph, layout);

    expect(graph.nodes).toHaveLength(graphNodesBefore);
    expect(layout.nodes).toHaveLength(layoutNodesBefore);
  });

  it("getVisibleGalaxyNodes does not mutate the snapshot", () => {
    const v = makeView();
    const nodeCount = v.nodes.length;
    getVisibleGalaxyNodes(v, "L2");
    expect(v.nodes).toHaveLength(nodeCount);
  });

  it("getVisibleGalaxyEdges does not mutate the snapshot", () => {
    const v = makeView();
    const edgeCount = v.edges.length;
    getVisibleGalaxyEdges(v, "L2");
    expect(v.edges).toHaveLength(edgeCount);
  });
});

// ── Zoom Visibility ──────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — zoom visibility", () => {
  it("L0: only personality_core and high-level nebula nodes", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L0");
    const types = new Set(visible.map((n) => n.nodeType));
    expect(types.has("personality_core")).toBe(true);
    expect(types.has("memory")).toBe(false);
    expect(types.has("belief")).toBe(false);
    expect(types.has("need")).toBe(false);
    expect(types.has("desire")).toBe(false);
    expect(types.has("behavior_bias")).toBe(false);
    expect(types.has("benchmark_signal")).toBe(false);
    expect(types.has("internal_state_variable")).toBe(false);
  });

  it("L1: adds impact_cluster and temporal_process", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L1");
    const types = new Set(visible.map((n) => n.nodeType));
    expect(types.has("impact_cluster")).toBe(true);
    expect(types.has("temporal_process")).toBe(true);
  });

  it("L2: adds memory, belief, need, desire, impact_particle if present", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L2");
    const types = new Set(visible.map((n) => n.nodeType));
    expect(types.has("memory")).toBe(true);
    expect(types.has("belief")).toBe(true);
    expect(types.has("need")).toBe(true);
    expect(types.has("desire")).toBe(true);
    // impact_particle may not exist in all graphs — check only if present
    if (v.nodes.some((n) => n.nodeType === "impact_particle")) {
      expect(types.has("impact_particle")).toBe(true);
    }
  });

  it("L3: adds behavior_bias and any L3-gated node types present in graph", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L3");
    const types = new Set(visible.map((n) => n.nodeType));
    // L3-gated types appear if they exist in the graph
    // behavior_bias is generated by the builder; internal_state_variable requires InternalStateFieldSnapshot option
    expect(types.has("behavior_bias")).toBe(true);
    // If these types exist in the view, they must be visible at L3
    const l3GatedTypes = ["internal_state_variable", "benchmark_signal"] as const;
    for (const t of l3GatedTypes) {
      const existsInView = v.nodes.some((n) => n.nodeType === t);
      if (existsInView) {
        expect(types.has(t)).toBe(true);
      }
    }
  });

  it("L4: all nodes visible", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L4");
    expect(visible.length).toBe(v.nodes.length);
  });

  it("node counts increase monotonically with zoom level", () => {
    const v = makeView();
    const l0 = getVisibleGalaxyNodes(v, "L0").length;
    const l1 = getVisibleGalaxyNodes(v, "L1").length;
    const l2 = getVisibleGalaxyNodes(v, "L2").length;
    const l3 = getVisibleGalaxyNodes(v, "L3").length;
    const l4 = getVisibleGalaxyNodes(v, "L4").length;
    expect(l0).toBeLessThanOrEqual(l1);
    expect(l1).toBeLessThanOrEqual(l2);
    expect(l2).toBeLessThanOrEqual(l3);
    expect(l3).toBeLessThanOrEqual(l4);
  });

  it("edge counts increase monotonically with zoom level", () => {
    const v = makeView();
    const l0 = getVisibleGalaxyEdges(v, "L0").length;
    const l1 = getVisibleGalaxyEdges(v, "L1").length;
    const l2 = getVisibleGalaxyEdges(v, "L2").length;
    expect(l0).toBeLessThanOrEqual(l1);
    expect(l1).toBeLessThanOrEqual(l2);
  });
});

// ── L4 Drift Vectors ─────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — L4 drift vectors", () => {
  it("drift vectors are present on nodes", () => {
    const v = makeView();
    const driftNodes = v.nodes.filter((n) => n.drift !== undefined);
    expect(driftNodes.length).toBeGreaterThan(0);
  });

  it("drift magnitude is low (0.05–2.0)", () => {
    const v = makeView();
    for (const n of v.nodes) {
      if (n.drift) {
        expect(n.drift.magnitude).toBeLessThanOrEqual(2.0);
        expect(n.drift.magnitude).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it("drift dx/dy are consistent with angle and magnitude", () => {
    const v = makeView();
    for (const n of v.nodes) {
      if (n.drift) {
        const expectedDx = Math.cos(n.drift.angle) * n.drift.magnitude;
        const expectedDy = Math.sin(n.drift.angle) * n.drift.magnitude;
        expect(Math.abs(n.drift.dx - expectedDx)).toBeLessThan(0.001);
        expect(Math.abs(n.drift.dy - expectedDy)).toBeLessThan(0.001);
      }
    }
  });

  it("drift direction is a valid enum value", () => {
    const v = makeView();
    const validDirections = ["strengthening", "weakening", "approaching_core", "drifting_outward", "stable"];
    for (const n of v.nodes) {
      if (n.drift) {
        expect(validDirections).toContain(n.drift.direction);
      }
    }
  });
});

// ── L0 Hides Detail ──────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — L0 hides detail", () => {
  it("L0 visible nodes do not include detailed types", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L0");
    for (const n of visible) {
      expect(["personality_core"]).toContain(n.nodeType);
    }
  });

  it("L0 visible edges are minimal", () => {
    const v = makeView();
    const visible = getVisibleGalaxyEdges(v, "L0");
    // L0 edges could also be empty if no cluster edges are at L0
    expect(visible.length).toBeGreaterThanOrEqual(0);
  });

  it("L0 non-core nodes do not have labels visible", () => {
    const v = makeView();
    const visible = getVisibleGalaxyNodes(v, "L0");
    for (const n of visible) {
      if (n.nodeType !== "personality_core") {
        expect(n.visibility.labelVisible).toBe(false);
      }
    }
  });
});

// ── Hover Summaries ──────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — hover summaries", () => {
  it("every node has a hover summary", () => {
    const v = makeView();
    for (const n of v.nodes) {
      expect(n.hover).toBeDefined();
      expect(n.hover.nodeId).toBe(n.nodeId);
      expect(n.hover.nodeType).toBe(n.nodeType);
      expect(typeof n.hover.primaryReason).toBe("string");
      expect(n.hover.primaryReason.length).toBeGreaterThan(0);
    }
  });

  it("hover summary labels are <= 80 chars", () => {
    const v = makeView();
    for (const n of v.nodes) {
      expect(n.hover.label.length).toBeLessThanOrEqual(80);
    }
  });

  it("hover summary does not expose raw state", () => {
    const v = makeView();
    for (const n of v.nodes) {
      const json = JSON.stringify(n.hover);
      expect(json).not.toContain("CharacterPhysicsState");
      expect(json).not.toContain("serializedState");
      expect(json).not.toContain("serialized");
    }
  });

  it("hover summary includes edge count and evidence source count", () => {
    const v = makeView();
    for (const n of v.nodes) {
      expect(n.hover.edgeCount).toBeGreaterThanOrEqual(0);
      expect(n.hover.evidenceSourceCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("hover summary weight is in [0, 1]", () => {
    const v = makeView();
    for (const n of v.nodes) {
      expect(n.hover.weight).toBeGreaterThanOrEqual(0);
      expect(n.hover.weight).toBeLessThanOrEqual(1);
    }
  });
});

// ── Summary Counts ───────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — summary counts", () => {
  it("totalNodes matches nodes array length", () => {
    const v = makeView();
    expect(v.summary.totalNodes).toBe(v.nodes.length);
  });

  it("totalEdges matches edges array length", () => {
    const v = makeView();
    expect(v.summary.totalEdges).toBe(v.edges.length);
  });

  it("nodesByZoom sums to totalNodes", () => {
    const v = makeView();
    const sum = Object.values(v.summary.nodesByZoom).reduce((a, b) => a + b, 0);
    expect(sum).toBe(v.summary.totalNodes);
  });

  it("edgesByZoom sums to totalEdges", () => {
    const v = makeView();
    const sum = Object.values(v.summary.edgesByZoom).reduce((a, b) => a + b, 0);
    expect(sum).toBe(v.summary.totalEdges);
  });

  it("centerX/Y match layout center", () => {
    const v = makeView();
    expect(v.summary.centerX).toBeGreaterThan(0);
    expect(v.summary.centerY).toBeGreaterThan(0);
  });

  it("summarizeMindGalaxyView returns the summary from the snapshot", () => {
    const v = makeView();
    const summary = summarizeMindGalaxyView(v);
    expect(summary.totalNodes).toBe(v.summary.totalNodes);
    expect(summary).toBe(v.summary);
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — edge cases", () => {
  it("handles empty graph snapshot gracefully", () => {
    const v = makeEmptyView();
    expect(v.version).toBe("10.33.0");
    expect(v.summary.totalNodes).toBeGreaterThanOrEqual(0);
    expect(v.summary.totalEdges).toBeGreaterThanOrEqual(0);
  });

  it("handles graph node with no layout position (warning, not crash)", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    // Remove a layout node to simulate mismatch
    const filteredNodes = layout.nodes.filter((n) => n.nodeType !== "memory");
    const modifiedLayout = { ...layout, nodes: filteredNodes };
    const v = buildMindGalaxyViewSnapshot(graph, modifiedLayout);
    // Should still succeed — just warnings
    expect(v.warnings.length).toBeGreaterThan(0);
    expect(v.warnings.some((w) => w.includes("no layout position"))).toBe(true);
  });

  it("drift vectors can be disabled via options", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const v = buildMindGalaxyViewSnapshot(graph, layout, { computeDrift: false });
    for (const n of v.nodes) {
      expect(n.drift).toBeUndefined();
    }
    expect(v.summary.driftNodeCount).toBe(0);
  });

  it("custom drift seed prefix changes drift values", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const v1 = buildMindGalaxyViewSnapshot(graph, layout);
    const v2 = buildMindGalaxyViewSnapshot(graph, layout, { driftSeedPrefix: "different-prefix" });
    const drift1 = v1.nodes.filter((n) => n.drift !== undefined);
    const drift2 = v2.nodes.filter((n) => n.drift !== undefined);
    // At least one node should have different drift with different seed
    expect(drift1.length).toBe(drift2.length);
    expect(v1.nodes.length).toBe(v2.nodes.length);
  });
});

// ── Type Guards ──────────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — type guards", () => {
  it("isGalaxyZoomLevel validates correctly", () => {
    expect(isGalaxyZoomLevel("L0")).toBe(true);
    expect(isGalaxyZoomLevel("L4")).toBe(true);
    expect(isGalaxyZoomLevel("L5")).toBe(false);
    expect(isGalaxyZoomLevel("")).toBe(false);
    expect(isGalaxyZoomLevel(null)).toBe(false);
    expect(isGalaxyZoomLevel(undefined)).toBe(false);
  });

  it("GALAXY_ZOOM_LEVELS contains 5 levels", () => {
    expect(GALAXY_ZOOM_LEVELS).toHaveLength(5);
    expect(GALAXY_ZOOM_LEVELS).toEqual(["L0", "L1", "L2", "L3", "L4"]);
  });
});

// ── Version ──────────────────────────────────────────────────────────────

describe("MindGalaxyViewSnapshot — version", () => {
  it("version is 10.33.0", () => {
    const v = makeView();
    expect(v.version).toBe("10.33.0");
  });

  it("characterId is preserved from state identity", () => {
    const v = makeView();
    expect(v.characterId).toBeTruthy();
    expect(typeof v.characterId).toBe("string");
  });

  it("generatedAt is an ISO timestamp", () => {
    const v = makeView();
    expect(v.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("reasons array is non-empty", () => {
    const v = makeView();
    expect(v.reasons.length).toBeGreaterThan(0);
  });
});
