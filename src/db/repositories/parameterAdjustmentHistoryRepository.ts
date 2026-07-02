import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { ParameterAdjustmentHistoryEntry } from "../../core/parameters/parameterAdjustmentHistory";
import { withRepositoryFileLock } from "./fileLock";

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
        if (existsSync(this.filePath)) unlinkSync(this.filePath);
        return;
      }
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  private readStore(): SerializedHistoryStore {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as SerializedHistoryStore;
    } catch {
      return {};
    }
  }

  private writeStore(store: SerializedHistoryStore): void {
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
      lockLabel: "parameter adjustment history",
      action
    });
  }
}
