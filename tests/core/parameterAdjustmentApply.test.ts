import { describe, expect, it } from "vitest";
import {
  applyParameterAdjustmentPatch,
  rollbackParameterAdjustmentPatch
} from "../../src/core/parameters/parameterAdjustmentApply";
import { buildParameterAdjustmentSnapshotTrace } from "../../src/core/parameters/parameterAdjustmentSnapshot";
import type { ParameterAdjustmentPatchTrace } from "../../src/core/parameters/parameterAdjustmentPatch";
import { createCharacterPhysicsState } from "../../src/core/physics/physicsEngine";

describe("parameter adjustment apply", () => {
  it("applies ready patches to a cloned state only", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });

    const result = applyParameterAdjustmentPatch({ state, patch, snapshot });

    expect(result.trace.status).toBe("applied");
    expect(result.state.metaState.selfControl).toBeCloseTo(before - 0.02);
    expect(state.metaState.selfControl).toBe(before);
  });

  it("blocks apply when snapshot does not match patch", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const mismatchedPatch = patchTrace(before - 0.1, before - 0.12);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });

    const result = applyParameterAdjustmentPatch({
      state,
      patch: mismatchedPatch,
      snapshot
    });

    expect(result.trace.status).toBe("blocked");
    expect(result.state).toBe(state);
  });

  it("blocks apply when current state has moved away from the snapshot", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });
    state.metaState.selfControl = before - 0.01;

    const result = applyParameterAdjustmentPatch({ state, patch, snapshot });

    expect(result.trace.status).toBe("blocked");
    expect(result.trace.reasons[0]).toBe("current state does not match snapshot");
  });

  it("rolls applied values back to snapshot values on a cloned state", () => {
    const state = createCharacterPhysicsState();
    const before = state.metaState.selfControl;
    const patch = patchTrace(before, before - 0.02);
    const snapshot = buildParameterAdjustmentSnapshotTrace({ state, patch });
    const applied = applyParameterAdjustmentPatch({ state, patch, snapshot });

    const rolledBack = rollbackParameterAdjustmentPatch({
      state: applied.state,
      snapshot
    });

    expect(rolledBack.trace.status).toBe("applied");
    expect(rolledBack.state.metaState.selfControl).toBe(before);
    expect(applied.state.metaState.selfControl).toBeCloseTo(before - 0.02);
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
