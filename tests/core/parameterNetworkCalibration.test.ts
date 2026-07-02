import { describe, expect, it } from "vitest";
import { buildParameterNetworkCalibrationHints } from "../../src/core/parameters/parameterNetworkCalibration";
import { propagateParameterNetwork } from "../../src/core/parameters/parameterNetwork";

describe("parameter network calibration", () => {
  it("suggests watching action noise and self-control under heavy fatigue", () => {
    const trace = propagateParameterNetwork({
      state: {
        fatigue: 0.92,
        sleepDebt: 0.86,
        stress: 0.78,
        loneliness: 0.52,
        rewardDeficit: 0.32,
        selfControl: 0.64,
        boundaryIntegrity: 0.8,
        emotionalAmplification: 0.5,
        actionNoise: 0.28,
        recoveryCapacity: 0.34
      },
      inertiaRate: 0.55
    });

    const hints = buildParameterNetworkCalibrationHints(trace);

    expect(hints.some((hint) => hint.id === "action_noise_high")).toBe(true);
    expect(hints.some((hint) => hint.id === "self_control_drop")).toBe(true);
  });

  it("returns a stable hint when network movement is small", () => {
    const trace = propagateParameterNetwork({
      state: {
        fatigue: 0.05,
        sleepDebt: 0.05,
        stress: 0.05,
        loneliness: 0.1,
        rewardDeficit: 0.02,
        selfControl: 0.78,
        boundaryIntegrity: 0.92,
        emotionalAmplification: 0.28,
        actionNoise: 0.12,
        recoveryCapacity: 0.82
      },
      inertiaRate: 0.2
    });

    const hints = buildParameterNetworkCalibrationHints(trace);

    expect(hints).toHaveLength(1);
    expect(hints[0]?.id).toBe("network_stable");
  });
});
