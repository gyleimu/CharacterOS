import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { buildHomeostasisCalibrationHints } from "../../src/core/homeostasis/homeostasisCalibration";
import { applyHomeostasis, defaultHomeostasisState } from "../../src/core/homeostasis/homeostasis";
import { defaultMetaState } from "../../src/core/meta/metaState";
import { defaultRewardState } from "../../src/core/reward/rewardSystem";

describe("homeostasis calibration", () => {
  it("flags high pressure and overflow after regulation", () => {
    const trace = applyHomeostasis({
      homeostasis: {
        ...defaultHomeostasisState(),
        scarRetention: 0.55
      },
      meta: {
        ...defaultMetaState(),
        emotionalSensitivity: 0.96,
        resilience: 0.12,
        selfControl: 0.16,
        traumaAmplification: 0.94
      },
      boundary: createPsychologicalBoundary({
        capacity: 0.4,
        stressLoad: 0.92,
        integrity: 0.3,
        cracks: 0.7,
        phase: "overflow"
      }),
      reward: {
        ...defaultRewardState(),
        dopamineLevel: 0.12,
        dopamineThreshold: 0.86,
        craving: 0.8
      },
      daysElapsed: 1
    });

    const hints = buildHomeostasisCalibrationHints(trace);

    expect(hints.some((hint) => hint.id === "homeostasis_pressure_high")).toBe(true);
    expect(hints.some((hint) => hint.id === "scar_retention_high")).toBe(true);
    expect(hints.some((hint) => hint.id === "boundary_still_overflowing")).toBe(true);
  });

  it("returns a recovery-window hint when pressure is below set point", () => {
    const trace = applyHomeostasis({
      homeostasis: defaultHomeostasisState(),
      meta: defaultMetaState(),
      boundary: createPsychologicalBoundary(),
      reward: defaultRewardState(),
      daysElapsed: 1
    });

    const hints = buildHomeostasisCalibrationHints(trace);

    expect(hints).toHaveLength(1);
    expect(hints[0]?.id).toBe("recovery_window_open");
  });
});
