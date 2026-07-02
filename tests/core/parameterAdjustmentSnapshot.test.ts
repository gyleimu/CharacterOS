import { describe, expect, it } from "vitest";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";

describe("parameter adjustment snapshot", () => {
  it("captures rollback values for ready patches without mutating state", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const snapshot = buildParameterAdjustmentSnapshotTrace({
      state,
      patch: patchTrace("ready")
    });

    expect(snapshot.status).toBe("captured");
    expect(snapshot.values[0]?.path).toBe("metaState.selfControl");
    expect(snapshot.values[0]?.value).toBe(before);
    expect(snapshot.rollbackOperations[0]?.value).toBe(before);
    expect(state.metaState.selfControl).toBe(before);
  });

  it("blocks snapshots when patch is not ready", () => {
    const snapshot = buildParameterAdjustmentSnapshotTrace({
      state: createCharacterPhysicsState(),
      patch: patchTrace("held_for_review")
    });

    expect(snapshot.status).toBe("blocked");
    expect(snapshot.values).toHaveLength(0);
  });
});

function patchTrace(status: "ready" | "held_for_review"): ParameterAdjustmentPatchTrace {
  return {
    status,
    operations: status === "ready"
      ? [
        {
          op: "replace",
          path: "metaState.selfControl",
          from: 0.58,
          value: 0.56,
          reason: "test"
        }
      ]
      : [],
    reasons: []
  };
}
