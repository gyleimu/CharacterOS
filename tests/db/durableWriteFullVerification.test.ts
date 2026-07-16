import {
  fsyncSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDurableJsonEnvelope,
  serializeDurableJsonEnvelope,
} from "../../src/db/repositories/durableJsonEnvelope";
import {
  getRepositoryBackupPath,
  readJsonObjectFile,
  RepositoryFileError,
  writeJsonObjectFileAtomically,
  type RepositoryFileStoreWriteHooks,
  type RepositoryWriteFileTarget,
} from "../../src/db/repositories/jsonFileStore";
import {
  buildDurableValidationResult,
  type DurableValidationIssue,
  type RepositoryValidationSpec,
} from "../../src/db/repositories/durableValidationTypes";

const LABEL = "write full verification test repository";
const REPOSITORY_KIND = "character-physics" as const;
const SCHEMA_VERSION = 1;
const REPOSITORY_SPEC = createValidationSpec();

describe("Durable write full verification", () => {
  it("preserves caller data and creates fully verified primary and backup files", () => {
    withTempFile((filePath) => {
      const first = payload(1);
      const second = payload(2);
      const firstBefore = structuredClone(first);
      const secondBefore = structuredClone(second);

      writeValue(filePath, first);
      const firstPrimaryBytes = readFileSync(filePath, "utf8");
      writeValue(filePath, second);

      expect(readValue(filePath)).toEqual(second);
      expect(readValue(getRepositoryBackupPath(filePath))).toEqual(first);
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(firstPrimaryBytes);
      expect(first).toEqual(firstBefore);
      expect(second).toEqual(secondBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("rejects a checksum-valid but structurally invalid temp without changing primary or backup", () => {
    withSeededStore((filePath, primaryBefore, backupBefore) => {
      const outgoing = payload(3);
      const outgoingBefore = structuredClone(outgoing);

      const error = captureRepositoryError(() => writeValue(filePath, outgoing, {
        afterFsync: (target, writtenPath) => {
          if (target === "temp") {
            rewriteEnvelope(writtenPath, {
              version: 99,
              structurallyValid: false,
              domainValid: true,
            });
          }
        },
      }));

      expect(error.code).toBe("CORRUPTED");
      expect(error.message).toContain("PAYLOAD_REJECTED");
      expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(backupBefore);
      expect(outgoing).toEqual(outgoingBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("rejects a checksum-valid but domain-invalid backup temp without replacing the old backup", () => {
    withSeededStore((filePath, primaryBefore, backupBefore) => {
      const error = captureRepositoryError(() => writeValue(filePath, payload(3), {
        afterFsync: (target, writtenPath) => {
          if (target === "backup-temp") {
            rewriteEnvelope(writtenPath, {
              version: 99,
              structurallyValid: true,
              domainValid: false,
            });
          }
        },
      }));

      expect(error.code).toBe("CORRUPTED");
      expect(error.message).toContain("DOMAIN_REJECTED");
      expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(backupBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("detects a domain-invalid primary after atomic replacement and retains the prior valid primary as backup", () => {
    withSeededStore((filePath, primaryBefore) => {
      const outgoing = payload(3);
      const outgoingBefore = structuredClone(outgoing);

      const error = captureRepositoryError(() => writeValue(filePath, outgoing, {
        afterReplace: (target, destinationPath) => {
          if (target === "primary") {
            rewriteEnvelope(destinationPath, {
              version: 99,
              structurallyValid: true,
              domainValid: false,
            });
          }
        },
      }));

      expect(error.code).toBe("CORRUPTED");
      expect(error.filePath).toBe(filePath);
      expect(error.message).toContain("DOMAIN_REJECTED");
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(primaryBefore);
      expect(captureRepositoryError(() => readStore(filePath)).code).toBe("CORRUPTED");
      expect(outgoing).toEqual(outgoingBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it.each(["temp", "backup-temp"] as const)(
    "cleans temporary files and preserves durable bytes when %s fsync fails",
    (failedTarget: RepositoryWriteFileTarget) => {
      withSeededStore((filePath, primaryBefore, backupBefore) => {
        const error = captureRepositoryError(() => writeValue(filePath, payload(3), {
          fsyncFile: (fileDescriptor, target) => {
            if (target === failedTarget) throw injectedIoError("injected fsync failure", "EIO");
            fsyncSync(fileDescriptor);
          },
        }));

        expect(error.code).toBe("IO_ERROR");
        expect(error.operation).toBe("write");
        expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
        expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(backupBefore);
        expectTemporaryFiles(dirname(filePath), 0);
      });
    },
  );

  it("does not replace durable files when the backup rename fails", () => {
    withSeededStore((filePath, primaryBefore, backupBefore) => {
      const error = captureRepositoryError(() => writeValue(filePath, payload(3), {
        replaceFile: (sourcePath, destinationPath, target) => {
          if (target === "backup") throw injectedIoError("injected rename failure", "EBUSY");
          renameSync(sourcePath, destinationPath);
        },
      }));

      expect(error.code).toBe("IO_ERROR");
      expect(error.operation).toBe("replace");
      expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(backupBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("keeps the primary unchanged and a fully valid prior-state backup when primary rename fails", () => {
    withSeededStore((filePath, primaryBefore) => {
      const error = captureRepositoryError(() => writeValue(filePath, payload(3), {
        replaceFile: (sourcePath, destinationPath, target) => {
          if (target === "primary") throw injectedIoError("injected rename failure", "EBUSY");
          renameSync(sourcePath, destinationPath);
        },
      }));

      expect(error.code).toBe("IO_ERROR");
      expect(error.operation).toBe("replace");
      expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
      expect(readFileSync(getRepositoryBackupPath(filePath), "utf8")).toBe(primaryBefore);
      expect(readValue(getRepositoryBackupPath(filePath))).toEqual(payload(2));
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });
});

function createValidationSpec(): RepositoryValidationSpec {
  return {
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    validatePayload: (value) => {
      if (!isRecord(value) || value.structurallyValid !== true) {
        return issueResult("PAYLOAD_REJECTED", "$.structurallyValid", "ERROR");
      }
      return value.warning === true
        ? issueResult("PAYLOAD_WARNING", "$.warning", "WARNING")
        : validResult();
    },
    inspectDomainIntegrity: (value) => isRecord(value) && value.domainValid === true
      ? validResult()
      : issueResult("DOMAIN_REJECTED", "$.domainValid", "CRITICAL"),
  };
}

function payload(version: number): Record<string, unknown> {
  return {
    version,
    structurallyValid: true,
    domainValid: true,
    nested: { stable: true },
  };
}

function writeValue(
  filePath: string,
  value: Record<string, unknown>,
  writeHooks?: RepositoryFileStoreWriteHooks,
): void {
  writeJsonObjectFileAtomically({
    filePath,
    repositoryLabel: LABEL,
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    repositorySpec: REPOSITORY_SPEC,
    persistenceIntent: "validated-write",
    value,
  }, writeHooks);
}

function readStore(filePath: string) {
  return readJsonObjectFile<Record<string, unknown>>({
    filePath,
    repositoryLabel: LABEL,
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    repositorySpec: REPOSITORY_SPEC,
  });
}

function readValue(filePath: string): Record<string, unknown> | undefined {
  const result = readStore(filePath);
  return result.status === "found" ? result.value : undefined;
}

function rewriteEnvelope(filePath: string, value: Record<string, unknown>): void {
  const envelope = createDurableJsonEnvelope({
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    payload: value,
  });
  writeFileSync(filePath, `${serializeDurableJsonEnvelope(envelope)}\n`, "utf8");
}

function validResult() {
  return buildDurableValidationResult([]);
}

function issueResult(code: string, path: string, severity: DurableValidationIssue["severity"]) {
  return buildDurableValidationResult([{
    code,
    path,
    severity,
    message: "Injected validation result without persisted payload content.",
  }]);
}

function captureRepositoryError(action: () => unknown): RepositoryFileError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RepositoryFileError);
  return caught as RepositoryFileError;
}

function expectTemporaryFiles(directoryPath: string, expectedCount: number): void {
  const temporaryFiles = readdirSync(directoryPath).filter((name) => name.includes(".tmp-"));
  expect(temporaryFiles).toHaveLength(expectedCount);
}

function injectedIoError(message: string, code: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function withSeededStore(
  action: (filePath: string, primaryBytes: string, backupBytes: string) => void,
): void {
  withTempFile((filePath) => {
    writeValue(filePath, payload(1));
    writeValue(filePath, payload(2));
    action(
      filePath,
      readFileSync(filePath, "utf8"),
      readFileSync(getRepositoryBackupPath(filePath), "utf8"),
    );
  });
}

function withTempFile(action: (filePath: string) => void): void {
  const directoryPath = mkdtempSync(join(tmpdir(), "characteros-write-full-verification-"));
  try {
    action(join(directoryPath, "store.json"));
  } finally {
    rmSync(directoryPath, { recursive: true, force: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
