import { describe, expect, it } from "vitest";
import {
  validateMindGraphSnapshot,
  projectNodeRisk,
  type MindGraphValidationIssue
} from "../../../src/core/graph/mindGraphValidator";
import {
  createMindGraphNodeId,
  createMindGraphEdgeId,
  type MindGraphNode,
  type MindGraphEdge
} from "../../../src/core/graph/mindGraphTypes";
import type { MindGraphSummary } from "../../../src/core/graph/mindGraphTypes";

function n(type: string, stableId: string, overrides?: Partial<MindGraphNode>): MindGraphNode {
  return {
    id: createMindGraphNodeId(type as never, stableId),
    type: type as never,
    label: `${type}:${stableId}`,
    source: "state" as never,
    stableId,
    weight: 0.5,
    metadata: {},
    ...overrides
  };
}

function e(type: string, src: string, tgt: string, overrides?: Partial<MindGraphEdge>): MindGraphEdge {
  return {
    id: createMindGraphEdgeId(type as never, src, tgt),
    type: type as never,
    sourceNodeId: src,
    targetNodeId: tgt,
    directed: true,
    weight: 0.5,
    evidence: "state" as never,
    metadata: {},
    ...overrides
  };
}

describe("validateMindGraphSnapshot", () => {
  it("passes on a valid minimal snapshot", () => {
    const nodes = [n("personality_core", "core")];
    const edges: MindGraphEdge[] = [];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 0, nodeCountsByType: { personality_core: 1 } as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 1, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("detects duplicate node ids", () => {
    const nodes = [n("memory", "dup"), n("memory", "dup")];
    const summary: MindGraphSummary = {
      nodeCount: 2, edgeCount: 0, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 2, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges: [], summary });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "V001_DUPLICATE_NODE_ID")).toBe(true);
  });

  it("detects duplicate edge ids", () => {
    const nodes = [n("memory", "m1"), n("memory", "m2")];
    const edge = e("belongs_to_cluster", "memory:m1", "memory:m2");
    const edges = [edge, { ...edge }];
    const summary: MindGraphSummary = {
      nodeCount: 2, edgeCount: 2, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 2, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "V002_DUPLICATE_EDGE_ID")).toBe(true);
  });

  it("detects missing edge references", () => {
    const nodes = [n("memory", "m1")];
    const edges = [e("activates_belief", "memory:m1", "belief:nonexistent")];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 1, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 1, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "V004_MISSING_TARGET_NODE")).toBe(true);
  });

  it("detects node weight out of range", () => {
    const nodes = [n("memory", "m1", { weight: 1.5 })];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 0, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 1, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges: [], summary });
    expect(result.issues.some((i) => i.code === "V005_NODE_WEIGHT_OUT_OF_RANGE")).toBe(true);
  });

  it("detects edge weight out of range", () => {
    const nodes = [n("memory", "m1"), n("memory", "m2")];
    const edges = [e("belongs_to_cluster", "memory:m1", "memory:m2", { weight: -0.1 })];
    const summary: MindGraphSummary = {
      nodeCount: 2, edgeCount: 1, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 2, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.issues.some((i) => i.code === "V006_EDGE_WEIGHT_OUT_OF_RANGE")).toBe(true);
  });

  it("detects self-loops on disallowed types", () => {
    const nodes = [n("memory", "m1")];
    const edges = [e("activates_belief", "memory:m1", "memory:m1")];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 1, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 1, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.issues.some((i) => i.code === "V012_SELF_LOOP")).toBe(true);
  });

  it("allows self-loops on derived_from type", () => {
    const nodes = [n("need", "n1")];
    const edges = [e("derived_from", "need:n1", "need:n1")];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 1, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 0, derivedNodeCount: 1
    };
    const result = validateMindGraphSnapshot({ nodes, edges, summary });
    expect(result.issues.some((i) => i.code === "V012_SELF_LOOP")).toBe(false);
  });

  it("detects summary count mismatch", () => {
    const nodes = [n("memory", "m1"), n("memory", "m2")];
    const summary: MindGraphSummary = {
      nodeCount: 1, edgeCount: 0, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 1, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges: [], summary });
    expect(result.issues.some((i) => i.code === "V013_SUMMARY_NODE_COUNT_MISMATCH")).toBe(true);
  });

  it("warns on orphan nodes (non-core)", () => {
    const nodes = [n("memory", "m1"), n("personality_core", "core")];
    const summary: MindGraphSummary = {
      nodeCount: 2, edgeCount: 0, nodeCountsByType: {} as never,
      edgeCountsByType: {}, averageEdgeWeight: 0, strongEdgeCount: 0,
      persistedNodeCount: 2, derivedNodeCount: 0
    };
    const result = validateMindGraphSnapshot({ nodes, edges: [], summary });
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === "V015_ORPHAN_NODE" && i.nodeId === "memory:m1")).toBe(true);
    // personality_core should NOT trigger orphan warning
    expect(result.issues.some((i) => i.code === "V015_ORPHAN_NODE" && i.nodeId === "personality_core:core")).toBe(false);
  });
});

describe("projectNodeRisk", () => {
  it("projects high risk for high-mass cluster", () => {
    const node = n("impact_cluster", "c1", { weight: 0.8, mass: 0.8 });
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("high");
  });

  it("projects medium risk for moderate cluster", () => {
    const node = n("impact_cluster", "c1", { weight: 0.4, mass: 0.4 });
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("medium");
  });

  it("projects low risk for small cluster", () => {
    const node = n("impact_cluster", "c1", { weight: 0.1, mass: 0.1 });
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("low");
  });

  it("projects high risk for stressed personality", () => {
    const node = n("personality_core", "core", {
      metadata: { fear: 0.8, trust: 0.2 }
    });
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("high");
  });

  it("projects low risk for stable personality", () => {
    const node = n("personality_core", "core", {
      metadata: { fear: 0.2, trust: 0.8 }
    });
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("low");
  });

  it("returns low for unknown node type", () => {
    const node = n("unknown_type" as never, "x");
    const result = projectNodeRisk(node);
    expect(result.projectedRisk).toBe("low");
    expect(result.explanation).toContain("no risk heuristic");
  });
});
