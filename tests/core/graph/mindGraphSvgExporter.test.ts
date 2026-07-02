import { describe, expect, it } from "vitest";
import { exportGraphToSvg } from "../../../src/core/graph/mindGraphSvgExporter";
import { buildGraphLayoutSnapshot } from "../../../src/core/graph/mindGraphLayout";
import { buildMindGraphSnapshot } from "../../../src/core/graph/mindGraphBuilder";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint
} from "../../../src/core/character/characterBlueprint";

function freshLayout() {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
  const graph = buildMindGraphSnapshot(state);
  return buildGraphLayoutSnapshot(graph);
}

describe("exportGraphToSvg", () => {
  it("produces a valid SVG string", () => {
    const layout = freshLayout();
    const svg = exportGraphToSvg(layout);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes background rect", () => {
    const svg = exportGraphToSvg(freshLayout());
    expect(svg).toContain("<rect");
    expect(svg).toContain('fill="#0D0D1A"');
  });

  it("renders circles for nodes", () => {
    const svg = exportGraphToSvg(freshLayout());
    // Count circles outside the legend group
    const nonLegendSvg = svg.replace(/<g transform="translate.*?<\/g>/s, "");
    const circleCount = (nonLegendSvg.match(/<circle/g) || []).length;
    expect(circleCount).toBeGreaterThan(5);
  });

  it("renders lines for edges", () => {
    const svg = exportGraphToSvg(freshLayout());
    const lineCount = (svg.match(/<line/g) || []).length;
    expect(lineCount).toBeGreaterThan(0);
  });

  it("respects custom viewport size", () => {
    const svg = exportGraphToSvg(freshLayout(), { width: 800, height: 600 });
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('<rect width="800" height="600"');
  });

  it("respects custom background", () => {
    const svg = exportGraphToSvg(freshLayout(), { background: "#FFFFFF" });
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("disables labels when showLabels=false", () => {
    const svg = exportGraphToSvg(freshLayout(), { showLabels: false, showLegend: false });
    expect(svg).not.toContain("<text");
  });

  it("includes legend by default", () => {
    const svg = exportGraphToSvg(freshLayout());
    expect(svg).toContain("Core");
    expect(svg).toContain("Memory");
  });

  it("deterministic output for same input", () => {
    const layout = freshLayout();
    const svg1 = exportGraphToSvg(layout);
    const svg2 = exportGraphToSvg(layout);
    expect(svg1).toBe(svg2);
  });

  it("no DOM dependency — pure string output", () => {
    const svg = exportGraphToSvg(freshLayout());
    expect(typeof svg).toBe("string");
    expect(svg.length).toBeGreaterThan(1000);
  });
});
