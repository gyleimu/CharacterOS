/**
 * V10.37 Galaxy Frame Composer — composes V10.33–V10.36 layers into a single
 * deterministic "galaxy frame" for one moment in time.
 *
 * Pipeline:
 *   MindGalaxyViewSnapshot
 *     → buildGalaxyZoomState(scale)          [V10.35]
 *     → buildGalaxyDriftAnimationSnapshot()  [V10.36]
 *     → sampleGalaxyDriftSnapshot(timeMs)    [V10.36]
 *     → buildGalaxyCanvasRenderCommands()    [V10.34]
 *     → applyDriftFrameToCommands()          [V10.36]
 *     → GalaxyFrame
 *
 * Pure functions. No DOM. No Canvas. No browser APIs. No mutation.
 */

import type { MindGalaxyViewSnapshot } from "./mindGalaxyViewTypes";
import type { GalaxyZoomScale, GalaxyZoomState } from "./mindGalaxyZoomLod";
import { buildGalaxyZoomState } from "./mindGalaxyZoomLod";
import type { GalaxyDriftMotionMode, GalaxyDriftAnimationSnapshot } from "./mindGalaxyDriftAnimation";
import {
  buildGalaxyDriftAnimationSnapshot,
  sampleGalaxyDriftSnapshot,
  applyDriftFrameToCommands,
} from "./mindGalaxyDriftAnimation";
import type { GalaxyCanvasRenderCommand, GalaxyCanvasRenderOptions } from "./mindGalaxyCanvasRenderer";
import {
  buildGalaxyCanvasRenderCommands,
  summarizeGalaxyCanvasRender,
} from "./mindGalaxyCanvasRenderer";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface GalaxyFrameComposeOptions {
  /** Viewport width in logical pixels (default 1000). */
  width?: number;
  /** Viewport height in logical pixels (default 1000). */
  height?: number;
  /** Zoom scale [0.25, 8.0] (default 1.0 → L1). */
  scale?: GalaxyZoomScale;
  /** Horizontal pan offset in logical pixels (default 0). */
  panX?: number;
  /** Vertical pan offset in logical pixels (default 0). */
  panY?: number;
  /** Simulated time in milliseconds for drift sampling (default 0). */
  timeMs?: number;
  /** Drift motion mode (default "visible"). */
  motionMode?: GalaxyDriftMotionMode;
  /** Accessibility flag (default false). */
  reducedMotion?: boolean;
  /** Whether to include text label commands (default true). */
  showLabels?: boolean;
  /** Whether to include drift vector arrow commands (default true). */
  showDriftVectors?: boolean;
  /** Background color (default "#0A0A14"). */
  backgroundColor?: string;
  /** Deterministic seed for phase/period variation (default "frame-composer"). */
  seed?: string;
}

export interface GalaxyFrame {
  /** Format version. */
  version: "10.37.0";
  /** Character id. */
  characterId: string;
  /** ISO timestamp (from snapshot). */
  generatedAt: string;

  /** Resolved options. */
  options: ResolvedGalaxyFrameOptions;

  /** Current zoom state. */
  zoomState: GalaxyZoomState;

  /** All render commands for this frame (sorted by zIndex). */
  commands: GalaxyCanvasRenderCommand[];

  /** Frame summary. */
  summary: GalaxyFrameSummary;

  /** Per-layer summaries. */
  layers: GalaxyFrameLayerSummary[];
}

export interface ResolvedGalaxyFrameOptions {
  width: number;
  height: number;
  scale: GalaxyZoomScale;
  panX: number;
  panY: number;
  timeMs: number;
  motionMode: GalaxyDriftMotionMode;
  reducedMotion: boolean;
  showLabels: boolean;
  showDriftVectors: boolean;
  backgroundColor: string;
  seed: string;
}

export interface GalaxyFrameSummary {
  totalCommands: number;
  commandsByKind: Record<string, number>;
  zoomLevel: string;
  zoomScale: number;
  driftActive: boolean;
  driftTracksApplied: number;
  labelsVisible: boolean;
  driftVectorsVisible: boolean;
  reducedMotion: boolean;
}

export interface GalaxyFrameLayerSummary {
  layer: string;
  zIndexMin: number;
  zIndexMax: number;
  commandCount: number;
  commandKinds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Defaults
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 1000;
const DEFAULT_SCALE = 1.0;
const DEFAULT_TIME_MS = 0;
const DEFAULT_SEED = "frame-composer";
const DEFAULT_BG = "#0A0A14";

// ═══════════════════════════════════════════════════════════════════════════
// Main Composer
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compose a complete galaxy frame for one moment in time.
 *
 * Pure function. No side effects. Same (snapshot, options) → identical frame.
 *
 * @param snapshot — MindGalaxyViewSnapshot from V10.33
 * @param options — frame compose options
 * @returns GalaxyFrame ready for rendering
 */
export function composeGalaxyFrame(
  snapshot: MindGalaxyViewSnapshot,
  options: GalaxyFrameComposeOptions = {}
): GalaxyFrame {
  // ── Resolve options ──────────────────────────────────────────────────
  const resolved = resolveOptions(options);

  // ── Step 1: Build zoom state from scale ──────────────────────────────
  const zoomState = buildGalaxyZoomState(resolved.scale);

  // ── Step 2: Build drift animation ────────────────────────────────────
  const driftAnimation = buildGalaxyDriftAnimationSnapshot(
    snapshot,
    zoomState,
    {
      motionMode: resolved.motionMode,
      reducedMotion: resolved.reducedMotion,
      seed: resolved.seed,
    }
  );

  // ── Step 3: Build static render commands ─────────────────────────────
  const renderOptions: GalaxyCanvasRenderOptions = {
    width: resolved.width,
    height: resolved.height,
    zoomLevel: zoomState.level,
    backgroundColor: resolved.backgroundColor,
    showLabels: resolved.showLabels,
    showDriftVectors: resolved.showDriftVectors,
    reducedMotion: resolved.reducedMotion,
  };
  const staticCommands = buildGalaxyCanvasRenderCommands(snapshot, renderOptions);

  // ── Step 4: Sample drift frame at timeMs ─────────────────────────────
  const driftFrame = sampleGalaxyDriftSnapshot(driftAnimation, resolved.timeMs);

  // ── Step 5: Apply drift offsets to commands ──────────────────────────
  const commands = resolved.reducedMotion
    ? staticCommands // reducedMotion → no drift offsets applied
    : applyDriftFrameToCommands(staticCommands, driftFrame);

  // ── Step 6: Build summaries ──────────────────────────────────────────
  const canvasSummary = summarizeGalaxyCanvasRender(commands);
  const layers = buildLayerSummaries(commands);

  const driftActive = !resolved.reducedMotion
    && driftAnimation.summary.visibleTracks + driftAnimation.summary.subtleTracks > 0;

  const summary: GalaxyFrameSummary = {
    totalCommands: canvasSummary.totalCommands,
    commandsByKind: canvasSummary.commandsByKind,
    zoomLevel: zoomState.level,
    zoomScale: Math.round(resolved.scale * 10000) / 10000,
    driftActive,
    driftTracksApplied: driftAnimation.summary.totalTracks,
    labelsVisible: resolved.showLabels,
    driftVectorsVisible: resolved.showDriftVectors && !resolved.reducedMotion,
    reducedMotion: resolved.reducedMotion,
  };

  return {
    version: "10.37.0",
    characterId: snapshot.characterId,
    generatedAt: snapshot.generatedAt,
    options: resolved,
    zoomState,
    commands,
    summary,
    layers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Summaries
// ═══════════════════════════════════════════════════════════════════════════

export function summarizeGalaxyFrame(frame: GalaxyFrame): GalaxyFrameSummary {
  return frame.summary;
}

export function getGalaxyFrameLayerSummary(frame: GalaxyFrame): GalaxyFrameLayerSummary[] {
  return frame.layers;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function resolveOptions(opts: GalaxyFrameComposeOptions): ResolvedGalaxyFrameOptions {
  return {
    width: opts.width ?? DEFAULT_WIDTH,
    height: opts.height ?? DEFAULT_HEIGHT,
    scale: opts.scale ?? DEFAULT_SCALE,
    panX: opts.panX ?? 0,
    panY: opts.panY ?? 0,
    timeMs: opts.timeMs ?? DEFAULT_TIME_MS,
    motionMode: opts.motionMode ?? "visible",
    reducedMotion: opts.reducedMotion ?? false,
    showLabels: opts.showLabels ?? true,
    showDriftVectors: opts.showDriftVectors ?? true,
    backgroundColor: opts.backgroundColor ?? DEFAULT_BG,
    seed: opts.seed ?? DEFAULT_SEED,
  };
}

/** Named z-index layers for summary grouping. */
const LAYER_DEFS: { layer: string; zMin: number; zMax: number }[] = [
  { layer: "background", zMin: 0, zMax: 0 },
  { layer: "nebula_glow", zMin: 1, zMax: 9 },
  { layer: "edges", zMin: 10, zMax: 49 },
  { layer: "nodes", zMin: 50, zMax: 199 },
  { layer: "labels", zMin: 200, zMax: 299 },
  { layer: "drift_vectors", zMin: 300, zMax: 999 },
];

function buildLayerSummaries(commands: GalaxyCanvasRenderCommand[]): GalaxyFrameLayerSummary[] {
  return LAYER_DEFS.map((def) => {
    const layerCommands = commands.filter(
      (c) => c.zIndex >= def.zMin && c.zIndex <= def.zMax
    );
    const kinds = [...new Set(layerCommands.map((c) => c.kind))];
    return {
      layer: def.layer,
      zIndexMin: def.zMin,
      zIndexMax: def.zMax,
      commandCount: layerCommands.length,
      commandKinds: kinds,
    };
  });
}
