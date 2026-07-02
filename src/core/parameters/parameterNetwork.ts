import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { MetaState } from "../meta/metaState";
import type { RewardState } from "../reward/rewardSystem";
import { applyInertia, clamp01, round4 } from "./parameterMath";

export type ParameterNetworkNode =
  | "fatigue"
  | "sleepDebt"
  | "stress"
  | "loneliness"
  | "rewardDeficit"
  | "selfControl"
  | "boundaryIntegrity"
  | "emotionalAmplification"
  | "actionNoise"
  | "recoveryCapacity";

export type ParameterInfluencePolarity = "increase" | "decrease";

export interface ParameterNetworkState {
  fatigue: number;
  sleepDebt: number;
  stress: number;
  loneliness: number;
  rewardDeficit: number;
  selfControl: number;
  boundaryIntegrity: number;
  emotionalAmplification: number;
  actionNoise: number;
  recoveryCapacity: number;
}

export interface ParameterInfluence {
  source: ParameterNetworkNode;
  target: ParameterNetworkNode;
  polarity: ParameterInfluencePolarity;
  strength: number;
  reason: string;
}

export interface ParameterNetworkTrace {
  before: ParameterNetworkState;
  targets: ParameterNetworkState;
  after: ParameterNetworkState;
  influences: ParameterInfluence[];
  dominantInfluence?: ParameterInfluence;
  reasons: string[];
}

export function defaultParameterNetworkState(): ParameterNetworkState {
  return {
    fatigue: 0.2,
    sleepDebt: 0.2,
    stress: 0.18,
    loneliness: 0.3,
    rewardDeficit: 0.16,
    selfControl: 0.58,
    boundaryIntegrity: 0.9,
    emotionalAmplification: 0.42,
    actionNoise: 0.24,
    recoveryCapacity: 0.52
  };
}

export function parameterNetworkStateFromCharacter(params: {
  meta: MetaState;
  boundary: PsychologicalBoundary;
  reward: RewardState;
  fatigue?: number;
  sleepDebt?: number;
}): ParameterNetworkState {
  const stress = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  return {
    fatigue: clamp01(params.fatigue ?? 0.2),
    sleepDebt: clamp01(params.sleepDebt ?? 0.2),
    stress,
    loneliness: clamp01(1 - params.meta.lonelinessTolerance),
    rewardDeficit: clamp01(params.reward.dopamineThreshold - params.reward.dopamineLevel),
    selfControl: clamp01(params.meta.selfControl),
    boundaryIntegrity: clamp01(params.boundary.integrity),
    emotionalAmplification: clamp01(params.meta.emotionalSensitivity),
    actionNoise: clamp01(1 - params.meta.selfControl * 0.65 + stress * 0.22),
    recoveryCapacity: clamp01(params.meta.resilience)
  };
}

export function propagateParameterNetwork(params: {
  state: ParameterNetworkState;
  inertiaRate?: number;
}): ParameterNetworkTrace {
  const before = normalizeState(params.state);
  const inertiaRate = clamp01(params.inertiaRate ?? 0.28);
  const targets = calculateTargets(before);
  const after = normalizeState({
    fatigue: before.fatigue,
    sleepDebt: before.sleepDebt,
    stress: before.stress,
    loneliness: before.loneliness,
    rewardDeficit: before.rewardDeficit,
    selfControl: applyInertia({
      current: before.selfControl,
      target: targets.selfControl,
      inertiaRate
    }).after,
    boundaryIntegrity: applyInertia({
      current: before.boundaryIntegrity,
      target: targets.boundaryIntegrity,
      inertiaRate
    }).after,
    emotionalAmplification: applyInertia({
      current: before.emotionalAmplification,
      target: targets.emotionalAmplification,
      inertiaRate
    }).after,
    actionNoise: applyInertia({
      current: before.actionNoise,
      target: targets.actionNoise,
      inertiaRate
    }).after,
    recoveryCapacity: applyInertia({
      current: before.recoveryCapacity,
      target: targets.recoveryCapacity,
      inertiaRate
    }).after
  });
  const influences = buildInfluences(before);
  const dominantInfluence = [...influences].sort((a, b) => b.strength - a.strength)[0];

  return {
    before,
    targets,
    after,
    influences,
    ...(dominantInfluence ? { dominantInfluence } : {}),
    reasons: buildReasons({
      before,
      after,
      ...(dominantInfluence ? { dominantInfluence } : {})
    })
  };
}

function calculateTargets(state: ParameterNetworkState): ParameterNetworkState {
  const selfControlTarget = clamp01(
    state.selfControl -
    state.fatigue * 0.28 -
    state.sleepDebt * 0.22 -
    state.stress * 0.18 +
    state.recoveryCapacity * 0.12
  );
  const boundaryIntegrityTarget = clamp01(
    state.boundaryIntegrity -
    state.stress * 0.24 -
    state.loneliness * 0.1 +
    state.recoveryCapacity * 0.08
  );
  const emotionalAmplificationTarget = clamp01(
    state.emotionalAmplification +
    state.stress * 0.2 +
    state.loneliness * 0.12 +
    (1 - boundaryIntegrityTarget) * 0.18 -
    state.recoveryCapacity * 0.08
  );
  const actionNoiseTarget = clamp01(
    state.actionNoise +
    state.fatigue * 0.24 +
    (1 - selfControlTarget) * 0.3 +
    state.stress * 0.18 +
    state.sleepDebt * 0.12
  );
  const recoveryCapacityTarget = clamp01(
    state.recoveryCapacity +
    (1 - state.fatigue) * 0.1 +
    (1 - state.stress) * 0.1 -
    state.sleepDebt * 0.2 -
    state.rewardDeficit * 0.08
  );

  return normalizeState({
    ...state,
    selfControl: selfControlTarget,
    boundaryIntegrity: boundaryIntegrityTarget,
    emotionalAmplification: emotionalAmplificationTarget,
    actionNoise: actionNoiseTarget,
    recoveryCapacity: recoveryCapacityTarget
  });
}

function buildInfluences(state: ParameterNetworkState): ParameterInfluence[] {
  const influences: ParameterInfluence[] = [
    {
      source: "fatigue",
      target: "selfControl",
      polarity: "decrease",
      strength: round4(state.fatigue * 0.28),
      reason: "fatigue lowers available self-control"
    },
    {
      source: "sleepDebt",
      target: "selfControl",
      polarity: "decrease",
      strength: round4(state.sleepDebt * 0.22),
      reason: "sleep debt weakens executive control"
    },
    {
      source: "stress",
      target: "boundaryIntegrity",
      polarity: "decrease",
      strength: round4(state.stress * 0.24),
      reason: "stress erodes psychological boundary integrity"
    },
    {
      source: "loneliness",
      target: "emotionalAmplification",
      polarity: "increase",
      strength: round4(state.loneliness * 0.12),
      reason: "loneliness amplifies relationship-sensitive emotion"
    },
    {
      source: "boundaryIntegrity",
      target: "emotionalAmplification",
      polarity: "decrease",
      strength: round4(state.boundaryIntegrity * 0.18),
      reason: "stronger boundaries reduce emotional amplification"
    },
    {
      source: "selfControl",
      target: "actionNoise",
      polarity: "decrease",
      strength: round4(state.selfControl * 0.3),
      reason: "self-control reduces action noise"
    },
    {
      source: "stress",
      target: "actionNoise",
      polarity: "increase",
      strength: round4(state.stress * 0.18),
      reason: "stress makes intention-to-action translation noisier"
    },
    {
      source: "rewardDeficit",
      target: "recoveryCapacity",
      polarity: "decrease",
      strength: round4(state.rewardDeficit * 0.08),
      reason: "reward deficit weakens recovery capacity"
    }
  ];

  return influences.filter((influence) => influence.strength > 0);
}

function buildReasons(params: {
  before: ParameterNetworkState;
  after: ParameterNetworkState;
  dominantInfluence?: ParameterInfluence;
}): string[] {
  const reasons: string[] = [];
  if (params.dominantInfluence) {
    reasons.push(
      `dominant network influence: ${params.dominantInfluence.source} -> ${params.dominantInfluence.target}`
    );
  }
  if (params.after.selfControl < params.before.selfControl) {
    reasons.push("self-control moved downward through fatigue, sleep debt, or stress pressure");
  }
  if (params.after.boundaryIntegrity < params.before.boundaryIntegrity) {
    reasons.push("psychological boundary weakened under accumulated pressure");
  }
  if (params.after.emotionalAmplification > params.before.emotionalAmplification) {
    reasons.push("emotion amplification rose because the system is more sensitive");
  }
  if (params.after.actionNoise > params.before.actionNoise) {
    reasons.push("action noise rose, so intentions may translate less cleanly into behavior");
  }
  if (!reasons.length) {
    reasons.push("parameter network remained close to equilibrium");
  }
  return reasons;
}

function normalizeState(state: ParameterNetworkState): ParameterNetworkState {
  return {
    fatigue: clamp01(state.fatigue),
    sleepDebt: clamp01(state.sleepDebt),
    stress: clamp01(state.stress),
    loneliness: clamp01(state.loneliness),
    rewardDeficit: clamp01(state.rewardDeficit),
    selfControl: clamp01(state.selfControl),
    boundaryIntegrity: clamp01(state.boundaryIntegrity),
    emotionalAmplification: clamp01(state.emotionalAmplification),
    actionNoise: clamp01(state.actionNoise),
    recoveryCapacity: clamp01(state.recoveryCapacity)
  };
}
