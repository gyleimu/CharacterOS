// =========================================================================
// V10.17 Longitudinal Single-Character Simulation Harness
//
// A controlled, deterministic, dry-run-first harness for observing how a
// single character changes over simulated time. NOT a daemon. NOT an
// autonomous loop. NOT a world simulator. NOT a multi-character system.
//
// It lets us observe:
//   - fatigue/sleep/boredom/thought cycles
//   - how lifeContext influences differentiated decisions
//   - how decisions shift over time
//   - whether personality/belief/memory drift is auditable
// =========================================================================

import { runLifeTickDryRun, type LifeTickRunnerOptions } from "./lifeTickRunner";
import { buildLifeDecisionContextFromDryRun, type LifeDecisionContext } from "../differentiation/lifeDecisionContext";
import { buildDifferentiatedDecisionForState } from "../differentiation/differentiationAdapter";
import { explainDifferentiatedDecision } from "../explainability/differentiatedDecisionExplanation";
import { commitLifeTickProjection, type LifeTickCommitOptions } from "./lifeTickPersistence";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { LifeTickRequest } from "./lifeTickTypes";
import type { DifferentiatedDecision } from "../differentiation/characterDifferentiation";
import type { ExplanationTrace } from "../explainability/explanationTypes";
import type { LifeTickCommitResult } from "./lifeTickPersistence";
import { neutralCoordinate } from "../personality/coordinate";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LongitudinalCommitPolicy {
  enabled: boolean;
  commitDreams?: boolean;
  commitRandomThoughts?: boolean;
  commitInspirationSeeds?: boolean;
  /** Always false — self-action candidates are NEVER executed. */
  commitSelfActionCandidates?: false;
  maxGeneratedMemoriesPerStep?: number;
  maxTotalGeneratedMemories?: number;
}

export interface LongitudinalSimulationRequest {
  characterId: string;
  totalHours: number;
  stepHours: number;
  seed: string;
  observed?: boolean;
  includeDecision?: boolean;
  includeExplanation?: boolean;
  commitPolicy?: LongitudinalCommitPolicy;
  lifeOptions?: {
    stimulationLevel?: number;
    socialContactLevel?: number;
    localHour?: number;
  };
}

export interface CompactStateSummary {
  memoryCount: number;
  beliefCount: number;
  trust: number;
  fear: number;
  control: number;
  openness: number;
  conscientiousness: number;
  boundaryStress: number;
  boundaryIntegrity: number;
  metaResilience: number;
  metaSelfControl: number;
  latestMemorySnippet?: string;
  topBeliefSnippet?: string;
}

export interface LongitudinalSimulationStep {
  index: number;
  elapsedHours: number;
  absoluteHour: number;
  lifeDecisionContext: LifeDecisionContext;
  differentiatedDecision?: DifferentiatedDecision;
  differentiatedExplanation?: ExplanationTrace;
  commitResult?: LifeTickCommitResult;
  stateSummaryBefore: CompactStateSummary;
  stateSummaryAfter: CompactStateSummary;
  warnings: string[];
  reasons: string[];
}

export interface AggregateMetrics {
  totalSteps: number;
  committedSteps: number;
  generatedMemoryCount: number;
  averageFatigue: number;
  averageBoredom: number;
  sleepPhaseCounts: Record<string, number>;
  strategyCounts: Record<string, number>;
  actionDirectionCounts: Record<string, number>;
  lifeInfluenceCount: number;
  personalityDeltaSummary: Record<string, number>;
  beliefCountBefore: number;
  beliefCountAfter: number;
  memoryCountBefore: number;
  memoryCountAfter: number;
}

export interface LongitudinalSimulationResult {
  version: "v10.17";
  characterId: string;
  totalHours: number;
  stepHours: number;
  applied: boolean;
  steps: LongitudinalSimulationStep[];
  aggregate: AggregateMetrics;
  finalStateSummary: CompactStateSummary;
  warnings: string[];
  reasons: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_STEPS = 720;

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function compactSummary(state: CharacterPhysicsState): CompactStateSummary {
  const coord = state.coordinate.values;
  const boundary = state.boundary;
  const meta = state.metaState;
  const result: CompactStateSummary = {
    memoryCount: state.memories.length,
    beliefCount: state.beliefStates.length,
    trust: coord.trust,
    fear: coord.fear,
    control: coord.control,
    openness: coord.openness,
    conscientiousness: coord.conscientiousness,
    boundaryStress: boundary.stressLoad,
    boundaryIntegrity: boundary.integrity,
    metaResilience: meta.resilience,
    metaSelfControl: meta.selfControl,
  };
  const lastMem = state.memories.at(-1);
  if (lastMem) result.latestMemorySnippet = lastMem.content.slice(0, 80);
  const topBel = state.beliefStates[0];
  if (topBel) result.topBeliefSnippet = topBel.content.slice(0, 80);
  return result;
}

function stepSeed(baseSeed: string, index: number, absoluteHour: number): string {
  return `${baseSeed}:${index}:${absoluteHour}`;
}

// ── Main Function ─────────────────────────────────────────────────────────

/**
 * Run a longitudinal single-character simulation.
 *
 * Each step:
 *   1. Run a life tick dry-run for `stepHours`
 *   2. Build LifeDecisionContext from the dry-run
 *   3. Optionally derive DifferentiatedDecision
 *   4. Optionally explain the decision
 *   5. Optionally commit generated artifacts (memory seeds only)
 *
 * Self-action candidates are NEVER executed.
 * Default: dry-run only, no state mutation.
 */
export function runLongitudinalSimulation(
  state: CharacterPhysicsState,
  request: LongitudinalSimulationRequest
): LongitudinalSimulationResult {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const steps: LongitudinalSimulationStep[] = [];
  const allWarnings: string[] = [];

  // ── Validate ──────────────────────────────────────────────────────────
  if (request.totalHours <= 0) {
    warnings.push(`totalHours=${request.totalHours} must be > 0.`);
    return buildEmptyResult(request, state, warnings);
  }
  if (request.stepHours <= 0) {
    warnings.push(`stepHours=${request.stepHours} must be > 0.`);
    return buildEmptyResult(request, state, warnings);
  }

  const rawSteps = Math.floor(request.totalHours / request.stepHours);
  const totalSteps = Math.min(rawSteps, MAX_STEPS);
  if (rawSteps > MAX_STEPS) {
    warnings.push(`Steps capped at ${MAX_STEPS} (requested ${rawSteps}).`);
  }
  reasons.push(`Running ${totalSteps} steps of ${request.stepHours}h each (total: ${request.totalHours}h).`);

  const includeDecision = request.includeDecision ?? false;
  const includeExplanation = request.includeExplanation ?? false;
  const commitPolicy = request.commitPolicy;
  const commitEnabled = commitPolicy?.enabled ?? false;
  const observed = request.observed ?? true;

  // ── Clone for optional commit ────────────────────────────────────────
  let workingState = state;
  let totalGeneratedMemories = 0;
  let committedSteps = 0;
  const maxPerStep = commitPolicy?.maxGeneratedMemoriesPerStep ?? 2;
  const maxTotal = commitPolicy?.maxTotalGeneratedMemories ?? totalSteps * maxPerStep;

  // ── Step loop ─────────────────────────────────────────────────────────
  for (let i = 0; i < totalSteps; i++) {
    const absoluteHour = i * request.stepHours;
    const seed = stepSeed(request.seed, i, absoluteHour);
    const stepWarnings: string[] = [];
    const stepReasons: string[] = [];

    // 1. Snap before
    const beforeSummary = compactSummary(workingState);

    // 2. Life tick dry-run
    const lifeReq: LifeTickRequest = {
      characterId: request.characterId,
      elapsedHours: request.stepHours,
      observed,
      seed,
      requestedAt: `2026-06-25T${String(absoluteHour % 24).padStart(2, "0")}:00:00.000Z`,
      mode: "dry_run",
    };

    const lifeOptions: LifeTickRunnerOptions = {};
    if (request.lifeOptions?.stimulationLevel !== undefined) {
      lifeOptions.stimulationLevel = request.lifeOptions.stimulationLevel;
    }
    if (request.lifeOptions?.socialContactLevel !== undefined) {
      lifeOptions.socialContactLevel = request.lifeOptions.socialContactLevel;
    }
    if (request.lifeOptions?.localHour !== undefined) {
      lifeOptions.localHour = (request.lifeOptions.localHour + absoluteHour) % 24;
    }

    const dryRun = runLifeTickDryRun(workingState, lifeReq, lifeOptions);
    stepWarnings.push(...dryRun.warnings);

    // 3. Life decision context
    const lifeCtx = buildLifeDecisionContextFromDryRun(dryRun);
    stepReasons.push(...lifeCtx.reasons);

    // 4. Differentiated decision (optional)
    let dd: DifferentiatedDecision | undefined;
    let explanation: ExplanationTrace | undefined;

    if (includeDecision) {
      dd = buildDifferentiatedDecisionForState(workingState, { lifeContext: lifeCtx });
      stepReasons.push(`Decision: ${dd.selectedStrategy.label} (${dd.selectedStrategy.direction}).`);

      // 5. Explanation (optional)
      if (includeExplanation) {
        const explResult = explainDifferentiatedDecision({
          legacyDecision: {
            id: "sim_decision",
            innerThoughts: [],
            emotionalReaction: "simulated",
            innerConflict: "",
            willNotDo: [],
            mostLikelyAction: dd.actionSurface.action,
            confidence: dd.selectedStrategy.intensity,
            rationale: dd.selectedStrategy.coreReason,
            supportingBeliefIds: [],
            supportingNeedIds: [],
            supportingDesireIds: [],
            supportingBehaviorBiasIds: [],
          },
          differentiatedDecision: dd,
          seed,
          lifeContext: lifeCtx,
        });
        explanation = explResult.trace;
      }
    }

    // 6. Optional commit (memory seeds only, clone only)
    let commitResult: LifeTickCommitResult | undefined;
    if (commitEnabled) {
      const commitOpts: LifeTickCommitOptions = {
        allowDreamMemorySeed: commitPolicy?.commitDreams ?? false,
        allowRandomThoughtMemorySeed: commitPolicy?.commitRandomThoughts ?? false,
        allowInspirationSeed: commitPolicy?.commitInspirationSeeds ?? false,
        allowSelfActionCandidateMemorySeed: false, // NEVER executed
        maxGeneratedMemories: Math.min(maxPerStep, maxTotal - totalGeneratedMemories),
        reason: `step-${i}`,
      };

      commitResult = commitLifeTickProjection(workingState, dryRun, commitOpts);
      workingState = commitResult.state; // Use cloned+committed state for next step
      totalGeneratedMemories += commitResult.changes.length;
      if (commitResult.applied) committedSteps++;
      stepReasons.push(`Commit: ${commitResult.changes.length} changes, ${commitResult.skipped.length} skipped.`);
    }

    // 7. Snap after
    const afterSummary = compactSummary(workingState);

    const step: LongitudinalSimulationStep = {
      index: i,
      elapsedHours: request.stepHours,
      absoluteHour,
      lifeDecisionContext: lifeCtx,
      stateSummaryBefore: beforeSummary,
      stateSummaryAfter: afterSummary,
      warnings: stepWarnings,
      reasons: stepReasons,
    };
    if (dd) step.differentiatedDecision = dd;
    if (explanation) step.differentiatedExplanation = explanation;
    if (commitResult) step.commitResult = commitResult;
    steps.push(step);

    allWarnings.push(...stepWarnings);
  }

  // ── Build aggregate ──────────────────────────────────────────────────
  const aggregate = buildAggregate(steps, workingState, totalGeneratedMemories, committedSteps);

  return {
    version: "v10.17",
    characterId: request.characterId,
    totalHours: request.totalHours,
    stepHours: request.stepHours,
    applied: commitEnabled && committedSteps > 0,
    steps,
    aggregate,
    finalStateSummary: compactSummary(workingState),
    warnings: [...warnings, ...allWarnings],
    reasons,
  };
}

// ── Aggregate Builder ─────────────────────────────────────────────────────

function buildAggregate(
  steps: LongitudinalSimulationStep[],
  finalState: CharacterPhysicsState,
  generatedMemoryCount: number,
  committedSteps: number
): AggregateMetrics {
  const sleepPhaseCounts: Record<string, number> = {};
  const strategyCounts: Record<string, number> = {};
  const actionDirectionCounts: Record<string, number> = {};
  let totalFatigue = 0;
  let totalBoredom = 0;
  let lifeInfluenceCount = 0;

  for (const step of steps) {
    const lc = step.lifeDecisionContext;
    totalFatigue += lc.fatigue;
    totalBoredom += lc.boredom;
    lifeInfluenceCount += step.differentiatedDecision?.lifeInfluences.length ?? 0;

    const phase = lc.sleepPhase;
    sleepPhaseCounts[phase] = (sleepPhaseCounts[phase] ?? 0) + 1;

    if (step.differentiatedDecision) {
      const strat = step.differentiatedDecision.selectedStrategy;
      strategyCounts[strat.id] = (strategyCounts[strat.id] ?? 0) + 1;
      actionDirectionCounts[strat.direction] = (actionDirectionCounts[strat.direction] ?? 0) + 1;
    }
  }

  const n = steps.length || 1;
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];

  return {
    totalSteps: steps.length,
    committedSteps,
    generatedMemoryCount,
    averageFatigue: Math.round((totalFatigue / n) * 10000) / 10000,
    averageBoredom: Math.round((totalBoredom / n) * 10000) / 10000,
    sleepPhaseCounts,
    strategyCounts,
    actionDirectionCounts,
    lifeInfluenceCount,
    personalityDeltaSummary: firstStep && lastStep ? {
      trustDelta: Math.round((lastStep.stateSummaryAfter.trust - firstStep.stateSummaryBefore.trust) * 10000) / 10000,
      fearDelta: Math.round((lastStep.stateSummaryAfter.fear - firstStep.stateSummaryBefore.fear) * 10000) / 10000,
      controlDelta: Math.round((lastStep.stateSummaryAfter.control - firstStep.stateSummaryBefore.control) * 10000) / 10000,
      opennessDelta: Math.round((lastStep.stateSummaryAfter.openness - firstStep.stateSummaryBefore.openness) * 10000) / 10000,
      conscientiousnessDelta: Math.round((lastStep.stateSummaryAfter.conscientiousness - firstStep.stateSummaryBefore.conscientiousness) * 10000) / 10000,
    } : {},
    beliefCountBefore: firstStep?.stateSummaryBefore.beliefCount ?? 0,
    beliefCountAfter: lastStep?.stateSummaryAfter.beliefCount ?? 0,
    memoryCountBefore: firstStep?.stateSummaryBefore.memoryCount ?? 0,
    memoryCountAfter: lastStep?.stateSummaryAfter.memoryCount ?? 0,
  };
}

// ── Error Result Builder ──────────────────────────────────────────────────

function buildEmptyResult(
  request: LongitudinalSimulationRequest,
  state: CharacterPhysicsState,
  warnings: string[]
): LongitudinalSimulationResult {
  return {
    version: "v10.17",
    characterId: request.characterId,
    totalHours: request.totalHours,
    stepHours: request.stepHours,
    applied: false,
    steps: [],
    aggregate: {
      totalSteps: 0,
      committedSteps: 0,
      generatedMemoryCount: 0,
      averageFatigue: 0,
      averageBoredom: 0,
      sleepPhaseCounts: {},
      strategyCounts: {},
      actionDirectionCounts: {},
      lifeInfluenceCount: 0,
      personalityDeltaSummary: {},
      beliefCountBefore: 0,
      beliefCountAfter: 0,
      memoryCountBefore: 0,
      memoryCountAfter: 0,
    },
    finalStateSummary: compactSummary(state),
    warnings,
    reasons: ["Simulation rejected: invalid parameters."],
  };
}
