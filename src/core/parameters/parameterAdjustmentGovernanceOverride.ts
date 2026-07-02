import type { ParameterAdjustmentGovernanceTrace } from "./parameterAdjustmentGovernance";

export interface ParameterAdjustmentGovernanceOverride {
  enabled: boolean;
  reason: string;
}

export interface ParameterAdjustmentGovernanceOverrideDecision {
  allowed: boolean;
  usedOverride: boolean;
  reasons: string[];
}

export function evaluateParameterAdjustmentGovernanceOverride(params: {
  governance: ParameterAdjustmentGovernanceTrace;
  override?: Partial<ParameterAdjustmentGovernanceOverride>;
}): ParameterAdjustmentGovernanceOverrideDecision {
  if (!params.governance.cooldownActive) {
    return {
      allowed: true,
      usedOverride: false,
      reasons: ["governance cooldown is not active"]
    };
  }

  if (!params.override?.enabled) {
    return {
      allowed: false,
      usedOverride: false,
      reasons: ["manual adjustment blocked by active governance cooldown"]
    };
  }

  const reason = params.override.reason?.trim() ?? "";
  if (reason.length < 12) {
    return {
      allowed: false,
      usedOverride: true,
      reasons: ["governance override reason is too short"]
    };
  }

  return {
    allowed: true,
    usedOverride: true,
    reasons: [
      "active governance cooldown overridden by explicit human reason",
      reason
    ]
  };
}
