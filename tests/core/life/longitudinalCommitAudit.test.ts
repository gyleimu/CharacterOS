import { describe, expect, it } from "vitest";
import {
  createLongitudinalCommitAuditEntry,
  findLongitudinalCommitAuditBySimulationId,
  markLongitudinalCommitAuditApplied,
  markLongitudinalCommitAuditRolledBack,
  summarizeLongitudinalCommitHistory,
} from "../../../src/core/life/longitudinalCommitAudit";
import { buildLongitudinalFinalStateForCommit } from "../../../src/core/life/finalStateForCommit";
import type {
  CompactStateSummary,
  LongitudinalCommitPolicy,
  LongitudinalSimulationRequest,
  LongitudinalSimulationResult,
} from "../../../src/core/life/longitudinalSimulation";
import type { LifeTickCommitResult } from "../../../src/core/life/lifeTickPersistence";
import { createCharacterPhysicsState, type CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

function state(id = "audit-char"): CharacterPhysicsState {
  return createCharacterPhysicsState({
    identity: { id, name: "Audit Test", description: "Longitudinal audit test character.", tags: ["test"] },
  });
}

function finalState(): CharacterPhysicsState {
  const next = state();
  next.memories.push({
    id: "life-dream-audit-1",
    content: "Dream residue: quiet room (tone: calm)",
    vector: neutralCoordinate(),
    importance: 0.1,
    emotion: "calm",
    recency: 1,
    repetitionCount: 1,
    beliefEffect: "",
    timeStamp: "2026-06-28T00:00:00.000Z",
  });
  return next;
}

function request(commitPolicy: LongitudinalCommitPolicy = { enabled: true, commitDreams: true }): LongitudinalSimulationRequest {
  return {
    characterId: "audit-char",
    totalHours: 4,
    stepHours: 4,
    seed: "audit-seed",
    commitPolicy,
  };
}

function summary(characterState: CharacterPhysicsState): CompactStateSummary {
  return {
    memoryCount: characterState.memories.length,
    beliefCount: characterState.beliefStates.length,
    trust: characterState.coordinate.values.trust,
    fear: characterState.coordinate.values.fear,
    control: characterState.coordinate.values.control,
    openness: characterState.coordinate.values.openness,
    conscientiousness: characterState.coordinate.values.conscientiousness,
    boundaryStress: characterState.boundary.stressLoad,
    boundaryIntegrity: characterState.boundary.integrity,
    metaResilience: characterState.metaState.resilience,
    metaSelfControl: characterState.metaState.selfControl,
  };
}

function result(baseState = state(), committedState = finalState()): LongitudinalSimulationResult {
  const commitResult: LifeTickCommitResult = {
    applied: true,
    state: committedState,
    changes: [{
      path: "memories[0]",
      from: null,
      to: "Dream residue: quiet room (tone: calm)",
      reason: "[step-0] Dream fragment persisted as internal memory seed.",
    }],
    skipped: [],
    warnings: [],
    reasons: ["1 dream memory seed(s) added."],
  };
  return {
    version: "v10.17",
    characterId: "audit-char",
    totalHours: 4,
    stepHours: 4,
    applied: true,
    steps: [{
      index: 0,
      elapsedHours: 4,
      absoluteHour: 0,
      lifeDecisionContext: {
        energy: 0.8,
        fatigue: 0.2,
        sleepPressure: 0.1,
        sleepPhase: "awake",
        boredom: 0.1,
        restlessness: 0.1,
        daydreamingTendency: 0.1,
        explorationPressure: 0.1,
        irritability: 0.1,
        strongestRandomThoughtKind: "nothing",
        strongestRandomThoughtPhrase: "",
        strongestInspirationType: "none",
        strongestInspirationStrength: 0,
        topSelfActionCandidateType: "do_nothing",
        topSelfActionCandidateScore: 0.1,
        reasons: ["test context"],
      },
      commitResult,
      stateSummaryBefore: summary(baseState),
      stateSummaryAfter: summary(committedState),
      warnings: [],
      reasons: ["Commit: 1 changes, 0 skipped."],
    }],
    aggregate: {
      totalSteps: 1,
      committedSteps: 1,
      generatedMemoryCount: 1,
      averageFatigue: 0.2,
      averageBoredom: 0.1,
      sleepPhaseCounts: { awake: 1 },
      strategyCounts: {},
      actionDirectionCounts: {},
      lifeInfluenceCount: 0,
      personalityDeltaSummary: {},
      beliefCountBefore: 0,
      beliefCountAfter: 0,
      memoryCountBefore: 0,
      memoryCountAfter: 1,
    },
    finalStateSummary: summary(committedState),
    warnings: [],
    reasons: ["Running 1 steps of 4h each (total: 4h)."],
  };
}

function handoff(commitPolicy?: LongitudinalCommitPolicy) {
  const base = state();
  const committed = finalState();
  return buildLongitudinalFinalStateForCommit({
    characterId: "audit-char",
    request: request(commitPolicy),
    baseState: base,
    finalState: committed,
    result: result(base, committed),
    timestamp: "2026-06-28T00:00:00.000Z",
  });
}

describe("V10.24 longitudinal commit audit helpers", () => {
  it("creates a previewed audit entry without exposing finalState", () => {
    const entry = createLongitudinalCommitAuditEntry(handoff());

    expect(entry.version).toBe("v10.24");
    expect(entry.status).toBe("previewed");
    expect(entry.generatedMemoryIds).toEqual(["life-dream-audit-1"]);
    expect(entry.rollbackPlan.generatedMemoryIds).toEqual(["life-dream-audit-1"]);
    expect(entry).not.toHaveProperty("finalState");
    expect(JSON.stringify(entry)).not.toContain("\"finalState\":");
    expect(JSON.stringify(entry)).not.toContain("clusters");
  });

  it("defaults blocked governance to blocked audit status", () => {
    const entry = createLongitudinalCommitAuditEntry(handoff({ enabled: false }));
    expect(entry.status).toBe("blocked");
    expect(entry.governanceStatus).toBe("block");
    expect(entry.governanceBlockers.join(" ")).toContain("commitPolicy.enabled");
  });

  it("marks entries applied immutably", () => {
    const entry = createLongitudinalCommitAuditEntry(handoff());
    const applied = markLongitudinalCommitAuditApplied(entry, "2026-06-28T01:00:00.000Z");

    expect(entry.status).toBe("previewed");
    expect(applied.status).toBe("applied");
    expect(applied.appliedAt).toBe("2026-06-28T01:00:00.000Z");
    expect(applied.updatedAt).toBe("2026-06-28T01:00:00.000Z");
  });

  it("marks entries rolled back while preserving appliedAt", () => {
    const applied = markLongitudinalCommitAuditApplied(
      createLongitudinalCommitAuditEntry(handoff()),
      "2026-06-28T01:00:00.000Z"
    );
    const rolledBack = markLongitudinalCommitAuditRolledBack(applied, "2026-06-28T02:00:00.000Z");

    expect(rolledBack.status).toBe("rolled_back");
    expect(rolledBack.appliedAt).toBe("2026-06-28T01:00:00.000Z");
    expect(rolledBack.rolledBackAt).toBe("2026-06-28T02:00:00.000Z");
  });

  it("summarizes and finds history entries", () => {
    const previewed = createLongitudinalCommitAuditEntry(handoff());
    const applied = markLongitudinalCommitAuditApplied(
      createLongitudinalCommitAuditEntry(handoff(), { createdAt: "2026-06-28T01:00:00.000Z" }),
      "2026-06-28T02:00:00.000Z"
    );
    const blocked = createLongitudinalCommitAuditEntry(handoff({ enabled: false }));
    const summary = summarizeLongitudinalCommitHistory([previewed, applied, blocked]);

    expect(summary.total).toBe(3);
    expect(summary.previewed).toBe(1);
    expect(summary.applied).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.generatedMemoryCount).toBe(3);
    expect(summary.latestUpdatedAt).toBe("2026-06-28T02:00:00.000Z");
    expect(findLongitudinalCommitAuditBySimulationId([previewed], previewed.simulationId)).toBe(previewed);
  });
});
