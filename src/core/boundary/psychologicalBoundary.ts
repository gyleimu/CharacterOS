import { biologicalStressSensitivity, type BiologicalNature } from "../biological/nature";
import type { ImpactScore } from "../benchmark/impact";
import type { ExperienceEvent } from "../event/event";
import { resolveEventCategory } from "../event/eventCategoryClassifier";
import { clamp01, exponentialRecoveryRate, round4 } from "../parameters/parameterMath";
import {
  getCurrentModelParameterSet,
  type BoundaryModelParameters,
} from "../parameters/modelParameterRegistry";
import type { PersonalityCoordinate } from "../personality/coordinate";

export type BoundaryPhase = "stable" | "strained" | "overflow";

export interface PsychologicalBoundary {
  capacity: number;
  resilience: number;
  integrity: number;
  recoveryRate: number;
  stressLoad: number;
  cracks: number;
  overflowCount: number;
  phase: BoundaryPhase;
}

export interface BoundaryImpactResult {
  before: PsychologicalBoundary;
  after: PsychologicalBoundary;
  incomingStress: number;
  overflowAmount: number;
  driftMultiplier: number;
  /** V10.72: small trust/fear repair nudged by boundary safety (positive events only). */
  repairNudge: { trust: number; fear: number; openness: number };
}

export function createPsychologicalBoundary(
  params: Partial<PsychologicalBoundary> = {},
  parameters: BoundaryModelParameters = getCurrentModelParameterSet().boundary,
): PsychologicalBoundary {
  const boundary: PsychologicalBoundary = {
    capacity: params.capacity ?? 0.72,
    resilience: params.resilience ?? 0.52,
    integrity: params.integrity ?? 1,
    recoveryRate: params.recoveryRate ?? 0.035,
    stressLoad: params.stressLoad ?? 0,
    cracks: params.cracks ?? 0,
    overflowCount: params.overflowCount ?? 0,
    phase: params.phase ?? "stable"
  };

  return normalizeBoundary(boundary, parameters);
}

export function linFanPsychologicalBoundary(): PsychologicalBoundary {
  return createPsychologicalBoundary({
    capacity: 0.48,
    resilience: 0.36,
    integrity: 0.78,
    recoveryRate: 0.025,
    stressLoad: 0.12
  });
}

export function applyBoundaryImpact(params: {
  boundary: PsychologicalBoundary;
  nature: BiologicalNature;
  coordinate: PersonalityCoordinate;
  event: ExperienceEvent;
  impactScore: ImpactScore;
  parameters?: BoundaryModelParameters;
}): BoundaryImpactResult {
  const parameters = params.parameters ?? getCurrentModelParameterSet().boundary;
  const before = { ...params.boundary };
  const sensitivity = biologicalStressSensitivity(params.nature);
  const vulnerability =
    params.coordinate.values.fear * 0.25 +
    params.coordinate.values.neuroticism * 0.2 +
    (1 - params.boundary.integrity) * 0.25 +
    sensitivity * 0.3;
  const relationshipPressure = params.event.relationshipWeight * 0.15 + params.event.expectationGap * 0.15;

  const category = resolveEventCategory(params.event);
  const isPositiveSupport = category === "support" || category === "success";

  let incomingStress: number;
  let stressLoad: number;
  let overflowAmount: number;
  let cracks: number;
  let integrity: number;
  let safetySignal = 0;

  if (isPositiveSupport) {
    // V10.70: Positive support / success events act as "safety evidence" —
    // they reduce boundary pressure rather than adding stress.
    // The effect is proportional to impact but dampened so a single
    // supportive event does not cause a massive boundary swing.
    // Higher existing stress → larger relief potential (capped).
    const strainRatio = params.boundary.stressLoad / Math.max(0.01, params.boundary.capacity);
    safetySignal = round4(
      params.impactScore.value *
      Math.min(strainRatio, parameters.positiveStrainRatioCap) *
      parameters.positiveSafetyImpactScale
    );
    // Stress relief: negative incomingStress reduces the load
    incomingStress = round4(-safetySignal * (
      parameters.positiveReliefBase +
      params.boundary.resilience * parameters.positiveReliefResilienceWeight
    ));
    stressLoad = round4(Math.max(0, params.boundary.stressLoad + incomingStress));
    // Positive events do not create overflow or new cracks;
    // they may heal a small amount of existing cracks
    overflowAmount = 0;
    cracks = round4(Math.max(0, params.boundary.cracks - safetySignal * parameters.positiveCrackRepairRate));
    // Integrity slowly improves with safety evidence
    integrity = clamp01(params.boundary.integrity + safetySignal * parameters.positiveIntegrityRepairRate);
  } else {
    // Event categories do not all carry the same boundary threat. In
    // particular, rule-fallback/general events must not accumulate trauma just
    // because they were logged frequently.
    const stressWeight = boundaryStressWeight(category, params.impactScore.value, parameters);
    incomingStress = round4(
      params.impactScore.value *
      (parameters.negativeStressBase + vulnerability + relationshipPressure) *
      (1 - params.boundary.resilience * parameters.negativeResilienceProtection) *
      stressWeight
    );
    stressLoad = round4(params.boundary.stressLoad + incomingStress);
    const overflowBefore = Math.max(0, params.boundary.stressLoad - params.boundary.capacity);
    const overflowAfter = Math.max(0, stressLoad - params.boundary.capacity);
    // Damage is caused by newly added overflow pressure. Reapplying the full
    // historical overflow on every unrelated event produced quadratic cracks.
    overflowAmount = Math.max(0, round4(overflowAfter - overflowBefore));
    cracks = round4(params.boundary.cracks + overflowAmount * parameters.overflowCrackRate);
    integrity = clamp01(params.boundary.integrity - overflowAmount * parameters.overflowIntegrityDamageRate);
  }

  const phase = phaseFor(stressLoad, params.boundary.capacity, parameters);
  const after = normalizeBoundary({
    ...params.boundary,
    stressLoad,
    cracks,
    integrity,
    overflowCount: params.boundary.overflowCount + (overflowAmount > 0 ? 1 : 0),
    phase
  }, parameters);

  // V10.72: compute repair nudge from boundary safety.
  // When boundary stress decreases (positive events), this provides a small
  // trust/openness boost proportional to the safety signal and the current
  // trust deficit. Lower trust → more repair room. Higher trust → near saturation.
  // Coefficients are deliberately small — repair should be visible over repeated
  // events (5+), not overpower negative drift in 1-2 steps.
  // Stress relief naturally approaches zero once the boundary is calm, but
  // positive evidence must still be able to repair trust/fear slowly. Keep
  // that learning signal bounded by event impact instead of tying it entirely
  // to current stress load.
  const repairSignal = isPositiveSupport
    ? Math.max(safetySignal, params.impactScore.value * parameters.positiveSafetyImpactScale)
    : 0;
  const repairNudge = isPositiveSupport
    ? {
        trust: round4(
          repairSignal *
          Math.max(0, parameters.repairTrustTarget - params.coordinate.values.trust) *
          parameters.repairTrustRate,
        ),
        fear: round4(
          -repairSignal *
          params.coordinate.values.fear *
          parameters.repairFearRate,
        ),
        openness: round4(
          repairSignal *
          Math.max(0, parameters.repairOpennessTarget - params.coordinate.values.openness) *
          parameters.repairOpennessRate,
        ),
      }
    : { trust: 0, fear: 0, openness: 0 };

  return {
    before,
    after,
    incomingStress,
    overflowAmount,
    driftMultiplier: driftMultiplierFor(after, parameters),
    repairNudge,
  };
}

export function recoverBoundary(
  boundary: PsychologicalBoundary,
  daysElapsed: number,
  parameters: BoundaryModelParameters = getCurrentModelParameterSet().boundary,
): PsychologicalBoundary {
  if (daysElapsed <= 0) return normalizeBoundary(boundary, parameters);
  const recovery = exponentialRecoveryRate(boundary.recoveryRate, daysElapsed);
  return normalizeBoundary({
    ...boundary,
    stressLoad: round4(boundary.stressLoad * (1 - recovery)),
    cracks: round4(boundary.cracks * (1 - recovery * parameters.recoveryCrackRate)),
    integrity: clamp01(boundary.integrity + recovery * parameters.recoveryIntegrityRate),
    phase: phaseFor(boundary.stressLoad * (1 - recovery), boundary.capacity, parameters)
  }, parameters);
}

export function driftMultiplierFor(
  boundary: PsychologicalBoundary,
  parameters: BoundaryModelParameters = getCurrentModelParameterSet().boundary,
): number {
  const strainRatio = boundary.capacity <= 0 ? 1 : boundary.stressLoad / boundary.capacity;
  const overflowPressure = Math.max(0, strainRatio - 1);
  const saturatedOverflow = 1 - Math.exp(-overflowPressure);
  const saturatedCracks = 1 - Math.exp(-Math.max(0, boundary.cracks));
  return round4(
    1 +
    saturatedOverflow * parameters.driftOverflowWeight +
    saturatedCracks * parameters.driftCrackWeight,
  );
}

function boundaryStressWeight(
  category: string,
  impact: number,
  parameters: BoundaryModelParameters,
): number {
  if (category === "general" && impact <= 0.3) return 0;
  return parameters.stressWeightByCategory[category]
    ?? parameters.stressWeightByCategory.fallback
    ?? 0.5;
}

function phaseFor(
  stressLoad: number,
  capacity: number,
  parameters: BoundaryModelParameters,
): BoundaryPhase {
  if (stressLoad > capacity) {
    return "overflow";
  }
  if (stressLoad >= capacity * parameters.strainedCapacityRatio) {
    return "strained";
  }
  return "stable";
}

function normalizeBoundary(
  boundary: PsychologicalBoundary,
  parameters: BoundaryModelParameters = getCurrentModelParameterSet().boundary,
): PsychologicalBoundary {
  const capacity = clamp01(boundary.capacity);
  const stressLoad = Math.max(0, round4(boundary.stressLoad));
  return {
    capacity,
    resilience: clamp01(boundary.resilience),
    integrity: clamp01(boundary.integrity),
    recoveryRate: clamp01(boundary.recoveryRate),
    stressLoad,
    cracks: Math.max(0, round4(boundary.cracks)),
    overflowCount: Math.max(0, Math.floor(boundary.overflowCount)),
    phase: phaseFor(stressLoad, capacity, parameters)
  };
}
