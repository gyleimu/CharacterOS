/**
 * V6.4 Benchmark Runner — executes benchmark cases against the physics engine.
 *
 * Currently supports memory_decay category only.
 * Other categories return "skipped" with an explanation.
 *
 * Each run creates fresh state — no shared state between runs.
 * Does NOT call LLM, access filesystem, or call external APIs.
 */

import type {
  BenchmarkCategory,
  BenchmarkCase,
  BenchmarkExpectedDirection,
  BenchmarkMetric,
  BenchmarkResult,
  BenchmarkTolerancePolicy
} from "./benchmarkTypes";
import { evaluateBenchmarkAssertion } from "./directionalAssertion";
import {
  createLinFanBlueprint,
  createCharacterStateFromBlueprint
} from "../character/characterBlueprint";
import { CharacterPhysicsEngine } from "../physics/physicsEngine";
import { runContinuousTick } from "../time/continuousTick";
import type { ContinuousTickTrace } from "../time/continuousTick";
import type { ExperienceEvent } from "../event/event";
import { deriveCharacterState } from "../state/derivedCharacterState";
import { evaluateTextAssertion } from "./behaviorDecisionAssertion";
import type {
  MemoryDecaySubProcessTrace,
  BoundaryRecoverySubProcessTrace
} from "../temporal/subProcessTrace";

// ─── Supported categories ───────────────────────────────────────────────

const SUPPORTED_CATEGORIES: ReadonlySet<BenchmarkCategory> = new Set([
  "memory_decay",
  "homeostasis_recovery",
  "belief_evolution",
  "event_impact",
  "behavior_decision"
]);

// ─── Single case runner ─────────────────────────────────────────────────

export interface RunBenchmarkCaseParams {
  /** The benchmark case to run. */
  kase: BenchmarkCase;
}

/**
 * Run a single benchmark case.
 *
 * Returns a BenchmarkResult. Unsupported categories return
 * status: "skipped" with an explanatory warning.
 */
export function runBenchmarkCase(
  params: RunBenchmarkCaseParams
): BenchmarkResult {
  const { kase } = params;
  const startMs = Date.now();

  // Category check
  if (!SUPPORTED_CATEGORIES.has(kase.category)) {
    return skip(kase,
      `Category "${kase.category}" is not supported yet. ` +
      `Currently supported: memory_decay, homeostasis_recovery, belief_evolution, event_impact, behavior_decision.`);
  }

  try {
    // Dispatch by category
    switch (kase.category) {
      case "memory_decay":
        return runMemoryDecayCase(kase, startMs);
      case "homeostasis_recovery":
        return runHomeostasisRecoveryCase(kase, startMs);
      case "belief_evolution":
        return runBeliefEvolutionCase(kase, startMs);
      case "event_impact":
        return runEventImpactCase(kase, startMs);
      case "behavior_decision":
        return runBehaviorDecisionCase(kase, startMs);
      default:
        return skip(kase, `No runner for category "${kase.category}".`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      caseId: kase.id,
      verdict: "error",
      assertionResults: [],
      metrics: [],
      warnings: [`Runner error: ${message}`],
      explanation: `Benchmark execution failed with error: ${message}`,
      durationMs: Date.now() - startMs
    };
  }
}

// ─── Multi-case runner ──────────────────────────────────────────────────

export interface RunBenchmarkCasesParams {
  /** The benchmark cases to run. */
  cases: readonly BenchmarkCase[];
}

export interface RunBenchmarkCasesResult {
  /** Per-case results. */
  results: readonly BenchmarkResult[];
  /** Count of passed cases. */
  passed: number;
  /** Count of failed cases. */
  failed: number;
  /** Count of skipped cases. */
  skipped: number;
  /** Count of errored cases. */
  errored: number;
}

/**
 * Run multiple benchmark cases.
 *
 * Each case runs independently with fresh state.
 */
export function runBenchmarkCases(
  params: RunBenchmarkCasesParams
): RunBenchmarkCasesResult {
  const results: BenchmarkResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let errored = 0;

  for (const kase of params.cases) {
    const result = runBenchmarkCase({ kase });
    results.push(result);
    switch (result.verdict) {
      case "pass": passed++; break;
      case "fail": failed++; break;
      case "inconclusive": break;
      case "error": errored++; break;
    }
  }

  // Detect skipped results
  for (const r of results) {
    if (r.warnings.some((w) => w.toLowerCase().includes("not supported") ||
      w.toLowerCase().includes("skipped"))) {
      skipped++;
    }
  }

  return { results, passed, failed, skipped, errored };
}

// ─── Memory decay runner ────────────────────────────────────────────────

function runMemoryDecayCase(
  kase: BenchmarkCase,
  startMs: number
): BenchmarkResult {
  // 1. Create initial state
  const blueprint = createLinFanBlueprint();
  const state = createCharacterStateFromBlueprint(blueprint, {
    seedInitialExperiences: true
  });
  const engine = new CharacterPhysicsEngine();

  // 2. Process benchmark events
  for (const inputEvent of kase.scenario.events) {
    engine.processEvent(state, {
      id: inputEvent.id,
      description: inputEvent.description,
      tags: inputEvent.tags,
      category: inputEvent.category,
      intensity: inputEvent.intensity,
      importance: inputEvent.importance,
      relationshipWeight: inputEvent.relationshipWeight,
      expectationGap: inputEvent.expectationGap,
      personalitySensitivity: inputEvent.personalitySensitivity
    } as ExperienceEvent);
  }

  // 3. Record initial values
  const memoryCountInitial = state.memories.length;

  // 4. Run ticks, collecting traces and series
  const tickTraces: ContinuousTickTrace[] = [];
  const seriesRecencyAfter: number[] = [];
  const seriesWeightAfter: number[] = [];

  for (const tick of kase.scenario.ticks) {
    const trace = runContinuousTick(state, {
      daysElapsed: tick.daysElapsed,
      ...(tick.memoryDecayRate !== undefined ? { memoryDecayRate: tick.memoryDecayRate } : {})
    });
    tickTraces.push(trace);

    // Collect subprocess after-values for monotonic series
    const phase3 = trace.phases[2];
    if (phase3?.subProcesses?.[0]) {
      const sub = phase3.subProcesses[0] as MemoryDecaySubProcessTrace;
      seriesRecencyAfter.push(sub.metrics.averageRecencyAfter);
      seriesWeightAfter.push(sub.metrics.averageEffectiveWeightAfter);
    }
  }

  // 5. Use final tick trace for before/after observations
  const finalTrace = tickTraces[tickTraces.length - 1];
  if (!finalTrace) {
    return {
      caseId: kase.id,
      verdict: "error",
      assertionResults: [],
      metrics: [],
      warnings: ["No tick traces produced."],
      explanation: "No continuous tick traces were produced.",
      durationMs: Date.now() - startMs
    };
  }

  const finalSub = finalTrace.phases[2]?.subProcesses?.[0] as MemoryDecaySubProcessTrace | undefined;

  // 6. Evaluate each expected direction individually (to pass series where needed)
  const assertionResults = kase.expectedDirections.map((ed) => {
    const tolerance = ed.tolerance ?? kase.tolerancePolicy;
    const needsSeries = tolerance.mode === "monotonic";

    switch (ed.metricPath) {
      case "continuousTick.averageMemoryRecency": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: finalTrace.averageMemoryRecencyBefore,
          valueAfter: finalTrace.averageMemoryRecencyAfter,
          tolerance
        });
      }
      case "continuousTick.averageMemoryWeight": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: finalTrace.averageMemoryWeightBefore,
          valueAfter: finalTrace.averageMemoryWeightAfter,
          tolerance
        });
      }
      case "continuousTick.memoryCount": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: memoryCountInitial,
          valueAfter: finalTrace.memoryCount,
          tolerance
        });
      }
      case "memoryDecay.averageRecencyAfter": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: needsSeries ? (seriesRecencyAfter[0] ?? 0) : (finalSub?.metrics.averageRecencyBefore ?? 0),
          valueAfter: finalSub?.metrics.averageRecencyAfter ?? 0,
          ...(needsSeries ? { series: seriesRecencyAfter } : {}),
          tolerance
        });
      }
      default:
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: NaN,
          valueAfter: NaN,
          tolerance
        });
    }
  });

  // 7. Build verdict
  const allPassed = assertionResults.every((r) => r.passed);
  const verdict = allPassed ? ("pass" as const) : ("fail" as const);
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const failedCount = assertionResults.filter((r) => !r.passed).length;

  // 8. Collect metrics from the metric selectors
  const metrics: BenchmarkMetric[] = [];
  for (const ms of kase.metricsToInspect) {
    const obs = resolveMetric(ms.path, finalTrace, finalSub, memoryCountInitial);
    if (obs) {
      metrics.push({
        path: ms.path,
        source: ms.source,
        valueBefore: obs.before,
        valueAfter: obs.after,
        delta: obs.after - obs.before
      });
    }
  }

  const failedExplanations = assertionResults
    .filter((r) => !r.passed)
    .map((r) => r.explanation);

  return {
    caseId: kase.id,
    verdict,
    assertionResults,
    metrics,
    warnings: failedExplanations.length > 0 ? failedExplanations : [],
    explanation: allPassed
      ? `Memory decay benchmark passed: ${passedCount}/${assertionResults.length} assertions passed.`
      : `Memory decay benchmark failed: ${passedCount}/${assertionResults.length} assertions passed. Failures: ${failedExplanations.join("; ")}`,
    durationMs: Date.now() - startMs
  };
}

// ─── Homeostasis recovery runner ─────────────────────────────────────────

function runHomeostasisRecoveryCase(
  kase: BenchmarkCase,
  startMs: number
): BenchmarkResult {
  const warnings: string[] = [];

  // 1. Create initial state
  const blueprint = createLinFanBlueprint();
  const state = createCharacterStateFromBlueprint(blueprint, {
    seedInitialExperiences: true
  });
  const engine = new CharacterPhysicsEngine();

  // 2. Process benchmark events to create high stress
  for (const inputEvent of kase.scenario.events) {
    engine.processEvent(state, {
      id: inputEvent.id,
      description: inputEvent.description,
      tags: inputEvent.tags,
      category: inputEvent.category,
      intensity: inputEvent.intensity,
      importance: inputEvent.importance,
      relationshipWeight: inputEvent.relationshipWeight,
      expectationGap: inputEvent.expectationGap,
      personalitySensitivity: inputEvent.personalitySensitivity
    } as ExperienceEvent);
  }

  // 3. Capture boundary state BEFORE tick
  const boundaryBeforeTick = { ...state.boundary };

  // 4. Run tick(s)
  const tickTraces: ContinuousTickTrace[] = [];
  for (const tick of kase.scenario.ticks) {
    const trace = runContinuousTick(state, {
      daysElapsed: tick.daysElapsed,
      ...(tick.memoryDecayRate !== undefined ? { memoryDecayRate: tick.memoryDecayRate } : {})
    });
    tickTraces.push(trace);
  }

  const finalTrace = tickTraces[tickTraces.length - 1];
  if (!finalTrace) {
    return {
      caseId: kase.id,
      verdict: "error",
      assertionResults: [],
      metrics: [],
      warnings: ["No tick traces produced."],
      explanation: "No continuous tick traces were produced.",
      durationMs: Date.now() - startMs
    };
  }

  // 5. Extract subprocess and homeostasis data
  const phase3 = finalTrace.phases[2];
  const boundarySub = phase3?.subProcesses?.[2] as BoundaryRecoverySubProcessTrace | undefined;
  const regulatedBoundary = finalTrace.homeostasis.regulatedBoundary;

  // D10 note: Phase 3 boundary_recovery subprocess captures intermediate recovery.
  // Final state.boundary === homeostasis.regulatedBoundary (Phase 4 overwrite).
  warnings.push(
    "D10 note: boundary_recovery subprocess metrics reflect Phase 3 intermediate. " +
    "Final boundary is homeostasis.regulatedBoundary — the subprocess values " +
    "may differ from the tick's final boundary."
  );

  // 6. Evaluate expected directions
  const assertionResults = kase.expectedDirections.map((ed) => {
    const tolerance = ed.tolerance ?? kase.tolerancePolicy;

    if (!boundarySub) {
      return evaluateBenchmarkAssertion({
        expected: ed,
        valueBefore: NaN,
        valueAfter: NaN,
        tolerance
      });
    }

    switch (ed.metricPath) {
      case "boundaryRecovery.stressLoadAfter": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: boundarySub.metrics.stressLoadBefore,
          valueAfter: boundarySub.metrics.stressLoadAfter,
          tolerance
        });
      }
      case "boundaryRecovery.integrityAfter": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: boundarySub.metrics.integrityBefore,
          valueAfter: boundarySub.metrics.integrityAfter,
          tolerance
        });
      }
      case "boundaryRecovery.cracksAfter": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: boundarySub.metrics.cracksBefore,
          valueAfter: boundarySub.metrics.cracksAfter,
          tolerance
        });
      }
      default:
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: NaN,
          valueAfter: NaN,
          tolerance
        });
    }
  });

  // 7. Build verdict
  const allPassed = assertionResults.every((r) => r.passed);
  const verdict = allPassed ? ("pass" as const) : ("fail" as const);
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const failedCount = assertionResults.filter((r) => !r.passed).length;

  // 8. Collect metrics
  const metrics: BenchmarkMetric[] = [];
  if (boundarySub) {
    for (const ms of kase.metricsToInspect) {
      const obs = resolveHomeostasisMetric(ms.path, boundarySub, regulatedBoundary, boundaryBeforeTick);
      if (obs) {
        metrics.push({
          path: ms.path,
          source: ms.source,
          valueBefore: obs.before,
          valueAfter: obs.after,
          delta: obs.after - obs.before
        });
      }
    }
  }

  const failedExplanations = assertionResults
    .filter((r) => !r.passed)
    .map((r) => r.explanation);

  return {
    caseId: kase.id,
    verdict,
    assertionResults,
    metrics,
    warnings: [...warnings, ...(failedExplanations.length > 0 ? failedExplanations : [])],
    explanation: allPassed
      ? `Homeostasis recovery benchmark passed: ${passedCount}/${assertionResults.length} assertions passed.`
      : `Homeostasis recovery benchmark failed: ${passedCount}/${assertionResults.length} assertions passed. Failures: ${failedExplanations.join("; ")}`,
    durationMs: Date.now() - startMs
  };
}

// ─── Behavior decision runner ───────────────────────────────────────────

function runBehaviorDecisionCase(
  kase: BenchmarkCase,
  startMs: number
): BenchmarkResult {
  const warnings: string[] = [];

  // 1. Create initial state
  const blueprint = createLinFanBlueprint();
  const state = createCharacterStateFromBlueprint(blueprint, {
    seedInitialExperiences: true
  });
  const engine = new CharacterPhysicsEngine();

  // 2. Process scenario event
  for (const inputEvent of kase.scenario.events) {
    engine.processEvent(state, {
      id: inputEvent.id,
      description: inputEvent.description,
      tags: inputEvent.tags,
      category: inputEvent.category,
      intensity: inputEvent.intensity,
      importance: inputEvent.importance,
      relationshipWeight: inputEvent.relationshipWeight,
      expectationGap: inputEvent.expectationGap,
      personalitySensitivity: inputEvent.personalitySensitivity
    } as ExperienceEvent);
  }

  // 3. Run ticks
  for (const tick of kase.scenario.ticks) {
    runContinuousTick(state, {
      daysElapsed: tick.daysElapsed,
      ...(tick.memoryDecayRate !== undefined ? { memoryDecayRate: tick.memoryDecayRate } : {})
    });
  }

  // 4. Derive character state
  const derived = deriveCharacterState(state);
  const decision = derived.decision;
  const biases = derived.behaviorBiases;
  const embodiedAction = derived.embodiedAction;

  warnings.push(
    "Behavior decision benchmark tests structural consistency, not literary quality. " +
    "No LLM is used. Bounded assertions on decision fields only."
  );

  // 5. Evaluate expected directions
  const assertionResults = kase.expectedDirections.map((ed) => {
    const tolerance = ed.tolerance ?? kase.tolerancePolicy;

    switch (ed.metricPath) {
      case "decision.mostLikelyAction": {
        return evaluateTextAssertion({
          expected: ed,
          text: decision.mostLikelyAction,
          numericValue: decision.mostLikelyAction.length,
          tolerance
        });
      }
      case "decision.confidence": {
        return evaluateTextAssertion({
          expected: ed,
          text: String(decision.confidence),
          numericValue: decision.confidence,
          tolerance
        });
      }
      case "behaviorBias.tendency": {
        const hasBias = biases.length > 0 ? biases.length : 0;
        return evaluateTextAssertion({
          expected: ed,
          text: biases.map((b) => b.tendency).join("; "),
          numericValue: hasBias,
          tolerance
        });
      }
      case "embodiedAction.noiseLevel": {
        return evaluateTextAssertion({
          expected: ed,
          text: String(embodiedAction.noiseLevel),
          numericValue: embodiedAction.noiseLevel,
          tolerance
        });
      }
      default:
        return evaluateTextAssertion({
          expected: ed,
          text: "",
          tolerance
        });
    }
  });

  // 6. Build verdict
  const allPassed = assertionResults.every((r) => r.passed);
  const verdict = allPassed ? ("pass" as const) : ("fail" as const);
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const failedCount = assertionResults.filter((r) => !r.passed).length;

  // 7. Collect metrics
  const metrics: BenchmarkMetric[] = [];
  for (const ms of kase.metricsToInspect) {
    const obs = resolveBehaviorDecisionMetric(ms.path, decision, biases, embodiedAction);
    if (obs) {
      metrics.push({
        path: ms.path,
        source: ms.source,
        valueBefore: obs.before,
        valueAfter: obs.after,
        delta: obs.after - obs.before
      });
    }
  }

  const failedExplanations = assertionResults
    .filter((r) => !r.passed)
    .map((r) => r.explanation);

  return {
    caseId: kase.id,
    verdict,
    assertionResults,
    metrics,
    warnings: [...warnings, ...(failedExplanations.length > 0 ? failedExplanations : [])],
    explanation: allPassed
      ? `Behavior decision benchmark passed: ${passedCount}/${assertionResults.length} assertions passed.`
      : `Behavior decision benchmark failed: ${passedCount}/${assertionResults.length} assertions passed. Failures: ${failedExplanations.join("; ")}`,
    durationMs: Date.now() - startMs
  };
}

function resolveBehaviorDecisionMetric(
  path: string,
  decision: { mostLikelyAction: string; confidence: number },
  biases: readonly { tendency: string; likelihood: number }[],
  embodiedAction: { noiseLevel: number }
): { before: number; after: number } | undefined {
  switch (path) {
    case "decision.mostLikelyAction":
      return { before: 0, after: decision.mostLikelyAction.length };
    case "decision.confidence":
      return { before: 0, after: decision.confidence };
    case "behaviorBias.tendency":
      return { before: 0, after: biases.length };
    case "embodiedAction.noiseLevel":
      return { before: 0, after: embodiedAction.noiseLevel };
    default:
      return undefined;
  }
}

// ─── Event impact runner ────────────────────────────────────────────────

function runEventImpactCase(
  kase: BenchmarkCase,
  startMs: number
): BenchmarkResult {
  const warnings: string[] = [];

  // 1. Create initial state
  const blueprint = createLinFanBlueprint();
  const state = createCharacterStateFromBlueprint(blueprint, {
    seedInitialExperiences: true
  });
  const engine = new CharacterPhysicsEngine();

  // 2. Snapshot coordinate BEFORE events
  const trustBefore = state.coordinate.values.trust;
  const fearBefore = state.coordinate.values.fear;
  const neuroticismBefore = state.coordinate.values.neuroticism;
  const memoryCountBefore = state.memories.length;

  // 3. Process benchmark events, capture impact scores
  let lastImpactValue = 0;
  for (const inputEvent of kase.scenario.events) {
    const stepResult = engine.processEvent(state, {
      id: inputEvent.id,
      description: inputEvent.description,
      tags: inputEvent.tags,
      category: inputEvent.category,
      intensity: inputEvent.intensity,
      importance: inputEvent.importance,
      relationshipWeight: inputEvent.relationshipWeight,
      expectationGap: inputEvent.expectationGap,
      personalitySensitivity: inputEvent.personalitySensitivity
    } as ExperienceEvent);
    lastImpactValue = stepResult.impactScore.value;
  }

  // 4. Run ticks if specified
  for (const tick of kase.scenario.ticks) {
    runContinuousTick(state, {
      daysElapsed: tick.daysElapsed,
      ...(tick.memoryDecayRate !== undefined ? { memoryDecayRate: tick.memoryDecayRate } : {})
    });
  }

  // 5. Snapshot coordinate AFTER events + ticks
  const trustAfter = state.coordinate.values.trust;
  const fearAfter = state.coordinate.values.fear;
  const neuroticismAfter = state.coordinate.values.neuroticism;
  const memoryCountAfter = state.memories.length;

  warnings.push(
    "Immediate personality drift is expected to be subtle. " +
    "Directional assertions are preferred — exact magnitude is fragile."
  );

  // 6. Evaluate expected directions
  const assertionResults = kase.expectedDirections.map((ed) => {
    const tolerance = ed.tolerance ?? kase.tolerancePolicy;

    switch (ed.metricPath) {
      case "coordinate.values.trust": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: trustBefore,
          valueAfter: trustAfter,
          tolerance
        });
      }
      case "coordinate.values.fear": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: fearBefore,
          valueAfter: fearAfter,
          tolerance
        });
      }
      case "coordinate.values.neuroticism": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: neuroticismBefore,
          valueAfter: neuroticismAfter,
          tolerance
        });
      }
      case "impactScore.band": {
        // impactScore.band direction uses impact value for numeric comparison
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: 0,
          valueAfter: lastImpactValue,
          tolerance
        });
      }
      default:
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: NaN,
          valueAfter: NaN,
          tolerance
        });
    }
  });

  // 7. Build verdict
  const allPassed = assertionResults.every((r) => r.passed);
  const verdict = allPassed ? ("pass" as const) : ("fail" as const);
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const failedCount = assertionResults.filter((r) => !r.passed).length;

  // 8. Collect metrics
  const metrics: BenchmarkMetric[] = [];
  for (const ms of kase.metricsToInspect) {
    const obs = resolveEventImpactMetric(
      ms.path, trustBefore, trustAfter, fearBefore, fearAfter,
      neuroticismBefore, neuroticismAfter, lastImpactValue,
      memoryCountBefore, memoryCountAfter
    );
    if (obs) {
      metrics.push({
        path: ms.path,
        source: ms.source,
        valueBefore: obs.before,
        valueAfter: obs.after,
        delta: obs.after - obs.before
      });
    }
  }

  const failedExplanations = assertionResults
    .filter((r) => !r.passed)
    .map((r) => r.explanation);

  return {
    caseId: kase.id,
    verdict,
    assertionResults,
    metrics,
    warnings: [...warnings, ...(failedExplanations.length > 0 ? failedExplanations : [])],
    explanation: allPassed
      ? `Event impact benchmark passed: ${passedCount}/${assertionResults.length} assertions passed.`
      : `Event impact benchmark failed: ${passedCount}/${assertionResults.length} assertions passed. Failures: ${failedExplanations.join("; ")}`,
    durationMs: Date.now() - startMs
  };
}

function resolveEventImpactMetric(
  path: string,
  trustBefore: number, trustAfter: number,
  fearBefore: number, fearAfter: number,
  neuroticismBefore: number, neuroticismAfter: number,
  impactValue: number,
  memoryBefore: number, memoryAfter: number
): { before: number; after: number } | undefined {
  switch (path) {
    case "coordinate.values.trust":
      return { before: trustBefore, after: trustAfter };
    case "coordinate.values.fear":
      return { before: fearBefore, after: fearAfter };
    case "coordinate.values.neuroticism":
      return { before: neuroticismBefore, after: neuroticismAfter };
    case "impactScore.value":
      return { before: 0, after: impactValue };
    default:
      return undefined;
  }
}

// ─── Belief evolution runner ────────────────────────────────────────────

function runBeliefEvolutionCase(
  kase: BenchmarkCase,
  startMs: number
): BenchmarkResult {
  const warnings: string[] = [];

  // 1. Create initial state
  const blueprint = createLinFanBlueprint();
  const state = createCharacterStateFromBlueprint(blueprint, {
    seedInitialExperiences: true
  });
  const engine = new CharacterPhysicsEngine();

  // 2. Process repeated evidence events
  for (const inputEvent of kase.scenario.events) {
    engine.processEvent(state, {
      id: inputEvent.id,
      description: inputEvent.description,
      tags: inputEvent.tags,
      category: inputEvent.category,
      intensity: inputEvent.intensity,
      importance: inputEvent.importance,
      relationshipWeight: inputEvent.relationshipWeight,
      expectationGap: inputEvent.expectationGap,
      personalitySensitivity: inputEvent.personalitySensitivity
    } as ExperienceEvent);
  }

  // 3. Record belief state before tick
  const beliefCountBefore = state.beliefStates.length;
  const avgStrengthBefore = beliefStatesAverageStrength(state.beliefStates);

  // 4. Run ticks
  const tickTraces: ContinuousTickTrace[] = [];
  for (const tick of kase.scenario.ticks) {
    const trace = runContinuousTick(state, {
      daysElapsed: tick.daysElapsed,
      ...(tick.memoryDecayRate !== undefined ? { memoryDecayRate: tick.memoryDecayRate } : {})
    });
    tickTraces.push(trace);
  }

  const finalTrace = tickTraces[tickTraces.length - 1];
  if (!finalTrace) {
    return {
      caseId: kase.id,
      verdict: "error",
      assertionResults: [],
      metrics: [],
      warnings: ["No tick traces produced."],
      explanation: "No continuous tick traces were produced.",
      durationMs: Date.now() - startMs
    };
  }

  const avgStrengthAfter = beliefStatesAverageStrength(state.beliefStates);
  const beliefCountAfter = state.beliefStates.length;

  warnings.push(
    "Belief evolution is a slow variable. Large numeric jumps are not expected. " +
    "Directional assertions are preferred over exact magnitude checks."
  );

  // 5. Evaluate expected directions
  const assertionResults = kase.expectedDirections.map((ed) => {
    const tolerance = ed.tolerance ?? kase.tolerancePolicy;

    switch (ed.metricPath) {
      case "beliefEvolution.beliefStrength": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: avgStrengthBefore,
          valueAfter: avgStrengthAfter,
          tolerance
        });
      }
      case "continuousTick.beliefEvolution.after": {
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: beliefCountBefore,
          valueAfter: beliefCountAfter,
          tolerance
        });
      }
      default:
        return evaluateBenchmarkAssertion({
          expected: ed,
          valueBefore: NaN,
          valueAfter: NaN,
          tolerance
        });
    }
  });

  // 6. Build verdict
  const allPassed = assertionResults.every((r) => r.passed);
  const verdict = allPassed ? ("pass" as const) : ("fail" as const);
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const failedCount = assertionResults.filter((r) => !r.passed).length;

  // 7. Collect metrics
  const metrics: BenchmarkMetric[] = [];
  for (const ms of kase.metricsToInspect) {
    const obs = resolveBeliefMetric(ms.path, finalTrace, state);
    if (obs) {
      metrics.push({
        path: ms.path,
        source: ms.source,
        valueBefore: obs.before,
        valueAfter: obs.after,
        delta: obs.after - obs.before
      });
    }
  }

  const failedExplanations = assertionResults
    .filter((r) => !r.passed)
    .map((r) => r.explanation);

  return {
    caseId: kase.id,
    verdict,
    assertionResults,
    metrics,
    warnings: [...warnings, ...(failedExplanations.length > 0 ? failedExplanations : [])],
    explanation: allPassed
      ? `Belief evolution benchmark passed: ${passedCount}/${assertionResults.length} assertions passed.`
      : `Belief evolution benchmark failed: ${passedCount}/${assertionResults.length} assertions passed. Failures: ${failedExplanations.join("; ")}`,
    durationMs: Date.now() - startMs
  };
}

function beliefStatesAverageStrength(beliefs: readonly { strength: number }[]): number {
  if (!beliefs.length) return 0;
  const sum = beliefs.reduce((s, b) => s + b.strength, 0);
  return Math.round(sum / beliefs.length * 1_000_000) / 1_000_000;
}

// ─── Metric resolvers ───────────────────────────────────────────────────

function resolveMetric(
  path: string,
  trace: ContinuousTickTrace,
  subProcess: MemoryDecaySubProcessTrace | undefined,
  memoryCountInitial: number
): { before: number; after: number } | undefined {
  switch (path) {
    case "subprocess.memoryDecay.avgRecencyBefore":
      if (!subProcess) return undefined;
      return { before: subProcess.metrics.averageRecencyBefore, after: subProcess.metrics.averageRecencyBefore };
    case "subprocess.memoryDecay.avgRecencyAfter":
      if (!subProcess) return undefined;
      return { before: subProcess.metrics.averageRecencyBefore, after: subProcess.metrics.averageRecencyAfter };
    case "subprocess.memoryDecay.avgWeightBefore":
      if (!subProcess) return undefined;
      return { before: subProcess.metrics.averageEffectiveWeightBefore, after: subProcess.metrics.averageEffectiveWeightBefore };
    case "subprocess.memoryDecay.avgWeightAfter":
      if (!subProcess) return undefined;
      return { before: subProcess.metrics.averageEffectiveWeightBefore, after: subProcess.metrics.averageEffectiveWeightAfter };
    case "continuousTick.memoryCount":
      return { before: memoryCountInitial, after: trace.memoryCount };
    default:
      return undefined;
  }
}

function resolveHomeostasisMetric(
  path: string,
  boundarySub: BoundaryRecoverySubProcessTrace,
  regulatedBoundary: { stressLoad: number; integrity: number; cracks: number },
  boundaryBeforeTick: { stressLoad: number; integrity: number; cracks: number }
): { before: number; after: number } | undefined {
  switch (path) {
    case "subprocess.boundaryRecovery.stressLoadBefore":
      return { before: boundarySub.metrics.stressLoadBefore, after: boundarySub.metrics.stressLoadBefore };
    case "subprocess.boundaryRecovery.stressLoadAfter":
      return { before: boundarySub.metrics.stressLoadBefore, after: boundarySub.metrics.stressLoadAfter };
    case "subprocess.boundaryRecovery.integrityBefore":
      return { before: boundarySub.metrics.integrityBefore, after: boundarySub.metrics.integrityBefore };
    case "subprocess.boundaryRecovery.integrityAfter":
      return { before: boundarySub.metrics.integrityBefore, after: boundarySub.metrics.integrityAfter };
    case "subprocess.boundaryRecovery.cracksBefore":
      return { before: boundarySub.metrics.cracksBefore, after: boundarySub.metrics.cracksBefore };
    case "subprocess.boundaryRecovery.cracksAfter":
      return { before: boundarySub.metrics.cracksBefore, after: boundarySub.metrics.cracksAfter };
    default:
      return undefined;
  }
}

function resolveBeliefMetric(
  path: string,
  trace: ContinuousTickTrace,
  state: { beliefStates: readonly { strength: number }[] }
): { before: number; after: number } | undefined {
  switch (path) {
    case "continuousTick.beliefEvolution": {
      const afterCount = trace.beliefEvolution.after.length;
      return { before: trace.beliefEvolution.before.length, after: afterCount };
    }
    case "state.beliefStates": {
      const beforeAvg = beliefStatesAverageStrength(trace.beliefEvolution.before);
      const afterAvg = beliefStatesAverageStrength(trace.beliefEvolution.after);
      return { before: beforeAvg, after: afterAvg };
    }
    default:
      return undefined;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function skip(kase: BenchmarkCase, reason: string): BenchmarkResult {
  return {
    caseId: kase.id,
    verdict: "error",
    assertionResults: [],
    metrics: [],
    warnings: [reason],
    explanation: `Benchmark case "${kase.id}" was skipped: ${reason}`,
    durationMs: 0
  };
}
