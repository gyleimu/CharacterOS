import { describe, expect, it } from "vitest";
import {
  explainStateTransition,
  type StateTransitionSummary
} from "../../../src/core/explainability/stateTransitionExplanation";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSummary(overrides?: Partial<StateTransitionSummary>): StateTransitionSummary {
  return {
    changedPaths: ["coordinate.values.trust", "boundary.stressLoad"],
    beforeSummary: { "coordinate.values.trust": 0.5, "boundary.stressLoad": 0.3 },
    afterSummary: { "coordinate.values.trust": 0.4, "boundary.stressLoad": 0.7 },
    affectedDomains: ["personality", "boundary"],
    ...overrides
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("explainStateTransition", () => {
  it("returns trace with scope 'state_transition'", () => {
    const trace = explainStateTransition(makeSummary());
    expect(trace.scope).toBe("state_transition");
  });

  it("includes before/after facts", () => {
    const trace = explainStateTransition(makeSummary());
    const beforeFact = trace.facts.find((f) => f.label === "Before values");
    const afterFact = trace.facts.find((f) => f.label === "After values");

    expect(beforeFact).toBeDefined();
    expect(beforeFact!.source).toBe("state");
    expect(beforeFact!.value).toEqual({ "coordinate.values.trust": 0.5, "boundary.stressLoad": 0.3 });

    expect(afterFact).toBeDefined();
    expect(afterFact!.source).toBe("state");
    expect(afterFact!.value).toEqual({ "coordinate.values.trust": 0.4, "boundary.stressLoad": 0.7 });
  });

  it("includes per-path change reasons", () => {
    const trace = explainStateTransition(makeSummary());
    const trustReason = trace.reasons.find((r) =>
      r.message.includes("coordinate.values.trust")
    );
    const boundaryReason = trace.reasons.find((r) =>
      r.message.includes("boundary.stressLoad")
    );

    expect(trustReason).toBeDefined();
    expect(trustReason!.message).toContain("0.5");
    expect(trustReason!.message).toContain("0.4");

    expect(boundaryReason).toBeDefined();
    expect(boundaryReason!.message).toContain("0.3");
    expect(boundaryReason!.message).toContain("0.7");
  });

  it("includes affected domain reason", () => {
    const trace = explainStateTransition(makeSummary());
    const domainReason = trace.reasons.find((r) =>
      r.message.includes("personality") && r.message.includes("boundary")
    );
    expect(domainReason).toBeDefined();
    expect(domainReason!.scope).toBe("state_transition");
  });

  it("handles empty changed paths", () => {
    const trace = explainStateTransition(
      makeSummary({ changedPaths: [], beforeSummary: {}, afterSummary: {}, affectedDomains: [] })
    );
    expect(trace.scope).toBe("state_transition");
    expect(trace.summary).toContain("0 path(s)");
    expect(trace.reasons.length).toBeGreaterThan(0);
    // Should still have the overview reason
    const overview = trace.reasons.find((r) =>
      r.message.includes("0 path(s)")
    );
    expect(overview).toBeDefined();
  });

  it("handles single path change", () => {
    const trace = explainStateTransition(
      makeSummary({
        changedPaths: ["learningRate"],
        beforeSummary: { learningRate: 0.1 },
        afterSummary: { learningRate: 0.2 },
        affectedDomains: ["personality"]
      })
    );
    expect(trace.summary).toContain("1 path(s)");
    const changeReason = trace.reasons.find((r) =>
      r.message.includes("learningRate")
    );
    expect(changeReason).toBeDefined();
  });

  it("infers domains when not provided", () => {
    const summary = makeSummary({ affectedDomains: [] });
    const trace = explainStateTransition(summary);
    // Should have inferred domains from the paths
    const domainReason = trace.reasons.find((r) =>
      r.message.includes("Affected character domains")
    );
    expect(domainReason).toBeDefined();
  });

  it("has deterministic structure", () => {
    const trace = explainStateTransition(makeSummary());

    expect(trace.id.startsWith("trace_")).toBe(true);
    expect(typeof trace.title).toBe("string");
    expect(typeof trace.summary).toBe("string");
    expect(typeof trace.createdAt).toBe("string");

    for (const fact of trace.facts) {
      expect(fact.id.startsWith("fact_")).toBe(true);
      expect(typeof fact.label).toBe("string");
      expect(typeof fact.source).toBe("string");
    }

    for (const reason of trace.reasons) {
      expect(reason.id.startsWith("reason_")).toBe(true);
      expect(typeof reason.message).toBe("string");
      expect(typeof reason.confidence).toBe("string");
    }
  });

  it("is synchronous (no async)", () => {
    const result = explainStateTransition(makeSummary());
    expect(typeof result.scope).toBe("string");
    expect(result).not.toBeInstanceOf(Promise);
  });
});
