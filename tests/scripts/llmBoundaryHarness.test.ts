import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = resolve("outputs/llm-boundary-harness");

interface HarnessCase {
  id: string;
  execution: {
    verdict: string;
    providerCalled: boolean;
    providerValidationVerdict: string | null;
    providerViolationRuleIds: string[];
    providerGroundingVerdict: string | null;
    fallbackReason: string | null;
    deliveredSource: string;
    deliveredValidationVerdict: string;
    deliveredGroundingVerdict: string;
    noMutation: boolean;
    noWritebackAuthority: boolean;
    networkUsed: boolean;
  };
}

interface HarnessData {
  artifactVersion: string;
  generatedAt: string;
  summary: { caseCount: number; llmReplyCount: number; fallbackCount: number; deliveredFailures: number };
  safety: Record<string, boolean>;
  cases: HarnessCase[];
}

function read(name: string): string {
  return readFileSync(resolve(DIR, name), "utf8");
}

function data(): HarnessData {
  return JSON.parse(read("llm-boundary-harness-data.json")) as HarnessData;
}

function byId(id: string): HarnessCase {
  const result = data().cases.find((item) => item.id === id);
  if (!result) throw new Error(`Missing harness case: ${id}`);
  return result;
}

describe("V13.8 static LLM boundary harness", () => {
  it("exports the complete four-file artifact", () => {
    for (const name of ["index.html", "llm-boundary-harness-data.json", "manifest.json", "README.md"]) {
      expect(existsSync(resolve(DIR, name))).toBe(true);
    }
  });

  it("uses a deterministic artifact timestamp and version", () => {
    expect(data().artifactVersion).toBe("13.8.0");
    expect(data().generatedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("covers seven success and failure paths", () => {
    expect(data().summary).toEqual({ caseCount: 7, llmReplyCount: 1, fallbackCount: 6, deliveredFailures: 0 });
  });

  it("delivers the grounded case from the mock LLM path", () => {
    const item = byId("grounded_pass").execution;
    expect(item.verdict).toBe("llm_reply");
    expect(item.providerValidationVerdict).toBe("pass");
    expect(item.providerGroundingVerdict).toBe("grounded");
    expect(item.deliveredSource).toBe("llm");
  });

  it("does not call the provider when LLM is disabled", () => {
    const item = byId("llm_disabled").execution;
    expect(item.providerCalled).toBe(false);
    expect(item.fallbackReason).toBe("llm_disabled");
  });

  it("maps provider timeout to llm_unavailable", () => {
    expect(byId("provider_timeout").execution.fallbackReason).toBe("llm_unavailable");
  });

  it("blocks diagnosis and mutation claims during validation", () => {
    expect(byId("diagnosis_blocked").execution.providerViolationRuleIds).toContain("no_diagnosis");
    expect(byId("mutation_blocked").execution.providerViolationRuleIds).toContain("no_mutation_claim");
  });

  it("blocks structurally safe but ungrounded claims", () => {
    const item = byId("ungrounded_blocked").execution;
    expect(item.providerValidationVerdict).toBe("warn");
    expect(item.providerGroundingVerdict).toBe("ungrounded");
    expect(item.fallbackReason).toBe("grounding_failed");
  });

  it("blocks output that drops required safety notices", () => {
    expect(byId("missing_safety").execution.providerViolationRuleIds).toContain("required_safety_notice");
  });

  it("revalidates every delivered reply successfully", () => {
    for (const item of data().cases) {
      expect(item.execution.deliveredValidationVerdict).toBe("pass");
      expect(item.execution.deliveredGroundingVerdict).toBe("grounded");
    }
  });

  it("never grants mutation, writeback, or network authority", () => {
    for (const item of data().cases) {
      expect(item.execution.noMutation).toBe(true);
      expect(item.execution.noWritebackAuthority).toBe(true);
      expect(item.execution.networkUsed).toBe(false);
    }
  });

  it("contains no raw-state or secret fields", () => {
    const json = read("llm-boundary-harness-data.json");
    for (const forbidden of ["particleIds", "driftMultiplier", "biologicalNature", "apiKey", "sk-proj-"]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("is self-contained and does not fetch or evaluate code", () => {
    const html = read("index.html");
    expect(html).toContain("__LLM_BOUNDARY_HARNESS__");
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("eval(");
  });

  it("contains syntactically valid inline JavaScript", () => {
    const scripts = [...read("index.html").matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
    expect(scripts.length).toBe(2);
    for (const script of scripts) expect(() => new Function(script)).not.toThrow();
  });

  it("publishes explicit offline safety boundaries", () => {
    const manifest = JSON.parse(read("manifest.json")) as Record<string, unknown>;
    expect(manifest.mockOnly).toBe(true);
    expect(manifest.noNetwork).toBe(true);
    expect(manifest.noMutation).toBe(true);
    expect(manifest.noWritebackAuthority).toBe(true);
  });
});
