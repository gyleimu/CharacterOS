import { assimilateMemoryIntoBeliefs } from "../belief/beliefEvolution";
import type { BeliefState } from "../belief/beliefState";
import { calculateImpactScore, type ImpactScore } from "../benchmark/impact";
import { clamp01, round4 } from "../parameters/parameterMath";
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
import type { EventImpactVector } from "../event/impactVector";
import { syncClusterWithGalaxyMetrics } from "../galaxy/clusterMetrics";
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
  learningRate?: number;
}): CharacterPhysicsState {
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
    boundary: params?.boundary ?? createPsychologicalBoundary(),
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
    learningRate: params?.learningRate ?? 0.03
  };
}

export class CharacterPhysicsEngine {
  processEvent(state: CharacterPhysicsState, event: ExperienceEvent): PhysicsStepResult {
    const impactScore = calculateEventImpactScore(event);
    const emotion = inferEmotion(event, impactScore);
    const category = event.category ?? classifyCategory(event.tags);
    const particle = createParticleForEvent(event, category, emotion, impactScore);
    const { cluster, memoryNode } = absorbEventIntoMemoryGalaxy({
      state,
      event,
      category,
      particle,
      impactScore,
      emotion
    });
    const boundaryImpact = applyEventBoundaryImpact({ state, event, impactScore });
    const proceduralActivations = updateProceduralRoutinesForEvent({ state, event });
    const rewardResult = updateRewardForEvent({ state, event, category, proceduralActivations });
    const timePerception = perceiveEventTime({
      event,
      emotion,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState
    });
    const worldInterpretation = interpretEventWithCurrentBeliefs({ state, event, emotion, timePerception });
    const attentionEvaluation = evaluateEventAttention({
      event,
      meta: state.metaState,
      boundary: state.boundary
    });
    const { galaxyStep, coordinateDrift } = applyGalaxyDrift({ state, boundaryImpact });

    return {
      event,
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
      attentionEvaluation
    };
  }
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
  impactScore: ImpactScore
): ImpactParticle {
  return {
    id: `particle_${event.id}`,
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
}): { cluster: ImpactCluster; memoryNode: MemoryNode } {
  const existingCluster =
    params.state.clusters.get(params.category) ?? createImpactCluster(`cluster_${params.category}`, params.category);
  const absorbedCluster = absorbImpactParticle(existingCluster, params.particle);
  params.state.clusters.set(params.category, absorbedCluster);
  params.state.particles.push(params.particle);

  const memoryNode = createMemoryNode({
    event: params.event,
    particle: params.particle,
    impactScore: params.impactScore,
    emotion: params.emotion,
    clusterId: absorbedCluster.id,
    repetitionCount: absorbedCluster.age
  });
  params.state.memories.push(memoryNode);
  params.state.beliefStates = assimilateMemoryIntoBeliefs(params.state.beliefStates, memoryNode);
  const cluster = syncClusterWithGalaxyMetrics(absorbedCluster, params.state.memories);
  params.state.clusters.set(params.category, cluster);
  return { cluster, memoryNode };
}

function applyEventBoundaryImpact(params: {
  state: CharacterPhysicsState;
  event: ExperienceEvent;
  impactScore: ImpactScore;
}): BoundaryImpactResult {
  const boundaryImpact = applyBoundaryImpact({
    boundary: params.state.boundary,
    nature: params.state.biologicalNature,
    coordinate: params.state.coordinate,
    event: params.event,
    impactScore: params.impactScore
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
}): { galaxyStep: PersonalityGalaxySnapshot; coordinateDrift: CoordinateDriftResult } {
  const learningRate = params.state.learningRate * params.boundaryImpact.driftMultiplier;
  const galaxyStep = simulatePersonalityGalaxyStep({
    corePosition: params.state.coordinate,
    velocity: params.state.velocity,
    clusters: [...params.state.clusters.values()],
    memories: params.state.memories,
    learningRate
  });
  const coordinateDrift: CoordinateDriftResult = {
    before: galaxyStep.drift.before,
    after: galaxyStep.drift.after,
    totalForce: galaxyStep.totalForce,
    learningRate
  };
  params.state.velocity = galaxyStep.drift.nextVelocity;
  params.state.coordinate = coordinateDrift.after;

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

  params.state.personality = bigFiveFromCoordinate(params.state.coordinate);
  return { galaxyStep, coordinateDrift };
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
  const tagSet = new Set(tags);
  if (hasAny(tagSet, ["失联", "抛弃", "被抛弃", "等待"])) return "abandonment";
  if (hasAny(tagSet, ["欺骗", "背叛"])) return "betrayal";
  if (hasAny(tagSet, ["认可", "成功", "胜利", "晋升"])) return "success";
  return "general";
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
