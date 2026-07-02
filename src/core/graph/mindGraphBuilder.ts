/**
 * V7.2 Mind Graph Builder — builds a MindGraphSnapshot from
 * CharacterPhysicsState. First version: personality_core, memory,
 * impact_cluster, belief, need nodes + core edges.
 *
 * Graph is a state projection, not a visualization.
 * Every node and edge has a traceable evidence source.
 */

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { ImpactCluster } from "../cluster/impactCluster";
import type { BeliefState } from "../belief/beliefState";
import type { NeedDeficiency } from "../need/needDeficiency";
import { deriveNeedDeficiencies } from "../need/needDeficiency";
import { deriveDesires, type DesireState } from "../desire/desireState";
import { deriveBehaviorBiases, type BehaviorBias } from "../behavior/behaviorBias";
import { V3_TICK_PHASES } from "../temporal/v3TickPhaseMetadata";
import type { InternalStateFieldSnapshot } from "../temporal/internalStateField";
import type { BenchmarkResult } from "../benchmark/benchmarkTypes";
import { clamp01 } from "../parameters/parameterMath";
import type {
  MindGraphSnapshot,
  MindGraphNode,
  MindGraphEdge,
  MindGraphNodeType,
  MindGraphEdgeType,
  MindGraphEvidenceSource,
  MindGraphRiskLevel
} from "./mindGraphTypes";
import {
  createMindGraphNodeId,
  createMindGraphEdgeId,
  summarizeMindGraph
} from "./mindGraphTypes";
import { validateMindGraphSnapshot, projectNodeRisk } from "./mindGraphValidator";
import { explainMindGraphEdges, buildNodeLabelMap } from "./mindGraphProjection";

// ─── Options ────────────────────────────────────────────────────────────

export interface BuildMindGraphOptions {
  /** Minimum need intensity to create a need node (default 0.15). */
  minNeedIntensity?: number;
  /** Minimum belief strength to create a belief node (default 0.02). */
  minBeliefStrength?: number;
  /** Minimum desire intensity to create a desire node (default 0.15). */
  minDesireIntensity?: number;
  /** Minimum bias likelihood to create a behavior_bias node (default 0.05). */
  minBiasLikelihood?: number;
  /** Optional timestamp override for deterministic snapshot tests. */
  generatedAt?: string;
  /** Optional InternalStateField snapshot for state variable nodes. */
  internalStateField?: InternalStateFieldSnapshot;
  /** Optional V6 Benchmark results for benchmark_signal nodes. */
  benchmarkResults?: readonly BenchmarkResult[];
}

// ─── Builder ────────────────────────────────────────────────────────────

/**
 * Build a MindGraphSnapshot from a CharacterPhysicsState.
 *
 * Pure builder — does NOT mutate the input state.
 * Structurally deterministic: same state → same nodes/edges/summary.
 * generatedAt defaults to the current time unless options.generatedAt is provided.
 */
export function buildMindGraphSnapshot(
  state: CharacterPhysicsState,
  options: BuildMindGraphOptions = {}
): MindGraphSnapshot {
  const minNeedIntensity = options.minNeedIntensity ?? 0.15;
  const minBeliefStrength = options.minBeliefStrength ?? 0.02;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const characterId = state.identity.id;
  const warnings: string[] = [];
  const reasons: string[] = [];

  const nodes: MindGraphNode[] = [];
  const edges: MindGraphEdge[] = [];

  // ─── 1. Personality core (always present) ──────────────────────────
  const coreNode = buildPersonalityCoreNode(state);
  nodes.push(coreNode);

  // ─── 2. Memory nodes ──────────────────────────────────────────────
  for (const memory of state.memories) {
    const node = buildMemoryNode(memory);
    nodes.push(node);
  }

  // ─── 3. Impact cluster nodes ──────────────────────────────────────
  const clusterNodes: { cluster: ImpactCluster; node: MindGraphNode }[] = [];
  for (const cluster of state.clusters.values()) {
    const node = buildClusterNode(cluster);
    nodes.push(node);
    clusterNodes.push({ cluster, node });
  }

  // ─── 4. Impact particle nodes ────────────────────────────────────
  const particleNodes: MindGraphNode[] = [];
  for (const particle of state.particles) {
    const node = buildImpactParticleNode(particle);
    nodes.push(node);
    particleNodes.push(node);

    // impacts_personality: particle → personality_core
    edges.push({
      id: createMindGraphEdgeId("impacts_personality", node.id, coreNode.id),
      type: "impacts_personality",
      sourceNodeId: node.id,
      targetNodeId: coreNode.id,
      directed: true,
      weight: clamp01(particle.impactScore),
      evidence: "state",
      metadata: { particleId: particle.id, emotion: particle.emotion, category: particle.category }
    });

    // belongs_to_cluster: particle → cluster (if its cluster exists)
    const particleClusterId = `cluster_${particle.category}`;
    const clusterNode = clusterNodes.find((cn) => cn.cluster.id === particleClusterId)?.node;
    if (clusterNode) {
      edges.push({
        id: createMindGraphEdgeId("belongs_to_cluster", node.id, clusterNode.id),
        type: "belongs_to_cluster",
        sourceNodeId: node.id,
        targetNodeId: clusterNode.id,
        directed: true,
        weight: clamp01(particle.impactScore),
        evidence: "state",
        metadata: { particleId: particle.id, category: particle.category }
      });
    }
  }

  // ─── 5. Cluster → personality edges ──────────────────────────────
  for (const { node: clusterNode } of clusterNodes) {
    edges.push({
      id: createMindGraphEdgeId("pulls_personality", clusterNode.id, coreNode.id),
      type: "pulls_personality",
      sourceNodeId: clusterNode.id,
      targetNodeId: coreNode.id,
      directed: true,
      weight: clusterNode.weight ?? 0,
      evidence: "state",
      metadata: { clusterId: clusterNode.stableId }
    });
  }

  // ─── 5. Memory belongs_to_cluster edges ───────────────────────────
  for (const memory of state.memories) {
    if (memory.clusterId) {
      const clusterNode = nodes.find((n) => n.type === "impact_cluster" && n.stableId === memory.clusterId);
      if (clusterNode) {
        const memId = createMindGraphNodeId("memory", memory.id);
        edges.push({
          id: createMindGraphEdgeId("belongs_to_cluster", memId, clusterNode.id),
          type: "belongs_to_cluster",
          sourceNodeId: memId,
          targetNodeId: clusterNode.id,
          directed: true,
          weight: memory.recency * memory.importance,
          evidence: "state",
          metadata: { memoryId: memory.id }
        });
      }
    }
  }

  // ─── 6. Belief nodes ──────────────────────────────────────────────
  const beliefsForEdges: BeliefState[] = [];
  for (const belief of state.beliefStates) {
    if (belief.strength >= minBeliefStrength) {
      const node = buildBeliefNode(belief);
      nodes.push(node);
      beliefsForEdges.push(belief);
    }
  }

  // ─── 7. Belief derived_from memory edges ──────────────────────────
  for (const belief of beliefsForEdges) {
    const beliefId = createMindGraphNodeId("belief", belief.id);
    for (const memoryId of belief.sourceMemoryIds) {
      const memNodeId = createMindGraphNodeId("memory", memoryId);
      const memExists = nodes.some((n) => n.id === memNodeId);
      if (memExists) {
        edges.push({
          id: createMindGraphEdgeId("activates_belief", memNodeId, beliefId),
          type: "activates_belief",
          sourceNodeId: memNodeId,
          targetNodeId: beliefId,
          directed: true,
          weight: belief.strength,
          evidence: "state",
          metadata: { beliefId: belief.id }
        });
      }
    }
  }

  // ─── 8. Need nodes (derived) ──────────────────────────────────────
  const needs = deriveNeedDeficiencies({
    coordinate: state.coordinate,
    beliefs: state.beliefStates,
    clusters: [...state.clusters.values()]
  });

  const needNodes: { need: NeedDeficiency; node: MindGraphNode }[] = [];
  for (const need of needs) {
    if (need.intensity >= minNeedIntensity) {
      const node = buildNeedNode(need);
      nodes.push(node);
      needNodes.push({ need, node });
      edges.push({
        id: createMindGraphEdgeId("derived_from", node.id, coreNode.id),
        type: "derived_from",
        sourceNodeId: node.id,
        targetNodeId: coreNode.id,
        directed: false,
        weight: need.intensity,
        evidence: "derived",
        metadata: { needId: need.id }
      });
    }
  }

  // ─── 9. Belief creates_need edges ─────────────────────────────────
  for (const belief of beliefsForEdges) {
    const beliefId = createMindGraphNodeId("belief", belief.id);
    for (const { node: needNode } of needNodes) {
      const contribution = beliefNeedContribution(belief, needNode.stableId);
      if (contribution <= 0) continue;
      edges.push({
        id: createMindGraphEdgeId("creates_need", beliefId, needNode.id),
        type: "creates_need",
        sourceNodeId: beliefId,
        targetNodeId: needNode.id,
        directed: true,
        weight: clamp01(belief.strength * contribution),
        evidence: "derived",
        metadata: {
          beliefId: belief.id,
          needId: needNode.stableId,
          contribution,
          formula: "need-specific belief contribution heuristic"
        }
      });
    }
  }

  // ─── 10. Desire nodes (derived from needs) ──────────────────────────
  const minDesireIntensity = options.minDesireIntensity ?? 0.15;
  const desires = deriveDesires(needs);
  const desireNodes: { desire: DesireState; node: MindGraphNode }[] = [];
  for (const desire of desires) {
    if (desire.intensity >= minDesireIntensity) {
      const node = buildDesireNode(desire);
      nodes.push(node);
      desireNodes.push({ desire, node });
      // drives_desire: need -> desire
      const needNodeId = createMindGraphNodeId("need", desire.sourceNeedId);
      edges.push({
        id: createMindGraphEdgeId("drives_desire", needNodeId, node.id),
        type: "drives_desire",
        sourceNodeId: needNodeId,
        targetNodeId: node.id,
        directed: true,
        weight: desire.intensity,
        evidence: "derived",
        metadata: { desireId: desire.id, sourceNeedId: desire.sourceNeedId }
      });
    }
  }

  // ─── 11. Behavior bias nodes (derived from desires) ──────────────────
  const minBiasLikelihood = options.minBiasLikelihood ?? 0.05;
  const biases = deriveBehaviorBiases({
    coordinate: state.coordinate,
    desires
  });
  const biasNodes: { bias: BehaviorBias; node: MindGraphNode }[] = [];
  for (const bias of biases) {
    if (bias.likelihood >= minBiasLikelihood) {
      const node = buildBehaviorBiasNode(bias);
      nodes.push(node);
      biasNodes.push({ bias, node });
      // biases_behavior: desire -> behavior_bias (via top desire)
      if (desireNodes.length > 0) {
        const topDesireId = desireNodes[0]!.node.id;
        edges.push({
          id: createMindGraphEdgeId("biases_behavior", topDesireId, node.id),
          type: "biases_behavior",
          sourceNodeId: topDesireId,
          targetNodeId: node.id,
          directed: true,
          weight: bias.likelihood,
          evidence: "derived",
          metadata: { biasId: bias.id, tendency: bias.tendency }
        });
      }
    }
  }

  // ─── 12. Temporal process nodes (from registry metadata) ────────────
  const temporalNodes: MindGraphNode[] = [];
  for (const phase of V3_TICK_PHASES) {
    const node = buildTemporalProcessNode(phase);
    nodes.push(node);
    temporalNodes.push(node);
  }
  // temporal_transition edges: phase N -> phase N+1
  for (let i = 0; i < temporalNodes.length - 1; i++) {
    const src = temporalNodes[i]!;
    const tgt = temporalNodes[i + 1]!;
    edges.push({
      id: createMindGraphEdgeId("temporal_transition", src.id, tgt.id),
      type: "temporal_transition",
      sourceNodeId: src.id,
      targetNodeId: tgt.id,
      directed: true,
      weight: 1,
      evidence: "derived",
      metadata: { phaseOrder: `${i + 1} → ${i + 2}` }
    });
  }

  // ─── 13. Internal state variable nodes (optional) ────────────────────
  const isvNodes: MindGraphNode[] = [];
  if (options.internalStateField) {
    for (const v of options.internalStateField.variables) {
      const node = buildInternalStateVariableNode(v);
      nodes.push(node);
      isvNodes.push(node);
      // derived_from: ISV -> personality_core
      edges.push({
        id: createMindGraphEdgeId("derived_from", node.id, coreNode.id),
        type: "derived_from",
        sourceNodeId: node.id,
        targetNodeId: coreNode.id,
        directed: false,
        weight: v.homeostaticPressure,
        evidence: "derived",
        metadata: { variableId: v.id, domain: v.domain, pressure: v.homeostaticPressure }
      });
    }
  }

  // ─── 14. Benchmark signal nodes (observational layer) ──────────────
  if (options.benchmarkResults && options.benchmarkResults.length > 0) {
    for (const result of options.benchmarkResults) {
      const node = buildBenchmarkSignalNode(result);
      nodes.push(node);
      // observed_by_benchmark: temporal_process → benchmark_signal
      // Connect to the most relevant temporal process node
      // For now, connect to the decay_and_recovery process as it covers
      // the primary benchmarked subprocesses (memory_decay, boundary_recovery)
      const tpId = createMindGraphNodeId("temporal_process", "decay_and_recovery");
      edges.push({
        id: createMindGraphEdgeId("observed_by_benchmark", tpId, node.id),
        type: "observed_by_benchmark",
        sourceNodeId: tpId,
        targetNodeId: node.id,
        directed: true,
        weight: result.assertionResults.length > 0
          ? (result.assertionResults.filter((a) => a.passed).length / result.assertionResults.length)
          : 0,
        evidence: "benchmark_result",
        metadata: {
          caseId: result.caseId,
          verdict: result.verdict,
          durationMs: result.durationMs,
          passedAssertions: result.assertionResults.filter((a) => a.passed).length,
          totalAssertions: result.assertionResults.length
        }
      });
    }
  }

  // ─── 15. Warnings ─────────────────────────────────────────────────
  if (state.memories.length === 0) {
    warnings.push("No memory nodes — state has zero memories.");
  }
  if (clusterNodes.length === 0) {
    warnings.push("No impact cluster nodes — state.clusters is empty.");
  }
  if (beliefsForEdges.length === 0) {
    warnings.push("No belief nodes above minimum strength threshold.");
  }
  if (needNodes.length === 0) {
    warnings.push("No need nodes above minimum intensity threshold.");
  }

  // ─── 11. Orphan check ─────────────────────────────────────────────
  const nodeIds = new Set(nodes.map((n) => n.id));
  const orphanWarnings: string[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      orphanWarnings.push(`Edge "${edge.id}" references missing source node "${edge.sourceNodeId}"`);
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      orphanWarnings.push(`Edge "${edge.id}" references missing target node "${edge.targetNodeId}"`);
    }
  }
  if (orphanWarnings.length > 0) {
    warnings.push(...orphanWarnings);
  }

  // ─── 12. Node-specific risk projection ──────────────────────────────
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.risk === undefined || node.risk === "low") {
      const projected = projectNodeRisk(node);
      if (projected.projectedRisk !== "low" && projected.projectedRisk !== undefined) {
        nodes[i] = {
          ...node,
          risk: projected.projectedRisk as MindGraphRiskLevel,
          metadata: { ...node.metadata, riskExplanation: projected.explanation }
        };
      }
    }
  }

  // ─── 13. Build and validate snapshot ────────────────────────────────
  const summary = summarizeMindGraph({ nodes, edges });
  const snapshot: MindGraphSnapshot = {
    version: "7.1.0",
    characterId,
    generatedAt,
    nodes,
    edges,
    summary,
    warnings,
    reasons: [
      `Mind Graph for character "${characterId}" generated from ${nodes.length} nodes and ${edges.length} edges.`,
      `Personality core: trust=${state.coordinate.values.trust.toFixed(2)}, fear=${state.coordinate.values.fear.toFixed(2)}.`,
      `Graph is a state projection — every node and edge has a traceable evidence source.`,
      `Validation: see issues array for integrity check results.`
    ]
  };

  // Run structural validator
  const validation = validateMindGraphSnapshot(snapshot);
  if (!validation.valid || validation.warningCount > 0) {
    for (const issue of validation.issues) {
      warnings.push(`[${issue.severity}:${issue.code}] ${issue.message}`);
    }
  }

  return snapshot;
}

// ─── Node builders ──────────────────────────────────────────────────────

function buildPersonalityCoreNode(state: CharacterPhysicsState): MindGraphNode {
  const coord = state.coordinate;
  const mass = Object.values(coord.values).reduce((s, v) => s + v, 0) / Object.keys(coord.values).length;
  return {
    id: createMindGraphNodeId("personality_core", state.identity.id),
    type: "personality_core",
    label: state.identity.name,
    source: "state",
    stableId: state.identity.id,
    weight: mass,
    mass,
    risk: mass > 0.6 ? "medium" : "low",
    metadata: {
      trust: coord.values.trust,
      fear: coord.values.fear,
      attachment: coord.values.attachment,
      neuroticism: coord.values.neuroticism,
      control: coord.values.control
    }
  };
}

function buildImpactParticleNode(particle: {
  id: string; description: string; impactScore: number; emotion: string; category: string;
}): MindGraphNode {
  return {
    id: createMindGraphNodeId("impact_particle", particle.id),
    type: "impact_particle",
    label: particle.description.length > 60 ? particle.description.slice(0, 57) + "..." : particle.description,
    source: "state",
    stableId: particle.id,
    weight: clamp01(particle.impactScore),
    mass: particle.impactScore,
    risk: particle.impactScore > 0.5 ? "high" : particle.impactScore > 0.3 ? "medium" : "low",
    metadata: {
      impactScore: particle.impactScore,
      emotion: particle.emotion,
      category: particle.category
    }
  };
}

function buildMemoryNode(memory: { id: string; content: string; recency: number; importance: number; emotion: string; clusterId?: string }): MindGraphNode {
  const weight = memory.recency * memory.importance;
  return {
    id: createMindGraphNodeId("memory", memory.id),
    type: "memory",
    label: memory.content.length > 60 ? memory.content.slice(0, 57) + "..." : memory.content,
    source: "state",
    stableId: memory.id,
    weight,
    mass: weight,
    risk: memory.recency < 0.2 ? "low" : "medium",
    metadata: {
      recency: memory.recency,
      importance: memory.importance,
      emotion: memory.emotion,
      ...(memory.clusterId ? { clusterId: memory.clusterId } : {})
    }
  };
}

function buildClusterNode(cluster: ImpactCluster): MindGraphNode {
  return {
    id: createMindGraphNodeId("impact_cluster", cluster.id),
    type: "impact_cluster",
    label: cluster.category,
    source: "state",
    stableId: cluster.id,
    weight: clusterNodeWeight(cluster),
    mass: cluster.mass,
    risk: cluster.mass > 0.5 ? "high" : cluster.mass > 0.3 ? "medium" : "low",
    metadata: {
      category: cluster.category,
      density: cluster.density,
      stability: cluster.stability,
      age: cluster.age,
      particleCount: cluster.particleIds.length
    }
  };
}

function buildBeliefNode(belief: BeliefState): MindGraphNode {
  return {
    id: createMindGraphNodeId("belief", belief.id),
    type: "belief",
    label: belief.content,
    source: "state",
    stableId: belief.id,
    weight: belief.strength,
    mass: belief.strength,
    risk: belief.strength > 0.5 ? "medium" : "low",
    metadata: {
      strength: belief.strength,
      evidenceCount: belief.evidenceCount,
      sourceMemoryCount: belief.sourceMemoryIds.length
    }
  };
}

function buildNeedNode(need: NeedDeficiency): MindGraphNode {
  return {
    id: createMindGraphNodeId("need", need.id),
    type: "need",
    label: need.name,
    source: "derived",
    stableId: need.id,
    weight: need.intensity,
    mass: need.intensity,
    risk: need.intensity > 0.5 ? "high" : need.intensity > 0.3 ? "medium" : "low",
    metadata: {
      intensity: need.intensity,
      reason: need.reason
    }
  };
}

function buildDesireNode(desire: DesireState): MindGraphNode {
  return {
    id: createMindGraphNodeId("desire", desire.id),
    type: "desire",
    label: desire.content,
    source: "derived",
    stableId: desire.id,
    weight: desire.intensity,
    mass: desire.intensity,
    risk: desire.intensity > 0.5 ? "high" : desire.intensity > 0.3 ? "medium" : "low",
    metadata: {
      intensity: desire.intensity,
      sourceNeedId: desire.sourceNeedId
    }
  };
}

function buildBehaviorBiasNode(bias: BehaviorBias): MindGraphNode {
  return {
    id: createMindGraphNodeId("behavior_bias", bias.id),
    type: "behavior_bias",
    label: bias.tendency,
    source: "derived",
    stableId: bias.id,
    weight: bias.likelihood,
    mass: bias.likelihood,
    risk: bias.likelihood > 0.6 ? "high" : bias.likelihood > 0.35 ? "medium" : "low",
    metadata: {
      likelihood: bias.likelihood,
      rationale: bias.rationale,
      tendency: bias.tendency
    }
  };
}

function buildTemporalProcessNode(phase: {
  id: string; label: string; reads: readonly string[];
  writes: readonly string[]; phase: number;
}): MindGraphNode {
  return {
    id: createMindGraphNodeId("temporal_process", phase.id),
    type: "temporal_process",
    label: phase.label,
    source: "derived",
    stableId: phase.id,
    weight: clamp01(phase.writes.length / 10),
    mass: phase.writes.length,
    risk: "low",
    metadata: {
      processId: phase.id,
      phaseNumber: phase.phase,
      reads: [...phase.reads],
      writes: [...phase.writes]
    }
  };
}

function buildInternalStateVariableNode(v: {
  id: string; label: string; domain: string;
  currentValue: number; homeostaticPressure: number;
  deviationFromBaseline?: number;
}): MindGraphNode {
  return {
    id: createMindGraphNodeId("internal_state_variable", v.id),
    type: "internal_state_variable",
    label: v.label,
    source: "derived",
    stableId: v.id,
    weight: v.currentValue,
    mass: v.homeostaticPressure,
    risk: v.homeostaticPressure > 0.5 ? "high" : v.homeostaticPressure > 0.3 ? "medium" : "low",
    metadata: {
      domain: v.domain,
      currentValue: v.currentValue,
      homeostaticPressure: v.homeostaticPressure,
      ...(v.deviationFromBaseline !== undefined ? { deviationFromBaseline: v.deviationFromBaseline } : {})
    }
  };
}

function buildBenchmarkSignalNode(result: BenchmarkResult): MindGraphNode {
  const passedRatio = result.assertionResults.length > 0
    ? result.assertionResults.filter((a) => a.passed).length / result.assertionResults.length
    : 0;
  return {
    id: createMindGraphNodeId("benchmark_signal", result.caseId),
    type: "benchmark_signal",
    label: result.caseId,
    source: "benchmark_result",
    stableId: result.caseId,
    weight: passedRatio,
    mass: passedRatio,
    confidence: result.verdict === "pass" ? "high" : result.verdict === "fail" ? "medium" : "low",
    risk: result.verdict === "pass" ? "low" : result.verdict === "fail" ? "medium" : "high",
    metadata: {
      verdict: result.verdict,
      passedAssertions: result.assertionResults.filter((a) => a.passed).length,
      totalAssertions: result.assertionResults.length,
      durationMs: result.durationMs
    }
  };
}

function clusterNodeWeight(cluster: ImpactCluster): number {
  return clamp01(cluster.stability * 0.5 + cluster.density * 0.25 + Math.min(1, cluster.mass / 3) * 0.25);
}

function beliefNeedContribution(belief: BeliefState, needId: string): number {
  const content = belief.content;
  if (needId === "need_security") {
    return includesAny(content, ["离开", "等待", "抛弃", "不可靠", "失联"]) ? 0.55 : 0;
  }
  if (needId === "need_trust") {
    return includesAny(content, ["不可靠", "背叛", "失联", "离开"]) ? 0.5 : 0;
  }
  if (needId === "need_attachment") {
    return includesAny(content, ["靠近", "真正", "王雪", "被爱", "离开"]) ? 0.45 : 0;
  }
  if (needId === "need_control") {
    return includesAny(content, ["等待", "没有结果", "突然", "不确定"]) ? 0.35 : 0;
  }
  return 0;
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}
