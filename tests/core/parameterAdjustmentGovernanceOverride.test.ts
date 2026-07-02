import { describe, expect, it } from "vitest";
import { evaluateParameterAdjustmentGovernanceOverride } from "../../src/core/parameters/parameterAdjustmentGovernanceOverride";

describe("parameter adjustment governance override", () => {
  it("allows adjustment when cooldown is not active", () => {
    const decision = evaluateParameterAdjustmentGovernanceOverride({
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: []
      }
    });

    expect(decision.allowed).toBe(true);
    expect(decision.usedOverride).toBe(false);
  });

  it("blocks adjustment during active cooldown without override", () => {
    const decision = evaluateParameterAdjustmentGovernanceOverride({
      governance: {
        recommendation: "cooldown",
        cooldownDays: 7,
        cooldownUntil: "2026-06-27T00:00:00.000Z",
        cooldownActive: true,
        reasons: []
      }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons[0]).toBe("manual adjustment blocked by active governance cooldown");
  });

  it("requires a meaningful override reason during active cooldown", () => {
    const shortReason = evaluateParameterAdjustmentGovernanceOverride({
      governance: {
        recommendation: "cooldown",
        cooldownDays: 7,
        cooldownUntil: "2026-06-27T00:00:00.000Z",
        cooldownActive: true,
        reasons: []
      },
      override: {
        enabled: true,
        reason: "urgent"
      }
    });

    const validReason = evaluateParameterAdjustmentGovernanceOverride({
      governance: {
        recommendation: "cooldown",
        cooldownDays: 7,
        cooldownUntil: "2026-06-27T00:00:00.000Z",
        cooldownActive: true,
        reasons: []
      },
      override: {
        enabled: true,
        reason: "manual correction after verified bad calibration"
      }
    });

    expect(shortReason.allowed).toBe(false);
    expect(validReason.allowed).toBe(true);
    expect(validReason.usedOverride).toBe(true);
  });
});
