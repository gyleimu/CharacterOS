import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateMindGalaxyPreviewData } from "../../src/core/graph/mindGalaxyPreviewContract";

const ARTIFACT_DIR = resolve("outputs/mind-galaxy-artifact");

describe("Mind Galaxy Static Artifact Export", () => {
  // ── Files exist ──────────────────────────────────────────────────────

  it("creates all expected files", () => {
    const files = ["index.html", "mind-galaxy-preview.js", "mind-galaxy-real-data.json", "manifest.json", "README.md"];
    for (const f of files) {
      expect(existsSync(resolve(ARTIFACT_DIR, f))).toBe(true);
    }
  });

  // ── Data JSON validates ──────────────────────────────────────────────

  it("mind-galaxy-real-data.json passes contract validation", () => {
    const raw = readFileSync(resolve(ARTIFACT_DIR, "mind-galaxy-real-data.json"), "utf-8");
    const data = JSON.parse(raw);
    const result = validateMindGalaxyPreviewData(data);
    expect(result.valid).toBe(true);
    expect(result.summary.errorCount).toBe(0);
  });

  // ── Manifest ─────────────────────────────────────────────────────────

  it("manifest.json has required fields", () => {
    const raw = readFileSync(resolve(ARTIFACT_DIR, "manifest.json"), "utf-8");
    const m = JSON.parse(raw);
    expect(m.artifactVersion).toBe("10.50.0");
    expect(m.generatedAt).toBe("2026-06-28T00:00:00.000Z");
    expect(m.characterId).toBeTruthy();
    expect(m.contract).toContain("mindGalaxyPreviewContract");
    expect(m.stats.nodeCount).toBeGreaterThan(0);
    expect(m.stats.edgeCount).toBeGreaterThan(0);
    expect(m.files).toContain("index.html");
    expect(m.files).toContain("mind-galaxy-preview.js");
    expect(m.files).toContain("mind-galaxy-real-data.json");
    expect(m.files).toContain("manifest.json");
    expect(m.files).toContain("README.md");
    expect(m.integrity.fullStateIncluded).toBe(false);
    expect(m.integrity.rawStateIncluded).toBe(false);
  });

  // ── HTML contains embedded data ──────────────────────────────────────

  it("index.html contains embedded preview data bootstrap", () => {
    const html = readFileSync(resolve(ARTIFACT_DIR, "index.html"), "utf-8");
    expect(html).toContain("window.__MIND_GALAXY_PREVIEW_DATA__");
    expect(html).toContain("debug-toggle");
    expect(html).toContain("Freeze Time");
    expect(html).toContain("Drift Inspect");
    expect(html).toContain("Copy Snapshot Summary");
    expect(html).toContain('"nodes"');
    expect(html).toContain('"edges"');
    expect(html).toContain('"characterId"');
  });

  it("embedded data is valid JSON parseable from HTML", () => {
    const html = readFileSync(resolve(ARTIFACT_DIR, "index.html"), "utf-8");
    const match = html.match(/window\.__MIND_GALAXY_PREVIEW_DATA__\s*=\s*({[\s\S]*?});/);
    expect(match).toBeTruthy();
    const data = JSON.parse(match![1]!);
    const result = validateMindGalaxyPreviewData(data);
    expect(result.valid).toBe(true);
  });

  it("embedded data bootstrap appears before preview script", () => {
    const html = readFileSync(resolve(ARTIFACT_DIR, "index.html"), "utf-8");
    const dataIndex = html.indexOf("window.__MIND_GALAXY_PREVIEW_DATA__");
    const scriptIndex = html.indexOf('<script src="mind-galaxy-preview.js"></script>');
    expect(dataIndex).toBeGreaterThanOrEqual(0);
    expect(scriptIndex).toBeGreaterThan(dataIndex);
  });

  // ── No raw state leak ────────────────────────────────────────────────

  it("data JSON contains no forbidden raw-state keys", () => {
    const raw = readFileSync(resolve(ARTIFACT_DIR, "mind-galaxy-real-data.json"), "utf-8");
    const forbidden = ["CharacterPhysicsState", "finalState", "serializedState", "proceduralRoutines"];
    for (const key of forbidden) {
      expect(raw).not.toContain(`"${key}"`);
    }
  });

  it("embedded HTML data contains no forbidden raw-state keys", () => {
    const html = readFileSync(resolve(ARTIFACT_DIR, "index.html"), "utf-8");
    const match = html.match(/window\.__MIND_GALAXY_PREVIEW_DATA__\s*=\s*({[\s\S]*?});/);
    expect(match).toBeTruthy();
    for (const key of ["CharacterPhysicsState", "finalState", "serializedState", "proceduralRoutines"]) {
      expect(match![1]!).not.toContain(`"${key}"`);
    }
  });

  // ── README ───────────────────────────────────────────────────────────

  it("README.md mentions no raw state / no write capability", () => {
    const readme = readFileSync(resolve(ARTIFACT_DIR, "README.md"), "utf-8");
    expect(readme).toContain("write");
    expect(readme).toContain("CharacterPhysicsState");
  });

  it("README.md mentions how to open", () => {
    const readme = readFileSync(resolve(ARTIFACT_DIR, "README.md"), "utf-8");
    expect(readme).toContain("index.html");
  });

  it("README.md mentions regeneration command", () => {
    const readme = readFileSync(resolve(ARTIFACT_DIR, "README.md"), "utf-8");
    expect(readme).toContain("export-mind-galaxy-static-artifact");
  });

  // ── JS file copied correctly ─────────────────────────────────────────

  it("mind-galaxy-preview.js contains embedded data support", () => {
    const js = readFileSync(resolve(ARTIFACT_DIR, "mind-galaxy-preview.js"), "utf-8");
    expect(js).toContain("__MIND_GALAXY_PREVIEW_DATA__");
  });

  it("mind-galaxy-preview.js contains debug instrument controls", () => {
    const js = readFileSync(resolve(ARTIFACT_DIR, "mind-galaxy-preview.js"), "utf-8");
    expect(js).toContain("frozenTime");
    expect(js).toContain("Freeze Time");
    expect(js).toContain("buildSnapshotSummary");
    expect(js).toContain("preset-drift");
  });
});
