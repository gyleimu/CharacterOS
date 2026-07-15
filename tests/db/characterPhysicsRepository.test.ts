import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import {
  FileCharacterPhysicsRepository,
  InMemoryCharacterPhysicsRepository
} from "../../src/db/repositories/characterPhysicsRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";

describe("InMemoryCharacterPhysicsRepository", () => {
  it("stores, returns, deletes, and clears character physics states", () => {
    const repository = new InMemoryCharacterPhysicsRepository();
    const state = createCharacterPhysicsState();

    repository.set("lin_fan", state);
    expect(repository.get("lin_fan")).toBe(state);

    repository.delete("lin_fan");
    expect(repository.get("lin_fan")).toBeUndefined();

    repository.set("lin_fan", state);
    repository.clear();
    expect(repository.get("lin_fan")).toBeUndefined();
  });

  it("persists character physics states to a JSON file", () => {
    const dir = mkdtempSync(join(tmpdir(), "character-os-"));
    const filePath = join(dir, "physics_states.json");
    try {
      const repository = new FileCharacterPhysicsRepository(filePath);
      const state = createCharacterPhysicsState();

      repository.set("lin_fan", state);

      expect(JSON.parse(readFileSync(filePath, "utf8"))).toMatchObject({
        format: "characteros.durable-json",
        envelopeVersion: 1,
        repositoryKind: "character-physics",
        schemaVersion: 1,
        payload: { lin_fan: serializeCharacterPhysicsState(state) },
      });

      const reloaded = new FileCharacterPhysicsRepository(filePath).get("lin_fan");
      expect(reloaded?.coordinate.values.trust).toBe(state.coordinate.values.trust);
      expect(reloaded?.learningRate).toBe(state.learningRate);

      repository.delete("lin_fan");
      expect(repository.get("lin_fan")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("FileCharacterPhysicsRepository", () => {
  it("distinguishes a missing store from a corrupted store", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-state-"));
    const filePath = join(dir, "states.json");
    try {
      const repository = new FileCharacterPhysicsRepository(filePath);
      expect(repository.get("lin_fan")).toBeUndefined();

      writeFileSync(filePath, "{ bad json", "utf8");
      expectCorrupted(() => repository.get("lin_fan"));
      expect(readFileSync(filePath, "utf8")).toBe("{ bad json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed when a write is attempted against a corrupt store", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-state-"));
    const filePath = join(dir, "states.json");
    try {
      writeFileSync(filePath, "{ bad json", "utf8");
      const repository = new FileCharacterPhysicsRepository(filePath);

      expectCorrupted(() => repository.set("lin_fan", createCharacterPhysicsState()));
      expect(readFileSync(filePath, "utf8")).toBe("{ bad json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads legacy-v0 state without rewriting it", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-state-"));
    const filePath = join(dir, "states.json");
    try {
      const state = createCharacterPhysicsState();
      const legacy = `${JSON.stringify({ lin_fan: serializeCharacterPhysicsState(state) }, null, 2)}\n`;
      writeFileSync(filePath, legacy, "utf8");

      const reloaded = new FileCharacterPhysicsRepository(filePath).get("lin_fan");

      expect(reloaded?.coordinate.values.trust).toBe(state.coordinate.values.trust);
      expect(readFileSync(filePath, "utf8")).toBe(legacy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function expectCorrupted(action: () => unknown): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RepositoryFileError);
  expect((caught as RepositoryFileError).code).toBe("CORRUPTED");
}
