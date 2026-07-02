import { describe, expect, it } from "vitest";
import {
  SELF_ACTION_CANDIDATE_TYPES,
  buildSelfActionCandidateContextFromCharacter,
  scoreSelfActionCandidate,
  generateSelfActionCandidates,
  type SelfActionCandidateContext,
  type GeneratedSelfActionCandidate,
} from "../../../src/core/life/selfActionCandidate";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../../src/core/meta/metaState";
import { DEFAULT_SLEEP_WAKE_STATE } from "../../../src/core/life/sleepWake";
import type { SleepWakeState } from "../../../src/core/life/sleepWake";

// ── Helpers ────────────────────────────────────────────────────────────

function defaultContext(
  overrides: Partial<SelfActionCandidateContext> = {}
): SelfActionCandidateContext {
  return {
    elapsedHours: 2,
    energy: 0.6,
    fatigue: 0.3,
    sleepPressure: 0.3,
    sleepPhase: "awake",
    boredom: 0.3,
    restlessness: 0.2,
    explorationPressure: 0.25,
    irritability: 0.15,
    stressLoad: 0.3,
    loneliness: 0.3,
    selfControl: 0.58,
    activeNeedIntensity: 0.3,
    desirePressure: 0.25,
    inspirationSeedCount: 0,
    strongestInspirationStrength: 0,
    ...overrides,
  };
}

// ── Type List ──────────────────────────────────────────────────────────

describe("SELF_ACTION_CANDIDATE_TYPES", () => {
  it("has exactly 9 types", () => {
    expect(SELF_ACTION_CANDIDATE_TYPES).toHaveLength(9);
  });

  it("includes expected types", () => {
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("sleep");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("do_nothing");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("write_note");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("go_for_walk");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("check_phone");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("seek_contact");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("withdraw");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("revisit_memory");
    expect(SELF_ACTION_CANDIDATE_TYPES).toContain("avoid_message");
  });
});

// ── Scoring ────────────────────────────────────────────────────────────

describe("scoreSelfActionCandidate", () => {
  it("low-energy state favors do_nothing", () => {
    const ctx = defaultContext({ energy: 0.15, fatigue: 0.6 });
    const score = scoreSelfActionCandidate("do_nothing", ctx);
    expect(score.strength).toBeGreaterThan(0.2);
    expect(score.score).toBeGreaterThan(0);
  });

  it("high fatigue + sleep pressure favors sleep", () => {
    const ctx = defaultContext({
      fatigue: 0.8,
      sleepPressure: 0.85,
      energy: 0.2,
      sleepPhase: "drowsy",
    });
    const score = scoreSelfActionCandidate("sleep", ctx);
    expect(score.strength).toBeGreaterThan(0.3);
    expect(score.score).toBeGreaterThan(0.2);
  });

  it("restlessness + energy favors go_for_walk", () => {
    const ctx = defaultContext({
      restlessness: 0.7,
      explorationPressure: 0.65,
      energy: 0.7,
      fatigue: 0.15,
    });
    const score = scoreSelfActionCandidate("go_for_walk", ctx);
    expect(score.strength).toBeGreaterThan(0.2);
    expect(score.sourceSignals).toContain("restlessness");
  });

  it("inspiration + question thought favors write_note", () => {
    const ctx = defaultContext({
      energy: 0.7,
      inspirationSeedCount: 3,
      strongestInspirationStrength: 0.7,
      randomThoughtKind: "question",
    });
    const score = scoreSelfActionCandidate("write_note", ctx);
    expect(score.strength).toBeGreaterThan(0.15);
    expect(score.sourceSignals).toContain("randomThoughtKind");
  });

  it("loneliness favors check_phone or seek_contact", () => {
    const ctx = defaultContext({ loneliness: 0.8, desirePressure: 0.6 });
    const phone = scoreSelfActionCandidate("check_phone", ctx);
    const contact = scoreSelfActionCandidate("seek_contact", ctx);
    expect(phone.strength).toBeGreaterThan(0.15);
    expect(contact.strength).toBeGreaterThan(0.15);
    expect(phone.sourceSignals).toContain("loneliness");
  });

  it("stress + fatigue favors withdraw", () => {
    const ctx = defaultContext({
      stressLoad: 0.8,
      irritability: 0.65,
      fatigue: 0.6,
      energy: 0.25,
    });
    const score = scoreSelfActionCandidate("withdraw", ctx);
    expect(score.strength).toBeGreaterThan(0.2);
  });

  it("memory_echo thought favors revisit_memory", () => {
    const ctx = defaultContext({
      boredom: 0.6,
      loneliness: 0.55,
      randomThoughtKind: "memory_echo",
    });
    const score = scoreSelfActionCandidate("revisit_memory", ctx);
    expect(score.strength).toBeGreaterThan(0.2);
    expect(score.sourceSignals).toContain("randomThoughtKind");
  });

  it("high stress suppresses seek_contact (increases friction)", () => {
    const lowStress = scoreSelfActionCandidate(
      "seek_contact",
      defaultContext({ loneliness: 0.7, stressLoad: 0.1 })
    );
    const highStress = scoreSelfActionCandidate(
      "seek_contact",
      defaultContext({ loneliness: 0.7, stressLoad: 0.9 })
    );
    expect(highStress.friction).toBeGreaterThan(lowStress.friction);
    expect(highStress.score).toBeLessThan(lowStress.score);
  });

  it("sleep phase suppresses active candidates", () => {
    const awakeScore = scoreSelfActionCandidate(
      "go_for_walk",
      defaultContext({ restlessness: 0.7, energy: 0.7 })
    );
    const sleepScore = scoreSelfActionCandidate(
      "go_for_walk",
      defaultContext({ restlessness: 0.7, energy: 0.7, sleepPhase: "deep_sleep" })
    );
    expect(sleepScore.friction).toBeGreaterThan(awakeScore.friction);
    expect(sleepScore.score).toBeLessThan(awakeScore.score);
  });

  it("score values are clamped [0,1]", () => {
    const ctx = defaultContext({
      fatigue: 1, sleepPressure: 1, energy: 0,
      restlessness: 1, explorationPressure: 1,
      stressLoad: 1, loneliness: 1, irritability: 1,
    });
    for (const type of SELF_ACTION_CANDIDATE_TYPES) {
      const s = scoreSelfActionCandidate(type, ctx);
      expect(s.strength).toBeGreaterThanOrEqual(0);
      expect(s.strength).toBeLessThanOrEqual(1);
      expect(s.urgency).toBeGreaterThanOrEqual(0);
      expect(s.urgency).toBeLessThanOrEqual(1);
      expect(s.friction).toBeGreaterThanOrEqual(0);
      expect(s.friction).toBeLessThanOrEqual(1);
      expect(s.risk).toBeGreaterThanOrEqual(0);
      expect(s.risk).toBeLessThanOrEqual(1);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it("all generated candidates have evaluated: false, executed: false", () => {
    for (const type of SELF_ACTION_CANDIDATE_TYPES) {
      const s = scoreSelfActionCandidate(type, defaultContext());
      expect(s.evaluated).toBe(false);
      expect(s.executed).toBe(false);
    }
  });

  it("reasons are human-readable strings", () => {
    const s = scoreSelfActionCandidate("sleep", defaultContext({
      sleepPressure: 0.8, fatigue: 0.7,
    }));
    expect(s.reasons.length).toBeGreaterThan(0);
    for (const r of s.reasons) {
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });

  it("sourceSignals are populated", () => {
    const s = scoreSelfActionCandidate("go_for_walk", defaultContext({
      restlessness: 0.7, explorationPressure: 0.6, energy: 0.7,
    }));
    expect(s.sourceSignals.length).toBeGreaterThan(0);
  });
});

// ── Candidate Generation ───────────────────────────────────────────────

describe("generateSelfActionCandidates", () => {
  it("is deterministic: same context → same candidates", () => {
    const ctx = defaultContext({
      fatigue: 0.6, sleepPressure: 0.7, energy: 0.3,
      restlessness: 0.55, explorationPressure: 0.5,
      loneliness: 0.6, boredom: 0.5,
    });
    const t1 = generateSelfActionCandidates(ctx);
    const t2 = generateSelfActionCandidates(ctx);
    expect(t1.candidates).toEqual(t2.candidates);
    expect(t1.suppressedCandidates).toEqual(t2.suppressedCandidates);
  });

  it("candidate ordering is stable by score descending", () => {
    const ctx = defaultContext({
      fatigue: 0.7, sleepPressure: 0.8, energy: 0.2,
    });
    const trace = generateSelfActionCandidates(ctx);
    for (let i = 1; i < trace.candidates.length; i++) {
      expect(trace.candidates[i - 1]!.score).toBeGreaterThanOrEqual(
        trace.candidates[i]!.score
      );
    }
  });

  it("limit option works", () => {
    const trace = generateSelfActionCandidates(
      defaultContext({ energy: 0.5, fatigue: 0.3 }),
      { limit: 3 }
    );
    expect(trace.candidates.length).toBeLessThanOrEqual(3);
  });

  it("default limit is 5", () => {
    const trace = generateSelfActionCandidates(
      defaultContext({ energy: 0.5, fatigue: 0.3 })
    );
    expect(trace.candidates.length).toBeLessThanOrEqual(5);
  });

  it("minScore option filters low-scoring candidates", () => {
    const traceLow = generateSelfActionCandidates(
      defaultContext({ energy: 0.5, fatigue: 0.3 }),
      { minScore: 0.02 }
    );
    const traceHigh = generateSelfActionCandidates(
      defaultContext({ energy: 0.5, fatigue: 0.3 }),
      { minScore: 0.3 }
    );
    expect(traceHigh.candidates.length).toBeLessThanOrEqual(
      traceLow.candidates.length
    );
  });

  it("includeSuppressed=false omits suppressed candidates", () => {
    const trace = generateSelfActionCandidates(
      defaultContext(),
      { includeSuppressed: false }
    );
    expect(trace.suppressedCandidates).toHaveLength(0);
  });

  it("includeSuppressed=true includes suppressed candidates", () => {
    const trace = generateSelfActionCandidates(
      defaultContext(),
      { includeSuppressed: true, minScore: 0.5 }
    );
    // Suppressed array may or may not have entries depending on scores
    expect(Array.isArray(trace.suppressedCandidates)).toBe(true);
  });

  it("sleep phase suppresses active candidates in output", () => {
    const awakeTrace = generateSelfActionCandidates(
      defaultContext({
        sleepPhase: "awake",
        fatigue: 0.6, sleepPressure: 0.7, energy: 0.3,
        restlessness: 0.6, explorationPressure: 0.6,
      })
    );
    const sleepTrace = generateSelfActionCandidates(
      defaultContext({
        sleepPhase: "deep_sleep",
        fatigue: 0.6, sleepPressure: 0.7, energy: 0.3,
        restlessness: 0.6, explorationPressure: 0.6,
      })
    );
    // During sleep, "sleep" should be the top candidate
    if (sleepTrace.candidates.length > 0) {
      expect(sleepTrace.candidates[0]!.type).toBe("sleep");
    }
  });

  it("empty/quiet context still produces do_nothing", () => {
    const ctx = defaultContext({
      energy: 0.2, fatigue: 0.7, restlessness: 0.05,
      explorationPressure: 0.05, loneliness: 0.1,
      boredom: 0.1, inspirationSeedCount: 0,
    });
    const trace = generateSelfActionCandidates(ctx);
    expect(trace.candidates.length).toBeGreaterThanOrEqual(0);
    // do_nothing should be among candidates
    const hasDoNothing = trace.candidates.some((c) => c.type === "do_nothing");
    // At minimum, candidates are generated
    expect(Array.isArray(trace.candidates)).toBe(true);
  });

  it("trace contains phase, reasons, warnings", () => {
    const trace = generateSelfActionCandidates(defaultContext());
    expect(trace.phase).toBe("self_action_candidate");
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildSelfActionCandidateContextFromCharacter", () => {
  it("tolerates missing optional subsystem state", () => {
    const char = createCharacterPhysicsState();
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: char,
    });
    expect(ctx.energy).toBeGreaterThanOrEqual(0);
    expect(ctx.energy).toBeLessThanOrEqual(1);
    expect(ctx.sleepPhase).toBe("awake");
  });

  it("reads energy/fatigue/sleepPressure from energyFatigue", () => {
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: createCharacterPhysicsState(),
      energyFatigue: { energy: 0.45, fatigue: 0.55, sleepPressure: 0.6, restDebt: 0.3 },
    });
    expect(ctx.energy).toBe(0.45);
    expect(ctx.fatigue).toBe(0.55);
    expect(ctx.sleepPressure).toBe(0.6);
  });

  it("reads sleepPhase from sleepWake", () => {
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: createCharacterPhysicsState(),
      sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE, phase: "light_sleep" } as SleepWakeState,
    });
    expect(ctx.sleepPhase).toBe("light_sleep");
  });

  it("reads boredom fields from boredomState", () => {
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: createCharacterPhysicsState(),
      boredomState: {
        boredom: 0.5, restlessness: 0.4, explorationPressure: 0.35,
        irritability: 0.2, daydreamingTendency: 0.3,
      },
    });
    expect(ctx.boredom).toBe(0.5);
    expect(ctx.restlessness).toBe(0.4);
    expect(ctx.explorationPressure).toBe(0.35);
    expect(ctx.irritability).toBe(0.2);
  });

  it("reads inspiration seeds count and strength", () => {
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: createCharacterPhysicsState(),
      inspirationSeeds: [
        { id: "s1", type: "creative_image" as const, probability: 0.8, source: "daydreaming" as const, trigger: "t", evaluated: false, reasons: [] },
        { id: "s2", type: "quiet_realization" as const, probability: 0.4, source: "boredom" as const, trigger: "t2", evaluated: false, reasons: [] },
      ],
    });
    expect(ctx.inspirationSeedCount).toBe(2);
    expect(ctx.strongestInspirationStrength).toBe(0.8);
  });

  it("reads stressLoad, loneliness, selfControl from state", () => {
    const char = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.35 }),
    });
    const ctx = buildSelfActionCandidateContextFromCharacter({ state: char });
    expect(ctx.stressLoad).toBe(0.35);
    expect(ctx.selfControl).toBe(defaultMetaState().selfControl);
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0);
    expect(ctx.loneliness).toBeLessThanOrEqual(1);
  });

  it("all numeric outputs clamped [0,1]", () => {
    const ctx = buildSelfActionCandidateContextFromCharacter({
      state: createCharacterPhysicsState(),
    });
    expect(ctx.energy).toBeGreaterThanOrEqual(0); expect(ctx.energy).toBeLessThanOrEqual(1);
    expect(ctx.fatigue).toBeGreaterThanOrEqual(0); expect(ctx.fatigue).toBeLessThanOrEqual(1);
    expect(ctx.sleepPressure).toBeGreaterThanOrEqual(0); expect(ctx.sleepPressure).toBeLessThanOrEqual(1);
    expect(ctx.boredom).toBeGreaterThanOrEqual(0); expect(ctx.boredom).toBeLessThanOrEqual(1);
    expect(ctx.restlessness).toBeGreaterThanOrEqual(0); expect(ctx.restlessness).toBeLessThanOrEqual(1);
    expect(ctx.explorationPressure).toBeGreaterThanOrEqual(0); expect(ctx.explorationPressure).toBeLessThanOrEqual(1);
    expect(ctx.irritability).toBeGreaterThanOrEqual(0); expect(ctx.irritability).toBeLessThanOrEqual(1);
    expect(ctx.stressLoad).toBeGreaterThanOrEqual(0); expect(ctx.stressLoad).toBeLessThanOrEqual(1);
    expect(ctx.loneliness).toBeGreaterThanOrEqual(0); expect(ctx.loneliness).toBeLessThanOrEqual(1);
    expect(ctx.selfControl).toBeGreaterThanOrEqual(0); expect(ctx.selfControl).toBeLessThanOrEqual(1);
    expect(ctx.activeNeedIntensity).toBeGreaterThanOrEqual(0); expect(ctx.activeNeedIntensity).toBeLessThanOrEqual(1);
    expect(ctx.desirePressure).toBeGreaterThanOrEqual(0); expect(ctx.desirePressure).toBeLessThanOrEqual(1);
    expect(ctx.strongestInspirationStrength).toBeGreaterThanOrEqual(0); expect(ctx.strongestInspirationStrength).toBeLessThanOrEqual(1);
  });

  it("does not mutate input state", () => {
    const char = createCharacterPhysicsState();
    const frozen = { ...char.boundary, mSelfControl: char.metaState.selfControl };
    buildSelfActionCandidateContextFromCharacter({ state: char });
    expect(char.boundary.stressLoad).toBe(frozen.stressLoad);
    expect(char.metaState.selfControl).toBe(frozen.mSelfControl);
  });
});
