import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeCharacterImportApplication } from "../../src/core/export/characterImportApply";
import { createCharacterImportTransitionHistoryEntry } from "../../src/core/export/characterImportTransitionHistory";
import {
  createDurableJsonEnvelope,
  serializeDurableJsonEnvelope,
} from "../../src/db/repositories/durableJsonEnvelope";
import { FileCharacterImportTransitionHistoryRepository } from "../../src/db/repositories/characterImportTransitionHistoryRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";

describe("FileCharacterImportTransitionHistoryRepository", () => {
  it("returns an empty history when the store is genuinely missing", () => {
    withTempFile((filePath) => {
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);
      expect(repository.list("lin_fan")).toEqual([]);
    });
  });

  it("persists transition history in a durable envelope", () => {
    withTempFile((filePath) => {
      const trace = authorizeCharacterImportApplication({
        targetCharacterId: "lin_fan",
        package: {},
      });
      const entry = createCharacterImportTransitionHistoryEntry({
        characterId: "lin_fan",
        trace,
        createdAt: "2026-07-16T00:00:00.000Z",
      });
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);

      repository.append(entry);

      expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({
        format: "characteros.durable-json",
        envelopeVersion: 1,
        repositoryKind: "character-import-transition-history",
        schemaVersion: 1,
        payload: { lin_fan: [entry] },
      });
      expect(repository.list("lin_fan")).toEqual([entry]);
    });
  });

  it("throws CORRUPTED and preserves invalid JSON", () => {
    withTempFile((filePath) => {
      writeFileSync(filePath, "{ bad json", "utf8");
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);
      const error = captureError(() => repository.list("lin_fan"));

      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect(readFileSync(filePath, "utf8")).toBe("{ bad json");
    });
  });

  it("reads legacy-v0 history without rewriting it", () => {
    withTempFile((filePath) => {
      const legacy = '{\n  "lin_fan": []\n}\n';
      writeFileSync(filePath, legacy, "utf8");

      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);
      expect(repository.list("lin_fan")).toEqual([]);
      expect(readFileSync(filePath, "utf8")).toBe(legacy);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    });
  });

  it("rejects a checksum-valid envelope with a structurally invalid payload without changing history", () => {
    withTempFile((filePath) => {
      const bytes = writeEnvelope(filePath, { lin_fan: "not-an-entry-array" });
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);

      expectCorrupted(() => repository.list("lin_fan"));
      expect(readFileSync(filePath, "utf8")).toBe(bytes);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    });
  });

  it("rejects domain-invalid history before clear can mutate persisted bytes", () => {
    withTempFile((filePath) => {
      const trace = authorizeCharacterImportApplication({
        targetCharacterId: "lin_fan",
        package: {},
      });
      const entry = createCharacterImportTransitionHistoryEntry({
        characterId: "lin_fan",
        trace,
        createdAt: "2026-07-16T00:00:00.000Z",
      });
      const bytes = writeEnvelope(filePath, { other_character: [entry] });
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);

      expectCorrupted(() => repository.clear("other_character"));
      expect(readFileSync(filePath, "utf8")).toBe(bytes);
      expect(existsSync(`${filePath}.bak`)).toBe(false);
    });
  });
});

function writeEnvelope(filePath: string, payload: Record<string, unknown>): string {
  const envelope = createDurableJsonEnvelope({
    repositoryKind: "character-import-transition-history",
    schemaVersion: 1,
    payload,
  });
  const bytes = `${serializeDurableJsonEnvelope(envelope)}\n`;
  writeFileSync(filePath, bytes, "utf8");
  return bytes;
}

function withTempFile(action: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "characteros-import-history-"));
  try {
    action(join(dir, "history.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function captureError(action: () => unknown): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

function expectCorrupted(action: () => unknown): void {
  const error = captureError(action);
  expect(error).toBeInstanceOf(RepositoryFileError);
  expect((error as RepositoryFileError).code).toBe("CORRUPTED");
}
