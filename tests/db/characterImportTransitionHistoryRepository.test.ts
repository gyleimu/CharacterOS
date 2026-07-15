import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileCharacterImportTransitionHistoryRepository } from "../../src/db/repositories/characterImportTransitionHistoryRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";

describe("FileCharacterImportTransitionHistoryRepository", () => {
  it("returns an empty history when the store is genuinely missing", () => {
    withTempFile((filePath) => {
      const repository = new FileCharacterImportTransitionHistoryRepository(filePath);
      expect(repository.list("lin_fan")).toEqual([]);
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
});

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
