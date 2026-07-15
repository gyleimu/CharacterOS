import { DETERMINISTIC_TIMESTAMP } from "../deterministicHelpers";
import {
  buildDifferentiatedDecision,
  type DifferentiatedDecision,
} from "../differentiation/characterDifferentiation";
import type { EventCategory } from "../event/categoryPhysics";
import type { ExperienceEvent } from "../event/event";
import {
  GOLDEN_BASELINES,
  GOLDEN_EVENT_CATEGORIES,
  GOLDEN_EVENT_EXPECTATIONS,
  GOLDEN_SCENARIOS,
  GOLDEN_TRAJECTORY_HORIZONS,
  buildGoldenEvent,
  type GoldenBaselineFixture,
  type GoldenScenarioFixture,
  type GoldenTrajectoryHorizon,
} from "../calibration/goldenTrajectoryFixtures";
import {
  createModelParameterVariant,
  flattenNumericParameters,
  getCurrentModelParameterSet,
  listModelParameterDescriptors,
  listModelParameterSets,
  validateModelParameterSet,
  type ModelParameterOverrides,
  type ModelParameterPath,
  type ModelParameterSet,
} from "../parameters/modelParameterRegistry";
import { BASE_PERSONALITY_KEYS, type PersonalityDimensionKey } from "../personality/dimensions";
import { coordinateDistance, coordinateToRecord } from "../personality/coordinate";
import {
  CharacterPhysicsEngine,
  createCharacterPhysicsState,
  type CharacterPhysicsState,
} from "../physics/physicsEngine";
import { serializeCharacterPhysicsState } from "../physics/serialization";
import { inspectCharacterStateIntegrity } from "../state/stateIntegrity";

export type ModelCalibrationVerdict = "PASS" | "FAIL";

export interface CalibrationAssertion {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly actual: number | string | boolean;
  readonly expected: string;
}

export interface GoldenScenarioProjection {
  readonly scenarioId: GoldenScenarioFixture["id"];
  readonly relevant: boolean;
  readonly beforeTopStrategy: string;
  readonly afterTopStrategy: string;
  readonly topStrategyChanged: boolean;
  readonly strategyDistributionDistance: number;
  readonly responsive: boolean;
}

export interface GoldenTrajectoryResult {
  readonly id: string;
  readonly category: EventCategory;
  readonly baselineId: GoldenBaselineFixture["id"];
  readonly horizon: GoldenTrajectoryHorizon;
  readonly parameterSetVersion: string;
  readonly coordinateDelta: Record<PersonalityDimensionKey, number>;
  readonly personalityDistance: number;
  readonly boundaryStressDelta: number;
  readonly finalBoundaryStress: number;
  readonly finalClusterMass: number;
  readonly memoryCount: number;
  readonly assertions: CalibrationAssertion[];
  readonly scenarios: GoldenScenarioProjection[];
  readonly passed: boolean;
  readonly failures: string[];
}

export interface CategoryDecisionCoverage {
  readonly category: EventCategory;
  readonly relevantProjectionCount: number;
  readonly responsiveProjectionCount: number;
  readonly responseRate: number | null;
  readonly maxFiveEventDistributionDistance: number;
  readonly responseFloorPassed: boolean;
  readonly overreactionGuardPassed: boolean;
  readonly passed: boolean;
  readonly failures: string[];
}

export interface PropertySequenceResult {
  readonly seed: number;
  readonly eventCount: number;
  readonly deterministic: boolean;
  readonly integrityValid: boolean;
  readonly uniqueIds: boolean;
  readonly finiteCoordinates: boolean;
  readonly passed: boolean;
  readonly failures: string[];
}

export interface MetamorphicResult {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly metrics: Record<string, number | string | boolean>;
  readonly failures: string[];
}

export interface SensitivityResult {
  readonly parameterPath: ModelParameterPath;
  readonly probe: string;
  readonly baselineValue: number;
  readonly lowerParameterValue: number;
  readonly upperParameterValue: number;
  readonly lowerMetric: number;
  readonly baselineMetric: number;
  readonly upperMetric: number;
  readonly expectedMonotonicity: "increasing" | "decreasing";
  readonly monotonic: boolean;
  readonly directionStable: boolean;
  readonly normalizedSpread: number;
  readonly passed: boolean;
  readonly failures: string[];
}

export interface RepairAsymmetryResult {
  readonly damage: number;
  readonly repair: number;
  readonly scarRetentionRatio: number;
  readonly trustBefore: number;
  readonly trustAfterDamage: number;
  readonly trustAfterRepair: number;
  readonly assertions: CalibrationAssertion[];
  readonly passed: boolean;
  readonly failures: string[];
}

export interface ModelCalibrationAuditResult {
  readonly version: "14.1.0";
  readonly generatedAt: string;
  readonly parameterRegistry: {
    readonly currentVersion: string;
    readonly currentFingerprint: string;
    readonly registeredSetCount: number;
    readonly numericParameterCount: number;
    readonly descriptorCount: number;
    readonly allSetsValid: boolean;
    readonly immutable: boolean;
    readonly descriptorsImmutable: boolean;
    readonly issues: string[];
  };
  readonly goldenTrajectories: GoldenTrajectoryResult[];
  readonly categoryDecisionCoverage: CategoryDecisionCoverage[];
  readonly propertySequences: PropertySequenceResult[];
  readonly metamorphicChecks: MetamorphicResult[];
  readonly sensitivityChecks: SensitivityResult[];
  readonly repairAsymmetry: RepairAsymmetryResult;
  readonly summary: {
    readonly trajectoryCount: number;
    readonly scenarioProjectionCount: number;
    readonly passedTrajectories: number;
    readonly failedTrajectories: number;
    readonly relevantScenarioResponseRate: number;
    readonly categoryDecisionCoveragePassed: number;
    readonly propertySequencesPassed: number;
    readonly metamorphicChecksPassed: number;
    readonly sensitivityChecksPassed: number;
    readonly totalAssertions: number;
    readonly passedAssertions: number;
  };
  readonly failures: string[];
  readonly knownLimitations: string[];
  readonly gateVerdict: {
    readonly level: ModelCalibrationVerdict;
    readonly passed: boolean;
    readonly reasons: string[];
  };
  readonly requiredForRelease: true;
}

export function runModelCalibrationAudit(): ModelCalibrationAuditResult {
  const parameterRegistry = auditParameterRegistry();
  const goldenTrajectories = runGoldenTrajectories();
  const propertySequences = runPropertySequences();
  const metamorphicChecks = runMetamorphicChecks();
  const sensitivityChecks = runSensitivityChecks();
  const repairAsymmetry = runRepairAsymmetry();

  const relevantProjections = goldenTrajectories.flatMap((trajectory) => (
    trajectory.horizon >= 5 ? trajectory.scenarios.filter((scenario) => scenario.relevant) : []
  ));
  const responsiveRelevant = relevantProjections.filter((projection) => projection.responsive).length;
  const relevantScenarioResponseRate = relevantProjections.length
    ? round4(responsiveRelevant / relevantProjections.length)
    : 1;
  const categoryDecisionCoverage = auditCategoryDecisionCoverage(goldenTrajectories);

  const failures = [
    ...parameterRegistry.issues.map((issue) => `parameter_registry: ${issue}`),
    ...goldenTrajectories.flatMap((trajectory) => trajectory.failures.map((failure) => `${trajectory.id}: ${failure}`)),
    ...propertySequences.flatMap((sequence) => sequence.failures.map((failure) => `property_seed_${sequence.seed}: ${failure}`)),
    ...metamorphicChecks.flatMap((check) => check.failures.map((failure) => `${check.id}: ${failure}`)),
    ...sensitivityChecks.flatMap((check) => check.failures.map((failure) => `${check.parameterPath}: ${failure}`)),
    ...repairAsymmetry.failures.map((failure) => `repair_asymmetry: ${failure}`),
    ...categoryDecisionCoverage.flatMap((coverage) => coverage.failures.map(
      (failure) => `decision_coverage_${coverage.category}: ${failure}`,
    )),
  ];
  if (relevantScenarioResponseRate < 0.5) {
    failures.push(
      `relevant scenario strategy response rate ${relevantScenarioResponseRate} is below 0.5`,
    );
  }

  const trajectoryAssertions = goldenTrajectories.flatMap((trajectory) => trajectory.assertions);
  const repairAssertions = repairAsymmetry.assertions;
  const totalAssertions =
    trajectoryAssertions.length +
    propertySequences.length * 4 +
    metamorphicChecks.length +
    sensitivityChecks.length * 3 +
    categoryDecisionCoverage.length * 2 +
    repairAssertions.length;
  const passedAssertions =
    trajectoryAssertions.filter((assertion) => assertion.passed).length +
    propertySequences.reduce((sum, sequence) => sum + [
      sequence.deterministic,
      sequence.integrityValid,
      sequence.uniqueIds,
      sequence.finiteCoordinates,
    ].filter(Boolean).length, 0) +
    metamorphicChecks.filter((check) => check.passed).length +
    sensitivityChecks.reduce((sum, check) => sum + [
      check.monotonic,
      check.directionStable,
      check.normalizedSpread <= 1.5,
    ].filter(Boolean).length, 0) +
    categoryDecisionCoverage.reduce((sum, coverage) => sum + [
      coverage.responseFloorPassed,
      coverage.overreactionGuardPassed,
    ].filter(Boolean).length, 0) +
    repairAssertions.filter((assertion) => assertion.passed).length;

  const passed = failures.length === 0;
  return {
    version: "14.1.0",
    generatedAt: DETERMINISTIC_TIMESTAMP,
    parameterRegistry,
    goldenTrajectories,
    categoryDecisionCoverage,
    propertySequences,
    metamorphicChecks,
    sensitivityChecks,
    repairAsymmetry,
    summary: {
      trajectoryCount: goldenTrajectories.length,
      scenarioProjectionCount: goldenTrajectories.reduce((sum, item) => sum + item.scenarios.length, 0),
      passedTrajectories: goldenTrajectories.filter((item) => item.passed).length,
      failedTrajectories: goldenTrajectories.filter((item) => !item.passed).length,
      relevantScenarioResponseRate,
      categoryDecisionCoveragePassed: categoryDecisionCoverage.filter((item) => item.passed).length,
      propertySequencesPassed: propertySequences.filter((item) => item.passed).length,
      metamorphicChecksPassed: metamorphicChecks.filter((item) => item.passed).length,
      sensitivityChecksPassed: sensitivityChecks.filter((item) => item.passed).length,
      totalAssertions,
      passedAssertions,
    },
    failures,
    knownLimitations: [
      "Golden ranges establish internal engineering plausibility; they are not clinical or population validity evidence.",
      "Category coordinate templates are governed by trajectory checks but are not yet independently fitted from observed longitudinal data.",
      "The audit samples deterministic generated sequences; it cannot exhaust every legal event ordering.",
      "Out-of-order historical insertion still requires future event-store replay rather than local retroactive recomputation.",
      "Fatigue is represented by the separate life-simulation energy channel, but CharacterPhysicsState does not yet persist that transient state; fatigue decision response can therefore rely on boundary effects until durable-state schema work lands.",
    ],
    gateVerdict: {
      level: passed ? "PASS" : "FAIL",
      passed,
      reasons: passed
        ? [
            "Registry, 160 trajectories, 640 scenario projections, properties, metamorphic checks, sensitivity, and repair asymmetry passed.",
          ]
        : failures,
    },
    requiredForRelease: true,
  };
}

function auditCategoryDecisionCoverage(
  trajectories: readonly GoldenTrajectoryResult[],
): CategoryDecisionCoverage[] {
  return GOLDEN_EVENT_CATEGORIES.map((category) => {
    const categoryTrajectories = trajectories.filter((trajectory) => (
      trajectory.category === category && trajectory.horizon >= 5
    ));
    const relevant = categoryTrajectories.flatMap((trajectory) => (
      trajectory.scenarios.filter((scenario) => scenario.relevant)
    ));
    const fiveEventScenarios = categoryTrajectories
      .filter((trajectory) => trajectory.horizon === 5)
      .flatMap((trajectory) => (
        relevant.length > 0
          ? trajectory.scenarios.filter((scenario) => scenario.relevant)
          : trajectory.scenarios
      ));
    const responsiveProjectionCount = relevant.filter((projection) => projection.responsive).length;
    const responseRate = relevant.length > 0
      ? round4(responsiveProjectionCount / relevant.length)
      : null;
    const maxFiveEventDistributionDistance = round4(Math.max(
      0,
      ...fiveEventScenarios.map((scenario) => scenario.strategyDistributionDistance),
    ));
    const responseFloorPassed = responseRate === null || responseRate >= 0.5;
    const overreactionGuardPassed = maxFiveEventDistributionDistance <= 1.25;
    const failures: string[] = [];
    if (!responseFloorPassed) {
      failures.push(`relevant response rate ${String(responseRate)} is below 0.5`);
    }
    if (!overreactionGuardPassed) {
      failures.push(
        `five-event strategy distribution distance ${maxFiveEventDistributionDistance} exceeds 1.25`,
      );
    }
    return {
      category,
      relevantProjectionCount: relevant.length,
      responsiveProjectionCount,
      responseRate,
      maxFiveEventDistributionDistance,
      responseFloorPassed,
      overreactionGuardPassed,
      passed: failures.length === 0,
      failures,
    };
  });
}

function auditParameterRegistry(): ModelCalibrationAuditResult["parameterRegistry"] {
  const sets = listModelParameterSets();
  const issues = sets.flatMap((parameterSet) => validateModelParameterSet(parameterSet).issues.map(
    (issue) => `${parameterSet.version}/${issue.path}: ${issue.message}`,
  ));
  const current = getCurrentModelParameterSet();
  const values = flattenNumericParameters(current);
  const descriptors = listModelParameterDescriptors();
  const immutable = sets.every((parameterSet) => (
    Object.isFrozen(parameterSet) &&
    Object.isFrozen(parameterSet.temporal) &&
    Object.isFrozen(parameterSet.memory) &&
    Object.isFrozen(parameterSet.boundary) &&
    Object.isFrozen(parameterSet.boundary.stressWeightByCategory) &&
    Object.isFrozen(parameterSet.personality)
  ));
  const descriptorsImmutable = Object.isFrozen(descriptors) && descriptors.every((descriptor) => (
    Object.isFrozen(descriptor) && Object.isFrozen(descriptor.dependencies)
  ));
  if (!immutable) issues.push("one or more registered parameter sets are mutable");
  if (!descriptorsImmutable) issues.push("parameter governance descriptors are mutable");
  return {
    currentVersion: current.version,
    currentFingerprint: current.fingerprint,
    registeredSetCount: sets.length,
    numericParameterCount: Object.keys(values).length,
    descriptorCount: descriptors.length,
    allSetsValid: issues.length === 0,
    immutable,
    descriptorsImmutable,
    issues,
  };
}

function runGoldenTrajectories(): GoldenTrajectoryResult[] {
  const results: GoldenTrajectoryResult[] = [];
  for (const baseline of GOLDEN_BASELINES) {
    for (const category of GOLDEN_EVENT_CATEGORIES) {
      for (const horizon of GOLDEN_TRAJECTORY_HORIZONS) {
        results.push(runGoldenTrajectory(baseline, category, horizon));
      }
    }
  }
  return results;
}

function runGoldenTrajectory(
  baseline: GoldenBaselineFixture,
  category: EventCategory,
  horizon: GoldenTrajectoryHorizon,
): GoldenTrajectoryResult {
  const before = baseline.createState();
  const state = baseline.createState();
  const engine = new CharacterPhysicsEngine();
  for (let index = 0; index < horizon; index += 1) {
    engine.processEvent(state, buildGoldenEvent(category, index));
  }
  const delta = coordinateDelta(before, state);
  const distance = coordinateDistance(before.coordinate, state.coordinate);
  const integrity = inspectCharacterStateIntegrity(state);
  const expectation = GOLDEN_EVENT_EXPECTATIONS[category];
  const assertions: CalibrationAssertion[] = [
    assertion("state_integrity", "Final state remains structurally valid.", integrity.valid, integrity.errorCount, "0 integrity errors"),
    assertion("memory_count", "Every input remains represented by one memory.", state.memories.length === horizon, state.memories.length, String(horizon)),
    assertion(
      "bounded_distance",
      "A trajectory remains within its horizon-specific movement range.",
      distance <= (horizon === 1 ? expectation.maxSingleStepDistance : expectation.maxLongHorizonDistance),
      distance,
      `<= ${horizon === 1 ? expectation.maxSingleStepDistance : expectation.maxLongHorizonDistance}`,
    ),
    ...expectation.primaryDimensions.map((item) => directionAssertion(
      item.dimension,
      item.direction,
      delta[item.dimension],
      horizon,
      before.coordinate.values[item.dimension],
    )),
  ];
  const scenarios = GOLDEN_SCENARIOS.map((scenario) => projectScenario(
    baseline,
    scenario,
    before,
    state,
    expectation.relevantScenarios.includes(scenario.id),
  ));
  const failures = assertions
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: expected ${item.expected}, got ${String(item.actual)}`);
  return {
    id: `${baseline.id}_${category}_${horizon}`,
    category,
    baselineId: baseline.id,
    horizon,
    parameterSetVersion: state.parameterSetVersion,
    coordinateDelta: delta,
    personalityDistance: distance,
    boundaryStressDelta: round4(state.boundary.stressLoad - before.boundary.stressLoad),
    finalBoundaryStress: round4(state.boundary.stressLoad),
    finalClusterMass: round4([...state.clusters.values()].reduce((sum, cluster) => sum + cluster.mass, 0)),
    memoryCount: state.memories.length,
    assertions,
    scenarios,
    passed: failures.length === 0,
    failures,
  };
}

function projectScenario(
  baseline: GoldenBaselineFixture,
  scenario: GoldenScenarioFixture,
  beforeState: CharacterPhysicsState,
  afterState: CharacterPhysicsState,
  relevant: boolean,
): GoldenScenarioProjection {
  const before = buildDifferentiatedDecision({
    persona: baseline.persona,
    environment: scenario.environment,
    state: beforeState,
  });
  const after = buildDifferentiatedDecision({
    persona: baseline.persona,
    environment: scenario.environment,
    state: afterState,
  });
  const strategyDistributionDistance = decisionDistributionDistance(before, after);
  return {
    scenarioId: scenario.id,
    relevant,
    beforeTopStrategy: before.selectedStrategy.id,
    afterTopStrategy: after.selectedStrategy.id,
    topStrategyChanged: before.selectedStrategy.id !== after.selectedStrategy.id,
    strategyDistributionDistance,
    responsive: strategyDistributionDistance >= 0.0001,
  };
}

function runPropertySequences(): PropertySequenceResult[] {
  return Array.from({ length: 16 }, (_, index) => index + 1).map((seed) => {
    const first = runGeneratedSequence(seed, 30);
    const second = runGeneratedSequence(seed, 30);
    const deterministic = JSON.stringify(serializeCharacterPhysicsState(first)) ===
      JSON.stringify(serializeCharacterPhysicsState(second));
    const integrity = inspectCharacterStateIntegrity(first);
    const allIds = [
      ...first.memories.map((memory) => memory.id),
      ...first.particles.map((particle) => particle.id),
    ];
    const uniqueIds = new Set(allIds).size === allIds.length;
    const finiteCoordinates = BASE_PERSONALITY_KEYS.every((key) => (
      Number.isFinite(first.coordinate.values[key]) &&
      first.coordinate.values[key] >= 0 &&
      first.coordinate.values[key] <= 1
    ));
    const failures: string[] = [];
    if (!deterministic) failures.push("replay was not byte-identical");
    if (!integrity.valid) failures.push(`state integrity reported ${integrity.errorCount} errors`);
    if (!uniqueIds) failures.push("memory or particle IDs were duplicated");
    if (!finiteCoordinates) failures.push("coordinate escaped finite [0,1] bounds");
    return {
      seed,
      eventCount: 30,
      deterministic,
      integrityValid: integrity.valid,
      uniqueIds,
      finiteCoordinates,
      passed: failures.length === 0,
      failures,
    };
  });
}

function runGeneratedSequence(seed: number, eventCount: number): CharacterPhysicsState {
  const random = seededRandom(seed);
  const baseline = GOLDEN_BASELINES[Math.floor(random() * GOLDEN_BASELINES.length)] ?? GOLDEN_BASELINES[0]!;
  const state = baseline.createState();
  const engine = new CharacterPhysicsEngine();
  let elapsedDays = 0;
  for (let index = 0; index < eventCount; index += 1) {
    const category = GOLDEN_EVENT_CATEGORIES[Math.floor(random() * GOLDEN_EVENT_CATEGORIES.length)] ?? "general";
    elapsedDays += Math.floor(random() * 15);
    const event = buildGoldenEvent(category, index, { spacingDays: 0 });
    engine.processEvent(state, {
      ...event,
      occurredAt: addDays("2026-01-01T00:00:00.000Z", elapsedDays),
      intensity: round4(Math.max(0.02, Math.min(1, event.intensity * (0.75 + random() * 0.5)))),
      importance: round4(Math.max(0.02, Math.min(1, event.importance * (0.75 + random() * 0.5)))),
    });
  }
  return state;
}

function runMetamorphicChecks(): MetamorphicResult[] {
  return [
    metamorphicIrrelevantWording(),
    metamorphicTagOrder(),
    metamorphicCategoryDirection(),
    metamorphicTimingMagnitude(),
    metamorphicBaselineDifferentiation(),
  ];
}

function metamorphicIrrelevantWording(): MetamorphicResult {
  const left = GOLDEN_BASELINES[1]!.createState();
  const right = GOLDEN_BASELINES[1]!.createState();
  const engine = new CharacterPhysicsEngine();
  const first = buildGoldenEvent("failure", 0);
  const second = buildGoldenEvent("failure", 0, { wordingSuffix: " It happened in a blue room." });
  engine.processEvent(left, first);
  engine.processEvent(right, second);
  const distance = coordinateDistance(left.coordinate, right.coordinate);
  const boundaryDifference = Math.abs(left.boundary.stressLoad - right.boundary.stressLoad);
  return metamorphicResult(
    "irrelevant_wording",
    "Irrelevant location wording cannot change physics when structured event fields are unchanged.",
    { coordinateDistance: distance, boundaryDifference: round4(boundaryDifference) },
    distance === 0 && boundaryDifference === 0,
    "structured physics changed after an irrelevant wording suffix",
  );
}

function metamorphicTagOrder(): MetamorphicResult {
  const left = GOLDEN_BASELINES[0]!.createState();
  const right = GOLDEN_BASELINES[0]!.createState();
  const engine = new CharacterPhysicsEngine();
  const event = buildGoldenEvent("uncertainty", 0);
  engine.processEvent(left, { ...event, tags: ["uncertainty", "golden-calibration", "context"] });
  engine.processEvent(right, { ...event, tags: ["context", "golden-calibration", "uncertainty"] });
  const distance = coordinateDistance(left.coordinate, right.coordinate);
  return metamorphicResult(
    "tag_order",
    "Tag ordering cannot alter physical output.",
    { coordinateDistance: distance },
    distance === 0 && left.boundary.stressLoad === right.boundary.stressLoad,
    "tag order altered state metrics",
  );
}

function metamorphicCategoryDirection(): MetamorphicResult {
  const baseline = GOLDEN_BASELINES[1]!;
  const negative = baseline.createState();
  const positive = baseline.createState();
  const trustBefore = negative.coordinate.values.trust;
  const engine = new CharacterPhysicsEngine();
  engine.processEvent(negative, buildGoldenEvent("abandonment", 0));
  engine.processEvent(positive, buildGoldenEvent("support", 0));
  const negativeDelta = negative.coordinate.values.trust - trustBefore;
  const positiveDelta = positive.coordinate.values.trust - trustBefore;
  return metamorphicResult(
    "category_direction",
    "Changing negative attachment evidence to support must separate trust direction.",
    { negativeTrustDelta: round4(negativeDelta), positiveTrustDelta: round4(positiveDelta) },
    negativeDelta < 0 && positiveDelta > negativeDelta,
    "support and abandonment did not create distinct trust directions",
  );
}

function metamorphicTimingMagnitude(): MetamorphicResult {
  const dense = GOLDEN_BASELINES[2]!.createState();
  const spaced = GOLDEN_BASELINES[2]!.createState();
  const denseEngine = new CharacterPhysicsEngine();
  const spacedEngine = new CharacterPhysicsEngine();
  let denseDose = 0;
  let spacedDose = 0;
  for (let index = 0; index < 5; index += 1) {
    denseDose += denseEngine.processEvent(dense, buildGoldenEvent("failure", index, { spacingDays: 0 })).impactScore.value;
    spacedDose += spacedEngine.processEvent(spaced, buildGoldenEvent("failure", index, { spacingDays: 7 })).impactScore.value;
  }
  const denseFearDelta = dense.coordinate.values.fear - GOLDEN_BASELINES[2]!.createState().coordinate.values.fear;
  const spacedFearDelta = spaced.coordinate.values.fear - GOLDEN_BASELINES[2]!.createState().coordinate.values.fear;
  return metamorphicResult(
    "timing_magnitude",
    "Concentration changes dose magnitude but must not reverse the category direction.",
    { denseDose: round4(denseDose), spacedDose: round4(spacedDose), denseFearDelta: round4(denseFearDelta), spacedFearDelta: round4(spacedFearDelta) },
    denseDose < spacedDose && denseFearDelta >= 0 && spacedFearDelta >= 0,
    "timing either failed to saturate dose or reversed fear direction",
  );
}

function metamorphicBaselineDifferentiation(): MetamorphicResult {
  const secureBefore = GOLDEN_BASELINES[0]!.createState();
  const secure = GOLDEN_BASELINES[0]!.createState();
  const sensitiveBefore = GOLDEN_BASELINES[1]!.createState();
  const sensitive = GOLDEN_BASELINES[1]!.createState();
  const engine = new CharacterPhysicsEngine();
  for (let index = 0; index < 5; index += 1) {
    engine.processEvent(secure, buildGoldenEvent("abandonment", index));
    engine.processEvent(sensitive, buildGoldenEvent("abandonment", index));
  }
  const secureDistance = coordinateDistance(secureBefore.coordinate, secure.coordinate);
  const sensitiveDistance = coordinateDistance(sensitiveBefore.coordinate, sensitive.coordinate);
  return metamorphicResult(
    "baseline_differentiation",
    "The same event sequence must retain measurable baseline differentiation.",
    { secureDistance, sensitiveDistance, ratio: round4(sensitiveDistance / Math.max(secureDistance, 0.000001)) },
    Math.abs(sensitiveDistance - secureDistance) >= 0.001,
    "secure and sensitive baselines produced indistinguishable movement",
  );
}

function runSensitivityChecks(): SensitivityResult[] {
  const probes: Array<{
    path: ModelParameterPath;
    monotonicity: SensitivityResult["expectedMonotonicity"];
    overrides: (value: number) => ModelParameterOverrides;
    run: (parameterSet: ModelParameterSet) => { metric: number; direction: number };
  }> = [
    {
      path: "temporal.repeatDensityPressureWeight",
      monotonicity: "decreasing",
      overrides: (value) => ({ temporal: { repeatDensityPressureWeight: value } }),
      run: (set) => densityProbe(set),
    },
    {
      path: "temporal.personalityVelocityHalfLifeDays",
      monotonicity: "increasing",
      overrides: (value) => ({ temporal: { personalityVelocityHalfLifeDays: value } }),
      run: (set) => velocityProbe(set),
    },
    {
      path: "memory.recencyFloor",
      monotonicity: "increasing",
      overrides: (value) => ({ memory: { recencyFloor: value, recencyDynamicWeight: 1 - value } }),
      run: (set) => recencyFloorProbe(set),
    },
    {
      path: "memory.defaultDecayRate",
      monotonicity: "decreasing",
      overrides: (value) => ({ memory: { defaultDecayRate: value } }),
      run: (set) => memoryDecayProbe(set),
    },
    {
      path: "boundary.positiveSafetyImpactScale",
      monotonicity: "increasing",
      overrides: (value) => ({ boundary: { positiveSafetyImpactScale: value } }),
      run: (set) => positiveBoundaryProbe(set),
    },
    {
      path: "boundary.negativeStressBase",
      monotonicity: "increasing",
      overrides: (value) => ({ boundary: { negativeStressBase: value } }),
      run: (set) => negativeBoundaryProbe(set),
    },
    {
      path: "personality.standardLearningBase",
      monotonicity: "increasing",
      overrides: (value) => ({ personality: { standardLearningBase: value } }),
      run: (set) => learningRateProbe(set),
    },
  ];
  const base = getCurrentModelParameterSet();
  const flat = flattenNumericParameters(base);
  return probes.map((probe) => {
    const baselineValue = flat[probe.path];
    if (baselineValue === undefined) {
      throw new Error(`Sensitivity probe references unknown parameter: ${probe.path}`);
    }
    const lowerParameterValue = round8(baselineValue * 0.9);
    const upperParameterValue = round8(baselineValue * 1.1);
    const lowerSet = createModelParameterVariant({
      base,
      version: `${base.version}+${probe.path}-10pct`,
      changeReason: `Sensitivity lower bound for ${probe.path}`,
      overrides: probe.overrides(lowerParameterValue),
    });
    const upperSet = createModelParameterVariant({
      base,
      version: `${base.version}+${probe.path}+10pct`,
      changeReason: `Sensitivity upper bound for ${probe.path}`,
      overrides: probe.overrides(upperParameterValue),
    });
    const lower = probe.run(lowerSet);
    const baseline = probe.run(base);
    const upper = probe.run(upperSet);
    const tolerance = 0.0001;
    const monotonic = probe.monotonicity === "increasing"
      ? lower.metric <= baseline.metric + tolerance && baseline.metric <= upper.metric + tolerance
      : lower.metric + tolerance >= baseline.metric && baseline.metric + tolerance >= upper.metric;
    const directionStable = [lower.direction, baseline.direction, upper.direction].every((value) => value >= -tolerance);
    const normalizedSpread = round4(
      Math.abs(upper.metric - lower.metric) / Math.max(Math.abs(baseline.metric), 0.01),
    );
    const failures: string[] = [];
    if (!monotonic) failures.push(`expected ${probe.monotonicity} metric under +/-10% perturbation`);
    if (!directionStable) failures.push("semantic event direction reversed under perturbation");
    if (normalizedSpread > 1.5) failures.push(`normalized spread ${normalizedSpread} exceeds 1.5`);
    return {
      parameterPath: probe.path,
      probe: probe.path,
      baselineValue,
      lowerParameterValue,
      upperParameterValue,
      lowerMetric: round4(lower.metric),
      baselineMetric: round4(baseline.metric),
      upperMetric: round4(upper.metric),
      expectedMonotonicity: probe.monotonicity,
      monotonic,
      directionStable,
      normalizedSpread,
      passed: failures.length === 0,
      failures,
    };
  });
}

function densityProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const baseline = variantState(GOLDEN_BASELINES[1]!, parameterSet);
  const initialTrust = baseline.coordinate.values.trust;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  let dose = 0;
  for (let index = 0; index < 5; index += 1) {
    dose += engine.processEvent(baseline, buildGoldenEvent("abandonment", index, { spacingDays: 0 })).impactScore.value;
  }
  return { metric: dose, direction: initialTrust - baseline.coordinate.values.trust };
}

function velocityProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const state = variantState(GOLDEN_BASELINES[2]!, parameterSet);
  const initialFear = state.coordinate.values.fear;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  engine.processEvent(state, buildGoldenEvent("failure", 0));
  const step = engine.processEvent(state, buildGoldenEvent("failure", 1, { spacingDays: 14 }));
  return { metric: step.temporalSemantics.recovery.velocityRetention, direction: state.coordinate.values.fear - initialFear };
}

function recencyFloorProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const state = variantState(GOLDEN_BASELINES[1]!, parameterSet);
  const initialTrust = state.coordinate.values.trust;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  engine.processEvent(state, buildGoldenEvent("abandonment", 0));
  engine.processEvent(state, buildGoldenEvent("abandonment", 1, { spacingDays: 30 }));
  return {
    metric: [...state.clusters.values()].reduce((sum, cluster) => sum + cluster.mass, 0),
    direction: initialTrust - state.coordinate.values.trust,
  };
}

function memoryDecayProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const state = variantState(GOLDEN_BASELINES[2]!, parameterSet);
  const initialFear = state.coordinate.values.fear;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  engine.processEvent(state, buildGoldenEvent("failure", 0));
  engine.processEvent(state, buildGoldenEvent("failure", 1, { spacingDays: 30 }));
  return { metric: state.memories[0]?.recency ?? 0, direction: state.coordinate.values.fear - initialFear };
}

function positiveBoundaryProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const state = variantState(GOLDEN_BASELINES[1]!, parameterSet);
  state.boundary = { ...state.boundary, stressLoad: 0.48, phase: "strained" };
  const initialStress = state.boundary.stressLoad;
  const initialTrust = state.coordinate.values.trust;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  engine.processEvent(state, buildGoldenEvent("support", 0));
  return {
    metric: initialStress - state.boundary.stressLoad,
    direction: state.coordinate.values.trust - initialTrust,
  };
}

function negativeBoundaryProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const state = variantState(GOLDEN_BASELINES[2]!, parameterSet);
  const initialStress = state.boundary.stressLoad;
  const initialControl = state.coordinate.values.control;
  const engine = new CharacterPhysicsEngine({ parameterSet });
  engine.processEvent(state, buildGoldenEvent("conflict", 0));
  return {
    metric: state.boundary.stressLoad - initialStress,
    direction: state.coordinate.values.control - initialControl,
  };
}

function learningRateProbe(parameterSet: ModelParameterSet): { metric: number; direction: number } {
  const before = variantState(GOLDEN_BASELINES[1]!, parameterSet);
  const state = variantState(GOLDEN_BASELINES[1]!, parameterSet);
  const engine = new CharacterPhysicsEngine({ parameterSet });
  for (let index = 0; index < 5; index += 1) engine.processEvent(state, buildGoldenEvent("abandonment", index));
  return {
    metric: coordinateDistance(before.coordinate, state.coordinate),
    direction: before.coordinate.values.trust - state.coordinate.values.trust,
  };
}

function runRepairAsymmetry(): RepairAsymmetryResult {
  const state = GOLDEN_BASELINES[1]!.createState();
  const engine = new CharacterPhysicsEngine();
  const trustBefore = state.coordinate.values.trust;
  for (let index = 0; index < 20; index += 1) engine.processEvent(state, buildGoldenEvent("abandonment", index));
  const trustAfterDamage = state.coordinate.values.trust;
  for (let index = 0; index < 20; index += 1) {
    engine.processEvent(state, buildGoldenEvent("support", index, { startAt: "2026-06-01T00:00:00.000Z" }));
  }
  const trustAfterRepair = state.coordinate.values.trust;
  const damage = Math.max(0, trustBefore - trustAfterDamage);
  const repair = Math.max(0, trustAfterRepair - trustAfterDamage);
  const scarRetentionRatio = damage > 0 ? clamp01((trustBefore - trustAfterRepair) / damage) : 0;
  const assertions = [
    assertion("damage_visible", "Repeated abandonment creates visible trust damage.", damage >= 0.005, round4(damage), ">= 0.005"),
    assertion("repair_visible", "Repeated support repairs some trust.", repair >= 0.005, round4(repair), ">= 0.005"),
    assertion("repair_not_instant_erase", "Equal-count support does not erase all history without a scar.", scarRetentionRatio >= 0.05, round4(scarRetentionRatio), ">= 0.05"),
    assertion("repair_not_frozen", "Repair can recover a meaningful fraction of damage.", scarRetentionRatio <= 0.95, round4(scarRetentionRatio), "<= 0.95"),
  ];
  const failures = assertions.filter((item) => !item.passed).map(
    (item) => `${item.id}: expected ${item.expected}, got ${String(item.actual)}`,
  );
  return {
    damage: round4(damage),
    repair: round4(repair),
    scarRetentionRatio: round4(scarRetentionRatio),
    trustBefore: round4(trustBefore),
    trustAfterDamage: round4(trustAfterDamage),
    trustAfterRepair: round4(trustAfterRepair),
    assertions,
    passed: failures.length === 0,
    failures,
  };
}

function variantState(baseline: GoldenBaselineFixture, parameterSet: ModelParameterSet): CharacterPhysicsState {
  const base = baseline.createState();
  return createCharacterPhysicsState({
    identity: base.identity,
    coordinate: { values: { ...base.coordinate.values } },
    metaState: { ...base.metaState },
    boundary: { ...base.boundary },
    biologicalNature: { ...base.biologicalNature },
    parameterSet,
    parameterSetVersion: parameterSet.version,
  });
}

function directionAssertion(
  dimension: PersonalityDimensionKey,
  direction: "increase" | "decrease" | "minimal",
  delta: number,
  horizon: GoldenTrajectoryHorizon,
  baselineValue: number,
): CalibrationAssertion {
  const tolerance = direction === "minimal"
    ? (horizon === 100 ? 0.08 : horizon === 20 ? 0.04 : 0.02)
    : 0.003;
  let passed: boolean;
  let expected: string;
  if (direction === "minimal") {
    passed = Math.abs(delta) <= tolerance;
    expected = `abs(delta) <= ${tolerance}`;
  } else if (direction === "increase") {
    const strictSignalRequired = horizon >= 5 && baselineValue < 0.995;
    passed = delta >= -tolerance && (!strictSignalRequired || delta > 0.0001);
    expected = strictSignalRequired ? "> 0.0001" : `>= ${-tolerance}`;
  } else {
    const strictSignalRequired = horizon >= 5 && baselineValue > 0.005;
    passed = delta <= tolerance && (!strictSignalRequired || delta < -0.0001);
    expected = strictSignalRequired ? "< -0.0001" : `<= ${tolerance}`;
  }
  return assertion(
    `direction_${dimension}`,
    `${dimension} follows the expected ${direction} band.`,
    passed,
    round4(delta),
    expected,
  );
}

function decisionDistributionDistance(before: DifferentiatedDecision, after: DifferentiatedDecision): number {
  const normalize = (decision: DifferentiatedDecision) => {
    const total = decision.strategies.reduce((sum, strategy) => sum + strategy.intensity, 0) || 1;
    return new Map(decision.strategies.map((strategy) => [strategy.id, strategy.intensity / total]));
  };
  const left = normalize(before);
  const right = normalize(after);
  const ids = new Set([...left.keys(), ...right.keys()]);
  return round4([...ids].reduce((sum, id) => sum + Math.abs((left.get(id) ?? 0) - (right.get(id) ?? 0)), 0));
}

function coordinateDelta(
  before: CharacterPhysicsState,
  after: CharacterPhysicsState,
): Record<PersonalityDimensionKey, number> {
  const beforeValues = coordinateToRecord(before.coordinate);
  const afterValues = coordinateToRecord(after.coordinate);
  return Object.fromEntries(BASE_PERSONALITY_KEYS.map((key) => [
    key,
    round4(afterValues[key] - beforeValues[key]),
  ])) as Record<PersonalityDimensionKey, number>;
}

function assertion(
  id: string,
  description: string,
  passed: boolean,
  actual: number | string | boolean,
  expected: string,
): CalibrationAssertion {
  return { id, description, passed, actual, expected };
}

function metamorphicResult(
  id: string,
  description: string,
  metrics: Record<string, number | string | boolean>,
  passed: boolean,
  failure: string,
): MetamorphicResult {
  return { id, description, metrics, passed, failures: passed ? [] : [failure] };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round8(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
