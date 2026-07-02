import { linFanBiologicalNature, type BiologicalNature } from "../biological/nature";
import { linFanPsychologicalBoundary, type PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import { linFanHomeostasisState, type HomeostasisState } from "../homeostasis/homeostasis";
import { linFanMetaState, type MetaState } from "../meta/metaState";
import { linFanInitialCoordinate, type PersonalityCoordinate } from "../personality/coordinate";
import type { ProceduralRoutine } from "../procedural/proceduralMemory";
import { CharacterPhysicsEngine, createCharacterPhysicsState, type CharacterPhysicsState } from "../physics/physicsEngine";
import type { ExperienceEvent } from "../event/event";
import { linFanRewardState, type RewardState } from "../reward/rewardSystem";

export interface CharacterIdentity {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface CharacterBlueprint {
  identity: CharacterIdentity;
  initialCoordinate: PersonalityCoordinate;
  metaState: MetaState;
  biologicalNature: BiologicalNature;
  boundary: PsychologicalBoundary;
  rewardState: RewardState;
  homeostasisState: HomeostasisState;
  proceduralRoutines: ProceduralRoutine[];
  initialExperiences: ExperienceEvent[];
  learningRate: number;
}

export function defaultCharacterIdentity(): CharacterIdentity {
  return {
    id: "anonymous",
    name: "Anonymous",
    description: "A character without a configured blueprint.",
    tags: []
  };
}

export function createLinFanBlueprint(): CharacterBlueprint {
  return {
    identity: {
      id: "lin_fan",
      name: "林凡",
      description: "一个内向、缺爱、害怕被抛弃，并会在亲密关系中强烈等待确认的人。",
      tags: ["内向", "缺爱", "害怕被抛弃", "亲密关系敏感", "等待"]
    },
    initialCoordinate: linFanInitialCoordinate(),
    metaState: linFanMetaState(),
    biologicalNature: linFanBiologicalNature(),
    boundary: linFanPsychologicalBoundary(),
    rewardState: linFanRewardState(),
    homeostasisState: linFanHomeostasisState(),
    proceduralRoutines: [
      {
        id: "routine_check_message",
        cueTags: ["消息", "失联", "等待"],
        action: "反复查看手机消息。",
        strength: 0.68,
        repetitionCount: 16
      },
      {
        id: "routine_late_night_withdrawal",
        cueTags: ["夜晚", "亲密关系", "不安"],
        action: "在深夜变得沉默，减少表达真实需求。",
        strength: 0.56,
        repetitionCount: 11
      }
    ],
    initialExperiences: linFanInitialExperiences(),
    learningRate: 0.03
  };
}

export function createCharacterStateFromBlueprint(
  blueprint: CharacterBlueprint,
  options: { seedInitialExperiences?: boolean } = {}
): CharacterPhysicsState {
  const state = createCharacterPhysicsState({
    identity: blueprint.identity,
    coordinate: blueprint.initialCoordinate,
    metaState: blueprint.metaState,
    biologicalNature: blueprint.biologicalNature,
    boundary: blueprint.boundary,
    rewardState: blueprint.rewardState,
    homeostasisState: blueprint.homeostasisState,
    proceduralRoutines: blueprint.proceduralRoutines,
    learningRate: blueprint.learningRate
  });
  if (options.seedInitialExperiences) {
    const engine = new CharacterPhysicsEngine();
    for (const event of blueprint.initialExperiences) {
      engine.processEvent(state, event);
    }
  }
  return state;
}

function linFanInitialExperiences(): ExperienceEvent[] {
  return [
    {
      id: "lin_fan_origin_mother_rain_night",
      description: "小时候母亲在雨夜离开，他等了一整晚。",
      tags: ["抛弃", "雨夜", "等待", "孤独"],
      category: "abandonment",
      emotion: "fear",
      intensity: 0.95,
      importance: 0.95,
      relationshipWeight: 1,
      expectationGap: 0.95,
      personalitySensitivity: 0.95,
      beliefEffect: "重要的人会突然离开；等待通常没有结果。"
    },
    {
      id: "lin_fan_origin_first_love_silence",
      description: "初恋突然失联，没有解释。",
      tags: ["失联", "等待", "被抛弃", "亲密关系"],
      category: "abandonment",
      emotion: "fear",
      intensity: 0.9,
      importance: 0.9,
      relationshipWeight: 0.92,
      expectationGap: 0.9,
      personalitySensitivity: 0.92,
      beliefEffect: "亲密关系并不可靠。"
    },
    {
      id: "lin_fan_origin_wang_xue_support",
      description: "王雪在他最痛苦的时候陪过他。",
      tags: ["王雪", "温暖", "被爱", "依赖"],
      category: "support",
      emotion: "relief",
      emotionValence: 0.72,
      emotionArousal: 0.42,
      intensity: 0.85,
      importance: 0.85,
      relationshipWeight: 0.92,
      expectationGap: 0.24,
      personalitySensitivity: 0.82,
      beliefEffect: "王雪是少数真正靠近过他的人。"
    }
  ];
}
