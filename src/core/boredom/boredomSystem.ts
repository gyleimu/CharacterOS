import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { MetaState } from "../meta/metaState";
import { clamp01, round4 } from "../parameters/parameterMath";
import type { RewardState } from "../reward/rewardSystem";

export interface BoredomState {
  boredomLevel: number;
  stimulationNeed: number;
  daydreamingTendency: number;
  creativePressure: number;
  restlessness: number;
}

export interface InspirationSpark {
  type: "reflection" | "exploration" | "creative_image" | "small_action";
  intensity: number;
  description: string;
}

export interface BoredomTickTrace {
  before: BoredomState;
  after: BoredomState;
  boredomDelta: number;
  explorationDrive: number;
  inspirationChance: number;
  restQuality: number;
  inspiration?: InspirationSpark;
  reasons: string[];
}

export function defaultBoredomState(): BoredomState {
  return {
    boredomLevel: 0.28,
    stimulationNeed: 0.42,
    daydreamingTendency: 0.36,
    creativePressure: 0.22,
    restlessness: 0.18
  };
}

export function updateBoredomForTick(params: {
  boredom: BoredomState;
  meta: MetaState;
  reward: RewardState;
  boundary: PsychologicalBoundary;
  daysElapsed: number;
}): BoredomTickTrace {
  const before = { ...params.boredom };
  const daysFactor = clamp01(params.daysElapsed / 30);
  const rewardDeficit = clamp01(params.reward.dopamineThreshold - params.reward.dopamineLevel);
  const noveltyHunger = clamp01(params.reward.noveltyNeed * 0.7 + params.meta.curiosity * 0.3);
  const stress = clamp01(params.boundary.stressLoad);
  const restQuality = clamp01(params.meta.resilience * 0.45 + params.boundary.integrity * 0.35 + (1 - stress) * 0.2);
  const stimulationPressure = rewardDeficit * 0.42 + noveltyHunger * 0.34 + before.stimulationNeed * 0.24;
  const boredomIncrease = stimulationPressure * daysFactor * (0.55 + restQuality * 0.35);
  const stressInterference = stress * daysFactor * 0.28;
  const rewardRelief = params.reward.dopamineLevel * params.reward.rewardSensitivity * daysFactor * 0.32;
  const boredomDelta = boredomIncrease - rewardRelief - stressInterference * 0.35;
  const boredomLevel = clamp01(before.boredomLevel + boredomDelta);
  const stimulationNeed = clamp01(
    before.stimulationNeed + (noveltyHunger - before.stimulationNeed) * daysFactor * 0.18
  );
  const daydreamingTendency = clamp01(
    before.daydreamingTendency + (restQuality * params.meta.curiosity - before.daydreamingTendency) * daysFactor * 0.22
  );
  const creativePressure = clamp01(
    before.creativePressure + (boredomLevel * daydreamingTendency - stress * 0.24 - before.creativePressure) * daysFactor * 0.26
  );
  const restlessness = clamp01(
    before.restlessness + (boredomLevel * (1 - params.meta.selfControl) + stress * 0.45 - before.restlessness) * daysFactor * 0.3
  );
  const after: BoredomState = {
    boredomLevel,
    stimulationNeed,
    daydreamingTendency,
    creativePressure,
    restlessness
  };
  const explorationDrive = clamp01(boredomLevel * 0.45 + stimulationNeed * 0.25 + params.meta.curiosity * 0.3);
  const inspirationChance = clamp01(creativePressure * 0.42 + daydreamingTendency * 0.32 + restQuality * 0.2 - stress * 0.35);
  const reasons = buildReasons({
    rewardDeficit,
    noveltyHunger,
    stress,
    restQuality,
    creativePressure,
    restlessness
  });
  const inspiration = maybeCreateInspiration({
    chance: inspirationChance,
    explorationDrive,
    creativePressure,
    restlessness,
    stress
  });

  return {
    before,
    after,
    boredomDelta: round4(after.boredomLevel - before.boredomLevel),
    explorationDrive: round4(explorationDrive),
    inspirationChance: round4(inspirationChance),
    restQuality: round4(restQuality),
    ...(inspiration ? { inspiration } : {}),
    reasons
  };
}

function maybeCreateInspiration(params: {
  chance: number;
  explorationDrive: number;
  creativePressure: number;
  restlessness: number;
  stress: number;
}): InspirationSpark | undefined {
  if (params.chance < 0.48) return undefined;
  if (params.stress > 0.72) return undefined;
  if (params.explorationDrive > 0.68) {
    return {
      type: "exploration",
      intensity: round4(params.chance),
      description: "低刺激和好奇心累积成探索冲动，角色更可能尝试一个小的新行动。"
    };
  }
  if (params.creativePressure > 0.48) {
    return {
      type: "creative_image",
      intensity: round4(params.chance),
      description: "放空和白日梦让零散记忆重新组合，形成一个模糊但有吸引力的想法。"
    };
  }
  if (params.restlessness > 0.55) {
    return {
      type: "small_action",
      intensity: round4(params.chance),
      description: "无聊转化为坐立不安，角色可能先做一个很小的动作来打破停滞。"
    };
  }
  return {
    type: "reflection",
    intensity: round4(params.chance),
    description: "安静时间让角色短暂回看自己，而不是立刻进入深度思考。"
  };
}

function buildReasons(params: {
  rewardDeficit: number;
  noveltyHunger: number;
  stress: number;
  restQuality: number;
  creativePressure: number;
  restlessness: number;
}): string[] {
  const reasons: string[] = [];
  if (params.rewardDeficit > 0.12) reasons.push("dopamine below threshold increases boredom");
  if (params.noveltyHunger > 0.5) reasons.push("curiosity and novelty need create exploration pressure");
  if (params.stress > 0.55) reasons.push("stress converts boredom into restless tension");
  if (params.restQuality > 0.55) reasons.push("recovery space allows daydreaming and inspiration");
  if (params.creativePressure > 0.45) reasons.push("creative pressure is accumulating");
  if (params.restlessness > 0.5) reasons.push("restlessness may trigger small automatic action");
  return reasons;
}
