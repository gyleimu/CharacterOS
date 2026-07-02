import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import {
  FileCharacterPhysicsRepository,
  InMemoryCharacterPhysicsRepository
} from "../../src/db/repositories/characterPhysicsRepository";

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
  it("falls back to an empty store when the JSON file is corrupt", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-state-"));
    const filePath = join(dir, "states.json");
    try {
      writeFileSync(filePath, "{ bad json", "utf8");
      const repository = new FileCharacterPhysicsRepository(filePath);

      expect(repository.get("lin_fan")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
