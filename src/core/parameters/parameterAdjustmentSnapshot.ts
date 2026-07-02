import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { ParameterAdjustmentPatchTrace } from "./parameterAdjustmentPatch";
import { round4 } from "./parameterMath";

export type ParameterAdjustmentSnapshotStatus = "captured" | "not_needed" | "blocked";

export interface ParameterAdjustmentSnapshotValue {
  path: string;
  value: number;
}

export interface ParameterAdjustmentRollbackOperation {
  op: "replace";
  path: string;
  value: number;
  reason: string;
}

export interface ParameterAdjustmentSnapshotTrace {
  status: ParameterAdjustmentSnapshotStatus;
  snapshotId: string;
  values: ParameterAdjustmentSnapshotValue[];
  rollbackOperations: ParameterAdjustmentRollbackOperation[];
  fingerprint: string;
  reasons: string[];
}

export function buildParameterAdjustmentSnapshotTrace(params: {
  state: CharacterPhysicsState;
  patch: ParameterAdjustmentPatchTrace;
}): ParameterAdjustmentSnapshotTrace {
  if (params.patch.status === "empty") {
    return emptySnapshot("not_needed", "no snapshot needed because patch is empty");
  }
  if (params.patch.status !== "ready") {
    return emptySnapshot("blocked", "snapshot blocked because patch is not ready");
  }

  const values = params.patch.operations.map((operation) => ({
    path: operation.path,
    value: readNumericPath(params.state, operation.path)
  }));

  if (values.some((value) => value.value === undefined)) {
    return emptySnapshot("blocked", "snapshot blocked because at least one path cannot be read safely");
  }

  const safeValues = values as ParameterAdjustmentSnapshotValue[];
  return {
    status: "captured",
    snapshotId: buildSnapshotId(safeValues),
    values: safeValues,
    rollbackOperations: safeValues.map((value) => ({
      op: "replace",
      path: value.path,
      value: value.value,
      reason: `Rollback ${value.path} to pre-adjustment value.`
    })),
    fingerprint: buildFingerprint(safeValues),
    reasons: [
      "pre-application snapshot captured for ready patch",
      "snapshot records only patch target values, not the full character state"
    ]
  };
}

function emptySnapshot(
  status: "not_needed" | "blocked",
  reason: string
): ParameterAdjustmentSnapshotTrace {
  return {
    status,
    snapshotId: "",
    values: [],
    rollbackOperations: [],
    fingerprint: "",
    reasons: [reason]
  };
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

function buildSnapshotId(values: ParameterAdjustmentSnapshotValue[]): string {
  const source = values.map((value) => `${value.path}:${value.value}`).join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `parameter_snapshot_${hash.toString(16)}`;
}

function buildFingerprint(values: ParameterAdjustmentSnapshotValue[]): string {
  return values.map((value) => `${value.path}=${value.value.toFixed(4)}`).join(";");
}
