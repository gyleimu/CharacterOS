import { CharacterPhysicsEngine, createCharacterPhysicsState, type CharacterPhysicsState } from "../physics/physicsEngine";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../physics/serialization";
import { parseExperienceEvent, type ParseExperienceEventInput, type ParsedExperienceEvent } from "../event/eventParser";
import { coordinateToRecord, type PersonalityCoordinateValues } from "../personality/coordinate";
import { buildDifferentiatedDecisionForState } from "../differentiation/differentiationAdapter";
import type { EnvironmentSeed } from "../differentiation/characterDifferentiation";
import { buildDecisionInfluenceLayer, type DecisionInfluenceLayerResult } from "../differentiation/decisionInfluenceLayer";
import type { PhysicsStepResult } from "../physics/physicsEngine";
import type { RealityAuditScalarDelta, RealityAuditTextDelta } from "./realityAudit";

export type AccumulationVerdictLevel = "PASS" | "WARN" | "FAIL";

export interface AccumulationStepResult {
  stepIndex: number;
  event: ParsedExperienceEvent;
  physicsStep: PhysicsStepResult;
  cumulativePersonalityDistance: number;
  cumulativeTrust: number;
  cumulativeFear: number;
  cumulativeNeuroticism: number;
  cumulativeBoundaryStressLoad: number;
  cumulativeBoundaryIntegrity: number;
  cumulativeMemoryCount: number;
  cumulativeBeliefCount: number;
  decisionInfluence: DecisionInfluenceLayerResult;
}

export interface AccumulationCurve {
  personalityDistance: number[];
  trust: number[];
  fear: number[];
  neuroticism: number[];
  boundaryStressLoad: number[];
  boundaryIntegrity: number[];
}

export interface LongTermAccumulationAuditInput {
  baselineState: CharacterPhysicsState;
  eventSequence: ParseExperienceEventInput[];
  followUpDecisionScenario: EnvironmentSeed;
  label?: string;
  expectedTrend?: {
    trust?: "increasing" | "decreasing" | "stable";
    fear?: "increasing" | "decreasing" | "stable";
    boundaryStress?: "increasing" | "decreasing" | "stable";
    personalityDistance?: "growing" | "stable" | "shrinking";
  };
  maxStepOnePersonalityRatio?: number;
  minSaturationRatio?: number;
  maxNeutralPersonalityDistance?: number;
}

export interface LongTermAccumulationAuditResult {
  label: string;
  stepCount: number;
  baselineState: PersonalitySnapshot;
  finalState: PersonalitySnapshot;
  stepResults: AccumulationStepResult[];
  accumulationCurve: AccumulationCurve;
  marginalDeltaByStep: number[];
  saturationMetrics: {
    personalitySaturationRatio: number;
    boundarySaturationRatio: number;
    trustSaturationRatio: number;
    fearSaturationRatio: number;
  };
  saturationScore: number;
  repairEffectivenessScore: number;
  stepOneJumpRatios: {
    personality: number;
    boundary: number;
    trust: number;
    fear: number;
  };
  accumulationVerdict: {
    level: AccumulationVerdictLevel;
    passed: boolean;
    warnings: string[];
    failures: string[];
    reasons: string[];
  };
}

interface PersonalitySnapshot {
  coordinate: PersonalityCoordinateValues;
  boundaryStressLoad: number;
  boundaryIntegrity: number;
  boundaryPhase: string;
  memoryCount: number;
  beliefCount: number;
}

export function runLongTermAccumulationAudit(
  input: LongTermAccumulationAuditInput,
): LongTermAccumulationAuditResult {
  const maxStepOnePersonalityRatio = input.maxStepOnePersonalityRatio ?? 0.55;
  const minSaturationRatio = input.minSaturationRatio ?? 0.08;
  const maxNeutralPersonalityDistance = input.maxNeutralPersonalityDistance ?? 0.04;

  const engine = new CharacterPhysicsEngine();
  let state = cloneState(input.baselineState);
  const baselineSnapshot = snapshotState(state);
  const stepResults: AccumulationStepResult[] = [];

  const curve: AccumulationCurve = {
    personalityDistance: [],
    trust: [],
    fear: [],
    neuroticism: [],
    boundaryStressLoad: [],
    boundaryIntegrity: [],
  };

  for (let i = 0; i < input.eventSequence.length; i++) {
    const parsed = parseExperienceEvent(input.eventSequence[i]!);
    const physicsStep = engine.processEvent(state, parsed);
    const decisionBefore = buildDifferentiatedDecisionForState(
      deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state))),
      { environment: input.followUpDecisionScenario },
    );
    // Re-derive to get correct "before" state
    const afterClone = cloneState(state);
    const decisionAfter = buildDifferentiatedDecisionForState(afterClone, {
      environment: input.followUpDecisionScenario,
    });

    const baselineCoord = baselineSnapshot.coordinate;
    const currentCoord = coordinateToRecord(state.coordinate);
    const trustBaseline = baselineCoord.trust;
    const fearBaseline = baselineCoord.fear;
    const neuroticismBaseline = baselineCoord.neuroticism;

    const diffCoord = (current: number, baseline: number) => round4(current - baseline);

    const decisionInfluence = buildDecisionInfluenceLayer({
      beforeDecision: decisionBefore,
      afterDecision: decisionAfter,
      memoryDelta: [{ id: `step_${i}_memory`, after: parsed.description, delta: "added" as const }],
      beliefDelta: [],
      personalityDelta: Object.entries(currentCoord)
        .filter(([k]) => Math.abs(currentCoord[k as keyof PersonalityCoordinateValues] - baselineCoord[k as keyof PersonalityCoordinateValues]) > 0.0001)
        .map(([k]) => ({
          id: k,
          before: baselineCoord[k as keyof PersonalityCoordinateValues],
          after: currentCoord[k as keyof PersonalityCoordinateValues],
          delta: diffCoord(currentCoord[k as keyof PersonalityCoordinateValues], baselineCoord[k as keyof PersonalityCoordinateValues]),
        })),
      needDelta: [],
      desireDelta: [],
      boundaryDelta: [
        {
          id: "boundaryStressLoad",
          before: round4(baselineSnapshot.boundaryStressLoad),
          after: round4(state.boundary.stressLoad),
          delta: round4(state.boundary.stressLoad - baselineSnapshot.boundaryStressLoad),
        },
      ],
      emotionDelta: {
        primary: physicsStep.emotion.primary,
        valence: round4(physicsStep.emotion.valence),
        arousal: round4(physicsStep.emotion.arousal),
        intensity: round4(physicsStep.emotion.intensity),
        deltaIntensity: round4(physicsStep.emotion.intensity),
      },
      followUpScenario: input.followUpDecisionScenario,
    });

    const personalityDistance = personalityDist(baselineCoord, currentCoord);

    stepResults.push({
      stepIndex: i,
      event: parsed,
      physicsStep,
      cumulativePersonalityDistance: personalityDistance,
      cumulativeTrust: diffCoord(currentCoord.trust, trustBaseline),
      cumulativeFear: diffCoord(currentCoord.fear, fearBaseline),
      cumulativeNeuroticism: diffCoord(currentCoord.neuroticism, neuroticismBaseline),
      cumulativeBoundaryStressLoad: round4(state.boundary.stressLoad - baselineSnapshot.boundaryStressLoad),
      cumulativeBoundaryIntegrity: round4(state.boundary.integrity - baselineSnapshot.boundaryIntegrity),
      cumulativeMemoryCount: state.memories.length - baselineSnapshot.memoryCount,
      cumulativeBeliefCount: state.beliefStates.length - baselineSnapshot.beliefCount,
      decisionInfluence,
    });

    curve.personalityDistance.push(personalityDistance);
    curve.trust.push(currentCoord.trust);
    curve.fear.push(currentCoord.fear);
    curve.neuroticism.push(currentCoord.neuroticism);
    curve.boundaryStressLoad.push(state.boundary.stressLoad);
    curve.boundaryIntegrity.push(state.boundary.integrity);
  }

  const finalSnapshot = snapshotState(state);

  // Saturation metrics: compare last step delta to total accumulated
  const n = stepResults.length;
  const saturationMetrics = computeSaturationMetrics(stepResults, n);

  // Step-1 jump ratios
  const stepOneJumpRatios = computeStepOneJumpRatios(stepResults);

  // Build verdict
  const verdict = buildAccumulationVerdict({
    input,
    stepResults,
    curve,
    saturationMetrics,
    stepOneJumpRatios,
    maxStepOnePersonalityRatio,
    minSaturationRatio,
    maxNeutralPersonalityDistance,
  });

  // V10.72: compute marginal deltas (per-step personality distance increments)
  const marginalDeltaByStep: number[] = [];
  for (let i = 0; i < curve.personalityDistance.length; i++) {
    const prev = i > 0 ? curve.personalityDistance[i - 1]! : 0;
    marginalDeltaByStep.push(round4(curve.personalityDistance[i]! - prev));
  }

  // V10.72: composite saturation score (0=no saturation, 1=fully saturated)
  const saturationScore = computeSaturationScore(saturationMetrics, stepResults);

  // V10.72: repair effectiveness — trust gain per positive event
  const repairEffectivenessScore = computeRepairEffectiveness(stepResults, input);

  return {
    label: input.label ?? "Long-Term Accumulation Audit",
    stepCount: stepResults.length,
    baselineState: baselineSnapshot,
    finalState: finalSnapshot,
    stepResults,
    accumulationCurve: curve,
    marginalDeltaByStep,
    saturationMetrics,
    saturationScore,
    repairEffectivenessScore,
    stepOneJumpRatios,
    accumulationVerdict: verdict,
  };
}

function computeSaturationMetrics(
  stepResults: AccumulationStepResult[],
  n: number,
): LongTermAccumulationAuditResult["saturationMetrics"] {
  if (n < 2) {
    return {
      personalitySaturationRatio: 1,
      boundarySaturationRatio: 1,
      trustSaturationRatio: 1,
      fearSaturationRatio: 1,
    };
  }

  const last = stepResults[n - 1]!;
  const prev = stepResults[n - 2]!;

  const personalityTotal = Math.abs(last.cumulativePersonalityDistance);
  const personalityLastStep = Math.abs(last.cumulativePersonalityDistance - prev.cumulativePersonalityDistance);

  const boundaryTotal = Math.abs(last.cumulativeBoundaryStressLoad);
  const boundaryLastStep = Math.abs(last.cumulativeBoundaryStressLoad - prev.cumulativeBoundaryStressLoad);

  const trustTotal = Math.abs(last.cumulativeTrust);
  const trustLastStep = Math.abs(last.cumulativeTrust - prev.cumulativeTrust);

  const fearTotal = Math.abs(last.cumulativeFear);
  const fearLastStep = Math.abs(last.cumulativeFear - prev.cumulativeFear);

  return {
    personalitySaturationRatio: round4(personalityTotal > 0.0001 ? personalityLastStep / personalityTotal : 0),
    boundarySaturationRatio: round4(boundaryTotal > 0.0001 ? boundaryLastStep / boundaryTotal : 0),
    trustSaturationRatio: round4(trustTotal > 0.0001 ? trustLastStep / trustTotal : 0),
    fearSaturationRatio: round4(fearTotal > 0.0001 ? fearLastStep / fearTotal : 0),
  };
}

function computeStepOneJumpRatios(
  stepResults: AccumulationStepResult[],
): LongTermAccumulationAuditResult["stepOneJumpRatios"] {
  const n = stepResults.length;
  if (n < 1) return { personality: 0, boundary: 0, trust: 0, fear: 0 };

  const first = stepResults[0]!;
  const last = stepResults[n - 1]!;

  const ratio = (firstVal: number, totalVal: number) =>
    round4(Math.abs(totalVal) > 0.0001 ? Math.abs(firstVal) / Math.abs(totalVal) : 0);

  return {
    personality: ratio(first.cumulativePersonalityDistance, last.cumulativePersonalityDistance),
    boundary: ratio(first.cumulativeBoundaryStressLoad, last.cumulativeBoundaryStressLoad),
    trust: ratio(first.cumulativeTrust, last.cumulativeTrust),
    fear: ratio(first.cumulativeFear, last.cumulativeFear),
  };
}

function buildAccumulationVerdict(params: {
  input: LongTermAccumulationAuditInput;
  stepResults: AccumulationStepResult[];
  curve: AccumulationCurve;
  saturationMetrics: LongTermAccumulationAuditResult["saturationMetrics"];
  stepOneJumpRatios: LongTermAccumulationAuditResult["stepOneJumpRatios"];
  maxStepOnePersonalityRatio: number;
  minSaturationRatio: number;
  maxNeutralPersonalityDistance: number;
}): LongTermAccumulationAuditResult["accumulationVerdict"] {
  const warnings: string[] = [];
  const failures: string[] = [];
  const reasons: string[] = [];
  const { input, stepResults, curve, saturationMetrics, stepOneJumpRatios } = params;

  if (stepResults.length < 2) {
    warnings.push("fewer than 2 steps — accumulation pattern cannot be assessed");
    return { level: "WARN", passed: true, warnings, failures, reasons: [] };
  }

  // --- Check 1: Step-1 overjump — personality slow channel must not jump too much on first event ---
  if (stepOneJumpRatios.personality > params.maxStepOnePersonalityRatio) {
    warnings.push(
      `step-1 personality jump ratio ${stepOneJumpRatios.personality.toFixed(4)} > ${params.maxStepOnePersonalityRatio} — slow channel overreacted on first event`,
    );
  } else {
    reasons.push(`step-1 personality jump ratio ${stepOneJumpRatios.personality.toFixed(4)} ≤ ${params.maxStepOnePersonalityRatio}`);
  }

  // --- Check 2: Saturation — later steps should have diminishing returns ---
  if (
    params.saturationMetrics.personalitySaturationRatio < params.minSaturationRatio &&
    Math.abs(stepResults[stepResults.length - 1]!.cumulativePersonalityDistance) > 0.005
  ) {
    reasons.push(`personality accumulation shows saturation (last-step/total = ${params.saturationMetrics.personalitySaturationRatio.toFixed(4)})`);
  } else if (params.saturationMetrics.personalitySaturationRatio > 0.6 && stepResults.length >= 4) {
    warnings.push(
      `personality accumulation may not be saturating (last-step/total = ${params.saturationMetrics.personalitySaturationRatio.toFixed(4)}) — check for linear growth`,
    );
  }

  // --- Check 3: Expected trend direction ---
  const expected = input.expectedTrend ?? {};
  if (expected.trust === "decreasing") {
    const monotonic = isMostlyMonotonic(curve.trust, "decreasing");
    if (!monotonic) warnings.push("trust did not show expected decreasing trend across repeated events");
    else reasons.push("trust shows decreasing trend across repeated events");
  }
  if (expected.trust === "increasing") {
    const monotonic = isMostlyMonotonic(curve.trust, "increasing");
    if (!monotonic) warnings.push("trust did not show expected increasing trend across repeated events");
    else reasons.push("trust shows increasing trend across repeated events");
  }
  if (expected.fear === "increasing") {
    const monotonic = isMostlyMonotonic(curve.fear, "increasing");
    if (!monotonic) warnings.push("fear did not show expected increasing trend across repeated events");
    else reasons.push("fear shows increasing trend across repeated events");
  }
  if (expected.fear === "decreasing") {
    const monotonic = isMostlyMonotonic(curve.fear, "decreasing");
    if (!monotonic) warnings.push("fear did not show expected decreasing trend across repeated events");
    else reasons.push("fear shows decreasing trend across repeated events");
  }
  if (expected.personalityDistance === "stable") {
    const finalDist = curve.personalityDistance[curve.personalityDistance.length - 1] ?? 0;
    if (finalDist > params.maxNeutralPersonalityDistance) {
      warnings.push(
        `neutral events accumulated significant personality drift: ${finalDist.toFixed(4)} > ${params.maxNeutralPersonalityDistance}`,
      );
    } else {
      reasons.push(`neutral events kept personality stable: distance ${finalDist.toFixed(4)} ≤ ${params.maxNeutralPersonalityDistance}`);
    }
  }
  if (expected.personalityDistance === "growing") {
    const growing = isMostlyMonotonic(curve.personalityDistance, "increasing");
    if (!growing) {
      warnings.push("personality distance did not grow monotonically across repeated events");
    } else {
      reasons.push("personality distance grows across repeated events");
    }
  }

  // --- Check 4: Linear unbounded growth detection ---
  if (curve.personalityDistance.length >= 3) {
    const dists = curve.personalityDistance;
    const deltas: number[] = [];
    for (let i = 1; i < dists.length; i++) {
      deltas.push(dists[i]! - dists[i - 1]!);
    }
    // Check if last 2 deltas are still large (not diminishing)
    const recentDeltas = deltas.slice(-2);
    const earlyDeltas = deltas.slice(0, 2);
    if (recentDeltas.length >= 2 && earlyDeltas.length >= 2) {
      const recentAvg = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;
      const earlyAvg = earlyDeltas.reduce((a, b) => a + b, 0) / earlyDeltas.length;
      if (recentAvg > earlyAvg * 0.9 && earlyAvg > 0.002 && dists[dists.length - 1]! > 0.04) {
        warnings.push(
          `personality accumulation shows near-linear growth with no saturation (early-avg=${earlyAvg.toFixed(4)}, recent-avg=${recentAvg.toFixed(4)})`,
        );
      }
    }
  }

  // --- Check 5: Decision surface should shift progressively ---
  const firstInfluence = stepResults[0]?.decisionInfluence;
  const lastInfluence = stepResults[stepResults.length - 1]?.decisionInfluence;
  if (firstInfluence && lastInfluence) {
    const firstW = firstInfluence.decisionInfluenceVector.withdrawal || 0;
    const lastW = lastInfluence.decisionInfluenceVector.withdrawal || 0;
    const firstO = firstInfluence.decisionInfluenceVector.openness || 0;
    const lastO = lastInfluence.decisionInfluenceVector.openness || 0;

    if (expected.trust === "decreasing" && lastW <= firstW && firstW > 0.01) {
      warnings.push("decision surface withdrawal did not increase across repeated negative events");
    }
    if (expected.trust === "increasing" && lastO <= firstO && firstO > 0.01) {
      warnings.push("decision surface openness did not increase across repeated positive events");
    }
  }

  return {
    level: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    passed: failures.length === 0,
    warnings,
    failures,
    reasons,
  };
}

function isMostlyMonotonic(values: number[], direction: "increasing" | "decreasing"): boolean {
  if (values.length < 2) return true;
  let violations = 0;
  for (let i = 1; i < values.length; i++) {
    const curr = values[i]!;
    const prev = values[i - 1]!;
    if (direction === "increasing" && curr < prev - 0.001) violations++;
    if (direction === "decreasing" && curr > prev + 0.001) violations++;
  }
  // Allow up to 1 violation for noise
  return violations <= 1;
}

function computeSaturationScore(
  metrics: LongTermAccumulationAuditResult["saturationMetrics"],
  stepResults: AccumulationStepResult[],
): number {
  // Composite: average of 1 - saturationRatio for personality and boundary.
  // 0 = fully linear (no saturation), 1 = fully saturated (diminishing returns)
  const pSat = 1 - Math.min(1, metrics.personalitySaturationRatio * 2);
  const bSat = 1 - Math.min(1, metrics.boundarySaturationRatio * 2);
  return round4(clamp01((pSat + bSat) / 2));
}

function computeRepairEffectiveness(
  stepResults: AccumulationStepResult[],
  _input: LongTermAccumulationAuditInput,
): number {
  // Absolute trust gain per positive event — higher is more effective repair.
  // Low-trust baselines naturally get more repair per event (V10.72 nudge).
  const positiveSteps = stepResults.filter(
    (s) => s.event.category === "support" || s.event.category === "success",
  );
  if (positiveSteps.length < 1) return 0;

  const totalTrustGain = positiveSteps.reduce(
    (sum, s) => sum + Math.max(0, s.cumulativeTrust),
    0,
  );
  // Scale: 0.01 per-event trust gain → score 0.5
  return round4(
    clamp01((totalTrustGain / positiveSteps.length) * 50),
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function personalityDist(a: PersonalityCoordinateValues, b: PersonalityCoordinateValues): number {
  const keys = Object.keys(a) as Array<keyof PersonalityCoordinateValues>;
  const squared = keys.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0);
  return round4(Math.sqrt(squared));
}

function snapshotState(state: CharacterPhysicsState): PersonalitySnapshot {
  return {
    coordinate: coordinateToRecord(state.coordinate),
    boundaryStressLoad: round4(state.boundary.stressLoad),
    boundaryIntegrity: round4(state.boundary.integrity),
    boundaryPhase: state.boundary.phase,
    memoryCount: state.memories.length,
    beliefCount: state.beliefStates.length,
  };
}

function cloneState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state)));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
