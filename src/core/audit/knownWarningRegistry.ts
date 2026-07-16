/**
 * V10.77 — Known Warning Registry
 *
 * Tracks warnings across all audit suites with status tracking:
 *   - active: currently firing, not yet addressed
 *   - allowed: acknowledged known limitation with rationale
 *   - resolved: previously active, now fixed (regression alert if reappears)
 */
export type WarningStatus = "active" | "allowed" | "resolved";

export interface KnownWarning {
  warningId: string;
  sourceSuite: string;
  severity: "low" | "medium" | "high";
  status: WarningStatus;
  firstSeenVersion: string;
  resolvedVersion?: string;
  rationale: string;
  recommendedFix: string;
  /** Pattern to match against warning messages (substring or regex). */
  matchingPattern: string;
}

export interface WarningMatch {
  warning: string;
  matched: KnownWarning;
}

export interface WarningRegistryResult {
  /** Warnings that match known registry entries. */
  matched: WarningMatch[];
  /** Warnings that do NOT match any registry entry (unknown/new). */
  unmatched: string[];
  /** Warnings matched to "allowed" entries (noise filtered). */
  allowedWarnings: string[];
  /** Warnings matched to "active" entries (need attention). */
  activeWarnings: string[];
  /** Warnings matched to "resolved" entries (regression alert). */
  resolvedWarningRegressions: string[];
}

// ── Registry ──

const KNOWN_WARNINGS: KnownWarning[] = [
  {
    warningId: "accumulation_betrayal_near_linear_growth",
    sourceSuite: "accumulation",
    severity: "medium",
    status: "resolved",
    firstSeenVersion: "10.72.0",
    resolvedVersion: "13.integration-hardening",
    rationale:
      "Runtime events now create one MemoryNode with repetitionCount=1, preventing cumulative " +
      "cluster age from being counted once per memory. Cluster force no longer mixes absolute " +
      "core coordinates with directional impact vectors, and boundary amplification saturates.",
    recommendedFix:
      "Resolved. Keep the long-horizon accumulation and unique-memory regression tests active.",
    matchingPattern: "betrayalAccumulation WARN: personality accumulation shows near-linear growth",
  },
  {
    warningId: "accumulation_neutral_near_linear_growth",
    sourceSuite: "accumulation",
    severity: "low",
    status: "resolved",
    firstSeenVersion: "10.71.0",
    resolvedVersion: "10.77.0",
    rationale:
      "V10.77: raised the absolute magnitude threshold for linear-growth detection " +
      "from 0.02 to 0.04. Neutral events accumulating <0.04 personality distance over " +
      "5 events are trivially stable — the growth pattern is irrelevant at that magnitude.",
    recommendedFix:
      "Already fixed in V10.77: longTermAccumulationAudit linear-growth check now requires " +
      "total distance > 0.04 before flagging.",
    matchingPattern: "neutralAccumulation WARN: personality accumulation shows near-linear growth",
  },
  {
    warningId: "coverage_neutral_relevance_overreaction",
    sourceSuite: "coverage",
    severity: "low",
    status: "resolved",
    firstSeenVersion: "10.73.0",
    resolvedVersion: "10.77.0",
    rationale:
      "V10.77: tiered overreaction check in coverage audit. Events with correctly low " +
      "relevance (<0.3) now use a lenient overreaction threshold (0.45) since low-relevance " +
      "events shouldn't be heavily penalized for moderate decision surface response. " +
      "Neutral events correctly show 0.18 relevance — the decision surface is not being " +
      "significantly affected.",
    recommendedFix:
      "Already fixed in V10.77: eventTypeCoverageAudit uses tiered overreaction limits.",
    matchingPattern: "neutral on study: expected low relevance",
  },
];

// ── Registry operations ──

export function classifyWarnings(
  rawWarnings: string[],
  registry: KnownWarning[] = KNOWN_WARNINGS,
): WarningRegistryResult {
  const matched: WarningMatch[] = [];
  const unmatched: string[] = [];
  const allowedWarnings: string[] = [];
  const activeWarnings: string[] = [];
  const resolvedWarningRegressions: string[] = [];

  for (const warning of rawWarnings) {
    let found = false;
    for (const entry of registry) {
      if (warning.includes(entry.matchingPattern)) {
        found = true;
        matched.push({ warning, matched: entry });

        if (entry.status === "allowed") {
          allowedWarnings.push(warning);
        } else if (entry.status === "active") {
          activeWarnings.push(warning);
        } else if (entry.status === "resolved") {
          resolvedWarningRegressions.push(warning);
        }
        break;
      }
    }
    if (!found) {
      unmatched.push(warning);
      activeWarnings.push(warning); // Unknown warnings are active by default
    }
  }

  return {
    matched,
    unmatched,
    allowedWarnings,
    activeWarnings,
    resolvedWarningRegressions,
  };
}

export function getKnownWarningSummary(
  rawWarnings: string[],
): {
  activeCount: number;
  allowedCount: number;
  resolvedRegressions: number;
  unknownCount: number;
  totalCount: number;
} {
  const result = classifyWarnings(rawWarnings);
  return {
    activeCount: result.activeWarnings.length,
    allowedCount: result.allowedWarnings.length,
    resolvedRegressions: result.resolvedWarningRegressions.length,
    unknownCount: result.unmatched.length,
    totalCount: rawWarnings.length,
  };
}

export function getRegistry(): readonly KnownWarning[] {
  return KNOWN_WARNINGS;
}

export function findWarning(pattern: string): KnownWarning | undefined {
  return KNOWN_WARNINGS.find((w) => w.warningId === pattern || w.matchingPattern === pattern);
}
