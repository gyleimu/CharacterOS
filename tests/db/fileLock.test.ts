import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withRepositoryFileLock } from "../../src/db/repositories/fileLock";

const LOCK_LABEL = "ownership test";

describe("repository file lock ownership", () => {
  it("does not delete an existing lock when acquisition fails", () => {
    withTempLock((filePath, lockPath) => {
      const ownerPath = createOwner(lockPath, {
        pid: process.pid,
        ownerToken: "existing-owner-token",
      });
      const ownerBefore = readFileSync(ownerPath, "utf8");
      let actionRan = false;

      expect(() => withRepositoryFileLock({
        filePath,
        lockLabel: LOCK_LABEL,
        action: () => {
          actionRan = true;
        },
      })).toThrow(/Could not acquire ownership test repository file lock/u);

      expect(actionRan).toBe(false);
      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(ownerPath, "utf8")).toBe(ownerBefore);
    });
  }, 30_000);

  it("does not disrupt a live lock holder after waiting times out", async () => {
    const directory = mkdtempSync(join(tmpdir(), "characteros-lock-holder-"));
    const filePath = join(directory, "store.json");
    const lockPath = `${filePath}.lock`;
    const child = await startLockHolder(lockPath);
    try {
      const ownerPath = join(lockPath, "owner");
      const ownerBefore = readFileSync(ownerPath, "utf8");

      expect(() => withRepositoryFileLock({
        filePath,
        lockLabel: LOCK_LABEL,
        action: () => undefined,
      })).toThrow(/Could not acquire ownership test repository file lock/u);

      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(ownerPath, "utf8")).toBe(ownerBefore);
      expect(child.pid).toBeTypeOf("number");
      expect(() => process.kill(child.pid!, 0)).not.toThrow();
    } finally {
      await stopChild(child);
      rmSync(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("refuses to release a lock when the owner token no longer matches", () => {
    withTempLock((filePath, lockPath) => {
      const ownerPath = join(lockPath, "owner");

      expect(() => withRepositoryFileLock({
        filePath,
        lockLabel: LOCK_LABEL,
        action: () => {
          const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as Record<string, unknown>;
          writeFileSync(ownerPath, JSON.stringify({
            ...owner,
            ownerToken: "replacement-owner-token",
          }), "utf8");
        },
      })).toThrow(/mismatched ownership/u);

      expect(existsSync(lockPath)).toBe(true);
      expect(readFileSync(ownerPath, "utf8")).toContain("replacement-owner-token");
    });
  });

  it("releases a normally acquired lock owned by its lease", () => {
    withTempLock((filePath, lockPath) => {
      const result = withRepositoryFileLock({
        filePath,
        lockLabel: LOCK_LABEL,
        action: () => {
          const owner = JSON.parse(readFileSync(join(lockPath, "owner"), "utf8")) as {
            pid?: unknown;
            ownerToken?: unknown;
          };
          expect(owner.pid).toBe(process.pid);
          expect(owner.ownerToken).toEqual(expect.any(String));
          return "released";
        },
      });

      expect(result).toBe("released");
      expect(existsSync(lockPath)).toBe(false);
    });
  });
});

function withTempLock(action: (filePath: string, lockPath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "characteros-lock-ownership-"));
  const filePath = join(directory, "store.json");
  try {
    action(filePath, `${filePath}.lock`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function createOwner(
  lockPath: string,
  owner: { pid: number; ownerToken: string },
): string {
  mkdirSync(lockPath);
  const ownerPath = join(lockPath, "owner");
  writeFileSync(ownerPath, JSON.stringify({
    ...owner,
    createdAt: new Date().toISOString(),
  }), "utf8");
  return ownerPath;
}

async function startLockHolder(lockPath: string): Promise<ChildProcess> {
  const script = [
    'const { mkdirSync, writeFileSync } = require("node:fs");',
    'const { join } = require("node:path");',
    'const lockPath = process.argv[1];',
    'mkdirSync(lockPath);',
    'writeFileSync(join(lockPath, "owner"), JSON.stringify({',
    '  pid: process.pid,',
    '  createdAt: new Date().toISOString(),',
    '  ownerToken: "child-owner-token",',
    '}), "utf8");',
    'process.stdout.write("ready\\n");',
    'setInterval(() => undefined, 1000);',
  ].join("\n");
  const child = spawn(process.execPath, ["-e", script, lockPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForReady(child);
  return child;
}

async function waitForReady(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`Lock holder did not start: ${stderr}`)), 5_000);
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Lock holder exited before ready with code ${String(code)}: ${stderr}`));
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      if (!chunk.toString("utf8").includes("ready")) return;
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill();
  });
}
