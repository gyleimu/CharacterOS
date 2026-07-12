import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../../src/core/event/event";
import {
  MAX_EVENT_RECOVERY_DAYS,
  UNKNOWN_EVENT_OCCURRED_AT,
  advanceTemporalStateByDays,
  buildEventTemporalSignature,
  commitEventTemporalState,
  createCharacterTemporalState,
  personalityVelocityRetention,
  planEventTemporalSemantics,
} from "../../../src/core/time/eventTemporalSemantics";

function event(overrides: Partial<ExperienceEvent> = {}): ExperienceEvent {
  return {
    id: "event-a",
    description: "A trusted person stopped replying.",
    tags: ["relationship", "abandonment"],
    category: "abandonment",
    intensity: 0.8,
    importance: 0.85,
    relationshipWeight: 0.9,
    expectationGap: 0.8,
    personalitySensitivity: 0.75,
    ...overrides,
  };
}

function plan(
  temporal = createCharacterTemporalState(),
  inputEvent = event(),
) {
  return planEventTemporalSemantics({
    temporal,
    event: inputEvent,
    category: inputEvent.category ?? "general",
    rawImpactValue: 0.8,
  });
}

describe("event temporal semantics", () => {
  it("starts with an empty logical clock", () => {
    expect(createCharacterTemporalState()).toEqual({
      lastProcessedAt: null,
      totalElapsedDays: 0,
      processedEventCount: 0,
      timedEventCount: 0,
      recentEvents: [],
    });
  });

  it("normalizes counters to retained event sequences", () => {
    const temporal = createCharacterTemporalState({
      processedEventCount: 1,
      timedEventCount: 5,
      recentEvents: [{
        sequence: 7,
        eventId: "event-7",
        signature: "general|event-7",
        category: "general",
        occurredAt: "2026-01-01T00:00:00.000Z",
        rawImpact: 0.2,
        effectiveImpact: 0.2,
        densityScale: 1,
      }],
    });
    expect(temporal.processedEventCount).toBe(7);
    expect(temporal.timedEventCount).toBe(5);
  });

  it("preserves legacy untimed behavior", () => {
    const result = plan();
    expect(result.mode).toBe("legacy_untimed");
    expect(result.resolvedOccurredAt).toBeNull();
    expect(result.elapsedDaysApplied).toBe(0);
    expect(result.densityScale).toBe(1);
    expect(result.effectiveImpactValue).toBe(result.rawImpactValue);
  });

  it("treats the deterministic epoch sentinel as unknown time", () => {
    expect(plan(createCharacterTemporalState(), event({ occurredAt: UNKNOWN_EVENT_OCCURRED_AT })).mode)
      .toBe("legacy_untimed");
  });

  it("anchors the first valid timestamp without applying recovery", () => {
    const result = plan(createCharacterTemporalState(), event({ occurredAt: "2026-01-01T08:00:00+08:00" }));
    expect(result.mode).toBe("first_timed_event");
    expect(result.resolvedOccurredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.elapsedDaysApplied).toBe(0);
  });

  it("reports invalid timestamps without inventing elapsed time", () => {
    const result = plan(createCharacterTemporalState(), event({ occurredAt: "not-a-date" }));
    expect(result.mode).toBe("invalid_timestamp");
    expect(result.resolvedOccurredAt).toBeNull();
    expect(result.warnings).toContain("invalid_occurred_at");
  });

  it("computes forward elapsed days", () => {
    const temporal = createCharacterTemporalState({ lastProcessedAt: "2026-01-01T00:00:00.000Z" });
    const result = plan(temporal, event({ occurredAt: "2026-01-03T12:00:00.000Z" }));
    expect(result.mode).toBe("forward_time");
    expect(result.elapsedDaysRaw).toBe(2.5);
    expect(result.elapsedDaysApplied).toBe(2.5);
    expect(result.recoverySinceLastEventDays).toBe(2.5);
  });

  it("recognizes same-time events", () => {
    const temporal = createCharacterTemporalState({ lastProcessedAt: "2026-01-01T00:00:00.000Z" });
    expect(plan(temporal, event({ occurredAt: "2026-01-01T00:00:00.000Z" })).mode).toBe("same_time");
  });

  it("protects the clock from out-of-order events", () => {
    const temporal = createCharacterTemporalState({ lastProcessedAt: "2026-01-10T00:00:00.000Z" });
    const inputEvent = event({ occurredAt: "2026-01-02T00:00:00.000Z" });
    const result = plan(temporal, inputEvent);
    const committed = commitEventTemporalState({ temporal, event: inputEvent, category: "abandonment", plan: result });
    expect(result.mode).toBe("out_of_order");
    expect(result.elapsedDaysApplied).toBe(0);
    expect(result.warnings).toContain("out_of_order_event");
    expect(committed.lastProcessedAt).toBe("2026-01-10T00:00:00.000Z");
  });

  it("clamps implausibly large recovery intervals", () => {
    const temporal = createCharacterTemporalState({ lastProcessedAt: "2000-01-01T00:00:00.000Z" });
    const result = plan(temporal, event({ occurredAt: "2026-01-01T00:00:00.000Z" }));
    expect(result.elapsedDaysApplied).toBe(MAX_EVENT_RECOVERY_DAYS);
    expect(result.warnings).toContain("recovery_interval_clamped");
  });

  it("inherits an initialized clock for an untimed event", () => {
    const temporal = createCharacterTemporalState({ lastProcessedAt: "2026-01-01T00:00:00.000Z" });
    const result = plan(temporal, event());
    expect(result.mode).toBe("inherited_clock");
    expect(result.resolvedOccurredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.warnings).toContain("timestamp_inherited_from_state");
  });

  it("uses semantic content rather than event id for repeat signatures", () => {
    const first = buildEventTemporalSignature(event({ id: "first" }), "abandonment");
    const second = buildEventTemporalSignature(event({
      id: "second",
      description: "A TRUSTED  person stopped replying.",
      tags: ["abandonment", "relationship"],
    }), "abandonment");
    expect(first).toBe(second);
  });

  it("distinguishes materially different event descriptions", () => {
    expect(buildEventTemporalSignature(event(), "abandonment"))
      .not.toBe(buildEventTemporalSignature(event({ description: "I missed a bus." }), "abandonment"));
  });

  it("saturates repeated events inside the density window", () => {
    const firstEvent = event({ id: "first", occurredAt: "2026-01-01T00:00:00.000Z" });
    const firstPlan = plan(createCharacterTemporalState(), firstEvent);
    const temporal = commitEventTemporalState({
      temporal: createCharacterTemporalState(),
      event: firstEvent,
      category: "abandonment",
      plan: firstPlan,
    });
    const secondPlan = plan(temporal, event({ id: "second", occurredAt: "2026-01-01T01:00:00.000Z" }));
    expect(secondPlan.sameEventCountInWindow).toBe(1);
    expect(secondPlan.densityScale).toBeLessThan(1);
    expect(secondPlan.effectiveImpactValue).toBeLessThan(secondPlan.rawImpactValue);
    expect(secondPlan.instantImpactValue).toBe(secondPlan.rawImpactValue);
    expect(secondPlan.accumulatedImpactInWindowBefore).toBe(firstPlan.effectiveImpactValue);
    expect(secondPlan.accumulatedImpactInWindowAfter)
      .toBeCloseTo(firstPlan.effectiveImpactValue + secondPlan.effectiveImpactValue, 4);
  });

  it("applies weaker cross-event pressure for a different event in the same category", () => {
    const firstEvent = event({ occurredAt: "2026-01-01T00:00:00.000Z" });
    const firstPlan = plan(createCharacterTemporalState(), firstEvent);
    const temporal = commitEventTemporalState({
      temporal: createCharacterTemporalState(),
      event: firstEvent,
      category: "abandonment",
      plan: firstPlan,
    });
    const same = plan(temporal, event({ id: "same", occurredAt: "2026-01-01T01:00:00.000Z" }));
    const different = plan(temporal, event({
      id: "different",
      description: "A different relationship loss happened.",
      occurredAt: "2026-01-01T01:00:00.000Z",
    }));
    expect(different.densityScale).toBeLessThan(1);
    expect(different.densityScale).toBeGreaterThan(same.densityScale);
  });

  it("does not saturate events outside the 24 hour window", () => {
    const firstEvent = event({ occurredAt: "2026-01-01T00:00:00.000Z" });
    const firstPlan = plan(createCharacterTemporalState(), firstEvent);
    const temporal = commitEventTemporalState({
      temporal: createCharacterTemporalState(),
      event: firstEvent,
      category: "abandonment",
      plan: firstPlan,
    });
    expect(plan(temporal, event({ occurredAt: "2026-01-02T00:00:01.000Z" })).densityScale).toBe(1);
  });

  it("keeps a non-zero floor under dense repetition", () => {
    let temporal = createCharacterTemporalState();
    let latestScale = 1;
    for (let index = 0; index < 30; index += 1) {
      const inputEvent = event({ id: `event-${index}`, occurredAt: `2026-01-01T${String(index % 24).padStart(2, "0")}:00:00.000Z` });
      const currentPlan = plan(temporal, inputEvent);
      latestScale = currentPlan.densityScale;
      temporal = commitEventTemporalState({ temporal, event: inputEvent, category: "abandonment", plan: currentPlan });
    }
    expect(latestScale).toBeGreaterThanOrEqual(0.35);
  });

  it("advances an initialized logical clock and elapsed-day counter", () => {
    const temporal = advanceTemporalStateByDays(
      createCharacterTemporalState({ lastProcessedAt: "2026-01-01T00:00:00.000Z" }),
      2.5,
    );
    expect(temporal.lastProcessedAt).toBe("2026-01-03T12:00:00.000Z");
    expect(temporal.totalElapsedDays).toBe(2.5);
  });

  it("leaves an uninitialized clock unknown during a manual tick", () => {
    const temporal = advanceTemporalStateByDays(createCharacterTemporalState(), 7);
    expect(temporal.lastProcessedAt).toBeNull();
    expect(temporal.totalElapsedDays).toBe(7);
  });

  it("decays personality velocity by a 14 day half-life", () => {
    expect(personalityVelocityRetention(0)).toBe(1);
    expect(personalityVelocityRetention(14)).toBeCloseTo(0.5, 8);
    expect(personalityVelocityRetention(28)).toBeCloseTo(0.25, 8);
  });
});
