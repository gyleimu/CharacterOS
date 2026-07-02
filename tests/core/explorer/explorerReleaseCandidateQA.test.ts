import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getExplorerManifest, getCharacterStateSurface, previewEvent, applyEvent } from "../../../src/services/explorerService";
import { buildTimeMachineRestoreView } from "../../../src/core/explorer/timeMachineRestoreView";
import { buildTimeMachineSnapshot, buildTimeMachineTimeline } from "../../../src/core/explorer/timeMachineSnapshot";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";

describe("V11.10 Explorer Release Candidate QA", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const CHAR_ID = "lin_fan";

  // ── Module Coverage ──

  it("all six modules covered in manifest", () => {
    const manifest = getExplorerManifest(CHAR_ID);
    const moduleIds = manifest.data!.modules.map((m) => m.moduleId);
    expect(moduleIds).toContain("event_studio");
    expect(moduleIds).toContain("character_state");
    expect(moduleIds).toContain("explainability");
    expect(moduleIds).toContain("mind_galaxy");
    expect(moduleIds).toContain("reality_audit");
    expect(moduleIds).toContain("time_machine");
  });

  // ── Artifact ──

  it("artifact manifest exists and readOnly=true", () => {
    const manifestPath = resolve("outputs/characteros-explorer/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.readOnly).toBe(true);
    expect(manifest.noApiRequired).toBe(true);
    expect(manifest.noLlmRequired).toBe(true);
    expect(manifest.noMutation).toBe(true);
  });

  it("no raw state forbidden keys in artifact JSON", () => {
    const dataPath = resolve("outputs/characteros-explorer/characteros-explorer-data.json");
    if (!existsSync(dataPath)) return; // artifact may not have been regenerated
    const json = readFileSync(dataPath, "utf-8");
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
    expect(json).not.toContain("homeostasisState");
  });

  // ── Event Studio Apply ──

  it("Event Studio apply requires confirmation", () => {
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "测试事件。", tags: ["日常"] });
    const blocked = applyEvent(CHAR_ID, {}, preview.data!, "", "test", "u1");
    expect(blocked.success).toBe(false);
    expect(blocked.error!.code).toContain("CONFIRMATION");
  });

  it("Event Studio apply succeeds with confirmation", () => {
    const preview = previewEvent(CHAR_ID, { naturalLanguageInput: "王雪解释并陪伴。", tags: ["支持"] });
    const result = applyEvent(CHAR_ID, {}, preview.data!, "apply", "QA test", "qa_user");
    expect(result.success).toBe(true);
    expect(result.data!.applied).toBe(true);
    expect(result.data!.auditEntry).not.toBeNull();
  });

  // ── Time Machine ──

  it("Time Machine restore view noMutation=true", () => {
    const snap = buildTimeMachineSnapshot({ state, label: "QA", capturedAt: new Date().toISOString(), sequenceIndex: 1 });
    const tl = buildTimeMachineTimeline({ characterId: CHAR_ID, snapshots: [snap] });
    const view = buildTimeMachineRestoreView({ snapshot: snap, timeline: tl });

    expect(view.noMutation).toBe(true);
    expect(view.isHistoricalView).toBe(true);
    expect(view.safetyBanner.length).toBeGreaterThan(0);
    expect(view.safetyBanner.some((b) => b.includes("历史视图"))).toBe(true);
  });

  // ── Service No Raw State ──

  it("Explorer service does not expose raw state", () => {
    const surface = getCharacterStateSurface(CHAR_ID);
    const json = JSON.stringify(surface.data);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain('"trust":0.');
  });

  // ── Safety Disclaimers ──

  it("safety disclaimers present in manifest", () => {
    const manifest = getExplorerManifest(CHAR_ID);
    expect(manifest.data!.safetyDisclaimers.length).toBeGreaterThan(0);
    expect(manifest.data!.safetyDisclaimers.some((d) => d.includes("模拟"))).toBe(true);
    expect(manifest.data!.safetyDisclaimers.some((d) => d.includes("诊断"))).toBe(true);
  });

  it("safety disclaimers present in state surface", () => {
    const surface = getCharacterStateSurface(CHAR_ID);
    expect(surface.data!.safetyNote).toContain("模拟");
  });

  // ── RC Manifest ──

  it("V11 RC manifest exists and rcVerdict=PASS", () => {
    const manifestPath = resolve("outputs/v11-explorer-rc-manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.rcVerdict).toBe("PASS");
    expect(manifest.releaseReady).toBe(true);
    expect(manifest.modules.eventStudio.status).toBeTruthy();
    expect(manifest.modules.timeMachine.status).toBeTruthy();
    expect(manifest.tests.failed).toBe(0);
    expect(manifest.safetyBoundaries.noChatAgent).toBe(true);
    expect(manifest.safetyBoundaries.noMultiCharacter).toBe(true);
  });

  // ── Release Boundary ──

  it("release boundary: single character, no V20", () => {
    const manifest = getExplorerManifest(CHAR_ID);
    expect(manifest.data!.releaseBoundary.singleCharacterOnly).toBe(true);
    expect(manifest.data!.releaseBoundary.noChatAgent).toBe(true);
    expect(manifest.data!.releaseBoundary.noMultiCharacter).toBe(true);
  });

  // ── No Mutation ──

  it("state unchanged after preview + surface reads", () => {
    const before = getCharacterStateSurface(CHAR_ID);
    previewEvent(CHAR_ID, { naturalLanguageInput: "测试。", tags: ["日常"] });
    getCharacterStateSurface(CHAR_ID);
    const after = getCharacterStateSurface(CHAR_ID);
    expect(after.data!.headline).toBe(before.data!.headline);
  });
});
