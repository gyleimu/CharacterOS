import { describe, expect, it } from "vitest";
import { POST as applyPOST } from "../../src/app/api/characters/[characterId]/physics/adjustment/apply/route";
import { POST as rollbackPOST } from "../../src/app/api/characters/[characterId]/physics/adjustment/rollback/route";
import type {
  ApplyParameterAdjustmentResponse,
  GetCharacterPhysicsStateResponse,
  RollbackParameterAdjustmentResponse
} from "../../src/appContracts/characterPhysics";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { characterPhysicsService } from "../../src/server/characterPhysicsServiceSingleton";

describe("Parameter adjustment apply API", () => {
  it("applies and rolls back explicit parameter patches", async () => {
    const characterId = uniqueCharacterId("adjustment-route");
    characterPhysicsService.resetCharacter(characterId);
    const state = characterPhysicsService.getState(characterId);
    const before = state.metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });

    const applyResponse = await applyPOST(jsonRequest({ patch, snapshot }), {
      params: { characterId }
    });
    const applyBody = (await applyResponse.json()) as ApplyParameterAdjustmentResponse;

    expect(applyResponse.status).toBe(200);
    expect(applyBody.trace.status).toBe("applied");
    expect(applyBody.trace.appliedOperations[0]?.path).toBe("metaState.selfControl");
    expect(applyBody.trace.appliedOperations[0]?.value).toBeCloseTo(before - 0.02);
    expect(applyBody.state.metaState?.selfControl).toBeCloseTo(before - 0.02);

    const rollbackResponse = await rollbackPOST(jsonRequest({ snapshot }), {
      params: { characterId }
    });
    const rollbackBody = (await rollbackResponse.json()) as RollbackParameterAdjustmentResponse;

    expect(rollbackResponse.status).toBe(200);
    expect(rollbackBody.trace.status).toBe("applied");
    expect(rollbackBody.state.metaState?.selfControl).toBe(before);
  });

  it("rejects malformed apply requests", async () => {
    const response = await applyPOST(jsonRequest({}), {
      params: { characterId: "bad-adjustment-route" }
    });

    expect(response.status).toBe(400);
  });

  it("rejects invalid JSON apply requests", async () => {
    const response = await applyPOST(invalidJsonRequest(), {
      params: { characterId: "bad-json-adjustment-route" }
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });

  it("accepts explicit governance override during active cooldown", async () => {
    const characterId = uniqueCharacterId("adjustment-override-route");
    characterPhysicsService.resetCharacter(characterId);
    for (let index = 0; index < 3; index += 1) {
      const state = characterPhysicsService.getState(characterId);
      const patch = patchTrace(state.metaState.selfControl, state.metaState.selfControl - 0.01);
      const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });
      const response = await applyPOST(jsonRequest({ patch, snapshot }), {
        params: { characterId }
      });
      const body = (await response.json()) as ApplyParameterAdjustmentResponse;
      expect(body.trace.status).toBe("applied");
    }

    const state = characterPhysicsService.getState(characterId);
    const patch = patchTrace(state.metaState.selfControl, state.metaState.selfControl - 0.01);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });

    const blockedResponse = await applyPOST(jsonRequest({ patch, snapshot }), {
      params: { characterId }
    });
    const blockedBody = (await blockedResponse.json()) as ApplyParameterAdjustmentResponse;

    const overrideResponse = await applyPOST(
      jsonRequest({
        patch,
        snapshot,
        governanceOverride: {
          enabled: true,
          reason: "manual correction after dashboard review"
        }
      }),
      {
        params: { characterId }
      }
    );
    const overrideBody = (await overrideResponse.json()) as ApplyParameterAdjustmentResponse;

    expect(blockedBody.trace.status).toBe("blocked");
    expect(overrideBody.trace.status).toBe("applied");
    expect(overrideBody.trace.governanceOverride).toEqual({
      used: true,
      reason: "manual correction after dashboard review"
    });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/characters/test/physics/adjustment/apply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/characters/test/physics/adjustment/apply", {
    method: "POST",
    body: "{",
    headers: { "Content-Type": "application/json" }
  });
}

function uniqueCharacterId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
