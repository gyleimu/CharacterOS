import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { CharacterImportTransitionHistoryEntry } from "../../core/export/characterImportTransitionHistory";
import { withRepositoryFileLock } from "./fileLock";

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
        if (existsSync(this.filePath)) unlinkSync(this.filePath);
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  private readStore(): SerializedImportTransitionHistoryStore {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as SerializedImportTransitionHistoryStore;
    } catch {
      return {};
    }
  }

  private writeStore(store: SerializedImportTransitionHistoryStore): void {
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

  private withFileLock(action: () => void): void {
    withRepositoryFileLock({
      filePath: this.filePath,
      lockLabel: "character import transition history",
      action
    });
  }
}
