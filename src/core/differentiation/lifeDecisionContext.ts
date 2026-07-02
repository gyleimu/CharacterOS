// =========================================================================
// V10.15 LifeDecisionContext — Life signal summary for decision pipeline.
// Extracts minimal, bounded signals from a V10.8 life tick dry-run result.
// These signals act as MODIFIERS on personality-driven decisions, never
// as primary drivers. No mutation. No self-action execution.
// =========================================================================

import type { LifeTickDryRunResult } from "../life/lifeTickRunner";
import type { EnergyFatigueState } from "../life/energyFatigue";
import type { SleepWakeState } from "../life/sleepWake";
import type { BoredomExpansionState } from "../life/boredomInspiration";
import type { RandomThought } from "../life/randomThought";
import type { GeneratedSelfActionCandidate } from "../life/selfActionCandidate";
import type { InspirationSeedCandidate } from "../life/boredomInspiration";

// ── LifeDecisionContext ────────────────────────────────────────────────────

export interface LifeDecisionContext {
  // Energy / fatigue
  energy: number;
  fatigue: number;
  sleepPressure: number;

  // Sleep
  sleepPhase: string;

  // Boredom
  boredom: number;
  restlessness: number;
  daydreamingTendency: number;
  explorationPressure: number;
  irritability: number;

  // Random thought
  strongestRandomThoughtKind?: string;
  strongestRandomThoughtPhrase?: string;

  // Inspiration
  strongestInspirationType?: string;
  strongestInspirationStrength: number;

  // Self-action
  topSelfActionCandidateType?: string;
  topSelfActionCandidateScore: number;

  // Summary
  reasons: string[];
}

// ── Default ────────────────────────────────────────────────────────────────

export function buildDefaultLifeDecisionContext(): LifeDecisionContext {
  return {
    energy: 0.65,
    fatigue: 0.25,
    sleepPressure: 0.3,
    sleepPhase: "awake",
    boredom: 0.25,
    restlessness: 0.2,
    daydreamingTendency: 0.35,
    explorationPressure: 0.25,
    irritability: 0.15,
    strongestInspirationStrength: 0,
    topSelfActionCandidateScore: 0,
    reasons: ["No life dry-run available — using default life context."],
  };
}

// ── From Dry-Run ───────────────────────────────────────────────────────────

/**
 * Build LifeDecisionContext from a V10.8 LifeTickDryRunResult.
 * Extracts only summary-level signals — does NOT leak full life trace.
 * Pure, deterministic, no mutation.
 */
export function buildLifeDecisionContextFromDryRun(
  dryRun: LifeTickDryRunResult
): LifeDecisionContext {
  const projected = dryRun.projectedLifeState;
  const ef: EnergyFatigueState = projected.energyFatigue;
  const sw: SleepWakeState = projected.sleepWake;
  const bs: BoredomExpansionState = projected.boredomExpansion;

  const randomThought: RandomThought | undefined = projected.randomThought;
  const inspirationSeeds: InspirationSeedCandidate[] = projected.inspirationSeeds;
  const candidates: GeneratedSelfActionCandidate[] = projected.selfActionCandidates;

  const topInspiration = inspirationSeeds[0];
  const topCandidate = candidates[0];

  const reasons: string[] = [];

  // Summarize what the life tick found
  if (ef.fatigue > 0.5) reasons.push(`Fatigue elevated (${ef.fatigue.toFixed(2)}) — decision energy lowered.`);
  if (ef.sleepPressure > 0.5) reasons.push(`Sleep pressure high (${ef.sleepPressure.toFixed(2)}) — favoring rest/delay.`);
  if (bs.boredom > 0.4) reasons.push(`Boredom present (${bs.boredom.toFixed(2)}) — exploration tendencies active.`);
  if (bs.restlessness > 0.4) reasons.push(`Restlessness elevated (${bs.restlessness.toFixed(2)}) — physical action drive.`);
  if (bs.irritability > 0.4) reasons.push(`Irritability elevated (${bs.irritability.toFixed(2)}) — confrontation threshold lowered.`);
  if (randomThought && randomThought.kind !== "nothing") {
    reasons.push(`Random thought "${randomThought.kind}": "${randomThought.phrase}"`);
  }
  if (topInspiration) {
    reasons.push(`Inspiration seed "${topInspiration.type}" present (strength=${topInspiration.probability.toFixed(2)}).`);
  }
  if (topCandidate) {
    reasons.push(`Top self-action candidate: "${topCandidate.type}" (score=${topCandidate.score.toFixed(2)}) — NOT executed.`);
  }
  if (!reasons.length) {
    reasons.push("Life tick completed — no strong signals affecting decision.");
  }

  const result: LifeDecisionContext = {
    energy: ef.energy,
    fatigue: ef.fatigue,
    sleepPressure: ef.sleepPressure,
    sleepPhase: sw.phase,
    boredom: bs.boredom,
    restlessness: bs.restlessness,
    daydreamingTendency: bs.daydreamingTendency,
    explorationPressure: bs.explorationPressure,
    irritability: bs.irritability,
    strongestInspirationStrength: topInspiration?.probability ?? 0,
    topSelfActionCandidateScore: topCandidate?.score ?? 0,
    reasons,
  };

  // Only set optional string fields when they have values (exactOptionalPropertyTypes)
  if (randomThought && randomThought.kind !== "nothing") {
    result.strongestRandomThoughtKind = randomThought.kind;
    result.strongestRandomThoughtPhrase = randomThought.phrase;
  }
  if (topInspiration) {
    result.strongestInspirationType = topInspiration.type;
  }
  if (topCandidate) {
    result.topSelfActionCandidateType = topCandidate.type;
  }

  return result;
}

// ── Summarize ──────────────────────────────────────────────────────────────

export function summarizeLifeDecisionContext(
  ctx: LifeDecisionContext
): string {
  const parts: string[] = [];
  if (ctx.fatigue > 0.5) parts.push(`fatigue=${ctx.fatigue.toFixed(2)}`);
  if (ctx.sleepPressure > 0.5) parts.push(`sleepPressure=${ctx.sleepPressure.toFixed(2)}`);
  if (ctx.boredom > 0.4) parts.push(`boredom=${ctx.boredom.toFixed(2)}`);
  if (ctx.restlessness > 0.4) parts.push(`restlessness=${ctx.restlessness.toFixed(2)}`);
  if (ctx.strongestRandomThoughtKind) parts.push(`thought=${ctx.strongestRandomThoughtKind}`);
  if (ctx.strongestInspirationType) parts.push(`inspiration=${ctx.strongestInspirationType}`);
  if (ctx.topSelfActionCandidateType) parts.push(`candidate=${ctx.topSelfActionCandidateType}`);
  return parts.length > 0 ? parts.join(", ") : "no strong life signals";
}
