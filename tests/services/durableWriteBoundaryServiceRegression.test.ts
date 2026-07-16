import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import { buildImportConfirmationPhrase } from "../../src/core/export/characterImportApply";
import type { ExperienceEvent } from "../../src/core/event/event";
import { LONGITUDINAL_COMMIT_CONFIRMATION } from "../../src/core/life/longitudinalCommitApply";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { CharacterPhysicsState } from "../../src/core/physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { FileCharacterImportTransitionHistoryRepository } from "../../src/db/repositories/characterImportTransitionHistoryRepository";
import { FileCharacterPhysicsRepository } from "../../src/db/repositories/characterPhysicsRepository";
import { getDurableRepositorySpec } from "../../src/db/repositories/durableRepositoryRegistry";
import type { DurableRepositoryKind } from "../../src/db/repositories/durableJsonEnvelope";
import {
  getRepositoryBackupPath,
  readJsonObjectFile,
} from "../../src/db/repositories/jsonFileStore";
import { FileLongitudinalCommitAuditRepository } from "../../src/db/repositories/longitudinalCommitAuditRepository";
import { FileParameterAdjustmentHistoryRepository } from "../../src/db/repositories/parameterAdjustmentHistoryRepository";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";
import {
  buildLongitudinalCommitHandoff,
  cloneWithGeneratedMemory,
} from "../helpers/longitudinalCommitTestUtils";

const CHARACTER_ID = "durable_integration_character";
const EVENT: ExperienceEvent = {
  id: "durable-write-integration-event",
  description: "A trusted person stopped replying during an important conversation.",
  tags: ["relationship", "waiting"],
  intensity: 0.8,
  importance: 0.8,
  relationshipWeight: 0.9,
  expectationGap: 0.8,
  personalitySensitivity: 0.9,
};

describe("Durable write boundary service regression with real File Repositories", () => {
  it("routes event processing through the validated character physics atomic writer", () => {
    withFileService(({ service, files }) => {
      const result = service.processEvent(CHARACTER_ID, EVENT);

      expect(result.memoryNode.id).toBeTruthy();
      expect(service.getState(CHARACTER_ID).memories).toHaveLength(1);
      expectDurableFile(files.physics, "character-physics");
    });
  });

  it("routes parameter apply through character state and adjustment history writers", () => {
    withFileService(({ service, files }) => {
      service.resetCharacter(CHARACTER_ID);
      const before = service.getState(CHARACTER_ID).metaState.selfControl;
      const patch = patchTrace(before, before - 0.02);
      const snapshot = buildParameterAdjustmentSnapshotTrace({
        state: service.getState(CHARACTER_ID),
        patch,
      });

      const result = service.applyParameterAdjustment(CHARACTER_ID, patch, snapshot);

      expect(result.status).toBe("applied");
      expectDurableFile(files.physics, "character-physics");
      expectDurableFile(files.parameterHistory, "parameter-adjustment-history");
    });
  });

  it("routes parameter rollback through character state and adjustment history writers", () => {
    withFileService(({ service, files }) => {
      service.resetCharacter(CHARACTER_ID);
      const before = service.getState(CHARACTER_ID).metaState.selfControl;
      const patch = patchTrace(before, before - 0.02);
      const snapshot = buildParameterAdjustmentSnapshotTrace({
        state: service.getState(CHARACTER_ID),
        patch,
      });
      expect(service.applyParameterAdjustment(CHARACTER_ID, patch, snapshot).status).toBe("applied");

      const result = service.rollbackParameterAdjustment(CHARACTER_ID, snapshot);

      expect(result.status).toBe("applied");
      expect(service.getParameterAdjustmentHistory(CHARACTER_ID)).toHaveLength(2);
      expectDurableFile(files.physics, "character-physics");
      expectDurableFile(files.parameterHistory, "parameter-adjustment-history");
    });
  });

  it("routes confirmed import through state, adjustment, and import-history writers", () => {
    withFileService(({ service, files }) => {
      service.resetCharacter(CHARACTER_ID);
      const sourceState = service.getState(CHARACTER_ID);
      const importPackage = exportPackage(CHARACTER_ID, sourceState);

      const result = service.importCharacterPackage(
        CHARACTER_ID,
        importPackage,
        buildImportConfirmationPhrase(CHARACTER_ID),
      );

      expect(result.status).toBe("applied");
      expect(service.getImportTransitionHistory(CHARACTER_ID)).toHaveLength(1);
      expectDurableFile(files.physics, "character-physics");
      expectDurableFile(files.parameterHistory, "parameter-adjustment-history");
      expectDurableFile(files.importHistory, "character-import-transition-history");
    });
  });

  it("routes editor replacement through the validated character physics writer", () => {
    withFileService(({ service, files }) => {
      service.resetCharacter(CHARACTER_ID);
      const replacement = service.getState(CHARACTER_ID);
      replacement.coordinate.values.trust = Math.min(1, replacement.coordinate.values.trust + 0.01);

      service.replaceState(CHARACTER_ID, replacement);

      expect(service.getState(CHARACTER_ID).coordinate.values.trust)
        .toBe(replacement.coordinate.values.trust);
      expectDurableFile(files.physics, "character-physics");
    });
  });

  it("routes longitudinal commit through state and longitudinal audit writers", () => {
    withFileService(({ service, files }) => {
      service.resetCharacter(CHARACTER_ID);
      const baseState = service.getState(CHARACTER_ID);
      const finalState = cloneWithGeneratedMemory(baseState, "durable-integration-memory");
      const handoff = buildLongitudinalCommitHandoff(CHARACTER_ID, baseState, finalState);

      const result = service.applyLongitudinalCommit(handoff, {
        confirmation: LONGITUDINAL_COMMIT_CONFIRMATION,
        appliedAt: "2026-07-16T01:00:00.000Z",
      });

      expect(result.status).toBe("applied");
      expect(service.getLongitudinalCommitAuditHistory(CHARACTER_ID)[0]?.status).toBe("applied");
      expectDurableFile(files.physics, "character-physics");
      expectDurableFile(files.longitudinalAudit, "longitudinal-commit-audit");
    });
  });
});

interface FileServicePaths {
  readonly physics: string;
  readonly parameterHistory: string;
  readonly importHistory: string;
  readonly longitudinalAudit: string;
}

function withFileService(
  action: (params: {
    service: InMemoryCharacterPhysicsService;
    files: FileServicePaths;
  }) => void,
): void {
  const directoryPath = mkdtempSync(join(tmpdir(), "characteros-durable-service-"));
  const files: FileServicePaths = {
    physics: join(directoryPath, "physics.json"),
    parameterHistory: join(directoryPath, "parameter-history.json"),
    importHistory: join(directoryPath, "import-history.json"),
    longitudinalAudit: join(directoryPath, "longitudinal-audit.json"),
  };
  const service = new InMemoryCharacterPhysicsService(
    new FileCharacterPhysicsRepository(files.physics),
    new FileParameterAdjustmentHistoryRepository(files.parameterHistory),
    new FileCharacterImportTransitionHistoryRepository(files.importHistory),
    new FileLongitudinalCommitAuditRepository(files.longitudinalAudit),
  );
  try {
    action({ service, files });
  } finally {
    rmSync(directoryPath, { recursive: true, force: true });
  }
}

function expectDurableFile(filePath: string, repositoryKind: DurableRepositoryKind): void {
  const repositorySpec = getDurableRepositorySpec(repositoryKind);
  for (const durablePath of [filePath, getRepositoryBackupPath(filePath)]) {
    expect(existsSync(durablePath)).toBe(true);
    const result = readJsonObjectFile<Record<string, unknown>>({
      filePath: durablePath,
      repositoryLabel: `integration ${repositoryKind}`,
      repositoryKind,
      schemaVersion: repositorySpec.schemaVersion,
      repositorySpec,
    });
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.format).toBe("envelope-v1");
      expect(result.repositoryKind).toBe(repositoryKind);
      expect(result.checksum?.value).toMatch(/^[a-f0-9]{64}$/u);
    }
  }
}

function patchTrace(from: number, value: number): ParameterAdjustmentPatchTrace {
  return {
    status: "ready",
    operations: [{
      op: "replace",
      path: "metaState.selfControl",
      from,
      value,
      reason: "durable write boundary integration test",
    }],
    reasons: [],
  };
}

function exportPackage(
  characterId: string,
  state: CharacterPhysicsState,
): CharacterPhysicsExportResponse {
  return {
    exportedAt: "2026-07-16T00:00:00.000Z",
    characterId,
    version: "1.1",
    state: serializeCharacterPhysicsState(state),
    adjustmentHistory: {
      history: [],
      summary: {
        totalEntries: 0,
        appliedCount: 0,
        rollbackCount: 0,
        blockedCount: 0,
        overrideCount: 0,
        totalOperations: 0,
        uniqueTargetPaths: [],
        latestTargetPaths: [],
        frequentTargetPaths: [],
        stabilityRisk: "low",
        reasons: ["durable write boundary integration fixture"],
      },
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: ["durable write boundary integration fixture"],
      },
    },
  };
}
