/**
 * V7.3 Mind Graph Projection Explainers — explain WHY each edge exists.
 *
 * Pure functions. Does NOT build graph. Reads metadata added by the builder
 * to produce human-readable rationales per edge type.
 */

import type { MindGraphEdge, MindGraphNode } from "./mindGraphTypes";

// ─── Types ──────────────────────────────────────────────────────────────

export interface MindGraphProjectionEntry {
  /** Edge id. */
  edgeId: string;
  /** Human-readable explanation of why this edge exists. */
  explanation: string;
  /** Source node label for readability. */
  sourceLabel: string;
  /** Target node label for readability. */
  targetLabel: string;
}

export interface MindGraphProjectionReport {
  /** Per-edge projection entries. */
  entries: MindGraphProjectionEntry[];
  /** Summary of projection coverage. */
  summary: string;
}

// ─── Main projection function ───────────────────────────────────────────

/**
 * Build a projection report for a graph's edges.
 *
 * Each edge's explanation is derived from its type and metadata.
 * This gives downstream tools (debuggers, viewers, API consumers)
 * a deterministic explanation of WHY the graph is structured this way.
 *
 * Pure function. Does NOT mutate input.
 */
export function explainMindGraphEdges(
  edges: readonly MindGraphEdge[],
  nodeLabelMap: ReadonlyMap<string, string>
): MindGraphProjectionReport {
  const entries: MindGraphProjectionEntry[] = [];

  for (const edge of edges) {
    const sourceLabel = nodeLabelMap.get(edge.sourceNodeId) ?? edge.sourceNodeId;
    const targetLabel = nodeLabelMap.get(edge.targetNodeId) ?? edge.targetNodeId;
    const explanation = explainEdge(edge, sourceLabel, targetLabel);
    entries.push({ edgeId: edge.id, explanation, sourceLabel, targetLabel });
  }

  return {
    entries,
    summary: `${entries.length} edges explained across ${new Set(edges.map((e) => e.type)).size} edge types.`
  };
}

// ─── Per-edge-type explanations ────────────────────────────────────────

function explainEdge(
  edge: MindGraphEdge,
  sourceLabel: string,
  targetLabel: string
): string {
  const weightInfo = edge.weight !== undefined ? ` (weight=${edge.weight.toFixed(3)})` : "";
  const evidenceInfo = `evidence: ${edge.evidence}`;

  switch (edge.type) {
    case "pulls_personality":
      return `Impact cluster "${sourceLabel}" pulls personality core "${targetLabel}" with mass influence${weightInfo}. ${evidenceInfo}.`;
    case "belongs_to_cluster":
      return `Memory "${sourceLabel}" belongs to impact cluster "${targetLabel}"${weightInfo}. ${evidenceInfo}.`;
    case "activates_belief":
      return `Memory evidence "${sourceLabel}" activates belief "${targetLabel}"${weightInfo}. ${evidenceInfo}.`;
    case "reinforces_belief":
      return `Impact particle reinforces belief "${targetLabel}"${weightInfo}. ${evidenceInfo}.`;
    case "creates_need": {
      const contribution = edge.metadata?.contribution as number | undefined;
      const formula = edge.metadata?.formula as string | undefined;
      const contribInfo = contribution !== undefined ? ` (contribution=${contribution.toFixed(2)})` : "";
      const formulaInfo = formula ? ` Formula: ${formula}.` : "";
      return `Belief "${sourceLabel}" creates need "${targetLabel}"${weightInfo}${contribInfo}.${formulaInfo} ${evidenceInfo}.`;
    }
    case "drives_desire":
      return `Need "${sourceLabel}" drives desire "${targetLabel}"${weightInfo}. ${evidenceInfo}.`;
    case "biases_behavior":
      return `Desire drives behavior bias${weightInfo}. ${evidenceInfo}.`;
    case "regulated_by_homeostasis":
      return `Personality core is regulated by homeostasis${weightInfo}. ${evidenceInfo}.`;
    case "observed_by_benchmark":
      return `Temporal process is observed by benchmark signal${weightInfo}. ${evidenceInfo}.`;
    case "derived_from":
      return `Node "${sourceLabel}" is derived from "${targetLabel}"${weightInfo}. ${evidenceInfo}.`;
    case "temporal_transition":
      return `Temporal transition from "${sourceLabel}" to "${targetLabel}". ${evidenceInfo}.`;
    case "decays_to":
      return `Memory decays toward lower-recency state${weightInfo}. ${evidenceInfo}.`;
    case "impacts_personality":
      return `Impact particle directly impacts personality core${weightInfo}. ${evidenceInfo}.`;
    case "clusters_around":
      return `Memory clusters around impact cluster${weightInfo}. ${evidenceInfo}.`;
    default:
      return `Edge of type "${edge.type}" from "${sourceLabel}" to "${targetLabel}". ${evidenceInfo}.`;
  }
}

// ─── Build node label map helper ───────────────────────────────────────

/**
 * Build a node label map from an array of nodes.
 * Useful for feeding into explainMindGraphEdges.
 */
export function buildNodeLabelMap(nodes: readonly MindGraphNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const node of nodes) {
    map.set(node.id, node.label);
  }
  return map;
}
