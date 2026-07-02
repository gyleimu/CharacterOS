import { describe, expect, it } from "vitest";
import {
  buildReplayCalibrationSuite,
  calibrateScenario,
  validateReplayCalibrationSuite
} from "../../src/core/trace/replayCalibration";

describe("Replay Calibration", () => {
  it("checks every trace replay scenario against expected psychological direction", () => {
    const suite = buildReplayCalibrationSuite({ daysPerStep: 14 });

    expect(suite.results.length).toBeGreaterThan(0);
    expect(suite.passed).toBe(true);
    expect(suite.results.every((result) => result.checks.length >= 4)).toBe(true);
  });

  it("marks repeated abandonment as defensive drift with bounded velocity", () => {
    const result = calibrateScenario("repeated_abandonment_accumulation", 14);
    const direction = result.checks.find((check) => check.name === "dominant direction");
    const velocity = result.checks.find((check) => check.name === "velocity cap");

    expect(result.summary.dominantDirection).toBe("defensive_drift");
    expect(direction?.severity).toBe("pass");
    expect(velocity?.severity).toBe("pass");
  });

  it("marks support recovery as recovery drift", () => {
    const result = calibrateScenario("support_recovery_accumulation", 14);
    const direction = result.checks.find((check) => check.name === "dominant direction");

    expect(result.summary.dominantDirection).toBe("recovery_drift");
    expect(direction?.severity).toBe("pass");
  });

  it("validates calibration suite structure and derived passed status", () => {
    const suite = buildReplayCalibrationSuite({ daysPerStep: 14 });
    const valid = validateReplayCalibrationSuite(suite);
    const invalid = validateReplayCalibrationSuite({
      ...suite,
      passed: true,
      results: [
        {
          ...suite.results[0],
          passed: true,
          checks: [
            {
              name: "forced failure",
              severity: "fail",
              message: "synthetic failed check",
              value: 1
            }
          ]
        }
      ]
    });

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((error) => error.includes("passed must match"))).toBe(true);
  });

  it("normalizes manual calibration parameters", () => {
    const suite = buildReplayCalibrationSuite({
      daysPerStep: 999,
      learningRate: 999,
      maxDriftMagnitude: -1,
      minObservableDrift: 2,
      maxVelocity: Number.NaN
    });

    expect(suite.parameters.daysPerStep).toBe(365);
    expect(suite.parameters.learningRate).toBe(0.2);
    expect(suite.parameters.maxDriftMagnitude).toBe(0.001);
    expect(suite.parameters.minObservableDrift).toBe(0.5);
    expect(suite.parameters.maxVelocity).toBe(0.08);
    expect(validateReplayCalibrationSuite(suite).valid).toBe(true);
  });

  it("lets learning rate change replay drift magnitude", () => {
    const slow = calibrateScenario("repeated_abandonment_accumulation", {
      daysPerStep: 14,
      learningRate: 0.01,
      maxDriftMagnitude: 1,
      minObservableDrift: 0,
      maxVelocity: 1
    });
    const fast = calibrateScenario("repeated_abandonment_accumulation", {
      daysPerStep: 14,
      learningRate: 0.08,
      maxDriftMagnitude: 1,
      minObservableDrift: 0,
      maxVelocity: 1
    });

    expect(Math.abs(fast.summary.coordinateDelta.trust)).toBeGreaterThan(
      Math.abs(slow.summary.coordinateDelta.trust)
    );
    expect(Math.abs(fast.summary.coordinateDelta.fear)).toBeGreaterThan(
      Math.abs(slow.summary.coordinateDelta.fear)
    );
  });
});
