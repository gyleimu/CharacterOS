import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import { InMemoryCharacterImportTransitionHistoryRepository } from "../../src/db/repositories/characterImportTransitionHistoryRepository";
import { FileCharacterPhysicsRepository } from "../../src/db/repositories/characterPhysicsRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";
import {
  createDurableJsonEnvelope,
  serializeDurableJsonEnvelope,
} from "../../src/db/repositories/durableJsonEnvelope";
import { InMemoryLongitudinalCommitAuditRepository } from "../../src/db/repositories/longitudinalCommitAuditRepository";
import { InMemoryParameterAdjustmentHistoryRepository } from "../../src/db/repositories/parameterAdjustmentHistoryRepository";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";

const EVENT: ExperienceEvent = {
  id: "durable-state-regression-event",
  description: "A trusted person stopped replying.",
  tags: ["relationship", "waiting"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9,
};

describe("CharacterPhysicsService durable-state corruption regression", () => {
  it("persists a caller-provided non-default character id without an identity mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-service-identity-"));
    const filePath = join(dir, "physics_states.json");
    try {
      const service = new InMemoryCharacterPhysicsService(
        new FileCharacterPhysicsRepository(filePath),
        new InMemoryParameterAdjustmentHistoryRepository(),
        new InMemoryCharacterImportTransitionHistoryRepository(),
        new InMemoryLongitudinalCommitAuditRepository(),
      );

      const created = service.getState("custom_character");
      const reloaded = new FileCharacterPhysicsRepository(filePath).get("custom_character");

      expect(created.identity.id).toBe("custom_character");
      expect(created.identity.name).toBe("林凡");
      expect(reloaded?.identity.id).toBe("custom_character");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not auto-reset, process an event, or clear histories after state corruption", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-service-corruption-"));
    const filePath = join(dir, "physics_states.json");
    const corruptBytes = "{ truncated state";
    try {
      writeFileSync(filePath, corruptBytes, "utf8");
      const adjustmentHistory = new InMemoryParameterAdjustmentHistoryRepository();
      const importHistory = new InMemoryCharacterImportTransitionHistoryRepository();
      const longitudinalAudit = new InMemoryLongitudinalCommitAuditRepository();
      const adjustmentClear = vi.spyOn(adjustmentHistory, "clear");
      const importClear = vi.spyOn(importHistory, "clear");
      const auditClear = vi.spyOn(longitudinalAudit, "clear");
      const service = new InMemoryCharacterPhysicsService(
        new FileCharacterPhysicsRepository(filePath),
        adjustmentHistory,
        importHistory,
        longitudinalAudit,
      );

      expectCorrupted(() => service.getState("lin_fan"));
      expectCorrupted(() => service.processEvent("lin_fan", EVENT));
      expectCorrupted(() => service.resetCharacter("lin_fan"));

      expect(readFileSync(filePath, "utf8")).toBe(corruptBytes);
      expect(adjustmentClear).not.toHaveBeenCalled();
      expect(importClear).not.toHaveBeenCalled();
      expect(auditClear).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects checksum-tampered state before reads, event processing, or reset side effects", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-service-checksum-"));
    const filePath = join(dir, "physics_states.json");
    try {
      const repository = new FileCharacterPhysicsRepository(filePath);
      const adjustmentHistory = new InMemoryParameterAdjustmentHistoryRepository();
      const importHistory = new InMemoryCharacterImportTransitionHistoryRepository();
      const longitudinalAudit = new InMemoryLongitudinalCommitAuditRepository();
      const service = new InMemoryCharacterPhysicsService(
        repository,
        adjustmentHistory,
        importHistory,
        longitudinalAudit,
      );
      service.getState("lin_fan");

      const envelope = JSON.parse(readFileSync(filePath, "utf8")) as {
        payload: { lin_fan: { learningRate: number } };
      };
      envelope.payload.lin_fan.learningRate += 0.01;
      const tamperedBytes = JSON.stringify(envelope);
      writeFileSync(filePath, tamperedBytes, "utf8");

      const adjustmentClear = vi.spyOn(adjustmentHistory, "clear");
      const importClear = vi.spyOn(importHistory, "clear");
      const auditClear = vi.spyOn(longitudinalAudit, "clear");

      expectCorrupted(() => service.getState("lin_fan"));
      expectCorrupted(() => service.processEvent("lin_fan", EVENT));
      expectCorrupted(() => service.resetCharacter("lin_fan"));

      expect(readFileSync(filePath, "utf8")).toBe(tamperedBytes);
      expect(adjustmentClear).not.toHaveBeenCalled();
      expect(importClear).not.toHaveBeenCalled();
      expect(auditClear).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks checksum-valid invalid payloads before they reach Character Physics Core", () => {
    const dir = mkdtempSync(join(tmpdir(), "characteros-service-invalid-payload-"));
    const filePath = join(dir, "physics_states.json");
    try {
      const envelope = createDurableJsonEnvelope({
        repositoryKind: "character-physics",
        schemaVersion: 1,
        payload: { lin_fan: { coordinate: null } },
      });
      const invalidBytes = `${serializeDurableJsonEnvelope(envelope)}\n`;
      writeFileSync(filePath, invalidBytes, "utf8");

      const adjustmentHistory = new InMemoryParameterAdjustmentHistoryRepository();
      const importHistory = new InMemoryCharacterImportTransitionHistoryRepository();
      const longitudinalAudit = new InMemoryLongitudinalCommitAuditRepository();
      const adjustmentClear = vi.spyOn(adjustmentHistory, "clear");
      const importClear = vi.spyOn(importHistory, "clear");
      const auditClear = vi.spyOn(longitudinalAudit, "clear");
      const service = new InMemoryCharacterPhysicsService(
        new FileCharacterPhysicsRepository(filePath),
        adjustmentHistory,
        importHistory,
        longitudinalAudit,
      );

      expectCorrupted(() => service.getState("lin_fan"));
      expectCorrupted(() => service.processEvent("lin_fan", EVENT));
      expectCorrupted(() => service.resetCharacter("lin_fan"));

      expect(readFileSync(filePath, "utf8")).toBe(invalidBytes);
      expect(adjustmentClear).not.toHaveBeenCalled();
      expect(importClear).not.toHaveBeenCalled();
      expect(auditClear).not.toHaveBeenCalled();
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
