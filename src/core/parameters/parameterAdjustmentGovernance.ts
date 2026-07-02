import type { ParameterAdjustmentHistorySummary } from "./parameterAdjustmentHistory";

export type ParameterAdjustmentGovernanceRecommendation = "allow" | "cooldown" | "pause";

export interface ParameterAdjustmentGovernanceTrace {
  recommendation: ParameterAdjustmentGovernanceRecommendation;
  cooldownDays: number;
  cooldownUntil?: string;
  cooldownActive: boolean;
  reasons: string[];
}

export function evaluateParameterAdjustmentGovernance(
  summary: ParameterAdjustmentHistorySummary,
  now: Date = new Date()
): ParameterAdjustmentGovernanceTrace {
  if (summary.stabilityRisk === "high") {
    const cooldownUntil = cooldownUntilFromSummary(summary, 14);
    return {
      recommendation: "pause",
      cooldownDays: 14,
      ...(cooldownUntil ? { cooldownUntil } : {}),
      cooldownActive: isCooldownActive(cooldownUntil, now),
      reasons: [
        "manual adjustment stability risk is high",
        "pause manual parameter edits and observe behavior before changing more values"
      ]
    };
  }

  if (summary.stabilityRisk === "medium") {
    const cooldownDays = summary.frequentTargetPaths.length ? 7 : 3;
    const cooldownUntil = cooldownUntilFromSummary(summary, cooldownDays);
    return {
      recommendation: "cooldown",
      cooldownDays,
      ...(cooldownUntil ? { cooldownUntil } : {}),
      cooldownActive: isCooldownActive(cooldownUntil, now),
      reasons: [
        "manual adjustment stability risk is medium",
        "use a short cooldown before further manual edits"
      ]
    };
  }

  return {
    recommendation: "allow",
    cooldownDays: 0,
    cooldownActive: false,
    reasons: summary.totalEntries
      ? ["manual adjustment history is within stable range"]
      : ["no manual adjustment history yet"]
  };
}

function cooldownUntilFromSummary(
  summary: ParameterAdjustmentHistorySummary,
  cooldownDays: number
): string | undefined {
  if (!summary.latestAt) return undefined;
  const latest = new Date(summary.latestAt);
  if (Number.isNaN(latest.getTime())) return undefined;
  latest.setUTCDate(latest.getUTCDate() + cooldownDays);
  return latest.toISOString();
}

function isCooldownActive(cooldownUntil: string | undefined, now: Date): boolean {
  if (!cooldownUntil) return false;
  const until = new Date(cooldownUntil);
  if (Number.isNaN(until.getTime())) return false;
  return now.getTime() < until.getTime();
}
