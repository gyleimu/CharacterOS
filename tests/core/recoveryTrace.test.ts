import { describe, expect, it } from "vitest";
import { createPsychologicalBoundary } from "../../src/core/boundary/psychologicalBoundary";
import { applyHomeostasis, defaultHomeostasisState } from "../../src/core/homeostasis/homeostasis";
import { defaultMetaState } from "../../src/core/meta/metaState";
import { defaultRewardState } from "../../src/core/reward/rewardSystem";
import { buildRecoveryTrace } from "../../src/core/recovery/recoveryTrace";

describe("recovery trace", () => {
  it("summarizes recovery dimensions without mutating state", () => {
    const metaBefore = defaultMetaState();
    const boundaryBefore = createPsychologicalBoundary({ stressLoad: 0.8, integrity: 0.62, cracks: 0.35 });
    const rewardBefore = { ...defaultRewardState(), craving: 0.7 };
    const homeostasis = applyHomeostasis({
      homeostasis: defaultHomeostasisState(),
      meta: metaBefore,
      boundary: boundaryBefore,
      reward: rewardBefore,
      daysElapsed: 30
    });

    const trace = buildRecoveryTrace({
      daysElapsed: 30,
      metaBefore,
      metaAfter: homeostasis.regulatedMetaState,
      boundaryBefore,
      boundaryAfter: homeostasis.regulatedBoundary,
      rewardBefore,
      rewardAfter: homeostasis.regulatedRewardState,
      homeostasis
    });

    expect(trace.dimensions).toHaveLength(4);
    expect(trace.safetyFactor).toBeGreaterThan(0);
    expect(trace.obstacleFactor).toBeGreaterThan(0);
    expect(trace.dimensions.some((dimension) => dimension.id === "boundary_stress")).toBe(true);
    expect(trace.dimensions.every((dimension) => dimension.expectedStabilizationDays >= 0)).toBe(true);
  });
});
