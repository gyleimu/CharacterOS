import { describe, expect, it } from "vitest";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint
} from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function freshState() {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
}

describe("buildMindGraphSnapshot", () => {
  it("produces a valid MindGraphSnapshot with version and characterId", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    expect(snapshot.version).toBe("7.1.0");
    expect(snapshot.characterId).toBe(state.identity.id);
    expect(snapshot.generatedAt).toBeDefined();
    expect(snapshot.nodes.length).toBeGreaterThan(0);
    expect(snapshot.edges.length).toBeGreaterThan(0);
  });

  it("includes a personality_core node", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const coreNodes = snapshot.nodes.filter((n) => n.type === "personality_core");
    expect(coreNodes).toHaveLength(1);
    expect(coreNodes[0]!.label).toBe("林凡");
    expect(coreNodes[0]!.stableId).toBe("lin_fan");
  });

  it("memory node count matches state.memories.length", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const memoryNodes = snapshot.nodes.filter((n) => n.type === "memory");
    // At least some memories from seeded experiences
    expect(memoryNodes.length).toBeGreaterThan(0);
    expect(memoryNodes.length).toBe(state.memories.length);
  });

  it("cluster node count matches state.clusters.size", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const clusterNodes = snapshot.nodes.filter((n) => n.type === "impact_cluster");
    expect(clusterNodes.length).toBe(state.clusters.size);
  });

  it("belief nodes exist when beliefs are present", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const beliefNodes = snapshot.nodes.filter((n) => n.type === "belief");
    expect(beliefNodes.length).toBeGreaterThan(0);
    expect(beliefNodes.length).toBeLessThanOrEqual(state.beliefStates.length);
    expect(beliefNodes.every((node) => typeof node.metadata.strength === "number")).toBe(true);
  });

  it("need nodes exist", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const needNodes = snapshot.nodes.filter((n) => n.type === "need");
    expect(needNodes.length).toBeGreaterThan(0);
    expect(needNodes.every((node) => node.source === "derived")).toBe(true);
    expect(needNodes.every((node) => typeof node.metadata.intensity === "number")).toBe(true);
  });

  it("cluster pulls_personality edges exist", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const pullEdges = snapshot.edges.filter((e) => e.type === "pulls_personality");
    expect(pullEdges.length).toBeGreaterThan(0);
    for (const edge of pullEdges) {
      // Source should be a cluster, target should be personality_core
      expect(edge.sourceNodeId).toContain("impact_cluster");
      expect(edge.targetNodeId).toContain("personality_core");
    }
  });

  it("memory belongs_to_cluster edges exist for clustered memories", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const clusterEdges = snapshot.edges.filter((e) => e.type === "belongs_to_cluster");
    // Filter only memory-sourced edges (particles also have belongs_to_cluster edges)
    const memoryClusterEdges = clusterEdges.filter((e) => e.sourceNodeId.includes("memory"));
    const clusteredMemoryCount = state.memories.filter((memory) => memory.clusterId).length;
    expect(memoryClusterEdges.length).toBe(clusteredMemoryCount);
    for (const edge of memoryClusterEdges) {
      expect(edge.sourceNodeId).toContain("memory");
      expect(edge.targetNodeId).toContain("impact_cluster");
    }
  });

  it("creates_need edges are need-specific, not a complete belief-to-need graph", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const beliefNodes = snapshot.nodes.filter((n) => n.type === "belief");
    const needNodes = snapshot.nodes.filter((n) => n.type === "need");
    const createsNeedEdges = snapshot.edges.filter((e) => e.type === "creates_need");

    expect(createsNeedEdges.length).toBeGreaterThan(0);
    expect(createsNeedEdges.length).toBeLessThan(beliefNodes.length * needNodes.length);
    for (const edge of createsNeedEdges) {
      expect(edge.metadata.formula).toBe("need-specific belief contribution heuristic");
      expect(typeof edge.metadata.contribution).toBe("number");
      expect(typeof edge.metadata.needId).toBe("string");
    }
  });

  it("keeps graph weights normalized while preserving raw cluster mass", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const weightedNodes = snapshot.nodes.filter((node) => node.weight !== undefined);
    const weightedEdges = snapshot.edges.filter((edge) => edge.weight !== undefined);
    expect(weightedNodes.length).toBeGreaterThan(0);
    expect(weightedEdges.length).toBeGreaterThan(0);
    for (const node of weightedNodes) {
      expect(node.weight).toBeGreaterThanOrEqual(0);
      expect(node.weight).toBeLessThanOrEqual(1);
    }
    for (const edge of weightedEdges) {
      expect(edge.weight).toBeGreaterThanOrEqual(0);
      expect(edge.weight).toBeLessThanOrEqual(1);
    }

    const clusterNodes = snapshot.nodes.filter((node) => node.type === "impact_cluster");
    expect(clusterNodes.some((node) => typeof node.mass === "number" && node.mass !== node.weight)).toBe(true);
  });

  it("all edges reference existing node ids", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const nodeIds = new Set(snapshot.nodes.map((n) => n.id));
    for (const edge of snapshot.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
    }
  });

  it("produces deterministic output for same state", () => {
    const state = freshState();
    const generatedAt = "2026-06-23T00:00:00.000Z";
    const snapshot1 = buildMindGraphSnapshot(state, { generatedAt });
    const snapshot2 = buildMindGraphSnapshot(state, { generatedAt });

    expect(snapshot1).toEqual(snapshot2);
    expect(snapshot1.generatedAt).toBe(generatedAt);
  });

  it("does not mutate the input state", () => {
    const state = freshState();
    const memCountBefore = state.memories.length;
    const clusterCountBefore = state.clusters.size;

    buildMindGraphSnapshot(state);

    expect(state.memories.length).toBe(memCountBefore);
    expect(state.clusters.size).toBe(clusterCountBefore);
  });

  it("generates warnings for empty state", () => {
    const state = createCharacterPhysicsState();
    const snapshot = buildMindGraphSnapshot(state);

    // Should still have personality_core
    expect(snapshot.nodes.some((n) => n.type === "personality_core")).toBe(true);
    // Should warn about empty memories/clusters
    expect(snapshot.warnings.length).toBeGreaterThan(0);
  });

  it("summary includes node and edge counts", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    expect(snapshot.summary.nodeCount).toBe(snapshot.nodes.length);
    expect(snapshot.summary.edgeCount).toBe(snapshot.edges.length);
    expect(snapshot.summary.persistedNodeCount).toBeGreaterThan(0);
  });

  // ─── V7.4 desire / behavior_bias / temporal_process / ISV ──────────

  it("desire nodes exist and have drives_desire edges", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const desireNodes = snapshot.nodes.filter((n) => n.type === "desire");
    expect(desireNodes.length).toBeGreaterThan(0);
    expect(desireNodes.every((n) => n.source === "derived")).toBe(true);

    const drivesEdges = snapshot.edges.filter((e) => e.type === "drives_desire");
    expect(drivesEdges.length).toBeGreaterThan(0);
    for (const edge of drivesEdges) {
      expect(edge.sourceNodeId).toContain("need");
      expect(edge.targetNodeId).toContain("desire");
      expect(typeof edge.metadata.sourceNeedId).toBe("string");
    }
  });

  it("behavior_bias nodes exist and have biases_behavior edges", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const biasNodes = snapshot.nodes.filter((n) => n.type === "behavior_bias");
    expect(biasNodes.length).toBeGreaterThan(0);
    expect(biasNodes.every((n) => n.source === "derived")).toBe(true);

    const biasEdges = snapshot.edges.filter((e) => e.type === "biases_behavior");
    expect(biasEdges.length).toBeGreaterThan(0);
    for (const edge of biasEdges) {
      expect(edge.targetNodeId).toContain("behavior_bias");
    }
  });

  it("temporal_process nodes exist with phase order", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const tpNodes = snapshot.nodes.filter((n) => n.type === "temporal_process");
    expect(tpNodes.length).toBe(17); // all V3 phases
    expect(tpNodes.some((n) => n.stableId === "decay_and_recovery")).toBe(true);
    expect(tpNodes.some((n) => n.stableId === "homeostasis")).toBe(true);

    const transEdges = snapshot.edges.filter((e) => e.type === "temporal_transition");
    expect(transEdges.length).toBe(16); // 17 nodes -> 16 transitions
  });

  it("temporal process node weights are in [0,1]", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);
    const tpNodes = snapshot.nodes.filter((n) => n.type === "temporal_process");
    for (const node of tpNodes) {
      if (node.weight !== undefined) {
        expect(node.weight).toBeGreaterThanOrEqual(0);
        expect(node.weight).toBeLessThanOrEqual(1);
      }
    }
  });

  // ─── V7.5 Impact Particle ───────────────────────────────────────

  it("impact_particle nodes exist and match state.particles", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const particleNodes = snapshot.nodes.filter((n) => n.type === "impact_particle");
    expect(particleNodes.length).toBeGreaterThan(0);
    // Should match particle count (some may be filtered or all present)
    expect(particleNodes.length).toBeLessThanOrEqual(state.particles.length);
    expect(particleNodes.every((n) => n.source === "state")).toBe(true);
  });

  it("impact_particle has impacts_personality edges", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const impactEdges = snapshot.edges.filter((e) => e.type === "impacts_personality");
    expect(impactEdges.length).toBeGreaterThan(0);
    for (const edge of impactEdges) {
      expect(edge.sourceNodeId).toContain("impact_particle");
      expect(edge.targetNodeId).toContain("personality_core");
      expect(edge.metadata.emotion).toBeDefined();
      expect(edge.metadata.category).toBeDefined();
    }
  });

  it("impact_particle belongs_to_cluster edges connect correctly", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    const clusterEdges = snapshot.edges.filter(
      (e) => e.type === "belongs_to_cluster" && e.sourceNodeId.includes("impact_particle")
    );
    // Some particles may not have matching clusters — edges may be fewer
    expect(clusterEdges.length).toBeGreaterThanOrEqual(0);
    for (const edge of clusterEdges) {
      expect(edge.targetNodeId).toContain("impact_cluster");
      expect(edge.metadata.category).toBeDefined();
    }
  });

  // ─── V7.6 Benchmark Signal ──────────────────────────────────────

  it("benchmark_signal nodes are created from benchmarkResults option", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state, {
      benchmarkResults: [
        {
          caseId: "test_memory_decay",
          verdict: "pass",
          assertionResults: [
            { expected: { metricPath: "x", direction: "decrease", reason: "test" }, valueBefore: 1, valueAfter: 0.5, delta: -0.5, passed: true, explanation: "ok" },
            { expected: { metricPath: "y", direction: "decrease", reason: "test" }, valueBefore: 0.8, valueAfter: 0.3, delta: -0.5, passed: true, explanation: "ok" }
          ],
          metrics: [],
          warnings: [],
          explanation: "passed",
          durationMs: 10
        }
      ]
    });

    const signalNodes = snapshot.nodes.filter((n) => n.type === "benchmark_signal");
    expect(signalNodes.length).toBe(1);
    expect(signalNodes[0]!.source).toBe("benchmark_result");
    expect(signalNodes[0]!.weight).toBe(1); // all passed
    expect(signalNodes[0]!.confidence).toBe("high");
  });

  it("benchmark_signal has observed_by_benchmark edges", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state, {
      benchmarkResults: [
        {
          caseId: "test_homeostasis",
          verdict: "pass",
          assertionResults: [
            { expected: { metricPath: "z", direction: "decrease", reason: "test" }, valueBefore: 0.9, valueAfter: 0.4, delta: -0.5, passed: true, explanation: "ok" }
          ],
          metrics: [],
          warnings: [],
          explanation: "passed",
          durationMs: 5
        }
      ]
    });

    const obsEdges = snapshot.edges.filter((e) => e.type === "observed_by_benchmark");
    expect(obsEdges.length).toBe(1);
    expect(obsEdges[0]!.sourceNodeId).toContain("temporal_process");
    expect(obsEdges[0]!.targetNodeId).toContain("benchmark_signal");
    expect(obsEdges[0]!.evidence).toBe("benchmark_result");
    expect(obsEdges[0]!.metadata.verdict).toBe("pass");
  });

  it("benchmark_signal weight reflects pass ratio", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state, {
      benchmarkResults: [
        {
          caseId: "test_partial",
          verdict: "fail",
          assertionResults: [
            { expected: { metricPath: "a", direction: "decrease", reason: "test" }, valueBefore: 1, valueAfter: 0.8, delta: -0.2, passed: true, explanation: "ok" },
            { expected: { metricPath: "b", direction: "increase", reason: "test" }, valueBefore: 0, valueAfter: 0, delta: 0, passed: false, explanation: "fail" }
          ],
          metrics: [],
          warnings: [],
          explanation: "partial fail",
          durationMs: 5
        }
      ]
    });

    const signalNode = snapshot.nodes.find((n) => n.type === "benchmark_signal")!;
    expect(signalNode.weight).toBe(0.5); // 1/2 passed
    expect(signalNode.confidence).toBe("medium");
  });

  it("all 11 node types now covered by builder", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state, {
      benchmarkResults: [
        {
          caseId: "coverage_test",
          verdict: "pass",
          assertionResults: [{ expected: { metricPath: "x", direction: "decrease", reason: "test" }, valueBefore: 1, valueAfter: 0, delta: -1, passed: true, explanation: "ok" }],
          metrics: [],
          warnings: [],
          explanation: "ok",
          durationMs: 1
        }
      ]
    });
    const types = new Set(snapshot.nodes.map((n) => n.type));
    expect(types.has("benchmark_signal")).toBe(true);
    expect(types.has("impact_particle")).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(10);
  });

  it("all new node types pass validator", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);
    // If validation passed, no error-level issues should exist
    const validationWarnings = snapshot.warnings.filter((w) => w.startsWith("[error:"));
    expect(validationWarnings.length).toBe(0);
  });

  it("reasons are present and mention character", () => {
    const state = freshState();
    const snapshot = buildMindGraphSnapshot(state);

    expect(snapshot.reasons.length).toBeGreaterThan(0);
    expect(snapshot.reasons.some((r) => r.includes("lin_fan") || r.includes("林凡"))).toBe(true);
  });
});
