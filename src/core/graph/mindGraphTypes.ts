/**
 * V7.1 Mind Graph Types — minimal type system for the Mind Graph data model.
 *
 * Graph nodes and edges project CharacterPhysicsState into a structured,
 * interpretable graph. Every node and edge must have a traceable evidence
 * source from state, trace, or benchmark result.
 *
 * DESIGN ONLY — no builder, no API, no viewer.
 */

// ─── Node types ────────────────────────────────────────────────────────

export const MIND_GRAPH_NODE_TYPES = [
  "personality_core",
  "memory",
  "impact_particle",
  "impact_cluster",
  "belief",
  "need",
  "desire",
  "behavior_bias",
  "temporal_process",
  "internal_state_variable",
  "benchmark_signal"
] as const;

export type MindGraphNodeType = (typeof MIND_GRAPH_NODE_TYPES)[number];

/** Type guard for MindGraphNodeType. */
export function isMindGraphNodeType(value: unknown): value is MindGraphNodeType {
  return typeof value === "string" && MIND_GRAPH_NODE_TYPES.includes(value as MindGraphNodeType);
}

// ─── Edge types ────────────────────────────────────────────────────────

export const MIND_GRAPH_EDGE_TYPES = [
  "belongs_to_cluster",
  "clusters_around",
  "impacts_personality",
  "pulls_personality",
  "activates_belief",
  "reinforces_belief",
  "creates_need",
  "drives_desire",
  "biases_behavior",
  "regulated_by_homeostasis",
  "observed_by_benchmark",
  "temporal_transition",
  "decays_to",
  "derived_from"
] as const;

export type MindGraphEdgeType = (typeof MIND_GRAPH_EDGE_TYPES)[number];

/** Type guard for MindGraphEdgeType. */
export function isMindGraphEdgeType(value: unknown): value is MindGraphEdgeType {
  return typeof value === "string" && MIND_GRAPH_EDGE_TYPES.includes(value as MindGraphEdgeType);
}

// ─── Evidence source ───────────────────────────────────────────────────

export const MIND_GRAPH_EVIDENCE_SOURCES = [
  "state",
  "trace",
  "subprocess_trace",
  "benchmark_result",
  "derived"
] as const;

export type MindGraphEvidenceSource = (typeof MIND_GRAPH_EVIDENCE_SOURCES)[number];

// ─── Weight / Risk / Confidence ────────────────────────────────────────

/** Edge weight or node mass in [0, 1]. */
export type MindGraphWeight = number;

/** Risk level for nodes or edges. */
export type MindGraphRiskLevel = "low" | "medium" | "high";

/** Confidence level for observed relationships. */
export type MindGraphConfidenceLevel = "low" | "medium" | "high";

// ─── Node ──────────────────────────────────────────────────────────────

export interface MindGraphNode {
  /** Stable id. Unique within the graph snapshot. */
  id: string;
  /** Node type discriminator. */
  type: MindGraphNodeType;
  /** Human-readable label (truncated if needed). */
  label: string;
  /** Which state field, trace entry, or derived computation produced this node. */
  source: MindGraphEvidenceSource;
  /** Stable id across snapshots (matches state id or derived id). */
  stableId: string;
  /** Node mass/strength/intensity [0, 1]. */
  weight?: MindGraphWeight;
  /** Node-specific mass (e.g. cluster.mass, belief.strength). */
  mass?: number;
  /** Risk level for this node. */
  risk?: MindGraphRiskLevel;
  /** Confidence in this node's derivation. */
  confidence?: MindGraphConfidenceLevel;
  /** Additional type-specific properties. */
  metadata: Record<string, unknown>;
}

// ─── Edge ──────────────────────────────────────────────────────────────

export interface MindGraphEdge {
  /** Stable edge id. */
  id: string;
  /** Edge type discriminator. */
  type: MindGraphEdgeType;
  /** Source node id. */
  sourceNodeId: string;
  /** Target node id. */
  targetNodeId: string;
  /** Whether this edge is directed (false ↔ bidirectional). */
  directed: boolean;
  /** Edge weight [0, 1]. */
  weight?: MindGraphWeight;
  /** Confidence in this edge's relationship. */
  confidence?: MindGraphConfidenceLevel;
  /** Evidence source for this edge. */
  evidence: MindGraphEvidenceSource;
  /** Additional type-specific properties. */
  metadata: Record<string, unknown>;
}

// ─── Summary ───────────────────────────────────────────────────────────

export interface MindGraphSummary {
  /** Total node count. */
  nodeCount: number;
  /** Node count by type. */
  nodeCountsByType: Record<MindGraphNodeType, number>;
  /** Total edge count. */
  edgeCount: number;
  /** Edge count by type. */
  edgeCountsByType: Partial<Record<MindGraphEdgeType, number>>;
  /** Average edge weight. */
  averageEdgeWeight: number;
  /** Number of strong edges (weight >= 0.8). */
  strongEdgeCount: number;
  /** Number of persisted nodes. */
  persistedNodeCount: number;
  /** Number of derived nodes. */
  derivedNodeCount: number;
}

// ─── Snapshot ──────────────────────────────────────────────────────────

export interface MindGraphSnapshot {
  /** Format version. */
  version: "7.1.0";
  /** Character identity id. */
  characterId: string;
  /** ISO timestamp when this snapshot was generated. */
  generatedAt: string;
  /** All graph nodes. */
  nodes: MindGraphNode[];
  /** All graph edges. */
  edges: MindGraphEdge[];
  /** Summary statistics. */
  summary: MindGraphSummary;
  /** Non-fatal warnings (missing data, orphan nodes, zero-weight edges). */
  warnings: string[];
  /** Human-readable reasons for this snapshot. */
  reasons: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Create a stable node id.
 * Pure function — deterministic for same inputs.
 */
export function createMindGraphNodeId(type: MindGraphNodeType, stableId: string): string {
  return `${type}:${stableId}`;
}

/**
 * Create a stable edge id.
 * Pure function — deterministic for same inputs.
 */
export function createMindGraphEdgeId(
  type: MindGraphEdgeType,
  sourceNodeId: string,
  targetNodeId: string
): string {
  return `${type}:${sourceNodeId}→${targetNodeId}`;
}

/**
 * Summarize a MindGraphSnapshot.
 *
 * Pure function — does not mutate input.
 */
export function summarizeMindGraph(
  snapshot: Pick<MindGraphSnapshot, "nodes" | "edges">
): MindGraphSummary {
  const { nodes, edges } = snapshot;

  const nodeCountsByType: Record<MindGraphNodeType, number> = Object.fromEntries(
    MIND_GRAPH_NODE_TYPES.map((t) => [t, 0])
  ) as Record<MindGraphNodeType, number>;

  let persistedNodeCount = 0;
  let derivedNodeCount = 0;

  for (const node of nodes) {
    nodeCountsByType[node.type]++;
    if (node.source === "state" || node.source === "trace") {
      persistedNodeCount++;
    } else {
      derivedNodeCount++;
    }
  }

  const edgeCountsByType: Partial<Record<MindGraphEdgeType, number>> = {};
  let totalWeight = 0;
  let weightedEdgeCount = 0;
  let strongEdgeCount = 0;

  for (const edge of edges) {
    edgeCountsByType[edge.type] = (edgeCountsByType[edge.type] ?? 0) + 1;
    if (edge.weight !== undefined) {
      totalWeight += edge.weight;
      weightedEdgeCount += 1;
      if (edge.weight >= 0.8) strongEdgeCount++;
    }
  }

  const averageEdgeWeight = weightedEdgeCount > 0 ? totalWeight / weightedEdgeCount : 0;

  return {
    nodeCount: nodes.length,
    nodeCountsByType,
    edgeCount: edges.length,
    edgeCountsByType,
    averageEdgeWeight,
    strongEdgeCount,
    persistedNodeCount,
    derivedNodeCount
  };
}
