import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  findLongitudinalCommitAuditBySimulationId,
  type LongitudinalCommitAuditEntry,
} from "../../core/life/longitudinalCommitAudit";
import { withRepositoryFileLock } from "./fileLock";

export interface LongitudinalCommitAuditRepository {
  list(characterId: string): LongitudinalCommitAuditEntry[];
  get(characterId: string, auditId: string): LongitudinalCommitAuditEntry | undefined;
  getBySimulationId(characterId: string, simulationId: string): LongitudinalCommitAuditEntry | undefined;
  append(entry: LongitudinalCommitAuditEntry): void;
  update(
    characterId: string,
    auditId: string,
    updater: (entry: LongitudinalCommitAuditEntry) => LongitudinalCommitAuditEntry
  ): LongitudinalCommitAuditEntry | undefined;
  clear(characterId?: string): void;
}

export class InMemoryLongitudinalCommitAuditRepository implements LongitudinalCommitAuditRepository {
  private readonly entries: LongitudinalCommitAuditEntry[] = [];

  list(characterId: string): LongitudinalCommitAuditEntry[] {
    return this.entries.filter((entry) => entry.characterId === characterId);
  }

  get(characterId: string, auditId: string): LongitudinalCommitAuditEntry | undefined {
    return this.entries.find((entry) => entry.characterId === characterId && entry.id === auditId);
  }

  getBySimulationId(characterId: string, simulationId: string): LongitudinalCommitAuditEntry | undefined {
    return findLongitudinalCommitAuditBySimulationId(this.list(characterId), simulationId);
  }

  append(entry: LongitudinalCommitAuditEntry): void {
    this.entries.push(entry);
  }

  update(
    characterId: string,
    auditId: string,
    updater: (entry: LongitudinalCommitAuditEntry) => LongitudinalCommitAuditEntry
  ): LongitudinalCommitAuditEntry | undefined {
    const index = this.entries.findIndex((entry) => entry.characterId === characterId && entry.id === auditId);
    if (index < 0) return undefined;
    const next = updater(this.entries[index]!);
    this.entries[index] = { ...next, characterId };
    return this.entries[index];
  }

  clear(characterId?: string): void {
    if (!characterId) {
      this.entries.length = 0;
      return;
    }
    const remaining = this.entries.filter((entry) => entry.characterId !== characterId);
    this.entries.length = 0;
    this.entries.push(...remaining);
  }
}

type SerializedLongitudinalCommitAuditStore = Record<string, LongitudinalCommitAuditEntry[]>;

export class FileLongitudinalCommitAuditRepository implements LongitudinalCommitAuditRepository {
  constructor(private readonly filePath = resolve(process.cwd(), "data", "longitudinal_commit_audit.json")) {}

  list(characterId: string): LongitudinalCommitAuditEntry[] {
    return this.readStore()[characterId] ?? [];
  }

  get(characterId: string, auditId: string): LongitudinalCommitAuditEntry | undefined {
    return this.list(characterId).find((entry) => entry.id === auditId);
  }

  getBySimulationId(characterId: string, simulationId: string): LongitudinalCommitAuditEntry | undefined {
    return findLongitudinalCommitAuditBySimulationId(this.list(characterId), simulationId);
  }

  append(entry: LongitudinalCommitAuditEntry): void {
    this.withFileLock(() => {
      const store = this.readStore();
      store[entry.characterId] = [...(store[entry.characterId] ?? []), entry];
      this.writeStore(store);
    });
  }

  update(
    characterId: string,
    auditId: string,
    updater: (entry: LongitudinalCommitAuditEntry) => LongitudinalCommitAuditEntry
  ): LongitudinalCommitAuditEntry | undefined {
    return this.withFileLock(() => {
      const store = this.readStore();
      const entries = store[characterId] ?? [];
      const index = entries.findIndex((entry) => entry.id === auditId);
      if (index < 0) return undefined;
      const next = { ...updater(entries[index]!), characterId };
      entries[index] = next;
      store[characterId] = entries;
      this.writeStore(store);
      return next;
    });
  }

  clear(characterId?: string): void {
    this.withFileLock(() => {
      if (!characterId) {
        if (existsSync(this.filePath)) unlinkSync(this.filePath);
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  private readStore(): SerializedLongitudinalCommitAuditStore {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as SerializedLongitudinalCommitAuditStore;
    } catch (error) {
      const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        renameSync(this.filePath, corruptPath);
      } catch {
        throw new Error(
          `Could not read longitudinal commit audit store and failed to preserve corrupt file: ${
            error instanceof Error ? error.message : "unknown parse error"
          }`
        );
      }
      return {};
    }
  }

  private writeStore(store: SerializedLongitudinalCommitAuditStore): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const content = `${JSON.stringify(store, null, 2)}\n`;
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    writeFileSync(tempPath, content, "utf8");
    try {
      if (existsSync(this.filePath)) unlinkSync(this.filePath);
      renameSync(tempPath, this.filePath);
    } catch {
      writeFileSync(this.filePath, content, "utf8");
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  }

  private withFileLock<T>(action: () => T): T {
    return withRepositoryFileLock({
      filePath: this.filePath,
      lockLabel: "longitudinal commit audit",
      action,
    });
  }
}
