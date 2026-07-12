import { biologicalStressSensitivity, type BiologicalNature } from "../biological/nature";
import type { ImpactScore } from "../benchmark/impact";
import type { ExperienceEvent } from "../event/event";
import { resolveEventCategory } from "../event/eventCategoryClassifier";
import { clamp01, exponentialRecoveryRate, round4 } from "../parameters/parameterMath";
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

export function createPsychologicalBoundary(params: Partial<PsychologicalBoundary> = {}): PsychologicalBoundary {
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

  return normalizeBoundary(boundary);
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
}): BoundaryImpactResult {
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
      Math.min(strainRatio, 1.8) *
      0.28
    );
    // Stress relief: negative incomingStress reduces the load
    incomingStress = round4(-safetySignal * (0.7 + params.boundary.resilience * 0.4));
    stressLoad = round4(Math.max(0, params.boundary.stressLoad + incomingStress));
    // Positive events do not create overflow or new cracks;
    // they may heal a small amount of existing cracks
    overflowAmount = 0;
    cracks = round4(Math.max(0, params.boundary.cracks - safetySignal * 0.15));
    // Integrity slowly improves with safety evidence
    integrity = clamp01(params.boundary.integrity + safetySignal * 0.07);
  } else {
    // Event categories do not all carry the same boundary threat. In
    // particular, rule-fallback/general events must not accumulate trauma just
    // because they were logged frequently.
    const stressWeight = boundaryStressWeight(category, params.impactScore.value);
    incomingStress = round4(
      params.impactScore.value *
      (0.55 + vulnerability + relationshipPressure) *
      (1 - params.boundary.resilience * 0.42) *
      stressWeight
    );
    stressLoad = round4(params.boundary.stressLoad + incomingStress);
    const overflowBefore = Math.max(0, params.boundary.stressLoad - params.boundary.capacity);
    const overflowAfter = Math.max(0, stressLoad - params.boundary.capacity);
    // Damage is caused by newly added overflow pressure. Reapplying the full
    // historical overflow on every unrelated event produced quadratic cracks.
    overflowAmount = Math.max(0, round4(overflowAfter - overflowBefore));
    cracks = round4(params.boundary.cracks + overflowAmount * 0.35);
    integrity = clamp01(params.boundary.integrity - overflowAmount * 0.18);
  }

  const phase = phaseFor(stressLoad, params.boundary.capacity);
  const after = normalizeBoundary({
    ...params.boundary,
    stressLoad,
    cracks,
    integrity,
    overflowCount: params.boundary.overflowCount + (overflowAmount > 0 ? 1 : 0),
    phase
  });

  // V10.72: compute repair nudge from boundary safety.
  // When boundary stress decreases (positive events), this provides a small
  // trust/openness boost proportional to the safety signal and the current
  // trust deficit. Lower trust → more repair room. Higher trust → near saturation.
  // Coefficients are deliberately small — repair should be visible over repeated
  // events (5+), not overpower negative drift in 1-2 steps.
  const repairNudge = isPositiveSupport
    ? {
        trust: round4(
          safetySignal *
          Math.max(0, 0.85 - params.coordinate.values.trust) *
          0.012,
        ),
        fear: round4(
          -safetySignal *
          params.coordinate.values.fear *
          0.008,
        ),
        openness: round4(
          safetySignal *
          Math.max(0, 0.7 - params.coordinate.values.openness) *
          0.006,
        ),
      }
    : { trust: 0, fear: 0, openness: 0 };

  return {
    before,
    after,
    incomingStress,
    overflowAmount,
    driftMultiplier: driftMultiplierFor(after),
    repairNudge,
  };
}

export function recoverBoundary(boundary: PsychologicalBoundary, daysElapsed: number): PsychologicalBoundary {
  if (daysElapsed <= 0) return normalizeBoundary(boundary);
  const recovery = exponentialRecoveryRate(boundary.recoveryRate, daysElapsed);
  return normalizeBoundary({
    ...boundary,
    stressLoad: round4(boundary.stressLoad * (1 - recovery)),
    cracks: round4(boundary.cracks * (1 - recovery * 0.35)),
    integrity: clamp01(boundary.integrity + recovery * 0.12),
    phase: phaseFor(boundary.stressLoad * (1 - recovery), boundary.capacity)
  });
}

export function driftMultiplierFor(boundary: PsychologicalBoundary): number {
  const strainRatio = boundary.capacity <= 0 ? 1 : boundary.stressLoad / boundary.capacity;
  const overflowPressure = Math.max(0, strainRatio - 1);
  const saturatedOverflow = 1 - Math.exp(-overflowPressure);
  const saturatedCracks = 1 - Math.exp(-Math.max(0, boundary.cracks));
  return round4(1 + saturatedOverflow * 0.6 + saturatedCracks * 0.15);
}

function boundaryStressWeight(category: string, impact: number): number {
  switch (category) {
    case "general":
      return impact <= 0.3 ? 0 : 0.12;
    case "fatigue":
      return 0.18;
    case "uncertainty":
      return 0.38;
    case "failure":
      return 0.62;
    case "rejection":
    case "conflict":
      return 0.8;
    case "abandonment":
    case "betrayal":
      return 1;
    default:
      return 0.5;
  }
}

function phaseFor(stressLoad: number, capacity: number): BoundaryPhase {
  if (stressLoad > capacity) {
    return "overflow";
  }
  if (stressLoad >= capacity * 0.7) {
    return "strained";
  }
  return "stable";
}

function normalizeBoundary(boundary: PsychologicalBoundary): PsychologicalBoundary {
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
    phase: phaseFor(stressLoad, capacity)
  };
}
