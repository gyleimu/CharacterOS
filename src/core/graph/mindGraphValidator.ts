/**
 * V7.3 Mind Graph Validator — structural integrity checks for graph snapshots.
 *
 * Pure functions. Does NOT mutate input.
 */

import type { MindGraphSnapshot, MindGraphNode, MindGraphEdge } from "./mindGraphTypes";
import {
  MIND_GRAPH_NODE_TYPES,
  MIND_GRAPH_EDGE_TYPES,
  MIND_GRAPH_EVIDENCE_SOURCES
} from "./mindGraphTypes";

// ─── Types ──────────────────────────────────────────────────────────────

export interface MindGraphValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface MindGraphValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: MindGraphValidationIssue[];
}

export interface MindGraphProjectedNodeRisk {
  /** Node id. */
  nodeId: string;
  /** Projected risk level based on heuristic. */
  projectedRisk: MindGraphNode["risk"];
  /** Explanation of the heuristic. */
  explanation: string;
}

// ─── Main validation ────────────────────────────────────────────────────

/**
 * Validate a MindGraphSnapshot.
 *
 * Pure function. Does NOT mutate input.
 */
export function validateMindGraphSnapshot(
  snapshot: Pick<MindGraphSnapshot, "nodes" | "edges" | "summary">
): MindGraphValidationResult {
  const issues: MindGraphValidationIssue[] = [];
  const { nodes, edges, summary } = snapshot;

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  // 1. Node id uniqueness
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: "error",
        code: "V001_DUPLICATE_NODE_ID",
        message: `Duplicate node id "${node.id}"`,
        nodeId: node.id
      });
    }
    nodeIds.add(node.id);
  }

  // 2. Edge id uniqueness
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        severity: "error",
        code: "V002_DUPLICATE_EDGE_ID",
        message: `Duplicate edge id "${edge.id}"`,
        edgeId: edge.id
      });
    }
    edgeIds.add(edge.id);
  }

  // 3. Edge references must exist
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      issues.push({
        severity: "error",
        code: "V003_MISSING_SOURCE_NODE",
        message: `Edge "${edge.id}" references missing source node "${edge.sourceNodeId}"`,
        edgeId: edge.id
      });
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      issues.push({
        severity: "error",
        code: "V004_MISSING_TARGET_NODE",
        message: `Edge "${edge.id}" references missing target node "${edge.targetNodeId}"`,
        edgeId: edge.id
      });
    }
  }

  // 4. Node weight in [0,1] if present
  for (const node of nodes) {
    if (node.weight !== undefined && (node.weight < 0 || node.weight > 1)) {
      issues.push({
        severity: "error",
        code: "V005_NODE_WEIGHT_OUT_OF_RANGE",
        message: `Node "${node.id}" weight ${node.weight} is outside [0, 1]`,
        nodeId: node.id
      });
    }
  }

  // 5. Edge weight in [0,1] if present
  for (const edge of edges) {
    if (edge.weight !== undefined && (edge.weight < 0 || edge.weight > 1)) {
      issues.push({
        severity: "error",
        code: "V006_EDGE_WEIGHT_OUT_OF_RANGE",
        message: `Edge "${edge.id}" weight ${edge.weight} is outside [0, 1]`,
        edgeId: edge.id
      });
    }
  }

  // 6. Node mass must be finite if present
  for (const node of nodes) {
    if (node.mass !== undefined && !isFinite(node.mass)) {
      issues.push({
        severity: "error",
        code: "V007_NODE_MASS_NOT_FINITE",
        message: `Node "${node.id}" mass ${node.mass} is not finite`,
        nodeId: node.id
      });
    }
  }

  // 7. Node type must be valid
  for (const node of nodes) {
    if (!MIND_GRAPH_NODE_TYPES.includes(node.type as never)) {
      issues.push({
        severity: "error",
        code: "V008_INVALID_NODE_TYPE",
        message: `Node "${node.id}" has invalid type "${node.type}"`,
        nodeId: node.id
      });
    }
  }

  // 8. Edge type must be valid
  for (const edge of edges) {
    if (!MIND_GRAPH_EDGE_TYPES.includes(edge.type as never)) {
      issues.push({
        severity: "error",
        code: "V009_INVALID_EDGE_TYPE",
        message: `Edge "${edge.id}" has invalid type "${edge.type}"`,
        edgeId: edge.id
      });
    }
  }

  // 9. Node source must be valid
  for (const node of nodes) {
    if (!MIND_GRAPH_EVIDENCE_SOURCES.includes(node.source as never)) {
      issues.push({
        severity: "error",
        code: "V010_INVALID_NODE_SOURCE",
        message: `Node "${node.id}" has invalid source "${node.source}"`,
        nodeId: node.id
      });
    }
  }

  // 10. Edge evidence must be valid
  for (const edge of edges) {
    if (!MIND_GRAPH_EVIDENCE_SOURCES.includes(edge.evidence as never)) {
      issues.push({
        severity: "error",
        code: "V011_INVALID_EDGE_EVIDENCE",
        message: `Edge "${edge.id}" has invalid evidence "${edge.evidence}"`,
        edgeId: edge.id
      });
    }
  }

  // 11. No self-loops (unless explicitly allowed for bidirectional types)
  const SELF_LOOP_ALLOWED: ReadonlySet<string> = new Set(["derived_from"]);
  for (const edge of edges) {
    if (edge.sourceNodeId === edge.targetNodeId && !SELF_LOOP_ALLOWED.has(edge.type)) {
      issues.push({
        severity: "error",
        code: "V012_SELF_LOOP",
        message: `Edge "${edge.id}" of type "${edge.type}" is a self-loop (source = target)`,
        edgeId: edge.id
      });
    }
  }

  // 12. Summary must match actual counts
  if (summary.nodeCount !== nodes.length) {
    issues.push({
      severity: "error",
      code: "V013_SUMMARY_NODE_COUNT_MISMATCH",
      message: `Summary nodeCount ${summary.nodeCount} != actual ${nodes.length}`
    });
  }
  if (summary.edgeCount !== edges.length) {
    issues.push({
      severity: "error",
      code: "V014_SUMMARY_EDGE_COUNT_MISMATCH",
      message: `Summary edgeCount ${summary.edgeCount} != actual ${edges.length}`
    });
  }

  // 13. Warning: orphan nodes (no edges)
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.sourceNodeId);
    connectedNodes.add(edge.targetNodeId);
  }
  for (const node of nodes) {
    if (!connectedNodes.has(node.id) && node.type !== "personality_core") {
      issues.push({
        severity: "warning",
        code: "V015_ORPHAN_NODE",
        message: `Node "${node.id}" (${node.type}) has no edges`,
        nodeId: node.id
      });
    }
  }

  // 14. Warning: node has risk but no mass/weight
  for (const node of nodes) {
    if (node.risk !== undefined && node.weight === undefined && node.mass === undefined) {
      issues.push({
        severity: "warning",
        code: "V016_RISK_WITHOUT_MASS",
        message: `Node "${node.id}" has risk "${node.risk}" but no weight or mass`,
        nodeId: node.id
      });
    }
  }

  // 15. Warning: edge has confidence but no weight
  for (const edge of edges) {
    if (edge.confidence !== undefined && edge.weight === undefined) {
      issues.push({
        severity: "warning",
        code: "V017_CONFIDENCE_WITHOUT_WEIGHT",
        message: `Edge "${edge.id}" has confidence "${edge.confidence}" but no weight`,
        edgeId: edge.id
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    issues
  };
}

// ─── Node-specific risk projection ──────────────────────────────────────

/**
 * Project a risk level for a node based on its type and properties.
 * Pure function — does NOT mutate input.
 */
export function projectNodeRisk(node: MindGraphNode): MindGraphProjectedNodeRisk {
  const weight = node.weight ?? 0;

  switch (node.type) {
    case "impact_cluster": {
      const mass = node.mass ?? weight;
      if (mass >= 0.6) return { nodeId: node.id, projectedRisk: "high", explanation: `cluster mass ${mass.toFixed(2)} ≥ 0.6` };
      if (mass >= 0.3) return { nodeId: node.id, projectedRisk: "medium", explanation: `cluster mass ${mass.toFixed(2)} ≥ 0.3` };
      return { nodeId: node.id, projectedRisk: "low", explanation: `cluster mass ${mass.toFixed(2)} < 0.3` };
    }
    case "memory": {
      const recency = (node.metadata?.recency as number) ?? 0;
      if (recency >= 0.7) return { nodeId: node.id, projectedRisk: "medium", explanation: `high recency ${recency.toFixed(2)} — fresh memory` };
      return { nodeId: node.id, projectedRisk: "low", explanation: `recency ${recency.toFixed(2)} — older memory` };
    }
    case "belief": {
      const strength = (node.metadata?.strength as number) ?? weight;
      if (strength >= 0.6) return { nodeId: node.id, projectedRisk: "high", explanation: `belief strength ${strength.toFixed(2)} ≥ 0.6` };
      if (strength >= 0.3) return { nodeId: node.id, projectedRisk: "medium", explanation: `belief strength ${strength.toFixed(2)} ≥ 0.3` };
      return { nodeId: node.id, projectedRisk: "low", explanation: `belief strength ${strength.toFixed(2)} < 0.3` };
    }
    case "need": {
      const intensity = (node.metadata?.intensity as number) ?? weight;
      if (intensity >= 0.6) return { nodeId: node.id, projectedRisk: "high", explanation: `need intensity ${intensity.toFixed(2)} ≥ 0.6` };
      if (intensity >= 0.35) return { nodeId: node.id, projectedRisk: "medium", explanation: `need intensity ${intensity.toFixed(2)} ≥ 0.35` };
      return { nodeId: node.id, projectedRisk: "low", explanation: `need intensity ${intensity.toFixed(2)} < 0.35` };
    }
    case "personality_core": {
      const fear = (node.metadata?.fear as number) ?? 0;
      const trust = (node.metadata?.trust as number) ?? 0;
      const stress = (1 - trust) * 0.5 + fear * 0.5;
      if (stress >= 0.7) return { nodeId: node.id, projectedRisk: "high", explanation: `personality stress=${stress.toFixed(2)} (high fear + low trust)` };
      if (stress >= 0.4) return { nodeId: node.id, projectedRisk: "medium", explanation: `personality stress=${stress.toFixed(2)}` };
      return { nodeId: node.id, projectedRisk: "low", explanation: `personality stress=${stress.toFixed(2)}` };
    }
    default:
      return { nodeId: node.id, projectedRisk: "low", explanation: `no risk heuristic for type "${node.type}"` };
  }
}
