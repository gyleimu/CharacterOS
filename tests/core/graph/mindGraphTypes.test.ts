import { describe, expect, it } from "vitest";
import {
  MIND_GRAPH_NODE_TYPES,
  MIND_GRAPH_EDGE_TYPES,
  MIND_GRAPH_EVIDENCE_SOURCES,
  isMindGraphNodeType,
  isMindGraphEdgeType,
  createMindGraphNodeId,
  createMindGraphEdgeId,
  summarizeMindGraph,
  type MindGraphNode,
  type MindGraphEdge,
  type MindGraphNodeType,
  type MindGraphEdgeType,
  type MindGraphEvidenceSource,
  type MindGraphSnapshot
} from "../../../src/core/graph/mindGraphTypes";

function makeNode(
  type: MindGraphNodeType,
  stableId: string,
  overrides?: Partial<MindGraphNode>
): MindGraphNode {
  return {
    id: createMindGraphNodeId(type, stableId),
    type,
    label: `${type}:${stableId}`,
    source: "state" as MindGraphEvidenceSource,
    stableId,
    weight: 0.5,
    metadata: {},
    ...overrides
  };
}

function makeEdge(
  type: MindGraphEdgeType,
  sourceId: string,
  targetId: string,
  overrides?: Partial<MindGraphEdge>
): MindGraphEdge {
  return {
    id: createMindGraphEdgeId(type, sourceId, targetId),
    type,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    directed: true,
    weight: 0.7,
    evidence: "state" as MindGraphEvidenceSource,
    metadata: {},
    ...overrides
  };
}

describe("MindGraph types — constants", () => {
  it("has 11 node types", () => {
    expect(MIND_GRAPH_NODE_TYPES).toHaveLength(11);
    expect(MIND_GRAPH_NODE_TYPES).toContain("personality_core");
    expect(MIND_GRAPH_NODE_TYPES).toContain("memory");
    expect(MIND_GRAPH_NODE_TYPES).toContain("benchmark_signal");
  });

  it("has 14 edge types", () => {
    expect(MIND_GRAPH_EDGE_TYPES).toHaveLength(14);
    expect(MIND_GRAPH_EDGE_TYPES).toContain("belongs_to_cluster");
    expect(MIND_GRAPH_EDGE_TYPES).toContain("decays_to");
    expect(MIND_GRAPH_EDGE_TYPES).toContain("derived_from");
  });

  it("has 5 evidence sources", () => {
    expect(MIND_GRAPH_EVIDENCE_SOURCES).toHaveLength(5);
    expect(MIND_GRAPH_EVIDENCE_SOURCES).toContain("state");
    expect(MIND_GRAPH_EVIDENCE_SOURCES).toContain("benchmark_result");
  });
});

describe("isMindGraphNodeType", () => {
  it("returns true for valid types", () => {
    expect(isMindGraphNodeType("personality_core")).toBe(true);
    expect(isMindGraphNodeType("memory")).toBe(true);
    expect(isMindGraphNodeType("benchmark_signal")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isMindGraphNodeType("galaxy")).toBe(false);
    expect(isMindGraphNodeType("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isMindGraphNodeType(42)).toBe(false);
    expect(isMindGraphNodeType(null)).toBe(false);
  });
});

describe("isMindGraphEdgeType", () => {
  it("returns true for valid types", () => {
    expect(isMindGraphEdgeType("belongs_to_cluster")).toBe(true);
    expect(isMindGraphEdgeType("decays_to")).toBe(true);
    expect(isMindGraphEdgeType("derived_from")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isMindGraphEdgeType("friends_with")).toBe(false);
    expect(isMindGraphEdgeType("")).toBe(false);
  });
});

describe("createMindGraphNodeId", () => {
  it("produces deterministic id", () => {
    const id1 = createMindGraphNodeId("memory", "mem_001");
    const id2 = createMindGraphNodeId("memory", "mem_001");
    expect(id1).toBe(id2);
  });

  it("includes type and stableId", () => {
    const id = createMindGraphNodeId("belief", "belief_trust_issue");
    expect(id).toContain("belief");
    expect(id).toContain("belief_trust_issue");
  });

  it("produces different ids for different types", () => {
    const a = createMindGraphNodeId("memory", "x");
    const b = createMindGraphNodeId("belief", "x");
    expect(a).not.toBe(b);
  });

  it("produces different ids for different stableIds", () => {
    const a = createMindGraphNodeId("memory", "a");
    const b = createMindGraphNodeId("memory", "b");
    expect(a).not.toBe(b);
  });
});

describe("createMindGraphEdgeId", () => {
  it("produces deterministic id", () => {
    const id1 = createMindGraphEdgeId("activates_belief", "n1", "n2");
    const id2 = createMindGraphEdgeId("activates_belief", "n1", "n2");
    expect(id1).toBe(id2);
  });

  it("includes type, source, and target", () => {
    const id = createMindGraphEdgeId("drives_desire", "need_x", "desire_y");
    expect(id).toContain("drives_desire");
    expect(id).toContain("need_x");
    expect(id).toContain("desire_y");
  });

  it("produces different ids for reversed direction", () => {
    const a = createMindGraphEdgeId("impacts_personality", "n1", "n2");
    const b = createMindGraphEdgeId("impacts_personality", "n2", "n1");
    expect(a).not.toBe(b);
  });
});

describe("summarizeMindGraph", () => {
  it("counts nodes and edges correctly", () => {
    const nodes = [
      makeNode("personality_core", "core"),
      makeNode("memory", "m1"),
      makeNode("memory", "m2")
    ];
    const edges = [
      makeEdge("clusters_around", "memory:m1", "impact_cluster:abandonment"),
      makeEdge("clusters_around", "memory:m2", "impact_cluster:abandonment")
    ];
    const summary = summarizeMindGraph({ nodes, edges });

    expect(summary.nodeCount).toBe(3);
    expect(summary.edgeCount).toBe(2);
  });

  it("counts nodes by type correctly", () => {
    const nodes = [
      makeNode("personality_core", "core"),
      makeNode("memory", "m1"),
      makeNode("memory", "m2"),
      makeNode("belief", "b1")
    ];
    const summary = summarizeMindGraph({ nodes, edges: [] });

    expect(summary.nodeCountsByType.personality_core).toBe(1);
    expect(summary.nodeCountsByType.memory).toBe(2);
    expect(summary.nodeCountsByType.belief).toBe(1);
    expect(summary.nodeCountsByType.need).toBe(0);
  });

  it("counts edges by type correctly", () => {
    const edges = [
      makeEdge("clusters_around", "a", "b"),
      makeEdge("clusters_around", "c", "d"),
      makeEdge("activates_belief", "e", "f")
    ];
    const summary = summarizeMindGraph({ nodes: [], edges });

    expect(summary.edgeCountsByType.clusters_around).toBe(2);
    expect(summary.edgeCountsByType.activates_belief).toBe(1);
  });

  it("computes average edge weight from weighted edges only", () => {
    const unweightedEdge = makeEdge("derived_from", "e", "f");
    delete unweightedEdge.weight;
    const edges = [
      makeEdge("clusters_around", "a", "b", { weight: 0.5 }),
      makeEdge("activates_belief", "c", "d", { weight: 0.9 }),
      unweightedEdge
    ];
    const summary = summarizeMindGraph({ nodes: [], edges });

    expect(summary.averageEdgeWeight).toBeCloseTo(0.7);
    expect(summary.edgeCount).toBe(3);
  });

  it("counts strong edges (weight >= 0.8)", () => {
    const edges = [
      makeEdge("clusters_around", "a", "b", { weight: 0.5 }),
      makeEdge("activates_belief", "c", "d", { weight: 0.9 }),
      makeEdge("pulls_personality", "e", "f", { weight: 0.85 })
    ];
    const summary = summarizeMindGraph({ nodes: [], edges });

    expect(summary.strongEdgeCount).toBe(2);
  });

  it("counts persisted vs derived nodes", () => {
    const nodes = [
      makeNode("memory", "m1", { source: "state" }),
      makeNode("belief", "b1", { source: "state" }),
      makeNode("need", "n1", { source: "derived" }),
      makeNode("desire", "d1", { source: "derived" })
    ];
    const summary = summarizeMindGraph({ nodes, edges: [] });

    expect(summary.persistedNodeCount).toBe(2);
    expect(summary.derivedNodeCount).toBe(2);
  });

  it("handles empty graph", () => {
    const summary = summarizeMindGraph({ nodes: [], edges: [] });

    expect(summary.nodeCount).toBe(0);
    expect(summary.edgeCount).toBe(0);
    expect(summary.averageEdgeWeight).toBe(0);
    expect(summary.strongEdgeCount).toBe(0);
    expect(summary.persistedNodeCount).toBe(0);
    expect(summary.derivedNodeCount).toBe(0);
  });

  it("does not mutate input", () => {
    const nodes = [makeNode("memory", "m1")];
    const edges = [makeEdge("activates_belief", "a", "b")];
    const nodesCopy = [...nodes];
    const edgesCopy = [...edges];

    summarizeMindGraph({ nodes, edges });

    expect(nodes.length).toBe(nodesCopy.length);
    expect(edges.length).toBe(edgesCopy.length);
    expect(nodes[0]!.id).toBe(nodesCopy[0]!.id);
  });
});
