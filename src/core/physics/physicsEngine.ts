import { assimilateMemoryIntoBeliefs } from "../belief/beliefEvolution";
import type { BeliefState } from "../belief/beliefState";
import { calculateImpactScore, impactScore as createImpactScore, type ImpactScore } from "../benchmark/impact";
import { clamp01, round4 } from "../parameters/parameterMath";
import {
  CURRENT_MODEL_PARAMETER_SET_VERSION,
  getCurrentModelParameterSet,
  getModelParameterSet,
  type ModelParameterSet,
  type PersonalityModelParameters,
} from "../parameters/modelParameterRegistry";
import { defaultBiologicalNature, type BiologicalNature } from "../biological/nature";
import { defaultBoredomState, type BoredomState } from "../boredom/boredomSystem";
import type { CharacterIdentity } from "../character/characterBlueprint";
import {
  applyBoundaryImpact,
  createPsychologicalBoundary,
  type BoundaryImpactResult,
  type PsychologicalBoundary
} from "../boundary/psychologicalBoundary";
import {
  absorbImpactParticle,
  createImpactCluster,
  type ImpactCluster,
  type ImpactParticle
} from "../cluster/impactCluster";
import type { CoordinateDriftResult } from "../drift/coordinateDrift";
import type { EmotionState } from "../emotion/emotion";
import { getEventCategoryPhysics } from "../event/categoryPhysics";
import type { ExperienceEvent } from "../event/event";
import { classifyEventCategory, resolveEventCategory } from "../event/eventCategoryClassifier";
import type { EventImpactVector } from "../event/impactVector";
import { syncClustersWithGalaxyMetrics, syncClusterWithGalaxyMetrics } from "../galaxy/clusterMetrics";
import { simulatePersonalityGalaxyStep, type PersonalityGalaxySnapshot } from "../galaxy/personalityGalaxyEngine";
import { createMemoryNode } from "../memory/memorySystem";
import type { MemoryNode } from "../memory/memoryNode";
import { defaultMetaState, type MetaState } from "../meta/metaState";
import { deriveBeliefs } from "../belief/beliefState";
import { BASE_PERSONALITY_KEYS } from "../personality/dimensions";
import {
  activateProceduralMemory,
  reinforceProceduralRoutine,
  type ProceduralActivation,
  type ProceduralRoutine
} from "../procedural/proceduralMemory";
import { defaultHomeostasisState, type HomeostasisState } from "../homeostasis/homeostasis";
import {
  defaultRewardState,
  processReward,
  type RewardInput,
  type RewardResult,
  type RewardState
} from "../reward/rewardSystem";
import { perceiveEventTime, type TimePerceptionTrace } from "../time/timePerception";
import { runContinuousTick } from "../time/continuousTick";
import {
  commitEventTemporalState,
  createCharacterTemporalState,
  personalityVelocityRetention,
  planEventTemporalSemantics,
  type CharacterTemporalState,
  type EventTemporalPlan,
  type EventTemporalRecoverySummary,
  type EventTemporalTrace,
} from "../time/eventTemporalSemantics";
import { interpretEvent, type WorldModelInterpretation } from "../worldmodel/worldModel";
import { evaluateEventAttention, type AttentionEvaluation } from "../attention/attentionSystem";
import {
  bigFiveFromCoordinate,
  coordinateFromBigFive,
  neutralCoordinate,
  zeroCoordinateDelta,
  type BigFiveVector,
  type PersonalityCoordinateValues,
  type PersonalityCoordinate
} from "../personality/coordinate";

export interface CharacterPhysicsState {
  identity: CharacterIdentity;
  metaState: MetaState;
  biologicalNature: BiologicalNature;
  boundary: PsychologicalBoundary;
  coordinate: PersonalityCoordinate;
  velocity: PersonalityCoordinate;
  personality: BigFiveVector;
  clusters: Map<string, ImpactCluster>;
  particles: ImpactParticle[];
  memories: MemoryNode[];
  beliefStates: BeliefState[];
  proceduralRoutines: ProceduralRoutine[];
  rewardState: RewardState;
  homeostasisState: HomeostasisState;
  boredomState: BoredomState;
  temporal: CharacterTemporalState;
  parameterSetVersion: string;
  learningRate: number;
}

export interface PhysicsStepResult {
  event: ExperienceEvent;
  emotion: EmotionState;
  impactScore: ImpactScore;
  particle: ImpactParticle;
  memoryNode: MemoryNode;
  cluster: ImpactCluster;
  coordinateDrift: CoordinateDriftResult;
  boundaryImpact: BoundaryImpactResult;
  galaxyStep: PersonalityGalaxySnapshot;
  proceduralActivations: ProceduralActivation[];
  rewardResult: RewardResult;
  timePerception: TimePerceptionTrace;
  worldInterpretation: WorldModelInterpretation;
  /** Per-event attention evaluation — diagnostic only, does NOT modify personality. */
  attentionEvaluation: AttentionEvaluation;
  /** Elapsed-time recovery and event-density saturation applied before this step. */
  temporalSemantics: EventTemporalTrace;
}

export function createCharacterPhysicsState(params?: {
  identity?: CharacterIdentity;
  biologicalNature?: BiologicalNature;
  metaState?: MetaState;
  boundary?: PsychologicalBoundary;
  coordinate?: PersonalityCoordinate;
  personality?: BigFiveVector;
  velocity?: PersonalityCoordinate;
  proceduralRoutines?: ProceduralRoutine[];
  beliefStates?: BeliefState[];
  rewardState?: RewardState;
  homeostasisState?: HomeostasisState;
  boredomState?: BoredomState;
  temporal?: CharacterTemporalState;
  parameterSet?: ModelParameterSet;
  parameterSetVersion?: string;
  learningRate?: number;
}): CharacterPhysicsState {
  const parameterSetVersion =
    params?.parameterSetVersion ?? params?.parameterSet?.version ?? CURRENT_MODEL_PARAMETER_SET_VERSION;
  const parameterSet = params?.parameterSet ?? getModelParameterSet(parameterSetVersion);
  if (parameterSet.version !== parameterSetVersion) {
    throw new Error(
      `Requested parameter set ${parameterSetVersion} does not match provided set ${parameterSet.version}`,
    );
  }
  const coordinate =
    params?.coordinate ?? (params?.personality ? coordinateFromBigFive(params.personality) : neutralCoordinate());
  return {
    identity: params?.identity ?? {
      id: "anonymous",
      name: "Anonymous",
      description: "A character without a configured blueprint.",
      tags: []
    },
    metaState: params?.metaState ?? defaultMetaState(),
    biologicalNature: params?.biologicalNature ?? defaultBiologicalNature(),
    boundary: params?.boundary ?? createPsychologicalBoundary({}, parameterSet.boundary),
    coordinate,
    velocity: params?.velocity ?? zeroCoordinateDelta(),
    personality: params?.personality ?? bigFiveFromCoordinate(coordinate),
    clusters: new Map(),
    particles: [],
    memories: [],
    beliefStates: params?.beliefStates ?? [],
    proceduralRoutines: params?.proceduralRoutines ?? [],
    rewardState: params?.rewardState ?? defaultRewardState(),
    homeostasisState: params?.homeostasisState ?? defaultHomeostasisState(),
    boredomState: params?.boredomState ?? defaultBoredomState(),
    temporal: createCharacterTemporalState(params?.temporal, parameterSet.temporal),
    parameterSetVersion,
    learningRate: params?.learningRate ?? parameterSet.personality.defaultLearningRate
  };
}

export class CharacterPhysicsEngine {
  readonly parameterSet: ModelParameterSet | null;

  constructor(params: { parameterSet?: ModelParameterSet } = {}) {
    this.parameterSet = params.parameterSet ?? null;
  }

  processEvent(state: CharacterPhysicsState, event: ExperienceEvent): PhysicsStepResult {
    const parameterSet = this.resolveParameterSet(state);
    const category = resolveEventCategory(event);
    const resolvedEvent = event.category === category ? event : { ...event, category };
    const rawImpactScore = calculateEventImpactScore(resolvedEvent);
    const temporalPlan = planEventTemporalSemantics({
      temporal: state.temporal,
      event: resolvedEvent,
      category,
      rawImpactValue: rawImpactScore.value,
      parameters: parameterSet.temporal,
    });
    const temporalRecovery = applyElapsedTimeRecovery(state, temporalPlan, parameterSet);
    const temporalEvent = eventWithResolvedTime(resolvedEvent, temporalPlan);
    const impactScore = createImpactScore(temporalPlan.effectiveImpactValue);
    const emotion = inferEmotion(temporalEvent, impactScore);
    const particle = createParticleForEvent(
      temporalEvent,
      category,
      emotion,
      impactScore,
      nextOccurrenceId(`particle_${resolvedEvent.id}`, state.particles.map((item) => item.id)),
    );
    const { cluster, memoryNode } = absorbEventIntoMemoryGalaxy({
      state,
      event: temporalEvent,
      category,
      particle,
      impactScore,
      emotion,
      parameterSet,
    });
    const boundaryImpact = applyEventBoundaryImpact({ state, event: temporalEvent, impactScore, parameterSet });
    const proceduralActivations = updateProceduralRoutinesForEvent({ state, event: temporalEvent });
    const rewardResult = updateRewardForEvent({ state, event: temporalEvent, category, proceduralActivations });
    const timePerception = perceiveEventTime({
      event: temporalEvent,
      emotion,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState
    });
    const worldInterpretation = interpretEventWithCurrentBeliefs({ state, event: temporalEvent, emotion, timePerception });
    const attentionEvaluation = evaluateEventAttention({
      event: temporalEvent,
      meta: state.metaState,
      boundary: state.boundary
    });
    const { galaxyStep, coordinateDrift } = applyGalaxyDrift({
      state,
      boundaryImpact,
      category,
      impactScore,
      parameterSet,
    });
    state.temporal = commitEventTemporalState({
      temporal: state.temporal,
      event: temporalEvent,
      category,
      plan: temporalPlan,
      parameters: parameterSet.temporal,
    });
    const temporalSemantics: EventTemporalTrace = {
      ...temporalPlan,
      parameterSetVersion: parameterSet.version,
      parameterSetFingerprint: parameterSet.fingerprint,
      recovery: temporalRecovery,
      clockAfter: state.temporal.lastProcessedAt,
      processedEventCountAfter: state.temporal.processedEventCount,
    };

    return {
      event: temporalEvent,
      emotion,
      impactScore,
      particle,
      memoryNode,
      cluster,
      coordinateDrift,
      boundaryImpact,
      galaxyStep,
      proceduralActivations,
      rewardResult,
      timePerception,
      worldInterpretation,
      attentionEvaluation,
      temporalSemantics,
    };
  }

  private resolveParameterSet(state: CharacterPhysicsState): ModelParameterSet {
    if (this.parameterSet) {
      if (state.parameterSetVersion !== this.parameterSet.version) {
        throw new Error(
          `Character state parameter set ${state.parameterSetVersion} does not match engine set ${this.parameterSet.version}`,
        );
      }
      return this.parameterSet;
    }
    return getModelParameterSet(state.parameterSetVersion);
  }
}

function eventWithResolvedTime(
  event: ExperienceEvent,
  plan: EventTemporalPlan,
): ExperienceEvent {
  const { occurredAt: _ignored, ...withoutTime } = event;
  return plan.resolvedOccurredAt
    ? { ...withoutTime, occurredAt: plan.resolvedOccurredAt }
    : withoutTime;
}

function calculateEventImpactScore(event: ExperienceEvent): ImpactScore {
  return calculateImpactScore({
    intensity: event.intensity,
    importance: event.importance,
    relationshipWeight: event.relationshipWeight,
    expectationGap: event.expectationGap,
    personalitySensitivity: event.personalitySensitivity
  });
}

function createParticleForEvent(
  event: ExperienceEvent,
  category: string,
  emotion: EmotionState,
  impactScore: ImpactScore,
  particleId: string,
): ImpactParticle {
  return {
    id: particleId,
    description: event.description,
    vector: impactVector(category, emotion, event),
    impactScore: impactScore.value,
    emotion: emotion.primary,
    category
  };
}

function absorbEventIntoMemoryGalaxy(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
  category: string;
  particle: ImpactParticle;
  impactScore: ImpactScore;
  emotion: EmotionState;
  parameterSet: ModelParameterSet;
}): { cluster: ImpactCluster; memoryNode: MemoryNode } {
  const existingCluster =
    params.state.clusters.get(params.category) ?? createImpactCluster(`cluster_${params.category}`, params.category);
  const absorbedCluster = absorbImpactParticle(existingCluster, params.particle);
  params.state.clusters.set(params.category, absorbedCluster);
  params.state.particles.push(params.particle);

  const memoryNode = createMemoryNode({
    id: params.particle.id.replace(/^particle_/, "memory_"),
    event: params.event,
    particle: params.particle,
    impactScore: params.impactScore,
    emotion: params.emotion,
    clusterId: absorbedCluster.id,
    ...(params.event.occurredAt ? { timeStamp: params.event.occurredAt } : {}),
    // Each runtime event is already represented by its own MemoryNode.
    // Repetition counts above 1 are reserved for imported aggregate memories.
    repetitionCount: 1
  });
  params.state.memories.push(memoryNode);
  params.state.beliefStates = assimilateMemoryIntoBeliefs(params.state.beliefStates, memoryNode);
  const cluster = syncClusterWithGalaxyMetrics(
    absorbedCluster,
    params.state.memories,
    params.parameterSet.memory,
  );
  params.state.clusters.set(params.category, cluster);
  return { cluster, memoryNode };
}

function applyElapsedTimeRecovery(
  state: CharacterPhysicsState,
  plan: EventTemporalPlan,
  parameterSet: ModelParameterSet,
): EventTemporalRecoverySummary {
  const before = captureTemporalRecoveryState(state);
  const retention = personalityVelocityRetention(plan.elapsedDaysApplied, parameterSet.temporal);

  if (plan.elapsedDaysApplied > 0) {
    runContinuousTick(state, { daysElapsed: plan.elapsedDaysApplied, modelParameters: parameterSet });
    state.clusters = syncClustersWithGalaxyMetrics(state.clusters, state.memories, parameterSet.memory);
    const velocity = zeroCoordinateDelta();
    for (const key of BASE_PERSONALITY_KEYS) {
      velocity.values[key] = round8(state.velocity.values[key] * retention);
    }
    state.velocity = velocity;
  }

  const after = captureTemporalRecoveryState(state);
  return {
    applied: plan.elapsedDaysApplied > 0,
    daysApplied: plan.elapsedDaysApplied,
    boundaryStressBefore: before.boundaryStress,
    boundaryStressAfter: after.boundaryStress,
    averageMemoryRecencyBefore: before.averageMemoryRecency,
    averageMemoryRecencyAfter: after.averageMemoryRecency,
    clusterMassBefore: before.clusterMass,
    clusterMassAfter: after.clusterMass,
    velocityMagnitudeBefore: before.velocityMagnitude,
    velocityMagnitudeAfter: after.velocityMagnitude,
    velocityRetention: retention,
  };
}

function captureTemporalRecoveryState(state: CharacterPhysicsState): {
  boundaryStress: number;
  averageMemoryRecency: number;
  clusterMass: number;
  velocityMagnitude: number;
} {
  const recencyTotal = state.memories.reduce((sum, memory) => sum + memory.recency, 0);
  const clusterMass = [...state.clusters.values()].reduce((sum, cluster) => sum + cluster.mass, 0);
  const velocityMagnitude = Math.sqrt(
    BASE_PERSONALITY_KEYS.reduce((sum, key) => sum + state.velocity.values[key] ** 2, 0),
  );
  return {
    boundaryStress: round4(state.boundary.stressLoad),
    averageMemoryRecency: round4(state.memories.length ? recencyTotal / state.memories.length : 0),
    clusterMass: round4(clusterMass),
    velocityMagnitude: round4(velocityMagnitude),
  };
}

function applyEventBoundaryImpact(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
  impactScore: ImpactScore;
  parameterSet: ModelParameterSet;
}): BoundaryImpactResult {
  const boundaryImpact = applyBoundaryImpact({
    boundary: params.state.boundary,
    nature: params.state.biologicalNature,
    coordinate: params.state.coordinate,
    event: params.event,
    impactScore: params.impactScore,
    parameters: params.parameterSet.boundary,
  });
  params.state.boundary = boundaryImpact.after;
  return boundaryImpact;
}

function updateProceduralRoutinesForEvent(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
}): ProceduralActivation[] {
  const proceduralActivations = activateProceduralMemory({
    routines: params.state.proceduralRoutines,
    cue: { tags: params.event.tags },
    meta: params.state.metaState,
    boundary: params.state.boundary,
    topK: 3
  });
  const activatedRoutineIds = new Map(
    proceduralActivations.map((activation) => [activation.routine.id, activation.activationScore])
  );
  params.state.proceduralRoutines = params.state.proceduralRoutines.map((routine) => {
    const activationScore = activatedRoutineIds.get(routine.id);
    if (activationScore === undefined) return routine;
    return reinforceProceduralRoutine({
      routine,
      success: activationScore,
      timestamp: params.state.memories.length
    });
  });
  return proceduralActivations;
}

function updateRewardForEvent(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
  category: string;
  proceduralActivations: ProceduralActivation[];
}): RewardResult {
  const rewardResult = processReward({
    state: params.state.rewardState,
    input: rewardInputForEvent(params.event, params.category, params.proceduralActivations.length),
    meta: params.state.metaState
  });
  params.state.rewardState = rewardResult.after;
  return rewardResult;
}

function interpretEventWithCurrentBeliefs(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
  emotion: EmotionState;
  timePerception: TimePerceptionTrace;
}): WorldModelInterpretation {
  return interpretEvent({
    event: params.event,
    emotion: params.emotion,
    beliefs: params.state.beliefStates.length ? params.state.beliefStates : deriveBeliefs(params.state.memories),
    coordinate: params.state.coordinate,
    meta: params.state.metaState,
    boundary: params.state.boundary,
    timePerception: params.timePerception
  });
}

function applyGalaxyDrift(params: {
  state: CharacterPhysicsState;
  boundaryImpact: BoundaryImpactResult;
  category: string;
  impactScore: ImpactScore;
  parameterSet: ModelParameterSet;
}): { galaxyStep: PersonalityGalaxySnapshot; coordinateDrift: CoordinateDriftResult } {
  const activation = driftActivationForEvent(
    params.category,
    params.impactScore.value,
    params.parameterSet.personality,
  );
  const learningRate = params.state.learningRate * params.boundaryImpact.driftMultiplier * activation.learningRateScale;
  const galaxyStep = simulatePersonalityGalaxyStep({
    corePosition: params.state.coordinate,
    velocity: params.state.velocity,
    clusters: [...params.state.clusters.values()],
    memories: params.state.memories,
    learningRate,
    momentumAlpha: activation.momentumAlpha,
    memoryParameters: params.parameterSet.memory,
  });
  params.state.velocity = galaxyStep.drift.nextVelocity;
  params.state.coordinate = {
    values: { ...galaxyStep.drift.after.values },
  };

  // V10.72: apply trust repair nudge directly to coordinate AFTER galaxy drift.
  // This is a one-time position offset (not velocity), so it does not
  // persist across subsequent events. Only positive events trigger it.
  const nudge = params.boundaryImpact.repairNudge;
  if (nudge && (nudge.trust !== 0 || nudge.fear !== 0 || nudge.openness !== 0)) {
    const c = params.state.coordinate.values;
    c.trust = clamp01(c.trust + nudge.trust);
    c.fear = clamp01(c.fear + nudge.fear);
    c.openness = clamp01(c.openness + nudge.openness);
  }

  const coordinateDrift: CoordinateDriftResult = {
    before: galaxyStep.drift.before,
    after: params.state.coordinate,
    totalForce: galaxyStep.totalForce,
    learningRate
  };
  params.state.personality = bigFiveFromCoordinate(params.state.coordinate);
  return { galaxyStep, coordinateDrift };
}

function driftActivationForEvent(
  category: string,
  impact: number,
  parameters: PersonalityModelParameters = getCurrentModelParameterSet().personality,
): { learningRateScale: number; momentumAlpha: number } {
  if (category === "general") {
    return {
      learningRateScale: Math.min(
        parameters.generalLearningMax,
        Math.max(parameters.generalLearningMin, impact * parameters.generalImpactScale),
      ),
      momentumAlpha: parameters.generalMomentum,
    };
  }
  if (category === "fatigue") {
    return {
      learningRateScale: parameters.fatigueLearningScale,
      momentumAlpha: parameters.fatigueMomentum,
    };
  }
  if (category === "uncertainty") {
    return {
      learningRateScale: parameters.uncertaintyLearningScale,
      momentumAlpha: parameters.uncertaintyMomentum,
    };
  }
  return {
    learningRateScale:
      parameters.standardLearningBase +
      Math.max(0, Math.min(1, impact)) * parameters.standardImpactScale,
    momentumAlpha: parameters.standardMomentum,
  };
}

export function inferEmotion(event: ExperienceEvent, impactScore: ImpactScore): EmotionState {
  if (event.emotion) {
    return {
      primary: event.emotion,
      valence: event.emotionValence ?? valenceForEmotion(event.emotion),
      arousal: event.emotionArousal ?? arousalForEmotion(event.emotion),
      intensity: impactScore.value
    };
  }

  const categoryTemplate = event.category ? getEventCategoryPhysics(event.category) : undefined;
  if (categoryTemplate) {
    return {
      primary: categoryTemplate.emotion,
      valence: valenceForEmotion(categoryTemplate.emotion),
      arousal: arousalForEmotion(categoryTemplate.emotion),
      intensity: impactScore.value,
    };
  }

  const tags = new Set(event.tags);
  if (hasAny(tags, ["失联", "抛弃", "被抛弃", "等待"])) {
    return { primary: "fear", valence: -0.8, arousal: 0.8, intensity: impactScore.value };
  }
  if (hasAny(tags, ["认可", "成功", "胜利"])) {
    return { primary: "joy", valence: 0.7, arousal: 0.6, intensity: impactScore.value };
  }
  return { primary: "uncertainty", valence: -0.2, arousal: 0.4, intensity: impactScore.value };
}

export function classifyCategory(tags: string[]): string {
  return classifyEventCategory(tags.join(" ")).category;
}

function nextOccurrenceId(baseId: string, existingIds: string[]): string {
  const existing = new Set(existingIds);
  if (!existing.has(baseId)) return baseId;
  let occurrence = 2;
  while (existing.has(`${baseId}_${occurrence}`)) occurrence += 1;
  return `${baseId}_${occurrence}`;
}

export function impactVector(
  category: string,
  emotion: EmotionState,
  event?: ExperienceEvent
): EventImpactVector {
  if (event?.coordinateDelta) {
    return {
      delta: coordinateDeltaFromPartial(event.coordinateDelta),
      category,
      rationale: event.rationale ?? "explicit event physics vector supplied by caller"
    };
  }

  const template = getEventCategoryPhysics(category);
  if (template && category !== "general") {
    return {
      delta: coordinateDeltaFromPartial(template.coordinateDelta),
      category,
      rationale: template.rationale
    };
  }
  return {
    delta: {
      values: {
        openness: 0,
        conscientiousness: 0,
        extroversion: 0,
        agreeableness: 0,
        neuroticism: emotion.valence * -0.01,
        trust: 0,
        attachment: 0,
        fear: Math.abs(emotion.valence) * 0.01,
        control: 0
      }
    },
    category,
    rationale: "general events only create weak mood-colored pressure"
  };
}

function hasAny(values: Set<string>, options: string[]): boolean {
  return options.some((option) => values.has(option));
}

function coordinateDeltaFromPartial(delta: Partial<PersonalityCoordinateValues>): PersonalityCoordinate {
  const coordinate = zeroCoordinateDelta();
  for (const key of BASE_PERSONALITY_KEYS) {
    coordinate.values[key] = delta[key] ?? 0;
  }
  return coordinate;
}

function valenceForEmotion(emotion: string): number {
  if (["joy", "relief", "trust", "love", "calm"].includes(emotion)) return 0.7;
  if (["fear", "anger", "sadness", "shame", "anxiety"].includes(emotion)) return -0.8;
  // V10.73: fatigue is mildly negative
  if (emotion === "fatigue") return -0.3;
  return -0.2;
}

function round8(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function arousalForEmotion(emotion: string): number {
  if (["anger", "fear", "anxiety"].includes(emotion)) return 0.8;
  if (["joy", "relief"].includes(emotion)) return 0.55;
  if (["calm"].includes(emotion)) return 0.25;
  // V10.73: fatigue has low arousal
  if (emotion === "fatigue") return 0.2;
  if (emotion === "shame") return 0.45;
  return 0.4;
}

function rewardInputForEvent(
  event: ExperienceEvent,
  category: string,
  proceduralActivationCount: number
): RewardInput {
  if (category === "support") {
    return {
      kind: "attachment",
      intensity: event.importance * 0.82 + event.relationshipWeight * 0.12,
      novelty: Math.max(0.12, 1 - event.expectationGap * 0.55),
      repetitionCount: proceduralActivationCount,
      harmful: false
    };
  }
  if (category === "success") {
    return {
      kind: "achievement",
      intensity: event.importance * 0.8,
      novelty: 0.5,
      repetitionCount: proceduralActivationCount,
      harmful: false
    };
  }
  if (category === "abandonment" || category === "betrayal") {
    return {
      kind: "relief",
      intensity: proceduralActivationCount > 0 ? 0.42 : 0.16,
      novelty: 0.12,
      repetitionCount: proceduralActivationCount + 4,
      harmful: proceduralActivationCount > 0
    };
  }
  return {
    kind: "habit",
    intensity: event.importance * 0.35,
    novelty: 0.35,
    repetitionCount: proceduralActivationCount,
    harmful: false
  };
}
