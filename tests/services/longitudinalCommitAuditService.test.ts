import { describe, expect, it } from "vitest";
import type { LongitudinalCommitAuditEntry } from "../../src/core/life/longitudinalCommitAudit";
import { InMemoryCharacterPhysicsService } from "../../src/services/characterPhysicsService";

function digest(value: string) {
  return {
    algorithm: "sha256" as const,
    canonicalization: "characteros-longitudinal-json-v1" as const,
    value,
  };
}

function summary(memoryCount: number) {
  return {
    memoryCount,
    beliefCount: 0,
    trust: 0.5,
    fear: 0.5,
    control: 0.5,
    openness: 0.5,
    conscientiousness: 0.5,
    boundaryStress: 0,
    boundaryIntegrity: 1,
    metaResilience: 0.5,
    metaSelfControl: 0.5,
  };
}

function auditEntry(characterId: string): LongitudinalCommitAuditEntry {
  return {
    version: "v10.24",
    id: "audit-service-1",
    characterId,
    simulationId: "longsim-service-1",
    status: "previewed",
    createdAt: "2026-06-28T00:00:00.000Z",
    updatedAt: "2026-06-28T00:00:00.000Z",
    requestDigest: digest("request"),
    baseStateFingerprint: digest("base"),
    finalStateFingerprint: digest("final"),
    commitPolicy: { enabled: true, commitDreams: true },
    changedPaths: ["memories[0]"],
    generatedMemoryIds: ["life-dream-service-1"],
    beforeSummary: summary(0),
    afterSummary: summary(1),
    governanceStatus: "pass",
    governanceBlockers: [],
    governanceWarnings: [],
    rollbackPlan: {
      id: "rollback-service-1",
      simulationId: "longsim-service-1",
      type: "remove_generated_memories",
      generatedMemoryIds: ["life-dream-service-1"],
      baseStateFingerprint: digest("base"),
      finalStateFingerprint: digest("final"),
      staleWritePolicy: "block_if_changed",
      warnings: [],
      reasons: ["test rollback"],
    },
    warnings: [],
    reasons: ["test audit"],
  };
}

describe("InMemoryCharacterPhysicsService longitudinal commit audit", () => {
  it("records and reads longitudinal commit audit entries", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-audit-char";
    service.resetCharacter(characterId);

    service.recordLongitudinalCommitAudit(auditEntry(characterId));

    expect(service.getLongitudinalCommitAuditHistory(characterId)).toHaveLength(1);
    expect(service.getLongitudinalCommitAuditBySimulationId(characterId, "longsim-service-1")?.id)
      .toBe("audit-service-1");
  });

  it("clears longitudinal commit audit when character is reset", () => {
    const service = new InMemoryCharacterPhysicsService();
    const characterId = "service-audit-reset-char";
    service.resetCharacter(characterId);
    service.recordLongitudinalCommitAudit(auditEntry(characterId));

    service.resetCharacter(characterId);

    expect(service.getLongitudinalCommitAuditHistory(characterId)).toHaveLength(0);
  });
});
