/**
 * V10.35 Zoom / LOD System — pure data layer for zoom scale, level-of-detail
 * visibility, opacity curves, viewport transforms, and zoom transitions.
 *
 * No DOM. No Canvas. No wheel events. No browser APIs. Pure math.
 *
 * Designed to feed the V10.34 render command builder with per-element opacity
 * and the V10.36 animation system with interpolated zoom transitions.
 */

import type { GalaxyZoomLevel } from "./mindGalaxyViewTypes";
import { GALAXY_ZOOM_LEVELS } from "./mindGalaxyViewTypes";
import type { MindGraphNodeType, MindGraphEdgeType } from "./mindGraphTypes";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

export const GALAXY_ZOOM_SCALE_MIN = 0.25;
export const GALAXY_ZOOM_SCALE_MAX = 8.0;

/** Fraction of each band where new elements fade in from 0→1. */
export const GALAXY_LOD_TRANSITION_FRACTION = 0.2;

// ── Zoom Band Definitions ────────────────────────────────────────────────

export interface GalaxyZoomBand {
  level: GalaxyZoomLevel;
  /** Inclusive lower bound of this band. */
  minScale: number;
  /** Exclusive upper bound of this band. */
  maxScale: number;
  /** Scale at which opacity reaches 1.0 for this band's elements. */
  fullOpacityAt: number;
}

/**
 * Ordered zoom bands L0→L4.
 * Each band spans a [minScale, maxScale) range.
 * The first fraction (TRANSITION_FRACTION) of each band is the fade-in zone.
 */
export const GALAXY_ZOOM_BANDS: readonly GalaxyZoomBand[] = [
  { level: "L0", minScale: 0.25, maxScale: 0.75, fullOpacityAt: 0.25 + (0.75 - 0.25) * GALAXY_LOD_TRANSITION_FRACTION },
  { level: "L1", minScale: 0.75, maxScale: 1.5,  fullOpacityAt: 0.75 + (1.5 - 0.75) * GALAXY_LOD_TRANSITION_FRACTION },
  { level: "L2", minScale: 1.5,  maxScale: 3.0,  fullOpacityAt: 1.5  + (3.0 - 1.5) * GALAXY_LOD_TRANSITION_FRACTION },
  { level: "L3", minScale: 3.0,  maxScale: 5.0,  fullOpacityAt: 3.0  + (5.0 - 3.0) * GALAXY_LOD_TRANSITION_FRACTION },
  { level: "L4", minScale: 5.0,  maxScale: 8.0,  fullOpacityAt: 5.0  + (8.0 - 5.0) * GALAXY_LOD_TRANSITION_FRACTION },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** A zoom scale value — the raw numeric multiplier. */
export type GalaxyZoomScale = number;

export interface GalaxyZoomState {
  /** Clamped zoom scale [0.25, 8.0]. */
  scale: GalaxyZoomScale;
  /** Current zoom level derived from scale. */
  level: GalaxyZoomLevel;
  /** Current zoom band metadata. */
  band: GalaxyZoomBand;
  /** Position within the current band [0, 1] — 0 = band start, 1 = band end. */
  bandProgress: number;
  /** Whether we are in the fade-in zone of the current band. */
  inTransitionZone: boolean;
  /** Transition progress within the fade-in zone [0, 1] — 0 = just entered, 1 = fully opaque. */
  transitionProgress: number;
}

export interface GalaxyLodVisibility {
  /** Whether this element type is included at this zoom state. */
  visible: boolean;
  /** Opacity [0, 1] — fades in smoothly within the transition zone. */
  opacity: number;
}

export interface GalaxyViewportTransform {
  /** Horizontal pan offset in logical pixels. */
  panX: number;
  /** Vertical pan offset in logical pixels. */
  panY: number;
  /** Zoom scale. */
  scale: GalaxyZoomScale;
}

export interface GalaxyViewportPoint {
  x: number;
  y: number;
}

export interface GalaxyZoomTransition {
  /** Starting scale. */
  fromScale: GalaxyZoomScale;
  /** Target scale. */
  toScale: GalaxyZoomScale;
  /** Duration in milliseconds (for consumer). */
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Scale Clamp
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clamp a zoom scale to [GALAXY_ZOOM_SCALE_MIN, GALAXY_ZOOM_SCALE_MAX].
 * Handles NaN and ±Infinity by returning the min bound.
 */
export function clampGalaxyZoomScale(scale: number): GalaxyZoomScale {
  if (!Number.isFinite(scale)) return GALAXY_ZOOM_SCALE_MIN;
  return Math.max(GALAXY_ZOOM_SCALE_MIN, Math.min(GALAXY_ZOOM_SCALE_MAX, scale));
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoom Level from Scale
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deterministically map a zoom scale to a GalaxyZoomLevel.
 *
 * Band boundaries (inclusive min, exclusive max):
 *   L0: [0.25, 0.75)
 *   L1: [0.75, 1.5)
 *   L2: [1.5,  3.0)
 *   L3: [3.0,  5.0)
 *   L4: [5.0,  8.0]
 */
export function getGalaxyZoomLevelForScale(scale: number): GalaxyZoomLevel {
  const s = clampGalaxyZoomScale(scale);
  for (const band of GALAXY_ZOOM_BANDS) {
    if (s >= band.minScale && s < band.maxScale) return band.level;
  }
  // scale == 8.0 (the max) falls through the loop — it's the upper edge of L4
  return "L4";
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoom State Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a complete GalaxyZoomState from a scale value.
 *
 * Pure function. Deterministic. Same scale → identical state.
 */
export function buildGalaxyZoomState(scale: number): GalaxyZoomState {
  const clamped = clampGalaxyZoomScale(scale);
  const level = getGalaxyZoomLevelForScale(clamped);
  const band = GALAXY_ZOOM_BANDS.find((b) => b.level === level) ?? GALAXY_ZOOM_BANDS[4]!;

  const bandRange = band.maxScale - band.minScale;
  const bandProgress = bandRange > 0
    ? (clamped - band.minScale) / bandRange
    : 0;

  const transitionRange = band.fullOpacityAt - band.minScale;
  const inTransitionZone = transitionRange > 0 && clamped < band.fullOpacityAt;
  const transitionProgress = inTransitionZone && transitionRange > 0
    ? Math.max(0, (clamped - band.minScale) / transitionRange)
    : 1;

  return {
    scale: clamped,
    level,
    band,
    bandProgress,
    inTransitionZone,
    transitionProgress,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LOD Visibility & Opacity
// ═══════════════════════════════════════════════════════════════════════════

/** The zoom level at which each node type first becomes visible (its "home band"). */
const NODE_HOME_LEVEL: Record<MindGraphNodeType, GalaxyZoomLevel> = {
  personality_core: "L0",
  impact_cluster: "L1",
  temporal_process: "L1",
  memory: "L2",
  impact_particle: "L2",
  belief: "L2",
  need: "L2",
  desire: "L2",
  behavior_bias: "L3",
  internal_state_variable: "L3",
  benchmark_signal: "L3",
};

const LEVEL_ORDINAL: Record<GalaxyZoomLevel, number> = {
  L0: 0, L1: 1, L2: 2, L3: 3, L4: 4,
};

/**
 * Compute LOD visibility and opacity for a node type at the given zoom state.
 *
 * - Before the node's home level: invisible (opacity 0)
 * - At the home level's transition zone: fade from 0 → 1
 * - After the home level: fully visible (opacity 1)
 */
export function computeGalaxyLodVisibility(
  nodeOrEdgeType: MindGraphNodeType | MindGraphEdgeType,
  zoomState: GalaxyZoomState
): GalaxyLodVisibility {
  const homeLevel = NODE_HOME_LEVEL[nodeOrEdgeType as MindGraphNodeType];
  if (!homeLevel) {
    // Edge types and unknown types: derive from current zoom level
    return { visible: LEVEL_ORDINAL[zoomState.level] >= 1, opacity: 1 };
  }

  const homeOrdinal = LEVEL_ORDINAL[homeLevel];
  const currentOrdinal = LEVEL_ORDINAL[zoomState.level];

  // Not yet reached this node's home level
  if (currentOrdinal < homeOrdinal) {
    return { visible: false, opacity: 0 };
  }

  // Past this node's home level — fully visible
  if (currentOrdinal > homeOrdinal) {
    return { visible: true, opacity: 1 };
  }

  // At this node's home level — may be in transition zone
  if (zoomState.inTransitionZone) {
    return { visible: true, opacity: clamp01(zoomState.transitionProgress) };
  }

  return { visible: true, opacity: 1 };
}

/**
 * Compute LOD opacity specifically for the current band's elements.
 * Returns the smooth fade-in value that should be applied to elements
 * that become visible at the current zoom level.
 */
export function computeGalaxyLodOpacity(
  nodeOrEdgeType: MindGraphNodeType | MindGraphEdgeType,
  zoomState: GalaxyZoomState
): number {
  return computeGalaxyLodVisibility(nodeOrEdgeType, zoomState).opacity;
}

// ═══════════════════════════════════════════════════════════════════════════
// Viewport Transform
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply a viewport transform to a point (screen → world coordinates).
 *
 *   worldX = (screenX - panX) / scale
 *   worldY = (screenY - panY) / scale
 *
 * Pure math. No DOM. No Canvas.
 */
export function applyGalaxyViewportTransform(
  point: GalaxyViewportPoint,
  transform: GalaxyViewportTransform
): GalaxyViewportPoint {
  return {
    x: (point.x - transform.panX) / transform.scale,
    y: (point.y - transform.panY) / transform.scale,
  };
}

/**
 * Inverse transform: world → screen coordinates.
 */
export function applyGalaxyViewportTransformInverse(
  point: GalaxyViewportPoint,
  transform: GalaxyViewportTransform
): GalaxyViewportPoint {
  return {
    x: point.x * transform.scale + transform.panX,
    y: point.y * transform.scale + transform.panY,
  };
}

/**
 * Build a default viewport transform centered on (cx, cy) with given scale.
 */
export function buildGalaxyViewportTransform(
  scale: GalaxyZoomScale,
  centerX = 0,
  centerY = 0
): GalaxyViewportTransform {
  return {
    panX: centerX,
    panY: centerY,
    scale: clampGalaxyZoomScale(scale),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoom Transition Interpolation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interpolate between two zoom scales at progress t ∈ [0, 1].
 *
 * Uses linear interpolation. Deterministic. Same (from, to, t) → identical result.
 *
 * This is the DATA for a transition — not the animation itself.
 * A future animation system can call this every frame with an easing-modified t.
 */
export function interpolateGalaxyZoomTransition(
  fromScale: GalaxyZoomScale,
  toScale: GalaxyZoomScale,
  t: number
): GalaxyZoomScale {
  const from = clampGalaxyZoomScale(fromScale);
  const to = clampGalaxyZoomScale(toScale);
  const clampedT = clamp01(t);
  const result = from + (to - from) * clampedT;
  return clampGalaxyZoomScale(result);
}

/**
 * Build a zoom transition descriptor.
 */
export function buildGalaxyZoomTransition(
  fromScale: GalaxyZoomScale,
  toScale: GalaxyZoomScale,
  durationMs = 300
): GalaxyZoomTransition {
  return {
    fromScale: clampGalaxyZoomScale(fromScale),
    toScale: clampGalaxyZoomScale(toScale),
    durationMs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoom Scale Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Multiply current scale by a zoom factor (e.g., 1.15 for wheel-in, 0.87 for wheel-out).
 */
export function zoomByFactor(currentScale: GalaxyZoomScale, factor: number): GalaxyZoomScale {
  return clampGalaxyZoomScale(currentScale * factor);
}

/**
 * Get the center scale of a given zoom level's band.
 */
export function getZoomLevelCenterScale(level: GalaxyZoomLevel): GalaxyZoomScale {
  const band = GALAXY_ZOOM_BANDS.find((b) => b.level === level) ?? GALAXY_ZOOM_BANDS[2]!;
  return (band.minScale + band.maxScale) / 2;
}

/**
 * Check whether a scale value lies exactly at a band boundary.
 */
export function isAtBandBoundary(scale: GalaxyZoomScale): boolean {
  const clamped = clampGalaxyZoomScale(scale);
  for (const band of GALAXY_ZOOM_BANDS) {
    if (clamped === band.minScale) return true;
  }
  return clamped === GALAXY_ZOOM_SCALE_MAX;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
