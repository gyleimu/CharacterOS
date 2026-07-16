import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createParameterAdjustmentHistoryEntry } from "../../src/core/parameters/parameterAdjustmentHistory";
import {
  createDurableJsonEnvelope,
  serializeDurableJsonEnvelope,
} from "../../src/db/repositories/durableJsonEnvelope";
import { FileParameterAdjustmentHistoryRepository } from "../../src/db/repositories/parameterAdjustmentHistoryRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";

describe("FileParameterAdjustmentHistoryRepository", () => {
  it("persists adjustment history entries by character id", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const repository = new FileParameterAdjustmentHistoryRepository(filePath);
      const entry = createParameterAdjustmentHistoryEntry({
        characterId: "lin_fan",
        action: "apply",
        createdAt: "2026-06-20T00:00:00.000Z",
        trace: {
          status: "applied",
          snapshotId: "snapshot_1",
          appliedOperations: [],
          reasons: ["test"]
        }
      });

      repository.append(entry);

      expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({
        format: "characteros.durable-json",
        envelopeVersion: 1,
        repositoryKind: "parameter-adjustment-history",
        schemaVersion: 1,
        payload: { lin_fan: [entry] },
      });

      expect(new FileParameterAdjustmentHistoryRepository(filePath).list("lin_fan")).toHaveLength(1);
      expect(repository.list("other")).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("replaces adjustment history and retargets entries to the destination character", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const repository = new FileParameterAdjustmentHistoryRepository(filePath);
      const sourceEntry = createParameterAdjustmentHistoryEntry({
        characterId: "source_character",
        action: "apply",
        createdAt: "2026-06-20T00:00:00.000Z",
        trace: {
          status: "applied",
          snapshotId: "snapshot_1",
          appliedOperations: [],
          reasons: ["test"]
        }
      });

      repository.replace("target_character", [sourceEntry]);

      const targetHistory = new FileParameterAdjustmentHistoryRepository(filePath).list("target_character");
      expect(targetHistory).toHaveLength(1);
      expect(targetHistory[0]?.characterId).toBe("target_character");
      expect(repository.list("source_character")).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws CORRUPTED and preserves the file when JSON is invalid", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      writeFileSync(filePath, "{ bad json", "utf8");
      const repository = new FileParameterAdjustmentHistoryRepository(filePath);

      expectCorrupted(() => repository.list("lin_fan"));
      expect(readFileSync(filePath, "utf8")).toBe("{ bad json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads legacy-v0 history without rewriting it", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const entry = createParameterAdjustmentHistoryEntry({
        characterId: "lin_fan",
        action: "apply",
        createdAt: "2026-06-20T00:00:00.000Z",
        trace: {
          status: "applied",
          snapshotId: "snapshot_legacy",
          appliedOperations: [],
          reasons: ["legacy compatibility"],
        },
      });
      const legacy = `${JSON.stringify({ lin_fan: [entry] }, null, 2)}\n`;
      writeFileSync(filePath, legacy, "utf8");

      expect(new FileParameterAdjustmentHistoryRepository(filePath).list("lin_fan")).toEqual([entry]);
      expect(readFileSync(filePath, "utf8")).toBe(legacy);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a checksum-valid envelope with a structurally invalid payload without changing history", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const bytes = writeEnvelope(filePath, { lin_fan: "not-an-entry-array" });
      const repository = new FileParameterAdjustmentHistoryRepository(filePath);

      expectCorrupted(() => repository.list("lin_fan"));
      expect(readFileSync(filePath, "utf8")).toBe(bytes);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects domain-invalid history before clear can mutate persisted bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const entry = createParameterAdjustmentHistoryEntry({
        characterId: "lin_fan",
        action: "apply",
        createdAt: "2026-06-20T00:00:00.000Z",
        trace: {
          status: "applied",
          snapshotId: "snapshot_domain_invalid",
          appliedOperations: [],
          reasons: ["domain validation"],
        },
      });
      const bytes = writeEnvelope(filePath, { other_character: [entry] });
      const repository = new FileParameterAdjustmentHistoryRepository(filePath);

      expectCorrupted(() => repository.clear("other_character"));
      expect(readFileSync(filePath, "utf8")).toBe(bytes);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows domain warnings without rewriting persisted bytes", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-history-"));
    const filePath = join(dir, "history.json");
    try {
      const entry = createParameterAdjustmentHistoryEntry({
        characterId: "lin_fan",
        action: "apply",
        createdAt: "2026-06-20T00:00:00.000Z",
        trace: {
          status: "applied",
          snapshotId: "snapshot_warning",
          appliedOperations: [],
          reasons: ["warning pass-through"],
        },
      });
      const warningEntry = {
        ...entry,
        operationCount: 2,
        targetPaths: ["coordinate.trust", "coordinate.trust"],
      };
      const bytes = writeEnvelope(filePath, { lin_fan: [warningEntry] });

      expect(new FileParameterAdjustmentHistoryRepository(filePath).list("lin_fan"))
        .toEqual([warningEntry]);
      expect(readFileSync(filePath, "utf8")).toBe(bytes);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function writeEnvelope(filePath: string, payload: Record<string, unknown>): string {
  const envelope = createDurableJsonEnvelope({
    repositoryKind: "parameter-adjustment-history",
    schemaVersion: 1,
    payload,
  });
  const bytes = `${serializeDurableJsonEnvelope(envelope)}\n`;
  writeFileSync(filePath, bytes, "utf8");
  return bytes;
}

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
