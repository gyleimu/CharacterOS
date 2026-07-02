import type { BaselineDriftTrace } from "./baselineDrift";
import type { ParameterAccumulationTrace } from "./parameterAccumulation";
import { clamp01, round4 } from "./parameterMath";

export type ParameterAdjustmentRisk = "low" | "medium" | "high";

export interface ParameterAdjustmentDraft {
  id: string;
  target: string;
  label: string;
  currentValue: number;
  suggestedValue: number;
  confidence: number;
  risk: ParameterAdjustmentRisk;
  reasons: string[];
}

export interface ParameterAdjustmentDraftTrace {
  drafts: ParameterAdjustmentDraft[];
  reviewRecommended: boolean;
  reasons: string[];
}

export function buildParameterAdjustmentDraftTrace(params: {
  baselineDrift: BaselineDriftTrace;
  accumulation: ParameterAccumulationTrace;
}): ParameterAdjustmentDraftTrace {
  const readyBuckets = new Set(
    params.accumulation.buckets
      .filter((bucket) => bucket.readyForReview || bucket.progress >= 0.82)
      .map((bucket) => bucket.id)
  );
  const drafts = params.baselineDrift.candidates
    .filter((candidate) => isCandidateReviewable(candidate.id, readyBuckets))
    .map((candidate) => {
      const progress = progressForCandidate(candidate.id, params.accumulation);
      const confidence = round4(clamp01(candidate.pressure * 0.68 + progress * 0.32));
      return {
        id: `adjust_${candidate.id}`,
        target: candidate.id,
        label: candidate.label,
        currentValue: candidate.currentBaseline,
        suggestedValue: candidate.suggestedBaseline,
        confidence,
        risk: riskFromConfidence(confidence),
        reasons: [
          "该草案来自长期基线漂移候选和参数积累阈值，不应自动应用。",
          candidate.reasons[0] ?? "存在长期基线漂移迹象。"
        ]
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return {
    drafts,
    reviewRecommended: drafts.length > 0,
    reasons: buildReasons(drafts)
  };
}

function isCandidateReviewable(candidateId: string, readyBuckets: Set<string>): boolean {
  const bucketByCandidate: Record<string, string> = {
    baseline_self_control: "self_control_pressure",
    baseline_boundary_integrity: "boundary_pressure",
    baseline_emotional_amplification: "emotion_amplification_pressure",
    baseline_craving: "craving_pressure"
  };
  const bucket = bucketByCandidate[candidateId];
  return bucket ? readyBuckets.has(bucket) : false;
}

function progressForCandidate(candidateId: string, accumulation: ParameterAccumulationTrace): number {
  const bucketByCandidate: Record<string, string> = {
    baseline_self_control: "self_control_pressure",
    baseline_boundary_integrity: "boundary_pressure",
    baseline_emotional_amplification: "emotion_amplification_pressure",
    baseline_craving: "craving_pressure"
  };
  const bucket = accumulation.buckets.find((item) => item.id === bucketByCandidate[candidateId]);
  return bucket?.progress ?? 0;
}

function riskFromConfidence(confidence: number): ParameterAdjustmentRisk {
  if (confidence >= 0.78) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function buildReasons(drafts: ParameterAdjustmentDraft[]): string[] {
  if (!drafts.length) {
    return ["no manual adjustment draft generated"];
  }
  return [
    "manual parameter adjustment review is recommended",
    "drafts are suggestions only and should not be applied without human judgment"
  ];
}
