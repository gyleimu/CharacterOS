import { resolve } from "node:path";
import {
  findLongitudinalCommitAuditBySimulationId,
  type LongitudinalCommitAuditEntry,
} from "../../core/life/longitudinalCommitAudit";
import { withRepositoryFileLock } from "./fileLock";
import {
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  writeJsonObjectFileAtomically,
} from "./jsonFileStore";

const REPOSITORY_LABEL = "longitudinal commit audit";

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
        removeJsonObjectFileAndBackup({ filePath: this.filePath, repositoryLabel: REPOSITORY_LABEL });
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  private readStore(): SerializedLongitudinalCommitAuditStore {
    const result = readJsonObjectFile<SerializedLongitudinalCommitAuditStore>({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
    });
    return result.status === "not_found" ? {} : result.value;
  }

  private writeStore(store: SerializedLongitudinalCommitAuditStore): void {
    writeJsonObjectFileAtomically({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      value: store,
    });
  }

  private withFileLock<T>(action: () => T): T {
    return withRepositoryFileLock({
      filePath: this.filePath,
      lockLabel: REPOSITORY_LABEL,
      action,
    });
  }
}
