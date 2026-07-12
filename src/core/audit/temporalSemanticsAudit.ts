import type { ExperienceEvent } from "../event/event";
import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import { linFanInitialCoordinate } from "../personality/coordinate";
import {
  CharacterPhysicsEngine,
  createCharacterPhysicsState,
  type CharacterPhysicsState,
} from "../physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../physics/serialization";
import { DETERMINISTIC_TIMESTAMP } from "../deterministicHelpers";

export type TemporalSemanticsAuditVerdict = "PASS" | "FAIL";

export interface TemporalSemanticsAuditAssertion {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly actual: number | string | boolean;
  readonly expected: string;
}

export interface TemporalSemanticsAuditCaseResult {
  readonly id: string;
  readonly description: string;
  readonly assertions: TemporalSemanticsAuditAssertion[];
  readonly metrics: Record<string, number | string | boolean>;
  readonly passed: boolean;
  readonly failures: string[];
}

export interface TemporalSemanticsAuditResult {
  readonly version: "14.0.0";
  readonly generatedAt: string;
  readonly cases: TemporalSemanticsAuditCaseResult[];
  readonly summary: {
    readonly totalCases: number;
    readonly passedCases: number;
    readonly failedCases: number;
    readonly totalAssertions: number;
    readonly passedAssertions: number;
  };
  readonly failures: string[];
  readonly knownLimitations: string[];
  readonly gateVerdict: {
    readonly level: TemporalSemanticsAuditVerdict;
    readonly passed: boolean;
    readonly reasons: string[];
  };
  readonly requiredForRelease: true;
}

export function runTemporalSemanticsAudit(): TemporalSemanticsAuditResult {
  const cases = [
    auditRepeatSaturation(),
    auditSpacedRecovery(),
    auditConcentratedVersusSpaced(),
    auditPassiveRecovery(),
    auditNeutralStability(),
    auditOutOfOrderProtection(),
    auditDeterministicReplay(),
  ];
  const failures = cases.flatMap((item) => item.failures.map((failure) => `${item.id}: ${failure}`));
  const totalAssertions = cases.reduce((sum, item) => sum + item.assertions.length, 0);
  const passedAssertions = cases.reduce(
    (sum, item) => sum + item.assertions.filter((assertion) => assertion.passed).length,
    0,
  );
  const passed = failures.length === 0;
  return {
    version: "14.0.0",
    generatedAt: DETERMINISTIC_TIMESTAMP,
    cases,
    summary: {
      totalCases: cases.length,
      passedCases: cases.filter((item) => item.passed).length,
      failedCases: cases.filter((item) => !item.passed).length,
      totalAssertions,
      passedAssertions,
    },
    failures,
    knownLimitations: [
      "The 24-hour density window and 14-day velocity half-life are engineering priors pending empirical calibration.",
      "Out-of-order events are audited and prevented from rewinding the clock, but are not automatically replayed in causal order.",
      "Legacy untimed calls preserve pre-V14 behavior and cannot model elapsed-time recovery until a clock is established.",
    ],
    gateVerdict: {
      level: passed ? "PASS" : "FAIL",
      passed,
      reasons: passed
        ? ["All concentration, recovery, stability, ordering, and replay checks passed."]
        : failures,
    },
    requiredForRelease: true,
  };
}

function auditRepeatSaturation(): TemporalSemanticsAuditCaseResult {
  const state = createAuditState();
  const engine = new CharacterPhysicsEngine();
  const impacts = [0, 1, 2, 3, 4].map((hour) => engine.processEvent(
    state,
    attachmentEvent(`dense-${hour}`, `2026-01-01T0${hour}:00:00.000Z`),
  ));
  const firstImpact = impacts[0]!.impactScore.value;
  const lastImpact = impacts.at(-1)!.impactScore.value;
  const scales = impacts.map((step) => step.temporalSemantics.densityScale);
  return caseResult(
    "repeat_saturation",
    "Semantic repeats inside one day must have diminishing effective impact without disappearing.",
    {
      firstImpact,
      lastImpact,
      lastScale: scales.at(-1)!,
      memoryCount: state.memories.length,
    },
    [
      assertion("first_full_dose", "First event receives its raw dose.", scales[0] === 1, scales[0]!, "1"),
      assertion("diminishing_dose", "Later repeats receive less impact.", lastImpact < firstImpact, lastImpact, `< ${firstImpact}`),
      assertion("non_zero_floor", "Dense events retain bounded influence.", scales.at(-1)! >= 0.35, scales.at(-1)!, ">= 0.35"),
      assertion("memory_per_event", "Every event remains auditable as a memory.", state.memories.length === 5, state.memories.length, "5"),
    ],
  );
}

function auditSpacedRecovery(): TemporalSemanticsAuditCaseResult {
  const state = createAuditState();
  const engine = new CharacterPhysicsEngine();
  const steps = [1, 8, 15, 22, 29].map((day) => engine.processEvent(
    state,
    attachmentEvent(`spaced-${day}`, `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`),
  ));
  const allFullDose = steps.every((step) => step.temporalSemantics.densityScale === 1);
  const allIntervalsRecovered = steps.slice(1).every((step) => step.temporalSemantics.recovery.applied);
  return caseResult(
    "spaced_recovery",
    "Weekly events must apply elapsed-time recovery and fall outside the density window.",
    {
      allFullDose,
      allIntervalsRecovered,
      elapsedDays: state.temporal.totalElapsedDays,
    },
    [
      assertion("full_dose", "Weekly events are outside the density window.", allFullDose, allFullDose, "true"),
      assertion("recovery_applied", "Every later interval executes recovery.", allIntervalsRecovered, allIntervalsRecovered, "true"),
      assertion("elapsed_days", "The logical clock accumulates 28 days.", state.temporal.totalElapsedDays === 28, state.temporal.totalElapsedDays, "28"),
    ],
  );
}

function auditConcentratedVersusSpaced(): TemporalSemanticsAuditCaseResult {
  const dense = createAuditState();
  const spaced = createAuditState();
  const denseEngine = new CharacterPhysicsEngine();
  const spacedEngine = new CharacterPhysicsEngine();
  const denseDose = [0, 1, 2, 3, 4].reduce((sum, hour) => sum + denseEngine.processEvent(
    dense,
    attachmentEvent(`dense-compare-${hour}`, `2026-02-01T0${hour}:00:00.000Z`),
  ).impactScore.value, 0);
  const spacedDose = [1, 8, 15, 22, 28].reduce((sum, day) => sum + spacedEngine.processEvent(
    spaced,
    attachmentEvent(`spaced-compare-${day}`, `2026-02-${String(day).padStart(2, "0")}T00:00:00.000Z`),
  ).impactScore.value, 0);
  const finalDistance = coordinateDistance(dense, spaced);
  const boundaryDifference = round4(Math.abs(dense.boundary.stressLoad - spaced.boundary.stressLoad));
  const clusterMassDifference = round4(Math.abs(totalClusterMass(dense) - totalClusterMass(spaced)));
  return caseResult(
    "concentrated_vs_spaced",
    "Identical counts with different timing must produce distinct dose and state trajectories.",
    {
      denseDose: round4(denseDose),
      spacedDose: round4(spacedDose),
      finalDistance,
      boundaryDifference,
      clusterMassDifference,
    },
    [
      assertion("dose_differs", "Dense dose is lower after saturation.", denseDose < spacedDose, round4(denseDose), `< ${round4(spacedDose)}`),
      assertion("slow_channel_differs", "Final personality coordinates retain a non-zero timing effect.", finalDistance > 0.0001, finalDistance, "> 0.0001"),
      assertion("transient_state_differs", "Boundary or cluster state remains observably different.", boundaryDifference > 0.01 || clusterMassDifference > 0.01, Math.max(boundaryDifference, clusterMassDifference), "> 0.01"),
    ],
  );
}

function auditPassiveRecovery(): TemporalSemanticsAuditCaseResult {
  const state = createAuditState();
  const engine = new CharacterPhysicsEngine();
  engine.processEvent(state, attachmentEvent("recovery-first", "2026-03-01T00:00:00.000Z"));
  const step = engine.processEvent(state, attachmentEvent("recovery-second", "2026-03-15T00:00:00.000Z"));
  const recovery = step.temporalSemantics.recovery;
  return caseResult(
    "passive_recovery",
    "A two-week interval must reduce transient stress, recency, cluster mass, and momentum before the next event.",
    {
      daysApplied: recovery.daysApplied,
      stressBefore: recovery.boundaryStressBefore,
      stressAfter: recovery.boundaryStressAfter,
      recencyBefore: recovery.averageMemoryRecencyBefore,
      recencyAfter: recovery.averageMemoryRecencyAfter,
      massBefore: recovery.clusterMassBefore,
      massAfter: recovery.clusterMassAfter,
      velocityBefore: recovery.velocityMagnitudeBefore,
      velocityAfter: recovery.velocityMagnitudeAfter,
    },
    [
      assertion("interval", "Fourteen days are applied.", recovery.daysApplied === 14, recovery.daysApplied, "14"),
      assertion("stress_recovers", "Boundary stress falls before the event.", recovery.boundaryStressAfter < recovery.boundaryStressBefore, recovery.boundaryStressAfter, `< ${recovery.boundaryStressBefore}`),
      assertion("memory_decays", "Memory recency falls before the event.", recovery.averageMemoryRecencyAfter < recovery.averageMemoryRecencyBefore, recovery.averageMemoryRecencyAfter, `< ${recovery.averageMemoryRecencyBefore}`),
      assertion("gravity_decays", "Cluster mass follows memory recency.", recovery.clusterMassAfter < recovery.clusterMassBefore, recovery.clusterMassAfter, `< ${recovery.clusterMassBefore}`),
      assertion("momentum_decays", "Personality velocity loses momentum.", recovery.velocityMagnitudeAfter < recovery.velocityMagnitudeBefore, recovery.velocityMagnitudeAfter, `< ${recovery.velocityMagnitudeBefore}`),
    ],
  );
}

function auditNeutralStability(): TemporalSemanticsAuditCaseResult {
  const state = createAuditState();
  const baseline = createAuditState();
  const engine = new CharacterPhysicsEngine();
  for (let hour = 0; hour < 12; hour += 1) {
    engine.processEvent(state, neutralEvent(`neutral-${hour}`, `2026-04-01T${String(hour).padStart(2, "0")}:00:00.000Z`));
  }
  const distance = coordinateDistance(baseline, state);
  return caseResult(
    "neutral_stability",
    "High-frequency low-impact observations must not cause a large personality shift.",
    { personalityDistance: distance, eventCount: state.temporal.processedEventCount },
    [
      assertion("bounded_drift", "Neutral drift remains below 0.02.", distance < 0.02, distance, "< 0.02"),
      assertion("all_events_recorded", "All neutral inputs remain auditable.", state.temporal.processedEventCount === 12, state.temporal.processedEventCount, "12"),
    ],
  );
}

function auditOutOfOrderProtection(): TemporalSemanticsAuditCaseResult {
  const state = createAuditState();
  const engine = new CharacterPhysicsEngine();
  engine.processEvent(state, attachmentEvent("newer", "2026-05-10T00:00:00.000Z"));
  const step = engine.processEvent(state, attachmentEvent("older", "2026-05-01T00:00:00.000Z"));
  const clock = state.temporal.lastProcessedAt ?? "null";
  return caseResult(
    "out_of_order_protection",
    "Late historical input must be visible but cannot rewind or apply negative recovery.",
    { mode: step.temporalSemantics.mode, clock, recoveryApplied: step.temporalSemantics.recovery.applied },
    [
      assertion("warning", "Out-of-order mode is explicit.", step.temporalSemantics.mode === "out_of_order", step.temporalSemantics.mode, "out_of_order"),
      assertion("no_rewind", "Logical clock remains at the newer event.", clock === "2026-05-10T00:00:00.000Z", clock, "2026-05-10T00:00:00.000Z"),
      assertion("no_negative_recovery", "No recovery is applied backwards.", !step.temporalSemantics.recovery.applied, step.temporalSemantics.recovery.applied, "false"),
    ],
  );
}

function auditDeterministicReplay(): TemporalSemanticsAuditCaseResult {
  const run = () => {
    const state = createAuditState();
    const engine = new CharacterPhysicsEngine();
    engine.processEvent(state, attachmentEvent("deterministic-1", "2026-06-01T00:00:00.000Z"));
    engine.processEvent(state, attachmentEvent("deterministic-2", "2026-06-08T00:00:00.000Z"));
    return JSON.stringify(serializeCharacterPhysicsState(state));
  };
  const first = run();
  const second = run();
  return caseResult(
    "deterministic_replay",
    "The same timed input sequence must serialize to exactly the same state.",
    { identical: first === second, serializedLength: first.length },
    [assertion("exact_replay", "Serialized states match byte-for-byte.", first === second, first === second, "true")],
  );
}

function createAuditState(): CharacterPhysicsState {
  return createCharacterPhysicsState({ coordinate: linFanInitialCoordinate() });
}

function attachmentEvent(id: string, occurredAt: string): ExperienceEvent {
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
    occurredAt,
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

function coordinateDistance(left: CharacterPhysicsState, right: CharacterPhysicsState): number {
  return round4(Math.sqrt(BASE_PERSONALITY_KEYS.reduce(
    (sum, key) => sum + (left.coordinate.values[key] - right.coordinate.values[key]) ** 2,
    0,
  )));
}

function totalClusterMass(state: CharacterPhysicsState): number {
  return [...state.clusters.values()].reduce((sum, cluster) => sum + cluster.mass, 0);
}

function assertion(
  id: string,
  description: string,
  passed: boolean,
  actual: number | string | boolean,
  expected: string,
): TemporalSemanticsAuditAssertion {
  return { id, description, passed, actual, expected };
}

function caseResult(
  id: string,
  description: string,
  metrics: Record<string, number | string | boolean>,
  assertions: TemporalSemanticsAuditAssertion[],
): TemporalSemanticsAuditCaseResult {
  const failures = assertions
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: expected ${item.expected}, got ${String(item.actual)}`);
  return { id, description, assertions, metrics, passed: failures.length === 0, failures };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
