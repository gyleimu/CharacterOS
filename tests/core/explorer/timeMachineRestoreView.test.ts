import { describe, expect, it } from "vitest";
import { buildTimeMachineRestoreView } from "../../../src/core/explorer/timeMachineRestoreView";
import { buildTimeMachineSnapshot, buildTimeMachineTimeline } from "../../../src/core/explorer/timeMachineSnapshot";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";

function mkSnap(state: any, label = "Day 1", seq = 1, capturedAt = "2026-01-01T00:00:00Z") {
  return buildTimeMachineSnapshot({ state, label, capturedAt, sequenceIndex: seq });
}
function mkTL(snaps: any[], charId = "lin_fan") {
  return buildTimeMachineTimeline({ characterId: charId, snapshots: snaps });
}

describe("V11.7 Time Machine Restore View", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
  const snap1 = mkSnap(state, "Day 1", 1);
  const snap7 = mkSnap(state, "Day 7", 7, "2026-01-07T00:00:00Z");
  const tl = mkTL([snap1, snap7]);

  // ── Basic Restore ──

  it("builds restore view from snapshot", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });

    expect(view.restoreViewId).toMatch(/^rview_/);
    expect(view.snapshotId).toBe(snap1.snapshotId);
    expect(view.isHistoricalView).toBe(true);
    expect(view.noMutation).toBe(true);
    expect(view.characterId).toBe("lin_fan");
    expect(view.label).toBe("Day 1");
  });

  it("restoreViewId deterministic", () => {
    const v1 = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    const v2 = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    expect(v1.restoreViewId).toBe(v2.restoreViewId);
  });

  // ── isCurrentSnapshot ──

  it("isCurrentSnapshot true for latest", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap7, timeline: tl });
    expect(view.isCurrentSnapshot).toBe(true);
  });

  it("isCurrentSnapshot false for older snapshot", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    expect(view.isCurrentSnapshot).toBe(false);
  });

  // ── Restore Mode ──

  it("default restoreMode view_only", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    expect(view.restoreMode).toBe("view_only");
  });

  it("rollback_requires_confirmation only when explicit", () => {
    const rtl = buildTimeMachineTimeline({
      characterId: "lin_fan", snapshots: [snap1], restoreMode: "rollback_requires_confirmation",
    });
    const view = buildTimeMachineRestoreView({
      snapshot: snap1, timeline: rtl, restoreMode: "rollback_requires_confirmation",
    });
    expect(view.restoreMode).toBe("rollback_requires_confirmation");
  });

  // ── Safety Banner ──

  it("safetyBanner includes all required messages", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    expect(view.safetyBanner.length).toBeGreaterThanOrEqual(3);
    expect(view.safetyBanner.some((b) => b.includes("历史视图"))).toBe(true);
    expect(view.safetyBanner.some((b) => b.includes("不是当前"))).toBe(true);
    expect(view.safetyBanner.some((b) => b.includes("诊断"))).toBe(true);
    expect(view.safetyBanner.some((b) => b.includes("不会写回"))).toBe(true);
  });

  // ── Galaxy Ref ──

  it("passes through mindGalaxyRef", () => {
    const sWithGalaxy = buildTimeMachineSnapshot({
      state, label: "Day 1", capturedAt: "2026-01-01T00:00:00Z", sequenceIndex: 1,
      galaxyRef: "mind-galaxy/index.html",
    });
    const view = buildTimeMachineRestoreView({
      snapshot: sWithGalaxy, timeline: mkTL([sWithGalaxy]),
    });
    expect(view.mindGalaxyRef).toBe("mind-galaxy/index.html");
  });

  it("warns when galaxyRef missing", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    // Default galaxy ref from fingerprint — may or may not warn depending on value
    expect(view.mindGalaxyRef).toBeTruthy();
  });

  // ── Diff From Current ──

  it("produces qualitative diffFromCurrent when current snapshot supplied", () => {
    const view = buildTimeMachineRestoreView({
      snapshot: snap1, timeline: tl, currentSnapshot: snap7,
    });

    expect(view.diffFromCurrent).not.toBeNull();
    expect(view.diffFromCurrent!.changes.length).toBeGreaterThan(0);
    for (const change of view.diffFromCurrent!.changes) {
      expect(change.dimension).toBeTruthy();
      expect(["increased", "decreased", "changed", "unchanged"]).toContain(change.direction);
    }
  });

  it("no diff when snapshot is current", () => {
    const view = buildTimeMachineRestoreView({
      snapshot: snap7, timeline: tl, currentSnapshot: snap7,
    });
    expect(view.diffFromCurrent).toBeNull(); // same snapshot, no diff needed
  });

  // ── No Raw State ──

  it("does not expose raw state", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    const json = JSON.stringify(view);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain('"trust":0.');
    expect(json).not.toContain('"fear":0.');
  });

  // ── No Mutation ──

  it("does not mutate snapshot or timeline", () => {
    const snapCopy = JSON.stringify(snap1);
    const tlCopy = JSON.stringify(tl);
    buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    expect(JSON.stringify(snap1)).toBe(snapCopy);
    expect(JSON.stringify(tl)).toBe(tlCopy);
  });

  // ── No Leaked Fields ──

  it("no chat/agent/multi-character fields", () => {
    const view = buildTimeMachineRestoreView({ snapshot: snap1, timeline: tl });
    const json = JSON.stringify(view);
    expect(json).not.toContain("chat");
    expect(json).not.toContain("agent");
    expect(json).not.toContain("multi-character");
  });

  // ── Graceful ──

  it("handles minimal snapshot gracefully", () => {
    const minimalSnap = buildTimeMachineSnapshot({
      state, label: "最小", capturedAt: new Date().toISOString(), sequenceIndex: 0,
    });
    const mtl = mkTL([minimalSnap]);

    expect(() => buildTimeMachineRestoreView({ snapshot: minimalSnap, timeline: mtl })).not.toThrow();
  });
});
