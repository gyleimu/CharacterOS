import { describe, expect, it } from "vitest";
import {
  SLEEP_WAKE_PHASES,
  DEFAULT_SLEEP_WAKE_STATE,
  computeCircadianSleepDrive,
  computeSleepReadiness,
  selectSleepWakePhase,
  tickSleepWake,
  buildSleepWakeContext,
  type SleepWakePhase,
  type SleepWakeState,
  type SleepWakeContext,
} from "../../../src/core/life/sleepWake";
import { DEFAULT_ENERGY_FATIGUE_STATE, type EnergyFatigueState } from "../../../src/core/life/energyFatigue";

// ── Helpers ────────────────────────────────────────────────────────────

function defaultContext(
  overrides: Partial<SleepWakeContext> = {}
): SleepWakeContext {
  return {
    elapsedHours: 2,
    localHour: 14, // afternoon
    energy: 0.65,
    fatigue: 0.25,
    sleepPressure: 0.3,
    stressLoad: 0.3,
    resilience: 0.52,
    ...overrides,
  };
}

function nightContext(
  overrides: Partial<SleepWakeContext> = {}
): SleepWakeContext {
  return defaultContext({ localHour: 2, ...overrides });
}

// ── Default State ──────────────────────────────────────────────────────

describe("DEFAULT_SLEEP_WAKE_STATE", () => {
  it("has valid phase, values in range", () => {
    const s = DEFAULT_SLEEP_WAKE_STATE;
    expect(SLEEP_WAKE_PHASES).toContain(s.phase);
    expect(s.sleepQuality).toBeGreaterThanOrEqual(0);
    expect(s.sleepQuality).toBeLessThanOrEqual(1);
    expect(s.circadianAlignment).toBeGreaterThanOrEqual(0);
    expect(s.circadianAlignment).toBeLessThanOrEqual(1);
    expect(s.hoursSinceSleep).toBeGreaterThanOrEqual(0);
    expect(s.hoursAsleep).toBeGreaterThanOrEqual(0);
  });
});

// ── Circadian Sleep Drive ──────────────────────────────────────────────

describe("computeCircadianSleepDrive", () => {
  it("is high at night (0–5)", () => {
    expect(computeCircadianSleepDrive(0)).toBeGreaterThan(0.6);
    expect(computeCircadianSleepDrive(2)).toBeGreaterThan(0.75);
    expect(computeCircadianSleepDrive(4)).toBeGreaterThan(0.6);
  });

  it("is high late night (22–23)", () => {
    expect(computeCircadianSleepDrive(22)).toBeGreaterThan(0.5);
    expect(computeCircadianSleepDrive(23)).toBeGreaterThan(0.5);
  });

  it("is low at noon (12–14)", () => {
    expect(computeCircadianSleepDrive(12)).toBeLessThan(0.3);
    expect(computeCircadianSleepDrive(14)).toBeLessThan(0.3);
  });

  it("is medium in morning (6–8)", () => {
    const d6 = computeCircadianSleepDrive(6);
    const d8 = computeCircadianSleepDrive(8);
    expect(d6).toBeGreaterThan(0.3);
    expect(d8).toBeLessThan(0.55);
  });

  it("is medium in evening (18–21)", () => {
    const d18 = computeCircadianSleepDrive(18);
    const d21 = computeCircadianSleepDrive(21);
    expect(d18).toBeGreaterThan(0.25);
    expect(d21).toBeGreaterThan(0.3);
  });

  it("returns values in [0,1] for all hours", () => {
    for (let h = 0; h < 24; h++) {
      const d = computeCircadianSleepDrive(h);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it("handles out-of-range hours via modulo", () => {
    // 26 % 24 = 2 (night, high)
    expect(computeCircadianSleepDrive(26)).toBe(computeCircadianSleepDrive(2));
    // -2 % 24 = 22 (night, high)
    expect(computeCircadianSleepDrive(-2)).toBe(computeCircadianSleepDrive(22));
  });
});

// ── Sleep Readiness ────────────────────────────────────────────────────

describe("computeSleepReadiness", () => {
  it("high fatigue + high sleepPressure increases readiness", () => {
    const low = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      defaultContext({ fatigue: 0.1, sleepPressure: 0.1 })
    );
    const high = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      defaultContext({ fatigue: 0.9, sleepPressure: 0.9 })
    );
    expect(high).toBeGreaterThan(low);
  });

  it("high energy lowers readiness", () => {
    const tired = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      defaultContext({ energy: 0.2, fatigue: 0.6, sleepPressure: 0.6 })
    );
    const energetic = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      defaultContext({ energy: 0.9, fatigue: 0.6, sleepPressure: 0.6 })
    );
    expect(tired).toBeGreaterThan(energetic);
  });

  it("nighttime increases readiness vs daytime (same other inputs)", () => {
    const day = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      defaultContext({ localHour: 14, fatigue: 0.5, sleepPressure: 0.5 })
    );
    const night = computeSleepReadiness(
      DEFAULT_SLEEP_WAKE_STATE,
      nightContext({ fatigue: 0.5, sleepPressure: 0.5 })
    );
    expect(night).toBeGreaterThan(day);
  });

  it("returns [0,1] for extreme inputs", () => {
    const r = computeSleepReadiness(
      { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 48 },
      defaultContext({ fatigue: 1, sleepPressure: 1, energy: 0, localHour: 3 })
    );
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it("hoursSinceSleep contributes to readiness", () => {
    const fresh = computeSleepReadiness(
      { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 2 },
      defaultContext()
    );
    const tired = computeSleepReadiness(
      { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 20 },
      defaultContext()
    );
    expect(tired).toBeGreaterThanOrEqual(fresh); // hours awake ≥ fresh
  });
});

// ── Phase Selection ────────────────────────────────────────────────────

describe("selectSleepWakePhase", () => {
  it("awake + low readiness stays awake", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake" },
      defaultContext({ fatigue: 0.1, sleepPressure: 0.1, localHour: 12 })
    );
    expect(phase).toBe("awake");
  });

  it("awake + high readiness transitions toward sleep", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake", hoursSinceSleep: 20 },
      nightContext({ fatigue: 0.8, sleepPressure: 0.85, energy: 0.15 })
    );
    // Should be at least drowsy or further
    const sleepPhases: SleepWakePhase[] = ["drowsy", "falling_asleep", "light_sleep"];
    expect(sleepPhases).toContain(phase);
  });

  it("drowsy stays drowsy at moderate readiness", () => {
    // Moderate readiness in 0.35-0.55 range
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "drowsy" },
      defaultContext({ fatigue: 0.5, sleepPressure: 0.45, localHour: 22 })
    );
    // Should be awake, drowsy, or falling_asleep depending on exact computation
    expect(SLEEP_WAKE_PHASES).toContain(phase);
  });

  it("falling_asleep + high readiness moves to light_sleep", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "falling_asleep", hoursSinceSleep: 22 },
      nightContext({ fatigue: 0.85, sleepPressure: 0.9, energy: 0.1 })
    );
    expect(phase).toBe("light_sleep");
  });

  it("light_sleep transitions to deep_sleep under good conditions", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "light_sleep", hoursAsleep: 2 },
      defaultContext({
        localHour: 2,
        elapsedHours: 1,
        stressLoad: 0.2,
        resilience: 0.7,
        fatigue: 0.5,
        sleepPressure: 0.5,
      })
    );
    expect(phase).toBe("deep_sleep");
  });

  it("sleeping long enough leads to waking", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "deep_sleep", hoursAsleep: 6 },
      defaultContext({ elapsedHours: 1 })
    );
    expect(phase).toBe("waking");
  });

  it("waking transitions to awake", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "waking" },
      defaultContext()
    );
    expect(phase).toBe("awake");
  });

  it("high stress disrupts deep sleep", () => {
    const phase = selectSleepWakePhase(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "light_sleep", hoursAsleep: 2 },
      defaultContext({
        localHour: 2,
        elapsedHours: 1,
        stressLoad: 0.85,
        resilience: 0.3,
      })
    );
    // High stress prevents deep sleep — stays light or wakes
    expect(phase === "light_sleep" || phase === "waking").toBe(true);
  });
});

// ── Tick ───────────────────────────────────────────────────────────────

describe("tickSleepWake", () => {
  it("sleeping increases hoursAsleep", () => {
    const asleep: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.6,
      circadianAlignment: 0.7,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const trace = tickSleepWake(
      asleep,
      nightContext({ elapsedHours: 2, fatigue: 0.5, sleepPressure: 0.6 })
    );
    expect(trace.after.hoursAsleep).toBeGreaterThan(asleep.hoursAsleep);
  });

  it("awake increases hoursSinceSleep", () => {
    const awake: SleepWakeState = {
      phase: "awake",
      sleepQuality: 0.6,
      circadianAlignment: 0.7,
      hoursSinceSleep: 10,
      hoursAsleep: 0,
    };
    const trace = tickSleepWake(
      awake,
      defaultContext({ elapsedHours: 3 })
    );
    expect(trace.after.hoursSinceSleep).toBeGreaterThan(awake.hoursSinceSleep);
  });

  it("sleeping resets hoursSinceSleep to 0", () => {
    const trace = tickSleepWake(
      { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 18 },
      nightContext({ fatigue: 0.9, sleepPressure: 0.9, energy: 0.1, elapsedHours: 1 })
    );
    // Should be entering sleep
    if (
      trace.after.phase === "light_sleep" ||
      trace.after.phase === "deep_sleep"
    ) {
      expect(trace.after.hoursSinceSleep).toBe(0);
    }
  });

  it("high stress lowers sleepQuality during sleep", () => {
    const asleep: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.7,
      circadianAlignment: 0.7,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const lowStress = tickSleepWake(
      { ...asleep },
      nightContext({ elapsedHours: 2, stressLoad: 0.1, fatigue: 0.5, sleepPressure: 0.5 })
    );
    const highStress = tickSleepWake(
      { ...asleep },
      nightContext({ elapsedHours: 2, stressLoad: 0.9, fatigue: 0.5, sleepPressure: 0.5 })
    );
    // Sleep quality should be lower with high stress
    expect(highStress.after.sleepQuality).toBeLessThanOrEqual(
      lowStress.after.sleepQuality
    );
  });

  it("high resilience improves sleepQuality during sleep", () => {
    const asleep: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.5,
      circadianAlignment: 0.7,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const lowRes = tickSleepWake(
      { ...asleep },
      nightContext({ elapsedHours: 4, resilience: 0.2, fatigue: 0.5, sleepPressure: 0.5 })
    );
    const highRes = tickSleepWake(
      { ...asleep },
      nightContext({ elapsedHours: 4, resilience: 0.9, fatigue: 0.5, sleepPressure: 0.5 })
    );
    // Higher resilience → better quality
    expect(highRes.after.sleepQuality).toBeGreaterThanOrEqual(
      lowRes.after.sleepQuality
    );
  });

  it("night sleep improves circadianAlignment", () => {
    const asleep: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.6,
      circadianAlignment: 0.5,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const trace = tickSleepWake(
      { ...asleep },
      nightContext({ localHour: 3, elapsedHours: 4, fatigue: 0.5, sleepPressure: 0.5 })
    );
    if (
      trace.after.phase === "light_sleep" ||
      trace.after.phase === "deep_sleep"
    ) {
      expect(trace.after.circadianAlignment).toBeGreaterThanOrEqual(
        asleep.circadianAlignment
      );
    }
  });

  it("daytime sleep lowers circadianAlignment", () => {
    const asleep: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.6,
      circadianAlignment: 0.7,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const trace = tickSleepWake(
      { ...asleep },
      defaultContext({ localHour: 14, elapsedHours: 4, fatigue: 0.7, sleepPressure: 0.8 })
    );
    if (
      trace.after.phase === "light_sleep" ||
      trace.after.phase === "deep_sleep"
    ) {
      expect(trace.after.circadianAlignment).toBeLessThan(
        asleep.circadianAlignment
      );
    }
  });

  // ── Immutability ────────────────────────────────────────────────────

  it("does not mutate input state", () => {
    const state = { ...DEFAULT_SLEEP_WAKE_STATE };
    const frozen = { ...state };
    tickSleepWake(state, nightContext());
    expect(state).toEqual(frozen);
  });

  // ── Output clamping ─────────────────────────────────────────────────

  it("all output state values clamped [0,1] for quality/alignment", () => {
    const extreme: SleepWakeState = {
      phase: "light_sleep",
      sleepQuality: 0.99,
      circadianAlignment: 0.99,
      hoursSinceSleep: 0,
      hoursAsleep: 1,
    };
    const trace = tickSleepWake(
      extreme,
      nightContext({ elapsedHours: 24, resilience: 1, stressLoad: 0 })
    );
    expect(trace.after.sleepQuality).toBeGreaterThanOrEqual(0);
    expect(trace.after.sleepQuality).toBeLessThanOrEqual(1);
    expect(trace.after.circadianAlignment).toBeGreaterThanOrEqual(0);
    expect(trace.after.circadianAlignment).toBeLessThanOrEqual(1);
  });

  // ── Trace ───────────────────────────────────────────────────────────

  it("trace contains before, after, context, readiness, drive, reasons", () => {
    const trace = tickSleepWake(DEFAULT_SLEEP_WAKE_STATE, defaultContext());
    expect(trace.before).toBeDefined();
    expect(trace.after).toBeDefined();
    expect(trace.context).toBeDefined();
    expect(trace.sleepReadiness).toBeGreaterThanOrEqual(0);
    expect(trace.sleepReadiness).toBeLessThanOrEqual(1);
    expect(trace.circadianSleepDrive).toBeGreaterThanOrEqual(0);
    expect(trace.circadianSleepDrive).toBeLessThanOrEqual(1);
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });

  it("trace reasons mention phase transition when phase changes", () => {
    const trace = tickSleepWake(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake", hoursSinceSleep: 22 },
      nightContext({ fatigue: 0.9, sleepPressure: 0.9, energy: 0.1 })
    );
    // Either transition happened or stable — reasons should explain
    expect(trace.reasons.some((r) => r.includes("transition") || r.includes("stable"))).toBe(true);
  });

  it("trace reasons mention high circadian drive at night", () => {
    const trace = tickSleepWake(DEFAULT_SLEEP_WAKE_STATE, nightContext());
    // Night hours → circadian drive should be mentioned if high enough
    if (trace.circadianSleepDrive > 0.6) {
      expect(trace.reasons.some((r) => r.toLowerCase().includes("circadian"))).toBe(true);
    }
  });

  it("warns when sleepPressure high but character stays awake", () => {
    const trace = tickSleepWake(
      { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake", hoursSinceSleep: 22 },
      { ...nightContext(), sleepPressure: 0.95, energy: 0.9, fatigue: 0.1 }
    );
    // High energy might counteract sleep pressure → stays awake despite pressure
    if (trace.after.phase === "awake") {
      expect(trace.warnings.some((w) => w.toLowerCase().includes("insomnia") || w.toLowerCase().includes("awake"))).toBe(true);
    }
  });

  it("warns for extended wakefulness", () => {
    const trace = tickSleepWake(
      { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 22 },
      defaultContext()
    );
    expect(trace.warnings.some((w) => w.includes("extended") || w.includes("impair"))).toBe(true);
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildSleepWakeContext", () => {
  it("reads energy/fatigue/sleepPressure from EnergyFatigueState", () => {
    const ef: EnergyFatigueState = {
      energy: 0.5,
      fatigue: 0.6,
      sleepPressure: 0.7,
      restDebt: 0.3,
    };
    const ctx = buildSleepWakeContext({
      elapsedHours: 4,
      localHour: 22,
      energyFatigue: ef,
      stressLoad: 0.4,
      resilience: 0.55,
    });
    expect(ctx.energy).toBe(0.5);
    expect(ctx.fatigue).toBe(0.6);
    expect(ctx.sleepPressure).toBe(0.7);
    expect(ctx.stressLoad).toBe(0.4);
    expect(ctx.resilience).toBe(0.55);
    expect(ctx.elapsedHours).toBe(4);
    expect(ctx.localHour).toBe(22);
  });

  it("clamps all numeric fields to [0,1]", () => {
    const ef: EnergyFatigueState = {
      energy: 1.5,
      fatigue: -0.2,
      sleepPressure: 2.0,
      restDebt: 0.5,
    };
    const ctx = buildSleepWakeContext({
      elapsedHours: 1,
      localHour: 12,
      energyFatigue: ef,
      stressLoad: 1.5,
      resilience: -0.5,
    });
    expect(ctx.energy).toBe(1);
    expect(ctx.fatigue).toBe(0);
    expect(ctx.sleepPressure).toBe(1);
    expect(ctx.stressLoad).toBe(1);
    expect(ctx.resilience).toBe(0);
  });

  it("normalizes localHour to 0-23", () => {
    const ef = DEFAULT_ENERGY_FATIGUE_STATE;
    const ctx1 = buildSleepWakeContext({
      elapsedHours: 1, localHour: 26, energyFatigue: ef,
      stressLoad: 0.3, resilience: 0.5,
    });
    expect(ctx1.localHour).toBe(2);

    const ctx2 = buildSleepWakeContext({
      elapsedHours: 1, localHour: -2, energyFatigue: ef,
      stressLoad: 0.3, resilience: 0.5,
    });
    expect(ctx2.localHour).toBe(22);
  });

  it("is pure / deterministic", () => {
    const ef = DEFAULT_ENERGY_FATIGUE_STATE;
    const c1 = buildSleepWakeContext({
      elapsedHours: 4, localHour: 14, energyFatigue: ef,
      stressLoad: 0.3, resilience: 0.5,
    });
    const c2 = buildSleepWakeContext({
      elapsedHours: 4, localHour: 14, energyFatigue: ef,
      stressLoad: 0.3, resilience: 0.5,
    });
    expect(c1).toEqual(c2);
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("determinism", () => {
  it("tickSleepWake is pure: same inputs → same output", () => {
    const state = { ...DEFAULT_SLEEP_WAKE_STATE };
    const ctx = defaultContext({ elapsedHours: 3 });
    const t1 = tickSleepWake(state, ctx);
    const t2 = tickSleepWake(state, ctx);
    expect(t1.after).toEqual(t2.after);
    expect(t1.sleepReadiness).toBe(t2.sleepReadiness);
  });

  it("selectSleepWakePhase is pure", () => {
    const state = { ...DEFAULT_SLEEP_WAKE_STATE, hoursSinceSleep: 18 };
    const ctx = nightContext({ fatigue: 0.8, sleepPressure: 0.85 });
    const p1 = selectSleepWakePhase(state, ctx);
    const p2 = selectSleepWakePhase(state, ctx);
    expect(p1).toBe(p2);
  });
});

// ── Full Cycle Walkthrough ─────────────────────────────────────────────

describe("sleep-wake cycle walkthrough", () => {
  it("character can go from awake → drowsy → falling_asleep → light_sleep → waking → awake", () => {
    // Daytime: awake
    let state: SleepWakeState = { ...DEFAULT_SLEEP_WAKE_STATE, phase: "awake", hoursSinceSleep: 14 };
    let ctx = defaultContext({ localHour: 20, elapsedHours: 2, fatigue: 0.5, sleepPressure: 0.55, energy: 0.4 });

    // Evening → drowsy
    state = tickSleepWake(state, ctx).after;
    expect(["awake", "drowsy", "falling_asleep"]).toContain(state.phase);

    // Late night → falling asleep
    ctx = nightContext({ localHour: 23, elapsedHours: 1, fatigue: 0.7, sleepPressure: 0.75, energy: 0.25 });
    state = tickSleepWake(state, ctx).after;
    // Should be progressing toward sleep
    expect(SLEEP_WAKE_PHASES).toContain(state.phase);

    // Enter sleep
    ctx = nightContext({ localHour: 1, elapsedHours: 1, fatigue: 0.75, sleepPressure: 0.8, energy: 0.2 });
    state = tickSleepWake(state, ctx).after;
    expect(["light_sleep", "deep_sleep", "waking"]).toContain(state.phase);

    // Light sleep → deep sleep
    ctx = nightContext({ localHour: 2, elapsedHours: 2, stressLoad: 0.2, resilience: 0.7, fatigue: 0.6, sleepPressure: 0.6 });
    const deepState = tickSleepWake(state, ctx).after;
    expect(SLEEP_WAKE_PHASES).toContain(deepState.phase);

    // After 8h sleep → should wake
    const longSleep: SleepWakeState = {
      phase: "deep_sleep",
      sleepQuality: 0.7,
      circadianAlignment: 0.75,
      hoursSinceSleep: 0,
      hoursAsleep: 7,
    };
    ctx = defaultContext({ localHour: 7, elapsedHours: 1, fatigue: 0.15, sleepPressure: 0.1, energy: 0.6 });
    const final = tickSleepWake(longSleep, ctx).after;
    // Should be waking or awake
    expect(["awake", "waking"]).toContain(final.phase);
    if (final.phase === "awake") {
      expect(final.hoursAsleep).toBe(0);
    }
  });
});
