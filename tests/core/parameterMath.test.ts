import { describe, expect, it } from "vitest";
import {
  accumulateTowardThreshold,
  applyInertia,
  recoverTowardBaseline,
  valueToLevel
} from "../../src/core/parameters/parameterMath";

describe("parameter math", () => {
  it("moves current values toward targets through inertia", () => {
    const step = applyInertia({
      current: 0.2,
      target: 0.8,
      inertiaRate: 0.25
    });

    expect(step.after).toBe(0.35);
  });

  it("accumulates pressure before crossing a threshold", () => {
    const result = accumulateTowardThreshold({
      current: 0.35,
      pressure: 0.25,
      decay: 0.1,
      threshold: 0.55
    });

    expect(result.accumulated).toBe(0.565);
    expect(result.crossed).toBe(true);
    expect(result.overflow).toBe(0.015);
  });

  it("recovers toward baseline while retaining scars", () => {
    const result = recoverTowardBaseline({
      current: 0.9,
      baseline: 0.5,
      recoveryRate: 0.5,
      scarRetention: 0.25
    });

    expect(result.after).toBe(0.75);
    expect(result.retainedScar).toBe(0.1);
  });

  it("maps numeric values to broad relative levels", () => {
    expect(valueToLevel(0.1)).toBe("very_low");
    expect(valueToLevel(0.5)).toBe("normal");
    expect(valueToLevel(0.85)).toBe("very_high");
  });
});
