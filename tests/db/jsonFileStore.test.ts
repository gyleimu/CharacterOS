import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getRepositoryBackupPath,
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  RepositoryFileError,
  writeJsonObjectFileAtomically,
} from "../../src/db/repositories/jsonFileStore";

const LABEL = "test repository";

describe("jsonFileStore", () => {
  it("returns an explicit NOT_FOUND result for a genuinely missing file", () => {
    withTempFile((filePath) => {
      expect(readJsonObjectFile({ filePath, repositoryLabel: LABEL })).toEqual({
        status: "not_found",
        code: "NOT_FOUND",
        filePath,
      });
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace", "  \r\n"],
    ["invalid syntax", "{ bad json"],
    ["non-object root", "[]"],
  ])("classifies %s content as CORRUPTED", (_label, content) => {
    withTempFile((filePath) => {
      writeFileSync(filePath, content, "utf8");
      const error = captureError(() => readJsonObjectFile({ filePath, repositoryLabel: LABEL }));

      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect(readFileSync(filePath, "utf8")).toBe(content);
    });
  });

  it("atomically replaces the primary file and retains the previous valid document", () => {
    withTempFile((filePath) => {
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 1 } });
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 2 } });

      const current = readJsonObjectFile<Record<string, number>>({ filePath, repositoryLabel: LABEL });
      const backup = readJsonObjectFile<Record<string, number>>({
        filePath: getRepositoryBackupPath(filePath),
        repositoryLabel: LABEL,
      });
      expect(current.status === "found" ? current.value.version : undefined).toBe(2);
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("creates a recovery snapshot on the first successful write", () => {
    withTempFile((filePath) => {
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 1 } });

      const backup = readJsonObjectFile<Record<string, number>>({
        filePath: getRepositoryBackupPath(filePath),
        repositoryLabel: LABEL,
      });
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("refuses to overwrite corrupt primary content and reports a valid recovery snapshot", () => {
    withTempFile((filePath) => {
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 1 } });
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 2 } });
      writeFileSync(filePath, "{ truncated", "utf8");

      const error = captureError(() =>
        writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 3 } })
      );
      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect((error as RepositoryFileError).recoverySnapshotAvailable).toBe(true);
      expect(readFileSync(filePath, "utf8")).toBe("{ truncated");

      const backup = readJsonObjectFile<Record<string, number>>({
        filePath: getRepositoryBackupPath(filePath),
        repositoryLabel: LABEL,
      });
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("fails closed when the primary file is missing but a backup remains", () => {
    withTempFile((filePath) => {
      writeFileSync(getRepositoryBackupPath(filePath), "{\"version\":1}\n", "utf8");
      const error = captureError(() => readJsonObjectFile({ filePath, repositoryLabel: LABEL }));

      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect((error as RepositoryFileError).recoverySnapshotAvailable).toBe(true);
    });
  });

  it("removes primary and backup together for an explicit clear", () => {
    withTempFile((filePath) => {
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 1 } });
      writeJsonObjectFileAtomically({ filePath, repositoryLabel: LABEL, value: { version: 2 } });

      removeJsonObjectFileAndBackup({ filePath, repositoryLabel: LABEL });

      expect(readJsonObjectFile({ filePath, repositoryLabel: LABEL }).status).toBe("not_found");
    });
  });
});

function withTempFile(action: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "characteros-json-store-"));
  try {
    action(join(dir, "store.json"));
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
