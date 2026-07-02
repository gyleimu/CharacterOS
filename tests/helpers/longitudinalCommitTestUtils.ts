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
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
} from "../../src/core/physics/serialization";

export function cloneWithGeneratedMemory(
  state: CharacterPhysicsState,
  memoryId = "life-test-generated-1"
): CharacterPhysicsState {
  const next = deserializeCharacterPhysicsState(serializeCharacterPhysicsState(state));
  next.memories.push({
    id: memoryId,
    content: "Dream residue: test generated memory (tone: calm)",
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

export function longitudinalCommitRequest(
  characterId: string,
  commitPolicy: LongitudinalCommitPolicy = { enabled: true, commitDreams: true }
): LongitudinalSimulationRequest {
  return {
    characterId,
    totalHours: 4,
    stepHours: 4,
    seed: "longitudinal-commit-test-seed",
    commitPolicy,
  };
}

export function compactSummary(state: CharacterPhysicsState): CompactStateSummary {
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

export function longitudinalCommitResult(
  characterId: string,
  baseState: CharacterPhysicsState,
  finalState: CharacterPhysicsState
): LongitudinalSimulationResult {
  const generatedMemory = finalState.memories.at(-1);
  const commitResult: LifeTickCommitResult = {
    applied: true,
    state: finalState,
    changes: [{
      path: `memories[${baseState.memories.length}]`,
      from: null,
      to: generatedMemory?.content ?? "Dream residue: test generated memory (tone: calm)",
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
      stateSummaryBefore: compactSummary(baseState),
      stateSummaryAfter: compactSummary(finalState),
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
    finalStateSummary: compactSummary(finalState),
    warnings: [],
    reasons: ["Running 1 steps of 4h each (total: 4h)."],
  };
}

export function buildLongitudinalCommitHandoff(
  characterId: string,
  baseState: CharacterPhysicsState,
  finalState: CharacterPhysicsState,
  commitPolicy?: LongitudinalCommitPolicy
) {
  return buildLongitudinalFinalStateForCommit({
    characterId,
    request: longitudinalCommitRequest(characterId, commitPolicy),
    baseState,
    finalState,
    result: longitudinalCommitResult(characterId, baseState, finalState),
    timestamp: "2026-06-28T00:00:00.000Z",
  });
}
