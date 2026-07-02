import { describe, expect, it } from "vitest";
import {
  buildExplorerManifest,
  buildEventStudioDraft,
  buildEventStudioPreview,
  buildCharacterStateSurfaceFromState,
  buildRealityAuditPanelFromResult,
  buildTimeMachineSnapshotFromState,
  buildTimeMachineTimeline,
  buildMindGalaxyEmbed,
  summarizeExplorerModules,
  buildExplainabilityStub,
} from "../../../src/core/explorer/explorerDtoBuilders";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { runRealityAudit } from "../../../src/core/audit/realityAudit";

describe("V11.1 Explorer DTO Builders", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  // ── Manifest ──

  it("buildExplorerManifest has readOnlyDefault=true", () => {
    const m = buildExplorerManifest("test");
    expect(m.readOnlyDefault).toBe(true);
    expect(m.version).toBe("11.1.0");
    expect(m.characterId).toBe("test");
  });

  it("summarizeExplorerModules returns six modules", () => {
    const modules = summarizeExplorerModules();
    expect(modules).toHaveLength(6);

    const ids = modules.map((m) => m.moduleId);
    expect(ids).toContain("event_studio");
    expect(ids).toContain("character_state");
    expect(ids).toContain("explainability");
    expect(ids).toContain("mind_galaxy");
    expect(ids).toContain("reality_audit");
    expect(ids).toContain("time_machine");
  });

  it("manifest release boundary prohibits chat/agent/multi", () => {
    const m = buildExplorerManifest("test");
    expect(m.releaseBoundary.noChatAgent).toBe(true);
    expect(m.releaseBoundary.noMultiCharacter).toBe(true);
    expect(m.releaseBoundary.noAutonomousScheduler).toBe(true);
    expect(m.releaseBoundary.noMedicalDiagnosis).toBe(true);
    expect(m.releaseBoundary.singleCharacterOnly).toBe(true);
  });

  it("manifest safety disclaimers include simulation-not-diagnosis", () => {
    const m = buildExplorerManifest("test");
    expect(m.safetyDisclaimers.length).toBeGreaterThanOrEqual(3);
    expect(m.safetyDisclaimers.some((d) => d.includes("模拟"))).toBe(true);
    expect(m.safetyDisclaimers.some((d) => d.includes("诊断"))).toBe(true);
    expect(m.safetyDisclaimers.some((d) => d.includes("专业帮助"))).toBe(true);
  });

  // ── Event Studio ──

  it("buildEventStudioDraft clamps intensity and repetition", () => {
    const draft = buildEventStudioDraft({ intensity: 2.5, repetitionCount: -3 });
    expect(draft.intensity).toBe(1);
    expect(draft.repetitionCount).toBe(1);
    expect(draft.status).toBe("draft");
    // Draft doesn't require confirmation — only Preview does
  });

  it("buildEventStudioPreview requires confirmation", () => {
    const preview = buildEventStudioPreview({
      draftId: "d1",
      parsed: { category: "support", emotion: "relief", intensity: 0.6, importance: 0.7, parserConfidence: 0.9 },
      impact: { expectedMemoryImpact: "moderate", expectedBoundaryImpact: "low", expectedBeliefImpact: "moderate", expectedPersonalityImpact: "subtle" },
      memory: { willCreateMemory: true, estimatedSalience: "moderate", relatedExistingMemories: 2 },
      belief: { likelyNewBelief: null, likelyStrengthenedBeliefs: [], likelyWeakenedBeliefs: [] },
      need: { likelyActivatedNeeds: [], likelyDeactivatedNeeds: [] },
      personality: { direction: "trust increasing", affectedDimensions: ["trust"], estimatedMagnitude: "subtle" },
      decision: { likelyStrategyShift: "stable", likelyActionChange: "none" },
      auditWarnings: [],
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.realityAuditPreview.expectedVerdict).toBe("PASS");
  });

  it("buildEventStudioPreview warns when audit has warnings", () => {
    const preview = buildEventStudioPreview({
      draftId: "d2",
      parsed: { category: "abandonment", emotion: "fear", intensity: 0.9, importance: 0.9, parserConfidence: 1 },
      impact: { expectedMemoryImpact: "high", expectedBoundaryImpact: "high", expectedBeliefImpact: "high", expectedPersonalityImpact: "visible" },
      memory: { willCreateMemory: true, estimatedSalience: "high", relatedExistingMemories: 5 },
      belief: { likelyNewBelief: "人不可信", likelyStrengthenedBeliefs: ["亲密关系不可靠"], likelyWeakenedBeliefs: [] },
      need: { likelyActivatedNeeds: ["安全感"], likelyDeactivatedNeeds: [] },
      personality: { direction: "defensive", affectedDimensions: ["trust", "fear"], estimatedMagnitude: "visible" },
      decision: { likelyStrategyShift: "withdrawal", likelyActionChange: "从开放转为退缩" },
      auditWarnings: ["high impact may over-activate boundary"],
    });
    expect(preview.requiresConfirmation).toBe(true);
    expect(preview.realityAuditPreview.expectedVerdict).toBe("WARN");
    expect(preview.warnings).toHaveLength(1);
  });

  // ── Character State ──

  it("buildCharacterStateSurfaceFromState does not expose raw coordinate values", () => {
    const surface = buildCharacterStateSurfaceFromState(state);

    expect(surface.characterId).toBe(state.identity.id);
    expect(surface.characterName).toBe(state.identity.name);
    expect(surface.safetyNote).toContain("模拟");
    expect(surface.safetyNote).toContain("非医学");

    // Values should be qualitative, not raw numbers
    expect(surface.personalitySummary.trust.value).not.toBeTypeOf("number");
    expect(typeof surface.personalitySummary.trust.label).toBe("string");
    expect(surface.personalitySummary.trust.label.length).toBeGreaterThan(5);

    expect(surface.emotionalState.label.length).toBeGreaterThan(0);
    expect(surface.stressState.label.length).toBeGreaterThan(0);

    // No raw internal fields leaked
    const json = JSON.stringify(surface);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("coordinateDelta");
    expect(json).not.toContain("impactScore");
  });

  it("buildCharacterStateSurfaceFromState includes beliefs", () => {
    const surface = buildCharacterStateSurfaceFromState(state);
    expect(Array.isArray(surface.dominantBeliefs)).toBe(true);
  });

  it("builders do not mutate input state", () => {
    const memBefore = state.memories.length;
    const trustBefore = state.coordinate.values.trust;

    buildCharacterStateSurfaceFromState(state);
    buildTimeMachineSnapshotFromState({
      state, snapshotId: "s1", label: "test",
      capturedAt: new Date().toISOString(), sequenceIndex: 1,
      galaxyRef: "", auditRef: "",
    });

    expect(state.memories.length).toBe(memBefore);
    expect(state.coordinate.values.trust).toBe(trustBefore);
  });

  // ── Reality Audit ──

  it("buildRealityAuditPanelFromResult preserves verdict and grounding", () => {
    const auditResult = runRealityAudit({
      id: "builder_test",
      label: "Test",
      baselineState: state,
      eventInput: {
        description: "王雪突然失联，直到第二天才回复。",
        tags: ["王雪", "失联", "等待"],
        categoryHint: "abandonment",
      },
      followUpDecisionScenario: {
        id: "test_scenario", name: "关系场景",
        trigger: "对方没有回复", stressor: "亲密关系", testFocus: "信任 安全感",
      },
    });

    const panel = buildRealityAuditPanelFromResult(auditResult);

    expect(["PASS", "WARN", "FAIL"]).toContain(panel.verdict);
    expect(panel.explanationGrounding).toBe("grounded");
    expect(panel.disclaimers.length).toBeGreaterThan(0);
    expect(panel.auditScope).toContain("王雪");
  });

  // ── Time Machine ──

  it("buildTimeMachineSnapshotFromState creates immutable snapshot", () => {
    const snapshot = buildTimeMachineSnapshotFromState({
      state,
      snapshotId: "snap_001",
      label: "Day 7",
      capturedAt: new Date().toISOString(),
      sequenceIndex: 7,
      galaxyRef: "galaxy_ref",
      auditRef: "audit_ref",
    });

    expect(snapshot.immutable).toBe(true);
    expect(snapshot.snapshotId).toBe("snap_001");
    expect(snapshot.characterId).toBe(state.identity.id);
    expect(snapshot.sequenceIndex).toBe(7);
    expect(snapshot.personalitySummary.trust.value).not.toBeTypeOf("number");
  });

  it("buildTimeMachineTimeline warns when empty", () => {
    const timeline = buildTimeMachineTimeline({
      characterId: "test",
      snapshots: [],
      currentSnapshotId: "live",
    });
    expect(timeline.warnings).toContain("暂无快照");
    expect(timeline.restoreMode).toBe("view_only");
  });

  it("buildTimeMachineTimeline with snapshots has ranges", () => {
    const snap = buildTimeMachineSnapshotFromState({
      state,
      snapshotId: "s1", label: "Day 1",
      capturedAt: "2026-01-01T00:00:00Z",
      sequenceIndex: 1,
      galaxyRef: "", auditRef: "",
    });
    const timeline = buildTimeMachineTimeline({
      characterId: "test",
      snapshots: [snap],
      currentSnapshotId: "live",
    });
    expect(timeline.warnings).toHaveLength(0);
    expect(timeline.availableRanges).toHaveLength(1);
  });

  // ── Builders deterministic ──

  it("builders are deterministic", () => {
    const m1 = buildExplorerManifest("test");
    const m2 = buildExplorerManifest("test");
    expect(JSON.stringify(m1)).toBe(JSON.stringify(m2));

    const d1 = buildEventStudioDraft({ naturalLanguageInput: "测试" });
    const d2 = buildEventStudioDraft({ naturalLanguageInput: "测试" });
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
  });

  // ── Mind Galaxy ──

  it("buildMindGalaxyEmbed has noMutation=true", () => {
    const embed = buildMindGalaxyEmbed({ artifactRef: "mind-galaxy/index.html", nodeCount: 40, edgeCount: 48 });
    expect(embed.noMutation).toBe(true);
    expect(embed.mode).toBe("advanced");
    expect(embed.safetyBoundary.readOnly).toBe(true);
    expect(embed.safetyBoundary.researchViewOnly).toBe(true);
    expect(embed.safetyBoundary.disclaimer).toContain("研究");
  });

  // ── Explainability stub ──

  it("buildExplainabilityStub returns grounded=ungrounded placeholder", () => {
    const stub = buildExplainabilityStub("为什么我更焦虑了？");
    expect(stub.question).toBe("为什么我更焦虑了？");
    expect(stub.groundingStatus).toBe("ungrounded");
    expect(stub.causalSteps).toHaveLength(0);
  });
});
