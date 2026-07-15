import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type LongitudinalCommitAuditEntry,
  markLongitudinalCommitAuditApplied,
} from "../../src/core/life/longitudinalCommitAudit";
import {
  FileLongitudinalCommitAuditRepository,
  InMemoryLongitudinalCommitAuditRepository,
} from "../../src/db/repositories/longitudinalCommitAuditRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";

function digest(value: string) {
  return {
    algorithm: "sha256" as const,
    canonicalization: "characteros-longitudinal-json-v1" as const,
    value,
  };
}

function summary(memoryCount: number) {
  return {
    memoryCount,
    beliefCount: 0,
    trust: 0.5,
    fear: 0.5,
    control: 0.5,
    openness: 0.5,
    conscientiousness: 0.5,
    boundaryStress: 0,
    boundaryIntegrity: 1,
    metaResilience: 0.5,
    metaSelfControl: 0.5,
  };
}

function entry(overrides: Partial<LongitudinalCommitAuditEntry> = {}): LongitudinalCommitAuditEntry {
  const base: LongitudinalCommitAuditEntry = {
    version: "v10.24",
    id: "audit-1",
    characterId: "lin_fan",
    simulationId: "longsim-1",
    status: "previewed",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
    requestDigest: digest("request"),
    baseStateFingerprint: digest("base"),
    finalStateFingerprint: digest("final"),
    commitPolicy: { enabled: true, commitDreams: true },
    changedPaths: ["memories[0]"],
    generatedMemoryIds: ["life-dream-1"],
    beforeSummary: summary(0),
    afterSummary: summary(1),
    governanceStatus: "pass",
    governanceBlockers: [],
    governanceWarnings: [],
    rollbackPlan: {
      id: "rollback-1",
      simulationId: "longsim-1",
      type: "remove_generated_memories",
      generatedMemoryIds: ["life-dream-1"],
      baseStateFingerprint: digest("base"),
      finalStateFingerprint: digest("final"),
      staleWritePolicy: "block_if_changed",
      warnings: [],
      reasons: ["test rollback"],
    },
    warnings: [],
    reasons: ["test audit"],
  };
  return { ...base, ...overrides };
}

describe("InMemoryLongitudinalCommitAuditRepository", () => {
  it("appends, lists, gets, updates, and clears audit entries", () => {
    const repository = new InMemoryLongitudinalCommitAuditRepository();
    const first = entry();
    repository.append(first);
    repository.append(entry({ id: "audit-2", simulationId: "longsim-2", characterId: "other" }));

    expect(repository.list("lin_fan")).toHaveLength(1);
    expect(repository.get("lin_fan", "audit-1")).toBe(first);
    expect(repository.getBySimulationId("lin_fan", "longsim-1")).toBe(first);

    const updated = repository.update("lin_fan", "audit-1", (current) =>
      markLongitudinalCommitAuditApplied(current, "2026-06-28T01:00:00.000Z")
    );
    expect(updated?.status).toBe("applied");
    expect(repository.get("lin_fan", "audit-1")?.status).toBe("applied");

    repository.clear("lin_fan");
    expect(repository.list("lin_fan")).toHaveLength(0);
    expect(repository.list("other")).toHaveLength(1);
  });
});

describe("FileLongitudinalCommitAuditRepository", () => {
  it("persists audit entries by character id", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-longcommit-"));
    const filePath = join(dir, "audit.json");
    try {
      const repository = new FileLongitudinalCommitAuditRepository(filePath);
      repository.append(entry());

      expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({
        format: "characteros.durable-json",
        envelopeVersion: 1,
        repositoryKind: "longitudinal-commit-audit",
        schemaVersion: 1,
        payload: { lin_fan: [entry()] },
      });

      const reloaded = new FileLongitudinalCommitAuditRepository(filePath);
      expect(reloaded.list("lin_fan")).toHaveLength(1);
      expect(reloaded.getBySimulationId("lin_fan", "longsim-1")?.generatedMemoryIds)
        .toEqual(["life-dream-1"]);
      expect(reloaded.list("other")).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates persisted audit entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-longcommit-"));
    const filePath = join(dir, "audit.json");
    try {
      const repository = new FileLongitudinalCommitAuditRepository(filePath);
      repository.append(entry());
      repository.update("lin_fan", "audit-1", (current) =>
        markLongitudinalCommitAuditApplied(current, "2026-06-28T01:00:00.000Z")
      );

      const updated = new FileLongitudinalCommitAuditRepository(filePath).get("lin_fan", "audit-1");
      expect(updated?.status).toBe("applied");
      expect(updated?.appliedAt).toBe("2026-06-28T01:00:00.000Z");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws CORRUPTED without moving or replacing the corrupt audit file", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-longcommit-"));
    const filePath = join(dir, "audit.json");
    try {
      writeFileSync(filePath, "{ bad json", "utf8");
      const repository = new FileLongitudinalCommitAuditRepository(filePath);

      expectCorrupted(() => repository.list("lin_fan"));
      expect(readFileSync(filePath, "utf8")).toBe("{ bad json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads legacy-v0 audit history without rewriting it", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-longcommit-"));
    const filePath = join(dir, "audit.json");
    try {
      const legacy = `${JSON.stringify({ lin_fan: [entry()] }, null, 2)}\n`;
      writeFileSync(filePath, legacy, "utf8");

      const repository = new FileLongitudinalCommitAuditRepository(filePath);
      expect(repository.list("lin_fan")).toEqual([entry()]);
      expect(readFileSync(filePath, "utf8")).toBe(legacy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function expectCorrupted(action: () => unknown): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RepositoryFileError);
  expect((caught as RepositoryFileError).code).toBe("CORRUPTED");
}
