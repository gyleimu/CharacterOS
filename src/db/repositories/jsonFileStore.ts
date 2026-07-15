import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  createDurableJsonEnvelope,
  createDurableStateIncidentId,
  decodeDurableJsonDocument,
  fingerprintDurableJsonObservation,
  serializeDurableJsonEnvelope,
  type DurableJsonChecksum,
  type DurableRepositoryKind,
} from "./durableJsonEnvelope";

export type RepositoryFileErrorCode = "CORRUPTED" | "MIGRATION_REQUIRED" | "IO_ERROR";

export interface RepositoryFileNotFound {
  readonly status: "not_found";
  readonly code: "NOT_FOUND";
  readonly filePath: string;
}

export interface RepositoryFileFound<T> {
  readonly status: "found";
  readonly value: T;
  readonly raw: string;
  readonly format: "legacy-v0" | "envelope-v1";
  readonly repositoryKind: DurableRepositoryKind;
  readonly schemaVersion: number;
  readonly checksum?: DurableJsonChecksum;
}

export type RepositoryFileReadResult<T> = RepositoryFileNotFound | RepositoryFileFound<T>;

export class RepositoryFileError extends Error {
  readonly code: RepositoryFileErrorCode;
  readonly filePath: string;
  readonly repositoryKind: DurableRepositoryKind;
  readonly operation: "read" | "serialize" | "write" | "replace" | "remove";
  readonly recoverySnapshotAvailable: boolean;
  readonly incidentId: string;
  readonly checksum?: {
    readonly expected: string;
    readonly actual: string;
  };

  constructor(params: {
    code: RepositoryFileErrorCode;
    repositoryLabel: string;
    filePath: string;
    repositoryKind: DurableRepositoryKind;
    operation: RepositoryFileError["operation"];
    message: string;
    recoverySnapshotAvailable?: boolean;
    observationFingerprint: string;
    checksum?: RepositoryFileError["checksum"];
  }) {
    super(`${params.repositoryLabel}: ${params.message}`);
    this.name = "RepositoryFileError";
    this.code = params.code;
    this.filePath = params.filePath;
    this.repositoryKind = params.repositoryKind;
    this.operation = params.operation;
    this.recoverySnapshotAvailable = params.recoverySnapshotAvailable ?? false;
    this.incidentId = createDurableStateIncidentId({
      type: params.code,
      repositoryKind: params.repositoryKind,
      filePath: params.filePath,
      observationFingerprint: params.observationFingerprint,
    });
    if (params.checksum) this.checksum = params.checksum;
  }
}

export function isRepositoryFileError(error: unknown): error is RepositoryFileError {
  return error instanceof RepositoryFileError;
}

export function getRepositoryBackupPath(filePath: string): string {
  return `${filePath}.bak`;
}

export function readJsonObjectFile<T extends Record<string, unknown>>(params: {
  filePath: string;
  repositoryLabel: string;
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
}): RepositoryFileReadResult<T> {
  let raw: string;
  try {
    raw = readFileSync(params.filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      const backupPath = getRepositoryBackupPath(params.filePath);
      if (existsSync(backupPath)) {
        throw corruptedError({
          ...params,
          message: "primary file is missing while a backup snapshot exists; explicit recovery is required",
          observation: "primary-missing-backup-present",
        });
      }
      return { status: "not_found", code: "NOT_FOUND", filePath: params.filePath };
    }
    throw ioError(params, "read", error);
  }

  if (raw.trim().length === 0) {
    throw corruptedError({ ...params, message: "file is empty", raw });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw corruptedError({ ...params, message: `JSON parse failed: ${detail}`, raw });
  }

  if (!isJsonObject(parsed)) {
    throw corruptedError({ ...params, message: "JSON root must be an object", raw });
  }

  const decoded = decodeDurableJsonDocument<T>({
    value: parsed,
    expectedRepositoryKind: params.repositoryKind,
    expectedSchemaVersion: params.schemaVersion,
  });
  if (decoded.status === "corrupted") {
    throw corruptedError({
      ...params,
      message: decoded.reason,
      raw,
      ...(decoded.checksum ? { checksum: decoded.checksum } : {}),
    });
  }
  if (decoded.status === "migration_required") {
    throw migrationRequiredError({ ...params, message: decoded.reason, raw });
  }
  if (decoded.status === "legacy-v0") {
    return {
      status: "found",
      value: decoded.payload,
      raw,
      format: "legacy-v0",
      repositoryKind: params.repositoryKind,
      schemaVersion: 0,
    };
  }
  return {
    status: "found",
    value: decoded.envelope.payload,
    raw,
    format: "envelope-v1",
    repositoryKind: decoded.envelope.repositoryKind,
    schemaVersion: decoded.envelope.schemaVersion,
    checksum: decoded.envelope.checksum,
  };
}

export function writeJsonObjectFileAtomically<T extends Record<string, unknown>>(params: {
  filePath: string;
  repositoryLabel: string;
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
  value: T;
}): void {
  let content: string;
  try {
    const envelope = createDurableJsonEnvelope({
      repositoryKind: params.repositoryKind,
      schemaVersion: params.schemaVersion,
      payload: params.value,
    });
    content = `${serializeDurableJsonEnvelope(envelope)}\n`;
  } catch (error) {
    throw ioError(params, "serialize", error);
  }

  try {
    mkdirSync(dirname(params.filePath), { recursive: true });
  } catch (error) {
    throw ioError(params, "write", error);
  }

  const token = `${process.pid}-${randomUUID()}`;
  const tempPath = `${params.filePath}.tmp-${token}`;
  const backupPath = getRepositoryBackupPath(params.filePath);
  const backupTempPath = `${backupPath}.tmp-${token}`;

  try {
    const current = readJsonObjectFile<T>(params);

    writeSyncedFile(tempPath, content, params);
    assertValidJsonObjectFile(tempPath, params);

    const recoveryContent = current.status === "found" ? current.raw : content;
    writeSyncedFile(backupTempPath, recoveryContent, params);
    assertValidJsonObjectFile(backupTempPath, params);
    replaceFile(backupTempPath, backupPath, params);

    replaceFile(tempPath, params.filePath, params);
    assertValidJsonObjectFile(params.filePath, params);
    syncDirectoryBestEffort(dirname(params.filePath));
  } finally {
    removeTemporaryFile(tempPath);
    removeTemporaryFile(backupTempPath);
  }
}

export function removeJsonObjectFileAndBackup(params: {
  filePath: string;
  repositoryLabel: string;
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
}): void {
  removeFileIfPresent(getRepositoryBackupPath(params.filePath), params);
  removeFileIfPresent(params.filePath, params);
}

function writeSyncedFile(
  filePath: string,
  content: string,
  params: DurableJsonFileParams,
): void {
  let handle: number | undefined;
  try {
    handle = openSync(filePath, "wx", 0o600);
    writeFileSync(handle, content, "utf8");
    fsyncSync(handle);
  } catch (error) {
    throw ioError(params, "write", error);
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

function replaceFile(
  sourcePath: string,
  destinationPath: string,
  params: DurableJsonFileParams,
): void {
  try {
    renameSync(sourcePath, destinationPath);
  } catch (error) {
    throw ioError(params, "replace", error);
  }
}

function assertValidJsonObjectFile(filePath: string, params: DurableJsonFileParams): void {
  readJsonObjectFile<Record<string, unknown>>({
    filePath,
    repositoryLabel: params.repositoryLabel,
    repositoryKind: params.repositoryKind,
    schemaVersion: params.schemaVersion,
  });
}

function removeFileIfPresent(
  filePath: string,
  params: DurableJsonFileParams,
): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch (error) {
    throw ioError(params, "remove", error);
  }
}

function removeTemporaryFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Cleanup is best effort; the canonical file is never modified here.
  }
}

function syncDirectoryBestEffort(directoryPath: string): void {
  if (process.platform === "win32") return;
  let handle: number | undefined;
  try {
    handle = openSync(directoryPath, "r");
    fsyncSync(handle);
  } catch {
    // The primary and backup files were already fsynced. Some filesystems do not support directory fsync.
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

function corruptedError(params: {
  filePath: string;
  repositoryLabel: string;
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
  message: string;
  raw?: string;
  observation?: string;
  checksum?: RepositoryFileError["checksum"];
}): RepositoryFileError {
  return new RepositoryFileError({
    code: "CORRUPTED",
    repositoryLabel: params.repositoryLabel,
    filePath: params.filePath,
    repositoryKind: params.repositoryKind,
    operation: "read",
    message: params.message,
    recoverySnapshotAvailable: hasValidRecoverySnapshot(params),
    observationFingerprint: fingerprintDurableJsonObservation(
      params.raw ?? params.observation ?? params.message,
    ),
    ...(params.checksum ? { checksum: params.checksum } : {}),
  });
}

function migrationRequiredError(params: {
  filePath: string;
  repositoryLabel: string;
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
  message: string;
  raw: string;
}): RepositoryFileError {
  return new RepositoryFileError({
    code: "MIGRATION_REQUIRED",
    repositoryLabel: params.repositoryLabel,
    filePath: params.filePath,
    repositoryKind: params.repositoryKind,
    operation: "read",
    message: params.message,
    recoverySnapshotAvailable: hasValidRecoverySnapshot(params),
    observationFingerprint: fingerprintDurableJsonObservation(params.raw),
  });
}

function hasValidRecoverySnapshot(params: DurableJsonFileParams): boolean {
  const backupPath = getRepositoryBackupPath(params.filePath);
  if (!existsSync(backupPath)) return false;
  try {
    const raw = readFileSync(backupPath, "utf8");
    if (raw.trim().length === 0) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!isJsonObject(parsed)) return false;
    const decoded = decodeDurableJsonDocument({
      value: parsed,
      expectedRepositoryKind: params.repositoryKind,
      expectedSchemaVersion: params.schemaVersion,
    });
    return decoded.status === "legacy-v0" || decoded.status === "valid";
  } catch {
    return false;
  }
}

function ioError(
  params: DurableJsonFileParams,
  operation: RepositoryFileError["operation"],
  error: unknown,
): RepositoryFileError {
  const detail = error instanceof Error ? error.message : String(error);
  return new RepositoryFileError({
    code: "IO_ERROR",
    repositoryLabel: params.repositoryLabel,
    filePath: params.filePath,
    repositoryKind: params.repositoryKind,
    operation,
    message: `${operation} failed: ${detail}`,
    recoverySnapshotAvailable: hasValidRecoverySnapshot(params),
    observationFingerprint: fingerprintDurableJsonObservation(
      `${operation}:${nodeErrorCode(error)}:${detail}`,
    ),
  });
}

interface DurableJsonFileParams {
  readonly filePath: string;
  readonly repositoryLabel: string;
  readonly repositoryKind: DurableRepositoryKind;
  readonly schemaVersion: number;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function nodeErrorCode(error: unknown): string {
  return isNodeError(error) && typeof error.code === "string" ? error.code : "UNKNOWN";
}
