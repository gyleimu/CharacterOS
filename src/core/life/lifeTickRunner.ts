// =========================================================================
// V10.8 Life Tick Dry-run Runner — First integrated continuous life tick.
// Wires V10.1–V10.7 subsystems into a single deterministic, non-mutating
// execution trace. "The foot hovers — it has not yet touched the ground."
// =========================================================================

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type {
  LifeTickRequest,
  LifeTickPlan,
  LifeTickTrace,
  LifePhaseTrace,
} from "./lifeTickTypes";
import { buildLifeTickPlan } from "./lifeScheduler";
import {
  DEFAULT_ENERGY_FATIGUE_STATE,
  tickEnergyFatigue,
  buildEnergyFatigueContextFromCharacter,
  type EnergyFatigueState,
} from "./energyFatigue";
import {
  DEFAULT_SLEEP_WAKE_STATE,
  tickSleepWake,
  buildSleepWakeContext,
  type SleepWakeState,
} from "./sleepWake";
import {
  generateDreamFragment,
  selectDreamSources,
  buildDreamContextFromCharacter,
  type DreamFragment,
  type DreamSource,
} from "./dream";
import {
  DEFAULT_BOREDOM_EXPANSION_STATE,
  tickBoredomExpansion,
  generateInspirationSeedCandidates,
  buildBoredomExpansionContextFromCharacter,
  type BoredomExpansionState,
  type InspirationSeedCandidate,
} from "./boredomInspiration";
import {
  selectRandomThoughtSources,
  generateRandomThought,
  buildRandomThoughtContextFromCharacter,
  type RandomThought,
} from "./randomThought";
import {
  buildSelfActionCandidateContextFromCharacter,
  generateSelfActionCandidates,
  type GeneratedSelfActionCandidate,
} from "./selfActionCandidate";

// ── ProjectedLifeState ────────────────────────────────────────────────────

export interface ProjectedLifeState {
  energyFatigue: EnergyFatigueState;
  sleepWake: SleepWakeState;
  boredomExpansion: BoredomExpansionState;
  dreamFragments: DreamFragment[];
  inspirationSeeds: InspirationSeedCandidate[];
  randomThought?: RandomThought;
  selfActionCandidates: GeneratedSelfActionCandidate[];
}

// ── LifeTickDryRunResult ──────────────────────────────────────────────────

export interface LifeTickDryRunResult {
  version: "v10.8";
  applied: false;
  request: LifeTickRequest;
  plan: LifeTickPlan;
  trace: LifeTickTrace;
  projectedLifeState: ProjectedLifeState;
  warnings: string[];
  reasons: string[];
}

// ── Runner Options ────────────────────────────────────────────────────────

export interface LifeTickRunnerOptions {
  /** Local hour (0–23). Defaults to hour extracted from request.requestedAt. */
  localHour?: number;
  /** [0,1] — environmental stimulation level. Default 0.4. */
  stimulationLevel?: number;
  /** [0,1] — social contact level. Default 0.4. */
  socialContactLevel?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function extractLocalHour(requestedAt: string): number {
  const d = new Date(requestedAt);
  if (Number.isNaN(d.getTime())) return 12; // fallback to noon
  return d.getHours();
}

function isSleepPhase(phase: string): boolean {
  return phase === "light_sleep" || phase === "deep_sleep" || phase === "falling_asleep";
}

// ── Phase Runner ───────────────────────────────────────────────────────────

/**
 * Run a full dry-run life tick by executing all V10 subsystems in order.
 *
 * Phases:
 *   1. scheduler          — validate request, build plan
 *   2. energy_fatigue     — tick energy/fatigue from character context
 *   3. sleep_wake         — tick sleep/wake using projected energy/fatigue
 *   4. dream              — generate dream fragment if sleeping
 *   5. boredom_inspiration — tick boredom + generate inspiration seeds
 *   6. random_thought     — generate random thought from all prior signals
 *   7. self_action_candidate — generate action candidates from all signals
 *   8. summary            — aggregate warnings, reasons, trace
 *
 * NO state is ever mutated. CharacterPhysicsState is read-only.
 * Same inputs + same seed → identical output every time.
 */
export function runLifeTickDryRun(
  state: CharacterPhysicsState,
  request: LifeTickRequest,
  options?: LifeTickRunnerOptions
): LifeTickDryRunResult {
  const allWarnings: string[] = [];
  const allReasons: string[] = [];
  const phaseTraces: LifePhaseTrace[] = [];
  const internalEvents: import("./lifeTickTypes").InternalEvent[] = [];
  const localHour =
    options?.localHour ?? extractLocalHour(request.requestedAt);
  const stimulationLevel = clamp01(options?.stimulationLevel ?? 0.4);
  const socialContactLevel = clamp01(options?.socialContactLevel ?? 0.4);
  const seed = request.seed ?? `${request.characterId}|${request.requestedAt}|${request.elapsedHours}`;

  // ── Phase 1: Scheduler ──────────────────────────────────────────────
  let plan: LifeTickPlan;
  try {
    plan = buildLifeTickPlan(request);
    phaseTraces.push({
      phase: "passive_recovery",
      executed: true,
      changedStateKeys: [],
      warnings: [],
      reasons: ["Life tick plan built successfully.", `Plan ID: ${plan.id}`],
    });
    allReasons.push(`Scheduler: plan built (${plan.timeScale}, seed=${plan.seed}).`);
  } catch (err) {
    allWarnings.push(`Scheduler failed: ${String(err)}`);
    phaseTraces.push({
      phase: "passive_recovery",
      executed: false,
      changedStateKeys: [],
      warnings: [String(err)],
      reasons: ["Scheduler failed to build plan."],
    });
    // Return early — cannot proceed without a valid plan
    const emptyResult: LifeTickDryRunResult = {
      version: "v10.8",
      applied: false,
      request,
      plan: {
        id: "error",
        characterId: request.characterId,
        elapsedHours: request.elapsedHours,
        phaseSequence: [],
        timeScale: "short",
        seed: seed,
        dryRun: true,
        warnings: [String(err)],
        reasons: [],
      },
      trace: {
        id: "error",
        characterId: request.characterId,
        planId: "error",
        elapsedHours: request.elapsedHours,
        observed: request.observed,
        phaseTraces,
        generatedInternalEvents: [],
        selfActionCandidates: [],
        stateChanged: false,
        warnings: allWarnings,
        reasons: allReasons,
        createdAt: new Date().toISOString(),
      },
      projectedLifeState: {
        energyFatigue: { ...DEFAULT_ENERGY_FATIGUE_STATE },
        sleepWake: { ...DEFAULT_SLEEP_WAKE_STATE },
        boredomExpansion: { ...DEFAULT_BOREDOM_EXPANSION_STATE },
        dreamFragments: [],
        inspirationSeeds: [],
        selfActionCandidates: [],
      },
      warnings: allWarnings,
      reasons: allReasons,
    };
    return emptyResult;
  }

  allWarnings.push(...plan.warnings);

  // ── Phase 2: Energy / Fatigue ───────────────────────────────────────
  const isResting = isSleepPhase(DEFAULT_SLEEP_WAKE_STATE.phase);
  const efCtx = buildEnergyFatigueContextFromCharacter(
    state,
    request.elapsedHours,
    isResting
  );
  const efTrace = tickEnergyFatigue(DEFAULT_ENERGY_FATIGUE_STATE, efCtx);
  const projectedEnergyFatigue = efTrace.after;
  allWarnings.push(...efTrace.warnings);
  allReasons.push(`Energy/fatigue: energy=${projectedEnergyFatigue.energy.toFixed(2)}, fatigue=${projectedEnergyFatigue.fatigue.toFixed(2)}.`);

  phaseTraces.push({
    phase: "energy_fatigue",
    executed: true,
    changedStateKeys: ["energyFatigue.energy", "energyFatigue.fatigue", "energyFatigue.sleepPressure", "energyFatigue.restDebt"],
    warnings: efTrace.warnings,
    reasons: efTrace.reasons,
  });

  // ── Phase 3: Sleep / Wake ───────────────────────────────────────────
  const swCtx = buildSleepWakeContext({
    elapsedHours: request.elapsedHours,
    localHour,
    energyFatigue: projectedEnergyFatigue,
    stressLoad: clamp01(state.boundary.stressLoad),
    resilience: clamp01(state.metaState.resilience),
  });
  const swTrace = tickSleepWake(DEFAULT_SLEEP_WAKE_STATE, swCtx);
  const projectedSleepWake = swTrace.after;
  allWarnings.push(...swTrace.warnings);
  allReasons.push(`Sleep/wake: phase=${projectedSleepWake.phase}, quality=${projectedSleepWake.sleepQuality.toFixed(2)}.`);

  phaseTraces.push({
    phase: "attention_drift",
    executed: true,
    changedStateKeys: ["sleepWake.phase", "sleepWake.sleepQuality", "sleepWake.hoursAsleep", "sleepWake.hoursSinceSleep"],
    warnings: swTrace.warnings,
    reasons: swTrace.reasons,
  });

  // ── Phase 4: Dream ──────────────────────────────────────────────────
  const dreamCtx = buildDreamContextFromCharacter({
    state,
    sleepWake: projectedSleepWake,
    energyFatigue: projectedEnergyFatigue,
    seed: seed + ":dream",
  });
  const dreamSources = selectDreamSources({
    memories: state.memories.map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
      recency: m.recency,
      emotion: "neutral",
    })),
    beliefs: state.beliefStates.map((b, i) => ({
      id: b.id ?? `belief-${i}`,
      content: b.content,
      strength: b.strength,
    })),
    needs: [],
    clusters: Array.from(state.clusters.values()).map((c, i) => ({
      id: c.id ?? `cluster-${i}`,
      category: c.category ?? "general",
      mass: c.mass ?? 0.3,
      stability: c.stability ?? 0.5,
    })),
  });
  const dreamTrace = generateDreamFragment(dreamCtx, dreamSources);
  const dreamFragments: DreamFragment[] =
    dreamTrace.fragment ? [dreamTrace.fragment] : [];
  allWarnings.push(...dreamTrace.warnings);
  allReasons.push(
    dreamTrace.fragment
      ? `Dream: fragment generated (tone="${dreamTrace.fragment.tone}").`
      : "Dream: no fragment generated (not sleeping or no sources)."
  );

  phaseTraces.push({
    phase: "memory_resurfacing",
    executed: true,
    changedStateKeys: [],
    warnings: dreamTrace.warnings,
    reasons: dreamTrace.reasons,
  });

  // ── Phase 5: Boredom Expansion + Inspiration Seeds ──────────────────
  const boredomCtx = buildBoredomExpansionContextFromCharacter({
    state,
    energyFatigue: projectedEnergyFatigue,
    sleepWake: projectedSleepWake,
    elapsedHours: request.elapsedHours,
    stimulationLevel,
    socialContactLevel,
  });
  const boredomTrace = tickBoredomExpansion(
    DEFAULT_BOREDOM_EXPANSION_STATE,
    boredomCtx
  );
  const projectedBoredom = boredomTrace.after;
  allWarnings.push(...boredomTrace.warnings);
  allReasons.push(
    `Boredom: boredom=${projectedBoredom.boredom.toFixed(2)}, restlessness=${projectedBoredom.restlessness.toFixed(2)}.`
  );

  const inspirationSeeds = generateInspirationSeedCandidates({
    boredomState: projectedBoredom,
    dreamFragment: dreamFragments[0] ?? null,
    memorySourceCount: state.memories.length,
    curiosity: clamp01(state.metaState.curiosity),
    seed: seed + ":insp",
  });
  allReasons.push(
    `Inspiration: ${inspirationSeeds.length} seed(s) generated.`
  );

  phaseTraces.push({
    phase: "inspiration_check",
    executed: true,
    changedStateKeys: [
      "boredomExpansion.*",
      "inspirationSeeds",
    ],
    warnings: boredomTrace.warnings,
    reasons: [
      ...boredomTrace.reasons,
      ...inspirationSeeds.map((s) => `Seed "${s.type}": prob=${s.probability.toFixed(2)}`),
    ],
  });

  // ── Phase 6: Random Thought ─────────────────────────────────────────
  const rtSources = selectRandomThoughtSources({
    memories: state.memories.map((m) => ({
      id: m.id,
      content: m.content,
      importance: m.importance,
      recency: m.recency,
      emotion: "neutral",
    })),
    beliefs: state.beliefStates.map((b, i) => ({
      id: b.id ?? `belief-${i}`,
      content: b.content,
      strength: b.strength,
    })),
    needs: [],
    dreamFragment: dreamFragments[0] ?? null,
    inspirationSeeds,
    boredomState: projectedBoredom,
  });
  const rtCtx = buildRandomThoughtContextFromCharacter({
    state,
    boredomState: projectedBoredom,
    energyFatigue: projectedEnergyFatigue,
    sleepWake: projectedSleepWake,
    seed: seed + ":rt",
  });
  const rtTrace = generateRandomThought(rtCtx, rtSources);
  const randomThought: RandomThought | undefined =
    rtTrace.thought.kind !== "nothing" ? rtTrace.thought : undefined;
  allWarnings.push(...rtTrace.warnings);
  allReasons.push(
    randomThought
      ? `Random thought: kind="${randomThought.kind}", phrase="${randomThought.phrase}".`
      : "Random thought: none generated."
  );

  phaseTraces.push({
    phase: "random_thought",
    executed: true,
    changedStateKeys: [],
    warnings: rtTrace.warnings,
    reasons: rtTrace.reasons,
  });

  // ── Phase 7: Self-Action Candidates ─────────────────────────────────
  const sacCtxInput: Parameters<typeof buildSelfActionCandidateContextFromCharacter>[0] = {
    state,
    energyFatigue: projectedEnergyFatigue,
    sleepWake: projectedSleepWake,
    boredomState: projectedBoredom,
    inspirationSeeds,
    elapsedHours: request.elapsedHours,
  };
  if (randomThought?.kind !== undefined) {
    sacCtxInput.randomThoughtKind = randomThought.kind;
  }
  if (randomThought?.actionPotential != null) {
    sacCtxInput.randomThoughtActionPotential = randomThought.actionPotential;
  }
  if (randomThought?.phrase !== undefined) {
    sacCtxInput.randomThoughtPhrase = randomThought.phrase;
  }
  const sacCtx = buildSelfActionCandidateContextFromCharacter(sacCtxInput);
  const sacTrace = generateSelfActionCandidates(sacCtx, {
    includeSuppressed: true,
  });
  allWarnings.push(...sacTrace.warnings);
  allReasons.push(
    `Self-action: ${sacTrace.candidates.length} candidate(s), ${sacTrace.suppressedCandidates.length} suppressed.`
  );

  phaseTraces.push({
    phase: "self_action_candidate",
    executed: true,
    changedStateKeys: [],
    warnings: sacTrace.warnings,
    reasons: [
      ...sacTrace.reasons,
      ...sacTrace.candidates.map(
        (c) => `${c.type}: score=${c.score.toFixed(2)}, strength=${c.strength.toFixed(2)}`
      ),
    ],
  });

  // ── Phase 8: Summary ────────────────────────────────────────────────
  const summaryReasons = [
    `Life tick dry-run complete for character "${request.characterId}".`,
    `Elapsed: ${request.elapsedHours}h, time scale: ${plan.timeScale}.`,
    `Energy: ${projectedEnergyFatigue.energy.toFixed(2)}, fatigue: ${projectedEnergyFatigue.fatigue.toFixed(2)}.`,
    `Sleep phase: ${projectedSleepWake.phase}, quality: ${projectedSleepWake.sleepQuality.toFixed(2)}.`,
    `Boredom: ${projectedBoredom.boredom.toFixed(2)}, inspiration seeds: ${inspirationSeeds.length}.`,
    `Self-action candidates: ${sacTrace.candidates.length} active, ${sacTrace.suppressedCandidates.length} suppressed.`,
  ];

  phaseTraces.push({
    phase: "trace_summary",
    executed: true,
    changedStateKeys: [],
    warnings: [],
    reasons: summaryReasons,
  });

  // ── Assemble result ─────────────────────────────────────────────────
  const projectedLifeState: ProjectedLifeState = {
    energyFatigue: projectedEnergyFatigue,
    sleepWake: projectedSleepWake,
    boredomExpansion: projectedBoredom,
    dreamFragments,
    inspirationSeeds,
    selfActionCandidates: sacTrace.candidates,
  };
  if (randomThought) {
    projectedLifeState.randomThought = randomThought;
  }

  const tickTrace: LifeTickTrace = {
    id: `trace-${plan.id}`,
    characterId: request.characterId,
    planId: plan.id,
    elapsedHours: request.elapsedHours,
    observed: request.observed,
    phaseTraces,
    generatedInternalEvents: internalEvents,
    selfActionCandidates: sacTrace.candidates.map((c) => ({
      id: c.id,
      type: c.type,
      probability: c.score,
      sourcePhase: "self_action_candidate",
      reasons: c.reasons,
      evaluated: false,
    })),
    stateChanged: false,
    warnings: allWarnings,
    reasons: allReasons,
    createdAt: new Date().toISOString(),
  };

  return {
    version: "v10.8",
    applied: false,
    request,
    plan,
    trace: tickTrace,
    projectedLifeState,
    warnings: allWarnings,
    reasons: allReasons,
  };
}
