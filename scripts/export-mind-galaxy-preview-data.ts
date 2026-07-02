/**
 * V10.47 — Export Mind Galaxy preview data from real CharacterOS state.
 *
 * Uses the V10.47 MindGalaxyPreviewData contract for type-safe output
 * with comprehensive validation before writing.
 *
 * Usage:
 *   npx tsx scripts/export-mind-galaxy-preview-data.ts
 *
 * Output:
 *   previews/mind-galaxy-real-data.json
 *
 * Does NOT call any API. Does NOT call LLM. Does NOT mutate state.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../src/core/character/characterBlueprint";
import { buildMindGraphSnapshot } from "../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../src/core/graph/mindGraphLayout";
import { buildMindGalaxyViewSnapshot } from "../src/core/graph/mindGalaxyViewTypes";
import {
  validateMindGalaxyPreviewData,
  type MindGalaxyPreviewData,
  type MindGalaxyPreviewNode,
  type MindGalaxyPreviewEdge,
} from "../src/core/graph/mindGalaxyPreviewContract";

const PREVIEW_VERSION = "10.47.0";
const PREVIEW_GENERATED_AT = "2026-06-28T00:00:00.000Z";

// ── Build state ──────────────────────────────────────────────────────────

const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
  seedInitialExperiences: true,
});

const graph = buildMindGraphSnapshot(state);
const layout = buildGraphLayoutSnapshot(graph);
const view = buildMindGalaxyViewSnapshot(graph, layout);

// ── Convert to contract types ────────────────────────────────────────────

const previewNodes: MindGalaxyPreviewNode[] = view.nodes.map((n) => ({
  id: n.nodeId,
  type: n.nodeType,
  label: n.label.slice(0, 40),
  x: n.x,
  y: n.y,
  r: n.radius,
  fill: n.fill,
  stroke: n.stroke,
  w: n.weight,
  risk: n.risk,
  z: n.zIndex,
  drift: n.drift ? { a: n.drift.angle, m: n.drift.magnitude } : undefined,
}));

const previewEdges: MindGalaxyPreviewEdge[] = view.edges.map((e) => ({
  id: e.edgeId,
  t: e.edgeType,
  s: e.sourceNodeId,
  d: e.targetNodeId,
  w: e.weight,
  style: { stroke: e.stroke, sw: e.strokeWidth, op: e.opacity },
  dir: e.directed ? 1 : 0,
}));

const output: MindGalaxyPreviewData = {
  version: PREVIEW_VERSION,
  generatedAt: PREVIEW_GENERATED_AT,
  characterId: view.characterId,
  source: "buildMindGalaxyViewSnapshot from CharacterOS blueprint (LinFan, seeded)",
  centerX: view.summary.centerX,
  centerY: view.summary.centerY,
  totalNodes: previewNodes.length,
  totalEdges: previewEdges.length,
  driftNodeCount: previewNodes.filter((n) => n.drift !== undefined).length,
  _integrity: {
    fullStateIncluded: false,
    rawStateIncluded: false,
    clusterPayloadIncluded: false,
    memoryPayloadIncluded: false,
    routinePayloadIncluded: false,
  },
  nodes: previewNodes,
  edges: previewEdges,
};

// ── Validate against contract ────────────────────────────────────────────

const validation = validateMindGalaxyPreviewData(output);
if (!validation.valid) {
  console.error(`FAIL: Contract validation failed with ${validation.summary.errorCount} error(s):`);
  for (const issue of validation.issues) {
    if (issue.severity === "error") console.error(`  [${issue.severity}] ${issue.path}: ${issue.message}`);
  }
  for (const issue of validation.issues) {
    if (issue.severity === "warning") console.warn(`  [${issue.severity}] ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}

if (validation.summary.warningCount > 0) {
  console.warn(`Validation warnings (${validation.summary.warningCount}):`);
  for (const issue of validation.issues) {
    if (issue.severity === "warning") console.warn(`  ${issue.path}: ${issue.message}`);
  }
}

// ── Write ────────────────────────────────────────────────────────────────

const json = JSON.stringify(output);
const outPath = resolve("previews/mind-galaxy-real-data.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

const sizeKb = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);
console.log(`Generated: ${outPath}`);
console.log(`  Version: ${PREVIEW_VERSION}`);
console.log(`  Nodes: ${previewNodes.length}, Edges: ${previewEdges.length}`);
console.log(`  Drift nodes: ${output.driftNodeCount}`);
console.log(`  File size: ${sizeKb} KB`);
console.log(`  Contract validation: PASS (0 errors, ${validation.summary.warningCount} warnings)`);
