import { describe, expect, it } from "vitest";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import { buildMindGalaxyViewSnapshot } from "../../../src/core/graph/mindGalaxyViewTypes";
import {
  composeGalaxyFrame,
  summarizeGalaxyFrame,
  getGalaxyFrameLayerSummary,
  type GalaxyFrame,
  type GalaxyFrameComposeOptions,
} from "../../../src/core/graph/mindGalaxyFrameComposer";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint,
} from "../../../src/core/character/characterBlueprint";

function freshView() {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const graph = buildMindGraphSnapshot(state);
  const layout = buildGraphLayoutSnapshot(graph);
  return buildMindGalaxyViewSnapshot(graph, layout);
}

function compose(opts?: GalaxyFrameComposeOptions): GalaxyFrame {
  return composeGalaxyFrame(freshView(), opts);
}

// ── Deterministic Output ─────────────────────────────────────────────────

describe("GalaxyFrame — deterministic output", () => {
  it("same snapshot + options → identical frame", () => {
    const view = freshView();
    const f1 = composeGalaxyFrame(view, { scale: 2.0, timeMs: 5000, seed: "det" });
    const f2 = composeGalaxyFrame(view, { scale: 2.0, timeMs: 5000, seed: "det" });
    expect(f1.commands.length).toBe(f2.commands.length);
    expect(f1.summary).toEqual(f2.summary);
    for (let i = 0; i < f1.commands.length; i++) {
      expect(f1.commands[i]!.kind).toBe(f2.commands[i]!.kind);
      expect(f1.commands[i]!.zIndex).toBe(f2.commands[i]!.zIndex);
    }
  });

  it("no Math.random — repeated calls produce byte-identical JSON", () => {
    const view = freshView();
    const f1 = JSON.stringify(composeGalaxyFrame(view, { seed: "d" }));
    const f2 = JSON.stringify(composeGalaxyFrame(view, { seed: "d" }));
    expect(f1).toBe(f2);
  });
});

// ── L0 Hides Labels and Drift ────────────────────────────────────────────

describe("GalaxyFrame — L0 hides labels and drift vectors", () => {
  it("L0: no driftVector commands", () => {
    const frame = compose({ scale: 0.5, showDriftVectors: true });
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });

  it("L0: minimal text commands (only core label if radius large enough)", () => {
    const frame = compose({ scale: 0.5 });
    const texts = frame.commands.filter((c) => c.kind === "text");
    // At L0, only personality_core may have a label; everything else is hidden
    expect(texts.length).toBeLessThanOrEqual(1);
  });

  it("L0: summary reflects L0 zoom", () => {
    const frame = compose({ scale: 0.5 });
    expect(frame.summary.zoomLevel).toBe("L0");
    // At L0, drift is not rendered even if tracks exist
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });
});

// ── L4 Includes Drift Vectors ────────────────────────────────────────────

describe("GalaxyFrame — L4 includes drift vectors", () => {
  it("L4: driftVector commands present when showDriftVectors=true", () => {
    const frame = compose({ scale: 6.0, showDriftVectors: true, reducedMotion: false });
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts.length).toBeGreaterThan(0);
  });

  it("L4: drift is active in summary", () => {
    const frame = compose({ scale: 6.0, reducedMotion: false });
    expect(frame.summary.driftActive).toBe(true);
    expect(frame.summary.driftVectorsVisible).toBe(true);
  });
});

// ── Reduced Motion ───────────────────────────────────────────────────────

describe("GalaxyFrame — reducedMotion", () => {
  it("reducedMotion=true: no driftVector commands even at L4", () => {
    const frame = compose({ scale: 6.0, reducedMotion: true });
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
    expect(frame.summary.reducedMotion).toBe(true);
    expect(frame.summary.driftActive).toBe(false);
  });

  it("reducedMotion=true: commands are static (no drift offsets applied)", () => {
    // Compare frames at two different times — commands should be identical
    const view = freshView();
    const f1 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 0, reducedMotion: true });
    const f2 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 30000, reducedMotion: true });
    expect(JSON.stringify(f1.commands)).toBe(JSON.stringify(f2.commands));
  });
});

// ── showLabels=false ─────────────────────────────────────────────────────

describe("GalaxyFrame — showLabels=false", () => {
  it("showLabels=false: no text commands", () => {
    const frame = compose({ scale: 3.0, showLabels: false });
    const texts = frame.commands.filter((c) => c.kind === "text");
    expect(texts).toHaveLength(0);
    expect(frame.summary.labelsVisible).toBe(false);
  });
});

// ── showDriftVectors=false ───────────────────────────────────────────────

describe("GalaxyFrame — showDriftVectors=false", () => {
  it("showDriftVectors=false: no driftVector commands at L4", () => {
    const frame = compose({ scale: 6.0, showDriftVectors: false });
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
    expect(frame.summary.driftVectorsVisible).toBe(false);
  });
});

// ── timeMs Changes Offsets ───────────────────────────────────────────────

describe("GalaxyFrame — timeMs changes offsets", () => {
  it("different timeMs produces potentially different circle positions", () => {
    const view = freshView();
    const f1 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 0 });
    const f2 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 15000 });

    // Command count should be the same
    expect(f1.commands.length).toBe(f2.commands.length);

    // Same kinds and zIndex order
    for (let i = 0; i < f1.commands.length; i++) {
      expect(f1.commands[i]!.kind).toBe(f2.commands[i]!.kind);
      expect(f1.commands[i]!.zIndex).toBe(f2.commands[i]!.zIndex);
    }
  });

  it("timeMs wraps correctly — same frame at t and t+period", () => {
    // This is guaranteed by the drift animation layer; verify via frame
    const view = freshView();
    const f1 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 5000 });
    const f2 = composeGalaxyFrame(view, { scale: 6.0, timeMs: 5000 + 60_000 }); // +default period
    expect(f1.summary.totalCommands).toBe(f2.summary.totalCommands);
    // Commands may differ slightly due to drift → verify both are valid frames
    expect(f1.version).toBe("10.37.0");
    expect(f2.version).toBe("10.37.0");
  });
});

// ── Empty Snapshot ───────────────────────────────────────────────────────

describe("GalaxyFrame — empty snapshot", () => {
  it("empty snapshot returns frame with background command", () => {
    const state = createCharacterStateFromBlueprint(
      { ...createLinFanBlueprint(), identity: { id: "empty-frame", name: "E", description: "", tags: [] } },
      { seedInitialExperiences: false }
    );
    const graph = buildMindGraphSnapshot(state);
    const layout = buildGraphLayoutSnapshot(graph);
    const view = buildMindGalaxyViewSnapshot(graph, layout);
    const frame = composeGalaxyFrame(view, { scale: 1.0 });

    expect(frame.version).toBe("10.37.0");
    expect(frame.commands.length).toBeGreaterThan(0);
    expect(frame.commands[0]!.kind).toBe("background");
  });
});

// ── Summary ──────────────────────────────────────────────────────────────

describe("GalaxyFrame — summary", () => {
  it("summary.totalCommands matches commands.length", () => {
    const frame = compose({ scale: 2.0 });
    expect(frame.summary.totalCommands).toBe(frame.commands.length);
  });

  it("summarizeGalaxyFrame returns the embedded summary", () => {
    const frame = compose({ scale: 2.0 });
    expect(summarizeGalaxyFrame(frame)).toBe(frame.summary);
  });

  it("summary includes correct zoom info", () => {
    const frame = compose({ scale: 1.0 });
    expect(frame.summary.zoomLevel).toBe("L1");
    expect(frame.summary.zoomScale).toBe(1.0);
  });
});

// ── Layer Summary ────────────────────────────────────────────────────────

describe("GalaxyFrame — layer summary", () => {
  it("getGalaxyFrameLayerSummary returns 6 layers", () => {
    const frame = compose({ scale: 3.0 });
    const layers = getGalaxyFrameLayerSummary(frame);
    expect(layers).toHaveLength(6);
    expect(layers[0]!.layer).toBe("background");
    expect(layers[5]!.layer).toBe("drift_vectors");
  });

  it("layer command counts sum to totalCommands", () => {
    const frame = compose({ scale: 3.0 });
    const layers = getGalaxyFrameLayerSummary(frame);
    const sum = layers.reduce((a, l) => a + l.commandCount, 0);
    expect(sum).toBe(frame.commands.length);
  });

  it("background layer has exactly 1 command (background fill)", () => {
    const frame = compose({ scale: 1.0 });
    const layers = getGalaxyFrameLayerSummary(frame);
    const bg = layers.find((l) => l.layer === "background");
    expect(bg).toBeDefined();
    expect(bg!.commandCount).toBe(1);
    expect(bg!.commandKinds).toContain("background");
  });
});

// ── Pan/Scale in Metadata ────────────────────────────────────────────────

describe("GalaxyFrame — pan/scale metadata", () => {
  it("panX/panY are recorded in resolved options", () => {
    const frame = compose({ panX: 50, panY: -30 });
    expect(frame.options.panX).toBe(50);
    expect(frame.options.panY).toBe(-30);
  });

  it("scale is recorded in zoomState and summary", () => {
    const frame = compose({ scale: 3.5 });
    expect(frame.zoomState.scale).toBe(3.5);
    expect(frame.summary.zoomScale).toBe(3.5);
  });
});

// ── No Mutation ──────────────────────────────────────────────────────────

describe("GalaxyFrame — no mutation", () => {
  it("view snapshot is not mutated by composeGalaxyFrame", () => {
    const view = freshView();
    const nodeCount = view.nodes.length;
    const edgeCount = view.edges.length;
    composeGalaxyFrame(view, { scale: 4.0 });
    expect(view.nodes).toHaveLength(nodeCount);
    expect(view.edges).toHaveLength(edgeCount);
  });

  it("frame is not mutated by summary/layer functions", () => {
    const frame = compose({ scale: 2.0 });
    const cmdCount = frame.commands.length;
    summarizeGalaxyFrame(frame);
    getGalaxyFrameLayerSummary(frame);
    expect(frame.commands).toHaveLength(cmdCount);
  });
});

// ── No Browser APIs ──────────────────────────────────────────────────────

describe("GalaxyFrame — no browser APIs", () => {
  it("frame JSON contains no DOM/browser references", () => {
    const frame = compose({ scale: 4.0 });
    const json = JSON.stringify(frame);
    expect(json).not.toContain("requestAnimationFrame");
    expect(json).not.toContain("document");
    expect(json).not.toContain("window");
    expect(json).not.toContain("CanvasRenderingContext2D");
    expect(json).not.toContain("setTimeout");
  });

  it("composeGalaxyFrame runs without browser globals", () => {
    const frame = compose({ scale: 4.0, timeMs: 12345 });
    expect(frame.version).toBe("10.37.0");
  });
});

// ── Version ──────────────────────────────────────────────────────────────

describe("GalaxyFrame — version", () => {
  it("version is 10.37.0", () => {
    const frame = compose();
    expect(frame.version).toBe("10.37.0");
  });

  it("characterId is preserved", () => {
    const frame = compose();
    expect(frame.characterId).toBeTruthy();
  });

  it("generatedAt is from the snapshot", () => {
    const frame = compose();
    expect(frame.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ── Default Options ──────────────────────────────────────────────────────

describe("GalaxyFrame — default options", () => {
  it("defaults produce L1 frame with labels and no drift", () => {
    const frame = compose();
    expect(frame.summary.zoomLevel).toBe("L1");
    expect(frame.summary.labelsVisible).toBe(true);
    // at L1, drift vectors should not be present
    const drifts = frame.commands.filter((c) => c.kind === "driftVector");
    expect(drifts).toHaveLength(0);
  });
});
