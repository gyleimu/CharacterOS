import { describe, expect, it } from "vitest";
import {
  validateMindGalaxyPreviewData,
  assertMindGalaxyPreviewData,
  summarizeMindGalaxyPreviewData,
  normalizeMindGalaxyPreviewData,
  type MindGalaxyPreviewData,
} from "../../../src/core/graph/mindGalaxyPreviewContract";

function validData(overrides?: Partial<MindGalaxyPreviewData>): MindGalaxyPreviewData {
  return {
    version: "10.47.0",
    generatedAt: "2026-06-28T00:00:00.000Z",
    characterId: "test-char",
    source: "test",
    centerX: 500,
    centerY: 400,
    totalNodes: 3,
    totalEdges: 2,
    driftNodeCount: 2,
    _integrity: { fullStateIncluded: false, rawStateIncluded: false, clusterPayloadIncluded: false, memoryPayloadIncluded: false, routinePayloadIncluded: false },
    nodes: [
      { id: "n1", type: "personality_core", label: "Core", x: 500, y: 400, r: 30, fill: "#FFD700", stroke: "#B8860B", w: 1.0, z: 100 },
      { id: "n2", type: "memory", label: "Memory", x: 300, y: 500, r: 8, fill: "#87CEEB", stroke: "#4682B4", w: 0.7, risk: "high", z: 50, drift: { a: 1.5, m: 0.3 } },
      { id: "n3", type: "belief", label: "Belief", x: 600, y: 300, r: 12, fill: "#98FB98", stroke: "#228B22", w: 0.5, z: 50, drift: { a: 3.0, m: 0.15 } },
    ],
    edges: [
      { id: "e1", t: "belongs_to_cluster", s: "n2", d: "n1", w: 0.8, style: { stroke: "#4169E1", sw: 1.5, op: 0.6 }, dir: 0 },
      { id: "e2", t: "activates_belief", s: "n2", d: "n3", w: 0.6, style: { stroke: "#228B22", sw: 2, op: 0.7 }, dir: 1 },
    ],
    ...overrides,
  };
}

// ── Valid data passes ────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — valid data", () => {
  it("valid preview data passes validation", () => {
    const result = validateMindGalaxyPreviewData(validData());
    expect(result.valid).toBe(true);
    expect(result.summary.errorCount).toBe(0);
  });

  it("valid data has correct summary counts", () => {
    const result = validateMindGalaxyPreviewData(validData());
    expect(result.summary.nodeCount).toBe(3);
    expect(result.summary.edgeCount).toBe(2);
  });
});

// ── Missing root fields ──────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — missing root fields", () => {
  it("fails when version is missing", () => {
    const d = validData() as unknown as Record<string, unknown>;
    delete d.version;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when characterId is missing", () => {
    const d = validData() as unknown as Record<string, unknown>;
    delete d.characterId;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when nodes is not an array", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.nodes = "not-an-array";
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when input is null", () => {
    expect(validateMindGalaxyPreviewData(null).valid).toBe(false);
  });

  it("fails when input is a string", () => {
    expect(validateMindGalaxyPreviewData("hello").valid).toBe(false);
  });
});

// ── Bad coordinates / values ─────────────────────────────────────────────

describe("MindGalaxyPreviewContract — bad values", () => {
  it("fails when node x is NaN", () => {
    const d = validData();
    d.nodes[0]!.x = NaN;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when node x is Infinity", () => {
    const d = validData();
    d.nodes[0]!.x = Infinity;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when node r is negative", () => {
    const d = validData();
    d.nodes[0]!.r = -1;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when node id is empty", () => {
    const d = validData();
    d.nodes[0]!.id = "";
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("warns when node w is outside [0,1]", () => {
    const d = validData();
    d.nodes[0]!.w = 2.5;
    const result = validateMindGalaxyPreviewData(d);
    expect(result.valid).toBe(true); // warning, not error
    expect(result.summary.warningCount).toBeGreaterThan(0);
  });
});

// ── Dangling edges ───────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — edge validation", () => {
  it("warns when edge source does not exist in nodes", () => {
    const d = validData();
    d.edges[0]!.s = "nonexistent";
    const result = validateMindGalaxyPreviewData(d);
    expect(result.summary.warningCount).toBeGreaterThan(0);
    expect(result.valid).toBe(true); // dangling is warning, not error
  });

  it("fails when edge dir is not 0 or 1", () => {
    const d = validData();
    d.edges[0]!.dir = 5;
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("warns when edge op is outside [0,1]", () => {
    const d = validData();
    d.edges[0]!.style.op = 2.0;
    const result = validateMindGalaxyPreviewData(d);
    expect(result.summary.warningCount).toBeGreaterThan(0);
  });

  it("fails when edge id is empty", () => {
    const d = validData();
    d.edges[0]!.id = "";
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });
});

// ── Count mismatches ─────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — count mismatches", () => {
  it("fails when totalNodes != nodes.length", () => {
    const d = validData({ totalNodes: 99 });
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when totalEdges != edges.length", () => {
    const d = validData({ totalEdges: 99 });
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("warns when driftNodeCount does not match actual drift count", () => {
    const d = validData({ driftNodeCount: 99 });
    const result = validateMindGalaxyPreviewData(d);
    expect(result.summary.warningCount).toBeGreaterThan(0);
  });
});

// ── Forbidden keys ───────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — forbidden keys", () => {
  it("fails when finalState key is present", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.finalState = {};
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when CharacterPhysicsState key is present", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.CharacterPhysicsState = {};
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when serializedState key is present", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.serializedState = {};
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when coordinate key is present", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.coordinate = { trust: 0.5 };
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when proceduralRoutines key is present", () => {
    const d = validData() as unknown as Record<string, unknown>;
    d.proceduralRoutines = [];
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });
});

// ── Duplicate IDs ────────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — duplicate IDs", () => {
  it("fails when two nodes share the same id", () => {
    const d = validData();
    d.nodes[1]!.id = "n1";
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });

  it("fails when two edges share the same id", () => {
    const d = validData();
    d.edges[1]!.id = "e1";
    expect(validateMindGalaxyPreviewData(d).valid).toBe(false);
  });
});

// ── Assert ───────────────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — assert", () => {
  it("assert returns data on valid input", () => {
    const d = validData();
    const result = assertMindGalaxyPreviewData(d);
    expect(result).toBe(d);
  });

  it("assert throws on invalid input", () => {
    expect(() => assertMindGalaxyPreviewData({})).toThrow("MindGalaxyPreviewData validation failed");
  });
});

// ── Summarize ────────────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — summarize", () => {
  it("returns correct node and edge counts", () => {
    const s = summarizeMindGalaxyPreviewData(validData());
    expect(s.nodeCount).toBe(3);
    expect(s.edgeCount).toBe(2);
    expect(s.driftNodeCount).toBe(2);
  });

  it("counts node types correctly", () => {
    const s = summarizeMindGalaxyPreviewData(validData());
    expect(s.nodeTypes.personality_core).toBe(1);
    expect(s.nodeTypes.memory).toBe(1);
    expect(s.nodeTypes.belief).toBe(1);
  });

  it("counts risk levels", () => {
    const s = summarizeMindGalaxyPreviewData(validData());
    expect(s.hasRiskHigh).toBe(1);
    expect(s.hasRiskMedium).toBe(0);
  });
});

// ── Normalize ────────────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — normalize", () => {
  it("normalize returns a new object", () => {
    const d = validData();
    const n = normalizeMindGalaxyPreviewData(d);
    expect(n).not.toBe(d);
    expect(n.nodes).not.toBe(d.nodes);
    expect(n.edges).not.toBe(d.edges);
  });

  it("normalize recomputes totalNodes from nodes.length", () => {
    const d = validData({ totalNodes: 99 });
    const n = normalizeMindGalaxyPreviewData(d);
    expect(n.totalNodes).toBe(3); // recalculated from actual nodes
  });

  it("normalize recomputes driftNodeCount", () => {
    const d = validData();
    // Remove drift from one node
    delete d.nodes[1]!.drift;
    const n = normalizeMindGalaxyPreviewData(d);
    expect(n.driftNodeCount).toBe(1);
  });

  it("normalize does not mutate input", () => {
    const d = validData();
    const originalTotalNodes = d.totalNodes;
    normalizeMindGalaxyPreviewData(d);
    expect(d.totalNodes).toBe(originalTotalNodes);
  });
});

// ── Summary output ───────────────────────────────────────────────────────

describe("MindGalaxyPreviewContract — summary output", () => {
  it("summary contains version and characterId", () => {
    const s = summarizeMindGalaxyPreviewData(validData());
    expect(s.version).toBe("10.47.0");
    expect(s.characterId).toBe("test-char");
  });

  it("summary edgeTypes count is correct", () => {
    const s = summarizeMindGalaxyPreviewData(validData());
    expect(s.edgeTypes.belongs_to_cluster).toBe(1);
    expect(s.edgeTypes.activates_belief).toBe(1);
  });
});
