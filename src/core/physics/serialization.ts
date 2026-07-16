import { createImpactCluster, type ImpactCluster, type ImpactParticle } from "../cluster/impactCluster";
import type { BeliefState } from "../belief/beliefState";
import type { BiologicalNature } from "../biological/nature";
import type { BoredomState } from "../boredom/boredomSystem";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import { simulatePersonalityGalaxyStep, type PersonalityGalaxySnapshot } from "../galaxy/personalityGalaxyEngine";
import type { MemoryNode } from "../memory/memoryNode";
import type { MetaState } from "../meta/metaState";
import type { BigFiveVector, PersonalityCoordinate } from "../personality/coordinate";
import type { ProceduralRoutine } from "../procedural/proceduralMemory";
import type { RewardState } from "../reward/rewardSystem";
import type { HomeostasisState } from "../homeostasis/homeostasis";
import { deriveCharacterState, type DerivedCharacterState } from "../state/derivedCharacterState";
import { createCharacterPhysicsState, type CharacterPhysicsState } from "./physicsEngine";
import type { CharacterIdentity } from "../character/characterBlueprint";
import type { CharacterTemporalState } from "../time/eventTemporalSemantics";
import {
  LEGACY_MODEL_PARAMETER_SET_VERSION,
  getModelParameterSet,
} from "../parameters/modelParameterRegistry";

export interface SerializedImpactCluster {
  id: string;
  category: string;
  centerCoordinate: PersonalityCoordinate;
  centerVector: BigFiveVector;
  mass: number;
  density: number;
  stability: number;
  age: number;
  particleIds: string[];
}

export interface SerializedCharacterPhysicsState {
  identity?: CharacterIdentity;
  metaState?: MetaState;
  biologicalNature?: BiologicalNature;
  boundary?: PsychologicalBoundary;
  coordinate: PersonalityCoordinate;
  velocity?: PersonalityCoordinate;
  personality: BigFiveVector;
  clusters: SerializedImpactCluster[];
  particles: ImpactParticle[];
  memories: MemoryNode[];
  beliefStates?: BeliefState[];
  proceduralRoutines?: ProceduralRoutine[];
  rewardState?: RewardState;
  homeostasisState?: HomeostasisState;
  boredomState?: BoredomState;
  temporal?: CharacterTemporalState;
  parameterSetVersion?: string;
  learningRate: number;
  derived: DerivedCharacterState;
  galaxy: PersonalityGalaxySnapshot;
}

export function serializeCharacterPhysicsState(
  state: CharacterPhysicsState
): SerializedCharacterPhysicsState {
  return {
    identity: state.identity,
    metaState: state.metaState,
    coordinate: state.coordinate,
    biologicalNature: state.biologicalNature,
    boundary: state.boundary,
    velocity: state.velocity,
    personality: state.personality,
    clusters: [...state.clusters.values()].map(serializeCluster),
    particles: state.particles,
    memories: state.memories,
    beliefStates: state.beliefStates,
    proceduralRoutines: state.proceduralRoutines,
    rewardState: state.rewardState,
    homeostasisState: state.homeostasisState,
    boredomState: state.boredomState,
    temporal: state.temporal,
    parameterSetVersion: state.parameterSetVersion,
    learningRate: state.learningRate,
    derived: deriveCharacterState(state),
    galaxy: simulatePersonalityGalaxyStep({
      corePosition: state.coordinate,
      velocity: state.velocity,
      clusters: [...state.clusters.values()],
      memories: state.memories,
      learningRate: state.learningRate,
      memoryParameters: getModelParameterSet(state.parameterSetVersion).memory,
    })
  };
}

export function deserializeCharacterPhysicsState(
  serialized: SerializedCharacterPhysicsState
): CharacterPhysicsState {
  const stateParams: Parameters<typeof createCharacterPhysicsState>[0] = {
    ...(serialized.identity ? { identity: serialized.identity } : {}),
    coordinate: serialized.coordinate,
    personality: serialized.personality,
    parameterSetVersion: serialized.parameterSetVersion ?? LEGACY_MODEL_PARAMETER_SET_VERSION,
    learningRate: serialized.learningRate
  };
  if (serialized.biologicalNature) {
    stateParams.biologicalNature = serialized.biologicalNature;
  }
  if (serialized.boundary) {
    stateParams.boundary = serialized.boundary;
  }
  if (serialized.metaState) {
    stateParams.metaState = serialized.metaState;
  }
  if (serialized.velocity) {
    stateParams.velocity = serialized.velocity;
  }
  if (serialized.beliefStates) {
    stateParams.beliefStates = serialized.beliefStates;
  }
  if (serialized.rewardState) {
    stateParams.rewardState = serialized.rewardState;
  }
  if (serialized.homeostasisState) {
    stateParams.homeostasisState = serialized.homeostasisState;
  }
  if (serialized.boredomState) {
    stateParams.boredomState = serialized.boredomState;
  }
  if (serialized.temporal) {
    stateParams.temporal = serialized.temporal;
  }
  const state = createCharacterPhysicsState(stateParams);
  state.particles = [...serialized.particles];
  state.memories = [...serialized.memories];
  state.proceduralRoutines = [...(serialized.proceduralRoutines ?? [])];
  state.clusters = new Map(
    serialized.clusters.map((cluster) => [cluster.category, deserializeCluster(cluster)])
  );
  return state;
}

function serializeCluster(cluster: ImpactCluster): SerializedImpactCluster {
  return {
    id: cluster.id,
    category: cluster.category,
    centerCoordinate: cluster.centerCoordinate,
    centerVector: cluster.centerVector,
    mass: cluster.mass,
    density: cluster.density,
    stability: cluster.stability,
    age: cluster.age,
    particleIds: cluster.particleIds
  };
}

function deserializeCluster(serialized: SerializedImpactCluster): ImpactCluster {
  return {
    ...createImpactCluster(serialized.id, serialized.category),
    centerCoordinate: serialized.centerCoordinate,
    centerVector: serialized.centerVector,
    mass: serialized.mass,
    density: serialized.density,
    stability: serialized.stability,
    age: serialized.age,
    particleIds: [...serialized.particleIds]
  };
}
