import { describe, expect, it } from "vitest";
import { evaluateParameterAdjustmentGovernance } from "../../src/core/parameters/parameterAdjustmentGovernance";
import type { ParameterAdjustmentHistorySummary } from "../../src/core/parameters/parameterAdjustmentHistory";

describe("parameter adjustment governance", () => {
  it("allows stable manual adjustment history", () => {
    const governance = evaluateParameterAdjustmentGovernance(summary("low"));

    expect(governance.recommendation).toBe("allow");
    expect(governance.cooldownDays).toBe(0);
    expect(governance.cooldownActive).toBe(false);
  });

  it("recommends cooldown for medium risk history", () => {
    const governance = evaluateParameterAdjustmentGovernance({
      ...summary("medium"),
      frequentTargetPaths: ["metaState.selfControl"],
      latestAt: "2026-06-20T00:00:00.000Z"
    }, new Date("2026-06-22T00:00:00.000Z"));

    expect(governance.recommendation).toBe("cooldown");
    expect(governance.cooldownDays).toBe(7);
    expect(governance.cooldownActive).toBe(true);
    expect(governance.cooldownUntil).toBe("2026-06-27T00:00:00.000Z");
  });

  it("recommends pause for high risk history", () => {
    const governance = evaluateParameterAdjustmentGovernance({
      ...summary("high"),
      latestAt: "2026-06-01T00:00:00.000Z"
    }, new Date("2026-06-20T00:00:00.000Z"));

    expect(governance.recommendation).toBe("pause");
    expect(governance.cooldownDays).toBe(14);
    expect(governance.cooldownActive).toBe(false);
    expect(governance.cooldownUntil).toBe("2026-06-15T00:00:00.000Z");
  });
});

function summary(stabilityRisk: "low" | "medium" | "high"): ParameterAdjustmentHistorySummary {
  return {
    totalEntries: stabilityRisk === "low" ? 0 : 6,
    appliedCount: stabilityRisk === "high" ? 9 : 3,
    rollbackCount: 0,
    blockedCount: 0,
    overrideCount: 0,
    totalOperations: 0,
    uniqueTargetPaths: [],
    latestTargetPaths: [],
    frequentTargetPaths: [],
    stabilityRisk,
    reasons: []
  };
}
