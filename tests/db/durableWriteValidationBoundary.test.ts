import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { FileCharacterPhysicsRepository } from "../../src/db/repositories/characterPhysicsRepository";
import { getDurableRepositorySpec } from "../../src/db/repositories/durableRepositoryRegistry";
import {
  getRepositoryBackupPath,
  readJsonObjectFile,
  RepositoryFileError,
  writeJsonObjectFileAtomically,
} from "../../src/db/repositories/jsonFileStore";
import {
  buildDurableValidationResult,
  REPOSITORY_READ_VALIDATION_POLICY,
  REPOSITORY_WRITE_VALIDATION_POLICY,
  type DurableValidationIssue,
  type RepositoryValidationSpec,
} from "../../src/db/repositories/durableValidationTypes";

const LABEL = "write validation test repository";
const REPOSITORY_KIND = "character-physics" as const;
const SCHEMA_VERSION = 1;

describe("Durable write validation boundary", () => {
  it("keeps read and write validation policies explicit and warning-tolerant", () => {
    expect(REPOSITORY_READ_VALIDATION_POLICY).toMatchObject({
      mode: "read",
      allowWarnings: true,
      blockingSeverities: ["CRITICAL", "ERROR"],
    });
    expect(REPOSITORY_WRITE_VALIDATION_POLICY).toMatchObject({
      mode: "write",
      allowWarnings: true,
      blockingSeverities: ["CRITICAL", "ERROR"],
    });
  });

  it("rejects a structurally invalid outgoing payload without changing primary or backup bytes", () => {
    withTempFile((filePath) => {
      const spec = createValidationSpec({
        validatePayload: (value) => isRecord(value) && value.allowed === true
          ? validResult()
          : issueResult("PAYLOAD_REJECTED", "$.allowed", "ERROR"),
      });
      writeValue(filePath, { allowed: true }, spec);
      const primaryBefore = readFileSync(filePath, "utf8");
      const backupPath = getRepositoryBackupPath(filePath);
      const backupBefore = readFileSync(backupPath, "utf8");

      const error = captureRepositoryError(() => writeValue(filePath, { allowed: false }, spec));

      expect(error.code).toBe("WRITE_VALIDATION_FAILED");
      expect(error.operation).toBe("validate");
      expect(readFileSync(filePath, "utf8")).toBe(primaryBefore);
      expect(readFileSync(backupPath, "utf8")).toBe(backupBefore);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("rejects a domain-invalid outgoing payload before creating primary or backup files", () => {
    withTempFile((filePath) => {
      const spec = createValidationSpec({
        inspectDomainIntegrity: (value) => isRecord(value) && value.domainValid === true
          ? validResult()
          : issueResult("DOMAIN_REJECTED", "$.domainValid", "CRITICAL"),
      });

      const error = captureRepositoryError(() => writeValue(filePath, { domainValid: false }, spec));

      expect(error.code).toBe("WRITE_VALIDATION_FAILED");
      expect(existsSync(filePath)).toBe(false);
      expect(existsSync(getRepositoryBackupPath(filePath))).toBe(false);
      expectTemporaryFiles(dirname(filePath), 0);
    });
  });

  it("allows warning-only outgoing payloads to be written and read", () => {
    withTempFile((filePath) => {
      const spec = createValidationSpec({
        validatePayload: () => issueResult("NON_BLOCKING_WARNING", "$.value", "WARNING"),
      });

      writeValue(filePath, { value: 1 }, spec);

      const result = readJsonObjectFile<Record<string, number>>({
        filePath,
        repositoryLabel: LABEL,
        repositoryKind: REPOSITORY_KIND,
        schemaVersion: SCHEMA_VERSION,
        repositorySpec: spec,
      });
      expect(result.status === "found" ? result.value : undefined).toEqual({ value: 1 });
    });
  });

  it("produces a stable incident id for the same outgoing validation failure", () => {
    withTempFile((filePath) => {
      const spec = createValidationSpec({
        validatePayload: () => issueResult("STABLE_FAILURE", "$.value", "ERROR"),
      });

      const first = captureRepositoryError(() => writeValue(filePath, { value: "same" }, spec));
      const second = captureRepositoryError(() => writeValue(filePath, { value: "same" }, spec));
      const different = captureRepositoryError(() => writeValue(filePath, { value: "different" }, spec));

      expect(first.incidentId).toBe(second.incidentId);
      expect(first.incidentId).not.toBe(different.incidentId);
      expect(first.incidentId).toMatch(/^dstate-character-physics-[a-f0-9]{16}$/u);
    });
  });

  it("does not expose outgoing payload content through validation errors", () => {
    withTempFile((filePath) => {
      const secret = "PRIVATE-MEMORY-PAYLOAD-DO-NOT-LEAK";
      const spec = createValidationSpec({
        validatePayload: () => issueResult("SAFE_FAILURE", "$.sensitive", "ERROR"),
      });

      const error = captureRepositoryError(() => writeValue(filePath, { sensitive: secret }, spec));
      const observableError = `${error.message}\n${error.stack ?? ""}\n${JSON.stringify(error)}`;

      expect(observableError).not.toContain(secret);
      expect(error).not.toHaveProperty("payload");
      expect(error).not.toHaveProperty("value");
    });
  });

  it("uses the character physics RepositorySpec to block identity-invalid outgoing state", () => {
    withTempFile((filePath) => {
      const repository = new FileCharacterPhysicsRepository(filePath);
      const mismatchedState = createCharacterPhysicsState({
        identity: {
          id: "different_character",
          name: "Different Character",
          description: "Identity intentionally differs from the repository key.",
          tags: ["test"],
        },
      });

      const error = captureRepositoryError(() => repository.set("lin_fan", mismatchedState));

      expect(error.code).toBe("WRITE_VALIDATION_FAILED");
      expect(error.message).toContain("CHARACTER_IDENTITY_KEY_MISMATCH");
      expect(existsSync(filePath)).toBe(false);
      expect(existsSync(getRepositoryBackupPath(filePath))).toBe(false);
    });
  });

  it("does not mutate caller-owned payloads during runtime and domain validation", () => {
    withTempFile((filePath) => {
      const state = createCharacterPhysicsState({
        identity: {
          id: "lin_fan",
          name: "Validation Character",
          description: "Payload mutation regression fixture.",
          tags: ["test"],
        },
      });
      const payload = { lin_fan: serializeCharacterPhysicsState(state) };
      const before = structuredClone(payload);

      writeValue(filePath, payload, getDurableRepositorySpec("character-physics"));

      expect(payload).toEqual(before);
    });
  });
});

function createValidationSpec(overrides: {
  validatePayload?: RepositoryValidationSpec["validatePayload"];
  inspectDomainIntegrity?: RepositoryValidationSpec["inspectDomainIntegrity"];
} = {}): RepositoryValidationSpec {
  return {
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    validatePayload: overrides.validatePayload ?? validResult,
    inspectDomainIntegrity: overrides.inspectDomainIntegrity ?? validResult,
  };
}

function writeValue(
  filePath: string,
  value: Record<string, unknown>,
  repositorySpec: RepositoryValidationSpec,
): void {
  writeJsonObjectFileAtomically({
    filePath,
    repositoryLabel: LABEL,
    repositoryKind: REPOSITORY_KIND,
    schemaVersion: SCHEMA_VERSION,
    repositorySpec,
    persistenceIntent: "validated-write",
    value,
  });
}

function validResult() {
  return buildDurableValidationResult([]);
}

function issueResult(code: string, path: string, severity: DurableValidationIssue["severity"]) {
  return buildDurableValidationResult([{
    code,
    path,
    severity,
    message: "Validation issue generated without including persisted content.",
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

function withTempFile(action: (filePath: string) => void): void {
  const directoryPath = mkdtempSync(join(tmpdir(), "characteros-write-validation-"));
  try {
    action(join(directoryPath, "store.json"));
  } finally {
    rmSync(directoryPath, { recursive: true, force: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
