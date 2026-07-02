import { describe, expect, it } from "vitest";
import {
  validatePatchChange,
  validatePatch,
  validatePatchAgainstState,
  applyPatch,
  applyValidatedPatch,
  previewPatch,
  createPatchId,
  buildPostEditIntegrityReport,
  getAffectedDomainsForPatch,
  summarizePatchRisk,
  getClampedChangesForPatch,
  buildProjectedStateSummary,
  getChangedPathsFromPatch,
  evaluatePatchIntegrityPolicy,
  createAuditEntryId,
  createRollbackPatchFromAuditEntry,
  MAX_CHANGES_PER_PATCH,
  type CharacterEditPatch,
  type PatchChange,
  type PatchAuditEntry
} from "../../../src/core/editor/characterEditPatch";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint
} from "../../../src/core/character/characterBlueprint";
import type { CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";

function freshState(): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true
  });
}

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

describe("validatePatchChange", () => {
  it("accepts valid coordinate change", () => {
    const result = validatePatchChange({
      path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "test"
    });
    expect(result.valid).toBe(true);
    expect(result.severity).toBe("ok");
  });

  it("rejects non-editable path", () => {
    const result = validatePatchChange({
      path: "memories.0.recency", from: 0.5, to: 0.4, reason: "test"
    });
    expect(result.valid).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("not editable");
  });

  it("rejects empty reason", () => {
    const result = validatePatchChange({
      path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: " "
    });
    expect(result.valid).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("reason");
  });

  it("rejects non-number value", () => {
    const result = validatePatchChange({
      path: "coordinate.values.trust", from: 0.5, to: "high", reason: "test"
    });
    expect(result.valid).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("warns on out-of-range value but remains valid", () => {
    const result = validatePatchChange({
      path: "coordinate.values.trust", from: 0.5, to: 1.5, reason: "test"
    });
    expect(result.valid).toBe(true);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("clamped");
  });
});

describe("validatePatch", () => {
  it("validates multiple changes", () => {
    const patch = makePatch({
      changes: [
        { path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "a" },
        { path: "coordinate.values.fear", from: 0.3, to: 0.5, reason: "b" }
      ]
    });
    const result = validatePatch(patch);
    expect(result.valid).toBe(true);
    expect(result.changes).toHaveLength(2);
  });

  it("reports errors correctly", () => {
    const patch = makePatch({
      changes: [
        { path: "invalid.path", from: 0, to: 0, reason: "bad" }
      ]
    });
    const result = validatePatch(patch);
    expect(result.valid).toBe(false);
  });
});

describe("applyPatch", () => {
  it("applies valid patch to state", () => {
    const state = freshState();
    const trustBefore = state.coordinate.values.trust;
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: trustBefore, to: trustBefore * 0.5, reason: "halve trust" }]
    });
    const { newState, changesApplied, errors } = applyPatch(state, patch);
    expect(changesApplied).toBe(1);
    expect(errors).toHaveLength(0);
    expect(newState.coordinate.values.trust).toBeLessThan(trustBefore);
  });

  it("does not mutate original state", () => {
    const state = freshState();
    const trustBefore = state.coordinate.values.trust;
    applyPatch(state, makePatch({
      changes: [{ path: "coordinate.values.trust", from: trustBefore, to: 0.1, reason: "test" }]
    }));
    expect(state.coordinate.values.trust).toBe(trustBefore);
  });

  it("clamps out-of-range values", () => {
    const state = freshState();
    const result = applyPatch(state, makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 2.0, reason: "test" }]
    }));
    expect(result.newState.coordinate.values.trust).toBeLessThanOrEqual(1);
  });
});

describe("previewPatch", () => {
  it("returns validation and projected state", () => {
    const state = freshState();
    const patch = makePatch({
      changes: [{ path: "coordinate.values.fear", from: state.coordinate.values.fear, to: 0.8, reason: "test" }]
    });
    const result = previewPatch(state, patch);
    expect(result.validation.valid).toBe(true);
    expect(result.projectedState).not.toBeNull();
    expect(result.projectedState!.coordinate.values.fear).toBe(0.8);
  });

  it("returns null projected state on invalid patch", () => {
    const state = freshState();
    const patch = makePatch({
      changes: [{ path: "invalid.path", from: 0, to: 0, reason: "bad" }]
    });
    const result = previewPatch(state, patch);
    expect(result.projectedState).toBeNull();
  });
});

describe("createPatchId", () => {
  it("produces unique ids", () => {
    const id1 = createPatchId();
    const id2 = createPatchId();
    expect(id1).not.toBe(id2);
    expect(id1).toContain("patch_");
  });
});

// ─── V9.2 Hardening ──────────────────────────────────────────────

describe("validatePatch — edge cases", () => {
  it("accepts empty changes as valid no-op", () => {
    const patch = makePatch({ changes: [] });
    const result = validatePatch(patch);
    expect(result.valid).toBe(true);
    expect(result.summary).toContain("no changes");
  });

  it("rejects patch exceeding MAX_CHANGES_PER_PATCH", () => {
    const changes = Array.from({ length: MAX_CHANGES_PER_PATCH + 1 }, (_, i) => ({
      path: `coordinate.values.trust`, from: 0.5, to: 0.5 + i * 0.001, reason: `change ${i}`
    }));
    const patch = makePatch({ changes });
    const result = validatePatch(patch);
    expect(result.valid).toBe(false);
    expect(result.summary).toContain("exceeding the limit");
  });

  it("detects duplicate paths", () => {
    const patch = makePatch({
      changes: [
        { path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "a" },
        { path: "coordinate.values.trust", from: 0.4, to: 0.3, reason: "b" }
      ]
    });
    const result = validatePatch(patch);
    expect(result.valid).toBe(false);
    expect(result.summary).toContain("Duplicate");
  });
});

describe("applyValidatedPatch", () => {
  it("applies valid patch successfully", () => {
    const state = freshState();
    const trustBefore = state.coordinate.values.trust;
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: trustBefore, to: 0.3, reason: "test" }]
    });
    const result = applyValidatedPatch(state, patch);
    expect(result.newState).not.toBeNull();
    expect(result.changesApplied).toBe(1);
    expect(result.validation.valid).toBe(true);
  });

  it("rejects invalid patch with validation result", () => {
    const state = freshState();
    const patch = makePatch({
      changes: [{ path: "invalid.path", from: 0, to: 0, reason: "bad" }]
    });
    const result = applyValidatedPatch(state, patch);
    expect(result.newState).toBeNull();
    expect(result.validation.valid).toBe(false);
  });
});

describe("buildPostEditIntegrityReport", () => {
  it("returns valid report for a fresh state", () => {
    const state = freshState();
    const report = buildPostEditIntegrityReport(state);
    expect(typeof report.valid).toBe("boolean");
    expect(typeof report.errorCount).toBe("number");
    expect(typeof report.warningCount).toBe("number");
  });
});

// ─── V9.3.2 Domain / Risk / Clamp ──────────────────────────────────

describe("validatePatchAgainstState", () => {
  it("passes when from matches current value", () => {
    const state = freshState();
    const trust = state.coordinate.values.trust;
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: trust, to: 0.4, reason: "test" }]
    });
    const result = validatePatchAgainstState(state, patch);
    expect(result.valid).toBe(true);
  });

  it("fails when from value is stale", () => {
    const state = freshState();
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.99, to: 0.4, reason: "test" }]
    });
    const result = validatePatchAgainstState(state, patch);
    expect(result.valid).toBe(false);
    expect(result.changes.some((c) => c.message.includes("Stale patch"))).toBe(true);
  });
});

describe("getAffectedDomainsForPatch", () => {
  it("maps coordinate changes to personality", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "test" }]
    });
    expect(getAffectedDomainsForPatch(patch)).toEqual(["personality"]);
  });

  it("maps boundary/meta/reward/homeostasis correctly", () => {
    const patch = makePatch({
      changes: [
        { path: "boundary.stressLoad", from: 0.5, to: 0.4, reason: "a" },
        { path: "metaState.selfControl", from: 0.5, to: 0.4, reason: "b" }
      ]
    });
    const domains = getAffectedDomainsForPatch(patch);
    expect(domains).toContain("boundary");
    expect(domains).toContain("meta_state");
  });

  it("maps unknown path to unknown", () => {
    const patch = makePatch({
      changes: [{ path: "fake.field", from: 0, to: 0, reason: "?" }]
    });
    expect(getAffectedDomainsForPatch(patch)).toContain("unknown");
  });
});

describe("summarizePatchRisk", () => {
  it("returns ok when no errors or warnings", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "test" }]
    });
    const validation = validatePatch(patch);
    const risk = summarizePatchRisk(validation);
    expect(risk.severity).toBe("ok");
    expect(risk.errorCount).toBe(0);
  });

  it("returns warning when warnings present", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 1.5, reason: "test" }]
    });
    const validation = validatePatch(patch);
    const risk = summarizePatchRisk(validation);
    expect(risk.severity).toBe("warning");
    expect(risk.warningCount).toBe(1);
  });

  it("returns error when errors present", () => {
    const patch = makePatch({
      changes: [{ path: "invalid.path", from: 0, to: 0, reason: "bad" }]
    });
    const validation = validatePatch(patch);
    const risk = summarizePatchRisk(validation);
    expect(risk.severity).toBe("error");
  });
});

describe("getClampedChangesForPatch", () => {
  it("reports high clamp", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 2, reason: "test" }]
    });
    const clamped = getClampedChangesForPatch(patch);
    expect(clamped).toHaveLength(1);
    expect(clamped[0]!.submittedValue).toBe(2);
    expect(clamped[0]!.appliedValue).toBe(1);
  });

  it("reports low clamp", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: -0.5, reason: "test" }]
    });
    const clamped = getClampedChangesForPatch(patch);
    expect(clamped).toHaveLength(1);
    expect(clamped[0]!.appliedValue).toBe(0);
  });

  it("returns empty for in-range values", () => {
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: 0.5, to: 0.4, reason: "test" }]
    });
    expect(getClampedChangesForPatch(patch)).toHaveLength(0);
  });
});

describe("buildProjectedStateSummary", () => {
  it("returns only changed paths", () => {
    const state = freshState();
    const patch = makePatch({
      changes: [{ path: "coordinate.values.trust", from: state.coordinate.values.trust, to: 0.3, reason: "test" }]
    });
    const { newState } = applyPatch(state, patch);
    const summary = buildProjectedStateSummary(newState, getChangedPathsFromPatch(patch));
    expect(summary).toHaveProperty("coordinate.values.trust");
    expect(summary["coordinate.values.trust"]).toBe(0.3);
  });
});

// ─── V9.5 Audit & Integrity Policy ─────────────────────────────────

describe("evaluatePatchIntegrityPolicy", () => {
  it("returns pass for clean report", () => {
    const result = evaluatePatchIntegrityPolicy({ valid: true, errorCount: 0, warningCount: 0 });
    expect(result.status).toBe("pass");
  });

  it("returns soft_warning for warnings", () => {
    const result = evaluatePatchIntegrityPolicy({ valid: true, errorCount: 0, warningCount: 2 });
    expect(result.status).toBe("soft_warning");
  });

  it("returns block for errors", () => {
    const result = evaluatePatchIntegrityPolicy({ valid: false, errorCount: 3, warningCount: 0 });
    expect(result.status).toBe("block");
    expect(result.blockingReasons.length).toBeGreaterThan(0);
  });
});

describe("createAuditEntryId", () => {
  it("produces unique ids with audit_ prefix", () => {
    const id1 = createAuditEntryId();
    const id2 = createAuditEntryId();
    expect(id1).not.toBe(id2);
    expect(id1).toContain("audit_");
  });
});

// ─── V9.7 Rollback ──────────────────────────────────────────────────

describe("createRollbackPatchFromAuditEntry", () => {
  function makeAuditEntry(overrides?: Partial<PatchAuditEntry>): PatchAuditEntry {
    return {
      id: "audit_test123",
      characterId: "test-char",
      patchId: "patch_test456",
      timestamp: new Date().toISOString(),
      description: "Test apply",
      changedPaths: ["coordinate.values.trust"],
      affectedDomains: ["personality"],
      riskSummary: { severity: "ok", errorCount: 0, warningCount: 0, okCount: 1, messages: [] },
      clampedChanges: [],
      beforeSummary: { "coordinate.values.trust": 0.5 },
      afterSummary: { "coordinate.values.trust": 0.3 },
      validationSummary: "Valid.",
      integrityPolicyDecision: { status: "pass", errorCount: 0, warningCount: 0, blockingReasons: [], warnings: [], reasons: ["Passed."] },
      applied: true,
      dryRun: false,
      warnings: [],
      reasons: ["Applied."],
      ...overrides
    };
  }

  it("builds reverse patch with from=after, to=before", () => {
    const entry = makeAuditEntry();
    const patch = createRollbackPatchFromAuditEntry(entry);

    expect(patch.changes).toHaveLength(1);
    expect(patch.changes[0]!.path).toBe("coordinate.values.trust");
    expect(patch.changes[0]!.from).toBe(0.3);  // afterSummary
    expect(patch.changes[0]!.to).toBe(0.5);    // beforeSummary
    expect(patch.changes[0]!.reason).toContain("Rollback");
    expect(patch.changes[0]!.reason).toContain(entry.id);
    expect(patch.description).toContain("Rollback");
    expect(patch.description).toContain(entry.patchId);
    expect(patch.id).toContain("patch_");
  });

  it("handles multiple changed paths", () => {
    const entry = makeAuditEntry({
      changedPaths: ["coordinate.values.trust", "coordinate.values.fear"],
      beforeSummary: { "coordinate.values.trust": 0.5, "coordinate.values.fear": 0.2 },
      afterSummary: { "coordinate.values.trust": 0.3, "coordinate.values.fear": 0.8 }
    });
    const patch = createRollbackPatchFromAuditEntry(entry);
    expect(patch.changes).toHaveLength(2);
    expect(patch.changes[0]!.from).toBe(0.3);
    expect(patch.changes[0]!.to).toBe(0.5);
    expect(patch.changes[1]!.from).toBe(0.8);
    expect(patch.changes[1]!.to).toBe(0.2);
  });

  it("throws controlled error when beforeSummary is missing a path", () => {
    const entry = makeAuditEntry({
      changedPaths: ["coordinate.values.trust", "coordinate.values.fear"],
      beforeSummary: { "coordinate.values.trust": 0.5 }
      // coordinate.values.fear is missing from beforeSummary
    });
    expect(() => createRollbackPatchFromAuditEntry(entry)).toThrow(
      "missing before/after summary"
    );
  });

  it("throws controlled error when afterSummary is missing a path", () => {
    const entry = makeAuditEntry({
      changedPaths: ["coordinate.values.trust", "coordinate.values.fear"],
      afterSummary: { "coordinate.values.trust": 0.3 }
      // coordinate.values.fear is missing from afterSummary
    });
    expect(() => createRollbackPatchFromAuditEntry(entry)).toThrow(
      "missing before/after summary"
    );
  });

  it("throws when changedPaths is empty", () => {
    const entry = makeAuditEntry({
      changedPaths: [],
      beforeSummary: {},
      afterSummary: {}
    });
    expect(() => createRollbackPatchFromAuditEntry(entry)).toThrow(
      "no changed paths"
    );
  });
});
