import { describe, expect, it } from "vitest";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint
} from "../../../src/core/character/characterBlueprint";
import type { MindGraphSnapshot } from "../../../src/core/graph/mindGraphTypes";

function freshSnapshot(): MindGraphSnapshot {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
  return buildMindGraphSnapshot(state);
}

describe("buildGraphLayoutSnapshot", () => {
  it("produces a valid layout snapshot from a graph snapshot", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    expect(layout.version).toBe("8.1.0");
    expect(layout.characterId).toBe(graph.characterId);
    expect(layout.nodes.length).toBe(graph.nodes.length);
    expect(layout.edges.length).toBe(graph.edges.length);
  });

  it("places personality_core at center", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);
    const core = layout.nodes.find((n) => n.nodeType === "personality_core")!;

    expect(core.position.x).toBe(layout.summary.centerPosition.x);
    expect(core.position.y).toBe(layout.summary.centerPosition.y);
    expect(core.zIndex).toBeGreaterThan(50);
  });

  it("assigns different positions to different node types", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    const core = layout.nodes.find((n) => n.nodeType === "personality_core")!;
    const memory = layout.nodes.find((n) => n.nodeType === "memory")!;
    if (memory) {
      // Memory should be offset from center
      const dx = memory.position.x - core.position.x;
      const dy = memory.position.y - core.position.y;
      expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(10);
    }
  });

  it("assigns different sizes to different node types", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    const core = layout.nodes.find((n) => n.nodeType === "personality_core")!;
    const memory = layout.nodes.find((n) => n.nodeType === "memory")!;
    if (memory) {
      expect(core.size.radius).toBeGreaterThan(memory.size.radius);
    }
  });

  it("each node has a valid color", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    for (const node of layout.nodes) {
      expect(node.style.fill).toBeDefined();
      expect(node.style.fill.length).toBeGreaterThan(0);
      expect(node.style.opacity).toBeGreaterThan(0);
      expect(node.nodeType).toBeDefined();
    }
  });

  it("each edge has a valid style", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    for (const edge of layout.edges) {
      expect(edge.style.stroke).toBeDefined();
      expect(edge.style.strokeWidth).toBeGreaterThan(0);
    }
  });

  it("layout is deterministic for same input", () => {
    const graph = freshSnapshot();
    const layout1 = buildGraphLayoutSnapshot(graph);
    const layout2 = buildGraphLayoutSnapshot(graph);

    expect(layout1.nodes.length).toBe(layout2.nodes.length);
    expect(layout1.edges.length).toBe(layout2.edges.length);
    // Positions should be identical (based on node ids)
    for (let i = 0; i < layout1.nodes.length; i++) {
      expect(layout1.nodes[i]!.position).toEqual(layout2.nodes[i]!.position);
    }
  });

  it("custom viewport size is respected", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph, { viewportWidth: 800, viewportHeight: 600 });

    expect(layout.summary.centerPosition.x).toBe(400);
    expect(layout.summary.centerPosition.y).toBe(300);
  });

  it("summary includes layout strategy info", () => {
    const graph = freshSnapshot();
    const layout = buildGraphLayoutSnapshot(graph);

    expect(layout.summary.layoutStrategy).toContain("cluster-anchored");
    expect(layout.summary.centerPosition).toBeDefined();
    expect(layout.reasons.length).toBeGreaterThan(0);
  });
});
