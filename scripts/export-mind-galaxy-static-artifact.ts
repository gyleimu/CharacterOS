/**
 * V10.50 — Export Mind Galaxy Static Artifact Package.
 *
 * Creates a self-contained directory that can be opened offline (file://)
 * or served as static files. No CharacterOS runtime, API, or server needed.
 *
 * Usage:
 *   npx tsx scripts/export-mind-galaxy-static-artifact.ts
 *
 * Output:
 *   outputs/mind-galaxy-artifact/
 *     index.html
 *     mind-galaxy-preview.js
 *     mind-galaxy-real-data.json
 *     manifest.json
 *     README.md
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../src/core/character/characterBlueprint";
import { buildMindGraphSnapshot } from "../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../src/core/graph/mindGraphLayout";
import { buildMindGalaxyViewSnapshot } from "../src/core/graph/mindGalaxyViewTypes";
import {
  validateMindGalaxyPreviewData,
  summarizeMindGalaxyPreviewData,
  type MindGalaxyPreviewData,
  type MindGalaxyPreviewNode,
  type MindGalaxyPreviewEdge,
} from "../src/core/graph/mindGalaxyPreviewContract";

const ARTIFACT_VERSION = "10.50.0";
const PREVIEW_GENERATED_AT = "2026-06-28T00:00:00.000Z";
const OUT_DIR = resolve("outputs/mind-galaxy-artifact");

// ── Step 1: Generate preview data ────────────────────────────────────────

console.log("Generating Mind Galaxy preview data...");

const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
  seedInitialExperiences: true,
});
const graph = buildMindGraphSnapshot(state);
const layout = buildGraphLayoutSnapshot(graph);
const view = buildMindGalaxyViewSnapshot(graph, layout);

const previewNodes: MindGalaxyPreviewNode[] = view.nodes.map((n) => ({
  id: n.nodeId, type: n.nodeType, label: n.label.slice(0, 40),
  x: n.x, y: n.y, r: n.radius, fill: n.fill, stroke: n.stroke,
  w: n.weight, risk: n.risk, z: n.zIndex,
  drift: n.drift ? { a: n.drift.angle, m: n.drift.magnitude } : undefined,
}));

const previewEdges: MindGalaxyPreviewEdge[] = view.edges.map((e) => ({
  id: e.edgeId, t: e.edgeType, s: e.sourceNodeId, d: e.targetNodeId,
  w: e.weight, style: { stroke: e.stroke, sw: e.strokeWidth, op: e.opacity },
  dir: e.directed ? 1 : 0,
}));

const previewData: MindGalaxyPreviewData = {
  version: "10.47.0",
  generatedAt: PREVIEW_GENERATED_AT,
  characterId: view.characterId,
  source: "buildMindGalaxyViewSnapshot from CharacterOS blueprint (LinFan, seeded)",
  centerX: view.summary.centerX,
  centerY: view.summary.centerY,
  totalNodes: previewNodes.length,
  totalEdges: previewEdges.length,
  driftNodeCount: previewNodes.filter((n) => n.drift !== undefined).length,
  _integrity: {
    fullStateIncluded: false, rawStateIncluded: false,
    clusterPayloadIncluded: false, memoryPayloadIncluded: false,
    routinePayloadIncluded: false,
  },
  nodes: previewNodes,
  edges: previewEdges,
};

// ── Step 2: Validate ─────────────────────────────────────────────────────

const validation = validateMindGalaxyPreviewData(previewData);
if (!validation.valid) {
  console.error(`Contract validation FAILED (${validation.summary.errorCount} errors):`);
  for (const issue of validation.issues) {
    if (issue.severity === "error") console.error(`  ${issue.path}: ${issue.message}`);
  }
  process.exit(1);
}
console.log(`Contract validation: PASS (0 errors, ${validation.summary.warningCount} warnings)`);

// ── Step 3: Create output directory ──────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });
console.log(`Output: ${OUT_DIR}`);

// ── Step 4: Write data JSON ──────────────────────────────────────────────

const dataPath = resolve(OUT_DIR, "mind-galaxy-real-data.json");
writeFileSync(dataPath, JSON.stringify(previewData, null, 2), "utf-8");
console.log(`  mind-galaxy-real-data.json (${previewNodes.length} nodes, ${previewEdges.length} edges)`);

// ── Step 5: Copy preview JS ──────────────────────────────────────────────

const jsSrc = resolve("previews/mind-galaxy-preview.js");
const jsDst = resolve(OUT_DIR, "mind-galaxy-preview.js");
copyFileSync(jsSrc, jsDst);
console.log("  mind-galaxy-preview.js (copied from previews/)");

// ── Step 6: Build index.html with embedded data ──────────────────────────

const htmlSrc = resolve("previews/mind-galaxy-preview.html");
const htmlTemplate = readFileSync(htmlSrc, "utf-8");
const dataJson = JSON.stringify(previewData);

// Inject embedded data bootstrap before the preview script so file:// opens without fetch.
const injectedHtml = htmlTemplate.replace(
  `<script src="mind-galaxy-preview.js"></script>`,
  `<script>\nwindow.__MIND_GALAXY_PREVIEW_DATA__ = ${dataJson};\n</script>\n<script src="mind-galaxy-preview.js"></script>`
);

const htmlDst = resolve(OUT_DIR, "index.html");
writeFileSync(htmlDst, injectedHtml, "utf-8");
console.log(`  index.html (with embedded data: ${(dataJson.length / 1024).toFixed(1)} KB inline)`);

// ── Step 7: Write manifest ───────────────────────────────────────────────

const summary = summarizeMindGalaxyPreviewData(previewData);

const manifest = {
  artifactVersion: ARTIFACT_VERSION,
  generatedAt: PREVIEW_GENERATED_AT,
  characterId: previewData.characterId,
  source: previewData.source,
  dataVersion: previewData.version,
  contract: "mindGalaxyPreviewContract v10.47.0",
  stats: {
    nodeCount: summary.nodeCount,
    edgeCount: summary.edgeCount,
    driftNodeCount: summary.driftNodeCount,
    nodeTypes: summary.nodeTypes,
  },
  integrity: previewData._integrity,
  files: [
    "index.html",
    "mind-galaxy-preview.js",
    "mind-galaxy-real-data.json",
    "manifest.json",
    "README.md",
  ],
};

const manifestPath = resolve(OUT_DIR, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
console.log("  manifest.json");

// ── Step 8: Write README ─────────────────────────────────────────────────

const readme = `# Mind Galaxy Static Artifact

## What is this?

This is a self-contained, offline snapshot of a CharacterOS Mind Galaxy view.
It visualizes the personality structure of character **"${previewData.characterId}"** as a
zoomable nebula-like galaxy.

**It is an observation instrument, not a product.**

## How to open

Open \`index.html\` in any modern desktop browser (Chrome, Firefox, Edge, Safari).
No server required. No internet connection needed.

## What's included

| File | Purpose |
|------|---------|
| index.html | Self-contained viewer with embedded data |
| mind-galaxy-preview.js | Canvas 2D rendering engine |
| mind-galaxy-real-data.json | Raw preview data (standalone JSON) |
| manifest.json | Metadata and integrity summary |
| README.md | This file |

## What is NOT included

- No CharacterPhysicsState raw dump
- No full memory contents
- No personality coordinate internals
- No cluster Map entries
- No procedural routines payload
- No write/edit/save capability
- No API endpoints
- No server dependency
- No WebGL / Three.js / 3D

## How to use

- **Scroll** to zoom in/out
- **Drag** to pan
- **Click L0-L4** to jump to zoom levels
- **Pause** to freeze drift animation
- **Motion** to toggle reduced motion
- **Drift** to switch subtle/visible drift mode
- **Real/Fixture** to toggle data source
- **Debug** to inspect scale, visible counts, time sampling, and snapshot summaries
- **Freeze Time / Step** to inspect deterministic drift frames without changing state
- **Presets** to jump between Outer Nebula, Memory Field, and Drift Inspect views

## How to regenerate

\`\`\`bash
npx tsx scripts/export-mind-galaxy-static-artifact.ts
\`\`\`

This requires a CharacterOS development environment.

## Current limitations

- Desktop-first (mouse wheel + drag)
- Canvas 2D only (no WebGL)
- Static snapshot — does not update with character state changes
- Single character only
- ${summary.nodeCount} nodes, ${summary.edgeCount} edges

## Version

Artifact v${ARTIFACT_VERSION}
Data contract v${previewData.version}
`;

const readmePath = resolve(OUT_DIR, "README.md");
writeFileSync(readmePath, readme, "utf-8");
console.log("  README.md");

// ── Done ─────────────────────────────────────────────────────────────────

const files = ["index.html", "mind-galaxy-preview.js", "mind-galaxy-real-data.json", "manifest.json", "README.md"];
console.log(`\nArtifact created in ${OUT_DIR}/`);
console.log(`  Character: ${previewData.characterId}`);
console.log(`  Nodes: ${summary.nodeCount} | Edges: ${summary.edgeCount} | Drift: ${summary.driftNodeCount}`);
console.log(`  Open: file:///${OUT_DIR.replace(/\\/g, "/")}/index.html`);
console.log("Done.");
