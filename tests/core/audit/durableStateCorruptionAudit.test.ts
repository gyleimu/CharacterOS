import { describe, expect, it } from "vitest";
import { runDurableStateCorruptionAudit } from "../../../src/core/audit/durableStateCorruptionAudit";

describe("Durable State P4.1 corruption audit", () => {
  const result = runDurableStateCorruptionAudit();

  it("produces a release-required structured audit", () => {
    expect(result.auditVersion).toBe("p4.1.0");
    expect(result.requiredForRelease).toBe(true);
    expect(result.checks).toHaveLength(8);
  });

  it("passes every corruption-protection check", () => {
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("guards strict reads, atomic writes, backups, and service fail-closed behavior", () => {
    const checkIds = result.checks.map((check) => check.id);
    expect(checkIds).toEqual(expect.arrayContaining([
      "strict_reader_adopted",
      "atomic_writer_adopted",
      "no_direct_parse_fallback",
      "error_semantics",
      "synced_atomic_replace",
      "last_valid_backup",
      "service_fail_closed",
    ]));
  });
});
