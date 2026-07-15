import { resolve } from "node:path";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
  type SerializedCharacterPhysicsState
} from "../../core/physics/serialization";
import type { CharacterPhysicsState } from "../../core/physics/physicsEngine";
import { getDurableRepositorySpec } from "./durableRepositoryRegistry";
import { withRepositoryFileLock } from "./fileLock";
import {
  readJsonObjectFile,
  removeJsonObjectFileAndBackup,
  writeJsonObjectFileAtomically,
} from "./jsonFileStore";

const REPOSITORY_LABEL = "character physics state";
const REPOSITORY_SPEC = getDurableRepositorySpec("character-physics");
const REPOSITORY_KIND = REPOSITORY_SPEC.repositoryKind;
const SCHEMA_VERSION = REPOSITORY_SPEC.schemaVersion;

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
      removeJsonObjectFileAndBackup({
        filePath: this.filePath,
        repositoryLabel: REPOSITORY_LABEL,
        repositoryKind: REPOSITORY_KIND,
        schemaVersion: SCHEMA_VERSION,
      });
    });
  }

  private readStore(): SerializedStateStore {
    const result = readJsonObjectFile<SerializedStateStore>({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
    });
    return result.status === "not_found" ? {} : result.value;
  }

  private writeStore(store: SerializedStateStore): void {
    writeJsonObjectFileAtomically({
      filePath: this.filePath,
      repositoryLabel: REPOSITORY_LABEL,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      value: store,
    });
  }

  private withFileLock<T>(action: () => T): T {
    return withRepositoryFileLock({
      filePath: this.filePath,
      lockLabel: REPOSITORY_LABEL,
      action
    });
  }
}
