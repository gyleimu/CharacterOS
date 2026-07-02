import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/characters/[characterId]/export/route";
import { POST as applyPOST } from "../../src/app/api/characters/[characterId]/physics/adjustment/apply/route";
import type { CharacterPhysicsExportResponse } from "../../src/appContracts/characterPhysics";
import { compareCharacterExportPackageDigest } from "../../src/core/export/characterExportPackageDigest";
import { validateCharacterExportPackage } from "../../src/core/export/characterExportValidation";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Character export API", () => {
  it("exports character state with adjustment audit package", async () => {
    const characterId = uniqueCharacterId("export-route");
    characterPhysicsService.resetCharacter(characterId);

    const response = await GET(new Request("http://localhost/api/export"), {
      params: { characterId }
    });
    const body = (await response.json()) as CharacterPhysicsExportResponse;

    expect(response.status).toBe(200);
    expect(body.characterId).toBe(characterId);
    expect(body.version).toBe("1.1");
    expect(body.state.coordinate).toBeDefined();
    expect(body.stateIntegrity?.valid).toBe(true);
    expect(body.stateIntegrity?.summary.memoryCount).toBe(0);
    expect(body.packageDigest?.algorithm).toBe("sha256");
    expect(compareCharacterExportPackageDigest(body).status).toBe("matched");
    expect(body.adjustmentHistory.history).toHaveLength(0);
    expect(body.adjustmentHistory.summary.totalEntries).toBe(0);
    expect(body.adjustmentHistory.governance.recommendation).toBe("allow");
    expect(validateCharacterExportPackage(body).valid).toBe(true);
  });

  it("includes applied adjustment history in exports", async () => {
    const characterId = uniqueCharacterId("export-adjustment-route");
    characterPhysicsService.resetCharacter(characterId);
    const state = characterPhysicsService.getState(characterId);
    const patch = patchTrace(state.metaState.selfControl, state.metaState.selfControl - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });

    const applyResponse = await applyPOST(jsonRequest({ patch, snapshot }), {
      params: { characterId }
    });
    const applyBody = await applyResponse.json() as { trace: { status: string } };

    expect(applyBody.trace.status).toBe("applied");

    const response = await GET(new Request("http://localhost/api/export"), {
      params: { characterId }
    });
    const body = (await response.json()) as CharacterPhysicsExportResponse;

    expect(body.adjustmentHistory.history).toHaveLength(1);
    expect(body.adjustmentHistory.summary.appliedCount).toBe(1);
    expect(body.adjustmentHistory.summary.overrideCount).toBe(0);
    expect(body.adjustmentHistory.history[0]?.targetPaths).toEqual(["metaState.selfControl"]);
  });
});

function patchTrace(from: number, value: number): ParameterAdjustmentPatchTrace {
  return {
    status: "ready",
    operations: [
      {
        op: "replace",
        path: "metaState.selfControl",
        from,
        value,
        reason: "test"
      }
    ],
    reasons: []
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/characters/test/physics/adjustment/apply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
