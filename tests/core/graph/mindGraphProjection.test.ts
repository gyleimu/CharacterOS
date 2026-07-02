import { describe, expect, it } from "vitest";
import {
  explainMindGraphEdges,
  buildNodeLabelMap
} from "../../../src/core/graph/mindGraphProjection";
import {
  createMindGraphNodeId,
  createMindGraphEdgeId,
  type MindGraphEdge,
  type MindGraphNode
} from "../../../src/core/graph/mindGraphTypes";

function makeNode(type: string, stableId: string): MindGraphNode {
  return {
    id: createMindGraphNodeId(type as never, stableId),
    type: type as never,
    label: `${type}:${stableId}`,
    source: "state" as never,
    stableId,
    weight: 0.5,
    metadata: {}
  };
}

function makeEdge(type: string, src: string, tgt: string, meta?: Record<string, unknown>): MindGraphEdge {
  return {
    id: createMindGraphEdgeId(type as never, src, tgt),
    type: type as never,
    sourceNodeId: src,
    targetNodeId: tgt,
    directed: true,
    weight: 0.5,
    evidence: "state" as never,
    metadata: meta ?? {}
  };
}

describe("explainMindGraphEdges", () => {
  it("produces one entry per edge", () => {
    const nodes = [makeNode("belief", "b1"), makeNode("need", "n1"), makeNode("need", "n2")];
    const edges = [
      makeEdge("creates_need", "belief:b1", "need:n1", { contribution: 0.55, formula: "need-specific" }),
      makeEdge("creates_need", "belief:b1", "need:n2", { contribution: 0.35, formula: "need-specific" })
    ];
    const labelMap = buildNodeLabelMap(nodes);
    const report = explainMindGraphEdges(edges, labelMap);

    expect(report.entries).toHaveLength(2);
    expect(report.summary).toContain("2 edges");
  });

  it("includes source and target labels", () => {
    const nodes = [makeNode("belief", "b1"), makeNode("need", "n1")];
    const edges = [makeEdge("creates_need", "belief:b1", "need:n1", { contribution: 0.55 })];
    const report = explainMindGraphEdges(edges, buildNodeLabelMap(nodes));

    expect(report.entries[0]!.sourceLabel).toBe("belief:b1");
    expect(report.entries[0]!.targetLabel).toBe("need:n1");
  });

  it("includes contribution info for creates_need edges", () => {
    const nodes = [makeNode("belief", "b1"), makeNode("need", "n1")];
    const edges = [makeEdge("creates_need", "belief:b1", "need:n1", { contribution: 0.55, formula: "need-specific" })];
    const report = explainMindGraphEdges(edges, buildNodeLabelMap(nodes));

    expect(report.entries[0]!.explanation).toContain("(contribution=0.55)");
    expect(report.entries[0]!.explanation).toContain("Formula:");
  });

  it("includes weight for weighted edges", () => {
    const nodes = [makeNode("memory", "m1"), makeNode("memory", "m2")];
    const edges = [makeEdge("belongs_to_cluster", "memory:m1", "memory:m2")];
    const report = explainMindGraphEdges(edges, buildNodeLabelMap(nodes));

    expect(report.entries[0]!.explanation).toContain("weight=0.500");
  });

  it("handles unknown edge types gracefully", () => {
    const nodes = [makeNode("memory", "m1"), makeNode("memory", "m2")];
    const edges = [{
      id: "unknown:x→y",
      type: "unknown_type" as never,
      sourceNodeId: "memory:m1",
      targetNodeId: "memory:m2",
      directed: true,
      evidence: "state" as never,
      metadata: {}
    }];
    const report = explainMindGraphEdges(edges, buildNodeLabelMap(nodes));
    expect(report.entries[0]!.explanation).toContain("unknown_type");
  });

  it("counts unique edge types in summary", () => {
    const nodes = [makeNode("belief", "b1"), makeNode("need", "n1"), makeNode("memory", "m1")];
    const edges = [
      makeEdge("creates_need", "belief:b1", "need:n1"),
      makeEdge("activates_belief", "memory:m1", "belief:b1")
    ];
    const report = explainMindGraphEdges(edges, buildNodeLabelMap(nodes));
    expect(report.summary).toContain("2 edge types");
  });
});

describe("buildNodeLabelMap", () => {
  it("maps node ids to labels", () => {
    const nodes = [
      makeNode("personality_core", "core"),
      makeNode("memory", "m1")
    ];
    const map = buildNodeLabelMap(nodes);
    expect(map.get("personality_core:core")).toBe("personality_core:core");
    expect(map.get("memory:m1")).toBe("memory:m1");
  });
});
