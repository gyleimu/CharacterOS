import { describe, expect, it } from "vitest";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";
import { serializeCharacterPhysicsState } from "../../../src/core/physics/serialization";

describe("V11.4 Character State Surface", () => {
  const linFan = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  // ── Basic Surface ──

  it("builds surface from normal LinFan state", () => {
    const surface = buildCharacterStateSurface({ state: linFan });

    expect(surface.characterId).toBe(linFan.identity.id);
    expect(surface.characterName).toBe(linFan.identity.name);
    expect(surface.headline.length).toBeGreaterThan(3);
    expect(surface.safetyNote.length).toBeGreaterThan(10);
    expect(surface.sourceSnapshotId.length).toBeGreaterThan(5);
  });

  it("headline is non-empty and human-readable", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    expect(surface.headline).toBeTruthy();
    expect(surface.headline.length).toBeGreaterThan(2);
    // Headline should be Chinese human-readable
    expect(surface.headline).not.toMatch(/^[a-zA-Z0-9_]+$/);
  });

  it("emotional state includes band and explanation", () => {
    const surface = buildCharacterStateSurface({ state: linFan });

    expect(surface.emotionalState.primary).toBeTruthy();
    expect(["positive", "neutral", "negative"]).toContain(surface.emotionalState.valence);
    expect(["low", "moderate", "high"]).toContain(surface.emotionalState.arousal);
    expect(surface.emotionalState.label.length).toBeGreaterThan(2);
  });

  it("stress state maps boundary phase to risk label", () => {
    const surface = buildCharacterStateSurface({ state: linFan });

    expect(["low", "moderate", "high", "overload"]).toContain(surface.stressState.level);
    expect(["stable", "strained", "overflow"]).toContain(surface.stressState.phase);
    expect(surface.stressState.label).toBeTruthy();
  });

  it("top needs limited to 3", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    expect(surface.dominantNeeds.length).toBeLessThanOrEqual(3);
  });

  it("top beliefs limited to 3", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    expect(surface.dominantBeliefs.length).toBeLessThanOrEqual(3);
    for (const b of surface.dominantBeliefs) {
      expect(["weak", "moderate", "strong"]).toContain(b.strength);
    }
  });

  it("behavior tendencies include bands not raw values", () => {
    const surface = buildCharacterStateSurface({ state: linFan });

    expect(["low", "moderate", "high"]).toContain(surface.behaviorTendencies.cautionLevel);
    expect(["low", "moderate", "high"]).toContain(surface.behaviorTendencies.opennessLevel);
    expect(surface.behaviorTendencies.likelyAction).toBeTruthy();
    expect(surface.behaviorTendencies.strategyLabel).toBeTruthy();
  });

  it("personality summary does not expose raw coordinate object", () => {
    const surface = buildCharacterStateSurface({ state: linFan });

    expect(surface.personalitySummary.trust.value).not.toBeTypeOf("number");
    expect(surface.personalitySummary.fear.label.length).toBeGreaterThan(3);
    expect(surface.personalitySummary.openness.label.length).toBeGreaterThan(3);

    const json = JSON.stringify(surface);
    expect(json).not.toContain('"trust":0.');
    expect(json).not.toContain('"fear":0.');
    expect(json).not.toContain('"openness":0.');
  });

  it("safety note includes simulation-not-diagnosis", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    expect(surface.safetyNote).toContain("模拟");
    expect(surface.safetyNote).toContain("诊断");
    expect(surface.safetyNote).toContain("非医学");
  });

  it("source fingerprint exists", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    expect(surface.sourceSnapshotId).toMatch(/^snap_/);
  });

  // ── Determinism & No Mutation ──

  it("builder deterministic", () => {
    const s1 = buildCharacterStateSurface({ state: linFan });
    const s2 = buildCharacterStateSurface({ state: linFan });
    expect(s1.headline).toBe(s2.headline);
    expect(s1.emotionalState.label).toBe(s2.emotionalState.label);
    expect(s1.sourceSnapshotId).toBe(s2.sourceSnapshotId);
  });

  it("builder does not mutate input state", () => {
    const before = JSON.stringify(serializeCharacterPhysicsState(linFan));
    buildCharacterStateSurface({ state: linFan });
    const after = JSON.stringify(serializeCharacterPhysicsState(linFan));
    expect(after).toBe(before);
  });

  // ── Graceful with minimal state ──

  it("minimal/default state does not throw", () => {
    const minimal = createCharacterPhysicsState({
      identity: { id: "min", name: "最小", description: "", tags: [] },
      coordinate: { values: neutralCoordinate().values },
    });
    expect(() => buildCharacterStateSurface({ state: minimal })).not.toThrow();

    const surface = buildCharacterStateSurface({ state: minimal });
    expect(surface.characterName).toBe("最小");
    expect(surface.headline).toBeTruthy();
  });

  // ── Recent events / audit influence ──

  it("recent event/audit history influences direction labels if provided", () => {
    const surfaceWithContext = buildCharacterStateSurface({
      state: linFan,
      recentEvents: [{ description: "王雪主动解释", category: "support", daysAgo: 1 }],
      recentAuditVerdict: "PASS",
    });

    expect(surfaceWithContext.headline).toBeTruthy();
    expect(surfaceWithContext.emotionalState.label).toBeTruthy();
  });

  it("recent negative event influences headline", () => {
    const surface = buildCharacterStateSurface({
      state: linFan,
      recentEvents: [{ description: "王雪失联", category: "abandonment", daysAgo: 1 }],
    });
    expect(surface.headline).toBeTruthy();
  });

  // ── No leaked fields ──

  it("no chat/agent/multi-character fields", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    const json = JSON.stringify(surface);
    expect(json).not.toContain("chat");
    expect(json).not.toContain("agent");
    expect(json).not.toContain("multi-character");
    expect(json).not.toContain("dialogue");
    expect(json).not.toContain("conversation");
  });

  it("no raw internal state leaked", () => {
    const surface = buildCharacterStateSurface({ state: linFan });
    const json = JSON.stringify(surface);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("coordinateDelta");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
  });
});
