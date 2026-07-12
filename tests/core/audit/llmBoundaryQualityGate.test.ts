import { beforeAll, describe, expect, it } from "vitest";
import {
  runLlmBoundaryQualityGate,
  type LlmBoundaryQualityGateResult,
} from "../../../src/core/audit/llmBoundaryQualityGate";

describe("V13.9 LLM Boundary Quality Gate", () => {
  let gate: LlmBoundaryQualityGateResult;

  beforeAll(async () => {
    gate = await runLlmBoundaryQualityGate();
  });

  it("returns a release-ready PASS verdict", () => {
    expect(gate.version).toBe("13.9.0");
    expect(gate.gateVerdict).toMatchObject({ level: "PASS", passed: true });
    expect(gate.releaseReady).toBe(true);
    expect(gate.failures).toEqual([]);
  });

  it("covers all 18 success, failure, and adversarial cases", () => {
    expect(gate.summary.total).toBe(18);
    expect(gate.summary.passed).toBe(18);
    expect(gate.summary.failed).toBe(0);
    expect(gate.summary.riskCategoriesCovered).toBe(7);
  });

  it("delivers no unsafe, invalid, or ungrounded text", () => {
    expect(gate.summary.unsafeDeliveries).toBe(0);
    expect(gate.cases.every((item) => item.deliveredValidationVerdict === "pass")).toBe(true);
    expect(gate.cases.every((item) => item.deliveredGroundingVerdict === "grounded")).toBe(true);
  });

  it("replays every case deterministically", () => {
    expect(gate.summary.replayFailures).toBe(0);
    expect(gate.cases.every((item) => item.deterministicReplay)).toBe(true);
    expect(gate.summary.uniqueExecutionIds).toBe(true);
  });

  it("never mutates inputs or grants writeback authority", () => {
    expect(gate.summary.mutationFailures).toBe(0);
    expect(gate.cases.every((item) => item.inputUnchanged)).toBe(true);
    expect(gate.cases.every((item) => item.noMutation)).toBe(true);
    expect(gate.cases.every((item) => item.noWritebackAuthority)).toBe(true);
  });

  it("never uses network and keeps real providers deferred", () => {
    expect(gate.summary.networkViolations).toBe(0);
    expect(gate.mockOnly).toBe(true);
    expect(gate.realProviderDeferred).toBe(true);
  });

  it("accepts only the grounded success case from the provider path", () => {
    const providerReplies = gate.cases.filter((item) => item.actualVerdict === "llm_reply");
    expect(providerReplies.map((item) => item.id)).toEqual(["grounded_success"]);
  });

  it("blocks diagnosis, mutation, missing safety, and truncated output", () => {
    expect(caseById("diagnosis_claim").providerValidationRules).toContain("no_diagnosis");
    expect(caseById("mutation_claim").providerValidationRules).toContain("no_mutation_claim");
    expect(caseById("missing_safety_notice").providerValidationRules).toContain("required_safety_notice");
    expect(caseById("truncated_output").providerValidationRules).toContain("complete_output");
  });

  it("rejects ungrounded, label-spoofed, and mixed claims", () => {
    for (const id of ["ungrounded_claim", "safety_label_spoof", "mixed_true_false_claim"]) {
      expect(caseById(id).actualFallbackReason).toBe("grounding_failed");
      expect(caseById(id).providerGroundingVerdict).toBe("ungrounded");
    }
  });

  it("rejects provider identity mismatch and redacts thrown secrets", () => {
    expect(caseById("provider_identity_mismatch").providerValidationRules).toContain(
      "response_request_mismatch",
    );
    expect(JSON.stringify(caseById("provider_exception_secret"))).not.toContain(
      "sk-proj-super-secret",
    );
  });

  it("blocks unsafe source, non-mock provider, and network-enabled config before calls", () => {
    for (const id of ["unsafe_source_preflight", "non_mock_provider", "network_enabled_config"]) {
      expect(caseById(id).actualVerdict).toBe("fallback_reply");
      expect(caseById(id).providerCalled).toBe(false);
    }
  });

  it("uses a deterministic sentinel timestamp", () => {
    expect(gate.generatedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  function caseById(id: string) {
    const result = gate.cases.find((item) => item.id === id);
    if (!result) throw new Error(`Missing quality-gate case ${id}`);
    return result;
  }
});
