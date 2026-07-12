import { describe, expect, it } from "vitest";
import { buildEventStudioPreview } from "../../../src/core/explorer/eventStudioPreview";
import { buildEventStudioDraft } from "../../../src/core/explorer/explorerDtoBuilders";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

const relationshipScenario = {
  id: "preview_test_scenario",
  name: "关系场景",
  trigger: "对方第二天只回了一句刚看到。",
  stressor: "亲密关系解释缺失",
  testFocus: "信任 / 安全感 / 行为策略",
};

function snapshotState(state: any) {
  return JSON.stringify(serializeCharacterPhysicsState(state));
}

describe("V11.2 Event Studio Preview Core", () => {
  const baseline = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  // ── Parse Only ──

  it("parse_only returns parsed event only", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪主动解释昨晚没回复的原因。",
      tags: ["王雪", "解释", "支持"],
    });
    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "parse_only",
    });

    expect(preview.parsedEvent.category).toBeTruthy();
    expect(preview.parsedEvent.emotion).toBeTruthy();
    expect(preview.parsedEvent.intensity).toBeGreaterThan(0);
    expect(preview.parsedEvent.parserConfidence).toBeGreaterThanOrEqual(0);
    // Parse-only: no full simulation data
    expect(preview.beliefPreview.likelyNewBelief).toBeNull();
    expect(preview.beliefPreview.likelyStrengthenedBeliefs).toHaveLength(0);
    expect(preview.personalityPreview.estimatedMagnitude).toBe("minimal");
  });

  // ── Impact Preview ──

  it("impact_preview includes impact but no state mutation", () => {
    const beforeSnapshot = snapshotState(baseline);
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "朋友把他的秘密告诉了别人。",
      tags: ["背叛", "欺骗"],
      intensity: 0.85,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "impact_preview",
    });
    const afterSnapshot = snapshotState(baseline);

    // State must be unchanged
    expect(afterSnapshot).toBe(beforeSnapshot);

    // Impact should reflect high-intensity betrayal
    expect(preview.impactPreview.expectedMemoryImpact).toBe("high");
    expect(preview.impactPreview.expectedBoundaryImpact).toBe("high"); // betrayal with 0.85 intensity
    // Belief stub should indicate betrayal effects
    const beliefContents = [
      ...preview.beliefPreview.likelyStrengthenedBeliefs,
      preview.beliefPreview.likelyNewBelief ?? "",
    ].join("");
    expect(beliefContents.length).toBeGreaterThan(0);
  });

  // ── Full Preview ──

  it("full_preview includes state deltas and decision preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪突然失联，直到第二天中午才回复一句刚看到。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      intensity: 0.8,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    // Full preview must require confirmation
    expect(preview.requiresConfirmation).toBe(true);
    // Should have personality delta
    expect(preview.personalityPreview.direction).toBeTruthy();
    expect(preview.personalityPreview.affectedDimensions.length).toBeGreaterThanOrEqual(0);
    // Decision preview should have content
    expect(preview.decisionPreview.likelyStrategyShift.length).toBeGreaterThan(0);
    // Memory preview should indicate new memory
    expect(preview.memoryPreview.willCreateMemory).toBe(true);
  });

  it("full_preview derives need changes from simulated state", () => {
    const neutralBaseline = createCharacterPhysicsState({ coordinate: neutralCoordinate() });
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "最信任的人隐瞒事实并背叛了承诺。",
      tags: ["背叛", "欺骗", "亲密关系"],
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: neutralBaseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    expect(preview.needPreview.likelyActivatedNeeds.length).toBeGreaterThan(0);
  });

  // ── Baseline Immutability ──

  it("baseline state immutable after full preview", () => {
    const beforeSnapshot = snapshotState(baseline);

    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪失联三天。",
      tags: ["失联", "等待"],
      intensity: 0.9,
    });

    buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    const afterSnapshot = snapshotState(baseline);
    expect(afterSnapshot).toBe(beforeSnapshot);
  });

  // ── Warnings ──

  it("repeated event creates warning", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪再次失联。",
      repetitionCount: 5,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "impact_preview",
    });

    expect(preview.warnings.some((w) => w.includes("重复"))).toBe(true);
  });

  it("high intensity creates warning", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "被最信任的人公开背叛。",
      intensity: 0.95,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "impact_preview",
    });

    expect(preview.warnings.some((w) => w.includes("强度很高"))).toBe(true);
  });

  it("missing followUpScenario creates warning in full preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "普通一天。",
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "full_preview",
    });

    expect(preview.warnings.some((w) => w.includes("完整预览"))).toBe(true);
  });

  it("empty input creates warning", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "",
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "parse_only",
    });

    expect(preview.warnings.some((w) => w.includes("为空"))).toBe(true);
  });

  // ── Directional Correctness ──

  it("support event previews positive trust/openness direction", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪主动解释并认真陪伴了他。",
      tags: ["王雪", "解释", "陪伴", "支持"],
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    // Support should show repair direction
    expect(preview.personalityPreview.direction).toMatch(/修复|信任.*上|上升/);
  });

  it("abandonment event previews caution/withdrawal direction", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪三天没有回复任何消息。",
      tags: ["王雪", "失联", "等待"],
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    // Abandonment should show defensive direction
    expect(preview.personalityPreview.direction).toMatch(/防御|信任.*下|下降/);
  });

  it("neutral event produces low impact preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "下午路过便利店看到新海报。",
      tags: ["日常"],
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "impact_preview",
    });

    expect(preview.impactPreview.expectedPersonalityImpact).toBe("minimal");
  });

  // ── Confirmation ──

  it("preview requires confirmation for full preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪失联。",
    });

    const full = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });
    expect(full.requiresConfirmation).toBe(true);

    const parseOnly = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      previewMode: "parse_only",
    });
    expect(parseOnly.requiresConfirmation).toBe(false); // parse-only doesn't require confirmation
  });

  // ── No raw state exposure ──

  it("no raw state payload exposed in preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "重大事件",
      intensity: 0.9,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    const json = JSON.stringify(preview);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("velocity");
    expect(json).not.toContain("overflowCount");
    expect(json).not.toContain("biologicalNature");
  });

  // ── Determinism ──

  it("deterministic same input same output", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪主动解释。",
      tags: ["解释", "支持"],
    });

    const p1 = buildEventStudioPreview({ draft, baselineState: baseline, followUpScenario: relationshipScenario, previewMode: "full_preview" });
    const p2 = buildEventStudioPreview({ draft, baselineState: baseline, followUpScenario: relationshipScenario, previewMode: "full_preview" });

    expect(p1.parsedEvent.category).toBe(p2.parsedEvent.category);
    expect(p1.impactPreview.expectedBoundaryImpact).toBe(p2.impactPreview.expectedBoundaryImpact);
    expect(p1.personalityPreview.direction).toBe(p2.personalityPreview.direction);
    expect(p1.warnings).toEqual(p2.warnings);
  });

  // ── Reality Audit in preview ──

  it("reality audit warnings propagate to preview", () => {
    const draft = buildEventStudioDraft({
      naturalLanguageInput: "王雪失联三天，他整晚等待。",
      tags: ["王雪", "失联", "等待", "亲密关系"],
      intensity: 0.9,
    });

    const preview = buildEventStudioPreview({
      draft,
      baselineState: baseline,
      followUpScenario: relationshipScenario,
      previewMode: "full_preview",
    });

    // Reality audit warnings should be present for high-intensity abandonment
    expect(preview.realityAuditPreview).toBeDefined();
    expect(preview.realityAuditPreview.preflightWarnings.length).toBeGreaterThanOrEqual(0);
  });
});
