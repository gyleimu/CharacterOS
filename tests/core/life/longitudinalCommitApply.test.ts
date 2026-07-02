import { describe, expect, it } from "vitest";
import {
  LONGITUDINAL_COMMIT_CONFIRMATION,
  evaluateLongitudinalCommitApplyReadiness,
} from "../../../src/core/life/longitudinalCommitApply";
import {
  buildLongitudinalFinalStateForCommit,
  computeLongitudinalStateFingerprint,
} from "../../../src/core/life/finalStateForCommit";
import type {
  CompactStateSummary,
  LongitudinalCommitPolicy,
  LongitudinalSimulationRequest,
  LongitudinalSimulationResult,
} from "../../../src/core/life/longitudinalSimulation";
import type { LifeTickCommitResult } from "../../../src/core/life/lifeTickPersistence";
import { createCharacterPhysicsState, type CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

function state(): CharacterPhysicsState {
  return createCharacterPhysicsState({
    identity: { id: "apply-char", name: "Apply Test", description: "Apply readiness test.", tags: ["test"] },
  });
}

function finalState(): CharacterPhysicsState {
  const next = state();
  next.memories.push({
    id: "life-apply-1",
    content: "Dream residue: apply test (tone: calm)",
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
    characterId: "apply-char",
    totalHours: 4,
    stepHours: 4,
    seed: "apply-seed",
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
      to: "Dream residue: apply test (tone: calm)",
      reason: "[step-0] Dream fragment persisted as internal memory seed.",
    }],
    skipped: [],
    warnings: [],
    reasons: ["1 dream memory seed(s) added."],
  };
  return {
    version: "v10.17",
    characterId: "apply-char",
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
    characterId: "apply-char",
    request: request(commitPolicy),
    baseState: base,
    finalState: committed,
    result: result(base, committed),
    timestamp: "2026-06-28T00:00:00.000Z",
  });
}

describe("V10.25 longitudinal commit apply readiness", () => {
  it("returns ready when confirmation, fingerprint, and governance pass", () => {
    const h = handoff();
    const readiness = evaluateLongitudinalCommitApplyReadiness({
      handoff: h,
      currentStateFingerprint: h.baseStateFingerprint,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.blockers).toHaveLength(0);
  });

  it("blocks when confirmation is missing", () => {
    const h = handoff();
    const readiness = evaluateLongitudinalCommitApplyReadiness({
      handoff: h,
      currentStateFingerprint: h.baseStateFingerprint,
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockers.join(" ")).toContain("confirmation");
  });

  it("returns conflict when current state fingerprint changed", () => {
    const h = handoff();
    const changed = finalState();
    const readiness = evaluateLongitudinalCommitApplyReadiness({
      handoff: h,
      currentStateFingerprint: computeLongitudinalStateFingerprint(changed),
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    });

    expect(readiness.status).toBe("conflict");
    expect(readiness.blockers.join(" ")).toContain("fingerprint");
  });

  it("blocks when handoff governance blocks", () => {
    const h = handoff({ enabled: false });
    const readiness = evaluateLongitudinalCommitApplyReadiness({
      handoff: h,
      currentStateFingerprint: h.baseStateFingerprint,
      confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockers.join(" ")).toContain("commitPolicy.enabled");
  });
});
