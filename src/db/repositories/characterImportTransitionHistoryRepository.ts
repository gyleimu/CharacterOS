import { resolve } from "node:path";
import type { CharacterImportTransitionHistoryEntry } from "../../core/export/characterImportTransitionHistory";
import { getDurableRepositorySpec } from "./durableRepositoryRegistry";
import { withRepositoryFileLock } from "./fileLock";
import {
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  writeJsonObjectFileAtomically,
  type RepositoryPersistenceIntent,
} from "./jsonFileStore";

const REPOSITORY_LABEL = "character import transition history";
const REPOSITORY_SPEC = getDurableRepositorySpec("character-import-transition-history");
const REPOSITORY_KIND = REPOSITORY_SPEC.repositoryKind;
const SCHEMA_VERSION = REPOSITORY_SPEC.schemaVersion;

export interface CharacterImportTransitionHistoryRepository {
  list(characterId: string): CharacterImportTransitionHistoryEntry[];
  append(entry: CharacterImportTransitionHistoryEntry): void;
  clear(characterId?: string): void;
}

export class InMemoryCharacterImportTransitionHistoryRepository
implements CharacterImportTransitionHistoryRepository {
  private readonly entries: CharacterImportTransitionHistoryEntry[] = [];

  list(characterId: string): CharacterImportTransitionHistoryEntry[] {
    return this.entries.filter((entry) => entry.characterId === characterId);
  }

  append(entry: CharacterImportTransitionHistoryEntry): void {
    this.entries.push(entry);
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

type SerializedImportTransitionHistoryStore = Record<string, CharacterImportTransitionHistoryEntry[]>;

export class FileCharacterImportTransitionHistoryRepository
implements CharacterImportTransitionHistoryRepository {
  constructor(private readonly filePath = resolve(process.cwd(), "data", "import_transition_history.json")) {}

  list(characterId: string): CharacterImportTransitionHistoryEntry[] {
    return this.readStore()[characterId] ?? [];
  }

  append(entry: CharacterImportTransitionHistoryEntry): void {
    this.withFileLock(() => {
      const store = this.readStore();
      store[entry.characterId] = [...(store[entry.characterId] ?? []), entry];
      this.writeStore(store, "validated-write");
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
          persistenceIntent: "destructive-clear",
        });
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store, "destructive-clear");
    });
  }

  private readStore(): SerializedImportTransitionHistoryStore {
    const result = readJsonObjectFile<SerializedImportTransitionHistoryStore>({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      repositorySpec: REPOSITORY_SPEC,
    });
    return result.status === "not_found" ? {} : result.value;
  }

  private writeStore(
    store: SerializedImportTransitionHistoryStore,
    persistenceIntent: RepositoryPersistenceIntent,
  ): void {
    writeJsonObjectFileAtomically({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      repositorySpec: REPOSITORY_SPEC,
      persistenceIntent,
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
