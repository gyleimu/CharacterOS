import { describe, expect, it } from "vitest";
import {
  explainPatchPreview,
  explainPatchApply,
  type PatchPreviewExplanationInput,
  type PatchApplyExplanationInput
} from "../../../src/core/explainability/patchExplanation";
import {
  createPatchId,
  evaluatePatchIntegrityPolicy,
  type CharacterEditPatch,
  type PatchValidationResult,
  type PatchRiskSummary,
  type PatchIntegrityPolicyDecision,
  type CharacterEditDomain
} from "../../../src/core/editor/characterEditPatch";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePatch(overrides?: Partial<CharacterEditPatch>): CharacterEditPatch {
  return {
    id: createPatchId(),
    appliedAt: new Date().toISOString(),
    description: "Test patch",
    changes: [
      { path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "Testing" }
    ],
    metadata: { source: "manual", characterId: "test" },
    ...overrides
  };
}

function makeCleanValidation(): PatchValidationResult {
  return {
    valid: true,
    changes: [
      {
        change: { path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "Testing" },
        valid: true,
        severity: "ok",
        message: 'Change to "coordinate.values.trust": 0.5 → 0.4 is valid.'
      }
    ],
    summary: "All 1 changes are valid."
  };
}

function makeBlockedValidation(): PatchValidationResult {
  return {
    valid: false,
    changes: [
      {
        change: { path: "invalid.path", from: 0, to: 0, reason: "bad" },
        valid: false,
        severity: "error",
        message: 'Path "invalid.path" is not editable.'
      }
    ],
    summary: "1 error(s) must be fixed before applying."
  };
}

function makeWarningValidation(): PatchValidationResult {
  return {
    valid: true,
    changes: [
      {
        change: { path: "coordinate.values.trust", from: 0.5, to: 1.5, reason: "Testing" },
        valid: true,
        severity: "warning",
        message: 'Value 1.5 for "coordinate.values.trust" is outside [0, 1] — will be clamped to 1 on apply.'
      }
    ],
    summary: "All 1 changes are valid (1 warnings)."
  };
}

function makeOkRisk(): PatchRiskSummary {
  return { severity: "ok", errorCount: 0, warningCount: 0, okCount: 1, messages: [] };
}

function makeWarningRisk(): PatchRiskSummary {
  return {
    severity: "warning",
    errorCount: 0,
    warningCount: 1,
    okCount: 0,
    messages: ['Value 1.5 for "coordinate.values.trust" is outside [0, 1]']
  };
}

function makeErrorRisk(): PatchRiskSummary {
  return {
    severity: "error",
    errorCount: 1,
    warningCount: 0,
    okCount: 0,
    messages: ['Path "invalid.path" is not editable.']
  };
}

function makePassIntegrity(): PatchIntegrityPolicyDecision {
  return evaluatePatchIntegrityPolicy({ valid: true, errorCount: 0, warningCount: 0 });
}

function makeSoftWarningIntegrity(): PatchIntegrityPolicyDecision {
  return evaluatePatchIntegrityPolicy({ valid: true, errorCount: 0, warningCount: 2 });
}

function makeBlockedIntegrity(): PatchIntegrityPolicyDecision {
  return evaluatePatchIntegrityPolicy({ valid: false, errorCount: 3, warningCount: 0 });
}

// ─── explainPatchPreview ────────────────────────────────────────────────────

describe("explainPatchPreview", () => {
  it("returns trace with scope 'patch'", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: []
    };
    const trace = explainPatchPreview(input);
    expect(trace.scope).toBe("patch");
  });

  it("includes affected domain reason", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain, "boundary" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: []
    };
    const trace = explainPatchPreview(input);
    const domainReason = trace.reasons.find((r) =>
      r.message.includes("personality") && r.message.includes("boundary")
    );
    expect(domainReason).toBeDefined();
    expect(domainReason!.scope).toBe("patch");
  });

  it("includes risk severity reason", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeWarningValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeWarningRisk(),
      clampedChanges: []
    };
    const trace = explainPatchPreview(input);
    const riskReason = trace.reasons.find((r) =>
      r.message.toLowerCase().includes("risk")
    );
    expect(riskReason).toBeDefined();
    expect(riskReason!.severity).toBe("warning");
  });

  it("includes clamped change reason", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 2.0, reason: "Testing" }]
    });
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeWarningValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeWarningRisk(),
      clampedChanges: [
        { path: "coordinate.values.trust", submittedValue: 2.0, appliedValue: 1, reason: "above [0,1]" }
      ]
    };
    const trace = explainPatchPreview(input);
    const clampedReason = trace.reasons.find((r) =>
      r.message.includes("clamped")
    );
    expect(clampedReason).toBeDefined();
    expect(clampedReason!.severity).toBe("warning");
  });

  it("blocked validation produces blocked/danger reason", () => {
    const patch = makePatch({
      changes: [{ path: "invalid.path", from: 0, to: 0, reason: "bad" }]
    });
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeBlockedValidation(),
      affectedDomains: ["unknown" as CharacterEditDomain],
      riskSummary: makeErrorRisk(),
      clampedChanges: []
    };
    const trace = explainPatchPreview(input);
    const verdict = trace.reasons.find((r) =>
      r.message.toLowerCase().includes("blocked")
    );
    expect(verdict).toBeDefined();
    expect(verdict!.severity).toBe("blocked");

    const validationReason = trace.reasons.find((r) =>
      r.message.includes("failed validation")
    );
    expect(validationReason).toBeDefined();
    expect(validationReason!.severity).toBe("danger");
  });

  it("includes facts for changes, domains, validation, risk", () => {
    const patch = makePatch({
      changes: [
        { path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "a" },
        { path: "coordinate.values.fear", from: 0.3, to: 0.6, reason: "b" }
      ]
    });
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: []
    };
    const trace = explainPatchPreview(input);

    expect(trace.facts.some((f) => f.label === "Change count")).toBe(true);
    expect(trace.facts.some((f) => f.label === "Affected domains")).toBe(true);
    expect(trace.facts.some((f) => f.label === "Validation passed")).toBe(true);
    expect(trace.facts.some((f) => f.label === "Risk severity")).toBe(true);
  });

  it("includes integrity fact when provided", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrity: { valid: true, errorCount: 0, warningCount: 0 }
    };
    const trace = explainPatchPreview(input);
    const integrityFact = trace.facts.find((f) => f.label === "Post-edit integrity");
    expect(integrityFact).toBeDefined();

    const integrityReason = trace.reasons.find((r) =>
      r.message.includes("integrity")
    );
    expect(integrityReason).toBeDefined();
  });

  it("has deterministic fields except createdAt", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: []
    };
    const trace1 = explainPatchPreview(input);

    // Verify stable fields exist and have expected types
    expect(typeof trace1.id).toBe("string");
    expect(trace1.id.startsWith("trace_")).toBe(true);
    expect(trace1.scope).toBe("patch");
    expect(typeof trace1.title).toBe("string");
    expect(typeof trace1.summary).toBe("string");
    expect(Array.isArray(trace1.reasons)).toBe(true);
    expect(Array.isArray(trace1.facts)).toBe(true);
    expect(Array.isArray(trace1.warnings)).toBe(true);
    expect(typeof trace1.createdAt).toBe("string");

    // All facts should have valid ids
    for (const fact of trace1.facts) {
      expect(fact.id.startsWith("fact_")).toBe(true);
      expect(typeof fact.label).toBe("string");
      expect(typeof fact.source).toBe("string");
    }

    // All reasons should have valid ids
    for (const reason of trace1.reasons) {
      expect(reason.id.startsWith("reason_")).toBe(true);
      expect(typeof reason.message).toBe("string");
      expect(typeof reason.scope).toBe("string");
      expect(typeof reason.severity).toBe("string");
      expect(typeof reason.confidence).toBe("string");
      expect(Array.isArray(reason.supportingFacts)).toBe(true);
    }
  });

  it("is synchronous (no async)", () => {
    const patch = makePatch();
    const input: PatchPreviewExplanationInput = {
      patch,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: []
    };
    const result = explainPatchPreview(input);
    // If it returned a Promise, it wouldn't have .scope directly
    expect(typeof result.scope).toBe("string");
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ─── explainPatchApply ──────────────────────────────────────────────────────

describe("explainPatchApply", () => {
  it("returns applied=true reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makePassIntegrity()
    };
    const trace = explainPatchApply(input);

    const applyReason = trace.reasons.find((r) =>
      r.message.includes("applied successfully")
    );
    expect(applyReason).toBeDefined();
    expect(applyReason!.severity).toBe("info");
  });

  it("returns applied=false reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: false,
      validation: makeBlockedValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeErrorRisk(),
      clampedChanges: [],
      integrityPolicy: makeBlockedIntegrity()
    };
    const trace = explainPatchApply(input);

    const notApplied = trace.reasons.find((r) =>
      r.message.includes("NOT applied")
    );
    expect(notApplied).toBeDefined();
    expect(notApplied!.severity).toBe("blocked");

    const whyBlocked = trace.reasons.find((r) =>
      r.message.includes("was blocked by")
    );
    expect(whyBlocked).toBeDefined();
    expect(whyBlocked!.severity).toBe("blocked");
  });

  it("integrity policy soft_warning produces warning reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makeSoftWarningIntegrity()
    };
    const trace = explainPatchApply(input);

    const integrityReason = trace.reasons.find((r) =>
      r.message.toLowerCase().includes("integrity policy") &&
      r.message.includes("soft warning")
    );
    expect(integrityReason).toBeDefined();
    expect(integrityReason!.severity).toBe("warning");
  });

  it("integrity policy pass produces info reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makePassIntegrity()
    };
    const trace = explainPatchApply(input);

    const integrityReason = trace.reasons.find((r) =>
      r.message.includes("Integrity policy: passed")
    );
    expect(integrityReason).toBeDefined();
    expect(integrityReason!.severity).toBe("info");
  });

  it("integrity policy block produces blocked reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: false,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makeBlockedIntegrity()
    };
    const trace = explainPatchApply(input);

    const integrityReason = trace.reasons.find((r) =>
      r.message.includes("Integrity policy: BLOCKED")
    );
    expect(integrityReason).toBeDefined();
    expect(integrityReason!.severity).toBe("blocked");
  });

  it("includes audit relevance reason", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makePassIntegrity()
    };
    const trace = explainPatchApply(input);

    const auditReason = trace.reasons.find((r) =>
      r.message.includes("audit log")
    );
    expect(auditReason).toBeDefined();
  });

  it("includes clamped change reasons", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 2.0, reason: "Testing" }]
    });
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeWarningValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeWarningRisk(),
      clampedChanges: [
        { path: "coordinate.values.trust", submittedValue: 2.0, appliedValue: 1.0, reason: "above [0,1]" }
      ],
      integrityPolicy: makePassIntegrity()
    };
    const trace = explainPatchApply(input);

    const clampedReason = trace.reasons.find((r) =>
      r.message.includes("clamped") && r.message.includes("2")
    );
    expect(clampedReason).toBeDefined();
    expect(clampedReason!.severity).toBe("warning");
  });

  it("has deterministic structure", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makePassIntegrity()
    };
    const trace = explainPatchApply(input);

    expect(trace.scope).toBe("patch");
    expect(trace.id.startsWith("trace_")).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
    expect(trace.facts.length).toBeGreaterThan(0);
    expect(Array.isArray(trace.warnings)).toBe(true);

    for (const reason of trace.reasons) {
      expect(reason.supportingFacts.length).toBeGreaterThan(0);
    }
  });

  it("is synchronous (no async)", () => {
    const patch = makePatch();
    const input: PatchApplyExplanationInput = {
      patch,
      applied: true,
      validation: makeCleanValidation(),
      affectedDomains: ["personality" as CharacterEditDomain],
      riskSummary: makeOkRisk(),
      clampedChanges: [],
      integrityPolicy: makePassIntegrity()
    };
    const result = explainPatchApply(input);
    expect(typeof result.scope).toBe("string");
    expect(result).not.toBeInstanceOf(Promise);
  });
});
