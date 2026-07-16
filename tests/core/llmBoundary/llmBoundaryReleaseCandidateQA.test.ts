import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../../..");
const MANIFEST_PATH = resolve(ROOT, "outputs/v13-llm-boundary-rc-manifest.json");

interface RcManifest {
  rcVersion: string;
  rcVerdict: string;
  releaseReady: boolean;
  qualityGate: { summary: Record<string, unknown> };
  dependencySecurity: Record<string, number>;
  artifact: { files: Array<{ path: string; sha256: string }> };
  safetyBoundaries: Record<string, boolean>;
  releaseBoundary: Record<string, boolean>;
  knownLimitations: string[];
}

describe("V13.9 LLM Boundary Release Candidate QA", () => {
  it("publishes a passing RC manifest", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    expect(manifest()).toMatchObject({
      rcVersion: "V13.9",
      rcVerdict: "PASS",
      releaseReady: true,
    });
  });

  it("publishes JSON and Markdown quality-gate reports", () => {
    expect(exists("outputs/llm-boundary-quality-gate.json")).toBe(true);
    expect(exists("outputs/llm-boundary-quality-gate.md")).toBe(true);
  });

  it("seals all four static harness files with SHA-256", () => {
    const files = manifest().artifact.files;
    expect(files).toHaveLength(4);
    for (const file of files) {
      const absolute = resolve(ROOT, file.path);
      expect(existsSync(absolute)).toBe(true);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.sha256).toBe(createHash("sha256").update(readFileSync(absolute)).digest("hex"));
    }
  });

  it("records zero unsafe deliveries and replay failures", () => {
    expect(manifest().qualityGate.summary).toMatchObject({
      unsafeDeliveries: 0,
      replayFailures: 0,
      mutationFailures: 0,
      networkViolations: 0,
      uniqueExecutionIds: true,
    });
  });

  it("records the reviewed dependency baseline without release blockers", () => {
    expect(manifest().dependencySecurity).toMatchObject({
      critical: 0,
      high: 0,
      moderate: 2,
      low: 1,
      releaseBlocking: 0,
    });
  });

  it("keeps the RC mock-only and offline", () => {
    expect(manifest().safetyBoundaries).toMatchObject({
      mockOnly: true,
      noNetwork: true,
      noRealProvider: true,
      noMutation: true,
      noWritebackAuthority: true,
    });
  });

  it("requires frozen provider inputs and revalidated fallback", () => {
    expect(manifest().safetyBoundaries).toMatchObject({
      providerInputFrozen: true,
      finalFallbackRevalidated: true,
      diagnosisBlocked: true,
      unsupportedClaimsBlocked: true,
    });
  });

  it("keeps multi-character and V20 out of the release boundary", () => {
    expect(manifest().releaseBoundary).toMatchObject({
      singleCharacterOnly: true,
      multiCharacterProhibited: true,
      v20NotStarted: true,
    });
  });

  it("declares temporal semantics as the next core stage", () => {
    expect(manifest().releaseBoundary.temporalSemanticsNext).toBe(true);
    expect(read("docs/core_calibration_durability_roadmap.md")).toContain("Temporal Semantics");
  });

  it("contains no secret or raw-state payload in release outputs", () => {
    const outputs = [
      read("outputs/v13-llm-boundary-rc-manifest.json"),
      read("outputs/llm-boundary-quality-gate.json"),
      read("outputs/llm-boundary-harness/llm-boundary-harness-data.json"),
    ].join("\n");
    for (const forbidden of ["sk-proj-super-secret", "particleIds", "driftMultiplier", "biologicalNature"]) {
      expect(outputs).not.toContain(forbidden);
    }
  });

  it("does not add network execution to the LLM service", () => {
    const service = read("src/core/llmBoundary/llmBoundaryService.ts");
    expect(service).not.toContain("fetch(");
    expect(service).toContain('providerConfig.providerType !== "mock"');
    expect(service).toContain("providerConfig.networkAllowed");
  });

  it("documents conservative grounding and real-provider deferral", () => {
    expect(manifest().knownLimitations.join(" ")).toContain("lexical/rule matching");
    expect(manifest().releaseBoundary.realProviderDeferred).toBe(true);
  });

  function manifest(): RcManifest {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as RcManifest;
  }
});

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}
