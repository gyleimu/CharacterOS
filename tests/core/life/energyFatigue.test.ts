import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENERGY_FATIGUE_STATE,
  applyEnergyFatigueDelta,
  buildEnergyFatigueContextFromCharacter,
  computeEnergyFatigueDelta,
  tickEnergyFatigue,
  type EnergyFatigueContext,
  type EnergyFatigueState,
} from "../../../src/core/life/energyFatigue";
import { createCharacterPhysicsState } from "../../../src/core/physics/physicsEngine";
import { createPsychologicalBoundary } from "../../../src/core/boundary/psychologicalBoundary";
import { defaultMetaState } from "../../../src/core/meta/metaState";

// ── Helpers ────────────────────────────────────────────────────────────

function defaultContext(
  overrides: Partial<EnergyFatigueContext> = {}
): EnergyFatigueContext {
  return {
    elapsedHours: 4,
    isResting: false,
    stressLoad: 0.3,
    selfControl: 0.58,
    resilience: 0.52,
    emotionalSensitivity: 0.62,
    ...overrides,
  };
}

// ── Default State ──────────────────────────────────────────────────────

describe("DEFAULT_ENERGY_FATIGUE_STATE", () => {
  it("all values are in [0,1]", () => {
    const s = DEFAULT_ENERGY_FATIGUE_STATE;
    expect(s.energy).toBeGreaterThanOrEqual(0);
    expect(s.energy).toBeLessThanOrEqual(1);
    expect(s.fatigue).toBeGreaterThanOrEqual(0);
    expect(s.fatigue).toBeLessThanOrEqual(1);
    expect(s.sleepPressure).toBeGreaterThanOrEqual(0);
    expect(s.sleepPressure).toBeLessThanOrEqual(1);
    expect(s.restDebt).toBeGreaterThanOrEqual(0);
    expect(s.restDebt).toBeLessThanOrEqual(1);
  });
});

// ── Active Tick (awake) ────────────────────────────────────────────────

describe("active tick (isResting=false)", () => {
  it("increases fatigue", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext({ elapsedHours: 8 }));
    expect(trace.delta.fatigueDelta).toBeGreaterThan(0);
    expect(trace.after.fatigue).toBeGreaterThan(state.fatigue);
  });

  it("decreases energy", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext({ elapsedHours: 8 }));
    expect(trace.delta.energyDelta).toBeLessThan(0);
    expect(trace.after.energy).toBeLessThan(state.energy);
  });

  it("increases sleep pressure", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext({ elapsedHours: 4 }));
    expect(trace.delta.sleepPressureDelta).toBeGreaterThan(0);
    expect(trace.after.sleepPressure).toBeGreaterThan(state.sleepPressure);
  });

  it("increases rest debt slowly", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext({ elapsedHours: 4 }));
    expect(trace.delta.restDebtDelta).toBeGreaterThanOrEqual(0);
  });

  it("1 hour does not zero out energy", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext({ elapsedHours: 1 }));
    expect(trace.after.energy).toBeGreaterThan(0.5); // still mostly full
  });
});

// ── Resting Tick ───────────────────────────────────────────────────────

describe("resting tick (isResting=true)", () => {
  it("decreases fatigue", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const trace = tickEnergyFatigue(
      tired,
      defaultContext({ isResting: true, elapsedHours: 8 })
    );
    expect(trace.delta.fatigueDelta).toBeLessThan(0);
    expect(trace.after.fatigue).toBeLessThan(tired.fatigue);
  });

  it("increases energy", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const trace = tickEnergyFatigue(
      tired,
      defaultContext({ isResting: true, elapsedHours: 8 })
    );
    expect(trace.delta.energyDelta).toBeGreaterThan(0);
    expect(trace.after.energy).toBeGreaterThan(tired.energy);
  });

  it("decreases sleep pressure", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const trace = tickEnergyFatigue(
      tired,
      defaultContext({ isResting: true, elapsedHours: 8 })
    );
    expect(trace.delta.sleepPressureDelta).toBeLessThan(0);
    expect(trace.after.sleepPressure).toBeLessThan(tired.sleepPressure);
  });

  it("decreases rest debt slowly", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const trace = tickEnergyFatigue(
      tired,
      defaultContext({ isResting: true, elapsedHours: 8 })
    );
    expect(trace.delta.restDebtDelta).toBeLessThanOrEqual(0);
  });
});

// ── Stress Amplification ───────────────────────────────────────────────

describe("stress amplification", () => {
  it("high stress increases fatigue more than low stress (active)", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const lowStress = tickEnergyFatigue(
      { ...state },
      defaultContext({ stressLoad: 0.1, elapsedHours: 8 })
    );
    const highStress = tickEnergyFatigue(
      { ...state },
      defaultContext({ stressLoad: 0.9, elapsedHours: 8 })
    );
    expect(highStress.delta.fatigueDelta).toBeGreaterThan(
      lowStress.delta.fatigueDelta
    );
  });

  it("high stress slows recovery when resting", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const lowStress = tickEnergyFatigue(
      { ...tired },
      defaultContext({ isResting: true, stressLoad: 0.1, elapsedHours: 8 })
    );
    const highStress = tickEnergyFatigue(
      { ...tired },
      defaultContext({ isResting: true, stressLoad: 0.9, elapsedHours: 8 })
    );
    // High stress → less energy recovery
    expect(highStress.delta.energyDelta).toBeLessThan(
      lowStress.delta.energyDelta
    );
  });
});

// ── Self-Control Effect ────────────────────────────────────────────────

describe("self-control effect", () => {
  it("low self-control amplifies fatigue gain (active)", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const highSC = tickEnergyFatigue(
      { ...state },
      defaultContext({ selfControl: 0.9, elapsedHours: 8 })
    );
    const lowSC = tickEnergyFatigue(
      { ...state },
      defaultContext({ selfControl: 0.2, elapsedHours: 8 })
    );
    expect(lowSC.delta.fatigueDelta).toBeGreaterThan(
      highSC.delta.fatigueDelta
    );
  });
});

// ── Resilience Recovery ────────────────────────────────────────────────

describe("resilience recovery", () => {
  it("high resilience improves energy recovery when resting", () => {
    const tired: EnergyFatigueState = {
      energy: 0.3,
      fatigue: 0.7,
      sleepPressure: 0.75,
      restDebt: 0.5,
    };
    const lowRes = tickEnergyFatigue(
      { ...tired },
      defaultContext({ isResting: true, resilience: 0.2, elapsedHours: 8 })
    );
    const highRes = tickEnergyFatigue(
      { ...tired },
      defaultContext({ isResting: true, resilience: 0.9, elapsedHours: 8 })
    );
    expect(highRes.delta.energyDelta).toBeGreaterThan(
      lowRes.delta.energyDelta
    );
  });
});

// ── Output Clamping ────────────────────────────────────────────────────

describe("output clamping", () => {
  it("all output values are clamped to [0,1]", () => {
    // Start with extreme state and test active + resting
    const extreme: EnergyFatigueState = {
      energy: 0.99,
      fatigue: 0.01,
      sleepPressure: 0.01,
      restDebt: 0.99,
    };

    // Active — pushes fatigue up, energy down
    const activeTrace = tickEnergyFatigue(
      { ...extreme },
      defaultContext({ elapsedHours: 24, stressLoad: 1 })
    );
    expect(activeTrace.after.energy).toBeGreaterThanOrEqual(0);
    expect(activeTrace.after.energy).toBeLessThanOrEqual(1);
    expect(activeTrace.after.fatigue).toBeGreaterThanOrEqual(0);
    expect(activeTrace.after.fatigue).toBeLessThanOrEqual(1);
    expect(activeTrace.after.sleepPressure).toBeGreaterThanOrEqual(0);
    expect(activeTrace.after.sleepPressure).toBeLessThanOrEqual(1);
    expect(activeTrace.after.restDebt).toBeGreaterThanOrEqual(0);
    expect(activeTrace.after.restDebt).toBeLessThanOrEqual(1);

    // Resting — pushes energy up
    const tired: EnergyFatigueState = {
      energy: 0.99,
      fatigue: 0.01,
      sleepPressure: 0.01,
      restDebt: 0.01,
    };
    const restTrace = tickEnergyFatigue(
      { ...tired },
      defaultContext({ isResting: true, elapsedHours: 24, resilience: 1, stressLoad: 0 })
    );
    expect(restTrace.after.energy).toBeGreaterThanOrEqual(0);
    expect(restTrace.after.energy).toBeLessThanOrEqual(1);
    expect(restTrace.after.fatigue).toBeGreaterThanOrEqual(0);
    expect(restTrace.after.fatigue).toBeLessThanOrEqual(1);

    // Very tired character resting a lot
    const veryTired: EnergyFatigueState = {
      energy: 0.01,
      fatigue: 0.99,
      sleepPressure: 0.99,
      restDebt: 0.01,
    };
    const longRest = tickEnergyFatigue(
      { ...veryTired },
      defaultContext({ isResting: true, elapsedHours: 168, resilience: 1, stressLoad: 0 })
    );
    expect(longRest.after.energy).toBeGreaterThanOrEqual(0);
    expect(longRest.after.energy).toBeLessThanOrEqual(1);
    expect(longRest.after.fatigue).toBeGreaterThanOrEqual(0);
    expect(longRest.after.fatigue).toBeLessThanOrEqual(1);
  });
});

// ── Immutability ───────────────────────────────────────────────────────

describe("immutability", () => {
  it("tickEnergyFatigue does not mutate input state", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const frozen = { ...state };
    tickEnergyFatigue(state, defaultContext({ elapsedHours: 8 }));
    expect(state).toEqual(frozen);
  });

  it("computeEnergyFatigueDelta does not mutate input state", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const frozen = { ...state };
    computeEnergyFatigueDelta(state, defaultContext());
    expect(state).toEqual(frozen);
  });

  it("applyEnergyFatigueDelta returns new object, does not mutate input", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const frozen = { ...state };
    const delta = computeEnergyFatigueDelta(state, defaultContext());
    const result = applyEnergyFatigueDelta(state, delta);
    expect(state).toEqual(frozen);
    expect(result).not.toBe(state);
  });
});

// ── ElapsedHours Scaling ────────────────────────────────────────────────

describe("elapsedHours scaling", () => {
  it("more hours produce larger deltas", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const short = tickEnergyFatigue(
      { ...state },
      defaultContext({ elapsedHours: 1 })
    );
    const long = tickEnergyFatigue(
      { ...state },
      defaultContext({ elapsedHours: 12 })
    );
    expect(Math.abs(long.delta.fatigueDelta)).toBeGreaterThan(
      Math.abs(short.delta.fatigueDelta)
    );
    expect(Math.abs(long.delta.energyDelta)).toBeGreaterThan(
      Math.abs(short.delta.energyDelta)
    );
  });

  it("elapsedHours effect saturates beyond 24h (time factor cap)", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const at24 = tickEnergyFatigue(
      { ...state },
      defaultContext({ elapsedHours: 24 })
    );
    const at48 = tickEnergyFatigue(
      { ...state },
      defaultContext({ elapsedHours: 48 })
    );
    // Same time factor → same delta
    expect(at24.delta.fatigueDelta).toBe(at48.delta.fatigueDelta);
  });

  it("handles elapsedHours <= 0 with warning (safe clamp)", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(
      state,
      defaultContext({ elapsedHours: 0 })
    );
    // Should produce a trace with warnings
    expect(trace.warnings.length).toBeGreaterThan(0);
    // Should not crash
    expect(trace.after).toBeDefined();
  });
});

// ── Trace Structure ────────────────────────────────────────────────────

describe("EnergyFatigueTrace", () => {
  it("contains before, after, delta, context, warnings, reasons", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const trace = tickEnergyFatigue(state, defaultContext());

    expect(trace.before).toBeDefined();
    expect(trace.after).toBeDefined();
    expect(trace.delta).toBeDefined();
    expect(trace.context).toBeDefined();
    expect(Array.isArray(trace.warnings)).toBe(true);
    expect(Array.isArray(trace.reasons)).toBe(true);
    expect(trace.reasons.length).toBeGreaterThan(0);
  });

  it("trace reasons mention resting or active", () => {
    const activeTrace = tickEnergyFatigue(
      { ...DEFAULT_ENERGY_FATIGUE_STATE },
      defaultContext({ isResting: false })
    );
    expect(
      activeTrace.reasons.some(
        (r) => r.toLowerCase().includes("active") || r.toLowerCase().includes("awake")
      )
    ).toBe(true);

    const restTrace = tickEnergyFatigue(
      { ...DEFAULT_ENERGY_FATIGUE_STATE },
      defaultContext({ isResting: true })
    );
    expect(
      restTrace.reasons.some(
        (r) => r.toLowerCase().includes("resting") || r.toLowerCase().includes("recover")
      )
    ).toBe(true);
  });

  it("trace reasons mention high stress when applicable", () => {
    const trace = tickEnergyFatigue(
      { ...DEFAULT_ENERGY_FATIGUE_STATE },
      defaultContext({ stressLoad: 0.85 })
    );
    expect(
      trace.reasons.some((r) => r.toLowerCase().includes("stress"))
    ).toBe(true);
  });

  it("trace reasons mention clamping when values hit bounds", () => {
    const veryTired: EnergyFatigueState = {
      energy: 0.001,
      fatigue: 1.0,
      sleepPressure: 1.0,
      restDebt: 1.0,
    };
    const trace = tickEnergyFatigue(
      { ...veryTired },
      defaultContext({ elapsedHours: 24, isResting: false })
    );
    // fatigue at 1.0 + delta should be clamped
    expect(
      trace.reasons.some(
        (r) => r.toLowerCase().includes("clamp") || r.toLowerCase().includes("bound")
      )
    ).toBe(true);
  });
});

// ── Context Helper ─────────────────────────────────────────────────────

describe("buildEnergyFatigueContextFromCharacter", () => {
  it("reads stressLoad from boundary", () => {
    const character = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.45 }),
    });
    const ctx = buildEnergyFatigueContextFromCharacter(character, 4, false);
    expect(ctx.stressLoad).toBe(0.45);
  });

  it("reads selfControl, resilience, emotionalSensitivity from metaState", () => {
    const character = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary(),
    });
    const meta = defaultMetaState();
    const ctx = buildEnergyFatigueContextFromCharacter(character, 4, false);
    expect(ctx.selfControl).toBe(meta.selfControl);
    expect(ctx.resilience).toBe(meta.resilience);
    expect(ctx.emotionalSensitivity).toBe(meta.emotionalSensitivity);
  });

  it("clamps all fields to [0,1]", () => {
    const character = createCharacterPhysicsState({
      boundary: createPsychologicalBoundary({ stressLoad: 0.5 }),
    });
    const ctx = buildEnergyFatigueContextFromCharacter(character, 4, false);
    expect(ctx.stressLoad).toBeGreaterThanOrEqual(0);
    expect(ctx.stressLoad).toBeLessThanOrEqual(1);
    expect(ctx.selfControl).toBeGreaterThanOrEqual(0);
    expect(ctx.selfControl).toBeLessThanOrEqual(1);
    expect(ctx.resilience).toBeGreaterThanOrEqual(0);
    expect(ctx.resilience).toBeLessThanOrEqual(1);
    expect(ctx.emotionalSensitivity).toBeGreaterThanOrEqual(0);
    expect(ctx.emotionalSensitivity).toBeLessThanOrEqual(1);
  });

  it("passes through elapsedHours and isResting", () => {
    const character = createCharacterPhysicsState();
    const ctx = buildEnergyFatigueContextFromCharacter(character, 6, true);
    expect(ctx.elapsedHours).toBe(6);
    expect(ctx.isResting).toBe(true);
  });

  it("does not modify the character state", () => {
    const char = createCharacterPhysicsState();
    const frozenBoundary = { ...char.boundary };
    const frozenMeta = { ...char.metaState };
    buildEnergyFatigueContextFromCharacter(char, 4, false);
    expect(char.boundary).toEqual(frozenBoundary);
    expect(char.metaState).toEqual(frozenMeta);
  });
});

// ── Determinism ────────────────────────────────────────────────────────

describe("determinism", () => {
  it("same inputs produce same output", () => {
    const state = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    const ctx = defaultContext({ elapsedHours: 4 });
    const t1 = tickEnergyFatigue(state, ctx);
    const t2 = tickEnergyFatigue(state, ctx);
    expect(t1.delta).toEqual(t2.delta);
    expect(t1.after).toEqual(t2.after);
  });
});

// ── Recovery vs Drain Symmetry ─────────────────────────────────────────

describe("recovery / drain cycle", () => {
  it("resting after being active partially restores energy", () => {
    const fresh = { ...DEFAULT_ENERGY_FATIGUE_STATE };
    // Be active for 16 hours
    const afterActive = tickEnergyFatigue(
      { ...fresh },
      defaultContext({ elapsedHours: 16, isResting: false })
    );
    // Then rest for 8 hours
    const afterRest = tickEnergyFatigue(
      { ...afterActive.after },
      defaultContext({ elapsedHours: 8, isResting: true })
    );
    // Should recover toward baseline but not fully in one cycle
    expect(afterRest.after.energy).toBeGreaterThan(afterActive.after.energy);
    expect(afterRest.after.fatigue).toBeLessThan(afterActive.after.fatigue);
  });
});
