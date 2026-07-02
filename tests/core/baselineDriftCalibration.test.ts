import { describe, expect, it } from "vitest";
import { buildBaselineDriftCalibrationHints } from "../../src/core/parameters/baselineDriftCalibration";
import type { BaselineDriftTrace } from "../../src/core/parameters/baselineDrift";

describe("baseline drift calibration", () => {
  it("keeps early fluctuations informational", () => {
    const hints = buildBaselineDriftCalibrationHints({
      accumulatedDays: 12,
      repetitionCount: 1,
      eligible: false,
      candidates: [],
      reasons: []
    });

    expect(hints).toHaveLength(1);
    expect(hints[0]?.id).toBe("baseline_drift_not_ready");
    expect(hints[0]?.severity).toBe("info");
  });

  it("marks strong baseline drift candidates as adjust hints", () => {
    const trace: BaselineDriftTrace = {
      accumulatedDays: 180,
      repetitionCount: 6,
      eligible: true,
      candidates: [
        {
          id: "baseline_boundary_integrity",
          label: "心理边界完整度基线",
          currentBaseline: 1,
          observedValue: 0.42,
          suggestedBaseline: 0.98,
          direction: "down",
          pressure: 0.74,
          resistance: 0.35,
          reasons: []
        }
      ],
      reasons: []
    };

    const hints = buildBaselineDriftCalibrationHints(trace);

    expect(hints).toHaveLength(1);
    expect(hints[0]?.severity).toBe("adjust");
    expect(hints[0]?.id).toBe("baseline_drift_baseline_boundary_integrity");
  });
});
