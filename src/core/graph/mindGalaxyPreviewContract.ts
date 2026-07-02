/**
 * V10.47 Mind Galaxy Preview Data Contract — frozen schema for the Mind Galaxy
 * preview JSON format. This contract is the stable interface between the
 * CharacterOS graph pipeline and any consumer (static HTML preview, debug
 * instrument, future product surface).
 *
 * No DOM. No Canvas. No browser APIs. Pure data types + validation.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Core Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MindGalaxyPreviewDrift {
  /** Angle in radians [0, 2PI). */
  a: number;
  /** Magnitude in logical pixels [0.05, 2.0]. */
  m: number;
}

export interface MindGalaxyPreviewNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
  w: number;
  risk?: string;
  z: number;
  drift?: MindGalaxyPreviewDrift;
}

export interface MindGalaxyPreviewEdgeStyle {
  stroke: string;
  sw: number;
  op: number;
}

export interface MindGalaxyPreviewEdge {
  id: string;
  t: string;
  s: string;
  d: string;
  w: number;
  style: MindGalaxyPreviewEdgeStyle;
  dir: number;
}

export interface MindGalaxyPreviewIntegrity {
  fullStateIncluded: boolean;
  rawStateIncluded: boolean;
  clusterPayloadIncluded: boolean;
  memoryPayloadIncluded: boolean;
  routinePayloadIncluded: boolean;
}

export interface MindGalaxyPreviewData {
  version: string;
  generatedAt: string;
  characterId: string;
  source: string;
  centerX: number;
  centerY: number;
  totalNodes: number;
  totalEdges: number;
  driftNodeCount: number;
  _integrity: MindGalaxyPreviewIntegrity;
  nodes: MindGalaxyPreviewNode[];
  edges: MindGalaxyPreviewEdge[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Types
// ═══════════════════════════════════════════════════════════════════════════

export type MindGalaxyPreviewValidationSeverity = "error" | "warning";

export interface MindGalaxyPreviewValidationIssue {
  path: string;
  message: string;
  severity: MindGalaxyPreviewValidationSeverity;
}

export interface MindGalaxyPreviewValidationResult {
  valid: boolean;
  issues: MindGalaxyPreviewValidationIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const FORBIDDEN_TOP_KEYS = [
  "finalState",
  "CharacterPhysicsState",
  "serializedState",
  "rawCluster",
  "coordinate",
  "proceduralRoutines",
  "rawMemories",
  "memoryPayload",
  "clusterPayload",
];

const REQUIRED_TOP_KEYS = [
  "version",
  "generatedAt",
  "characterId",
  "source",
  "centerX",
  "centerY",
  "totalNodes",
  "totalEdges",
  "driftNodeCount",
  "_integrity",
  "nodes",
  "edges",
];

const REQUIRED_NODE_KEYS = ["id", "type", "label", "x", "y", "r", "fill", "stroke", "w", "z"];
const REQUIRED_EDGE_KEYS = ["id", "t", "s", "d", "w", "style", "dir"];

// ═══════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════

function issue(path: string, message: string, severity: MindGalaxyPreviewValidationSeverity): MindGalaxyPreviewValidationIssue {
  return { path, message, severity };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Validate unknown input against the MindGalaxyPreviewData contract.
 * Returns a structured validation result. Never throws.
 */
export function validateMindGalaxyPreviewData(input: unknown): MindGalaxyPreviewValidationResult {
  const issues: MindGalaxyPreviewValidationIssue[] = [];
  const add = (path: string, msg: string, sev: MindGalaxyPreviewValidationSeverity = "error") => issues.push(issue(path, msg, sev));

  if (!isRecord(input)) {
    add("$", "input must be a non-null object");
    return { valid: false, issues, summary: { errorCount: issues.length, warningCount: 0, nodeCount: 0, edgeCount: 0 } };
  }

  // ── Required top-level keys ─────────────────────────────────────────
  for (const key of REQUIRED_TOP_KEYS) {
    if (!(key in input)) add(`$.${key}`, `missing required field "${key}"`);
  }

  // ── Forbidden keys ──────────────────────────────────────────────────
  for (const key of FORBIDDEN_TOP_KEYS) {
    if (key in input) add(`$.${key}`, `forbidden raw-state key "${key}" present`);
  }

  // ── Scalar fields ───────────────────────────────────────────────────
  if (!isNonEmptyStr(input.version)) add("$.version", "version must be a non-empty string");
  if (!isNonEmptyStr(input.generatedAt)) add("$.generatedAt", "generatedAt must be a non-empty string");
  if (!isNonEmptyStr(input.characterId)) add("$.characterId", "characterId must be a non-empty string");
  if (typeof input.source !== "string") add("$.source", "source must be a string");

  if (!isFiniteNum(input.centerX)) add("$.centerX", "centerX must be a finite number");
  if (!isFiniteNum(input.centerY)) add("$.centerY", "centerY must be a finite number");

  if (!Number.isInteger(input.totalNodes) || (input.totalNodes as number) < 0) {
    add("$.totalNodes", "totalNodes must be a non-negative integer");
  }
  if (!Number.isInteger(input.totalEdges) || (input.totalEdges as number) < 0) {
    add("$.totalEdges", "totalEdges must be a non-negative integer");
  }
  if (!Number.isInteger(input.driftNodeCount) || (input.driftNodeCount as number) < 0) {
    add("$.driftNodeCount", "driftNodeCount must be a non-negative integer");
  }

  // ── _integrity ──────────────────────────────────────────────────────
  if (!isRecord(input._integrity)) {
    add("$._integrity", "_integrity must be an object");
  }

  // ── Nodes array ─────────────────────────────────────────────────────
  const nodes = Array.isArray(input.nodes) ? input.nodes : null;
  if (!nodes) {
    add("$.nodes", "nodes must be an array");
  } else {
    if (nodes.length !== input.totalNodes) {
      add("$.totalNodes", `totalNodes=${input.totalNodes} but nodes.length=${nodes.length}`);
    }
    const driftCount = nodes.filter((n: unknown) => isRecord(n) && n.drift !== undefined && n.drift !== null).length;
    if (driftCount !== input.driftNodeCount) {
      add("$.driftNodeCount", `driftNodeCount=${input.driftNodeCount} but ${driftCount} nodes have drift`, "warning");
    }

    const nodeIds = new Set<string>();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const base = `$.nodes[${i}]`;
      if (!isRecord(n)) { add(base, "node must be an object"); continue; }

      for (const key of REQUIRED_NODE_KEYS) {
        if (!(key in n)) add(`${base}.${key}`, `missing required field "${key}"`);
      }

      // Check for forbidden keys in node
      for (const fk of ["serializedState", "rawCluster", "coordinate", "rawMemory"]) {
        if (fk in n) add(`${base}.${fk}`, `forbidden key "${fk}" in node`);
      }

      if (!isNonEmptyStr(n.id)) add(`${base}.id`, "node id must be a non-empty string");
      else if (nodeIds.has(n.id as string)) add(`${base}.id`, `duplicate node id "${n.id}"`);
      else nodeIds.add(n.id as string);

      if (!isNonEmptyStr(n.type)) add(`${base}.type`, "node type must be a non-empty string");
      if (!isFiniteNum(n.x)) add(`${base}.x`, `x must be finite, got ${n.x}`);
      if (!isFiniteNum(n.y)) add(`${base}.y`, `y must be finite, got ${n.y}`);
      if (!isFiniteNum(n.r) || (n.r as number) < 0) add(`${base}.r`, `r must be >= 0, got ${n.r}`);
      if (!isFiniteNum(n.z) || !Number.isInteger(n.z)) add(`${base}.z`, `z must be an integer`);
      if (!isFiniteNum(n.w) || (n.w as number) < 0 || (n.w as number) > 1) {
        add(`${base}.w`, `w must be in [0,1], got ${n.w}`, "warning");
      }

      // Drift validation
      if (n.drift !== undefined && n.drift !== null) {
        if (!isRecord(n.drift)) {
          add(`${base}.drift`, "drift must be an object or null");
        } else {
          if (!isFiniteNum(n.drift.a)) add(`${base}.drift.a`, "drift angle must be finite");
          if (!isFiniteNum(n.drift.m) || (n.drift.m as number) < 0) add(`${base}.drift.m`, "drift magnitude must be >= 0");
        }
      }
    }

    // ── Edges array ───────────────────────────────────────────────────
    const edges = Array.isArray(input.edges) ? input.edges : null;
    if (!edges) {
      add("$.edges", "edges must be an array");
    } else {
      if (edges.length !== input.totalEdges) {
        add("$.totalEdges", `totalEdges=${input.totalEdges} but edges.length=${edges.length}`);
      }

      const edgeIds = new Set<string>();
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const base = `$.edges[${i}]`;
        if (!isRecord(e)) { add(base, "edge must be an object"); continue; }

        for (const key of REQUIRED_EDGE_KEYS) {
          if (!(key in e)) add(`${base}.${key}`, `missing required field "${key}"`);
        }

        if (!isNonEmptyStr(e.id)) add(`${base}.id`, "edge id must be a non-empty string");
        else if (edgeIds.has(e.id as string)) add(`${base}.id`, `duplicate edge id "${e.id}"`);
        else edgeIds.add(e.id as string);

        if (!isNonEmptyStr(e.t)) add(`${base}.t`, "edge type must be a non-empty string");
        if (!isNonEmptyStr(e.s)) add(`${base}.s`, "edge source must be a non-empty string");
        else if (nodeIds.size > 0 && !nodeIds.has(e.s as string)) add(`${base}.s`, `edge source "${e.s}" not found in nodes`, "warning");
        if (!isNonEmptyStr(e.d)) add(`${base}.d`, "edge target must be a non-empty string");
        else if (nodeIds.size > 0 && !nodeIds.has(e.d as string)) add(`${base}.d`, `edge target "${e.d}" not found in nodes`, "warning");
        if (!isFiniteNum(e.w)) add(`${base}.w`, "edge weight must be finite");

        // Style
        if (!isRecord(e.style)) {
          add(`${base}.style`, "edge style must be an object");
        } else {
          if (typeof e.style.stroke !== "string") add(`${base}.style.stroke`, "stroke must be a string");
          if (!isFiniteNum(e.style.sw) || (e.style.sw as number) < 0) add(`${base}.style.sw`, "sw must be >= 0");
          if (!isFiniteNum(e.style.op) || (e.style.op as number) < 0 || (e.style.op as number) > 1) {
            add(`${base}.style.op`, `op must be in [0,1], got ${e.style.op}`, "warning");
          }
        }

        if (typeof e.dir !== "number" || (e.dir !== 0 && e.dir !== 1)) {
          add(`${base}.dir`, `dir must be 0 or 1, got ${e.dir}`);
        }
      }
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  return {
    valid: errors.length === 0,
    issues,
    summary: {
      errorCount: errors.length,
      warningCount: issues.length - errors.length,
      nodeCount: Array.isArray(input.nodes) ? input.nodes.length : 0,
      edgeCount: Array.isArray(input.edges) ? input.edges.length : 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Assert & Summarize & Normalize
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assert that input is valid MindGalaxyPreviewData. Throws on validation failure.
 */
export function assertMindGalaxyPreviewData(input: unknown): MindGalaxyPreviewData {
  const result = validateMindGalaxyPreviewData(input);
  if (!result.valid) {
    const msg = result.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.path}: ${i.message}`)
      .join("; ");
    throw new Error(`MindGalaxyPreviewData validation failed: ${msg}`);
  }
  return input as MindGalaxyPreviewData;
}

export interface MindGalaxyPreviewDataSummary {
  version: string;
  characterId: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  driftNodeCount: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
  hasRiskHigh: number;
  hasRiskMedium: number;
  centerX: number;
  centerY: number;
}

/**
 * Summarize preview data into compact stats. Pure function.
 */
export function summarizeMindGalaxyPreviewData(data: MindGalaxyPreviewData): MindGalaxyPreviewDataSummary {
  const nodeTypes: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};
  let hasRiskHigh = 0;
  let hasRiskMedium = 0;

  for (const n of data.nodes) {
    nodeTypes[n.type] = (nodeTypes[n.type] ?? 0) + 1;
    if (n.risk === "high") hasRiskHigh++;
    if (n.risk === "medium") hasRiskMedium++;
  }
  for (const e of data.edges) {
    edgeTypes[e.t] = (edgeTypes[e.t] ?? 0) + 1;
  }

  return {
    version: data.version,
    characterId: data.characterId,
    generatedAt: data.generatedAt,
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    driftNodeCount: data.driftNodeCount,
    nodeTypes,
    edgeTypes,
    hasRiskHigh,
    hasRiskMedium,
    centerX: data.centerX,
    centerY: data.centerY,
  };
}

/**
 * Normalize preview data: ensure arrays are fresh copies, drift defaults applied.
 * Returns a new object — does not mutate input.
 */
export function normalizeMindGalaxyPreviewData(data: MindGalaxyPreviewData): MindGalaxyPreviewData {
  return {
    version: data.version,
    generatedAt: data.generatedAt,
    characterId: data.characterId,
    source: data.source,
    centerX: data.centerX,
    centerY: data.centerY,
    totalNodes: data.nodes.length,
    totalEdges: data.edges.length,
    driftNodeCount: data.nodes.filter((n) => n.drift !== undefined).length,
    _integrity: { ...data._integrity },
    nodes: data.nodes.map((n) => {
      const node: MindGalaxyPreviewNode = {
        id: n.id, type: n.type, label: n.label,
        x: n.x, y: n.y, r: n.r, fill: n.fill, stroke: n.stroke,
        w: n.w, z: n.z,
      };
      if (n.risk !== undefined) node.risk = n.risk;
      if (n.drift) node.drift = { a: n.drift.a, m: n.drift.m };
      return node;
    }),
    edges: data.edges.map((e) => ({
      id: e.id,
      t: e.t,
      s: e.s,
      d: e.d,
      w: e.w,
      style: { stroke: e.style.stroke, sw: e.style.sw, op: e.style.op },
      dir: e.dir,
    })),
  };
}
