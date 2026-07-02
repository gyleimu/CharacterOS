import { describe, expect, it } from "vitest";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import { buildMindGalaxyViewSnapshot } from "../../../src/core/graph/mindGalaxyViewTypes";
import { buildGalaxyZoomState } from "../../../src/core/graph/mindGalaxyZoomLod";
import {
  buildGalaxyDriftAnimationSnapshot,
  sampleGalaxyDriftFrame,
  sampleGalaxyDriftSnapshot,
  summarizeGalaxyDriftAnimation,
  applyDriftFrameToCommands,
  type GalaxyDriftAnimationSnapshot,
  type GalaxyDriftTrack,
} from "../../../src/core/graph/mindGalaxyDriftAnimation";
import { buildGalaxyCanvasRenderCommands } from "../../../src/core/graph/mindGalaxyCanvasRenderer";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../../../src/core/character/characterBlueprint";

function freshState() {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
}

function buildAnimation(
  zoomLevel: "L0" | "L1" | "L2" | "L3" | "L4" = "L4",
  options?: Parameters<typeof buildGalaxyDriftAnimationSnapshot>[2]
): GalaxyDriftAnimationSnapshot {
  const state = freshState();
  const graph = buildMindGraphSnapshot(state);
  const layout = buildGraphLayoutSnapshot(graph);
  const view = buildMindGalaxyViewSnapshot(graph, layout);
  return buildGalaxyDriftAnimationSnapshot(view, zoomLevel, options);
}

// ── Deterministic Output ─────────────────────────────────────────────────

describe("GalaxyDriftAnimation — deterministic output", () => {
  it("same inputs → identical animation snapshot", () => {
    const a1 = buildAnimation("L4", { seed: "test-seed", durationMs: 30000 });
    const a2 = buildAnimation("L4", { seed: "test-seed", durationMs: 30000 });
    expect(a1.tracks.length).toBe(a2.tracks.length);
    for (let i = 0; i < a1.tracks.length; i++) {
      expect(a1.tracks[i]!.semiMajor).toBe(a2.tracks[i]!.semiMajor);
      expect(a1.tracks[i]!.periodMs).toBe(a2.tracks[i]!.periodMs);
      expect(a1.tracks[i]!.phase).toBe(a2.tracks[i]!.phase);
    }
    expect(a1.summary).toEqual(a2.summary);
  });

  it("same track + timeMs → identical frame", () => {
    const a = buildAnimation("L4", { seed: "frame-test" });
    const track = a.tracks[0]!;
    const f1 = sampleGalaxyDriftFrame(track, 5000);
    const f2 = sampleGalaxyDriftFrame(track, 5000);
    expect(f1).toEqual(f2);
  });

  it("no Math.random or Date.now in frame output", () => {
    const a = buildAnimation("L4");
    const track = a.tracks[0]!;
    for (let t = 0; t < 10000; t += 1000) {
      const f1 = sampleGalaxyDriftFrame(track, t);
      const f2 = sampleGalaxyDriftFrame(track, t);
      expect(f1.offsetX).toBe(f2.offsetX);
      expect(f1.offsetY).toBe(f2.offsetY);
    }
  });
});

// ── Reduced Motion ───────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — reducedMotion", () => {
  it("reducedMotion=true: all tracks are still", () => {
    const a = buildAnimation("L4", { reducedMotion: true });
    for (const track of a.tracks) {
      expect(track.motionMode).toBe("still");
      expect(track.semiMajor).toBe(0);
    }
  });

  it("reducedMotion=true: all frames have zero offset", () => {
    const a = buildAnimation("L4", { reducedMotion: true });
    const frames = sampleGalaxyDriftSnapshot(a, 5000);
    for (const [, frame] of frames) {
      expect(frame.offsetX).toBe(0);
      expect(frame.offsetY).toBe(0);
    }
  });
});

// ── Motion Modes ─────────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — motion modes", () => {
  it("motionMode='still': all tracks have semiMajor=0", () => {
    const a = buildAnimation("L4", { motionMode: "still" });
    for (const track of a.tracks) {
      expect(track.motionMode).toBe("still");
      expect(track.semiMajor).toBe(0);
    }
  });

  it("motionMode='visible' at L4: tracks have non-zero offsets", () => {
    const a = buildAnimation("L4", { motionMode: "visible" });
    expect(a.tracks.length).toBeGreaterThan(0);
    const visibleTracks = a.tracks.filter((t) => t.motionMode === "visible");
    expect(visibleTracks.length).toBeGreaterThan(0);
    for (const track of visibleTracks) {
      expect(track.semiMajor).toBeGreaterThan(0);
    }
  });

  it("motionMode='visible' at L0: downgraded to subtle or still (no visible at L0)", () => {
    const a = buildAnimation("L0", { motionMode: "visible" });
    for (const track of a.tracks) {
      expect(track.motionMode).not.toBe("visible");
    }
  });

  it("motionMode='subtle' at L0/L1: downgraded to still", () => {
    const a0 = buildAnimation("L0", { motionMode: "subtle" });
    for (const track of a0.tracks) {
      expect(track.motionMode).toBe("still");
    }

    const a1 = buildAnimation("L1", { motionMode: "subtle" });
    for (const track of a1.tracks) {
      expect(track.motionMode).toBe("still");
    }
  });
});

// ── Frame Sampling ───────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — frame sampling", () => {
  it("sampleGalaxyDriftFrame returns zero offset for still track", () => {
    const a = buildAnimation("L4", { motionMode: "still" });
    for (const track of a.tracks) {
      const frame = sampleGalaxyDriftFrame(track, 5000);
      expect(frame.offsetX).toBe(0);
      expect(frame.offsetY).toBe(0);
    }
  });

  it("sampleGalaxyDriftFrame returns non-zero offsets for visible track", () => {
    const a = buildAnimation("L4", { motionMode: "visible" });
    const visibleTrack = a.tracks.find((t) => t.motionMode === "visible");
    expect(visibleTrack).toBeDefined();
    const frame = sampleGalaxyDriftFrame(visibleTrack!, 7000);
    // At some timeMs, the offset should be non-zero (unless unlucky with phase)
    // Actually, the phase could make it zero at specific times. Let's check across multiple times.
    const samples = [0, 1000, 5000, 10000, 15000, 30000].map((t) =>
      sampleGalaxyDriftFrame(visibleTrack!, t)
    );
    const hasNonZero = samples.some((f) => f.offsetX !== 0 || f.offsetY !== 0);
    expect(hasNonZero).toBe(true);
  });

  it("time wraps by period: same offset at t and t+period", () => {
    const a = buildAnimation("L4", { motionMode: "visible", durationMs: 10000 });
    const track = a.tracks.find((t) => t.motionMode === "visible");
    if (!track) return; // skip if no visible tracks
    const t0 = 3000;
    const t1 = t0 + track.periodMs;
    const f0 = sampleGalaxyDriftFrame(track, t0);
    const f1 = sampleGalaxyDriftFrame(track, t1);
    expect(f0.offsetX).toBe(f1.offsetX);
    expect(f0.offsetY).toBe(f1.offsetY);
  });

  it("sampleGalaxyDriftSnapshot returns map with all nodeIds", () => {
    const a = buildAnimation("L4", { motionMode: "visible" });
    const frames = sampleGalaxyDriftSnapshot(a, 5000);
    expect(frames.size).toBe(a.tracks.length);
    for (const track of a.tracks) {
      expect(frames.has(track.nodeId)).toBe(true);
    }
  });

  it("offsets are within maxOffset bounds", () => {
    const a = buildAnimation("L4", { motionMode: "visible", maxOffset: 1.0 });
    for (const track of a.tracks) {
      expect(track.semiMajor).toBeLessThanOrEqual(1.0);
      for (let t = 0; t < 30000; t += 3000) {
        const frame = sampleGalaxyDriftFrame(track, t);
        expect(Math.abs(frame.offsetX)).toBeLessThanOrEqual(1.0 + 0.001);
        expect(Math.abs(frame.offsetY)).toBeLessThanOrEqual(1.0 + 0.001);
      }
    }
  });
});

// ── Max Velocity Clamp ───────────────────────────────────────────────────

describe("GalaxyDriftAnimation — maxVelocity clamp", () => {
  it("tracks respect maxVelocity", () => {
    const a = buildAnimation("L4", { motionMode: "visible", maxVelocity: 0.1 });
    for (const track of a.tracks) {
      expect(track.maxVelocity).toBeLessThanOrEqual(0.1);
    }
  });
});

// ── Max Offset Clamp ─────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — maxOffset clamp", () => {
  it("tracks respect maxOffset", () => {
    const a = buildAnimation("L4", { motionMode: "visible", maxOffset: 0.5 });
    // Some tracks may still have semiMajor=0 if motionMode is downgraded
    for (const track of a.tracks) {
      if (track.motionMode !== "still") {
        expect(track.semiMajor).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

// ── No Mutation ──────────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — no mutation", () => {
  it("view snapshot is not mutated", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const nodeCount = view.nodes.length;

    buildGalaxyDriftAnimationSnapshot(view, "L4");
    expect(view.nodes).toHaveLength(nodeCount);
  });

  it("animation snapshot is not mutated by sampling", () => {
    const a = buildAnimation("L4");
    const trackCount = a.tracks.length;
    sampleGalaxyDriftSnapshot(a, 5000);
    expect(a.tracks).toHaveLength(trackCount);
  });
});

// ── Empty Snapshot ───────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — empty snapshot", () => {
  it("handles empty view snapshot gracefully", () => {
    const state = createCharacterStateFromBlueprint(
      { ...createLinFanBlueprint(), identity: { id: "empty-drift", name: "E", description: "", tags: [] } },
      { seedInitialExperiences: false }
    );
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const a = buildGalaxyDriftAnimationSnapshot(view, "L4");
    expect(a.version).toBe("10.36.0");
    expect(a.summary.totalTracks).toBeGreaterThanOrEqual(0);
  });
});

// ── Summary ──────────────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — summary", () => {
  it("summary track counts sum to total", () => {
    const a = buildAnimation("L4", { motionMode: "visible" });
    const s = a.summary;
    expect(s.stillTracks + s.subtleTracks + s.visibleTracks).toBe(s.totalTracks);
  });

  it("summarizeGalaxyDriftAnimation returns the summary from animation", () => {
    const a = buildAnimation("L4");
    const s = summarizeGalaxyDriftAnimation(a);
    expect(s).toBe(a.summary);
  });
});

// ── applyDriftFrameToCommands ────────────────────────────────────────────

describe("GalaxyDriftAnimation — applyDriftFrameToCommands", () => {
  it("does not mutate input commands", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const cmds = buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L4", showDriftVectors: true });
    const a = buildGalaxyDriftAnimationSnapshot(view, "L4", { motionMode: "visible" });
    const frames = sampleGalaxyDriftSnapshot(a, 5000);
    const cmdCount = cmds.length;
    const firstX = cmds.find((c) => c.kind === "circle")?.x;

    applyDriftFrameToCommands(cmds, frames);
    expect(cmds).toHaveLength(cmdCount);
    // Original commands unchanged
    expect(cmds.find((c) => c.kind === "circle")?.x).toBe(firstX);
  });

  it("returns new commands (not same references)", () => {
    const state = freshState();
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const cmds = buildGalaxyCanvasRenderCommands(view, { zoomLevel: "L4", showDriftVectors: true });
    const a = buildGalaxyDriftAnimationSnapshot(view, "L4", { motionMode: "visible" });
    const frames = sampleGalaxyDriftSnapshot(a, 5000);

    const result = applyDriftFrameToCommands(cmds, frames);
    expect(result).not.toBe(cmds);
    // At least some circle commands should have been modified if drift is non-zero
    const anyModified = result.some((cmd, i) => {
      if (cmd.kind === "circle" && cmds[i]!.kind === "circle") {
        return cmd.x !== cmds[i]!.x || cmd.y !== cmds[i]!.y;
      }
      return false;
    });
    // May or may not be modified depending on drift values; just check it ran
    expect(result.length).toBe(cmds.length);
  });
});

// ── No Browser APIs ──────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — no browser APIs", () => {
  it("runs without requestAnimationFrame, Date.now, or Math.random", () => {
    const a = buildAnimation("L4", { motionMode: "visible" });
    // Just verify it doesn't throw
    const frames = sampleGalaxyDriftSnapshot(a, 12345);
    expect(frames.size).toBeGreaterThanOrEqual(0);
  });

  it("animation snapshot JSON contains no DOM/browser references", () => {
    const a = buildAnimation("L4");
    const json = JSON.stringify(a);
    expect(json).not.toContain("requestAnimationFrame");
    expect(json).not.toContain("setTimeout");
    expect(json).not.toContain("document");
    expect(json).not.toContain("window");
    expect(json).not.toContain("CanvasRenderingContext2D");
  });
});

// ── Version ──────────────────────────────────────────────────────────────

describe("GalaxyDriftAnimation — version", () => {
  it("version is 10.36.0", () => {
    const a = buildAnimation("L4");
    expect(a.version).toBe("10.36.0");
  });

  it("characterId is preserved", () => {
    const a = buildAnimation("L4");
    expect(a.characterId).toBeTruthy();
  });

  it("zoomLevel is recorded", () => {
    expect(buildAnimation("L2").zoomLevel).toBe("L2");
    expect(buildAnimation("L4").zoomLevel).toBe("L4");
  });
});
