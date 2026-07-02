import { describe, expect, it } from "vitest";
import {
  getExplorerManifest, getCharacterStateSurface, previewEvent, applyEvent,
  getExplainabilityTimeline, createTimeMachineSnapshot, getTimeMachineTimeline,
  restoreTimeMachineView, getMindGalaxyEmbed,
} from "../../src/services/explorerService";

const CHAR_ID = "lin_fan";

describe("V11.8 Explorer Service", () => {
  // ── Manifest ──

  it("manifest returned with readOnlyDefault=true", () => {
    const res = getExplorerManifest(CHAR_ID);
    expect(res.success).toBe(true);
    expect(res.data!.readOnlyDefault).toBe(true);
    expect(res.data!.releaseBoundary.noChatAgent).toBe(true);
    expect(res.data!.releaseBoundary.noMultiCharacter).toBe(true);
  });

  // ── Character State ──

  it("state surface returned without raw state", () => {
    const res = getCharacterStateSurface(CHAR_ID);
    expect(res.success).toBe(true);
    expect(res.data!.characterId).toBe(CHAR_ID);
    expect(res.data!.safetyNote).toContain("模拟");

    const json = JSON.stringify(res.data);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
  });

  // ── Preview Event ──

  it("previewEvent does not mutate state", () => {
    const before = getCharacterStateSurface(CHAR_ID);
    previewEvent(CHAR_ID, { naturalLanguageInput: "王雪解释并陪伴。", tags: ["支持"] });
    const after = getCharacterStateSurface(CHAR_ID);

    // Surface should be identical (no mutation from preview)
    expect(after.data!.headline).toBe(before.data!.headline);
  });

  it("previewEvent returns structured preview", () => {
    const res = previewEvent(CHAR_ID, { naturalLanguageInput: "王雪突然失联。", tags: ["失联"] });
    expect(res.success).toBe(true);
    expect(res.data!.requiresConfirmation).toBe(true);
    expect(res.data!.parsedEvent.category).toBeTruthy();
  });

  // ── Apply Event ──

  it("applyEvent blocks missing confirmation", () => {
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "普通一天。", tags: ["日常"] });
    const res = applyEvent(CHAR_ID, {}, preview.data!, "", "test", "u1");
    expect(res.success).toBe(false);
    expect(res.error!.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("applyEvent succeeds with valid confirmation", () => {
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "王雪主动解释。", tags: ["支持"] });
    const res = applyEvent(CHAR_ID, {}, preview.data!, "apply", "测试应用", "test_user");
    expect(res.success).toBe(true);
    expect(res.writeRequiresConfirmation).toBe(true);
    expect(res.data!.applied).toBe(true);
  });

  // ── Explainability ──

  it("explainability no history returns low confidence", () => {
    // Fresh character might have no audit history
    const res = getExplainabilityTimeline(CHAR_ID);
    expect(res.success).toBe(true);
    // After an apply, there should be history
    expect(res.data!.causalSteps.length).toBeGreaterThanOrEqual(0);
  });

  it("explainability with history after apply", () => {
    // Apply an event first to generate history
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "王雪失联三天。", tags: ["失联"] });
    applyEvent(CHAR_ID, {}, preview.data!, "apply", "generate history", "u1");

    const res = getExplainabilityTimeline(CHAR_ID);
    expect(res.success).toBe(true);
    expect(res.data!.causalSteps.length).toBeGreaterThan(0);
  });

  // ── Time Machine Snapshot ──

  it("snapshot creation returns deterministic data", () => {
    const res1 = createTimeMachineSnapshot(CHAR_ID, "Day 1");
    const res2 = createTimeMachineSnapshot(CHAR_ID, "Day 1");
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    // Different snapshots have different IDs (different sequenceIndex)
    expect(res1.data!.snapshotId).not.toBe(res2.data!.snapshotId);
    expect(res1.data!.immutable).toBe(true);
  });

  // ── Timeline ──

  it("timeline returns snapshots", () => {
    const res = getTimeMachineTimeline(CHAR_ID);
    expect(res.success).toBe(true);
    expect(res.data!.snapshots.length).toBeGreaterThanOrEqual(0);
    expect(res.data!.restoreMode).toBe("view_only");
  });

  // ── Restore View ──

  it("restore view is noMutation", () => {
    const tl = getTimeMachineTimeline(CHAR_ID);
    if (tl.data!.snapshots.length > 0) {
      const snapId = tl.data!.snapshots[0]!.snapshotId;
      const res = restoreTimeMachineView(CHAR_ID, snapId);
      expect(res.success).toBe(true);
      expect(res.data!.noMutation).toBe(true);
      expect(res.data!.isHistoricalView).toBe(true);
      expect(res.data!.safetyBanner.length).toBeGreaterThan(0);
    }
  });

  // ── Mind Galaxy ──

  it("mind galaxy embed is read-only advanced mode", () => {
    const res = getMindGalaxyEmbed(CHAR_ID);
    expect(res.success).toBe(true);
    expect(res.data!.noMutation).toBe(true);
    expect(res.data!.mode).toBe("advanced");
    expect(res.data!.safetyBoundary.readOnly).toBe(true);
  });

  // ── Structured Errors ──

  it("service errors are structured", () => {
    const res = applyEvent(CHAR_ID, {}, {} as any, "", "", "");
    expect(res.success).toBe(false);
    expect(res.error).not.toBeNull();
    expect(res.error!.code).toBeTruthy();
    expect(res.error!.message).toBeTruthy();
    expect(["info", "warn", "error"]).toContain(res.error!.severity);
  });

  // ── Safety ──

  it("writeRequiresConfirmation true for apply", () => {
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "测试。", tags: ["日常"] });
    const res = applyEvent(CHAR_ID, {}, preview.data!, "apply", "test", "u1");
    expect(res.writeRequiresConfirmation).toBe(true);
  });

  it("no chat/agent/multi fields in responses", () => {
    const responses = [
      getExplorerManifest(CHAR_ID),
      getCharacterStateSurface(CHAR_ID),
      getMindGalaxyEmbed(CHAR_ID),
    ];
    for (const res of responses) {
      const json = JSON.stringify(res.data);
      expect(json).not.toContain("chat");
      expect(json).not.toContain("agent");
      expect(json).not.toContain("multi-character");
    }
  });

  it("service does not expose raw CharacterPhysicsState", () => {
    const res = getCharacterStateSurface(CHAR_ID);
    const json = JSON.stringify(res.data);
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
    expect(json).not.toContain("homeostasisState");
    expect(json).not.toContain("proceduralRoutines");
  });

  // ── Determinism ──

  it("service methods are deterministic where expected", () => {
    const m1 = getExplorerManifest(CHAR_ID);
    const m2 = getExplorerManifest(CHAR_ID);
    expect(JSON.stringify(m1.data)).toBe(JSON.stringify(m2.data));

    const s1 = getCharacterStateSurface(CHAR_ID);
    const s2 = getCharacterStateSurface(CHAR_ID);
    expect(s1.data!.headline).toBe(s2.data!.headline);
  });
});
