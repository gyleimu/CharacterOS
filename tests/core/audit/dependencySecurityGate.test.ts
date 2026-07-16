import { describe, expect, it } from "vitest";
import {
  evaluateDependencySecurityGate,
  type DependencyRiskRegister,
  type NpmAuditReport,
} from "../../../src/core/audit/dependencySecurityGate";

describe("Dependency Security Gate", () => {
  it("passes when low/moderate findings are registered and no high/critical exist", () => {
    const result = evaluateDependencySecurityGate(
      audit({ esbuild: "low", postcss: "moderate", next: "moderate" }),
      registry({ low: 1, moderate: 2 }, [
        risk("esbuild", "low"),
        risk("postcss", "moderate"),
        risk("next", "moderate"),
      ]),
    );
    expect(result.gateVerdict).toEqual({ level: "PASS", passed: true });
    expect(result.registeredFindings).toHaveLength(3);
    expect(result.registryCountMatches).toBe(true);
  });

  it("fails on high severity even when registered", () => {
    const result = evaluateDependencySecurityGate(
      audit({ dangerous: "high" }),
      registry({ high: 1 }, [risk("dangerous", "high")]),
    );
    expect(result.gateVerdict.level).toBe("FAIL");
    expect(result.blockingFindings).toEqual([{ package: "dangerous", severity: "high" }]);
  });

  it("fails on critical severity", () => {
    const result = evaluateDependencySecurityGate(
      audit({ dangerous: "critical" }),
      registry({ critical: 1 }, [risk("dangerous", "critical")]),
    );
    expect(result.gateVerdict.level).toBe("FAIL");
  });

  it("fails when a moderate finding is not registered", () => {
    const result = evaluateDependencySecurityGate(
      audit({ new_package: "moderate" }),
      registry({ moderate: 1 }, []),
    );
    expect(result.unregisteredFindings).toEqual([{ package: "new_package", severity: "moderate" }]);
    expect(result.gateVerdict.level).toBe("FAIL");
  });

  it("fails when a low finding is not registered for monitoring", () => {
    const result = evaluateDependencySecurityGate(
      audit({ new_package: "low" }),
      registry({ low: 1 }, []),
    );
    expect(result.gateVerdict.level).toBe("FAIL");
  });

  it("fails when registry counts are stale", () => {
    const result = evaluateDependencySecurityGate(
      audit({ postcss: "moderate" }),
      registry({ moderate: 2 }, [risk("postcss", "moderate")]),
    );
    expect(result.registryCountMatches).toBe(false);
    expect(result.failures).toContain("dependency risk register counts do not match live npm audit");
  });

  it("reports registered entries whose live dependency finding disappeared", () => {
    const result = evaluateDependencySecurityGate(
      audit({}),
      registry({}, [{ ...risk("old_package", "low"), id: "old-risk" }]),
    );
    expect(result.resolvedCandidates).toEqual(["old-risk"]);
  });

  it("is deterministic and does not mutate audit or registry input", () => {
    const auditInput = audit({ postcss: "moderate" });
    const registryInput = registry({ moderate: 1 }, [risk("postcss", "moderate")]);
    const before = JSON.stringify({ auditInput, registryInput });
    expect(evaluateDependencySecurityGate(auditInput, registryInput)).toEqual(
      evaluateDependencySecurityGate(auditInput, registryInput),
    );
    expect(JSON.stringify({ auditInput, registryInput })).toBe(before);
  });
});

function audit(findings: Record<string, "low" | "moderate" | "high" | "critical">): NpmAuditReport {
  return {
    vulnerabilities: Object.fromEntries(
      Object.entries(findings).map(([name, severity]) => [name, { name, severity }]),
    ),
  };
}

function registry(
  counts: Partial<Record<"low" | "moderate" | "high" | "critical", number>>,
  risks: DependencyRiskRegister["risks"],
): DependencyRiskRegister {
  return {
    registryVersion: "test",
    summary: {
      info: 0,
      low: counts.low ?? 0,
      moderate: counts.moderate ?? 0,
      high: counts.high ?? 0,
      critical: counts.critical ?? 0,
      total: Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0),
    },
    risks,
  };
}

function risk(
  packageName: string,
  severity: "low" | "moderate" | "high" | "critical",
): DependencyRiskRegister["risks"][number] {
  return { id: `${packageName}-${severity}`, package: packageName, severity, status: "monitoring" };
}
