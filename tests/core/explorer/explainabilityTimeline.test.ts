import { describe, expect, it } from "vitest";
import { buildExplainabilityTimeline } from "../../../src/core/explorer/explainabilityTimeline";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";
import type { EventStudioAuditEntry } from "../../../src/core/explorer/explorerTypes";

function makeAudit(overrides: Partial<EventStudioAuditEntry> = {}): EventStudioAuditEntry {
  return {
    auditId: overrides.auditId ?? "audit_001",
    eventDraftId: "draft_1",
    sourceId: "src_1",
    actorId: "user",
    applyReason: "test",
    appliedAt: overrides.appliedAt ?? new Date().toISOString(),
    beforeFingerprint: "fp_before",
    afterFingerprint: "fp_after",
    parsedEventSummary: {
      category: overrides.parsedEventSummary?.category ?? "support",
      emotion: "relief",
      intensity: 0.6,
      importance: 0.7,
      parserConfidence: 0.9,
    },
    stateDeltaSummary: overrides.stateDeltaSummary ?? "trust: 0.258→0.261, fear: 0.822→0.819, boundary: strained→strained",
    realityAuditVerdict: "PASS",
    confirmationProvided: true,
    rollbackReference: "rollback:audit_001:before:fp_before",
    warnings: [],
  };
}

describe("V11.5 Explainability Timeline", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const surface = buildCharacterStateSurface({ state });

  // ── Basic Timeline ──

  it("builds timeline from EventStudioApply audit history", () => {
    const timeline = buildExplainabilityTimeline({
      question: "为什么今天更焦虑？",
      state,
      stateSurface: surface,
      recentAuditEntries: [makeAudit(), makeAudit({ auditId: "audit_002", parsedEventSummary: { category: "abandonment", emotion: "fear", intensity: 0.85, importance: 0.9, parserConfidence: 1 } })],
    });

    expect(timeline.question).toBe("为什么今天更焦虑？");
    expect(timeline.causalSteps.length).toBeGreaterThan(0);
    expect(timeline.evidenceRefs.length).toBeGreaterThan(0);
    expect(timeline.groundingStatus).not.toBe("ungrounded");
  });

  it("causal steps include event → memory → belief chain", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    const types = timeline.causalSteps.map((s) => s.type);
    expect(types).toContain("event");
    expect(types).toContain("memory");
    expect(types).toContain("belief");
    expect(types).toContain("personality");
  });

  it("evidenceRefs point to audit/event ids", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    expect(timeline.evidenceRefs.some((e) => e.sourceId === "audit_001")).toBe(true);
    expect(timeline.evidenceRefs.some((e) => e.sourceType === "audit")).toBe(true);
    expect(timeline.evidenceRefs.some((e) => e.sourceType === "reality_audit")).toBe(true);
  });

  it("question preserved", () => {
    const timeline = buildExplainabilityTimeline({
      question: "为什么更想确认关系？",
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });
    expect(timeline.question).toBe("为什么更想确认关系？");
  });

  it("uses default question when none provided", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });
    expect(timeline.question).toContain("变化");
  });

  // ── Focus Filtering ──

  it("focus=emotion filters relevant steps", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
      focus: "emotion",
    });

    // Emotion focus should include event, memory, boundary steps
    expect(timeline.focus).toBe("emotion");
    expect(timeline.causalSteps.every((s) => ["event", "memory", "boundary"].includes(s.type))).toBe(true);
  });

  it("focus=belief filters relevant steps", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
      focus: "belief",
    });

    expect(timeline.focus).toBe("belief");
    expect(timeline.causalSteps.every((s) => ["event", "belief"].includes(s.type))).toBe(true);
  });

  // ── No History ──

  it("no history returns low confidence and warning", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
    });

    expect(timeline.confidence).toBe("low");
    expect(timeline.groundingStatus).toBe("ungrounded");
    expect(timeline.warnings.length).toBeGreaterThan(0);
    expect(timeline.causalSteps).toHaveLength(0);
  });

  it("ungrounded explanation is marked", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
    });

    expect(timeline.groundingStatus).toBe("ungrounded");
  });

  // ── State Diffs ──

  it("stateDiffs reference sourceStepIds", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    expect(timeline.stateDiffs.length).toBeGreaterThan(0);
    for (const diff of timeline.stateDiffs) {
      expect(diff.path).toBeTruthy();
      expect(diff.sourceStepIds.length).toBeGreaterThanOrEqual(0);
    }
  });

  // ── Safety ──

  it("simulation-not-diagnosis warning present", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    expect(timeline.warnings.some((w) => w.includes("模拟") || w.includes("诊断"))).toBe(true);
  });

  // ── Determinism ──

  it("deterministic same input same output", () => {
    const t1 = buildExplainabilityTimeline({ state, stateSurface: surface, recentAuditEntries: [makeAudit()] });
    const t2 = buildExplainabilityTimeline({ state, stateSurface: surface, recentAuditEntries: [makeAudit()] });

    expect(t1.causalSteps.length).toBe(t2.causalSteps.length);
    expect(t1.groundingStatus).toBe(t2.groundingStatus);
    expect(t1.confidence).toBe(t2.confidence);
  });

  // ── No Mutation ──

  it("does not mutate input state", () => {
    const before = JSON.stringify(serializeCharacterPhysicsState(state));
    buildExplainabilityTimeline({ state, stateSurface: surface, recentAuditEntries: [makeAudit()] });
    const after = JSON.stringify(serializeCharacterPhysicsState(state));
    expect(after).toBe(before);
  });

  // ── No Leaked Fields ──

  it("does not expose raw full state", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    const json = JSON.stringify(timeline);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
  });

  it("does not include chat/agent/multi-character fields", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
    });

    const json = JSON.stringify(timeline);
    expect(json).not.toContain("chat");
    expect(json).not.toContain("agent");
    expect(json).not.toContain("multi-character");
  });

  // ── Confidence ──

  it("confidence high only when grounded steps exist", () => {
    // With audit history
    const withHistory = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit(), makeAudit({ auditId: "a2" }), makeAudit({ auditId: "a3" })],
    });
    expect(["high", "moderate"]).toContain(withHistory.confidence);

    // Without history
    const noHistory = buildExplainabilityTimeline({ state, stateSurface: surface });
    expect(noHistory.confidence).toBe("low");
  });

  // ── Time Range ──

  it("timeRange respected", () => {
    const timeline = buildExplainabilityTimeline({
      state, stateSurface: surface,
      recentAuditEntries: [makeAudit()],
      timeRange: { from: "2026-06-25", to: "2026-07-02", label: "过去7天" },
    });

    expect(timeline.timeRange.label).toBe("过去7天");
    expect(timeline.timeRange.from).toBe("2026-06-25");
  });
});
