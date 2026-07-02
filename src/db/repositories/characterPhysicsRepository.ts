import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
  type SerializedCharacterPhysicsState
} from "../../core/physics/serialization";
import type { CharacterPhysicsState } from "../../core/physics/physicsEngine";
import { withRepositoryFileLock } from "./fileLock";

export interface CharacterPhysicsRepository {
  get(characterId: string): CharacterPhysicsState | undefined;
  set(characterId: string, state: CharacterPhysicsState): void;
  update(
    characterId: string,
    updater: (state: CharacterPhysicsState | undefined) => CharacterPhysicsState
  ): CharacterPhysicsState;
  delete(characterId: string): void;
  clear(): void;
}

export class InMemoryCharacterPhysicsRepository implements CharacterPhysicsRepository {
  private readonly states = new Map<string, CharacterPhysicsState>();

  get(characterId: string): CharacterPhysicsState | undefined {
    return this.states.get(characterId);
  }

  set(characterId: string, state: CharacterPhysicsState): void {
    this.states.set(characterId, state);
  }

  update(
    characterId: string,
    updater: (state: CharacterPhysicsState | undefined) => CharacterPhysicsState
  ): CharacterPhysicsState {
    const nextState = updater(this.states.get(characterId));
    this.states.set(characterId, nextState);
    return nextState;
  }

  delete(characterId: string): void {
    this.states.delete(characterId);
  }

  clear(): void {
    this.states.clear();
  }
}

type SerializedStateStore = Record<string, SerializedCharacterPhysicsState>;

export class FileCharacterPhysicsRepository implements CharacterPhysicsRepository {
  constructor(private readonly filePath = resolve(process.cwd(), "data", "physics_states.json")) {}

  get(characterId: string): CharacterPhysicsState | undefined {
    return this.withFileLock(() => {
      const serialized = this.readStore()[characterId];
      return serialized ? deserializeCharacterPhysicsState(serialized) : undefined;
    });
  }

  set(characterId: string, state: CharacterPhysicsState): void {
    this.withFileLock(() => {
      const store = this.readStore();
      store[characterId] = serializeCharacterPhysicsState(state);
      this.writeStore(store);
    });
  }

  update(
    characterId: string,
    updater: (state: CharacterPhysicsState | undefined) => CharacterPhysicsState
  ): CharacterPhysicsState {
    return this.withFileLock(() => {
      const store = this.readStore();
      const current = store[characterId] ? deserializeCharacterPhysicsState(store[characterId]) : undefined;
      const nextState = updater(current);
      store[characterId] = serializeCharacterPhysicsState(nextState);
      this.writeStore(store);
      return nextState;
    });
  }

  delete(characterId: string): void {
    this.withFileLock(() => {
      const store = this.readStore();
      delete store[characterId];
      this.writeStore(store);
    });
  }

  clear(): void {
    this.withFileLock(() => {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
    });
  }

  private readStore(): SerializedStateStore {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as SerializedStateStore;
    } catch {
      return {};
    }
  }

  private writeStore(store: SerializedStateStore): void {
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
      lockLabel: "character physics state",
      action
    });
  }
}
