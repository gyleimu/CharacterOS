import { describe, expect, it } from "vitest";
import { buildTimeMachineSnapshot, buildTimeMachineTimeline } from "../../../src/core/explorer/timeMachineSnapshot";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";
import { serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";

describe("V11.6 Time Machine Snapshot", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  function snap(label = "Day 1", seq = 1, capturedAt = "2026-01-01T00:00:00Z") {
    return buildTimeMachineSnapshot({ state, label, capturedAt, sequenceIndex: seq });
  }

  // ── Deterministic Snapshot ──

  it("builds deterministic snapshot", () => {
    const s1 = snap();
    expect(s1.snapshotId).toMatch(/^snap_/);
    expect(s1.immutable).toBe(true);
    expect(s1.characterId).toBe(state.identity.id);
    expect(s1.label).toBe("Day 1");
    expect(s1.sequenceIndex).toBe(1);
  });

  it("same input same snapshotId", () => {
    const s1 = snap("Day 7", 7, "2026-01-07T00:00:00Z");
    const s2 = snap("Day 7", 7, "2026-01-07T00:00:00Z");
    expect(s1.snapshotId).toBe(s2.snapshotId);
  });

  it("different sequenceIndex different snapshotId", () => {
    const s1 = snap("Day 1", 1);
    const s2 = snap("Day 7", 7);
    expect(s1.snapshotId).not.toBe(s2.snapshotId);
  });

  it("snapshot immutable=true", () => {
    const s = snap();
    expect(s.immutable).toBe(true);
  });

  // ── No Mutation ──

  it("does not mutate input state", () => {
    const before = JSON.stringify(serializeCharacterPhysicsState(state));
    snap();
    const after = JSON.stringify(serializeCharacterPhysicsState(state));
    expect(after).toBe(before);
  });

  // ── No Raw State ──

  it("no raw state payload exposed", () => {
    const s = snap();
    const json = JSON.stringify(s);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
  });

  it("personalitySummary qualitative only", () => {
    const s = snap();
    expect(s.personalitySummary.trust.value).not.toBeTypeOf("number");
    expect(typeof s.personalitySummary.trust.label).toBe("string");
  });

  it("memorySummary is summary only — no raw dump", () => {
    const s = snap();
    expect(s.memorySummary).toContain("记忆");
    expect(s.memorySummary).not.toContain('"content"');
    expect(s.memorySummary).not.toContain('"vector"');
  });

  // ── Event/Audit History ──

  it("event/audit history influences summary counts", () => {
    const sWithEvents = buildTimeMachineSnapshot({
      state, label: "Day 7", capturedAt: "2026-01-07T00:00:00Z", sequenceIndex: 7,
      eventCount: 12, recentAuditVerdict: "PASS",
    });

    expect(sWithEvents.memorySummary).toContain(state.memories.length.toString());
  });

  // ── Timeline ──

  it("timeline sorts snapshots by sequenceIndex", () => {
    const s1 = snap("Day 1", 1, "2026-01-01T00:00:00Z");
    const s3 = snap("Day 30", 30, "2026-01-30T00:00:00Z");
    const s2 = snap("Day 7", 7, "2026-01-07T00:00:00Z");

    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [s3, s1, s2], // intentionally out of order
    });

    expect(timeline.snapshots[0]!.sequenceIndex).toBe(1);
    expect(timeline.snapshots[1]!.sequenceIndex).toBe(7);
    expect(timeline.snapshots[2]!.sequenceIndex).toBe(30);
  });

  it("timeline currentSnapshotId = latest by sequence", () => {
    const s1 = snap("Day 1", 1);
    const s7 = snap("Day 7", 7);

    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [s1, s7],
    });

    expect(timeline.currentSnapshotId).toBe(s7.snapshotId);
  });

  it("timeline warns on mixed characterIds", () => {
    const otherState = createCharacterPhysicsState({
      identity: { id: "other", name: "其他", description: "", tags: [] },
      coordinate: { values: neutralCoordinate().values },
    });
    const otherSnap = buildTimeMachineSnapshot({
      state: otherState, label: "Day 1", capturedAt: "2026-01-01T00:00:00Z", sequenceIndex: 1,
    });

    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [snap(), otherSnap],
    });

    expect(timeline.warnings.some((w) => w.includes("不同角色"))).toBe(true);
  });

  it("restoreMode view_only by default", () => {
    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [snap()],
    });

    expect(timeline.restoreMode).toBe("view_only");
  });

  it("rollback_requires_confirmation only when requested", () => {
    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [snap()],
      restoreMode: "rollback_requires_confirmation",
    });

    expect(timeline.restoreMode).toBe("rollback_requires_confirmation");
  });

  it("empty timeline warns", () => {
    const timeline = buildTimeMachineTimeline({
      characterId: "lin_fan",
      snapshots: [],
    });

    expect(timeline.warnings.some((w) => w.includes("暂无快照"))).toBe(true);
    expect(timeline.currentSnapshotId).toBe("live");
  });

  // ── Labels ──

  it("supports Day 1 / Day 7 / Day 30 / Today labels", () => {
    const labels = ["Day 1", "Day 7", "Day 30", "Today"];
    for (const label of labels) {
      const s = buildTimeMachineSnapshot({
        state, label, capturedAt: new Date().toISOString(), sequenceIndex: 1,
      });
      expect(s.label).toBe(label);
    }
  });

  // ── Minimal State ──

  it("builder handles minimal/default state", () => {
    const minimal = createCharacterPhysicsState({
      identity: { id: "min", name: "最小", description: "", tags: [] },
      coordinate: { values: neutralCoordinate().values },
    });

    expect(() => buildTimeMachineSnapshot({
      state: minimal, label: "初始", capturedAt: new Date().toISOString(), sequenceIndex: 0,
    })).not.toThrow();
  });
});
