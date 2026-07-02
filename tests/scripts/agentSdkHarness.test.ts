import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve("outputs/agent-sdk-harness");

function read(name: string) { return readFileSync(resolve(DIR, name), "utf-8"); }

describe("V12.9 Agent SDK Harness", () => {
  // ── Files ──

  it("artifact files created", () => {
    expect(existsSync(resolve(DIR, "index.html"))).toBe(true);
    expect(existsSync(resolve(DIR, "agent-sdk-harness-data.json"))).toBe(true);
    expect(existsSync(resolve(DIR, "manifest.json"))).toBe(true);
    expect(existsSync(resolve(DIR, "README.md"))).toBe(true);
  });

  it("JSON parses", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    expect(data.artifactVersion).toBe("12.9.0");
    expect(data.samples.length).toBeGreaterThanOrEqual(5);
  });

  // ── Manifest ──

  it("manifest noApi/noLlm/noMutation/readOnly true", () => {
    const m = JSON.parse(read("manifest.json"));
    expect(m.noApiRequired).toBe(true);
    expect(m.noLlmRequired).toBe(true);
    expect(m.noMutation).toBe(true);
    expect(m.readOnly).toBe(true);
  });

  // ── Input Modes ──

  it("includes 5+ input modes", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    const labels = data.samples.map((s: any) => s.label);
    expect(labels).toContain("chat_input");
    expect(labels).toContain("journal_input");
    expect(labels).toContain("story_input");
    expect(labels).toContain("plugin_input");
    expect(labels).toContain("tool_input");
    expect(labels).toContain("blocked_input");
  });

  // ── Sample Content ──

  it("each sample has normalized input, policy, reply, writeback", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    for (const s of data.samples) {
      expect(s.normalizedInput).toBeTruthy();
      expect(s.policyDecision).toBeDefined();
      expect(s.replyPlan).toBeDefined();
      expect(s.writebackPlan).toBeDefined();
    }
  });

  it("blocked sample exists", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    const blocked = data.samples.find((s: any) => s.label === "blocked_input");
    expect(blocked).toBeDefined();
  });

  it("all samples have noMutation=true", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    for (const s of data.samples) {
      expect(s.noMutation).toBe(true);
    }
  });

  // ── No Raw State ──

  it("no raw state forbidden keys", () => {
    const json = read("agent-sdk-harness-data.json");
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
  });

  it("no secrets leaked from plugin sample", () => {
    const json = read("agent-sdk-harness-data.json");
    expect(json).not.toContain("REDACTED_IN_HARNESS");
    expect(json).not.toContain("apiKey");
  });

  it("no final prose / no LLM output", () => {
    const json = read("agent-sdk-harness-data.json");
    expect(json).not.toContain("llmResponse");
    expect(json).not.toContain("chatCompletion");
    expect(json).not.toContain("finalMessage");
  });

  // ── README ──

  it("README safety disclaimers", () => {
    const readme = read("README.md");
    expect(readme).toContain("NOT");
    expect(readme).toContain("medical");
    expect(readme).toContain("Offline");
  });

  // ── HTML ──

  it("HTML references data safely", () => {
    const html = read("index.html");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("__SDK_HARNESS__");
    expect(html).not.toContain("eval(");
  });

  // ── Deterministic ──

  it("deterministic regeneration stable for key fields", () => {
    const data = JSON.parse(read("agent-sdk-harness-data.json"));
    expect(data.artifactVersion).toBe("12.9.0");
    expect(data.safety.readOnly).toBe(true);
    expect(data.safety.noApiRequired).toBe(true);
  });
});
