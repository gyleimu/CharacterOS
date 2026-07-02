import { describe, expect, it } from "vitest";
import {
  buildLongitudinalCommitSurface,
  buildLongitudinalFinalStateForCommit,
  buildLongitudinalRollbackPlan,
  computeLongitudinalRequestDigest,
  computeLongitudinalStateFingerprint,
  createLongitudinalSimulationId,
  evaluateLongitudinalCommitGovernance,
  stripFinalStateForPublicPreview,
  type LongitudinalCommitSurface,
} from "../../../src/core/life/finalStateForCommit";
import {
  runLongitudinalSimulation,
  type CompactStateSummary,
  type LongitudinalSimulationRequest,
  type LongitudinalSimulationResult,
} from "../../../src/core/life/longitudinalSimulation";
import type { LifeTickCommitResult } from "../../../src/core/life/lifeTickPersistence";
import { createCharacterPhysicsState, type CharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { neutralCoordinate } from "../../../src/core/personality/coordinate";

function char(id = "commit-char"): CharacterPhysicsState {
  return createCharacterPhysicsState({
    identity: { id, name: "Commit Test", description: "Commit surface test character.", tags: ["test"] },
  });
}

function request(overrides: Partial<LongitudinalSimulationRequest> = {}): LongitudinalSimulationRequest {
  return {
    characterId: "commit-char",
    totalHours: 12,
    stepHours: 4,
    seed: "commit-seed",
    commitPolicy: { enabled: true, commitDreams: true },
    ...overrides,
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

function stateWithGeneratedMemory(): CharacterPhysicsState {
  const state = char();
  state.memories.push({
    id: "life-dream-generated-1",
    content: "Dream residue: rain again (tone: calm)",
    vector: neutralCoordinate(),
    importance: 0.1,
    emotion: "calm",
    recency: 1,
    repetitionCount: 1,
    beliefEffect: "",
    timeStamp: "2026-06-28T00:00:00.000Z",
  });
  return state;
}

function resultWithCommit(baseState = char(), finalState = stateWithGeneratedMemory()): LongitudinalSimulationResult {
  const commitResult: LifeTickCommitResult = {
    applied: true,
    state: finalState,
    changes: [{
      path: "memories[0]",
      from: null,
      to: "Dream residue: rain again (tone: calm)",
      reason: "[step-0] Dream fragment \"rain again\" persisted as internal memory seed.",
    }],
    skipped: [{
      path: "lifeState.energyFatigue",
      from: null,
      to: { energy: 0.8, fatigue: 0.2 },
      reason: "[step-0] Energy/fatigue writeback not enabled (default: false).",
    }],
    warnings: [],
    reasons: ["1 dream memory seed(s) added."],
  };
  return {
    version: "v10.17",
    characterId: "commit-char",
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
      reasons: ["Commit: 1 changes, 1 skipped."],
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
    finalStateSummary: summary(finalState),
    warnings: [],
    reasons: ["Running 1 steps of 4h each (total: 4h)."],
  };
}

describe("V10.21 finalStateForCommit — fingerprints and digests", () => {
  it("computes deterministic request digests", () => {
    const first = computeLongitudinalRequestDigest(request());
    const second = computeLongitudinalRequestDigest(request());
    expect(first).toEqual(second);
    expect(first.algorithm).toBe("sha256");
  });

  it("request digest changes when seed changes", () => {
    const first = computeLongitudinalRequestDigest(request({ seed: "a" }));
    const second = computeLongitudinalRequestDigest(request({ seed: "b" }));
    expect(first.value).not.toEqual(second.value);
  });

  it("state fingerprint is stable for same state", () => {
    const state = char();
    expect(computeLongitudinalStateFingerprint(state)).toEqual(computeLongitudinalStateFingerprint(state));
  });

  it("state fingerprint changes when generated memory is appended", () => {
    const base = char();
    const final = stateWithGeneratedMemory();
    expect(computeLongitudinalStateFingerprint(base).value)
      .not.toEqual(computeLongitudinalStateFingerprint(final).value);
  });

  it("state fingerprint changes when biological nature changes", () => {
    const base = char();
    const changed = char();
    changed.biologicalNature.curiosity = 0.91;
    expect(computeLongitudinalStateFingerprint(base).value)
      .not.toEqual(computeLongitudinalStateFingerprint(changed).value);
  });

  it("state fingerprint changes when big five personality changes", () => {
    const base = char();
    const changed = char();
    changed.personality.openness = 0.91;
    expect(computeLongitudinalStateFingerprint(base).value)
      .not.toEqual(computeLongitudinalStateFingerprint(changed).value);
  });

  it("creates stable simulation ids from digest and base fingerprint", () => {
    const reqDigest = computeLongitudinalRequestDigest(request());
    const stateFp = computeLongitudinalStateFingerprint(char());
    const a = createLongitudinalSimulationId({ characterId: "commit-char", requestDigest: reqDigest, baseStateFingerprint: stateFp });
    const b = createLongitudinalSimulationId({ characterId: "commit-char", requestDigest: reqDigest, baseStateFingerprint: stateFp });
    expect(a).toEqual(b);
    expect(a).toMatch(/^longsim_/);
  });
});

describe("V10.21 finalStateForCommit — commit surface", () => {
  it("builds compact commit surface from longitudinal result", () => {
    const surface = buildLongitudinalCommitSurface(resultWithCommit());
    expect(surface.applied).toBe(true);
    expect(surface.changes).toHaveLength(1);
    expect(surface.skipped).toHaveLength(1);
    expect(surface.changes[0]!.source).toBe("dream");
    expect(surface.changes[0]!.generatedId).toBe("life-dream-generated-1");
    expect(surface.skipped[0]!.source).toBe("energy_fatigue");
  });

  it("does not expose full commitResult state in the commit surface", () => {
    const surface = buildLongitudinalCommitSurface(resultWithCommit());
    const text = JSON.stringify(surface);
    expect(text).not.toContain('"clusters"');
    expect(text).not.toContain('"proceduralRoutines"');
    expect(text).not.toContain('"finalState"');
  });

  it("rollback plan contains generated memory ids only", () => {
    const baseFp = computeLongitudinalStateFingerprint(char());
    const finalFp = computeLongitudinalStateFingerprint(stateWithGeneratedMemory());
    const plan = buildLongitudinalRollbackPlan({
      simulationId: "sim1",
      commitSurface: buildLongitudinalCommitSurface(resultWithCommit()),
      baseStateFingerprint: baseFp,
      finalStateFingerprint: finalFp,
    });
    expect(plan.type).toBe("remove_generated_memories");
    expect(plan.generatedMemoryIds).toEqual(["life-dream-generated-1"]);
    expect(plan.staleWritePolicy).toBe("block_if_changed");
  });
});

describe("V10.21 finalStateForCommit — governance and preview stripping", () => {
  it("passes governance for explicit commit with no self-action changes", () => {
    const decision = evaluateLongitudinalCommitGovernance({
      finalState: stateWithGeneratedMemory(),
      commitSurface: buildLongitudinalCommitSurface(resultWithCommit()),
      commitPolicy: { enabled: true, commitDreams: true },
    });
    expect(decision.status).toBe("pass");
    expect(decision.blockers).toHaveLength(0);
  });

  it("blocks governance when commitPolicy is disabled", () => {
    const decision = evaluateLongitudinalCommitGovernance({
      finalState: stateWithGeneratedMemory(),
      commitSurface: buildLongitudinalCommitSurface(resultWithCommit()),
      commitPolicy: { enabled: false },
    });
    expect(decision.status).toBe("block");
    expect(decision.blockers.join(" ")).toContain("commitPolicy.enabled");
  });

  it("blocks governance when self-action candidate appears in surface", () => {
    const surface: LongitudinalCommitSurface = {
      ...buildLongitudinalCommitSurface(resultWithCommit()),
      changes: [{
        stepIndex: 0,
        source: "self_action_candidate",
        path: "memories[0]",
        generatedId: "life-sac-1",
        from: null,
        to: "Action tendency",
        reason: "Self-action candidate trace seed should not be final committed.",
      }],
    };
    const decision = evaluateLongitudinalCommitGovernance({
      finalState: stateWithGeneratedMemory(),
      commitSurface: surface,
      commitPolicy: { enabled: true },
    });
    expect(decision.status).toBe("block");
    expect(decision.blockers.join(" ")).toContain("self-action");
  });

  it("builds private handoff with finalState and public preview without finalState", () => {
    const base = char();
    const final = stateWithGeneratedMemory();
    const handoff = buildLongitudinalFinalStateForCommit({
      characterId: "commit-char",
      request: request(),
      baseState: base,
      finalState: final,
      result: resultWithCommit(base, final),
      timestamp: "2026-06-28T00:00:00.000Z",
    });
    expect(handoff.finalState).toBe(final);
    expect(handoff.auditDraft.generatedMemoryIds).toEqual(["life-dream-generated-1"]);

    const preview = stripFinalStateForPublicPreview(handoff);
    expect("finalState" in preview).toBe(false);
    expect(JSON.stringify(preview)).not.toContain('"finalState"');
    expect(preview.auditSummary.generatedMemoryCount).toBe(1);
    expect(preview.rollbackSummary.generatedMemoryCount).toBe(1);
  });

  it("does not mutate base or final states while building handoff", () => {
    const base = char();
    const final = stateWithGeneratedMemory();
    const beforeBase = computeLongitudinalStateFingerprint(base);
    const beforeFinal = computeLongitudinalStateFingerprint(final);
    buildLongitudinalFinalStateForCommit({
      characterId: "commit-char",
      request: request(),
      baseState: base,
      finalState: final,
      result: resultWithCommit(base, final),
      timestamp: "2026-06-28T00:00:00.000Z",
    });
    expect(computeLongitudinalStateFingerprint(base)).toEqual(beforeBase);
    expect(computeLongitudinalStateFingerprint(final)).toEqual(beforeFinal);
  });

  it("keeps current simulation API behavior separate from finalStateForCommit helpers", () => {
    const result = runLongitudinalSimulation(char(), request({ commitPolicy: { enabled: false } }));
    expect(result.applied).toBe(false);
    const handoff = buildLongitudinalFinalStateForCommit({
      characterId: "commit-char",
      request: request({ commitPolicy: { enabled: false } }),
      baseState: char(),
      finalState: char(),
      result,
      timestamp: "2026-06-28T00:00:00.000Z",
    });
    expect(handoff.governance.status).toBe("block");
    expect(stripFinalStateForPublicPreview(handoff).governance.status).toBe("block");
  });
});
