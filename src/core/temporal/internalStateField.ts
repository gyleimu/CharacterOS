/**
 * V4.4 InternalStateField Snapshot — read-only observation layer.
 *
 * Snapshots a CharacterPhysicsState into structured, comparable state
 * variables with baselines, deviations, homeostatic pressure, and
 * stability risk assessments.
 *
 * Does NOT replace CharacterPhysicsState.
 * Does NOT mutate any state.
 * Does NOT change tick behavior.
 *
 * This is the data structure that V4's HomeostaticRegulator and
 * UnifiedTickTrace will eventually observe and compare across ticks.
 */

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import type { MetaState } from "../meta/metaState";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { RewardState } from "../reward/rewardSystem";
import type { HomeostasisState } from "../homeostasis/homeostasis";
import type { BoredomState } from "../boredom/boredomSystem";
import { effectiveMemoryWeight } from "../memory/decay";
import { clamp01, average } from "../parameters/parameterMath";

// ─── Domain and time scale ────────────────────────────────────────────

export type StateVariableDomain =
  | "metaState"
  | "boundary"
  | "rewardState"
  | "homeostasisState"
  | "boredomState"
  | "coordinate"
  | "belief"
  | "memory";

export type StateVariableTimeScale = "fast" | "medium" | "slow" | "structural";

export type StabilityDirection = "below_baseline" | "near_baseline" | "above_baseline" | "unknown";

// ─── Snapshot types ───────────────────────────────────────────────────

export interface InternalStateVariableSnapshot {
  /** Unique id within the snapshot (e.g. "metaState.emotionalSensitivity"). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Which domain this variable belongs to. */
  domain: StateVariableDomain;
  /** Dot-separated path from CharacterPhysicsState (e.g. "metaState.emotionalSensitivity"). */
  path: string;
  /** Current raw value. */
  currentValue: number;
  /** Baseline value, if one is defined for this variable. */
  baselineValue?: number;
  /** Value normalized to [0, 1]. Same as currentValue for values already in [0,1]. */
  normalizedValue: number;
  /** Deviation from baseline (current - baseline). Only computed when baseline is defined. */
  deviationFromBaseline?: number;
  /** How fast this variable typically changes. */
  timeScale: StateVariableTimeScale;
  /** Estimated homeostatic pressure: 0 = at baseline, 1 = far from baseline. */
  homeostaticPressure: number;
  /** Stability risk assessment. */
  stabilityRisk: "low" | "medium" | "high";
  /** Direction relative to baseline. */
  direction: StabilityDirection;
  /** What other variables influence this one. */
  influencedBy?: string[];
  /** Human-readable diagnostic. */
  reasons: string[];
}

export interface InternalStateFieldSummary {
  /** Total number of variables in the snapshot. */
  variableCount: number;
  /** Count by stability risk. */
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  /** Average homeostatic pressure across all variables. */
  averageHomeostaticPressure: number;
  /** Which domains have the most high-risk variables. */
  dominantDomains: string[];
  /** Count by time scale. */
  slowVariableCount: number;
  mediumVariableCount: number;
  fastVariableCount: number;
  structuralVariableCount: number;
  /** Human-readable summary. */
  reasons: string[];
}

export interface InternalStateFieldSnapshot {
  /** Snapshot format version. */
  version: "4.4.0";
  /** ISO timestamp of capture. */
  capturedAt: string;
  /** Character identity (if available). */
  characterId?: string;
  characterName?: string;
  /** Per-variable snapshots. */
  variables: InternalStateVariableSnapshot[];
  /** Computed summary. */
  summary: InternalStateFieldSummary;
  /** Non-fatal warnings. */
  warnings: string[];
  /** Human-readable reasons. */
  reasons: string[];
}

// ─── Builder ──────────────────────────────────────────────────────────

export interface BuildInternalStateFieldInput {
  state: CharacterPhysicsState;
  characterId?: string;
}

/**
 * Build an InternalStateFieldSnapshot from a CharacterPhysicsState.
 *
 * This is a READ-ONLY transformation. The state is not modified.
 * The snapshot captures the state at a single point in time for
 * comparison, calibration, and homeostasis observability.
 */
export function buildInternalStateFieldSnapshot(
  input: BuildInternalStateFieldInput
): InternalStateFieldSnapshot {
  const { state } = input;
  const variables: InternalStateVariableSnapshot[] = [];
  const warnings: string[] = [];

  // ── Domain 1: MetaState ──────────────────────────────────────────
  collectMetaStateVariables(state.metaState, variables);

  // ── Domain 2: PsychologicalBoundary ──────────────────────────────
  collectBoundaryVariables(state.boundary, variables);

  // ── Domain 3: RewardState ────────────────────────────────────────
  collectRewardVariables(state.rewardState, variables);

  // ── Domain 4: HomeostasisState ───────────────────────────────────
  collectHomeostasisVariables(state.homeostasisState, variables);

  // ── Domain 5: BoredomState ───────────────────────────────────────
  collectBoredomVariables(state.boredomState, variables);

  // ── Domain 6: Coordinate (selected) ──────────────────────────────
  collectCoordinateVariables(state, variables);

  // ── Domain 7: Belief summary ─────────────────────────────────────
  collectBeliefSummary(state, variables);

  // ── Domain 8: Memory summary ─────────────────────────────────────
  collectMemorySummary(state, variables, warnings);

  // Build summary.
  const summary = buildSummary(variables);

  return {
    version: "4.4.0",
    capturedAt: new Date().toISOString(),
    ...(input.characterId ? { characterId: input.characterId } : {}),
    ...(state.identity?.name ? { characterName: state.identity.name } : {}),
    variables,
    summary,
    warnings,
    reasons: buildReasons(summary)
  };
}

// ─── Domain collectors ────────────────────────────────────────────────

function collectMetaStateVariables(meta: MetaState, out: InternalStateVariableSnapshot[]): void {
  const entries: Array<{
    key: keyof MetaState;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "memoryStrength", label: "记忆强度", timeScale: "slow", baseline: 0.68 },
    { key: "forgettingSpeed", label: "遗忘速度", timeScale: "slow", baseline: 0.42 },
    { key: "attention", label: "注意力", timeScale: "medium", baseline: 0.56 },
    { key: "emotionalSensitivity", label: "情绪敏感度", timeScale: "slow", baseline: 0.62 },
    { key: "resilience", label: "韧性", timeScale: "slow", baseline: 0.52 },
    { key: "selfControl", label: "自控力", timeScale: "medium", baseline: 0.58 },
    { key: "curiosity", label: "好奇心", timeScale: "slow", baseline: 0.54 },
    { key: "trustGrowthRate", label: "信任增长速率", timeScale: "slow", baseline: 0.42 },
    { key: "trustDecayRate", label: "信任衰减速率", timeScale: "slow", baseline: 0.58 },
    { key: "traumaAmplification", label: "创伤放大率", timeScale: "structural", baseline: 0.5 },
    { key: "lonelinessTolerance", label: "孤独耐受力", timeScale: "slow", baseline: 0.42 },
    { key: "attachmentStyle", label: "依恋风格", timeScale: "structural", baseline: 0.62 },
    { key: "needSatisfactionThreshold", label: "需求满足阈值", timeScale: "medium", baseline: 0.58 }
  ];

  for (const entry of entries) {
    const currentValue = meta[entry.key];
    out.push(buildVariable({
      id: `metaState.${entry.key}`,
      label: entry.label,
      domain: "metaState",
      path: `metaState.${entry.key}`,
      currentValue,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }
}

function collectBoundaryVariables(
  boundary: PsychologicalBoundary,
  out: InternalStateVariableSnapshot[]
): void {
  const entries: Array<{
    key: keyof PsychologicalBoundary;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "capacity", label: "心理容量", timeScale: "structural", baseline: 0.72 },
    { key: "resilience", label: "边界韧性", timeScale: "slow", baseline: 0.58 },
    { key: "integrity", label: "边界完整度", timeScale: "slow", baseline: 0.88 },
    { key: "recoveryRate", label: "边界恢复速率", timeScale: "slow", baseline: 0.25 },
    { key: "stressLoad", label: "压力负载", timeScale: "fast", baseline: 0.18 },
    { key: "cracks", label: "裂纹数", timeScale: "medium", baseline: 0 },
    { key: "overflowCount", label: "溢出次数", timeScale: "medium", baseline: 0 }
  ];

  for (const entry of entries) {
    const currentValue = boundary[entry.key] as number;
    out.push(buildVariable({
      id: `boundary.${entry.key}`,
      label: entry.label,
      domain: "boundary",
      path: `boundary.${entry.key}`,
      currentValue,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }

  // Phase as a pseudo-variable.
  const phaseMap: Record<string, number> = { stable: 0.15, strained: 0.6, overflow: 0.95 };
  const phaseValue = phaseMap[boundary.phase] ?? 0.5;
  out.push({
    id: "boundary.phase",
    label: "边界相位",
    domain: "boundary",
    path: "boundary.phase",
    currentValue: phaseValue,
    normalizedValue: phaseValue,
    baselineValue: 0.15,
    deviationFromBaseline: round2(phaseValue - 0.15),
    timeScale: "fast",
    homeostaticPressure: clamp01(Math.abs(phaseValue - 0.15) * 1.25),
    stabilityRisk: boundary.phase === "overflow" ? "high" : boundary.phase === "strained" ? "medium" : "low",
    direction: boundary.phase === "stable" ? "near_baseline" : "above_baseline",
    reasons: [`boundary phase is ${boundary.phase}`]
  });
}

function collectRewardVariables(reward: RewardState, out: InternalStateVariableSnapshot[]): void {
  const entries: Array<{
    key: keyof RewardState;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "dopamineLevel", label: "多巴胺水平", timeScale: "fast", baseline: 0.38 },
    { key: "dopamineThreshold", label: "多巴胺阈值", timeScale: "slow", baseline: 0.52 },
    { key: "rewardSensitivity", label: "奖励敏感度", timeScale: "slow", baseline: 0.55 },
    { key: "noveltyNeed", label: "新奇需求", timeScale: "medium", baseline: 0.45 },
    { key: "adaptationRate", label: "适应速率", timeScale: "slow", baseline: 0.14 },
    { key: "craving", label: "渴求强度", timeScale: "fast", baseline: 0.12 }
  ];

  for (const entry of entries) {
    const currentValue = reward[entry.key];
    out.push(buildVariable({
      id: `rewardState.${entry.key}`,
      label: entry.label,
      domain: "rewardState",
      path: `rewardState.${entry.key}`,
      currentValue,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }
}

function collectHomeostasisVariables(
  homeostasis: HomeostasisState,
  out: InternalStateVariableSnapshot[]
): void {
  const entries: Array<{
    key: keyof HomeostasisState;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "stabilitySetPoint", label: "稳定设定点", timeScale: "structural", baseline: 0.52 },
    { key: "changeResistance", label: "变化阻力", timeScale: "structural", baseline: 0.62 },
    { key: "recoveryBias", label: "恢复偏置", timeScale: "slow", baseline: 0.48 },
    { key: "moderationBias", label: "调节偏置", timeScale: "slow", baseline: 0.58 },
    { key: "scarRetention", label: "伤痕保留率", timeScale: "structural", baseline: 0.32 }
  ];

  for (const entry of entries) {
    const currentValue = homeostasis[entry.key];
    out.push(buildVariable({
      id: `homeostasisState.${entry.key}`,
      label: entry.label,
      domain: "homeostasisState",
      path: `homeostasisState.${entry.key}`,
      currentValue,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }
}

function collectBoredomVariables(boredom: BoredomState, out: InternalStateVariableSnapshot[]): void {
  const entries: Array<{
    key: keyof BoredomState;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "boredomLevel", label: "无聊水平", timeScale: "fast", baseline: 0.15 },
    { key: "stimulationNeed", label: "刺激需求", timeScale: "medium", baseline: 0.35 },
    { key: "daydreamingTendency", label: "白日梦倾向", timeScale: "slow", baseline: 0.42 },
    { key: "creativePressure", label: "创造压力", timeScale: "medium", baseline: 0.12 },
    { key: "restlessness", label: "躁动不安", timeScale: "fast", baseline: 0.1 }
  ];

  for (const entry of entries) {
    const currentValue = boredom[entry.key];
    out.push(buildVariable({
      id: `boredomState.${entry.key}`,
      label: entry.label,
      domain: "boredomState",
      path: `boredomState.${entry.key}`,
      currentValue,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }
}

function collectCoordinateVariables(
  state: CharacterPhysicsState,
  out: InternalStateVariableSnapshot[]
): void {
  const entries: Array<{
    key: string;
    label: string;
    timeScale: StateVariableTimeScale;
    baseline: number;
  }> = [
    { key: "trust", label: "信任", timeScale: "slow", baseline: 0.5 },
    { key: "fear", label: "恐惧", timeScale: "medium", baseline: 0.5 },
    { key: "attachment", label: "依恋", timeScale: "slow", baseline: 0.5 },
    { key: "control", label: "控制感", timeScale: "slow", baseline: 0.5 }
  ];

  for (const entry of entries) {
    const value = state.coordinate.values[entry.key as keyof typeof state.coordinate.values];
    if (typeof value !== "number") continue;
    out.push(buildVariable({
      id: `coordinate.${entry.key}`,
      label: entry.label,
      domain: "coordinate",
      path: `coordinate.${entry.key}`,
      currentValue: value,
      baselineValue: entry.baseline,
      timeScale: entry.timeScale
    }));
  }
}

function collectBeliefSummary(state: CharacterPhysicsState, out: InternalStateVariableSnapshot[]): void {
  const beliefs = state.beliefStates;
  if (!beliefs.length) {
    out.push({
      id: "belief.strengthSummary",
      label: "信念强度均值",
      domain: "belief",
      path: "beliefStates[*].strength",
      currentValue: 0,
      normalizedValue: 0,
      timeScale: "slow",
      homeostaticPressure: 0,
      stabilityRisk: "low",
      direction: "unknown",
      reasons: ["no beliefs present"]
    });
    return;
  }

  const avgStrength = average(beliefs.map((b) => b.strength));
  const count = beliefs.length;

  out.push(buildVariable({
    id: "belief.strengthSummary",
    label: "信念强度均值",
    domain: "belief",
    path: "beliefStates[*].strength",
    currentValue: avgStrength,
    baselineValue: 0.5,
    timeScale: "slow"
  }));

  out.push({
    id: "belief.count",
    label: "信念数量",
    domain: "belief",
    path: "beliefStates.length",
    currentValue: clamp01(count / 20),
    normalizedValue: clamp01(count / 20),
    baselineValue: clamp01(3 / 20),
    deviationFromBaseline: round2(clamp01(count / 20) - clamp01(3 / 20)),
    timeScale: "slow",
    homeostaticPressure: clamp01(Math.abs(count - 3) / 10),
    stabilityRisk: count >= 8 ? "high" : count >= 5 ? "medium" : "low",
    direction: count > 3 ? "above_baseline" : count < 3 ? "below_baseline" : "near_baseline",
    reasons: [`${count} beliefs present`]
  });
}

function collectMemorySummary(
  state: CharacterPhysicsState,
  out: InternalStateVariableSnapshot[],
  warnings: string[]
): void {
  const memories = state.memories;
  if (!memories.length) {
    warnings.push("no memories in state — memory summary is empty");
    out.push({
      id: "memory.effectiveWeightSummary",
      label: "记忆有效权重均值",
      domain: "memory",
      path: "memories[*].effectiveWeight",
      currentValue: 0,
      normalizedValue: 0,
      timeScale: "fast",
      homeostaticPressure: 0,
      stabilityRisk: "low",
      direction: "unknown",
      reasons: ["no memories present"]
    });
    return;
  }

  const weights = memories.map(effectiveMemoryWeight);
  const avgWeight = average(weights);
  const avgRecency = average(memories.map((m) => m.recency));
  const count = memories.length;

  out.push(buildVariable({
    id: "memory.effectiveWeightSummary",
    label: "记忆有效权重均值",
    domain: "memory",
    path: "memories[*].effectiveWeight",
    currentValue: avgWeight,
    baselineValue: 0.5,
    timeScale: "fast"
  }));

  out.push(buildVariable({
    id: "memory.recencySummary",
    label: "记忆新近度均值",
    domain: "memory",
    path: "memories[*].recency",
    currentValue: avgRecency,
    baselineValue: 0.7,
    timeScale: "fast"
  }));

  out.push({
    id: "memory.count",
    label: "记忆数量（归一化）",
    domain: "memory",
    path: "memories.length",
    currentValue: clamp01(count / 100),
    normalizedValue: clamp01(count / 100),
    baselineValue: clamp01(3 / 100),
    deviationFromBaseline: round2(clamp01(count / 100) - clamp01(3 / 100)),
    timeScale: "medium",
    homeostaticPressure: 0,
    stabilityRisk: "low",
    direction: count > 3 ? "above_baseline" : "near_baseline",
    reasons: [`${count} memories stored`]
  });
}

// ─── Variable builder ─────────────────────────────────────────────────

function buildVariable(params: {
  id: string;
  label: string;
  domain: StateVariableDomain;
  path: string;
  currentValue: number;
  baselineValue?: number;
  timeScale: StateVariableTimeScale;
  influencedBy?: string[];
}): InternalStateVariableSnapshot {
  const { currentValue, baselineValue } = params;
  const normalizedValue = clamp01(currentValue);
  const deviationFromBaseline =
    baselineValue !== undefined ? round2(currentValue - baselineValue) : undefined;
  const homeostaticPressure =
    baselineValue !== undefined ? clamp01(Math.abs(currentValue - baselineValue) * 1.5) : 0.25;

  let stabilityRisk: "low" | "medium" | "high" = "low";
  if (deviationFromBaseline !== undefined) {
    const absDev = Math.abs(deviationFromBaseline);
    if (absDev >= 0.35) stabilityRisk = "high";
    else if (absDev >= 0.18) stabilityRisk = "medium";
  }

  let direction: StabilityDirection = "unknown";
  if (deviationFromBaseline !== undefined) {
    if (Math.abs(deviationFromBaseline) <= 0.05) direction = "near_baseline";
    else if (deviationFromBaseline > 0) direction = "above_baseline";
    else direction = "below_baseline";
  }

  const reasons: string[] = [];
  if (stabilityRisk === "high") {
    reasons.push(`${params.label} significantly deviates from baseline`);
  } else if (stabilityRisk === "medium") {
    reasons.push(`${params.label} moderately deviates from baseline`);
  }

  return {
    id: params.id,
    label: params.label,
    domain: params.domain,
    path: params.path,
    currentValue: round2(currentValue),
    normalizedValue: round2(normalizedValue),
    ...(baselineValue !== undefined ? { baselineValue: round2(baselineValue) } : {}),
    ...(deviationFromBaseline !== undefined ? { deviationFromBaseline } : {}),
    timeScale: params.timeScale,
    homeostaticPressure: round2(homeostaticPressure),
    stabilityRisk,
    direction,
    ...(params.influencedBy ? { influencedBy: params.influencedBy } : {}),
    reasons
  };
}

// ─── Summary builder ──────────────────────────────────────────────────

function buildSummary(variables: InternalStateVariableSnapshot[]): InternalStateFieldSummary {
  const highRisk = variables.filter((v) => v.stabilityRisk === "high");
  const mediumRisk = variables.filter((v) => v.stabilityRisk === "medium");
  const lowRisk = variables.filter((v) => v.stabilityRisk === "low");
  const avgPressure = average(variables.map((v) => v.homeostaticPressure));

  // Find dominant domains (those with most high-risk variables).
  const domainHighCount = new Map<string, number>();
  for (const v of highRisk) {
    domainHighCount.set(v.domain, (domainHighCount.get(v.domain) ?? 0) + 1);
  }
  const dominantDomains = [...domainHighCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  const slowCount = variables.filter((v) => v.timeScale === "slow").length;
  const structuralCount = variables.filter((v) => v.timeScale === "structural").length;
  const mediumCount = variables.filter((v) => v.timeScale === "medium").length;
  const fastCount = variables.filter((v) => v.timeScale === "fast").length;

  const reasons: string[] = [];
  if (highRisk.length > 0) {
    reasons.push(`${highRisk.length} variable(s) at high stability risk: ${highRisk.map((v) => v.id).join(", ")}`);
  }
  if (dominantDomains.length > 0) {
    reasons.push(`dominant domains: ${dominantDomains.join(", ")}`);
  }
  reasons.push(`average homeostatic pressure: ${round2(avgPressure)}`);

  return {
    variableCount: variables.length,
    highRiskCount: highRisk.length,
    mediumRiskCount: mediumRisk.length,
    lowRiskCount: lowRisk.length,
    averageHomeostaticPressure: round2(avgPressure),
    dominantDomains,
    slowVariableCount: slowCount,
    mediumVariableCount: mediumCount,
    fastVariableCount: fastCount,
    structuralVariableCount: structuralCount,
    reasons
  };
}

function buildReasons(summary: InternalStateFieldSummary): string[] {
  const reasons = [
    `InternalStateField snapshot with ${summary.variableCount} variables across 8 domains`
  ];
  reasons.push(...summary.reasons);
  return reasons;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
