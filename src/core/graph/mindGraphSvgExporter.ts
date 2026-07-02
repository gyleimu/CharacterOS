/**
 * V8.2 Static SVG Exporter — converts GraphLayoutSnapshot to SVG string.
 *
 * Pure function. No DOM. No React. No interactivity.
 * Input: GraphLayoutSnapshot → Output: SVG string.
 */

import type { GraphLayoutSnapshot, LayoutNode, LayoutEdge } from "./mindGraphLayout";

export interface SvgExportOptions {
  /** Viewport width in pixels (default 1000). */
  width?: number;
  /** Viewport height in pixels (default 1000). */
  height?: number;
  /** Background color (default "#0D0D1A"). */
  background?: string;
  /** Whether to include node labels (default true). */
  showLabels?: boolean;
  /** Minimum node radius to show label (default 10). */
  labelMinRadius?: number;
  /** Whether to include legend (default true). */
  showLegend?: boolean;
}

/**
 * Export a GraphLayoutSnapshot to an SVG string.
 *
 * Pure function. Does NOT manipulate DOM.
 */
export function exportGraphToSvg(
  layout: GraphLayoutSnapshot,
  options: SvgExportOptions = {}
): string {
  const w = options.width ?? 1000;
  const h = options.height ?? 1000;
  const bg = options.background ?? "#0D0D1A";
  const showLabels = options.showLabels ?? true;
  const labelMin = options.labelMinRadius ?? 10;
  const showLegend = options.showLegend ?? true;

  // Sort by z-index: edges first, then nodes
  const sortedNodes = [...layout.nodes].sort((a, b) => a.zIndex - b.zIndex);

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`);
  parts.push(`  <rect width="${w}" height="${h}" fill="${bg}"/>`);

  // Render edges
  const nodePosMap = new Map(layout.nodes.map((n) => [n.nodeId, n.position]));
  for (const edge of layout.edges) {
    const src = nodePosMap.get(edge.sourceNodeId);
    const tgt = nodePosMap.get(edge.targetNodeId);
    if (!src || !tgt) continue;

    const s = edge.style;
    parts.push(`  <line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}"`
      + ` stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"/>`);
  }

  // Render nodes
  for (const node of sortedNodes) {
    parts.push(renderNodeSvg(node, showLabels, labelMin));
  }

  // Legend
  if (showLegend) {
    parts.push(renderLegend());
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function renderNodeSvg(node: LayoutNode, showLabels: boolean, labelMin: number): string {
  const { x, y } = node.position;
  const r = node.size.radius;
  const s = node.style;

  // Glow effect for high-risk nodes
  const glow = node.risk === "high"
    ? `  <circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="${s.stroke}" stroke-width="1" opacity="0.3"/>`
    : "";

  const circle = `  <circle cx="${x}" cy="${y}" r="${r}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"/>`;

  // Label
  let label = "";
  if (showLabels && r >= labelMin) {
    const shortLabel = node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label;
    label = `  <text x="${x}" y="${y + r + 12}" text-anchor="middle" fill="#CCCCCC" font-size="10" font-family="monospace">${escapeXml(shortLabel)}</text>`;
  }

  return [glow, circle, label].filter(Boolean).join("\n");
}

function renderLegend(): string {
  const items = [
    { label: "Core", fill: "#FFD700" },
    { label: "Memory", fill: "#87CEEB" },
    { label: "Cluster", fill: "rgba(100,149,237,0.3)" },
    { label: "Belief", fill: "#98FB98" },
    { label: "Need", fill: "#2F2F2F" },
    { label: "Desire", fill: "#FF6347" },
    { label: "Bias", fill: "#FFA500" },
    { label: "Signal", fill: "#00FF7F" },
  ];
  const x = 20;
  let y = 20;
  const parts: string[] = [];
  parts.push(`  <g transform="translate(${x},${y})">`);
  for (const item of items) {
    parts.push(`    <circle cx="6" cy="${y - 20 + 6}" r="5" fill="${item.fill}" stroke="#444" stroke-width="0.5"/>`);
    parts.push(`    <text x="16" y="${y - 20 + 10}" fill="#AAA" font-size="9" font-family="monospace">${item.label}</text>`);
    y += 16;
  }
  parts.push("  </g>");
  return parts.join("\n");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
