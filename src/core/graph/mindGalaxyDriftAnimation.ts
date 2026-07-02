/**
 * V10.36 Influence Drift Animation Data — pure data layer for slow,
 * deterministic drift animation of influence factors in the Mind Galaxy Viewer.
 *
 * Models each node's drift as a slow elliptical oscillation. All motion is
 * deterministic: same input → identical frame output at any timeMs.
 *
 * No requestAnimationFrame. No DOM. No Canvas. No Date.now. No Math.random.
 * This is the DATA that a future animation loop would sample each frame.
 */

import type { MindGalaxyViewSnapshot, GalaxyDriftVector } from "./mindGalaxyViewTypes";
import type { GalaxyZoomLevel } from "./mindGalaxyViewTypes";
import type { GalaxyZoomState, GalaxyZoomScale } from "./mindGalaxyZoomLod";
import { buildGalaxyZoomState } from "./mindGalaxyZoomLod";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type GalaxyDriftMotionMode = "still" | "subtle" | "visible";

export interface GalaxyDriftAnimationOptions {
  /** Total animation cycle duration in milliseconds (default 60000 = 60s). */
  durationMs?: number;
  /** Sampling rate hint (default 30). Not used for deterministic sampling — metadata only. */
  fps?: number;
  /** Motion mode (default "visible"). */
  motionMode?: GalaxyDriftMotionMode;
  /** Accessibility flag — true disables all drift (default false). */
  reducedMotion?: boolean;
  /** Deterministic seed for phase offsets (default "drift-animation"). */
  seed?: string;
  /** Maximum drift offset in logical pixels (default 2.0). */
  maxOffset?: number;
  /** Maximum drift velocity in px/second — clamps effective amplitude (default 0.5). */
  maxVelocity?: number;
}

/**
 * Per-node drift track: a slow elliptical oscillation.
 *
 * At timeMs, the node's offset from its static position is:
 *   ox = semiMajor * cos(2π × timeMs / period + phase) × cos(angle)
 *      - semiMinor * sin(2π × timeMs / period + phase) × sin(angle)
 *   oy = semiMajor * cos(2π × timeMs / period + phase) × sin(angle)
 *      + semiMinor * sin(2π × timeMs / period + phase) × cos(angle)
 *
 * This produces an elliptical orbit whose major axis aligns with the drift direction.
 */
export interface GalaxyDriftTrack {
  nodeId: string;
  /** Semi-major axis (aligned with drift direction). Clamped by maxOffset. */
  semiMajor: number;
  /** Semi-minor axis (perpendicular). Approximately semiMajor × 0.3. */
  semiMinor: number;
  /** Drift direction angle in radians. */
  angle: number;
  /** Oscillation period in milliseconds (durationMs × periodMultiplier). */
  periodMs: number;
  /** Phase offset in radians [0, 2π). Deterministic from seed + nodeId. */
  phase: number;
  /** Maximum velocity in px/s (semiMajor × 2π / period × 1000). */
  maxVelocity: number;
  /** Motion mode for this track (may be downgraded from options). */
  motionMode: GalaxyDriftMotionMode;
}

/**
 * A single drift frame: per-node offset at a specific timeMs.
 */
export interface GalaxyDriftFrame {
  nodeId: string;
  /** Offset x at this timeMs. 0 if motionMode is "still". */
  offsetX: number;
  /** Offset y at this timeMs. 0 if motionMode is "still". */
  offsetY: number;
}

/**
 * Complete drift animation snapshot for all nodes.
 */
export interface GalaxyDriftAnimationSnapshot {
  version: "10.36.0";
  characterId: string;
  /** Animation options used (with defaults resolved). */
  options: Required<GalaxyDriftAnimationOptions>;
  /** Zoom level this animation was built for. */
  zoomLevel: GalaxyZoomLevel;
  /** Drift tracks for nodes that have drift. */
  tracks: GalaxyDriftTrack[];
  /** Summary statistics. */
  summary: GalaxyDriftAnimationSummary;
}

export interface GalaxyDriftAnimationSummary {
  totalTracks: number;
  stillTracks: number;
  subtleTracks: number;
  visibleTracks: number;
  averageSemiMajor: number;
  maxSemiMajor: number;
  averageMaxVelocity: number;
  maxMaxVelocity: number;
  totalPeriodRangeMs: [number, number];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_DURATION_MS = 60_000; // 60 seconds per cycle
const DEFAULT_FPS = 30;
const DEFAULT_MAX_OFFSET = 2.0;
const DEFAULT_MAX_VELOCITY = 0.5; // px/s
const DEFAULT_SEED = "drift-animation";
const SEMI_MINOR_RATIO = 0.3;

// ═══════════════════════════════════════════════════════════════════════════
// Main Builder
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a deterministic drift animation snapshot from a galaxy view snapshot.
 *
 * Pure function. No side effects. Same input → identical output.
 *
 * @param viewSnapshot — MindGalaxyViewSnapshot with per-node drift vectors
 * @param zoomStateOrLevel — zoom state or zoom level string
 * @param options — animation configuration
 */
export function buildGalaxyDriftAnimationSnapshot(
  viewSnapshot: MindGalaxyViewSnapshot,
  zoomStateOrLevel: GalaxyZoomState | GalaxyZoomLevel,
  options: GalaxyDriftAnimationOptions = {}
): GalaxyDriftAnimationSnapshot {
  const zoomLevel = typeof zoomStateOrLevel === "string"
    ? zoomStateOrLevel
    : zoomStateOrLevel.level;

  const resolved: Required<GalaxyDriftAnimationOptions> = {
    durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    fps: options.fps ?? DEFAULT_FPS,
    motionMode: options.motionMode ?? "visible",
    reducedMotion: options.reducedMotion ?? false,
    seed: options.seed ?? DEFAULT_SEED,
    maxOffset: clampPositive(options.maxOffset ?? DEFAULT_MAX_OFFSET),
    maxVelocity: clampPositive(options.maxVelocity ?? DEFAULT_MAX_VELOCITY),
  };

  // Determine effective motion mode
  const effectiveMode = resolveMotionMode(resolved.motionMode, zoomLevel, resolved.reducedMotion);

  const tracks: GalaxyDriftTrack[] = [];

  for (const node of viewSnapshot.nodes) {
    if (!node.drift) continue; // nodes without drift vectors get no track

    const trackMotionMode = effectiveNodeMotionMode(effectiveMode, node.drift);

    const baseSemiMajor = trackMotionMode === "still" ? 0
      : trackMotionMode === "subtle" ? Math.min(node.drift.magnitude * 0.15, resolved.maxOffset * 0.25)
      : Math.min(node.drift.magnitude, resolved.maxOffset);

    const semiMajor = clampPositive(baseSemiMajor);
    const semiMinor = semiMajor * SEMI_MINOR_RATIO;

    // Period: each node has a slightly different period based on its id
    // Long periods feel slower and more natural
    const periodMultiplier = deterministicPeriodMultiplier(resolved.seed, node.nodeId);
    const periodMs = resolved.durationMs * periodMultiplier;

    // Phase: deterministic offset so nodes don't oscillate in sync
    const phase = deterministicPhase(resolved.seed, node.nodeId);

    // Velocity: semiMajor × 2π / period × 1000 ms/s
    const velocity = periodMs > 0
      ? (semiMajor * 2 * Math.PI / periodMs) * 1000
      : 0;
    const maxVelocityClamped = Math.min(velocity, resolved.maxVelocity);

    tracks.push({
      nodeId: node.nodeId,
      semiMajor,
      semiMinor,
      angle: node.drift.angle,
      periodMs,
      phase,
      maxVelocity: Math.round(maxVelocityClamped * 10000) / 10000,
      motionMode: trackMotionMode,
    });
  }

  // Build summary
  const summary = buildAnimationSummary(tracks);

  return {
    version: "10.36.0",
    characterId: viewSnapshot.characterId,
    options: resolved,
    zoomLevel,
    tracks,
    summary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Frame Sampling
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sample a single drift track at a given timeMs.
 *
 * Deterministic. Same (track, timeMs) → identical frame.
 * Time wraps using modulo: timeMs % track.periodMs.
 */
export function sampleGalaxyDriftFrame(
  track: GalaxyDriftTrack,
  timeMs: number
): GalaxyDriftFrame {
  if (track.motionMode === "still" || track.semiMajor === 0) {
    return { nodeId: track.nodeId, offsetX: 0, offsetY: 0 };
  }

  const period = track.periodMs > 0 ? track.periodMs : 1;
  const wrappedTime = timeMs % period;
  const angle = (2 * Math.PI * wrappedTime) / period + track.phase;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Elliptical orbit: major axis along drift direction
  const offsetX = track.semiMajor * cosA * Math.cos(track.angle)
    - track.semiMinor * sinA * Math.sin(track.angle);
  const offsetY = track.semiMajor * cosA * Math.sin(track.angle)
    + track.semiMinor * sinA * Math.cos(track.angle);

  return {
    nodeId: track.nodeId,
    offsetX: Math.round(offsetX * 10000) / 10000,
    offsetY: Math.round(offsetY * 10000) / 10000,
  };
}

/**
 * Sample all tracks in an animation snapshot at a given timeMs.
 *
 * Returns a map from nodeId → GalaxyDriftFrame.
 */
export function sampleGalaxyDriftSnapshot(
  animation: GalaxyDriftAnimationSnapshot,
  timeMs: number
): Map<string, GalaxyDriftFrame> {
  const frames = new Map<string, GalaxyDriftFrame>();
  for (const track of animation.tracks) {
    const frame = sampleGalaxyDriftFrame(track, timeMs);
    frames.set(frame.nodeId, frame);
  }
  return frames;
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

export function summarizeGalaxyDriftAnimation(
  animation: GalaxyDriftAnimationSnapshot
): GalaxyDriftAnimationSummary {
  return animation.summary;
}

// ═══════════════════════════════════════════════════════════════════════════
// Apply Drift to Render Commands (optional helper)
// ═══════════════════════════════════════════════════════════════════════════

import type { GalaxyCanvasRenderCommand } from "./mindGalaxyCanvasRenderer";

/**
 * Apply drift frame offsets to an array of render commands.
 * Returns NEW commands — does not mutate input.
 *
 * Only modifies "circle" and "driftVector" commands that have matching nodeIds.
 * Moves circle centers and driftVector start/end points by the frame offset.
 */
export function applyDriftFrameToCommands(
  commands: readonly GalaxyCanvasRenderCommand[],
  frame: Map<string, GalaxyDriftFrame>
): GalaxyCanvasRenderCommand[] {
  return commands.map((cmd) => {
    if (cmd.kind === "circle" && cmd.nodeId) {
      const drift = frame.get(cmd.nodeId);
      if (drift && (drift.offsetX !== 0 || drift.offsetY !== 0)) {
        return {
          ...cmd,
          x: Math.round((cmd.x + drift.offsetX) * 10000) / 10000,
          y: Math.round((cmd.y + drift.offsetY) * 10000) / 10000,
        };
      }
    }
    if (cmd.kind === "driftVector" && cmd.nodeId) {
      const drift = frame.get(cmd.nodeId);
      if (drift && (drift.offsetX !== 0 || drift.offsetY !== 0)) {
        return {
          ...cmd,
          x: Math.round((cmd.x + drift.offsetX) * 10000) / 10000,
          y: Math.round((cmd.y + drift.offsetY) * 10000) / 10000,
          endX: Math.round((cmd.endX + drift.offsetX) * 10000) / 10000,
          endY: Math.round((cmd.endY + drift.offsetY) * 10000) / 10000,
        };
      }
    }
    return cmd;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════

function resolveMotionMode(
  requestedMode: GalaxyDriftMotionMode,
  zoomLevel: GalaxyZoomLevel,
  reducedMotion: boolean
): GalaxyDriftMotionMode {
  if (reducedMotion) return "still";
  if (requestedMode === "still") return "still";

  // Resolve effective mode with chained downgrades
  let mode: GalaxyDriftMotionMode = requestedMode;

  // "visible" only active at L4; lower levels → "subtle"
  if (mode === "visible" && zoomLevel !== "L4") mode = "subtle";

  // "subtle" only active at L2+; L0/L1 → "still"
  if (mode === "subtle" && (zoomLevel === "L0" || zoomLevel === "L1")) mode = "still";

  return mode;
}

function effectiveNodeMotionMode(
  effectiveMode: GalaxyDriftMotionMode,
  drift: GalaxyDriftVector
): GalaxyDriftMotionMode {
  // "stable" direction → no visible drift
  if (drift.direction === "stable" && drift.magnitude < 0.1) return "still";
  return effectiveMode;
}

function deterministicPhase(seed: string, nodeId: string): number {
  const input = `${seed}:${nodeId}:phase`;
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 4294967295) * Math.PI * 2;
}

function deterministicPeriodMultiplier(seed: string, nodeId: string): number {
  const input = `${seed}:${nodeId}:period`;
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  // Range: 0.6 – 2.0 (some nodes have shorter periods, some longer)
  return 0.6 + ((h >>> 0) / 4294967295) * 1.4;
}

function buildAnimationSummary(tracks: GalaxyDriftTrack[]): GalaxyDriftAnimationSummary {
  const semiMajors = tracks.map((t) => t.semiMajor);
  const velocities = tracks.map((t) => t.maxVelocity);
  const periods = tracks.map((t) => t.periodMs);

  return {
    totalTracks: tracks.length,
    stillTracks: tracks.filter((t) => t.motionMode === "still").length,
    subtleTracks: tracks.filter((t) => t.motionMode === "subtle").length,
    visibleTracks: tracks.filter((t) => t.motionMode === "visible").length,
    averageSemiMajor: semiMajors.length > 0
      ? Math.round((semiMajors.reduce((a, b) => a + b, 0) / semiMajors.length) * 10000) / 10000
      : 0,
    maxSemiMajor: semiMajors.length > 0 ? Math.max(...semiMajors) : 0,
    averageMaxVelocity: velocities.length > 0
      ? Math.round((velocities.reduce((a, b) => a + b, 0) / velocities.length) * 10000) / 10000
      : 0,
    maxMaxVelocity: velocities.length > 0 ? Math.max(...velocities) : 0,
    totalPeriodRangeMs: periods.length > 0
      ? [Math.min(...periods), Math.max(...periods)]
      : [0, 0],
  };
}

function clampPositive(value: number): number {
  if (value < 0) return 0;
  return value;
}
