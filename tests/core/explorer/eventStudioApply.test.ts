import { describe, expect, it } from "vitest";
import { applyEventStudioEvent } from "../../../src/core/explorer/eventStudioApply";
import { buildEventStudioDraft } from "../../../src/core/explorer/explorerDtoBuilders";
import { buildEventStudioPreview as buildPreview } from "../../../src/core/explorer/eventStudioPreview";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";

const scenario = {
  id: "apply_test", name: "关系场景",
  trigger: "对方没有回复", stressor: "亲密关系", testFocus: "信任 安全感",
};

function snap(s: any) { return JSON.stringify(serializeCharacterPhysicsState(s)); }

describe("V11.3 Event Studio Apply Boundary", () => {
  const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  function makeFullPreview(text = "王雪主动解释并陪伴。", tags: string[] = ["解释", "支持"]) {
    const draft = buildEventStudioDraft({ naturalLanguageInput: text, tags, sourceId: "draft_1" });
    return {
      draft,
      preview: buildPreview({ draft, baselineState: baseline, followUpScenario: scenario, previewMode: "full_preview" }),
    };
  }

  function makeApplyInput(text?: string, tags?: string[], overrides: any = {}) {
    const { draft, preview } = makeFullPreview(text, tags);
    return {
      baselineState: baseline,
      draft,
      preview,
      confirmation: overrides.confirmation ?? "apply",
      applyReason: overrides.applyReason ?? "测试事件应用",
      actorId: overrides.actorId ?? "test_user",
      options: overrides.options,
    };
  }

  // ── Confirmation Gate ──

  it("missing confirmation blocks apply", () => {
    const result = applyEventStudioEvent(makeApplyInput(undefined, undefined, { confirmation: "" }));
    expect(result.applied).toBe(false);
    expect(result.blockedReason).toContain("confirmation");
  });

  it("wrong confirmation blocks apply", () => {
    const result = applyEventStudioEvent(makeApplyInput(undefined, undefined, { confirmation: "wrong_phrase" }));
    expect(result.applied).toBe(false);
    expect(result.blockedReason).toContain("confirmation");
  });

  it("correct confirmation allows apply", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.applied).toBe(true);
    expect(result.blockedReason).toBeNull();
    expect(result.auditEntry).not.toBeNull();
  });

  // ── Preview Mode Gate ──

  it("parse_only preview cannot apply", () => {
    const draft = buildEventStudioDraft({ naturalLanguageInput: "测试", sourceId: "d1" });
    const parsePreview = buildPreview({ draft, baselineState: baseline, previewMode: "parse_only" });
    const result = applyEventStudioEvent({
      baselineState: baseline, draft, preview: parsePreview,
      confirmation: "apply", applyReason: "test", actorId: "u1",
    });
    expect(result.applied).toBe(false);
    expect(result.blockedReason).toContain("full_preview");
  });

  it("impact_preview preview cannot apply", () => {
    const draft = buildEventStudioDraft({ naturalLanguageInput: "测试", sourceId: "d2" });
    const impactPreview = buildPreview({ draft, baselineState: baseline, previewMode: "impact_preview" });
    const result = applyEventStudioEvent({
      baselineState: baseline, draft, preview: impactPreview,
      confirmation: "apply", applyReason: "test", actorId: "u1",
    });
    expect(result.applied).toBe(false);
    expect(result.blockedReason).toContain("full_preview");
  });

  it("full_preview with correct confirmation applies", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.applied).toBe(true);
    expect(result.appliedMemoryId).toBeTruthy();
    expect(result.appliedMemoryId!.length).toBeGreaterThan(0);
  });

  // ── Baseline Immutability ──

  it("baseline immutable by default", () => {
    const before = snap(baseline);
    applyEventStudioEvent(makeApplyInput());
    const after = snap(baseline);
    expect(after).toBe(before);
  });

  it("allowMutation=true mutates target state intentionally", () => {
    const target = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
    const memBefore = target.memories.length;
    const trustBefore = target.coordinate.values.trust;

    const { draft, preview } = makeFullPreview("王雪失联三天。", ["失联", "等待"]);

    const result = applyEventStudioEvent({
      baselineState: target, draft, preview,
      confirmation: "apply", applyReason: "mutation test", actorId: "u1",
      options: { allowMutation: true },
    });

    expect(result.applied).toBe(true);
    // Target was mutated
    expect(target.memories.length).not.toBe(memBefore);
  });

  // ── Audit Entry ──

  it("audit entry contains before/after fingerprint", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.auditEntry).not.toBeNull();
    expect(result.auditEntry!.beforeFingerprint).toBeTruthy();
    expect(result.auditEntry!.afterFingerprint).toBeTruthy();
    expect(result.auditEntry!.beforeFingerprint).not.toBe(result.auditEntry!.afterFingerprint);
    expect(result.auditEntry!.confirmationProvided).toBe(true);
  });

  it("audit entry includes actor and reason", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.auditEntry!.actorId).toBe("test_user");
    expect(result.auditEntry!.applyReason).toBe("测试事件应用");
    expect(result.auditEntry!.appliedAt).toBeTruthy();
  });

  // ── Rollback Reference ──

  it("rollbackReference is generated", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.rollbackReference).toBeTruthy();
    expect(result.rollbackReference).toContain("rollback:");
  });

  // ── Reality Audit Gate ──

  it("Reality Audit WARN can apply but recorded", () => {
    // Use high-intensity abandonment which may trigger WARN
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "最信任的人公开背叛了他。",
      tags: ["背叛", "欺骗"],
      intensity: 0.95,
      sourceId: "d_warn",
    });
    const preview = buildPreview({ draft, baselineState: baseline, followUpScenario: scenario, previewMode: "full_preview" });

    const result = applyEventStudioEvent({
      baselineState: baseline, draft, preview,
      confirmation: "apply", applyReason: "warn test", actorId: "u1",
    });

    if (preview.realityAuditPreview.expectedVerdict === "WARN") {
      expect(result.warnings.some((w) => w.includes("WARN"))).toBe(true);
    }
    // Should still apply (WARN doesn't block)
    expect(result.applied).toBe(true);
  });

  // ── Applied Result ──

  it("applied result includes real memory id", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    expect(result.applied).toBe(true);
    expect(result.appliedMemoryId).toBeTruthy();
    expect(result.appliedMemoryId!.length).toBeGreaterThan(5);
  });

  it("state delta summary shows trust/fear/boundary changes", () => {
    const result = applyEventStudioEvent(makeApplyInput("王雪失联三天。", ["失联", "等待"]));
    expect(result.applied).toBe(true);
    expect(result.stateDeltaSummary).toContain("trust");
    expect(result.stateDeltaSummary).toContain("fear");
    expect(result.stateDeltaSummary).toContain("boundary");
  });

  // ── No Raw State Exposure ──

  it("no raw full state exposed in result", () => {
    const result = applyEventStudioEvent(makeApplyInput());
    const json = JSON.stringify(result);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("proceduralRoutines");
  });

  // ── Deterministic Audit ID ──

  it("deterministic audit id with seed", () => {
    const input = makeApplyInput();
    const r1 = applyEventStudioEvent({ ...input, options: { auditSeed: "seed_42" } });
    const r2 = applyEventStudioEvent({ ...input, options: { auditSeed: "seed_42" } });
    expect(r1.auditEntry!.auditId).toBe(r2.auditEntry!.auditId);
  });

  // ── Repeat events ──

  it("repetitionCount > 1 applies multiple times", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪再次失联。",
      tags: ["失联"],
      repetitionCount: 3,
      sourceId: "d_repeat",
    });
    const preview = buildPreview({ draft, baselineState: baseline, followUpScenario: scenario, previewMode: "full_preview" });

    const beforeMem = baseline.memories.length;
    const target = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

    const result = applyEventStudioEvent({
      baselineState: target, draft, preview,
      confirmation: "apply", applyReason: "repeat test", actorId: "u1",
      options: { allowMutation: true },
    });

    expect(result.applied).toBe(true);
    // Should have 3 new memories
    expect(target.memories.length).toBe(beforeMem + 3);
  });
});
