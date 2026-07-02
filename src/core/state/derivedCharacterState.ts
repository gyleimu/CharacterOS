import { deriveBeliefs, type BeliefState } from "../belief/beliefState";
import { deriveBehaviorBiases, type BehaviorBias } from "../behavior/behaviorBias";
import { decideBehavior, type BehaviorDecision } from "../decision/behaviorDecision";
import { deriveDesires, type DesireState } from "../desire/desireState";
import { applyActionNoise, type EmbodiedAction } from "../embodiment/actionNoise";
import { buildSocialMaskExpression, type MultiStateExpression } from "../expression/socialMask";
import { deriveMeaningState, type MeaningState } from "../meaning/meaningSystem";
import { deriveNeedDeficiencies, type NeedDeficiency } from "../need/needDeficiency";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { activateProceduralMemory, type ProceduralActivation } from "../procedural/proceduralMemory";
import { perceiveEventTime } from "../time/timePerception";
import { interpretEvent, type WorldModelInterpretation } from "../worldmodel/worldModel";
import { buildDifferentiatedDecisionForState } from "../differentiation/differentiationAdapter";
import type { DifferentiatedDecision } from "../differentiation/characterDifferentiation";

export interface DerivedCharacterState {
  beliefs: BeliefState[];
  needs: NeedDeficiency[];
  desires: DesireState[];
  meaning: MeaningState;
  worldInterpretation?: WorldModelInterpretation;
  behaviorBiases: BehaviorBias[];
  decision: BehaviorDecision;
  differentiatedDecision?: DifferentiatedDecision;
  embodiedAction: EmbodiedAction;
  socialExpression: MultiStateExpression;
  proceduralActivations: ProceduralActivation[];
}

export function deriveCharacterState(state: CharacterPhysicsState): DerivedCharacterState {
  const beliefs = state.beliefStates.length ? state.beliefStates : deriveBeliefs(state.memories);
  const needs = deriveNeedDeficiencies({
    coordinate: state.coordinate,
    beliefs,
    clusters: [...state.clusters.values()]
  });
  const desires = deriveDesires(needs);
  const behaviorBiases = deriveBehaviorBiases({
    coordinate: state.coordinate,
    desires
  });
  const worldInterpretation = deriveCurrentWorldInterpretation(state, beliefs);
  const derivedWithoutDecision: Omit<
    DerivedCharacterState,
    "decision" | "embodiedAction" | "socialExpression" | "proceduralActivations"
  > = {
    beliefs,
    needs,
    desires,
    meaning: deriveMeaningState({
      coordinate: state.coordinate,
      beliefs,
      needs,
      desires,
      reward: state.rewardState
    }),
    ...(worldInterpretation ? { worldInterpretation } : {}),
    behaviorBiases
  };
  const decision = decideBehavior({
    coordinate: state.coordinate,
    derived: derivedWithoutDecision
  });

  // V10.12: Differentiated decision from differentiation engine
  let differentiatedDecision: DifferentiatedDecision | undefined;
  try {
    differentiatedDecision = buildDifferentiatedDecisionForState(state);
  } catch {
    // Silently fall back — differentiation is additive, legacy decision is primary
    differentiatedDecision = undefined;
  }

  const embodiedAction = applyActionNoise({
    intendedAction: decision.mostLikelyAction,
    context: {
      meta: state.metaState,
      boundary: state.boundary,
      fear: state.coordinate.values.fear,
      skill: state.coordinate.values.control,
      randomness: 0.5
    }
  });

  return {
    ...derivedWithoutDecision,
    decision,
    ...(differentiatedDecision ? { differentiatedDecision } : {}),
    embodiedAction,
    socialExpression: buildSocialMaskExpression({
      coordinate: state.coordinate,
      meta: state.metaState,
      boundary: state.boundary,
      desires,
      behaviorBiases,
      decision,
      embodiedAction
    }),
    proceduralActivations: activateProceduralMemory({
      routines: state.proceduralRoutines,
      cue: {
        tags: recentCueTags(state)
      },
      meta: state.metaState,
      boundary: state.boundary,
      topK: 3
    })
  };
}

function deriveCurrentWorldInterpretation(
  state: CharacterPhysicsState,
  beliefs: BeliefState[]
): WorldModelInterpretation | undefined {
  const memory = state.memories.at(-1);
  if (!memory) return undefined;
  const tags = recentCueTags(state);
  const event = {
    id: `derived_${memory.id}`,
    description: memory.content,
    tags,
    intensity: memory.importance,
    importance: memory.importance,
    relationshipWeight: tags.includes("王雪") || tags.includes("亲密关系") ? 0.9 : 0.4,
    expectationGap: tags.includes("失联") || tags.includes("等待") ? 0.85 : 0.35,
    personalitySensitivity: 0.75,
    emotion: memory.emotion,
    beliefEffect: memory.beliefEffect
  };
  const emotion = {
    primary: memory.emotion,
    valence: memory.emotion === "fear" ? -0.8 : memory.emotion === "joy" ? 0.7 : -0.2,
    arousal: memory.emotion === "fear" ? 0.8 : 0.45,
    intensity: memory.importance
  };
  return interpretEvent({
    event,
    emotion,
    beliefs,
    coordinate: state.coordinate,
    meta: state.metaState,
    boundary: state.boundary,
    timePerception: perceiveEventTime({
      event,
      emotion,
      meta: state.metaState,
      boundary: state.boundary,
      reward: state.rewardState
    })
  });
}

function recentCueTags(state: CharacterPhysicsState): string[] {
  const recentMemories = state.memories.slice(-3);
  const keywords = [
    "王雪",
    "失联",
    "等待",
    "夜晚",
    "深夜",
    "亲密关系",
    "消息",
    "陪伴",
    "解释",
    "背叛",
    "成功",
    "认可",
    "不安"
  ];
  const tags: string[] = [];

  for (const memory of recentMemories) {
    const source = `${memory.content} ${memory.beliefEffect}`;
    tags.push(memory.emotion);
    if (memory.clusterId) tags.push(memory.clusterId.replace(/^cluster_/, ""));
    for (const keyword of keywords) {
      if (source.includes(keyword)) tags.push(keyword);
    }
  }

  return [...new Set(tags)];
}
