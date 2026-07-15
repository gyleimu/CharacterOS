import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ExperienceEvent } from "../../src/core/event/event";
import { InMemoryCharacterImportTransitionHistoryRepository } from "../../src/db/repositories/characterImportTransitionHistoryRepository";
import { FileCharacterPhysicsRepository } from "../../src/db/repositories/characterPhysicsRepository";
import { RepositoryFileError } from "../../src/db/repositories/jsonFileStore";
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
