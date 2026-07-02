/**
 * V10.33 Mind Galaxy View Types — pure data layer for the Mind Galaxy Viewer.
 *
 * Defines the zoom-level architecture, node/edge visibility rules, drift
 * vectors, hover summaries, and builder functions. Pure functions only.
 * No DOM. No Canvas. No browser APIs. No state mutation.
 *
 * Input: MindGraphSnapshot + GraphLayoutSnapshot
 * Output: MindGalaxyViewSnapshot with zoom-gated visibility metadata
 */

import type { MindGraphNodeType, MindGraphEdgeType, MindGraphRiskLevel } from "./mindGraphTypes";
import type { MindGraphSnapshot } from "./mindGraphTypes";
import type { GraphLayoutSnapshot, LayoutNode, LayoutEdge } from "./mindGraphLayout";

// ─── Zoom Level ──────────────────────────────────────────────────────────

export const GALAXY_ZOOM_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;
export type GalaxyZoomLevel = (typeof GALAXY_ZOOM_LEVELS)[number];

export function isGalaxyZoomLevel(value: unknown): value is GalaxyZoomLevel {
  return typeof value === "string" && GALAXY_ZOOM_LEVELS.includes(value as GalaxyZoomLevel);
}

// ─── Visibility ──────────────────────────────────────────────────────────

export interface GalaxyNodeVisibility {
  nodeId: string;
  nodeType: MindGraphNodeType;
  /** First zoom level at which this node becomes visible. */
  minZoom: GalaxyZoomLevel;
  /** Whether label is visible at the given zoom (checks both level and size). */
  labelVisible: boolean;
  /** For L4 only: whether drift vector should render. */
  driftVisible: boolean;
}

export interface GalaxyEdgeVisibility {
  edgeId: string;
  edgeType: MindGraphEdgeType;
  /** First zoom level at which this edge becomes visible. */
  minZoom: GalaxyZoomLevel;
  /** Whether edge type label is visible at current zoom. */
  labelVisible: boolean;
}

// ─── Drift Vector ────────────────────────────────────────────────────────

export interface GalaxyDriftVector {
  nodeId: string;
  /** Direction in radians. Deterministic — derived from node id. */
  angle: number;
  /** Magnitude in logical pixels. Low (0.1–2.0). Deterministic. */
  magnitude: number;
  /** Component deltas. */
  dx: number;
  dy: number;
  /** Interpreted direction label. */
  direction: "strengthening" | "weakening" | "approaching_core" | "drifting_outward" | "stable";
  /** Human-readable reason for this drift direction. */
  reason: string;
}

// ─── Influence Factor ────────────────────────────────────────────────────

export interface GalaxyInfluenceFactor {
  nodeId: string;
  nodeType: MindGraphNodeType;
  label: string;
  weight: number;
  risk: MindGraphRiskLevel | undefined;
  /** Edge count connected to this node. */
  connectionCount: number;
  /** Types of edges connected to this node. */
  connectedEdgeTypes: MindGraphEdgeType[];
  /** For L4: drift vector for this factor. */
  drift: GalaxyDriftVector | undefined;
}

// ─── Hover Summary ───────────────────────────────────────────────────────

export interface GalaxyHoverSummary {
  nodeId: string;
  /** Short label (truncated to 80 chars). */
  label: string;
  nodeType: MindGraphNodeType;
  risk: MindGraphRiskLevel | undefined;
  /** Weight / mass [0, 1]. */
  weight: number;
  /** One-sentence primary reason derived from connected edges. */
  primaryReason: string;
  /** Count of connected edges. */
  edgeCount: number;
  /** Count of evidence sources (distinct). */
  evidenceSourceCount: number;
  /** For nodes with drift: brief explanation of what changed. */
  driftSummary: string | undefined;
}

// ─── View Node ───────────────────────────────────────────────────────────

export interface MindGalaxyViewNode {
  /** From MindGraphNode.id */
  nodeId: string;
  nodeType: MindGraphNodeType;
  label: string;
  /** Position from layout (absolute viewport coordinates). */
  x: number;
  y: number;
  /** Visual radius from layout. */
  radius: number;
  /** Fill color from layout style. */
  fill: string;
  /** Stroke color from layout style. */
  stroke: string;
  /** [0, 1] opacity. */
  opacity: number;
  /** Z-index for draw ordering. */
  zIndex: number;
  weight: number;
  risk: MindGraphRiskLevel | undefined;
  visibility: GalaxyNodeVisibility;
  hover: GalaxyHoverSummary;
  drift: GalaxyDriftVector | undefined;
}

// ─── View Edge ───────────────────────────────────────────────────────────

export interface MindGalaxyViewEdge {
  edgeId: string;
  edgeType: MindGraphEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  /** Source position from layout. */
  x1: number;
  y1: number;
  /** Target position from layout. */
  x2: number;
  y2: number;
  /** Stroke color from layout style. */
  stroke: string;
  /** [0, 1] opacity. */
  opacity: number;
  strokeWidth: number;
  weight: number;
  directed: boolean;
  visibility: GalaxyEdgeVisibility;
}

// ─── View Snapshot ───────────────────────────────────────────────────────

export interface MindGalaxyViewSnapshot {
  /** Format version. */
  version: "10.33.0";
  characterId: string;
  generatedAt: string;
  /** All view nodes (graph nodes + layout positions + visibility + hover + drift). */
  nodes: MindGalaxyViewNode[];
  /** All view edges (graph edges + layout styles + visibility). */
  edges: MindGalaxyViewEdge[];
  /** View summary. */
  summary: MindGalaxyViewSummary;
  /** Non-fatal warnings. */
  warnings: string[];
  /** Human-readable reasons. */
  reasons: string[];
}

// ─── View Summary ────────────────────────────────────────────────────────

export interface MindGalaxyViewSummary {
  totalNodes: number;
  totalEdges: number;
  /** Node counts by visibility at each zoom level. */
  nodesByZoom: Record<GalaxyZoomLevel, number>;
  /** Edge counts by visibility at each zoom level. */
  edgesByZoom: Record<GalaxyZoomLevel, number>;
  /** Nodes with drift vectors (L4 only). */
  driftNodeCount: number;
  /** Average drift magnitude among nodes with drift. */
  averageDriftMagnitude: number;
  /** Center position (personality_core or default). */
  centerX: number;
  centerY: number;
  /** Risk distribution. */
  riskCounts: Record<string, number>;
}

// ─── Builder Options ─────────────────────────────────────────────────────

export interface BuildGalaxyViewOptions {
  /** Optional override for drift seed prefix (defaults to characterId). */
  driftSeedPrefix?: string;
  /** Whether to compute drift vectors (default true). */
  computeDrift?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Visibility Rules — Zoom Level Thresholds by Node Type
// ═══════════════════════════════════════════════════════════════════════════

const NODE_MIN_ZOOM: Record<MindGraphNodeType, GalaxyZoomLevel> = {
  personality_core: "L0",
  impact_cluster: "L1",
  memory: "L2",
  impact_particle: "L2",
  belief: "L2",
  need: "L2",
  desire: "L2",
  behavior_bias: "L3",
  temporal_process: "L1",
  internal_state_variable: "L3",
  benchmark_signal: "L3",
};

const EDGE_MIN_ZOOM: Record<MindGraphEdgeType, GalaxyZoomLevel> = {
  belongs_to_cluster: "L1",
  clusters_around: "L1",
  impacts_personality: "L2",
  pulls_personality: "L2",
  activates_belief: "L2",
  reinforces_belief: "L2",
  creates_need: "L2",
  drives_desire: "L2",
  biases_behavior: "L3",
  regulated_by_homeostasis: "L3",
  observed_by_benchmark: "L3",
  temporal_transition: "L3",
  decays_to: "L3",
  derived_from: "L3",
};

const ZOOM_ORDER: Record<GalaxyZoomLevel, number> = {
  L0: 0, L1: 1, L2: 2, L3: 3, L4: 4,
};

// ═══════════════════════════════════════════════════════════════════════════
// Builder Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a MindGalaxyViewSnapshot from graph + layout snapshots.
 *
 * Pure function. No side effects. Input snapshots are never mutated.
 *
 * @param graph — MindGraphSnapshot (V7)
 * @param layout — GraphLayoutSnapshot (V8)
 * @param options — optional drift seed and compute flags
 * @returns MindGalaxyViewSnapshot (V10.33)
 */
export function buildMindGalaxyViewSnapshot(
  graph: MindGraphSnapshot,
  layout: GraphLayoutSnapshot,
  options: BuildGalaxyViewOptions = {}
): MindGalaxyViewSnapshot {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const computeDrift = options.computeDrift ?? true;
  const driftSeedPrefix = options.driftSeedPrefix ?? graph.characterId;

  // Build layout position lookup
  const nodePosMap = new Map<string, LayoutNode>();
  for (const ln of layout.nodes) {
    nodePosMap.set(ln.nodeId, ln);
  }

  // Build edge adjacency for connection counts
  const nodeEdgeCounts = new Map<string, number>();
  const nodeEdgeTypes = new Map<string, Set<MindGraphEdgeType>>();
  for (const edge of graph.edges) {
    nodeEdgeCounts.set(edge.sourceNodeId, (nodeEdgeCounts.get(edge.sourceNodeId) ?? 0) + 1);
    nodeEdgeCounts.set(edge.targetNodeId, (nodeEdgeCounts.get(edge.targetNodeId) ?? 0) + 1);
    for (const nid of [edge.sourceNodeId, edge.targetNodeId]) {
      const types = nodeEdgeTypes.get(nid) ?? new Set();
      types.add(edge.type);
      nodeEdgeTypes.set(nid, types);
    }
  }

  // Build view nodes
  const viewNodes: MindGalaxyViewNode[] = [];
  for (const gn of graph.nodes) {
    const ln = nodePosMap.get(gn.id);
    if (!ln) {
      warnings.push(`Graph node "${gn.id}" (${gn.type}) has no layout position.`);
      continue;
    }

    const weight = gn.weight ?? gn.mass ?? 0;
    const risk = gn.risk;
    const minZoom = NODE_MIN_ZOOM[gn.type];
    const labelVisible = minZoomToLabelVisible(minZoom, ln.size.radius);
    const driftVisible = minZoom === "L4" || ZOOM_ORDER[minZoom] <= ZOOM_ORDER["L4"];
    const edgeCount = nodeEdgeCounts.get(gn.id) ?? 0;
    const connectedEdgeTypes = [...(nodeEdgeTypes.get(gn.id) ?? new Set())];
    const drift = computeDrift && driftVisible
      ? computeDriftVector(gn.id, gn.type, weight, risk, driftSeedPrefix, connectedEdgeTypes)
      : undefined;
    const primaryReason = buildPrimaryReason(gn.type, connectedEdgeTypes, weight, risk);
    const hover: GalaxyHoverSummary = {
      nodeId: gn.id,
      label: gn.label.length > 80 ? gn.label.slice(0, 80) : gn.label,
      nodeType: gn.type,
      risk,
      weight: Math.round(weight * 10000) / 10000,
      primaryReason,
      edgeCount,
      evidenceSourceCount: countDistinctSources(gn, graph),
      driftSummary: drift?.reason,
    };

    viewNodes.push({
      nodeId: gn.id,
      nodeType: gn.type,
      label: gn.label,
      x: ln.position.x,
      y: ln.position.y,
      radius: ln.size.radius,
      fill: ln.style.fill,
      stroke: ln.style.stroke,
      opacity: ln.style.opacity,
      zIndex: ln.zIndex,
      weight,
      risk,
      visibility: {
        nodeId: gn.id,
        nodeType: gn.type,
        minZoom,
        labelVisible,
        driftVisible,
      },
      hover,
      drift,
    });
  }

  // Build view edges
  const viewEdges: MindGalaxyViewEdge[] = [];
  for (const ge of graph.edges) {
    const le = layout.edges.find((e) => e.edgeId === ge.id);
    const srcNode = viewNodes.find((n) => n.nodeId === ge.sourceNodeId);
    const tgtNode = viewNodes.find((n) => n.nodeId === ge.targetNodeId);

    if (!srcNode || !tgtNode) {
      warnings.push(`View edge "${ge.id}" references missing source or target node.`);
      continue;
    }

    const minZoom = EDGE_MIN_ZOOM[ge.type];
    const labelVisible = minZoomToEdgeLabelVisible(minZoom, ge.weight ?? 0);

    viewEdges.push({
      edgeId: ge.id,
      edgeType: ge.type,
      sourceNodeId: ge.sourceNodeId,
      targetNodeId: ge.targetNodeId,
      x1: srcNode.x,
      y1: srcNode.y,
      x2: tgtNode.x,
      y2: tgtNode.y,
      stroke: le?.style.stroke ?? "#CCCCCC",
      opacity: le?.style.opacity ?? 0.5,
      strokeWidth: le?.style.strokeWidth ?? 1,
      weight: ge.weight ?? 0,
      directed: ge.directed,
      visibility: {
        edgeId: ge.id,
        edgeType: ge.type,
        minZoom,
        labelVisible,
      },
    });
  }

  // Build summary
  const summary = buildViewSummary(viewNodes, viewEdges, layout);

  reasons.push(
    `Galaxy view snapshot for character "${graph.characterId}" with ${viewNodes.length} nodes and ${viewEdges.length} edges.`,
    `Zoom levels: L0(${summary.nodesByZoom.L0} nodes) → L1(${summary.nodesByZoom.L1}) → L2(${summary.nodesByZoom.L2}) → L3(${summary.nodesByZoom.L3}) → L4(${summary.nodesByZoom.L4}).`,
    computeDrift
      ? `Drift vectors computed for ${summary.driftNodeCount} nodes (avg magnitude: ${summary.averageDriftMagnitude.toFixed(4)}).`
      : "Drift vectors disabled."
  );

  return {
    version: "10.33.0",
    characterId: graph.characterId,
    generatedAt: new Date().toISOString(),
    nodes: viewNodes,
    edges: viewEdges,
    summary,
    warnings,
    reasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoom-Level Filter Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return only the nodes visible at the given zoom level.
 * Pure function. Does not mutate input.
 */
export function getVisibleGalaxyNodes(
  snapshot: MindGalaxyViewSnapshot,
  zoomLevel: GalaxyZoomLevel
): MindGalaxyViewNode[] {
  const zoomOrdinal = ZOOM_ORDER[zoomLevel];
  return snapshot.nodes.filter(
    (n) => ZOOM_ORDER[n.visibility.minZoom] <= zoomOrdinal
  );
}

/**
 * Return only the edges visible at the given zoom level.
 * Pure function. Does not mutate input.
 */
export function getVisibleGalaxyEdges(
  snapshot: MindGalaxyViewSnapshot,
  zoomLevel: GalaxyZoomLevel
): MindGalaxyViewEdge[] {
  const zoomOrdinal = ZOOM_ORDER[zoomLevel];
  return snapshot.edges.filter(
    (e) => ZOOM_ORDER[e.visibility.minZoom] <= zoomOrdinal
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary Function
// ═══════════════════════════════════════════════════════════════════════════

export function summarizeMindGalaxyView(
  snapshot: MindGalaxyViewSnapshot
): MindGalaxyViewSummary {
  return snapshot.summary;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function buildViewSummary(
  nodes: MindGalaxyViewNode[],
  edges: MindGalaxyViewEdge[],
  layout: GraphLayoutSnapshot
): MindGalaxyViewSummary {
  const nodesByZoom = countByZoom(nodes, (n) => n.visibility.minZoom);
  const edgesByZoom = countByZoom(edges, (e) => e.visibility.minZoom);
  const driftNodes = nodes.filter((n) => n.drift !== undefined);
  const driftMagnitudes = driftNodes.map((n) => n.drift!.magnitude);

  const riskCounts: Record<string, number> = {};
  for (const n of nodes) {
    if (n.risk) {
      riskCounts[n.risk] = (riskCounts[n.risk] ?? 0) + 1;
    }
  }

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByZoom,
    edgesByZoom,
    driftNodeCount: driftNodes.length,
    averageDriftMagnitude:
      driftMagnitudes.length > 0
        ? Math.round((driftMagnitudes.reduce((a, b) => a + b, 0) / driftMagnitudes.length) * 10000) / 10000
        : 0,
    centerX: layout.summary.centerPosition.x,
    centerY: layout.summary.centerPosition.y,
    riskCounts,
  };
}

function countByZoom<T>(
  items: T[],
  getZoom: (item: T) => GalaxyZoomLevel
): Record<GalaxyZoomLevel, number> {
  const counts: Record<GalaxyZoomLevel, number> = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
  for (const item of items) {
    counts[getZoom(item)]++;
  }
  return counts;
}

function minZoomToLabelVisible(minZoom: GalaxyZoomLevel, radius: number): boolean {
  // Labels appear at L3+ AND when node radius >= 8 logical pixels
  return ZOOM_ORDER[minZoom] <= ZOOM_ORDER["L3"] && radius >= 8;
}

function minZoomToEdgeLabelVisible(minZoom: GalaxyZoomLevel, weight: number): boolean {
  // Edge labels appear at L2+ AND weight >= 0.5
  return ZOOM_ORDER[minZoom] <= ZOOM_ORDER["L2"] && weight >= 0.5;
}

/**
 * Compute a deterministic drift vector for a node.
 * No Math.random(). No Date.now(). Pure function of inputs.
 */
function computeDriftVector(
  nodeId: string,
  nodeType: MindGraphNodeType,
  weight: number,
  risk: MindGraphRiskLevel | undefined,
  seedPrefix: string,
  connectedEdgeTypes: MindGraphEdgeType[]
): GalaxyDriftVector {
  const seed = `${seedPrefix}:${nodeId}:drift`;
  const angle = deterministicAngle(seed);
  const baseMagnitude = deterministicBaseMagnitude(nodeType, weight, risk);
  const magnitude = clampMagnitude(baseMagnitude);

  const dx = Math.cos(angle) * magnitude;
  const dy = Math.sin(angle) * magnitude;
  const direction = classifyDriftDirection(nodeType, dx, dy, connectedEdgeTypes);
  const reason = buildDriftReason(nodeType, direction, magnitude, connectedEdgeTypes);

  return {
    nodeId,
    angle: Math.round(angle * 10000) / 10000,
    magnitude: Math.round(magnitude * 10000) / 10000,
    dx: Math.round(dx * 10000) / 10000,
    dy: Math.round(dy * 10000) / 10000,
    direction,
    reason,
  };
}

function deterministicAngle(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 4294967295) * Math.PI * 2;
}

function deterministicBaseMagnitude(
  nodeType: MindGraphNodeType,
  weight: number,
  risk: MindGraphRiskLevel | undefined
): number {
  // Base magnitude per node type — reflects how much this type "drifts"
  const baseMap: Partial<Record<MindGraphNodeType, number>> = {
    personality_core: 0.1,
    impact_cluster: 0.3,
    memory: 0.5,
    impact_particle: 0.4,
    belief: 0.6,
    need: 0.3,
    desire: 0.4,
    behavior_bias: 0.2,
    temporal_process: 0.15,
    internal_state_variable: 0.1,
    benchmark_signal: 0.05,
  };
  const base = baseMap[nodeType] ?? 0.2;
  // Weight amplifies drift; high-risk nodes drift more
  const riskMultiplier = risk === "high" ? 1.5 : risk === "medium" ? 1.2 : 1.0;
  return base * (0.5 + weight) * riskMultiplier;
}

function clampMagnitude(value: number): number {
  // Drift magnitude in [0.05, 2.0] logical pixels
  return Math.max(0.05, Math.min(2.0, value));
}

function classifyDriftDirection(
  nodeType: MindGraphNodeType,
  dx: number,
  dy: number,
  connectedEdgeTypes: MindGraphEdgeType[]
): GalaxyDriftVector["direction"] {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.1) return "stable";

  const hasPullsPersonality = connectedEdgeTypes.includes("pulls_personality");
  const hasImpactsPersonality = connectedEdgeTypes.includes("impacts_personality");
  const hasDecays = connectedEdgeTypes.includes("decays_to");
  const hasReinforces = connectedEdgeTypes.includes("reinforces_belief");
  const hasCreatesNeed = connectedEdgeTypes.includes("creates_need");

  // Approaching core: negative radial direction + personality connections
  if (hasPullsPersonality || hasImpactsPersonality) {
    return dy < 0 ? "approaching_core" : "drifting_outward";
  }
  if (hasReinforces || hasCreatesNeed) {
    return "strengthening";
  }
  if (hasDecays) {
    return "weakening";
  }

  // Default: based on radial direction
  return dy < 0 ? "approaching_core" : "drifting_outward";
}

function buildDriftReason(
  nodeType: MindGraphNodeType,
  direction: GalaxyDriftVector["direction"],
  magnitude: number,
  connectedEdgeTypes: MindGraphEdgeType[]
): string {
  const typeLabel = nodeType.replace(/_/g, " ");
  const magDesc = magnitude < 0.3 ? "barely perceptible" : magnitude < 0.8 ? "slow" : "moderate";

  switch (direction) {
    case "approaching_core":
      return `${typeLabel} shows ${magDesc} inward drift toward personality core.`;
    case "drifting_outward":
      return `${typeLabel} exhibits ${magDesc} outward drift from personality core.`;
    case "strengthening":
      return `${typeLabel} is ${magDesc}ly strengthening (reinforced by active beliefs/needs).`;
    case "weakening":
      return `${typeLabel} is ${magDesc}ly weakening (decay or reduced activation).`;
    case "stable":
    default:
      return `${typeLabel} remains stable with negligible drift.`;
  }
}

function buildPrimaryReason(
  nodeType: MindGraphNodeType,
  connectedEdgeTypes: MindGraphEdgeType[],
  weight: number,
  risk: MindGraphRiskLevel | undefined
): string {
  const riskNote = risk === "high" ? " (high risk)" : risk === "medium" ? " (elevated risk)" : "";
  const typeLabel = nodeType.replace(/_/g, " ");

  if (connectedEdgeTypes.includes("pulls_personality")) {
    return `${typeLabel} directly pulls personality core${riskNote}.`;
  }
  if (connectedEdgeTypes.includes("activates_belief")) {
    return `${typeLabel} activates associated beliefs${riskNote}.`;
  }
  if (connectedEdgeTypes.includes("creates_need")) {
    return `${typeLabel} drives need formation${riskNote}.`;
  }
  if (connectedEdgeTypes.includes("drives_desire")) {
    return `${typeLabel} drives desire emergence${riskNote}.`;
  }
  if (connectedEdgeTypes.includes("belongs_to_cluster")) {
    return `${typeLabel} is anchored within a personality cluster${riskNote}.`;
  }
  if (weight >= 0.7) {
    return `${typeLabel} carries high weight (${(weight * 100).toFixed(0)}%)${riskNote}.`;
  }
  if (weight <= 0.2) {
    return `${typeLabel} has low influence (${(weight * 100).toFixed(0)}%)${riskNote}.`;
  }
  return `${typeLabel} contributes to personality structure${riskNote}.`;
}

function countDistinctSources(
  node: { id: string },
  graph: MindGraphSnapshot
): number {
  const connectedEdges = graph.edges.filter(
    (e) => e.sourceNodeId === node.id || e.targetNodeId === node.id
  );
  const sources = new Set(connectedEdges.map((e) => e.evidence));
  return sources.size;
}
