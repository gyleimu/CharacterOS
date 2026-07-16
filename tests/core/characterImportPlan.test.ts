import { describe, expect, it } from "vitest";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import { computeCharacterExportPackageDigest } from "../../src/core/export/characterExportPackageDigest";
import { buildCharacterImportPlan } from "../../src/core/export/characterImportPlan";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { inspectCharacterStateIntegrity } from "../../src/core/state/stateIntegrity";
import { createDefaultState } from "../../src/services/characterPhysicsService";

describe("character import plan", () => {
  it("creates a ready low-risk plan for a valid same-character package", () => {
    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: validPackage({ characterId: "lin_fan" })
    });

    expect(plan.status).toBe("ready");
    expect(plan.risk).toBe("low");
    expect(plan.requiresExplicitConfirmation).toBe(true);
    expect(plan.willReplaceState).toBe(true);
    expect(plan.willReplaceAdjustmentHistory).toBe(true);
    expect(plan.stateIntegrity?.valid).toBe(true);
    expect(plan.stateIntegritySnapshotComparison.status).toBe("missing");
    expect(plan.packageDigestComparison.status).toBe("missing");
    expect(plan.auditSummary.decision).toBe("can_apply");
    expect(plan.auditSummary.canApply).toBe(true);
    expect(plan.auditSummary.warnings).toContain("package digest is missing");
    expect(plan.errors).toEqual([]);
  });

  it("records matched embedded integrity snapshot and package digest", () => {
    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: validPackage({
        characterId: "lin_fan",
        includeStateIntegrity: true,
        includePackageDigest: true
      })
    });

    expect(plan.status).toBe("ready");
    expect(plan.risk).toBe("low");
    expect(plan.stateIntegritySnapshotComparison.status).toBe("matched");
    expect(plan.packageDigestComparison.status).toBe("matched");
    expect(plan.auditSummary.warnings).toEqual([]);
    expect(plan.reasons).toContain("embedded integrity snapshot matches recomputed state integrity");
    expect(plan.reasons).toContain("embedded package digest matches current package content");
  });

  it("marks cross-character import as medium risk", () => {
    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: validPackage({ characterId: "other_character" })
    });

    expect(plan.status).toBe("ready");
    expect(plan.risk).toBe("medium");
    expect(plan.reasons).toContain("source character id differs from target character id");
  });

  it("blocks invalid packages", () => {
    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: { version: "1.0" }
    });

    expect(plan.status).toBe("blocked");
    expect(plan.risk).toBe("high");
    expect(plan.requiresExplicitConfirmation).toBe(false);
    expect(plan.errors).toContain("version must be a supported export version");
  });

  it("blocks structurally broken state packages", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true
    });
    pkg.state.memories[0] = {
      ...pkg.state.memories[0]!,
      clusterId: "cluster_missing"
    };

    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: pkg
    });

    expect(plan.status).toBe("blocked");
    expect(plan.risk).toBe("high");
    expect(plan.stateIntegrity?.valid).toBe(false);
    expect(plan.auditSummary.decision).toBe("rejected");
    expect(plan.auditSummary.canApply).toBe(false);
    expect(plan.auditSummary.blockers).toContain("state integrity failed");
    expect(plan.reasons).toContain("source package state failed integrity inspection");
    expect(plan.errors).toContain("memories[0].clusterId: memory references missing cluster: cluster_missing");
  });

  it("requires review when embedded integrity snapshot differs from recomputed state", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true,
      includeStateIntegrity: true
    });
    pkg.stateIntegrity!.summary.memoryCount = 99;

    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: pkg
    });

    expect(plan.status).toBe("needs_review");
    expect(plan.risk).toBe("high");
    expect(plan.stateIntegrity?.valid).toBe(true);
    expect(plan.stateIntegritySnapshotComparison.status).toBe("mismatch");
    expect(plan.auditSummary.decision).toBe("review_required");
    expect(plan.auditSummary.requiresReview).toBe(true);
    expect(plan.auditSummary.blockers).toContain("embedded integrity snapshot does not match recomputed state");
    expect(plan.reasons).toContain("embedded integrity snapshot differs from recomputed state integrity");
    expect(plan.stateIntegritySnapshotComparison.reasons).toContain(
      "summary.memoryCount mismatch: embedded=99 recomputed=3"
    );
  });

  it("requires review when embedded package digest differs from current package content", () => {
    const pkg = validPackage({
      characterId: "lin_fan",
      seedInitialExperiences: true,
      includeStateIntegrity: true,
      includePackageDigest: true
    });
    pkg.exportedAt = "2026-06-21T00:01:00.000Z";

    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: pkg
    });

    expect(plan.status).toBe("needs_review");
    expect(plan.risk).toBe("high");
    expect(plan.stateIntegrity?.valid).toBe(true);
    expect(plan.packageDigestComparison.status).toBe("mismatch");
    expect(plan.auditSummary.decision).toBe("review_required");
    expect(plan.auditSummary.blockers).toContain("package digest does not match current content");
    expect(plan.reasons).toContain("embedded package digest differs from current package content");
  });

  it("requires review for high-risk governance packages", () => {
    const plan = buildCharacterImportPlan({
      targetCharacterId: "lin_fan",
      package: validPackage({
        characterId: "lin_fan",
        stabilityRisk: "high",
        governanceRecommendation: "pause"
      })
    });

    expect(plan.status).toBe("needs_review");
    expect(plan.risk).toBe("high");
    expect(plan.reasons).toContain("source package governance recommends pause");
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
