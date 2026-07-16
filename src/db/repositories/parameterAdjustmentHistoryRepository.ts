import { resolve } from "node:path";
import type { ParameterAdjustmentHistoryEntry } from "../../core/parameters/parameterAdjustmentHistory";
import { getDurableRepositorySpec } from "./durableRepositoryRegistry";
import { withRepositoryFileLock } from "./fileLock";
import {
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  writeJsonObjectFileAtomically,
} from "./jsonFileStore";

const REPOSITORY_LABEL = "parameter adjustment history";
const REPOSITORY_SPEC = getDurableRepositorySpec("parameter-adjustment-history");
const REPOSITORY_KIND = REPOSITORY_SPEC.repositoryKind;
const SCHEMA_VERSION = REPOSITORY_SPEC.schemaVersion;

export interface ParameterAdjustmentHistoryRepository {
  list(characterId: string): ParameterAdjustmentHistoryEntry[];
  append(entry: ParameterAdjustmentHistoryEntry): void;
  replace(characterId: string, entries: ParameterAdjustmentHistoryEntry[]): void;
  clear(characterId?: string): void;
}

export class InMemoryParameterAdjustmentHistoryRepository implements ParameterAdjustmentHistoryRepository {
  private readonly entries: ParameterAdjustmentHistoryEntry[] = [];

  list(characterId: string): ParameterAdjustmentHistoryEntry[] {
    return this.entries.filter((entry) => entry.characterId === characterId);
  }

  append(entry: ParameterAdjustmentHistoryEntry): void {
    this.entries.push(entry);
  }

  replace(characterId: string, entries: ParameterAdjustmentHistoryEntry[]): void {
    this.clear(characterId);
    this.entries.push(...entries.map((entry) => ({ ...entry, characterId })));
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

type SerializedHistoryStore = Record<string, ParameterAdjustmentHistoryEntry[]>;

export class FileParameterAdjustmentHistoryRepository implements ParameterAdjustmentHistoryRepository {
  constructor(private readonly filePath = resolve(process.cwd(), "data", "parameter_adjustment_history.json")) {}

  list(characterId: string): ParameterAdjustmentHistoryEntry[] {
    return this.readStore()[characterId] ?? [];
  }

  append(entry: ParameterAdjustmentHistoryEntry): void {
    this.withFileLock(() => {
      const store = this.readStore();
      store[entry.characterId] = [...(store[entry.characterId] ?? []), entry];
      this.writeStore(store);
    });
  }

  replace(characterId: string, entries: ParameterAdjustmentHistoryEntry[]): void {
    this.withFileLock(() => {
      const store = this.readStore();
      store[characterId] = entries.map((entry) => ({ ...entry, characterId }));
      this.writeStore(store);
    });
  }

  clear(characterId?: string): void {
    this.withFileLock(() => {
      if (!characterId) {
        removeJsonObjectFileAndBackup({
          filePath: this.filePath,
          repositoryLabel: REPOSITORY_LABEL,
          repositoryKind: REPOSITORY_KIND,
          schemaVersion: SCHEMA_VERSION,
        });
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  private readStore(): SerializedHistoryStore {
    const result = readJsonObjectFile<SerializedHistoryStore>({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      repositorySpec: REPOSITORY_SPEC,
    });
    return result.status === "not_found" ? {} : result.value;
  }

  private writeStore(store: SerializedHistoryStore): void {
    writeJsonObjectFileAtomically({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      value: store,
    });
  }

  private withFileLock(action: () => void): void {
    withRepositoryFileLock({
      filePath: this.filePath,
      lockLabel: REPOSITORY_LABEL,
      action
    });
  }
}
