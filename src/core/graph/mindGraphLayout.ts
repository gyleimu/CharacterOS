/**
 * V8.1 Graph Layout Data Model — layout positions, sizes, and colors
 * for MindGraphSnapshot nodes and edges.
 *
 * Pure data layer. No rendering. No DOM. No D3. No SVG.
 * Consumer: future V8.2+ viewer.
 */

import type {
  MindGraphSnapshot,
  MindGraphNode,
  MindGraphEdge,
  MindGraphNodeType,
  MindGraphRiskLevel
} from "./mindGraphTypes";
import { MIND_GRAPH_NODE_TYPES } from "./mindGraphTypes";

// ─── Layout types ───────────────────────────────────────────────────────

export interface LayoutPosition {
  /** Horizontal position (0 = left, viewport-dependent). */
  x: number;
  /** Vertical position (0 = top, viewport-dependent). */
  y: number;
}

export interface LayoutSize {
  /** Base size in logical units. */
  radius: number;
}

export interface LayoutStyle {
  /** CSS-compatible fill color. */
  fill: string;
  /** CSS-compatible stroke color. */
  stroke: string;
  /** Stroke width in logical pixels. */
  strokeWidth: number;
  /** Opacity [0, 1]. */
  opacity: number;
}

export interface LayoutNode {
  /** Original node id from MindGraphSnapshot. */
  nodeId: string;
  /** Original node type. */
  nodeType: MindGraphNodeType;
  /** Original node label. */
  label: string;
  /** Position in layout space. */
  position: LayoutPosition;
  /** Visual size. */
  size: LayoutSize;
  /** Visual style. */
  style: LayoutStyle;
  /** Node weight [0, 1] for sizing. */
  weight: number;
  /** Risk level for color emphasis. */
  risk: MindGraphRiskLevel | undefined;
  /** Z-index for layering. */
  zIndex: number;
}

export interface LayoutEdge {
  /** Original edge id from MindGraphSnapshot. */
  edgeId: string;
  /** Source node layout id. */
  sourceNodeId: string;
  /** Target node layout id. */
  targetNodeId: string;
  /** Edge weight [0, 1]. */
  weight: number;
  /** Visual style. */
  style: LayoutStyle;
  /** Whether this edge is directed. */
  directed: boolean;
}

export interface LayoutSummary {
  nodeCount: number;
  edgeCount: number;
  layoutStrategy: string;
  centerPosition: LayoutPosition;
}

export interface GraphLayoutSnapshot {
  /** Format version. */
  version: "8.1.0";
  /** Character id. */
  characterId: string;
  /** ISO timestamp. */
  generatedAt: string;
  /** All layout nodes with positions. */
  nodes: LayoutNode[];
  /** All layout edges with styles. */
  edges: LayoutEdge[];
  /** Layout summary. */
  summary: LayoutSummary;
  /** Warnings (missing positions, zero-size nodes, etc.). */
  warnings: string[];
  /** Human-readable reasons. */
  reasons: string[];
}

// ─── Category positions ─────────────────────────────────────────────────

const CATEGORY_POSITIONS: Record<string, LayoutPosition> = {
  abandonment: { x: -0.4, y: 0.3 },
  support: { x: 0.35, y: -0.35 },
  betrayal: { x: -0.35, y: -0.3 },
  attachment: { x: 0.2, y: 0.15 },
};

const RING_RADIUS: Record<string, number> = {
  temporal_process: 0.85,
  belief: 0.55,
};

const EDGE_LAYER_Z = 10;
const DEFAULT_NODE_Z = 50;
const CLUSTER_Z = 30;
const CORE_Z = 100;
const SIGNAL_Z = 60;

// ─── Color palettes ─────────────────────────────────────────────────────

const COLORS: Record<string, { fill: string; stroke: string }> = {
  personality_core: { fill: "#FFD700", stroke: "#B8860B" },
  memory:        { fill: "#87CEEB", stroke: "#4682B4" },
  impact_particle:{ fill: "#DDA0DD", stroke: "#9370DB" },
  impact_cluster: { fill: "rgba(100,149,237,0.3)", stroke: "#4169E1" },
  belief:        { fill: "#98FB98", stroke: "#228B22" },
  need:          { fill: "#2F2F2F", stroke: "#1A1A1A" },
  desire:        { fill: "#FF6347", stroke: "#CD5C5C" },
  behavior_bias: { fill: "#FFA500", stroke: "#FF8C00" },
  temporal_process:{ fill: "#E0E0E0", stroke: "#A0A0A0" },
  internal_state_variable: { fill: "rgba(200,200,255,0.5)", stroke: "#6495ED" },
  benchmark_signal:{ fill: "#00FF7F", stroke: "#2E8B57" },
};

const DEFAULT_COLOR = { fill: "#CCCCCC", stroke: "#999999" };

const EDGE_STYLES: Record<string, LayoutStyle> = {
  pulls_personality:      { fill: "none", stroke: "#FF4500", strokeWidth: 2.5, opacity: 0.8 },
  belongs_to_cluster:     { fill: "none", stroke: "#4169E1", strokeWidth: 2, opacity: 0.7 },
  activates_belief:       { fill: "none", stroke: "#228B22", strokeWidth: 2, opacity: 0.7 },
  creates_need:           { fill: "none", stroke: "#8B0000", strokeWidth: 2, opacity: 0.6 },
  drives_desire:          { fill: "none", stroke: "#CD5C5C", strokeWidth: 2, opacity: 0.7 },
  biases_behavior:        { fill: "none", stroke: "#FF8C00", strokeWidth: 2, opacity: 0.7 },
  derived_from:           { fill: "none", stroke: "#A0A0A0", strokeWidth: 1.5, opacity: 0.5 },
  temporal_transition:    { fill: "none", stroke: "#B0B0B0", strokeWidth: 1, opacity: 0.4 },
  impacts_personality:    { fill: "none", stroke: "#FF6347", strokeWidth: 2.5, opacity: 0.8 },
  observed_by_benchmark:  { fill: "none", stroke: "#00FF7F", strokeWidth: 1.5, opacity: 0.6 },
  reinforces_belief:      { fill: "none", stroke: "#32CD32", strokeWidth: 2, opacity: 0.7 },
  clusters_around:        { fill: "none", stroke: "#6495ED", strokeWidth: 2, opacity: 0.6 },
  regulated_by_homeostasis:{ fill: "none", stroke: "#FF69B4", strokeWidth: 2, opacity: 0.6 },
  decays_to:              { fill: "none", stroke: "#B0C4DE", strokeWidth: 1.5, opacity: 0.5 },
};

const DEFAULT_EDGE_STYLE: LayoutStyle = {
  fill: "none", stroke: "#CCCCCC", strokeWidth: 1, opacity: 0.5
};

const RISK_COLORS: Record<string, string> = {
  high: "#FF0000",
  medium: "#FFA500",
  low: "#00FF00",
};

// ─── Layout builders ────────────────────────────────────────────────────

export interface BuildGraphLayoutOptions {
  /** Viewport width in logical units (default 1000). */
  viewportWidth?: number;
  /** Viewport height in logical units (default 1000). */
  viewportHeight?: number;
}

function pick<T extends Record<string, unknown>>(record: T, key: string, fallback: T[keyof T]): T[keyof T] {
  return (key in record ? record[key] : fallback) as T[keyof T];
}

export function buildGraphLayoutSnapshot(
  snapshot: MindGraphSnapshot,
  options: BuildGraphLayoutOptions = {}
): GraphLayoutSnapshot {
  const w = options.viewportWidth ?? 1000;
  const h = options.viewportHeight ?? 1000;
  const cx = w / 2;
  const cy = h / 2;
  const warnings: string[] = [];

  const clusterMap = new Map<string, LayoutPosition>();
  let clusterIndex = 0;

  // Find clusters and assign positions
  for (const node of snapshot.nodes) {
    if (node.type === "impact_cluster") {
      const cat = (node.metadata?.category as string) ?? "unknown";
      const pos = CATEGORY_POSITIONS[cat] ?? { x: (clusterIndex * 0.15) - 0.3, y: 0 };
      clusterMap.set(node.id, { x: pos.x, y: pos.y });
      clusterIndex++;
    }
  }

  const layoutNodes: LayoutNode[] = [];

  for (const node of snapshot.nodes) {
    const pos = computeNodePosition(node, clusterMap, cx, cy);
    const size = computeNodeSize(node);
    const style = computeNodeStyle(node);
    const z = computeNodeZIndex(node.type);

    layoutNodes.push({
      nodeId: node.id,
      nodeType: node.type,
      label: node.label,
      position: { x: cx + pos.x * cx, y: cy + pos.y * cy },
      size,
      style,
      weight: node.weight ?? 0,
      risk: node.risk,
      zIndex: z
    });
  }

  const layoutEdges: LayoutEdge[] = [];
  for (const edge of snapshot.edges) {
    layoutEdges.push({
      edgeId: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      weight: edge.weight ?? 0,
      style: pick(EDGE_STYLES, edge.type, DEFAULT_EDGE_STYLE),
      directed: edge.directed
    });
  }

  // Validate
  const layoutNodeIds = new Set(layoutNodes.map((n) => n.nodeId));
  for (const edge of layoutEdges) {
    if (!layoutNodeIds.has(edge.sourceNodeId)) {
      warnings.push(`Layout edge "${edge.edgeId}" references missing source node "${edge.sourceNodeId}"`);
    }
    if (!layoutNodeIds.has(edge.targetNodeId)) {
      warnings.push(`Layout edge "${edge.edgeId}" references missing target node "${edge.targetNodeId}"`);
    }
  }

  return {
    version: "8.1.0",
    characterId: snapshot.characterId,
    generatedAt: new Date().toISOString(),
    nodes: layoutNodes,
    edges: layoutEdges,
    summary: {
      nodeCount: layoutNodes.length,
      edgeCount: layoutEdges.length,
      layoutStrategy: "cluster-anchored concentric",
      centerPosition: { x: cx, y: cy }
    },
    warnings,
    reasons: [
      `Graph layout for character "${snapshot.characterId}" with ${layoutNodes.length} nodes.`,
      `Layout strategy: cluster-anchored concentric. Personality core at center.`,
      `Colors and sizes reflect node type, weight, and risk level.`
    ]
  };
}

// ─── Position / Size / Style helpers ────────────────────────────────────

function computeNodePosition(
  node: MindGraphNode,
  clusterMap: Map<string, LayoutPosition>,
  cx: number,
  cy: number
): LayoutPosition {
  switch (node.type) {
    case "personality_core":
      return { x: 0, y: 0 };

    case "impact_cluster": {
      const cat = (node.metadata?.category as string) ?? "unknown";
      return CATEGORY_POSITIONS[cat] ?? { x: 0, y: 0 };
    }

    case "memory": {
      const clusterId = (node.metadata?.clusterId as string) ?? "";
      if (clusterId) {
        const memNodeId = `impact_cluster:${clusterId}`;
        if (clusterMap.has(memNodeId)) {
          const base = clusterMap.get(memNodeId)!;
          const jitterX = (Math.abs(hashToFloat(node.id)) * 0.12) - 0.06;
          const jitterY = (Math.abs(hashToFloat(node.id + "y")) * 0.12) - 0.06;
          return { x: base.x + jitterX, y: base.y + jitterY };
        }
      }
      // Free-floating memory: random position near edge
      const angle = hashToFloat(node.id) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.7, y: Math.sin(angle) * 0.7 };
    }

    case "impact_particle": {
      const cat = (node.metadata?.category as string) ?? "";
      if (cat && clusterMap.has(`impact_cluster:cluster_${cat}`)) {
        const base = clusterMap.get(`impact_cluster:cluster_${cat}`)!;
        const jx = (hashToFloat(node.id) * 0.08) - 0.04;
        const jy = (hashToFloat(node.id + "p") * 0.08) - 0.04;
        return { x: base.x + jx, y: base.y + jy };
      }
      return { x: (hashToFloat(node.id) * 0.6) - 0.3, y: (hashToFloat(node.id + "y") * 0.6) - 0.3 };
    }

    case "belief": {
      const index = hashToFloat(node.id) % 8;
      const radius = RING_RADIUS.belief ?? 0.55;
      const angle = (index / 8) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }

    case "need": {
      const index = hashToFloat(node.id) % 4;
      const angle = (index / 4) * Math.PI * 2 + Math.PI / 8;
      return { x: Math.cos(angle) * 0.25, y: Math.sin(angle) * 0.25 };
    }

    case "desire": {
      const index = hashToFloat(node.id) % 4;
      const angle = (index / 4) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.35, y: Math.sin(angle) * 0.35 };
    }

    case "behavior_bias": {
      const index = hashToFloat(node.id) % 4;
      const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
      return { x: Math.cos(angle) * 0.45, y: Math.sin(angle) * 0.45 };
    }

    case "temporal_process": {
      const phaseNum = (node.metadata?.phaseNumber as number) ?? 0;
      const total = 17;
      const radius = RING_RADIUS.temporal_process ?? 0.85;
      const angle = (phaseNum / total) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }

    case "internal_state_variable": {
      const dom = (node.metadata?.domain as string) ?? "";
      const idx = hashToFloat(dom) % 8;
      const angle = (idx / 8) * Math.PI * 2 + Math.PI / 16;
      const r = 0.65 + (idx % 3) * 0.05;
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    }

    case "benchmark_signal": {
      const angle = hashToFloat(node.id) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.9, y: Math.sin(angle) * 0.9 };
    }

    default:
      return { x: 0, y: 0 };
  }
}

function computeNodeSize(node: MindGraphNode): LayoutSize {
  const w = node.weight ?? 0.1;
  switch (node.type) {
    case "personality_core":   return { radius: 40 + w * 30 };
    case "memory":             return { radius: 8 + w * 15 };
    case "impact_particle":    return { radius: 3 + w * 8 };
    case "impact_cluster":     return { radius: 25 + w * 35 };
    case "belief":             return { radius: 12 + w * 18 };
    case "need":               return { radius: 10 + w * 20 };
    case "desire":             return { radius: 8 + w * 12 };
    case "behavior_bias":      return { radius: 6 + w * 10 };
    case "temporal_process":   return { radius: 5 + w * 5 };
    case "internal_state_variable": return { radius: 4 + w * 8 };
    case "benchmark_signal":   return { radius: 6 + w * 8 };
    default:                   return { radius: 10 };
  }
}

function computeNodeStyle(node: MindGraphNode): LayoutStyle {
  const colors = pick(COLORS, node.type, DEFAULT_COLOR);
  const risk = node.risk;
  const stroke = risk && risk !== "low" ? (RISK_COLORS[risk] ?? colors.stroke) : colors.stroke;
  return {
    fill: colors.fill,
    stroke,
    strokeWidth: risk === "high" ? 3 : risk === "medium" ? 2 : 1.5,
    opacity: 0.9
  };
}

function computeNodeZIndex(type: MindGraphNodeType): number {
  switch (type) {
    case "personality_core":   return CORE_Z;
    case "impact_cluster":     return CLUSTER_Z;
    case "benchmark_signal":   return SIGNAL_Z;
    case "temporal_process":   return EDGE_LAYER_Z + 5;
    default:                   return DEFAULT_NODE_Z;
  }
}

// ─── Deterministic hash for stable jitter ──────────────────────────────

function hashToFloat(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 4294967295;
}
