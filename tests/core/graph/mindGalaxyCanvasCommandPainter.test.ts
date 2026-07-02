import { describe, expect, it } from "vitest";
import {
  sortGalaxyCanvasCommandsForPaint,
  validateGalaxyCanvasCommands,
  summarizePaintPlan,
} from "../../../src/core/graph/mindGalaxyCanvasCommandPainter";
import type { GalaxyCanvasRenderCommand } from "../../../src/core/graph/mindGalaxyCanvasRenderer";

function bg(): GalaxyCanvasRenderCommand {
  return { kind: "background" as const, color: "#000", width: 800, height: 600, zIndex: 0 };
}

function circleCmd(z: number): GalaxyCanvasRenderCommand {
  return { kind: "circle" as const, x: 100, y: 100, radius: 10, fill: "#FFF", stroke: "#CCC", strokeWidth: 1, opacity: 1, zIndex: z };
}

function lineCmd(z: number): GalaxyCanvasRenderCommand {
  return { kind: "line" as const, x1: 0, y1: 0, x2: 100, y2: 100, stroke: "#999", strokeWidth: 1, opacity: 0.5, directed: false, zIndex: z };
}

function textCmd(z: number): GalaxyCanvasRenderCommand {
  return { kind: "text" as const, x: 50, y: 50, content: "hello", fontSize: 12, color: "#FFF", opacity: 1, zIndex: z };
}

function driftCmd(z: number): GalaxyCanvasRenderCommand {
  return { kind: "driftVector" as const, x: 0, y: 0, dx: 1, dy: 1, endX: 1, endY: 1, color: "#F00", opacity: 0.6, nodeId: "n1", zIndex: z };
}

function glowCmd(z: number): GalaxyCanvasRenderCommand {
  return { kind: "glow" as const, x: 50, y: 50, radius: 30, color: "rgba(80,100,180,0.1)", opacity: 0.5, zIndex: z };
}

// ── Sort ─────────────────────────────────────────────────────────────────

describe("GalaxyCanvasCommandPainter — sort", () => {
  it("sorts by zIndex ascending", () => {
    const cmds = [circleCmd(300), bg(), circleCmd(10), lineCmd(50)];
    const sorted = sortGalaxyCanvasCommandsForPaint(cmds);
    expect(sorted[0]!.zIndex).toBe(0);
    expect(sorted[1]!.zIndex).toBe(10);
    expect(sorted[2]!.zIndex).toBe(50);
    expect(sorted[3]!.zIndex).toBe(300);
  });

  it("stable sort: equal zIndex preserves insertion order", () => {
    const cmds = [
      { ...circleCmd(50), nodeId: "a" },
      { ...circleCmd(50), nodeId: "b" },
      { ...circleCmd(50), nodeId: "c" },
    ];
    const sorted = sortGalaxyCanvasCommandsForPaint(cmds);
    expect((sorted[0] as unknown as Record<string, unknown>).nodeId).toBe("a");
    expect((sorted[1] as unknown as Record<string, unknown>).nodeId).toBe("b");
    expect((sorted[2] as unknown as Record<string, unknown>).nodeId).toBe("c");
  });

  it("does not mutate input", () => {
    const cmds = [circleCmd(300), bg(), lineCmd(50)];
    const copy = [...cmds];
    sortGalaxyCanvasCommandsForPaint(cmds);
    expect(cmds).toEqual(copy);
  });

  it("empty list returns empty", () => {
    expect(sortGalaxyCanvasCommandsForPaint([])).toEqual([]);
  });
});

// ── Validation ───────────────────────────────────────────────────────────

describe("GalaxyCanvasCommandPainter — validation", () => {
  it("validates a correct command list", () => {
    const result = validateGalaxyCanvasCommands([bg(), circleCmd(10)]);
    expect(result.valid).toBe(true);
    expect(result.invalidCommands).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects command with unknown kind", () => {
    const bad = { kind: "unknown_kind", zIndex: 0 } as unknown as GalaxyCanvasRenderCommand;
    const result = validateGalaxyCanvasCommands([bg(), bad]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown"))).toBe(true);
  });

  it("rejects non-object command", () => {
    const result = validateGalaxyCanvasCommands([null as unknown as GalaxyCanvasRenderCommand]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not an object"))).toBe(true);
  });

  it("rejects command without zIndex", () => {
    const bad = { kind: "circle" } as unknown as GalaxyCanvasRenderCommand;
    const result = validateGalaxyCanvasCommands([bg(), bad]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("zIndex"))).toBe(true);
  });

  it("rejects background with invalid dimensions", () => {
    const bad: GalaxyCanvasRenderCommand = { kind: "background", color: "#000", width: 0, height: -1, zIndex: 0 } as unknown as GalaxyCanvasRenderCommand;
    const result = validateGalaxyCanvasCommands([bad]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects circle with negative radius", () => {
    const bad: GalaxyCanvasRenderCommand = { kind: "circle" as const, x: 0, y: 0, radius: -5, fill: "#F00", stroke: "#000", strokeWidth: 1, opacity: 1, zIndex: 10 };
    const result = validateGalaxyCanvasCommands([bg(), bad]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("radius"))).toBe(true);
  });

  it("warns on opacity outside [0,1] but does not invalidate", () => {
    const bad = { ...circleCmd(10), opacity: 2.5 };
    const result = validateGalaxyCanvasCommands([bg(), bad]);
    expect(result.warnings.length).toBeGreaterThan(0);
    // Still valid — opacity warning is non-fatal
    expect(result.valid).toBe(true);
  });

  it("empty command list is valid", () => {
    const result = validateGalaxyCanvasCommands([]);
    expect(result.valid).toBe(true);
    expect(result.totalCommands).toBe(0);
  });
});

// ── Summary ──────────────────────────────────────────────────────────────

describe("GalaxyCanvasCommandPainter — summary", () => {
  it("counts commands by kind", () => {
    const cmds = [bg(), circleCmd(10), circleCmd(20), lineCmd(15), textCmd(200), driftCmd(300), glowCmd(5)];
    const s = summarizePaintPlan(cmds);
    expect(s.totalCommands).toBe(7);
    expect(s.backgroundCount).toBe(1);
    expect(s.nodeCount).toBe(2);
    expect(s.edgeCount).toBe(1);
    expect(s.labelCount).toBe(1);
    expect(s.driftCount).toBe(1);
    expect(s.glowCount).toBe(1);
  });

  it("byKind sums to totalCommands", () => {
    const cmds = [bg(), circleCmd(10), lineCmd(50)];
    const s = summarizePaintPlan(cmds);
    const sum = Object.values(s.byKind).reduce((a, b) => a + b, 0);
    expect(sum).toBe(s.totalCommands);
  });

  it("empty list summary is zeroed", () => {
    const s = summarizePaintPlan([]);
    expect(s.totalCommands).toBe(0);
    expect(s.zIndexMin).toBe(0);
    expect(s.zIndexMax).toBe(0);
  });

  it("zIndexMin/Max correct", () => {
    const cmds = [bg(), circleCmd(300), lineCmd(10)];
    const s = summarizePaintPlan(cmds);
    expect(s.zIndexMin).toBe(0);
    expect(s.zIndexMax).toBe(300);
  });

  it("does not mutate commands", () => {
    const cmds = [bg(), circleCmd(10)];
    const copy = JSON.stringify(cmds);
    summarizePaintPlan(cmds);
    expect(JSON.stringify(cmds)).toBe(copy);
  });
});

// ── Unknown Command Type ─────────────────────────────────────────────────

describe("GalaxyCanvasCommandPainter — unknown command type", () => {
  it("validation catches unknown kinds", () => {
    // Simulate a potential future command kind
    const unknown = { kind: "futureShape", zIndex: 5 } as unknown as GalaxyCanvasRenderCommand;
    const result = validateGalaxyCanvasCommands([bg(), unknown]);
    expect(result.valid).toBe(false);
    expect(result.invalidCommands).toBeGreaterThanOrEqual(1);
  });
});
