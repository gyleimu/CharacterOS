import type { MetaState } from "../meta/metaState";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import { clamp01, exponentialRecoveryRate } from "../parameters/parameterMath";

export interface ProceduralRoutine {
  id: string;
  cueTags: string[];
  action: string;
  strength: number;
  repetitionCount: number;
  lastTriggeredAt?: number;
}

export interface ProceduralCue {
  tags: string[];
  timestamp?: number;
}

export interface ProceduralActivation {
  routine: ProceduralRoutine;
  cueMatch: number;
  automaticity: number;
  activationScore: number;
  action: string;
  reasons: string[];
}

export function activateProceduralMemory(params: {
  routines: ProceduralRoutine[];
  cue: ProceduralCue;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  topK?: number;
}): ProceduralActivation[] {
  const topK = Math.max(0, params.topK ?? 3);
  if (topK === 0) return [];
  return params.routines
    .map((routine) => activateRoutine({
      routine,
      cue: params.cue,
      meta: params.meta,
      boundary: params.boundary
    }))
    .filter((activation): activation is ProceduralActivation => activation !== null)
    .sort((a, b) => b.activationScore - a.activationScore)
    .slice(0, topK);
}

export function reinforceProceduralRoutine(params: {
  routine: ProceduralRoutine;
  success?: number;
  timestamp?: number;
}): ProceduralRoutine {
  const success = clamp01(params.success ?? 0.65);
  const repetitionCount = params.routine.repetitionCount + 1;
  const reinforcement = (1 - params.routine.strength) * (0.04 + success * 0.08);
  return {
    ...params.routine,
    strength: clamp01(params.routine.strength + reinforcement),
    repetitionCount,
    ...(params.timestamp !== undefined ? { lastTriggeredAt: params.timestamp } : {})
  };
}

export function decayProceduralRoutine(routine: ProceduralRoutine, daysElapsed: number): ProceduralRoutine {
  const decay = exponentialRecoveryRate(0.004, Math.max(0, daysElapsed));
  return {
    ...routine,
    strength: clamp01(routine.strength * (1 - decay * 0.35))
  };
}

function activateRoutine(params: {
  routine: ProceduralRoutine;
  cue: ProceduralCue;
  meta: MetaState;
  boundary: PsychologicalBoundary;
}): ProceduralActivation | null {
  const cueMatch = matchRatio(params.routine.cueTags, params.cue.tags);
  if (cueMatch <= 0) return null;

  const stressRatio = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  const pressureAutomation = stressRatio * 0.18 + (1 - params.meta.selfControl) * 0.16;
  const automaticity = clamp01(
    params.routine.strength * 0.55 +
    Math.min(1, params.routine.repetitionCount / 20) * 0.18 +
    pressureAutomation
  );
  const activationScore = clamp01(cueMatch * 0.52 + automaticity * 0.38 + params.meta.attention * 0.1);

  return {
    routine: params.routine,
    cueMatch,
    automaticity,
    activationScore,
    action: params.routine.action,
    reasons: buildReasons({ cueMatch, automaticity, stressRatio })
  };
}

function matchRatio(cueTags: string[], incomingTags: string[]): number {
  if (!cueTags.length || !incomingTags.length) return 0;
  const incoming = new Set(incomingTags);
  const uniqueCueTags = [...new Set(cueTags)];
  const matched = uniqueCueTags.filter((tag) => incoming.has(tag)).length;
  return clamp01(matched / uniqueCueTags.length);
}

function buildReasons(params: {
  cueMatch: number;
  automaticity: number;
  stressRatio: number;
}): string[] {
  const reasons: string[] = [];
  if (params.cueMatch >= 0.75) reasons.push("当前 cue 与习惯触发条件高度重合。");
  if (params.automaticity >= 0.65) reasons.push("该行为已经接近自动化，不需要深度思考即可启动。");
  if (params.stressRatio >= 0.7) reasons.push("压力较高，角色更容易退回熟悉的自动行为。");
  return reasons;
}
