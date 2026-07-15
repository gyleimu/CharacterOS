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

export type RepositoryFileErrorCode = "CORRUPTED" | "IO_ERROR";

export interface RepositoryFileNotFound {
  readonly status: "not_found";
  readonly code: "NOT_FOUND";
  readonly filePath: string;
}

export interface RepositoryFileFound<T> {
  readonly status: "found";
  readonly value: T;
  readonly raw: string;
}

export type RepositoryFileReadResult<T> = RepositoryFileNotFound | RepositoryFileFound<T>;

export class RepositoryFileError extends Error {
  readonly code: RepositoryFileErrorCode;
  readonly filePath: string;
  readonly operation: "read" | "serialize" | "write" | "replace" | "remove";
  readonly recoverySnapshotAvailable: boolean;

  constructor(params: {
    code: RepositoryFileErrorCode;
    repositoryLabel: string;
    filePath: string;
    operation: RepositoryFileError["operation"];
    message: string;
    recoverySnapshotAvailable?: boolean;
  }) {
    super(`${params.repositoryLabel}: ${params.message}`);
    this.name = "RepositoryFileError";
    this.code = params.code;
    this.filePath = params.filePath;
    this.operation = params.operation;
    this.recoverySnapshotAvailable = params.recoverySnapshotAvailable ?? false;
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
        });
      }
      return { status: "not_found", code: "NOT_FOUND", filePath: params.filePath };
    }
    throw ioError(params, "read", error);
  }

  if (raw.trim().length === 0) {
    throw corruptedError({ ...params, message: "file is empty" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw corruptedError({ ...params, message: `JSON parse failed: ${detail}` });
  }

  if (!isJsonObject(parsed)) {
    throw corruptedError({ ...params, message: "JSON root must be an object" });
  }

  return { status: "found", value: parsed as T, raw };
}

export function writeJsonObjectFileAtomically<T extends Record<string, unknown>>(params: {
  filePath: string;
  repositoryLabel: string;
  value: T;
}): void {
  let content: string;
  try {
    content = `${JSON.stringify(params.value, null, 2)}\n`;
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
    assertValidJsonObjectFile(tempPath, params.repositoryLabel);

    const recoveryContent = current.status === "found" ? current.raw : content;
    writeSyncedFile(backupTempPath, recoveryContent, params);
    assertValidJsonObjectFile(backupTempPath, params.repositoryLabel);
    replaceFile(backupTempPath, backupPath, params);

    replaceFile(tempPath, params.filePath, params);
    assertValidJsonObjectFile(params.filePath, params.repositoryLabel);
    syncDirectoryBestEffort(dirname(params.filePath));
  } finally {
    removeTemporaryFile(tempPath);
    removeTemporaryFile(backupTempPath);
  }
}

export function removeJsonObjectFileAndBackup(params: {
  filePath: string;
  repositoryLabel: string;
}): void {
  removeFileIfPresent(getRepositoryBackupPath(params.filePath), params);
  removeFileIfPresent(params.filePath, params);
}

function writeSyncedFile(
  filePath: string,
  content: string,
  params: { filePath: string; repositoryLabel: string },
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
  params: { filePath: string; repositoryLabel: string },
): void {
  try {
    renameSync(sourcePath, destinationPath);
  } catch (error) {
    throw ioError(params, "replace", error);
  }
}

function assertValidJsonObjectFile(filePath: string, repositoryLabel: string): void {
  readJsonObjectFile<Record<string, unknown>>({ filePath, repositoryLabel });
}

function removeFileIfPresent(
  filePath: string,
  params: { filePath: string; repositoryLabel: string },
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
  message: string;
}): RepositoryFileError {
  return new RepositoryFileError({
    code: "CORRUPTED",
    repositoryLabel: params.repositoryLabel,
    filePath: params.filePath,
    operation: "read",
    message: params.message,
    recoverySnapshotAvailable: hasValidRecoverySnapshot(params.filePath),
  });
}

function hasValidRecoverySnapshot(filePath: string): boolean {
  const backupPath = getRepositoryBackupPath(filePath);
  if (!existsSync(backupPath)) return false;
  try {
    const raw = readFileSync(backupPath, "utf8");
    if (raw.trim().length === 0) return false;
    return isJsonObject(JSON.parse(raw) as unknown);
  } catch {
    return false;
  }
}

function ioError(
  params: { filePath: string; repositoryLabel: string },
  operation: RepositoryFileError["operation"],
  error: unknown,
): RepositoryFileError {
  const detail = error instanceof Error ? error.message : String(error);
  return new RepositoryFileError({
    code: "IO_ERROR",
    repositoryLabel: params.repositoryLabel,
    filePath: params.filePath,
    operation,
    message: `${operation} failed: ${detail}`,
    recoverySnapshotAvailable: hasValidRecoverySnapshot(params.filePath),
  });
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
