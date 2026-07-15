import { resolve } from "node:path";
import type { CharacterImportTransitionHistoryEntry } from "../../core/export/characterImportTransitionHistory";
import type { DurableRepositoryKind } from "./durableJsonEnvelope";
import { withRepositoryFileLock } from "./fileLock";
import {
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  writeJsonObjectFileAtomically,
} from "./jsonFileStore";

const REPOSITORY_LABEL = "character import transition history";
const REPOSITORY_KIND: DurableRepositoryKind = "character-import-transition-history";
const SCHEMA_VERSION = 1;

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

  private readStore(): SerializedImportTransitionHistoryStore {
    const result = readJsonObjectFile<SerializedImportTransitionHistoryStore>({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
    });
    return result.status === "not_found" ? {} : result.value;
  }

  private writeStore(store: SerializedImportTransitionHistoryStore): void {
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
