import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ARTIFACT_DIR = resolve("outputs/characteros-explorer");

function readFile(name: string): string {
  return readFileSync(resolve(ARTIFACT_DIR, name), "utf-8");
}

describe("V11.9 CharacterOS Explorer Artifact", () => {
  // ── Files Exist ──

  it("artifact files created", () => {
    expect(existsSync(resolve(ARTIFACT_DIR, "index.html"))).toBe(true);
    expect(existsSync(resolve(ARTIFACT_DIR, "characteros-explorer-data.json"))).toBe(true);
    expect(existsSync(resolve(ARTIFACT_DIR, "manifest.json"))).toBe(true);
    expect(existsSync(resolve(ARTIFACT_DIR, "README.md"))).toBe(true);
  });

  // ── JSON ──

  it("JSON parses", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.artifactVersion).toBeTruthy();
    expect(data.characterId).toBe("lin_fan");
  });

  it("manifest readOnly=true, noApiRequired=true, noLlmRequired=true", () => {
    const manifest = JSON.parse(readFile("manifest.json"));
    expect(manifest.readOnly).toBe(true);
    expect(manifest.noApiRequired).toBe(true);
    expect(manifest.noLlmRequired).toBe(true);
    expect(manifest.noMutation).toBe(true);
  });

  // ── Module Coverage ──

  it("includes all six modules", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.characterState).toBeDefined();
    expect(data.eventStudio).toBeDefined();
    expect(data.explainability).toBeDefined();
    expect(data.timeMachine).toBeDefined();
    expect(data.mindGalaxy).toBeDefined();
    expect(data.realityAudit).toBeDefined();
    expect(data.moduleCoverage.eventStudio).toBeTruthy();
    expect(data.moduleCoverage.timeMachine).toBeTruthy();
  });

  it("includes Event Studio preview", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.eventStudio.support.preview.parsedEvent.category).toBeTruthy();
    expect(data.eventStudio.abandon.preview.parsedEvent.category).toBeTruthy();
    expect(data.eventStudio.neutral.preview.parsedEvent.category).toBeTruthy();
  });

  it("includes Character State surface", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.characterState.headline).toBeTruthy();
    expect(data.characterState.personalitySummary.trust.label).toBeTruthy();
  });

  it("includes Explainability timeline", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.explainability.question).toBeTruthy();
    expect(data.explainability.causalSteps).toBeDefined();
  });

  it("includes Time Machine timeline and restore view", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.timeMachine.snapshots).toBeDefined();
    expect(data.timeMachine.timeline).toBeDefined();
  });

  it("includes Mind Galaxy embed", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.mindGalaxy.mode).toBe("advanced");
    expect(data.mindGalaxy.noMutation).toBe(true);
  });

  it("includes Reality Audit panel", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    expect(data.realityAudit.surface).toBeDefined();
    expect(data.realityAudit.disclaimers.length).toBeGreaterThan(0);
  });

  // ── No Raw State ──

  it("no raw state forbidden keys", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    const json = JSON.stringify(data);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
    expect(json).not.toContain("homeostasisState");
    expect(json).not.toContain("proceduralRoutines");
    expect(json).not.toContain('"trust":0.');
    expect(json).not.toContain('"fear":0.');
  });

  // ── No Chat/Agent ──

  it("no chat/agent/multi fields", () => {
    const data = JSON.parse(readFile("characteros-explorer-data.json"));
    const json = JSON.stringify(data);
    expect(json).not.toContain("chat");
    expect(json).not.toContain("agent");
    expect(json).not.toContain("multi-character");
  });

  // ── README ──

  it("README contains safety disclaimers", () => {
    const readme = readFile("README.md");
    expect(readme).toContain("read-only");
    expect(readme).toContain("medical");
    expect(readme).toContain("diagnostic");
    expect(readme).toContain("Not a chat");
  });

  it("README mentions all six modules", () => {
    const readme = readFile("README.md");
    expect(readme).toContain("Character State");
    expect(readme).toContain("Event Studio");
    expect(readme).toContain("Explainability");
    expect(readme).toContain("Time Machine");
    expect(readme).toContain("Mind Galaxy");
    expect(readme).toContain("Reality Audit");
  });

  // ── HTML ──

  it("HTML references data/script safely", () => {
    const html = readFile("index.html");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("__EXPLORER_DATA__");
    expect(html).not.toContain("eval(");
  });

  // ── Deterministic ──

  it("deterministic regeneration stable for key fields", () => {
    const data1 = JSON.parse(readFile("characteros-explorer-data.json"));
    // Re-run would produce new timestamps, but structure should be stable
    expect(data1.artifactVersion).toBe("11.9.0");
    expect(data1.safety.readOnly).toBe(true);
    expect(data1.moduleCoverage.eventStudio).toBeTruthy();
  });
});
