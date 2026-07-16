import { describe, expect, it } from "vitest";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import {
  compareCharacterExportPackageDigest,
  computeCharacterExportPackageDigest
} from "../../src/core/export/characterExportPackageDigest";
import {
  summarizeCharacterExportPackage,
  validateCharacterExportPackage
} from "../../src/core/export/characterExportValidation";
import { serializeCharacterPhysicsState } from "../../src/core/physics/serialization";
import { inspectCharacterStateIntegrity } from "../../src/core/state/stateIntegrity";
import { createDefaultState } from "../../src/services/characterPhysicsService";

describe("character export validation", () => {
  it("accepts a complete character export package", () => {
    const pkg = validPackage();
    const validation = validateCharacterExportPackage(pkg);
    const summary = summarizeCharacterExportPackage(pkg);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(summary?.stateIntegrityValid).toBe(true);
    expect(summary?.stateIntegrityErrorCount).toBe(0);
    expect(summary?.hasPackageDigest).toBe(true);
    expect(compareCharacterExportPackageDigest(pkg).status).toBe("matched");
  });

  it("rejects unsupported export versions", () => {
    const pkg = {
      ...validPackage(),
      version: "1.0"
    };

    const validation = validateCharacterExportPackage(pkg);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("version must be a supported export version");
  });

  it("rejects packages without adjustment audit data", () => {
    const pkg = validPackage() as unknown as Record<string, unknown>;
    delete pkg.adjustmentHistory;

    const validation = validateCharacterExportPackage(pkg);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("adjustmentHistory must be an object");
  });

  it("rejects malformed state integrity reports when present", () => {
    const pkg = {
      ...validPackage(),
      stateIntegrity: {
        valid: "yes",
        errorCount: 0,
        warningCount: 0,
        issues: [],
        summary: {}
      }
    };

    const validation = validateCharacterExportPackage(pkg);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("stateIntegrity.valid must be a boolean");
  });

  it("rejects malformed package digests when present", () => {
    const pkg = {
      ...validPackage(),
      packageDigest: {
        algorithm: "sha1",
        canonicalization: "characteros-json-v1",
        excludedTopLevelFields: ["packageDigest"],
        value: "not-a-digest"
      }
    };

    const validation = validateCharacterExportPackage(pkg);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("packageDigest.algorithm must be sha256");
    expect(validation.errors).toContain("packageDigest.value must be a sha256 hex string");
  });
});

function validPackage(): CharacterPhysicsExportResponse {
  const state = createDefaultState("lin_fan");
  const pkg: CharacterPhysicsExportResponse = {
    exportedAt: "2026-06-21T00:00:00.000Z",
    characterId: "lin_fan",
    version: "1.1",
    state: serializeCharacterPhysicsState(state),
    stateIntegrity: inspectCharacterStateIntegrity(state),
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
        reasons: ["no manual adjustment history yet"]
      },
      governance: {
        recommendation: "allow",
        cooldownDays: 0,
        cooldownActive: false,
        reasons: ["no manual adjustment history yet"]
      }
    }
  };
  return {
    ...pkg,
    packageDigest: computeCharacterExportPackageDigest(pkg)
  };
}
