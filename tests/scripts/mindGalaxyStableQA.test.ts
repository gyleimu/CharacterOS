import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateMindGalaxyPreviewData } from "../../src/core/graph/mindGalaxyPreviewContract";

const ROOT = resolve(".");
const ARTIFACT_DIR = resolve("outputs/mind-galaxy-artifact");

function readArtifact(file: string): string {
  return readFileSync(resolve(ARTIFACT_DIR, file), "utf-8");
}

function extractEmbeddedData(html: string): unknown {
  const match = html.match(/window\.__MIND_GALAXY_PREVIEW_DATA__\s*=\s*({[\s\S]*?});/);
  if (!match) throw new Error("embedded preview data not found");
  return JSON.parse(match[1]!);
}

describe("Mind Galaxy Stable QA", () => {
  it("artifact package is complete and self-contained", () => {
    for (const file of ["index.html", "mind-galaxy-preview.js", "mind-galaxy-real-data.json", "manifest.json", "README.md"]) {
      expect(existsSync(resolve(ARTIFACT_DIR, file))).toBe(true);
    }

    const html = readArtifact("index.html");
    expect(html).toContain("window.__MIND_GALAXY_PREVIEW_DATA__");
    expect(html).toContain('<script src="mind-galaxy-preview.js"></script>');
    expect(html.indexOf("window.__MIND_GALAXY_PREVIEW_DATA__")).toBeLessThan(
      html.indexOf('<script src="mind-galaxy-preview.js"></script>'),
    );
  });

  it("preview source and artifact JavaScript are synchronized", () => {
    const sourceJs = readFileSync(resolve(ROOT, "previews/mind-galaxy-preview.js"), "utf-8");
    const artifactJs = readArtifact("mind-galaxy-preview.js");
    expect(artifactJs).toBe(sourceJs);
  });

  it("manifest, JSON data, and embedded data agree on stable counts", () => {
    const manifest = JSON.parse(readArtifact("manifest.json"));
    const jsonData = JSON.parse(readArtifact("mind-galaxy-real-data.json"));
    const embeddedData = extractEmbeddedData(readArtifact("index.html"));

    const jsonValidation = validateMindGalaxyPreviewData(jsonData);
    const embeddedValidation = validateMindGalaxyPreviewData(embeddedData);
    expect(jsonValidation.valid).toBe(true);
    expect(embeddedValidation.valid).toBe(true);

    expect(manifest.artifactVersion).toBe("10.50.0");
    expect(manifest.generatedAt).toBe("2026-06-28T00:00:00.000Z");
    expect(manifest.stats.nodeCount).toBe(jsonData.nodes.length);
    expect(manifest.stats.edgeCount).toBe(jsonData.edges.length);
    expect(JSON.stringify(embeddedData)).toBe(JSON.stringify(jsonData));
  });

  it("artifact contains no raw-state structural payloads", () => {
    const forbidden = [
      "finalState",
      "serializedState",
      "rawCluster",
      "rawMemory",
      "rawMemories",
      "memoryPayload",
      "clusterPayload",
      "proceduralRoutines",
    ];
    const dataText = readArtifact("mind-galaxy-real-data.json");
    const htmlData = JSON.stringify(extractEmbeddedData(readArtifact("index.html")));

    for (const key of forbidden) {
      expect(dataText).not.toContain(`"${key}"`);
      expect(htmlData).not.toContain(`"${key}"`);
    }
  });

  it("debug instrument remains read-only and local", () => {
    const js = readArtifact("mind-galaxy-preview.js");
    const html = readArtifact("index.html");
    const combined = `${html}\n${js}`;

    expect(combined).toContain("Debug");
    expect(combined).toContain("Freeze Time");
    expect(combined).toContain("Copy Snapshot Summary");
    expect(combined).not.toContain("/api/");
    expect(combined).not.toContain("localStorage");
    expect(combined).not.toContain("sessionStorage");
    expect(combined).not.toContain("indexedDB");
    expect(combined).not.toContain("WebSocket");
    expect(combined).not.toContain("EventSource");
    expect(combined).not.toContain("method:\"POST\"");
    expect(combined).not.toContain("method: \"POST\"");
  });

  it("debug panel is collapsed by default", () => {
    const html = readArtifact("index.html");
    expect(html).toContain('<aside id="debug-panel" class="collapsed"');
  });
});
