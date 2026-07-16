import { describe, expect, it } from "vitest";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import { computeCharacterExportPackageDigest } from "../../src/core/export/characterExportPackageDigest";
import {
  authorizeCharacterImportApplication,
  buildImportConfirmationPhrase
} from "../../src/core/export/characterImportApply";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { inspectCharacterStateIntegrity } from "../../src/core/state/stateIntegrity";
import { createDefaultState } from "../../src/services/characterPhysicsService";

describe("character import apply authorization", () => {
  it("blocks a valid package without explicit confirmation", () => {
    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: validPackage({ characterId: "lin_fan" })
    });

    expect(trace.status).toBe("blocked");
    expect(trace.confirmationRequired).toBe("replace:lin_fan");
    expect(trace.reasons).toContain("explicit confirmation phrase is required before replacing character state");
  });

  it("allows a ready package when the confirmation phrase matches", () => {
    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: validPackage({ characterId: "lin_fan" }),
      confirmation: buildImportConfirmationPhrase("lin_fan")
    });

    expect(trace.status).toBe("applied");
    expect(trace.plan.status).toBe("ready");
    expect(trace.errors).toEqual([]);
  });

  it("blocks high-risk packages even with confirmation", () => {
    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: validPackage({
        characterId: "lin_fan",
        stabilityRisk: "high",
        governanceRecommendation: "pause"
      }),
      confirmation: buildImportConfirmationPhrase("lin_fan")
    });

    expect(trace.status).toBe("blocked");
    expect(trace.plan.status).toBe("needs_review");
    expect(trace.reasons).toContain("import plan is not ready for application");
  });

  it("blocks structurally broken packages even with confirmation", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true
    });
    pkg.state.memories[0] = {
      ...pkg.state.memories[0]!,
      clusterId: "cluster_missing"
    };

    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: pkg,
      confirmation: buildImportConfirmationPhrase("lin_fan")
    });

    expect(trace.status).toBe("blocked");
    expect(trace.plan.status).toBe("blocked");
    expect(trace.errors).toContain("memories[0].clusterId: memory references missing cluster: cluster_missing");
  });

  it("blocks packages with mismatched embedded integrity snapshots even with confirmation", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true,
      includeStateIntegrity: true
    });
    pkg.stateIntegrity!.summary.memoryCount = 99;

    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: pkg,
      confirmation: buildImportConfirmationPhrase("lin_fan")
    });

    expect(trace.status).toBe("blocked");
    expect(trace.plan.status).toBe("needs_review");
    expect(trace.plan.stateIntegritySnapshotComparison.status).toBe("mismatch");
    expect(trace.reasons).toContain("import plan is not ready for application");
  });

  it("blocks packages with mismatched package digests even with confirmation", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true,
      includeStateIntegrity: true,
      includePackageDigest: true
    });
    pkg.exportedAt = "2026-06-21T00:01:00.000Z";

    const trace = authorizeCharacterImportApplication({
      targetCharacterId: "lin_fan",
      package: pkg,
      confirmation: buildImportConfirmationPhrase("lin_fan")
    });

    expect(trace.status).toBe("blocked");
    expect(trace.plan.status).toBe("needs_review");
    expect(trace.plan.packageDigestComparison.status).toBe("mismatch");
    expect(trace.reasons).toContain("import plan is not ready for application");
  });
});

function validPackage(params: {
  characterId: string;
  stabilityRisk?: "low" | "medium" | "high";
  governanceRecommendation?: "allow" | "cooldown" | "pause";
  seedInitialExperiences?: boolean;
  includeStateIntegrity?: boolean;
  includePackageDigest?: boolean;
}): CharacterPhysicsExportResponse {
  const stabilityRisk = params.stabilityRisk ?? "low";
  const governanceRecommendation = params.governanceRecommendation ?? "allow";
  const state = createDefaultState(params.characterId, {
    seedInitialExperiences: params.seedInitialExperiences ?? false
  });
  const pkg: CharacterPhysicsExportResponse = {
    exportedAt: "2026-06-21T00:00:00.000Z",
    characterId: params.characterId,
    version: "1.1",
    state: serializeCharacterPhysicsState(state),
    ...(params.includeStateIntegrity ? { stateIntegrity: inspectCharacterStateIntegrity(state) } : {}),
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
        stabilityRisk,
        reasons: ["test"]
      },
      governance: {
        recommendation: governanceRecommendation,
        cooldownDays: governanceRecommendation === "allow" ? 0 : 14,
        cooldownActive: governanceRecommendation !== "allow",
        reasons: ["test"]
      }
    }
  };
  return {
    ...pkg,
    ...(params.includePackageDigest ? { packageDigest: computeCharacterExportPackageDigest(pkg) } : {})
  };
}
