import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { dirname } from "node:path";

interface RepositoryFileLockLease {
  readonly handle: number;
  readonly ownerToken: string;
}

interface RepositoryFileLockOwner {
  readonly pid: number;
  readonly createdAt: string;
  readonly ownerToken: string;
}

export function withRepositoryFileLock<T>(params: {
  filePath: string;
  lockLabel: string;
  action: () => T;
}): T {
  const lockPath = `${params.filePath}.lock`;
  mkdirSync(dirname(params.filePath), { recursive: true });
  let lease: RepositoryFileLockLease | undefined;
  try {
    lease = acquireLock(lockPath, params.lockLabel);
    return params.action();
  } finally {
    if (lease !== undefined) releaseLock(lockPath, params.lockLabel, lease);
  }
}

function acquireLock(lockPath: string, lockLabel: string): RepositoryFileLockLease {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      mkdirSync(lockPath);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw new Error(`Could not create ${lockLabel} repository file lock: ${lockPath}`, { cause: error });
      }
      cleanupStaleLock(lockPath);
      sleepSync(5);
      continue;
    }

    const ownerToken = randomUUID();
    let lockHandle: number | undefined;
    try {
      lockHandle = openSync(`${lockPath}/owner`, "wx");
      writeSync(lockHandle, JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString(),
        ownerToken,
      } satisfies RepositoryFileLockOwner));
      fsyncSync(lockHandle);
      return { handle: lockHandle, ownerToken };
    } catch (error) {
      if (lockHandle !== undefined) closeHandleBestEffort(lockHandle);
      cleanupFailedAcquisition(lockPath, ownerToken);
      throw new Error(`Could not initialize ${lockLabel} repository file lock: ${lockPath}`, { cause: error });
    }
  }
  throw new Error(`Could not acquire ${lockLabel} repository file lock: ${lockPath}`);
}

function releaseLock(
  lockPath: string,
  lockLabel: string,
  lease: RepositoryFileLockLease,
): void {
  try {
    closeSync(lease.handle);
  } catch (error) {
    throw new Error(`Could not close ${lockLabel} repository file lock handle: ${lockPath}`, { cause: error });
  }

  const ownerPath = `${lockPath}/owner`;
  const owner = readLockOwner(ownerPath);
  if (owner?.pid !== process.pid || owner.ownerToken !== lease.ownerToken) {
    throw new Error(`Refusing to release ${lockLabel} repository file lock with mismatched ownership: ${lockPath}`);
  }

  retryOrThrow(
    () => unlinkSync(ownerPath),
    `Could not remove ${lockLabel} repository file lock owner: ${ownerPath}`,
  );
  retryOrThrow(
    () => rmdirSync(lockPath),
    `Could not remove ${lockLabel} repository file lock directory: ${lockPath}`,
  );
}

function cleanupFailedAcquisition(lockPath: string, ownerToken: string): void {
  if (!existsSync(lockPath)) return;
  const ownerPath = `${lockPath}/owner`;
  if (!existsSync(ownerPath)) {
    retry(() => rmSync(lockPath, { recursive: true, force: true }), 10);
    return;
  }
  const owner = readLockOwner(ownerPath);
  if (owner?.pid === process.pid && owner.ownerToken === ownerToken) {
    retry(() => rmSync(lockPath, { recursive: true, force: true }), 10);
  }
}

function cleanupStaleLock(lockPath: string): void {
  const ownerPath = `${lockPath}/owner`;
  if (!existsSync(lockPath)) return;
  if (!existsSync(ownerPath)) {
    if (lockAgeMs(lockPath) > 2000) {
      retry(() => rmSync(lockPath, { recursive: true, force: true }), 10);
    }
    return;
  }
  if (isOwnerProcessStale(ownerPath)) {
    retry(() => rmSync(lockPath, { recursive: true, force: true }), 10);
  }
}

function isOwnerProcessStale(ownerPath: string): boolean {
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as { pid?: unknown };
    if (typeof owner.pid !== "number" || owner.pid <= 0) return true;
    if (owner.pid === process.pid) return false;
    try {
      process.kill(owner.pid, 0);
      return false;
    } catch (error) {
      return isNodeError(error) && error.code === "ESRCH";
    }
  } catch {
    return lockAgeMs(ownerPath) > 2000;
  }
}

function readLockOwner(ownerPath: string): RepositoryFileLockOwner | undefined {
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as Partial<RepositoryFileLockOwner>;
    if (
      typeof owner.pid !== "number"
      || owner.pid <= 0
      || typeof owner.createdAt !== "string"
      || typeof owner.ownerToken !== "string"
      || owner.ownerToken.length === 0
    ) {
      return undefined;
    }
    return {
      pid: owner.pid,
      createdAt: owner.createdAt,
      ownerToken: owner.ownerToken,
    };
  } catch {
    return undefined;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function lockAgeMs(path: string): number {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function retry(action: () => void, attempts = 20): void {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      action();
      return;
    } catch {
      sleepSync(5);
    }
  }
}

function retryOrThrow(action: () => void, message: string, attempts = 20): void {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      action();
      return;
    } catch (error) {
      lastError = error;
      sleepSync(5);
    }
  }
  throw new Error(message, { cause: lastError });
}

function closeHandleBestEffort(handle: number): void {
  try {
    closeSync(handle);
  } catch {
    // The incomplete acquisition remains fail-closed and can be cleaned as stale later.
  }
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
