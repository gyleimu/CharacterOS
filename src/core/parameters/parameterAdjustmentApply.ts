import type { CharacterPhysicsState } from "../physics/physicsEngine";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState
} from "../physics/serialization";
import type { ParameterAdjustmentPatchOperation, ParameterAdjustmentPatchTrace } from "./parameterAdjustmentPatch";
import type {
  ParameterAdjustmentRollbackOperation,
  ParameterAdjustmentSnapshotTrace
} from "./parameterAdjustmentSnapshot";
import { clamp01, round4 } from "./parameterMath";

export type ParameterAdjustmentApplyStatus = "applied" | "blocked";

export interface ParameterAdjustmentGovernanceOverrideTrace {
  used: boolean;
  reason?: string;
}

export interface ParameterAdjustmentApplyTrace {
  status: ParameterAdjustmentApplyStatus;
  appliedOperations: ParameterAdjustmentPatchOperation[];
  snapshotId: string;
  reasons: string[];
  governanceOverride?: ParameterAdjustmentGovernanceOverrideTrace;
}

export interface ParameterAdjustmentApplyResult {
  state: CharacterPhysicsState;
  trace: ParameterAdjustmentApplyTrace;
}

export function applyParameterAdjustmentPatch(params: {
  state: CharacterPhysicsState;
  patch: ParameterAdjustmentPatchTrace;
  snapshot: ParameterAdjustmentSnapshotTrace;
}): ParameterAdjustmentApplyResult {
  if (params.patch.status !== "ready") {
    return blockedResult(params.state, "patch is not ready");
  }
  if (params.snapshot.status !== "captured") {
    return blockedResult(params.state, "snapshot is not captured");
  }
  if (!snapshotMatchesPatch(params.patch, params.snapshot)) {
    return blockedResult(params.state, "snapshot does not match patch operations");
  }
  if (!stateMatchesSnapshot(params.state, params.snapshot)) {
    return blockedResult(params.state, "current state does not match snapshot");
  }

  const nextState = cloneState(params.state);
  for (const operation of params.patch.operations) {
    if (!setNumericPath(nextState, operation.path, operation.value)) {
      return blockedResult(params.state, `failed to apply operation at ${operation.path}`);
    }
  }

  return {
    state: nextState,
    trace: {
      status: "applied",
      appliedOperations: params.patch.operations,
      snapshotId: params.snapshot.snapshotId,
      reasons: [
        "patch applied to cloned character state",
        "original character state was not mutated"
      ]
    }
  };
}

export function rollbackParameterAdjustmentPatch(params: {
  state: CharacterPhysicsState;
  snapshot: ParameterAdjustmentSnapshotTrace;
}): ParameterAdjustmentApplyResult {
  if (params.snapshot.status !== "captured") {
    return blockedResult(params.state, "snapshot is not captured");
  }

  const nextState = cloneState(params.state);
  for (const operation of params.snapshot.rollbackOperations) {
    if (!setNumericPath(nextState, operation.path, operation.value)) {
      return blockedResult(params.state, `failed to rollback operation at ${operation.path}`);
    }
  }

  return {
    state: nextState,
    trace: {
      status: "applied",
      appliedOperations: params.snapshot.rollbackOperations.map(toPatchOperation),
      snapshotId: params.snapshot.snapshotId,
      reasons: [
        "rollback operations applied to cloned character state",
        "input character state was not mutated"
      ]
    }
  };
}

function blockedResult(state: CharacterPhysicsState, reason: string): ParameterAdjustmentApplyResult {
  return {
    state,
    trace: {
      status: "blocked",
      appliedOperations: [],
      snapshotId: "",
      reasons: [reason]
    }
  };
}

function snapshotMatchesPatch(
  patch: ParameterAdjustmentPatchTrace,
  snapshot: ParameterAdjustmentSnapshotTrace
): boolean {
  if (patch.operations.length !== snapshot.values.length) return false;
  return patch.operations.every((operation) => {
    const snapshotValue = snapshot.values.find((value) => value.path === operation.path);
    return snapshotValue !== undefined && round4(snapshotValue.value) === round4(operation.from);
  });
}

function stateMatchesSnapshot(
  state: CharacterPhysicsState,
  snapshot: ParameterAdjustmentSnapshotTrace
): boolean {
  return snapshot.values.every((snapshotValue) => {
    const currentValue = readNumericPath(state, snapshotValue.path);
    return currentValue !== undefined && round4(currentValue) === round4(snapshotValue.value);
  });
}

function cloneState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(JSON.parse(JSON.stringify(serializeCharacterPhysicsState(state))));
}

function setNumericPath(state: CharacterPhysicsState, path: string, value: number): boolean {
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (!lastKey) return false;
  const target = keys.reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, state);

  if (!target || typeof target !== "object" || !(lastKey in target)) return false;
  const currentValue = (target as Record<string, unknown>)[lastKey];
  if (typeof currentValue !== "number") return false;
  (target as Record<string, number>)[lastKey] = round4(clamp01(value));
  return true;
}

function readNumericPath(state: CharacterPhysicsState, path: string): number | undefined {
  const value = path.split(".").reduce<unknown>((target, key) => {
    if (target && typeof target === "object" && key in target) {
      return (target as Record<string, unknown>)[key];
    }
    return undefined;
  }, state);
  return typeof value === "number" ? round4(value) : undefined;
}

function toPatchOperation(operation: ParameterAdjustmentRollbackOperation): ParameterAdjustmentPatchOperation {
  return {
    op: "replace",
    path: operation.path,
    from: operation.value,
    value: operation.value,
    reason: operation.reason
  };
}
