import { describe, expect, it } from "vitest";
import { buildRecoveryCalibrationHints } from "../../src/core/recovery/recoveryCalibration";
import type { RecoveryTrace } from "../../src/core/recovery/recoveryTrace";

describe("recovery calibration", () => {
  it("flags recovery obstacles and blocked dimensions", () => {
    const trace: RecoveryTrace = {
      daysElapsed: 30,
      safetyFactor: 0.3,
      obstacleFactor: 0.72,
      scarRetention: 0.62,
      dimensions: [
        {
          id: "boundary_stress",
          label: "边界压力恢复",
          before: 0.9,
          after: 0.82,
          baseline: 0,
          expectedAfter: 0.5,
          expectedStabilizationDays: 400,
          deviationBefore: 0.9,
          deviationAfter: 0.82,
          recoveredAmount: 0.08,
          retainedScar: 0.3,
          blocked: true
        }
      ],
      reasons: []
    };

    const hints = buildRecoveryCalibrationHints(trace);

    expect(hints.some((hint) => hint.id === "recovery_obstacle_high")).toBe(true);
    expect(hints.some((hint) => hint.id === "recovery_dimension_blocked")).toBe(true);
    expect(hints.some((hint) => hint.id === "recovery_scar_retention_high")).toBe(true);
  });
});
