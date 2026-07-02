import { describe, expect, it } from "vitest";
import {
  createParameterAdjustmentHistoryEntry,
  summarizeParameterAdjustmentHistory
} from "../../src/core/parameters/parameterAdjustmentHistory";

describe("parameter adjustment history", () => {
  it("creates deterministic history entries with injected time", () => {
    const entry = createParameterAdjustmentHistoryEntry({
      characterId: "lin_fan",
      action: "apply",
      createdAt: "2026-06-20T00:00:00.000Z",
      trace: {
        status: "applied",
        snapshotId: "snapshot_1",
        appliedOperations: [
          {
            op: "replace",
            path: "metaState.selfControl",
            from: 0.5,
            value: 0.48,
            reason: "test"
          }
        ],
        reasons: ["test"]
      }
    });

    expect(entry.characterId).toBe("lin_fan");
    expect(entry.operationCount).toBe(1);
    expect(entry.targetPaths).toEqual(["metaState.selfControl"]);
    expect(entry.id).toContain("adjustment_history_");
  });

  it("preserves structured governance override metadata", () => {
    const entry = createParameterAdjustmentHistoryEntry({
      characterId: "lin_fan",
      action: "apply",
      createdAt: "2026-06-20T00:00:00.000Z",
      trace: {
        status: "applied",
        snapshotId: "snapshot_1",
        appliedOperations: [
          {
            op: "replace",
            path: "metaState.selfControl",
            from: 0.5,
            value: 0.48,
            reason: "test"
          }
        ],
        reasons: ["test"],
        governanceOverride: {
          used: true,
          reason: "manual correction after verified bad calibration"
        }
      }
    });

    const summary = summarizeParameterAdjustmentHistory([entry]);

    expect(entry.governanceOverride).toEqual({
      used: true,
      reason: "manual correction after verified bad calibration"
    });
    expect(summary.overrideCount).toBe(1);
  });

  it("summarizes manual adjustment history risk and targets", () => {
    const history = Array.from({ length: 4 }, (_, index) => createParameterAdjustmentHistoryEntry({
      characterId: "lin_fan",
      action: index === 3 ? "rollback" : "apply",
      createdAt: `2026-06-20T00:00:0${index}.000Z`,
      trace: {
        status: "applied",
        snapshotId: `snapshot_${index}`,
        appliedOperations: [
          {
            op: "replace",
            path: "metaState.selfControl",
            from: 0.5,
            value: 0.48,
            reason: "test"
          }
        ],
        reasons: ["test"]
      }
    }));

    const summary = summarizeParameterAdjustmentHistory(history);

    expect(summary.totalEntries).toBe(4);
    expect(summary.appliedCount).toBe(4);
    expect(summary.rollbackCount).toBe(1);
    expect(summary.overrideCount).toBe(0);
    expect(summary.frequentTargetPaths).toEqual(["metaState.selfControl"]);
    expect(summary.stabilityRisk).toBe("medium");
  });
});
