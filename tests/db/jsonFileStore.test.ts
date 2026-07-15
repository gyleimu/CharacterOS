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
const REPOSITORY_KIND = "character-physics" as const;
const SCHEMA_VERSION = 1;

describe("jsonFileStore", () => {
  it("returns an explicit NOT_FOUND result for a genuinely missing file", () => {
    withTempFile((filePath) => {
      expect(readStore(filePath)).toEqual({
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
      const error = captureError(() => readStore(filePath));

      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect(readFileSync(filePath, "utf8")).toBe(content);
    });
  });

  it("atomically replaces the primary file and retains the previous valid document", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });
      writeStore(filePath, { version: 2 });

      const current = readStore<Record<string, number>>(filePath);
      const backup = readStore<Record<string, number>>(getRepositoryBackupPath(filePath));
      expect(current.status === "found" ? current.value.version : undefined).toBe(2);
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("creates a recovery snapshot on the first successful write", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });

      const backup = readStore<Record<string, number>>(getRepositoryBackupPath(filePath));
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("refuses to overwrite corrupt primary content and reports a valid recovery snapshot", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });
      writeStore(filePath, { version: 2 });
      writeFileSync(filePath, "{ truncated", "utf8");

      const error = captureError(() =>
        writeStore(filePath, { version: 3 })
      );
      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect((error as RepositoryFileError).recoverySnapshotAvailable).toBe(true);
      expect(readFileSync(filePath, "utf8")).toBe("{ truncated");

      const backup = readStore<Record<string, number>>(getRepositoryBackupPath(filePath));
      expect(backup.status === "found" ? backup.value.version : undefined).toBe(1);
    });
  });

  it("fails closed when the primary file is missing but a backup remains", () => {
    withTempFile((filePath) => {
      writeFileSync(getRepositoryBackupPath(filePath), "{\"version\":1}\n", "utf8");
      const error = captureError(() => readStore(filePath));

      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("CORRUPTED");
      expect((error as RepositoryFileError).recoverySnapshotAvailable).toBe(true);
    });
  });

  it("removes primary and backup together for an explicit clear", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });
      writeStore(filePath, { version: 2 });

      removeJsonObjectFileAndBackup({
        filePath,
        repositoryLabel: LABEL,
        repositoryKind: REPOSITORY_KIND,
        schemaVersion: SCHEMA_VERSION,
      });

      expect(readStore(filePath).status).toBe("not_found");
    });
  });

  it("writes a checksum-verified envelope", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });

      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        format: "characteros.durable-json",
        envelopeVersion: 1,
        repositoryKind: REPOSITORY_KIND,
        schemaVersion: SCHEMA_VERSION,
        payload: { version: 1 },
      });
      expect(readStore(filePath)).toMatchObject({
        status: "found",
        format: "envelope-v1",
        schemaVersion: SCHEMA_VERSION,
        value: { version: 1 },
      });
    });
  });

  it("reads legacy-v0 without modifying bytes and upgrades only on a normal write", () => {
    withTempFile((filePath) => {
      const legacy = '{"version":1}\n';
      writeFileSync(filePath, legacy, "utf8");

      expect(readStore<Record<string, number>>(filePath)).toMatchObject({
        status: "found",
        format: "legacy-v0",
        schemaVersion: 0,
        value: { version: 1 },
      });
      expect(readFileSync(filePath, "utf8")).toBe(legacy);

      writeStore(filePath, { version: 2 });
      expect(readStore<Record<string, number>>(filePath)).toMatchObject({
        status: "found",
        format: "envelope-v1",
        value: { version: 2 },
      });
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(legacy);
    });
  });

  it("fails closed on checksum mismatch with a stable incident id", () => {
    withTempFile((filePath) => {
      writeStore(filePath, { version: 1 });
      const envelope = JSON.parse(readFileSync(filePath, "utf8")) as {
        payload: { version: number };
      };
      envelope.payload.version = 2;
      writeFileSync(filePath, JSON.stringify(envelope), "utf8");

      const first = captureError(() => readStore(filePath));
      const second = captureError(() => readStore(filePath));
      expect(first).toBeInstanceOf(RepositoryFileError);
      expect((first as RepositoryFileError).code).toBe("CORRUPTED");
      expect((first as RepositoryFileError).repositoryKind).toBe(REPOSITORY_KIND);
      expect((first as RepositoryFileError).checksum?.expected).toBeTruthy();
      expect((first as RepositoryFileError).checksum?.actual).toBeTruthy();
      expect((first as RepositoryFileError).incidentId).toBe((second as RepositoryFileError).incidentId);
      expect((first as RepositoryFileError).incidentId).toMatch(/^dstate-character-physics-[a-f0-9]{16}$/u);
    });
  });

  it("reports MIGRATION_REQUIRED for an unsupported schema without rewriting the file", () => {
    withTempFile((filePath) => {
      writeJsonObjectFileAtomically({
        filePath,
        repositoryLabel: LABEL,
        repositoryKind: REPOSITORY_KIND,
        schemaVersion: 2,
        value: { version: 1 },
      });
      const original = readFileSync(filePath, "utf8");

      const error = captureError(() => readStore(filePath));
      expect(error).toBeInstanceOf(RepositoryFileError);
      expect((error as RepositoryFileError).code).toBe("MIGRATION_REQUIRED");
      expect(readFileSync(filePath, "utf8")).toBe(original);
    });
  });
});

function readStore<T extends Record<string, unknown> = Record<string, unknown>>(filePath: string) {
  return readJsonObjectFile<T>({
    filePath,
    repositoryLabel: LABEL,
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
  });
}

function writeStore<T extends Record<string, unknown>>(filePath: string, value: T): void {
  writeJsonObjectFileAtomically({
    filePath,
    repositoryLabel: LABEL,
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    value,
  });
}

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
