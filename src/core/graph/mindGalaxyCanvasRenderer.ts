/**
 * V10.34 Static Canvas Renderer — pure render command builder for Mind Galaxy Viewer.
 *
 * Produces a deterministic list of draw commands from a MindGalaxyViewSnapshot.
 * No Canvas 2D context. No DOM. No browser APIs. No animation.
 *
 * Every command is a plain object. A future Canvas 2D consumer can walk the
 * list and call ctx.arc / ctx.fill / ctx.stroke / ctx.fillText etc. without
 * any layout or visibility decisions — all decisions are made here.
 */

import type { MindGalaxyViewSnapshot, MindGalaxyViewNode, MindGalaxyViewEdge } from "./mindGalaxyViewTypes";
import type { GalaxyZoomLevel } from "./mindGalaxyViewTypes";
import { getVisibleGalaxyNodes, getVisibleGalaxyEdges, GALAXY_ZOOM_LEVELS } from "./mindGalaxyViewTypes";

// ═══════════════════════════════════════════════════════════════════════════
// Render Command Types
// ═══════════════════════════════════════════════════════════════════════════

export type GalaxyCanvasRenderCommand =
  | GalaxyBackgroundCommand
  | GalaxyCircleCommand
  | GalaxyLineCommand
  | GalaxyTextCommand
  | GalaxyGlowCommand
  | GalaxyDriftVectorCommand;

export interface GalaxyBackgroundCommand {
  kind: "background";
  /** CSS-compatible fill color. */
  color: string;
  /** Canvas width in logical pixels. */
  width: number;
  /** Canvas height in logical pixels. */
  height: number;
  /** z-index (always 0 — drawn first). */
  zIndex: 0;
}

export interface GalaxyCircleCommand {
  kind: "circle";
  /** Center x position. */
  x: number;
  /** Center y position. */
  y: number;
  /** Circle radius. */
  radius: number;
  /** Fill color (CSS-compatible). */
  fill: string;
  /** Stroke color (CSS-compatible). */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Opacity [0, 1]. */
  opacity: number;
  /** Stable node id for hit-testing (future). */
  nodeId?: string;
  /** z-index for draw ordering. */
  zIndex: number;
}

export interface GalaxyLineCommand {
  kind: "line";
  /** Start x. */
  x1: number;
  /** Start y. */
  y1: number;
  /** End x. */
  x2: number;
  /** End y. */
  y2: number;
  /** Stroke color. */
  stroke: string;
  /** Stroke width. */
  strokeWidth: number;
  /** Opacity [0, 1]. */
  opacity: number;
  /** Whether to draw arrowhead at target. */
  directed: boolean;
  /** Stable edge id for hit-testing. */
  edgeId?: string;
  /** z-index for draw ordering. */
  zIndex: number;
}

export interface GalaxyTextCommand {
  kind: "text";
  /** Text anchor x. */
  x: number;
  /** Text baseline y. */
  y: number;
  /** Text content (already truncated). */
  content: string;
  /** Font size in logical pixels. */
  fontSize: number;
  /** CSS-compatible color. */
  color: string;
  /** Opacity [0, 1]. */
  opacity: number;
  /** Stable node id for association. */
  nodeId?: string;
  /** Stable edge id for association. */
  edgeId?: string;
  /** z-index for draw ordering. */
  zIndex: number;
}

export interface GalaxyGlowCommand {
  kind: "glow";
  /** Center x. */
  x: number;
  /** Center y. */
  y: number;
  /** Glow radius (larger than node radius). */
  radius: number;
  /** CSS-compatible glow color. */
  color: string;
  /** Opacity [0, 1]. */
  opacity: number;
  /** Stable node id. */
  nodeId?: string;
  /** z-index for draw ordering. */
  zIndex: number;
}

export interface GalaxyDriftVectorCommand {
  kind: "driftVector";
  /** Start x. */
  x: number;
  /** Start y. */
  y: number;
  /** Delta x (direction × magnitude). */
  dx: number;
  /** Delta y (direction × magnitude). */
  dy: number;
  /** Pointer end x = x + dx. */
  endX: number;
  /** Pointer end y = y + dy. */
  endY: number;
  /** CSS-compatible arrow color. */
  color: string;
  /** Opacity [0, 1]. */
  opacity: number;
  /** Stable node id. */
  nodeId: string;
  /** z-index for draw ordering. */
  zIndex: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Render Options
// ═══════════════════════════════════════════════════════════════════════════

export interface GalaxyCanvasRenderOptions {
  /** Viewport width in logical pixels (default 1000). */
  width?: number;
  /** Viewport height in logical pixels (default 1000). */
  height?: number;
  /** Current zoom level (default "L0"). */
  zoomLevel?: GalaxyZoomLevel;
  /** Background color (default "#0A0A14" — deep space). */
  backgroundColor?: string;
  /** Whether to emit text commands for labels (default true). */
  showLabels?: boolean;
  /** Whether to emit driftVector commands (default true). */
  showDriftVectors?: boolean;
  /** Whether to suppress all motion (default false). */
  reducedMotion?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Canvas Render Summary
// ═══════════════════════════════════════════════════════════════════════════

export interface GalaxyCanvasRenderSummary {
  totalCommands: number;
  commandsByKind: Record<string, number>;
  nodeCommands: number;
  edgeCommands: number;
  textCommands: number;
  driftVectorCommands: number;
  zoomLevel: GalaxyZoomLevel;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const BACKGROUND_Z = 0;
const GLOW_Z = 5;
const EDGE_Z_BASE = 10;
const NODE_Z_BASE = 50;
const LABEL_Z = 200;
const DRIFT_Z = 300;

const DEFAULT_BG_COLOR = "#0A0A14";
const NEBULA_GLOW_COLOR = "rgba(80, 100, 180, 0.06)";
const DRIFT_WARM_COLOR = "#FF6347";
const DRIFT_COOL_COLOR = "#6495ED";
const LABEL_FONT_SIZE = 11;
const LABEL_COLOR = "#D0D0D0";
const DRIFT_OPACITY_BASE = 0.6;

// ═══════════════════════════════════════════════════════════════════════════
// Main Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a deterministic list of render commands from a galaxy view snapshot.
 *
 * Pure function. No side effects. No browser APIs. Same input → identical output.
 *
 * @param snapshot — MindGalaxyViewSnapshot (V10.33)
 * @param options — render configuration
 * @returns ordered array of GalaxyCanvasRenderCommand
 */
export function buildGalaxyCanvasRenderCommands(
  snapshot: MindGalaxyViewSnapshot,
  options: GalaxyCanvasRenderOptions = {}
): GalaxyCanvasRenderCommand[] {
  const width = options.width ?? 1000;
  const height = options.height ?? 1000;
  const zoomLevel = options.zoomLevel ?? "L0";
  const backgroundColor = options.backgroundColor ?? DEFAULT_BG_COLOR;
  const showLabels = options.showLabels ?? true;
  const rawShowDrift = options.showDriftVectors ?? true;
  const reducedMotion = options.reducedMotion ?? false;

  // Drift vectors only at L4 AND when not reducedMotion AND when explicitly enabled
  const showDriftVectors = zoomLevel === "L4" && !reducedMotion && rawShowDrift;

  const commands: GalaxyCanvasRenderCommand[] = [];

  // ── 1. Background ─────────────────────────────────────────────────────
  commands.push({
    kind: "background",
    color: backgroundColor,
    width,
    height,
    zIndex: BACKGROUND_Z,
  });

  // ── 2. Nebula glow ────────────────────────────────────────────────────
  const cx = snapshot.summary.centerX;
  const cy = snapshot.summary.centerY;
  const nebulaRadius = Math.max(width, height) * 0.45;

  commands.push({
    kind: "glow",
    x: cx,
    y: cy,
    radius: nebulaRadius,
    color: NEBULA_GLOW_COLOR,
    opacity: 0.4,
    zIndex: GLOW_Z,
    nodeId: "nebula_background",
  });

  // ── 3. Filter visible nodes/edges ─────────────────────────────────────
  const visibleNodes = getVisibleGalaxyNodes(snapshot, zoomLevel);
  const visibleEdges = getVisibleGalaxyEdges(snapshot, zoomLevel);

  // ── 4. Cluster glow halos (L1+) ───────────────────────────────────────
  for (const node of visibleNodes) {
    if (node.nodeType === "impact_cluster") {
      commands.push({
        kind: "glow",
        x: node.x,
        y: node.y,
        radius: node.radius * 2.5,
        color: node.fill,
        opacity: 0.12,
        zIndex: GLOW_Z + 1,
        nodeId: node.nodeId,
      });
    }
  }

  // Core glow (always visible at all zoom levels)
  const coreNode = visibleNodes.find((n) => n.nodeType === "personality_core");
  if (coreNode) {
    commands.push({
      kind: "glow",
      x: coreNode.x,
      y: coreNode.y,
      radius: coreNode.radius * 3,
      color: coreNode.fill,
      opacity: 0.15,
      zIndex: GLOW_Z + 2,
      nodeId: coreNode.nodeId,
    });
  }

  // ── 5. Edges ──────────────────────────────────────────────────────────
  for (const edge of visibleEdges) {
    commands.push({
      kind: "line",
      x1: edge.x1,
      y1: edge.y1,
      x2: edge.x2,
      y2: edge.y2,
      stroke: edge.stroke,
      strokeWidth: edge.strokeWidth,
      opacity: edge.opacity,
      directed: edge.directed,
      edgeId: edge.edgeId,
      zIndex: EDGE_Z_BASE,
    });
  }

  // ── 6. Nodes (circles) ────────────────────────────────────────────────
  for (const node of visibleNodes) {
    commands.push({
      kind: "circle",
      x: node.x,
      y: node.y,
      radius: node.radius,
      fill: node.fill,
      stroke: node.stroke,
      strokeWidth: node.risk === "high" ? 3 : node.risk === "medium" ? 2 : 1,
      opacity: node.opacity,
      nodeId: node.nodeId,
      zIndex: node.zIndex, // use the layout's zIndex for stable ordering
    });
  }

  // ── 7. Labels (text) ──────────────────────────────────────────────────
  if (showLabels) {
    // Node labels
    for (const node of visibleNodes) {
      if (node.visibility.labelVisible) {
        commands.push({
          kind: "text",
          x: node.x,
          y: node.y + node.radius + LABEL_FONT_SIZE + 2,
          content: truncateLabel(node.label, 24),
          fontSize: LABEL_FONT_SIZE,
          color: LABEL_COLOR,
          opacity: 0.85,
          nodeId: node.nodeId,
          zIndex: LABEL_Z,
        });
      }
    }

    // Edge labels
    for (const edge of visibleEdges) {
      if (edge.visibility.labelVisible) {
        const midX = (edge.x1 + edge.x2) / 2;
        const midY = (edge.y1 + edge.y2) / 2;
        commands.push({
          kind: "text",
          x: midX,
          y: midY - 4,
          content: edge.edgeType.replace(/_/g, " "),
          fontSize: 9,
          color: edge.stroke,
          opacity: 0.7,
          edgeId: edge.edgeId,
          zIndex: LABEL_Z,
        });
      }
    }
  }

  // ── 8. Drift vectors (L4 only) ────────────────────────────────────────
  if (showDriftVectors) {
    for (const node of visibleNodes) {
      if (node.drift) {
        commands.push({
          kind: "driftVector",
          x: node.x,
          y: node.y,
          dx: node.drift.dx,
          dy: node.drift.dy,
          endX: node.x + node.drift.dx,
          endY: node.y + node.drift.dy,
          color: driftColorForNode(node),
          opacity: DRIFT_OPACITY_BASE * Math.min(1, node.drift.magnitude),
          nodeId: node.nodeId,
          zIndex: DRIFT_Z,
        });
      }
    }
  }

  // ── 9. Sort by zIndex (stable — same zIndex preserves insertion order) ─
  return stableSortByZIndex(commands);
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary Function
// ═══════════════════════════════════════════════════════════════════════════

export function summarizeGalaxyCanvasRender(
  commands: GalaxyCanvasRenderCommand[]
): GalaxyCanvasRenderSummary {
  const commandsByKind: Record<string, number> = {};
  let nodeCommands = 0;
  let edgeCommands = 0;
  let textCommands = 0;
  let driftVectorCommands = 0;
  let zoomLevel: GalaxyZoomLevel = "L0";

  for (const cmd of commands) {
    commandsByKind[cmd.kind] = (commandsByKind[cmd.kind] ?? 0) + 1;
    switch (cmd.kind) {
      case "circle":
      case "glow":
        if (cmd.nodeId && cmd.nodeId !== "nebula_background") nodeCommands++;
        break;
      case "line":
        edgeCommands++;
        break;
      case "text":
        textCommands++;
        break;
      case "driftVector":
        driftVectorCommands++;
        break;
    }
  }

  // Infer zoomLevel from drift vector presence
  if (driftVectorCommands > 0) zoomLevel = "L4";
  else if (textCommands > commands.filter((c) => c.kind === "circle").length * 0.5) zoomLevel = "L3";
  else if (nodeCommands > 5) zoomLevel = "L2";
  else if (nodeCommands > 1) zoomLevel = "L1";

  return {
    totalCommands: commands.length,
    commandsByKind,
    nodeCommands,
    edgeCommands,
    textCommands,
    driftVectorCommands,
    zoomLevel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Filter by Zoom Level
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Re-filter an existing command list. Useful when the consumer holds a full
 * L4 command list and wants to render a lower zoom level without rebuilding.
 *
 * This is a convenience — the authoritative way is to rebuild with the
 * desired zoomLevel option.
 */
export function filterCommandsByZoomLevel(
  commands: GalaxyCanvasRenderCommand[],
  _zoomLevel: GalaxyZoomLevel
): GalaxyCanvasRenderCommand[] {
  // This function is a pass-through placeholder. The authoritative filtering
  // happens in buildGalaxyCanvasRenderCommands via getVisibleGalaxyNodes/Edges.
  // Filtering an already-built command list by zoom level would require
  // re-associating commands with node/edge visibility metadata, which is
  // better done by rebuilding. This function exists for API symmetry.
  return commands;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function stableSortByZIndex(commands: GalaxyCanvasRenderCommand[]): GalaxyCanvasRenderCommand[] {
  return [...commands].sort((a, b) => a.zIndex - b.zIndex);
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + "…";
}

function driftColorForNode(node: MindGalaxyViewNode): string {
  // Warm (red-orange) for fear/neuroticism-associated nodes
  // Cool (blue) for trust/openness-associated nodes
  // Neutral gray for others
  const type = node.nodeType;
  if (type === "belief" || type === "need") {
    // Needs and beliefs that strengthen → warm; weakening → cool
    return node.drift?.direction === "strengthening" ? DRIFT_WARM_COLOR : DRIFT_COOL_COLOR;
  }
  if (type === "memory" || type === "impact_cluster") {
    return node.drift?.direction === "drifting_outward" ? DRIFT_WARM_COLOR : DRIFT_COOL_COLOR;
  }
  if (node.risk === "high") return DRIFT_WARM_COLOR;
  return DRIFT_COOL_COLOR;
}
