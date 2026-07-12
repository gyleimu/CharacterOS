import { describe, expect, it } from "vitest";
import type { ExperienceEvent } from "../../../src/core/event/event";
import { parseExperienceEvent } from "../../../src/core/event/eventParser";
import { linFanInitialCoordinate } from "../../../src/core/personality/coordinate";
import {
  CharacterPhysicsEngine,
  createCharacterPhysicsState,
  type CharacterPhysicsState,
} from "../../../src/core/physics/physicsEngine";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
} from "../../../src/core/physics/serialization";
import { runContinuousTick } from "../../../src/core/time/continuousTick";
import { runEventSequence } from "../../../src/core/simulation/runner";

function attachmentEvent(id: string, occurredAt?: string): ExperienceEvent {
  return {
    id,
    description: "A trusted person suddenly stopped replying.",
    tags: ["relationship", "abandonment", "waiting"],
    category: "abandonment",
    intensity: 0.82,
    importance: 0.86,
    relationshipWeight: 0.95,
    expectationGap: 0.84,
    personalitySensitivity: 0.9,
    ...(occurredAt ? { occurredAt } : {}),
  };
}

function neutralEvent(id: string, occurredAt: string): ExperienceEvent {
  return {
    id,
    description: "The character noticed an ordinary grey wall.",
    tags: ["neutral", "observation"],
    category: "general",
    intensity: 0.05,
    importance: 0.05,
    relationshipWeight: 0,
    expectationGap: 0.02,
    personalitySensitivity: 0.1,
    occurredAt,
  };
}

function state(): CharacterPhysicsState {
  return createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
}

function coordinateDistance(before: CharacterPhysicsState, after: CharacterPhysicsState): number {
  const keys = Object.keys(before.coordinate.values) as Array<keyof typeof before.coordinate.values>;
  return Math.sqrt(keys.reduce((sum, key) => sum + (after.coordinate.values[key] - before.coordinate.values[key]) ** 2, 0));
}

describe("personality temporal semantics integration", () => {
  it("anchors the first event time and writes it to memory", () => {
    const current = state();
    const step = new CharacterPhysicsEngine().processEvent(
      current,
      attachmentEvent("anchor", "2026-01-01T08:00:00+08:00"),
    );
    expect(step.temporalSemantics.mode).toBe("first_timed_event");
    expect(step.event.occurredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(step.memoryNode.timeStamp).toBe("2026-01-01T00:00:00.000Z");
    expect(current.temporal.lastProcessedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps an untimed legacy event at full impact", () => {
    const current = state();
    const step = new CharacterPhysicsEngine().processEvent(current, attachmentEvent("legacy"));
    expect(step.temporalSemantics.mode).toBe("legacy_untimed");
    expect(step.temporalSemantics.densityScale).toBe(1);
    expect(step.temporalSemantics.rawImpactValue).toBe(step.impactScore.value);
  });

  it("reduces effective impact for concentrated semantic repeats", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    const steps = [0, 1, 2, 3, 4].map((hour) => engine.processEvent(
      current,
      attachmentEvent(`concentrated-${hour}`, `2026-01-01T0${hour}:00:00.000Z`),
    ));
    expect(steps.map((step) => step.temporalSemantics.densityScale)).toEqual(
      [...steps.map((step) => step.temporalSemantics.densityScale)].sort((a, b) => b - a),
    );
    expect(steps[4]!.impactScore.value).toBeLessThan(steps[0]!.impactScore.value);
    expect(current.memories).toHaveLength(5);
    expect(current.clusters.get("abandonment")?.age).toBe(5);
  });

  it("lets equally strong events recover their full dose when spaced apart", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    const steps = [1, 8, 15, 22, 29].map((day) => engine.processEvent(
      current,
      attachmentEvent(`spaced-${day}`, `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`),
    ));
    expect(steps.every((step) => step.temporalSemantics.densityScale === 1)).toBe(true);
    expect(steps.slice(1).every((step) => step.temporalSemantics.recovery.applied)).toBe(true);
    expect(current.temporal.totalElapsedDays).toBe(28);
  });

  it("distinguishes five events in hours from five events across weeks", () => {
    const concentrated = state();
    const spaced = state();
    const engine = new CharacterPhysicsEngine();
    const concentratedDose = [0, 1, 2, 3, 4].reduce((sum, hour) => (
      sum + engine.processEvent(
        concentrated,
        attachmentEvent(`dense-${hour}`, `2026-02-01T0${hour}:00:00.000Z`),
      ).impactScore.value
    ), 0);
    const spacedDose = [1, 8, 15, 22, 28].reduce((sum, day) => (
      sum + engine.processEvent(
        spaced,
        attachmentEvent(`wide-${day}`, `2026-02-${String(day).padStart(2, "0")}T00:00:00.000Z`),
      ).impactScore.value
    ), 0);
    expect(concentratedDose).toBeLessThan(spacedDose);
    expect(concentrated.temporal.totalElapsedDays).toBeLessThan(1);
    expect(spaced.temporal.totalElapsedDays).toBe(27);
  });

  it("applies boundary and memory recovery before a later event", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    engine.processEvent(current, attachmentEvent("first", "2026-03-01T00:00:00.000Z"));
    const step = engine.processEvent(current, attachmentEvent("later", "2026-03-15T00:00:00.000Z"));
    expect(step.temporalSemantics.recovery.daysApplied).toBe(14);
    expect(step.temporalSemantics.recovery.boundaryStressAfter)
      .toBeLessThan(step.temporalSemantics.recovery.boundaryStressBefore);
    expect(step.temporalSemantics.recovery.averageMemoryRecencyAfter)
      .toBeLessThan(step.temporalSemantics.recovery.averageMemoryRecencyBefore);
    expect(step.temporalSemantics.recovery.clusterMassAfter)
      .toBeLessThan(step.temporalSemantics.recovery.clusterMassBefore);
  });

  it("decays personality momentum between events", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    engine.processEvent(current, attachmentEvent("momentum-first", "2026-04-01T00:00:00.000Z"));
    const step = engine.processEvent(current, neutralEvent("momentum-second", "2026-04-15T00:00:00.000Z"));
    expect(step.temporalSemantics.recovery.velocityRetention).toBeCloseTo(0.5, 8);
    expect(step.temporalSemantics.recovery.velocityMagnitudeAfter)
      .toBeCloseTo(step.temporalSemantics.recovery.velocityMagnitudeBefore * 0.5, 3);
  });

  it("does not rewind the logical clock for out-of-order input", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    engine.processEvent(current, attachmentEvent("newer", "2026-05-10T00:00:00.000Z"));
    const step = engine.processEvent(current, attachmentEvent("older", "2026-05-01T00:00:00.000Z"));
    expect(step.temporalSemantics.mode).toBe("out_of_order");
    expect(step.temporalSemantics.warnings).toContain("out_of_order_event");
    expect(step.temporalSemantics.recovery.applied).toBe(false);
    expect(current.temporal.lastProcessedAt).toBe("2026-05-10T00:00:00.000Z");
  });

  it("inherits the clock after timed processing so untimed repeats cannot bypass saturation", () => {
    const current = state();
    const engine = new CharacterPhysicsEngine();
    engine.processEvent(current, attachmentEvent("timed", "2026-06-01T00:00:00.000Z"));
    const step = engine.processEvent(current, attachmentEvent("untimed"));
    expect(step.temporalSemantics.mode).toBe("inherited_clock");
    expect(step.temporalSemantics.densityScale).toBeLessThan(1);
    expect(step.event.occurredAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("keeps dense neutral noise from creating a large personality shift", () => {
    const current = state();
    const baseline = deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(current)));
    const engine = new CharacterPhysicsEngine();
    for (let hour = 0; hour < 12; hour += 1) {
      engine.processEvent(current, neutralEvent(`neutral-${hour}`, `2026-07-01T${String(hour).padStart(2, "0")}:00:00.000Z`));
    }
    expect(coordinateDistance(baseline, current)).toBeLessThan(0.02);
  });

  it("replays a timed sequence deterministically", () => {
    const run = () => {
      const current = state();
      const engine = new CharacterPhysicsEngine();
      engine.processEvent(current, attachmentEvent("det-1", "2026-08-01T00:00:00.000Z"));
      engine.processEvent(current, attachmentEvent("det-2", "2026-08-08T00:00:00.000Z"));
      return serializeCharacterPhysicsState(current);
    };
    expect(run()).toEqual(run());
  });

  it("roundtrips temporal state through serialization", () => {
    const current = state();
    new CharacterPhysicsEngine().processEvent(
      current,
      attachmentEvent("serialized", "2026-09-01T00:00:00.000Z"),
    );
    const restored = deserializeCharacterPhysicsState(
      JSON.parse(JSON.stringify(serializeCharacterPhysicsState(current))),
    );
    expect(restored.temporal).toEqual(current.temporal);
  });

  it("advances an initialized clock during an explicit continuous tick", () => {
    const current = state();
    new CharacterPhysicsEngine().processEvent(
      current,
      attachmentEvent("tick-anchor", "2026-10-01T00:00:00.000Z"),
    );
    const trace = runContinuousTick(current, { daysElapsed: 3 });
    expect(trace.temporalClockBefore).toBe("2026-10-01T00:00:00.000Z");
    expect(trace.temporalClockAfter).toBe("2026-10-04T00:00:00.000Z");
    expect(current.temporal.totalElapsedDays).toBe(3);
  });

  it("preserves occurredAt through rule parsing", () => {
    const parsed = parseExperienceEvent({
      description: "A friend offered support.",
      tags: ["support"],
      occurredAt: "2026-11-01T00:00:00.000Z",
    });
    expect(parsed.occurredAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("does not double-apply legacy daysPerStep when events have timestamps", () => {
    const events = [
      attachmentEvent("runner-1", "2026-12-01T00:00:00.000Z"),
      attachmentEvent("runner-2", "2026-12-08T00:00:00.000Z"),
    ];
    const direct = state();
    const engine = new CharacterPhysicsEngine();
    events.forEach((inputEvent) => engine.processEvent(direct, inputEvent));
    const simulated = state();
    runEventSequence({ state: simulated, events, daysPerStep: 100 });
    expect(serializeCharacterPhysicsState(simulated)).toEqual(serializeCharacterPhysicsState(direct));
  });
});
