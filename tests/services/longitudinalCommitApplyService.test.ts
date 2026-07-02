import { describe, expect, it } from "vitest";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import { buildLongitudinalFinalStateForCommit } from "../../src/core/life/finalStateForCommit";
import type {
  CompactStateSummary,
  LongitudinalCommitPolicy,
  LongitudinalSimulationRequest,
  LongitudinalSimulationResult,
} from "../../src/core/life/longitudinalSimulation";
import type { LifeTickCommitResult } from "../../src/core/life/lifeTickPersistence";
import type { CharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../src/core/personality/coordinate";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";

function cloneWithGeneratedMemory(state: CharacterPhysicsState): CharacterPhysicsState {
  const next = structuredClone(state) as CharacterPhysicsState;
  next.memories.push({
    id: "life-service-apply-1",
    content: "Dream residue: service apply (tone: calm)",
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

function request(characterId: string, commitPolicy: LongitudinalCommitPolicy = { enabled: true, commitDreams: true }): LongitudinalSimulationRequest {
  return {
    characterId,
    totalHours: 4,
    stepHours: 4,
    seed: "service-apply-seed",
    commitPolicy,
  };
}

function summary(state: CharacterPhysicsState): CompactStateSummary {
  return {
    memoryCount: state.memories.length,
    beliefCount: state.beliefStates.length,
    trust: state.coordinate.values.trust,
    fear: state.coordinate.values.fear,
    control: state.coordinate.values.control,
    openness: state.coordinate.values.openness,
    conscientiousness: state.coordinate.values.conscientiousness,
    boundaryStress: state.boundary.stressLoad,
    boundaryIntegrity: state.boundary.integrity,
    metaResilience: state.metaState.resilience,
    metaSelfControl: state.metaState.selfControl,
  };
}

function result(characterId: string, baseState: CharacterPhysicsState, finalState: CharacterPhysicsState): LongitudinalSimulationResult {
  const commitResult: LifeTickCommitResult = {
    applied: true,
    state: finalState,
    changes: [{
      path: `memories[${baseState.memories.length}]`,
      from: null,
      to: "Dream residue: service apply (tone: calm)",
      reason: "[step-0] Dream fragment persisted as internal memory seed.",
    }],
    skipped: [],
    warnings: [],
    reasons: ["1 dream memory seed(s) added."],
  };
  return {
    version: "v10.17",
    characterId,
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
      stateSummaryAfter: summary(finalState),
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
      beliefCountBefore: baseState.beliefStates.length,
      beliefCountAfter: finalState.beliefStates.length,
      memoryCountBefore: baseState.memories.length,
      memoryCountAfter: finalState.memories.length,
    },
    finalStateSummary: summary(finalState),
    warnings: [],
    reasons: ["Running 1 steps of 4h each (total: 4h)."],
  };
}

function buildHandoff(
  characterId: string,
  baseState: CharacterPhysicsState,
  finalState: CharacterPhysicsState,
  commitPolicy?: LongitudinalCommitPolicy
) {
  return buildLongitudinalFinalStateForCommit({
    characterId,
    request: request(characterId, commitPolicy),
    baseState,
    finalState,
    result: result(characterId, baseState, finalState),
    timestamp: "2026-06-28T00:00:00.000Z",
  });
}

describe("InMemoryCharacterPhysicsService.applyLongitudinalCommit", () => {
  it("applies a ready private handoff and records applied audit", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-char";
    service.resetCharacter(characterId);
    const base = service.getState(characterId);
    const final = cloneWithGeneratedMemory(base);
    const handoff = buildHandoff(characterId, base, final);

    const result = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });

    expect(result.status).toBe("applied");
    expect(result.applied).toBe(true);
    expect(service.getState(characterId).memories.map((memory) => memory.id)).toContain("life-service-apply-1");
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("applied");
  });

  it("blocks without confirmation and does not write state", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-no-confirm";
    service.resetCharacter(characterId);
    const base = service.getState(characterId);
    const handoff = buildHandoff(characterId, base, cloneWithGeneratedMemory(base));

    const result = service.applyLongitudinalCommit(handoff, { appliedAt: "2026-06-28T01:00:00.000Z" });

    expect(result.status).toBe("blocked");
    expect(result.applied).toBe(false);
    expect(service.getState(characterId).memories.some((memory) => memory.id === "life-service-apply-1")).toBe(false);
    expect(service.getLongitudinalCommitAuditHistory(characterId)[0]?.status).toBe("blocked");
  });

  it("returns conflict when state changed after preview", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-conflict";
    service.resetCharacter(characterId);
    const base = service.getState(characterId);
    const handoff = buildHandoff(characterId, base, cloneWithGeneratedMemory(base));
    const changed = service.getState(characterId);
    changed.coordinate.values.trust = 0.99;
    service.replaceState(characterId, changed);

    const result = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });

    expect(result.status).toBe("conflict");
    expect(result.applied).toBe(false);
    expect(service.getState(characterId).memories.some((memory) => memory.id === "life-service-apply-1")).toBe(false);
  });

  it("returns not_found for missing character", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-missing";
    const base = service.resetCharacter("different-character");
    const handoff = buildHandoff(characterId, base, cloneWithGeneratedMemory(base));

    const result = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    });

    expect(result.status).toBe("not_found");
    expect(result.applied).toBe(false);
    expect(service.getLongitudinalCommitAuditHistory(characterId)).toHaveLength(0);
  });

  it("blocks governance-disabled handoff", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-governance";
    service.resetCharacter(characterId);
    const base = service.getState(characterId);
    const handoff = buildHandoff(characterId, base, cloneWithGeneratedMemory(base), { enabled: false });

    const result = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    });

    expect(result.status).toBe("blocked");
    expect(result.applied).toBe(false);
    expect(result.readiness?.blockers.join(" ")).toContain("commitPolicy.enabled");
  });

  it("preserves an existing applied audit when a later retry is blocked", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-apply-preserve-audit";
    service.resetCharacter(characterId);
    const base = service.getState(characterId);
    const final = cloneWithGeneratedMemory(base);
    const handoff = buildHandoff(characterId, base, final);

    const applied = service.applyLongitudinalCommit(handoff, {
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
      appliedAt: "2026-06-28T01:00:00.000Z",
    });
    service.replaceState(characterId, base);
    const blockedRetry = service.applyLongitudinalCommit(handoff, {
      confirmation: "WRONG_CONFIRMATION",
      appliedAt: "2026-06-28T02:00:00.000Z",
    });

    const history = service.getLongitudinalCommitAuditHistory(characterId);
    expect(applied.status).toBe("applied");
    expect(blockedRetry.status).toBe("blocked");
    expect(blockedRetry.applied).toBe(false);
    expect(blockedRetry.audit?.status).toBe("applied");
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("applied");
    expect(history[0]?.updatedAt).toBe("2026-06-28T01:00:00.000Z");
    expect(service.getState(characterId).memories.some((memory) => memory.id === "life-service-apply-1")).toBe(false);
  });
});
