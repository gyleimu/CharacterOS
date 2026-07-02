import { describe, expect, it } from "vitest";
import { buildBoundaryRecoverySubProcessTrace } from "../../../src/core/temporal/subprocesses/boundaryRecoverySubProcess";
import {
  createPsychologicalBoundary,
  recoverBoundary,
  type PsychologicalBoundary
} from "../../../src/core/boundary/psychologicalBoundary";

describe("buildBoundaryRecoverySubProcessTrace", () => {
  it("produces a BoundaryRecoverySubProcessTrace with correct kind and id", () => {
    const before = createPsychologicalBoundary({ stressLoad: 0.8, integrity: 0.5, cracks: 0.3 });
    const after = recoverBoundary(before, 30);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace.kind).toBe("boundary_recovery");
    expect(trace.id).toBe("decay_and_recovery.boundary_recovery");
    expect(trace.label).toBe("Boundary Recovery");
    expect(trace.reads).toEqual(["boundary"]);
    expect(trace.writes).toEqual(["boundary"]);
    expect(trace.changedStates).toEqual(["boundary"]);
  });

  it("has stressLoadBefore >= stressLoadAfter when recovery occurs", () => {
    const before = createPsychologicalBoundary({
      stressLoad: 0.85,
      recoveryRate: 0.035
    });
    const after = recoverBoundary(before, 30);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace.metrics.stressLoadBefore).toBeGreaterThanOrEqual(
      trace.metrics.stressLoadAfter
    );
  });

  it("has integrityAfter >= integrityBefore when recovery occurs", () => {
    const before = createPsychologicalBoundary({
      integrity: 0.45,
      recoveryRate: 0.035
    });
    const after = recoverBoundary(before, 30);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace.metrics.integrityAfter).toBeGreaterThanOrEqual(
      trace.metrics.integrityBefore
    );
  });

  it("has cracksAfter <= cracksBefore when recovery occurs", () => {
    const before = createPsychologicalBoundary({
      cracks: 0.55,
      recoveryRate: 0.035
    });
    const after = recoverBoundary(before, 30);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace.metrics.cracksAfter).toBeLessThanOrEqual(
      trace.metrics.cracksBefore
    );
  });

  it("does not mutate input boundary objects", () => {
    const before = createPsychologicalBoundary({
      stressLoad: 0.8,
      integrity: 0.5,
      cracks: 0.3
    });
    const after = recoverBoundary(before, 30);

    const beforeStress = before.stressLoad;
    const beforeIntegrity = before.integrity;
    const afterStress = after.stressLoad;

    buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(before.stressLoad).toBe(beforeStress);
    expect(before.integrity).toBe(beforeIntegrity);
    expect(after.stressLoad).toBe(afterStress);
  });

  it("handles zero-day recovery (no change) correctly", () => {
    const boundary = createPsychologicalBoundary({
      stressLoad: 0.7,
      integrity: 0.6,
      cracks: 0.2,
      recoveryRate: 0.035
    });
    const after = recoverBoundary(boundary, 0);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: boundary,
      boundaryAfter: after
    });

    expect(trace.metrics.stressLoadBefore).toBe(trace.metrics.stressLoadAfter);
    expect(trace.metrics.integrityBefore).toBe(trace.metrics.integrityAfter);
    expect(trace.metrics.cracksBefore).toBe(trace.metrics.cracksAfter);
  });

  it("includes D10 homeostasis overwrite note in reasons", () => {
    const before = createPsychologicalBoundary();
    const after = recoverBoundary(before, 7);

    const trace = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace.reasons.length).toBe(2);
    expect(trace.reasons[0]).toContain("recovers toward baseline");
    expect(trace.reasons[1]).toContain("D10");
    expect(trace.reasons[1]).toContain("homeostasis");
    expect(trace.reasons[1]).toContain("regulatedBoundary");
  });

  it("produces stable reads/writes/reasons across calls", () => {
    const before = createPsychologicalBoundary({ stressLoad: 0.8 });
    const after = recoverBoundary(before, 7);

    const trace1 = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });
    const trace2 = buildBoundaryRecoverySubProcessTrace({
      boundaryBefore: before,
      boundaryAfter: after
    });

    expect(trace1.reads).toEqual(trace2.reads);
    expect(trace1.writes).toEqual(trace2.writes);
    expect(trace1.reasons).toEqual(trace2.reasons);
    expect(trace1.metrics).toEqual(trace2.metrics);
  });
});
