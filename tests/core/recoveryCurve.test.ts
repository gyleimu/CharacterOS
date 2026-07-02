import { describe, expect, it } from "vitest";
import { applyRecoveryCurve } from "../../src/core/recovery/recoveryCurve";

describe("recovery curve", () => {
  it("uses elapsed time and safety to recover toward baseline", () => {
    const result = applyRecoveryCurve({
      current: 0.9,
      baseline: 0.4,
      dailyRate: 0.05,
      daysElapsed: 14,
      safetyFactor: 0.8
    });

    expect(result.after).toBeLessThan(0.9);
    expect(result.after).toBeGreaterThan(0.4);
    expect(result.elapsedRate).toBeGreaterThan(0);
  });

  it("lets obstacles slow recovery", () => {
    const openRecovery = applyRecoveryCurve({
      current: 0.9,
      baseline: 0.4,
      dailyRate: 0.05,
      daysElapsed: 14,
      obstacleFactor: 0
    });
    const blockedRecovery = applyRecoveryCurve({
      current: 0.9,
      baseline: 0.4,
      dailyRate: 0.05,
      daysElapsed: 14,
      obstacleFactor: 0.8
    });

    expect(blockedRecovery.after).toBeGreaterThan(openRecovery.after);
  });
});
