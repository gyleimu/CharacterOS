import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  runDurableWriteBoundaryIntegrationAudit,
  scanDurableWriteBoundaryBypasses,
} from "../../src/db/audit/durableWriteBoundaryIntegrationAudit";

describe("P4.1.5-B2-2C Durable Write Boundary Integration Audit", () => {
  const result = runDurableWriteBoundaryIntegrationAudit();

  it("passes as a release-required structured audit", () => {
    expect(result.auditVersion).toBe("p4.1.5-b2-2c");
    expect(result.requiredForRelease).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("covers every write entrypoint in all four File Repositories", () => {
    expect(new Set(result.repositoryEntrypoints.map((entrypoint) => entrypoint.repositoryKind))).toEqual(
      new Set([
        "character-physics",
        "parameter-adjustment-history",
        "character-import-transition-history",
        "longitudinal-commit-audit",
      ]),
    );
    expect(result.repositoryEntrypoints).toHaveLength(12);
    expect(result.repositoryEntrypoints.every((entrypoint) => entrypoint.lockOwned)).toBe(true);
    expect(result.repositoryEntrypoints.every((entrypoint) => entrypoint.intentMarked)).toBe(true);
    expect(result.repositoryEntrypoints.every((entrypoint) => entrypoint.boundaryRouted)).toBe(true);
  });

  it("classifies delete and clear separately from ordinary validated writes", () => {
    const destructive = result.repositoryEntrypoints.filter((entrypoint) =>
      entrypoint.expectedIntent !== "validated-write"
    );

    expect(destructive).toHaveLength(5);
    expect(destructive.map((entrypoint) => entrypoint.expectedIntent)).toContain("destructive-delete");
    expect(destructive.map((entrypoint) => entrypoint.expectedIntent)).toContain("destructive-clear");
    expect(destructive.every((entrypoint) => entrypoint.passed)).toBe(true);
  });

  it("finds no production filesystem write that bypasses the approved adapters", () => {
    expect(result.approvedFilesystemMutationSites).toBeGreaterThan(0);
    expect(result.bypassFindings).toEqual([]);
  });

  it("detects aliased filesystem and durable-writer bypass calls", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "characteros-write-bypass-audit-"));
    try {
      const serviceDirectory = join(projectRoot, "src", "services");
      const appDirectory = join(projectRoot, "src", "app");
      mkdirSync(serviceDirectory, { recursive: true });
      mkdirSync(appDirectory, { recursive: true });
      writeFileSync(
        join(serviceDirectory, "filesystemBypass.ts"),
        'import { writeFileSync as persist } from "node:fs";\npersist("state.json", "{}");\n',
        "utf8",
      );
      writeFileSync(
        join(appDirectory, "writerBypass.ts"),
        'import { writeJsonObjectFileAtomically as persistState } from "../db/repositories/jsonFileStore";\npersistState({});\n',
        "utf8",
      );

      const scan = scanDurableWriteBoundaryBypasses(projectRoot);

      expect(scan.bypassFindings).toEqual([
        { filePath: "src/app/writerBypass.ts", line: 2, callName: "persistState" },
        { filePath: "src/services/filesystemBypass.ts", line: 2, callName: "persist" },
      ]);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("guards the complete shared writer sequence and service repository boundary", () => {
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "repository_writer_wiring", passed: true }),
      expect.objectContaining({ id: "full_atomic_writer_sequence", passed: true }),
      expect.objectContaining({ id: "service_repository_boundary", passed: true }),
      expect.objectContaining({ id: "no_production_write_bypass", passed: true }),
    ]));
  });
});
