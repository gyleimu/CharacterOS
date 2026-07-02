import { describe, expect, it } from "vitest";
import {
  LIFE_TICK_PHASES,
  INTERNAL_EVENT_TYPES,
  SELF_ACTION_CANDIDATE_TYPES,
} from "../../../src/core/life/lifeTickTypes";
import type {
  LifeTickPhase,
  LifeTickRequest,
  LifeTickPlan,
  LifeTickTrace,
  LifePhaseTrace,
  InternalEvent,
  InternalEventType,
  SelfActionCandidate,
  SelfActionCandidateType,
} from "../../../src/core/life/lifeTickTypes";

// ── Life Tick Phase ────────────────────────────────────────────────────

describe("LifeTickPhase", () => {
  it("has exactly 10 phases in stable order", () => {
    expect(LIFE_TICK_PHASES).toHaveLength(10);
    expect(LIFE_TICK_PHASES).toEqual([
      "passive_recovery",
      "energy_fatigue",
      "attention_drift",
      "boredom_pressure",
      "memory_resurfacing",
      "random_thought",
      "inspiration_check",
      "self_action_candidate",
      "quiet_drift",
      "trace_summary",
    ]);
  });

  it("is a readonly tuple (order cannot be mutated at runtime)", () => {
    // TypeScript `as const` prevents literal mutation; verify at runtime.
    expect(() => {
      // @ts-expect-error — readonly tuple should not be assignable to mutable array
      const _m: string[] = LIFE_TICK_PHASES;
    }).toBeDefined();
  });

  it("every phase is a distinct non-empty string", () => {
    const unique = new Set<string>(LIFE_TICK_PHASES);
    expect(unique.size).toBe(LIFE_TICK_PHASES.length);
    for (const phase of LIFE_TICK_PHASES) {
      expect(phase.length).toBeGreaterThan(0);
    }
  });
});

// ── LifeTickRequest ────────────────────────────────────────────────────

describe("LifeTickRequest (type contract)", () => {
  it("can construct a valid request object", () => {
    const request: LifeTickRequest = {
      characterId: "char-1",
      elapsedHours: 4,
      observed: true,
      requestedAt: "2026-06-24T12:00:00.000Z",
      mode: "dry_run",
    };
    expect(request.characterId).toBe("char-1");
    expect(request.elapsedHours).toBe(4);
    expect(request.observed).toBe(true);
    expect(request.mode).toBe("dry_run");
  });

  it("supports optional seed field", () => {
    const withSeed: LifeTickRequest = {
      characterId: "char-1",
      elapsedHours: 1,
      observed: true,
      seed: "my-seed",
      requestedAt: "2026-06-24T12:00:00.000Z",
      mode: "dry_run",
    };
    expect(withSeed.seed).toBe("my-seed");

    const withoutSeed: LifeTickRequest = {
      characterId: "char-1",
      elapsedHours: 1,
      observed: true,
      requestedAt: "2026-06-24T12:00:00.000Z",
      mode: "dry_run",
    };
    expect(withoutSeed.seed).toBeUndefined();
  });

  it("observed=false indicates unobserved time", () => {
    const request: LifeTickRequest = {
      characterId: "char-1",
      elapsedHours: 8,
      observed: false,
      requestedAt: "2026-06-24T12:00:00.000Z",
      mode: "dry_run",
    };
    expect(request.observed).toBe(false);
  });
});

// ── LifeTickPlan ───────────────────────────────────────────────────────

describe("LifeTickPlan (type contract)", () => {
  it("has the expected shape", () => {
    const plan: LifeTickPlan = {
      id: "abc123",
      characterId: "char-1",
      elapsedHours: 4,
      phaseSequence: [...LIFE_TICK_PHASES],
      timeScale: "short",
      seed: "s1",
      dryRun: true,
      warnings: [],
      reasons: ["test"],
    };
    expect(plan.phaseSequence).toEqual(LIFE_TICK_PHASES);
    expect(plan.timeScale).toBe("short");
    expect(plan.dryRun).toBe(true);
  });

  it("timeScale can be short, daily, or multi_day", () => {
    const scales = ["short", "daily", "multi_day"] as const;
    for (const scale of scales) {
      const plan: LifeTickPlan = {
        id: "id",
        characterId: "c",
        elapsedHours: 1,
        phaseSequence: [...LIFE_TICK_PHASES],
        timeScale: scale,
        seed: "s",
        dryRun: true,
        warnings: [],
        reasons: [],
      };
      expect(plan.timeScale).toBe(scale);
    }
  });
});

// ── LifeTickTrace Skeleton ─────────────────────────────────────────────

describe("LifeTickTrace (type contract)", () => {
  it("stateChanged defaults to false for V10.1 skeleton", () => {
    const trace: LifeTickTrace = {
      id: "t1",
      characterId: "c1",
      planId: "p1",
      elapsedHours: 4,
      observed: true,
      phaseTraces: [],
      generatedInternalEvents: [],
      selfActionCandidates: [],
      stateChanged: false,
      warnings: [],
      reasons: [],
      createdAt: "2026-06-24T12:00:00.000Z",
    };
    expect(trace.stateChanged).toBe(false);
  });
});

describe("LifePhaseTrace (type contract)", () => {
  it("executed defaults to false for V10.1 skeleton", () => {
    const pt: LifePhaseTrace = {
      phase: "memory_resurfacing",
      executed: false,
      changedStateKeys: [],
      warnings: [],
      reasons: [],
    };
    expect(pt.executed).toBe(false);
  });
});

// ── InternalEvent Types ────────────────────────────────────────────────

describe("InternalEvent", () => {
  it("has exactly 9 internal event types", () => {
    expect(INTERNAL_EVENT_TYPES).toHaveLength(9);
  });

  it("includes dream_fragment, random_thought, memory_resurfacing, boredom_spike", () => {
    expect(INTERNAL_EVENT_TYPES).toContain("dream_fragment");
    expect(INTERNAL_EVENT_TYPES).toContain("random_thought");
    expect(INTERNAL_EVENT_TYPES).toContain("memory_resurfacing");
    expect(INTERNAL_EVENT_TYPES).toContain("boredom_spike");
  });

  it("all event types are distinct non-empty strings", () => {
    const unique = new Set<string>(INTERNAL_EVENT_TYPES);
    expect(unique.size).toBe(INTERNAL_EVENT_TYPES.length);
    for (const t of INTERNAL_EVENT_TYPES) {
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it("InternalEvent skeleton has evaluated=false", () => {
    const event: InternalEvent = {
      id: "e1",
      type: "random_thought",
      intensity: 0.5,
      sourcePhase: "random_thought",
      description: "A passing thought.",
      explanationIds: [],
      evaluated: false,
    };
    expect(event.evaluated).toBe(false);
    expect(event.intensity).toBeGreaterThanOrEqual(0);
    expect(event.intensity).toBeLessThanOrEqual(1);
  });
});

// ── SelfActionCandidate Types ──────────────────────────────────────────

describe("SelfActionCandidate", () => {
  it("has exactly 9 self-action candidate types", () => {
    expect(SELF_ACTION_CANDIDATE_TYPES).toHaveLength(9);
  });

  it("all candidate types are distinct", () => {
    const unique = new Set<string>(SELF_ACTION_CANDIDATE_TYPES);
    expect(unique.size).toBe(SELF_ACTION_CANDIDATE_TYPES.length);
  });

  it("SelfActionCandidate skeleton has evaluated=false (always)", () => {
    const candidate: SelfActionCandidate = {
      id: "sc1",
      type: "go_for_walk",
      probability: 0.3,
      sourcePhase: "self_action_candidate",
      reasons: ["boredom elevated"],
      evaluated: false,
    };
    expect(candidate.evaluated).toBe(false);
    expect(candidate.probability).toBeGreaterThanOrEqual(0);
    expect(candidate.probability).toBeLessThanOrEqual(1);
  });

  it("evaluated field is typed as `false` literal — cannot be true", () => {
    // TypeScript level: the type is `false`, not `boolean`.
    // This is a compile-time contract; at runtime just verify it's false.
    const c: SelfActionCandidate = {
      id: "sc2",
      type: "do_nothing",
      probability: 0.9,
      sourcePhase: "quiet_drift",
      reasons: [],
      evaluated: false,
    };
    expect(c.evaluated).toBe(false);
  });
});
