import { describe, expect, it } from "vitest";
import {
  GALAXY_ZOOM_SCALE_MIN,
  GALAXY_ZOOM_SCALE_MAX,
  GALAXY_ZOOM_BANDS,
  GALAXY_LOD_TRANSITION_FRACTION,
  clampGalaxyZoomScale,
  getGalaxyZoomLevelForScale,
  buildGalaxyZoomState,
  computeGalaxyLodVisibility,
  computeGalaxyLodOpacity,
  applyGalaxyViewportTransform,
  applyGalaxyViewportTransformInverse,
  buildGalaxyViewportTransform,
  interpolateGalaxyZoomTransition,
  buildGalaxyZoomTransition,
  zoomByFactor,
  getZoomLevelCenterScale,
  isAtBandBoundary,
  type GalaxyZoomScale,
} from "../../../src/core/graph/mindGalaxyZoomLod";

// ── Scale Clamp ──────────────────────────────────────────────────────────

describe("GalaxyZoomLod — scale clamp", () => {
  it("clamps above-max values to MAX", () => {
    expect(clampGalaxyZoomScale(100)).toBe(GALAXY_ZOOM_SCALE_MAX);
    expect(clampGalaxyZoomScale(8.1)).toBe(GALAXY_ZOOM_SCALE_MAX);
  });

  it("clamps below-min values to MIN", () => {
    expect(clampGalaxyZoomScale(0)).toBe(GALAXY_ZOOM_SCALE_MIN);
    expect(clampGalaxyZoomScale(-1)).toBe(GALAXY_ZOOM_SCALE_MIN);
  });

  it("passes through valid values unchanged", () => {
    expect(clampGalaxyZoomScale(1)).toBe(1);
    expect(clampGalaxyZoomScale(4)).toBe(4);
    expect(clampGalaxyZoomScale(0.5)).toBe(0.5);
  });

  it("handles NaN by returning MIN", () => {
    expect(clampGalaxyZoomScale(NaN)).toBe(GALAXY_ZOOM_SCALE_MIN);
  });

  it("handles Infinity by returning MIN", () => {
    expect(clampGalaxyZoomScale(Infinity)).toBe(GALAXY_ZOOM_SCALE_MIN);
    expect(clampGalaxyZoomScale(-Infinity)).toBe(GALAXY_ZOOM_SCALE_MIN);
  });

  it("boundary values: MIN and MAX are exact", () => {
    expect(clampGalaxyZoomScale(GALAXY_ZOOM_SCALE_MIN)).toBe(GALAXY_ZOOM_SCALE_MIN);
    expect(clampGalaxyZoomScale(GALAXY_ZOOM_SCALE_MAX)).toBe(GALAXY_ZOOM_SCALE_MAX);
  });
});

// ── Scale → Zoom Level ───────────────────────────────────────────────────

describe("GalaxyZoomLod — scale to zoom level", () => {
  it("L0: [0.25, 0.75)", () => {
    expect(getGalaxyZoomLevelForScale(0.25)).toBe("L0");
    expect(getGalaxyZoomLevelForScale(0.5)).toBe("L0");
    expect(getGalaxyZoomLevelForScale(0.74)).toBe("L0");
  });

  it("L1: [0.75, 1.5)", () => {
    expect(getGalaxyZoomLevelForScale(0.75)).toBe("L1");
    expect(getGalaxyZoomLevelForScale(1.0)).toBe("L1");
    expect(getGalaxyZoomLevelForScale(1.49)).toBe("L1");
  });

  it("L2: [1.5, 3.0)", () => {
    expect(getGalaxyZoomLevelForScale(1.5)).toBe("L2");
    expect(getGalaxyZoomLevelForScale(2.0)).toBe("L2");
    expect(getGalaxyZoomLevelForScale(2.99)).toBe("L2");
  });

  it("L3: [3.0, 5.0)", () => {
    expect(getGalaxyZoomLevelForScale(3.0)).toBe("L3");
    expect(getGalaxyZoomLevelForScale(4.0)).toBe("L3");
    expect(getGalaxyZoomLevelForScale(4.99)).toBe("L3");
  });

  it("L4: [5.0, 8.0]", () => {
    expect(getGalaxyZoomLevelForScale(5.0)).toBe("L4");
    expect(getGalaxyZoomLevelForScale(6.5)).toBe("L4");
    expect(getGalaxyZoomLevelForScale(8.0)).toBe("L4");
  });

  it("boundary values are deterministic", () => {
    // 0.75 falls into L1 (inclusive min)
    expect(getGalaxyZoomLevelForScale(0.75)).toBe("L1");
    // 1.5 falls into L2
    expect(getGalaxyZoomLevelForScale(1.5)).toBe("L2");
    // 3.0 falls into L3
    expect(getGalaxyZoomLevelForScale(3.0)).toBe("L3");
    // 5.0 falls into L4
    expect(getGalaxyZoomLevelForScale(5.0)).toBe("L4");
  });
});

// ── Zoom State ───────────────────────────────────────────────────────────

describe("GalaxyZoomLod — zoom state", () => {
  it("buildGalaxyZoomState returns correct level for each band", () => {
    expect(buildGalaxyZoomState(0.5).level).toBe("L0");
    expect(buildGalaxyZoomState(1.0).level).toBe("L1");
    expect(buildGalaxyZoomState(2.0).level).toBe("L2");
    expect(buildGalaxyZoomState(4.0).level).toBe("L3");
    expect(buildGalaxyZoomState(6.0).level).toBe("L4");
  });

  it("bandProgress is 0 at band start, approaches 1 at band end", () => {
    const l1Start = buildGalaxyZoomState(0.75);
    expect(l1Start.bandProgress).toBe(0);

    const l1Mid = buildGalaxyZoomState(1.125);
    expect(l1Mid.bandProgress).toBeCloseTo(0.5, 1);

    const l1End = buildGalaxyZoomState(1.499);
    expect(l1End.bandProgress).toBeGreaterThan(0.99);
  });

  it("inTransitionZone is true at band start, false after fullOpacityAt", () => {
    const atStart = buildGalaxyZoomState(1.5); // just entered L2
    expect(atStart.inTransitionZone).toBe(true);

    const afterFade = buildGalaxyZoomState(2.5); // well past L2 fade zone
    expect(afterFade.inTransitionZone).toBe(false);
  });

  it("transitionProgress is 0 at band entry, 1 after fullOpacityAt", () => {
    const entry = buildGalaxyZoomState(1.5); // L2 entry
    expect(entry.transitionProgress).toBe(0);

    const midFade = buildGalaxyZoomState(1.65); // mid transition
    expect(midFade.transitionProgress).toBeGreaterThan(0);
    expect(midFade.transitionProgress).toBeLessThan(1);

    const done = buildGalaxyZoomState(2.5); // past transition
    expect(done.transitionProgress).toBe(1);
  });

  it("same scale produces identical state", () => {
    const s1 = buildGalaxyZoomState(3.14);
    const s2 = buildGalaxyZoomState(3.14);
    expect(s1).toEqual(s2);
  });
});

// ── LOD Visibility ───────────────────────────────────────────────────────

describe("GalaxyZoomLod — LOD visibility", () => {
  it("personality_core is visible at L0 with opacity 1", () => {
    const state = buildGalaxyZoomState(0.5);
    const vis = computeGalaxyLodVisibility("personality_core", state);
    expect(vis.visible).toBe(true);
    expect(vis.opacity).toBe(1);
  });

  it("memory is not visible at L0", () => {
    const state = buildGalaxyZoomState(0.5);
    const vis = computeGalaxyLodVisibility("memory", state);
    expect(vis.visible).toBe(false);
    expect(vis.opacity).toBe(0);
  });

  it("memory fades in at L2 entry", () => {
    const state = buildGalaxyZoomState(1.5); // L2 entry
    const vis = computeGalaxyLodVisibility("memory", state);
    expect(vis.visible).toBe(true);
    expect(vis.opacity).toBe(0); // just entered — opacity 0
  });

  it("memory is fully opaque mid-L2", () => {
    const state = buildGalaxyZoomState(2.0);
    const vis = computeGalaxyLodVisibility("memory", state);
    expect(vis.visible).toBe(true);
    expect(vis.opacity).toBe(1);
  });

  it("behavior_bias is not visible at L2", () => {
    const state = buildGalaxyZoomState(2.0);
    const vis = computeGalaxyLodVisibility("behavior_bias", state);
    expect(vis.visible).toBe(false);
    expect(vis.opacity).toBe(0);
  });

  it("behavior_bias becomes visible at L3", () => {
    const state = buildGalaxyZoomState(3.5);
    const vis = computeGalaxyLodVisibility("behavior_bias", state);
    expect(vis.visible).toBe(true);
    expect(vis.opacity).toBeGreaterThan(0);
  });

  it("drift-related types are visible at L4", () => {
    const state = buildGalaxyZoomState(6.0);
    for (const type of ["benchmark_signal", "internal_state_variable", "behavior_bias"] as const) {
      const vis = computeGalaxyLodVisibility(type, state);
      expect(vis.visible).toBe(true);
      expect(vis.opacity).toBe(1);
    }
  });

  it("L0 hides all detailed factors", () => {
    const state = buildGalaxyZoomState(0.5);
    const detailTypes = ["memory", "belief", "need", "desire", "behavior_bias", "benchmark_signal"] as const;
    for (const type of detailTypes) {
      const vis = computeGalaxyLodVisibility(type, state);
      expect(vis.visible).toBe(false);
    }
  });

  it("L4 enables all types", () => {
    const state = buildGalaxyZoomState(7.0);
    const allTypes = ["personality_core", "impact_cluster", "memory", "belief", "need", "desire", "behavior_bias", "temporal_process", "impact_particle", "internal_state_variable", "benchmark_signal"] as const;
    for (const type of allTypes) {
      const vis = computeGalaxyLodVisibility(type, state);
      expect(vis.visible).toBe(true);
    }
  });

  it("opacity is monotonic within a band", () => {
    // Within L2, memory opacity increases from 0 to 1 monotonically
    const scales = [1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.5, 3.0];
    let prev = -1;
    for (const s of scales) {
      const state = buildGalaxyZoomState(s);
      const opacity = computeGalaxyLodOpacity("memory", state);
      expect(opacity).toBeGreaterThanOrEqual(prev);
      prev = opacity;
    }
  });

  it("computeGalaxyLodOpacity returns same as visibility opacity", () => {
    const state = buildGalaxyZoomState(1.65);
    const vis = computeGalaxyLodVisibility("memory", state);
    const op = computeGalaxyLodOpacity("memory", state);
    expect(op).toBe(vis.opacity);
  });
});

// ── Viewport Transform ───────────────────────────────────────────────────

describe("GalaxyZoomLod — viewport transform", () => {
  it("identity transform preserves point at origin", () => {
    const t = buildGalaxyViewportTransform(1, 0, 0);
    const result = applyGalaxyViewportTransform({ x: 0, y: 0 }, t);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("scale=2, pan=(0,0): screen point maps to world half", () => {
    const t = buildGalaxyViewportTransform(2, 0, 0);
    const result = applyGalaxyViewportTransform({ x: 100, y: 200 }, t);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it("pan offset shifts coordinates", () => {
    const t = buildGalaxyViewportTransform(1, 50, 100);
    const result = applyGalaxyViewportTransform({ x: 100, y: 200 }, t);
    expect(result.x).toBe(50);  // (100 - 50) / 1
    expect(result.y).toBe(100); // (200 - 100) / 1
  });

  it("round-trip: transform + inverse = identity", () => {
    const t = buildGalaxyViewportTransform(2.5, -30, 45);
    const original = { x: 320, y: 240 };
    const world = applyGalaxyViewportTransform(original, t);
    const screen = applyGalaxyViewportTransformInverse(world, t);
    expect(screen.x).toBeCloseTo(original.x, 10);
    expect(screen.y).toBeCloseTo(original.y, 10);
  });

  it("scale=0.5: screen point maps to larger world", () => {
    const t = buildGalaxyViewportTransform(0.5, 0, 0);
    const result = applyGalaxyViewportTransform({ x: 50, y: 50 }, t);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it("buildGalaxyViewportTransform clamps invalid scale", () => {
    const t = buildGalaxyViewportTransform(100, 0, 0);
    expect(t.scale).toBe(GALAXY_ZOOM_SCALE_MAX);
  });
});

// ── Zoom Transition ──────────────────────────────────────────────────────

describe("GalaxyZoomLod — zoom transition", () => {
  it("interpolate at t=0 returns fromScale", () => {
    const result = interpolateGalaxyZoomTransition(1, 4, 0);
    expect(result).toBe(1);
  });

  it("interpolate at t=1 returns toScale", () => {
    const result = interpolateGalaxyZoomTransition(1, 4, 1);
    expect(result).toBe(4);
  });

  it("interpolate at t=0.5 returns midpoint", () => {
    const result = interpolateGalaxyZoomTransition(1, 5, 0.5);
    expect(result).toBe(3);
  });

  it("interpolate clamps t outside [0,1]", () => {
    expect(interpolateGalaxyZoomTransition(1, 4, -0.5)).toBe(1);
    expect(interpolateGalaxyZoomTransition(1, 4, 1.5)).toBe(4);
  });

  it("interpolate clamps result to valid range", () => {
    // from=0 clamps to 0.25, to=100 clamps to 8.0, t=0.5 → 4.125
    const result = interpolateGalaxyZoomTransition(0, 100, 0.5);
    expect(result).toBe(4.125);
  });

  it("buildGalaxyZoomTransition returns correct descriptor", () => {
    const t = buildGalaxyZoomTransition(2, 6, 500);
    expect(t.fromScale).toBe(2);
    expect(t.toScale).toBe(6);
    expect(t.durationMs).toBe(500);
  });

  it("transition is deterministic", () => {
    const r1 = interpolateGalaxyZoomTransition(1.5, 4.5, 0.33);
    const r2 = interpolateGalaxyZoomTransition(1.5, 4.5, 0.33);
    expect(r1).toBe(r2);
  });
});

// ── Zoom Utilities ───────────────────────────────────────────────────────

describe("GalaxyZoomLod — zoom utilities", () => {
  it("zoomByFactor multiplies and clamps", () => {
    expect(zoomByFactor(1, 1.15)).toBeCloseTo(1.15, 5);
    expect(zoomByFactor(7.5, 1.15)).toBe(GALAXY_ZOOM_SCALE_MAX);
    expect(zoomByFactor(0.3, 0.87)).toBeCloseTo(0.261, 5); // 0.3*0.87=0.261, not clamped (within range)
  });

  it("getZoomLevelCenterScale returns band midpoints", () => {
    expect(getZoomLevelCenterScale("L0")).toBe(0.5);
    expect(getZoomLevelCenterScale("L1")).toBe(1.125);
    expect(getZoomLevelCenterScale("L2")).toBe(2.25);
    expect(getZoomLevelCenterScale("L3")).toBe(4.0);
    expect(getZoomLevelCenterScale("L4")).toBe(6.5);
  });

  it("isAtBandBoundary detects exact band edges", () => {
    expect(isAtBandBoundary(0.25)).toBe(true);  // L0 min
    expect(isAtBandBoundary(0.75)).toBe(true);  // L1 min
    expect(isAtBandBoundary(1.5)).toBe(true);   // L2 min
    expect(isAtBandBoundary(3.0)).toBe(true);   // L3 min
    expect(isAtBandBoundary(5.0)).toBe(true);   // L4 min
    expect(isAtBandBoundary(8.0)).toBe(true);   // MAX
    expect(isAtBandBoundary(1.0)).toBe(false);  // mid-band
    expect(isAtBandBoundary(4.0)).toBe(false);  // mid-band
  });
});

// ── No Mutation ──────────────────────────────────────────────────────────

describe("GalaxyZoomLod — no mutation", () => {
  it("zoom state is a new object each call", () => {
    const s1 = buildGalaxyZoomState(2.0);
    const s2 = buildGalaxyZoomState(2.0);
    expect(s1).not.toBe(s2); // different object references
    expect(s1).toEqual(s2);  // but equal values
  });

  it("viewport transform produces new point objects", () => {
    const t = buildGalaxyViewportTransform(2, 0, 0);
    const input = { x: 100, y: 200 };
    const output = applyGalaxyViewportTransform(input, t);
    expect(output).not.toBe(input);
  });
});

// ── Constants ────────────────────────────────────────────────────────────

describe("GalaxyZoomLod — constants", () => {
  it("GALAXY_ZOOM_BANDS has 5 entries in L0-L4 order", () => {
    expect(GALAXY_ZOOM_BANDS).toHaveLength(5);
    expect(GALAXY_ZOOM_BANDS[0]!.level).toBe("L0");
    expect(GALAXY_ZOOM_BANDS[4]!.level).toBe("L4");
  });

  it("band boundaries are contiguous", () => {
    for (let i = 0; i < GALAXY_ZOOM_BANDS.length - 1; i++) {
      expect(GALAXY_ZOOM_BANDS[i]!.maxScale).toBe(GALAXY_ZOOM_BANDS[i + 1]!.minScale);
    }
  });

  it("LOD transition fraction is 0.2", () => {
    expect(GALAXY_LOD_TRANSITION_FRACTION).toBe(0.2);
  });

  it("MIN < MAX", () => {
    expect(GALAXY_ZOOM_SCALE_MIN).toBeLessThan(GALAXY_ZOOM_SCALE_MAX);
  });
});
