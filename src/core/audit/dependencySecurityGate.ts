export type DependencySeverity = "info" | "low" | "moderate" | "high" | "critical";

export interface NpmAuditVulnerability {
  readonly name: string;
  readonly severity: DependencySeverity;
}

export interface NpmAuditReport {
  readonly vulnerabilities: Record<string, NpmAuditVulnerability>;
  readonly metadata?: {
    readonly vulnerabilities?: Partial<Record<DependencySeverity | "total", number>>;
  };
}

export interface DependencyRiskEntry {
  readonly id: string;
  readonly package: string;
  readonly severity: DependencySeverity;
  readonly status: string;
}

export interface DependencyRiskRegister {
  readonly registryVersion: string;
  readonly summary: Partial<Record<DependencySeverity | "total" | "releaseBlocking", number>>;
  readonly risks: DependencyRiskEntry[];
}

export interface DependencySecurityGateResult {
  readonly version: "1.0.0";
  readonly liveSummary: Record<DependencySeverity | "total", number>;
  readonly registeredFindings: Array<{
    readonly package: string;
    readonly severity: DependencySeverity;
    readonly riskId: string;
  }>;
  readonly unregisteredFindings: Array<{
    readonly package: string;
    readonly severity: DependencySeverity;
  }>;
  readonly blockingFindings: Array<{
    readonly package: string;
    readonly severity: DependencySeverity;
  }>;
  readonly resolvedCandidates: string[];
  readonly registryCountMatches: boolean;
  readonly failures: string[];
  readonly gateVerdict: {
    readonly level: "PASS" | "FAIL";
    readonly passed: boolean;
  };
}

const SEVERITIES: DependencySeverity[] = ["info", "low", "moderate", "high", "critical"];

export function evaluateDependencySecurityGate(
  audit: NpmAuditReport,
  registry: DependencyRiskRegister,
): DependencySecurityGateResult {
  const live = Object.values(audit.vulnerabilities);
  const liveSummary = Object.fromEntries(
    [...SEVERITIES.map((severity) => [severity, live.filter((item) => item.severity === severity).length]), ["total", live.length]],
  ) as Record<DependencySeverity | "total", number>;
  const registeredFindings: DependencySecurityGateResult["registeredFindings"] = [];
  const unregisteredFindings: DependencySecurityGateResult["unregisteredFindings"] = [];
  const blockingFindings: DependencySecurityGateResult["blockingFindings"] = [];
  const failures: string[] = [];

  for (const finding of live) {
    const registration = registry.risks.find(
      (risk) =>
        risk.package === finding.name &&
        risk.severity === finding.severity &&
        risk.status !== "resolved",
    );
    if (registration) {
      registeredFindings.push({
        package: finding.name,
        severity: finding.severity,
        riskId: registration.id,
      });
    } else {
      unregisteredFindings.push({ package: finding.name, severity: finding.severity });
      failures.push(`unregistered ${finding.severity} dependency risk: ${finding.name}`);
    }

    if (finding.severity === "high" || finding.severity === "critical") {
      blockingFindings.push({ package: finding.name, severity: finding.severity });
      failures.push(`release-blocking ${finding.severity} dependency risk: ${finding.name}`);
    }
  }

  const registryCountMatches = SEVERITIES.every(
    (severity) => (registry.summary[severity] ?? 0) === liveSummary[severity],
  ) && (registry.summary.total ?? 0) === liveSummary.total;
  if (!registryCountMatches) failures.push("dependency risk register counts do not match live npm audit");

  const liveKeys = new Set(live.map((finding) => `${finding.name}|${finding.severity}`));
  const resolvedCandidates = registry.risks
    .filter((risk) => risk.status !== "resolved" && !liveKeys.has(`${risk.package}|${risk.severity}`))
    .map((risk) => risk.id);
  const passed = failures.length === 0;

  return {
    version: "1.0.0",
    liveSummary,
    registeredFindings,
    unregisteredFindings,
    blockingFindings,
    resolvedCandidates,
    registryCountMatches,
    failures,
    gateVerdict: { level: passed ? "PASS" : "FAIL", passed },
  };
}
