import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeSync
} from "node:fs";
import { dirname } from "node:path";

export function withRepositoryFileLock<T>(params: {
  filePath: string;
  lockLabel: string;
  action: () => T;
}): T {
  const lockPath = `${params.filePath}.lock`;
  mkdirSync(dirname(params.filePath), { recursive: true });
  let lockHandle: number | undefined;
  try {
    lockHandle = acquireLock(lockPath, params.lockLabel);
    return params.action();
  } finally {
    if (lockHandle !== undefined) closeSync(lockHandle);
    releaseLock(lockPath);
  }
}

function acquireLock(lockPath: string, lockLabel: string): number {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      mkdirSync(lockPath);
      const lockHandle = openSync(`${lockPath}/owner`, "w");
      writeSync(lockHandle, JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString()
      }));
      return lockHandle;
    } catch {
      cleanupStaleLock(lockPath);
      sleepSync(5);
    }
  }
  throw new Error(`Could not acquire ${lockLabel} repository file lock: ${lockPath}`);
}

function releaseLock(lockPath: string): void {
  retry(() => {
    const ownerPath = `${lockPath}/owner`;
    if (existsSync(ownerPath)) unlinkSync(ownerPath);
  });
  retry(() => {
    if (existsSync(lockPath)) rmSync(lockPath, { recursive: true, force: true });
  });
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

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
