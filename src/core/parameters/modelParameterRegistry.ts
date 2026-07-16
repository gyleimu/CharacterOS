import { DETERMINISTIC_TIMESTAMP, deterministicId } from "../deterministicHelpers";

export const LEGACY_MODEL_PARAMETER_SET_VERSION = "legacy-v14.0.0";
export const CURRENT_MODEL_PARAMETER_SET_VERSION = "model-calibration-v1.0.0";

export type ModelParameterSetStatus = "legacy" | "current" | "calibration_variant";

export interface TemporalModelParameters {
  eventDensityWindowHours: number;
  eventHistoryRetentionDays: number;
  maxEventRecoveryDays: number;
  maxRecentTemporalEvents: number;
  repeatDensityPressureWeight: number;
  categoryDensityPressureWeight: number;
  minimumDensityScale: number;
  personalityVelocityHalfLifeDays: number;
}

export interface MemoryModelParameters {
  defaultDecayRate: number;
  recencyFloor: number;
  recencyDynamicWeight: number;
}

export interface BoundaryModelParameters {
  positiveStrainRatioCap: number;
  positiveSafetyImpactScale: number;
  positiveReliefBase: number;
  positiveReliefResilienceWeight: number;
  positiveCrackRepairRate: number;
  positiveIntegrityRepairRate: number;
  negativeStressBase: number;
  negativeResilienceProtection: number;
  overflowCrackRate: number;
  overflowIntegrityDamageRate: number;
  recoveryCrackRate: number;
  recoveryIntegrityRate: number;
  driftOverflowWeight: number;
  driftCrackWeight: number;
  strainedCapacityRatio: number;
  repairTrustTarget: number;
  repairTrustRate: number;
  repairFearRate: number;
  repairOpennessTarget: number;
  repairOpennessRate: number;
  stressWeightByCategory: Readonly<Record<string, number>>;
}

export interface PersonalityModelParameters {
  defaultLearningRate: number;
  generalLearningMin: number;
  generalLearningMax: number;
  generalImpactScale: number;
  generalMomentum: number;
  fatigueLearningScale: number;
  fatigueMomentum: number;
  uncertaintyLearningScale: number;
  uncertaintyMomentum: number;
  standardLearningBase: number;
  standardImpactScale: number;
  standardMomentum: number;
}

export interface ModelParameterSet {
  readonly schemaVersion: "1.0.0";
  readonly version: string;
  readonly status: ModelParameterSetStatus;
  readonly createdAt: string;
  readonly changeReason: string;
  readonly fingerprint: string;
  readonly temporal: Readonly<TemporalModelParameters>;
  readonly memory: Readonly<MemoryModelParameters>;
  readonly boundary: Readonly<BoundaryModelParameters>;
  readonly personality: Readonly<PersonalityModelParameters>;
}

export type ModelParameterPath =
  | `temporal.${Exclude<keyof TemporalModelParameters, symbol>}`
  | `memory.${Exclude<keyof MemoryModelParameters, symbol>}`
  | `boundary.${Exclude<keyof BoundaryModelParameters, "stressWeightByCategory" | symbol>}`
  | `boundary.stressWeightByCategory.${string}`
  | `personality.${Exclude<keyof PersonalityModelParameters, symbol>}`;

export interface ModelParameterDescriptor {
  readonly path: ModelParameterPath;
  readonly group: "temporal" | "memory" | "boundary" | "personality";
  readonly unit: "days" | "hours" | "count" | "ratio" | "rate" | "multiplier";
  readonly min: number;
  readonly max: number;
  readonly source: "legacy_behavior" | "engineering_prior";
  readonly dependencies: readonly string[];
  readonly rationale: string;
}

export interface ModelParameterValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ModelParameterValidationResult {
  readonly valid: boolean;
  readonly issues: ModelParameterValidationIssue[];
  readonly numericParameterCount: number;
  readonly describedParameterCount: number;
}

export interface ModelParameterOverrides {
  readonly temporal?: Partial<TemporalModelParameters>;
  readonly memory?: Partial<MemoryModelParameters>;
  readonly boundary?: Partial<Omit<BoundaryModelParameters, "stressWeightByCategory">> & {
    readonly stressWeightByCategory?: Readonly<Record<string, number>>;
  };
  readonly personality?: Partial<PersonalityModelParameters>;
}

const BASE_VALUES = {
  temporal: {
    eventDensityWindowHours: 24,
    eventHistoryRetentionDays: 90,
    maxEventRecoveryDays: 3650,
    maxRecentTemporalEvents: 256,
    repeatDensityPressureWeight: 0.9,
    categoryDensityPressureWeight: 0.15,
    minimumDensityScale: 0.35,
    personalityVelocityHalfLifeDays: 14,
  },
  memory: {
    defaultDecayRate: 0.02,
    recencyFloor: 0.25,
    recencyDynamicWeight: 0.75,
  },
  boundary: {
    positiveStrainRatioCap: 1.8,
    positiveSafetyImpactScale: 0.28,
    positiveReliefBase: 0.7,
    positiveReliefResilienceWeight: 0.4,
    positiveCrackRepairRate: 0.15,
    positiveIntegrityRepairRate: 0.07,
    negativeStressBase: 0.55,
    negativeResilienceProtection: 0.42,
    overflowCrackRate: 0.35,
    overflowIntegrityDamageRate: 0.18,
    recoveryCrackRate: 0.35,
    recoveryIntegrityRate: 0.12,
    driftOverflowWeight: 0.6,
    driftCrackWeight: 0.15,
    strainedCapacityRatio: 0.7,
    repairTrustTarget: 0.85,
    repairTrustRate: 0.012,
    repairFearRate: 0.008,
    repairOpennessTarget: 0.7,
    repairOpennessRate: 0.006,
    stressWeightByCategory: {
      general: 0.12,
      fatigue: 0.18,
      uncertainty: 0.38,
      failure: 0.62,
      rejection: 0.8,
      conflict: 0.8,
      abandonment: 1,
      betrayal: 1,
      support: 0,
      success: 0,
      fallback: 0.5,
    },
  },
  personality: {
    defaultLearningRate: 0.03,
    generalLearningMin: 0.01,
    generalLearningMax: 0.08,
    generalImpactScale: 0.15,
    generalMomentum: 0.35,
    fatigueLearningScale: 0.2,
    fatigueMomentum: 0.5,
    uncertaintyLearningScale: 0.45,
    uncertaintyMomentum: 0.68,
    standardLearningBase: 0.55,
    standardImpactScale: 0.45,
    standardMomentum: 0.82,
  },
} as const;

const DESCRIPTORS: readonly ModelParameterDescriptor[] = Object.freeze([
  descriptor("temporal.eventDensityWindowHours", "temporal", "hours", 1, 168, ["event density"], "Window used to detect concentrated event input."),
  descriptor("temporal.eventHistoryRetentionDays", "temporal", "days", 7, 3650, ["temporal history"], "Retention horizon for density and replay evidence."),
  descriptor("temporal.maxEventRecoveryDays", "temporal", "days", 1, 36500, ["continuous tick"], "Safety cap for a single recovery interval."),
  descriptor("temporal.maxRecentTemporalEvents", "temporal", "count", 16, 4096, ["temporal history"], "Memory bound for recent event records."),
  descriptor("temporal.repeatDensityPressureWeight", "temporal", "multiplier", 0, 4, ["density saturation"], "Pressure added by semantic repeats."),
  descriptor("temporal.categoryDensityPressureWeight", "temporal", "multiplier", 0, 2, ["density saturation"], "Pressure added by other events in the same category."),
  descriptor("temporal.minimumDensityScale", "temporal", "ratio", 0.05, 1, ["effective impact"], "Lower bound that keeps repeated events auditable but bounded."),
  descriptor("temporal.personalityVelocityHalfLifeDays", "temporal", "days", 0.25, 365, ["personality velocity"], "Elapsed-time half-life for personality momentum."),
  descriptor("memory.defaultDecayRate", "memory", "rate", 0, 0.2, ["memory recency"], "Default recency decay used by continuous recovery."),
  descriptor("memory.recencyFloor", "memory", "ratio", 0, 1, ["cluster gravity"], "Minimum fraction of old memory gravity retained."),
  descriptor("memory.recencyDynamicWeight", "memory", "ratio", 0, 1, ["cluster gravity"], "Recency-dependent fraction of memory gravity."),
  descriptor("boundary.positiveStrainRatioCap", "boundary", "ratio", 0.1, 10, ["safety signal"], "Caps stress-dependent support relief."),
  descriptor("boundary.positiveSafetyImpactScale", "boundary", "multiplier", 0, 1, ["safety signal"], "Maps positive impact into boundary safety evidence."),
  descriptor("boundary.positiveReliefBase", "boundary", "multiplier", 0, 2, ["stress load"], "Base stress relief from safety evidence."),
  descriptor("boundary.positiveReliefResilienceWeight", "boundary", "multiplier", 0, 2, ["stress load"], "Resilience contribution to positive relief."),
  descriptor("boundary.positiveCrackRepairRate", "boundary", "rate", 0, 1, ["boundary cracks"], "Repair rate for existing cracks under safety evidence."),
  descriptor("boundary.positiveIntegrityRepairRate", "boundary", "rate", 0, 1, ["boundary integrity"], "Integrity recovery under safety evidence."),
  descriptor("boundary.negativeStressBase", "boundary", "multiplier", 0, 2, ["stress load"], "Base load for non-positive events."),
  descriptor("boundary.negativeResilienceProtection", "boundary", "ratio", 0, 1, ["stress load"], "Resilience protection against incoming threat."),
  descriptor("boundary.overflowCrackRate", "boundary", "rate", 0, 1, ["boundary cracks"], "New crack formation from incremental overflow."),
  descriptor("boundary.overflowIntegrityDamageRate", "boundary", "rate", 0, 1, ["boundary integrity"], "Integrity damage from incremental overflow."),
  descriptor("boundary.recoveryCrackRate", "boundary", "rate", 0, 1, ["boundary recovery"], "Crack recovery relative to stress recovery."),
  descriptor("boundary.recoveryIntegrityRate", "boundary", "rate", 0, 1, ["boundary recovery"], "Integrity recovery relative to stress recovery."),
  descriptor("boundary.driftOverflowWeight", "boundary", "multiplier", 0, 2, ["personality drift"], "Overflow contribution to drift amplification."),
  descriptor("boundary.driftCrackWeight", "boundary", "multiplier", 0, 2, ["personality drift"], "Crack contribution to drift amplification."),
  descriptor("boundary.strainedCapacityRatio", "boundary", "ratio", 0, 1, ["boundary phase"], "Capacity ratio that enters strained phase."),
  descriptor("boundary.repairTrustTarget", "boundary", "ratio", 0, 1, ["trust repair"], "Soft trust ceiling for positive repair nudges."),
  descriptor("boundary.repairTrustRate", "boundary", "rate", 0, 0.2, ["trust repair"], "Trust repair rate from boundary safety evidence."),
  descriptor("boundary.repairFearRate", "boundary", "rate", 0, 0.2, ["fear repair"], "Fear reduction rate from boundary safety evidence."),
  descriptor("boundary.repairOpennessTarget", "boundary", "ratio", 0, 1, ["openness repair"], "Soft openness ceiling for positive repair nudges."),
  descriptor("boundary.repairOpennessRate", "boundary", "rate", 0, 0.2, ["openness repair"], "Openness repair rate from boundary safety evidence."),
  ...Object.keys(BASE_VALUES.boundary.stressWeightByCategory).map((category) => descriptor(
    `boundary.stressWeightByCategory.${category}`,
    "boundary",
    "multiplier",
    0,
    2,
    ["boundary stress", category],
    `Boundary stress relevance for ${category} events.`,
  )),
  descriptor("personality.defaultLearningRate", "personality", "rate", 0, 0.2, ["galaxy drift"], "Default character learning rate."),
  descriptor("personality.generalLearningMin", "personality", "rate", 0, 0.2, ["general events"], "Minimum activation for general events."),
  descriptor("personality.generalLearningMax", "personality", "rate", 0, 0.3, ["general events"], "Maximum activation for general events."),
  descriptor("personality.generalImpactScale", "personality", "multiplier", 0, 1, ["general events"], "Impact contribution to general-event learning."),
  descriptor("personality.generalMomentum", "personality", "ratio", 0, 1, ["personality velocity"], "Momentum retention for general events."),
  descriptor("personality.fatigueLearningScale", "personality", "multiplier", 0, 1, ["fatigue events"], "Learning activation for fatigue."),
  descriptor("personality.fatigueMomentum", "personality", "ratio", 0, 1, ["personality velocity"], "Momentum retention for fatigue."),
  descriptor("personality.uncertaintyLearningScale", "personality", "multiplier", 0, 1, ["uncertainty events"], "Learning activation for uncertainty."),
  descriptor("personality.uncertaintyMomentum", "personality", "ratio", 0, 1, ["personality velocity"], "Momentum retention for uncertainty."),
  descriptor("personality.standardLearningBase", "personality", "multiplier", 0, 1, ["salient events"], "Base activation for salient event learning."),
  descriptor("personality.standardImpactScale", "personality", "multiplier", 0, 1, ["salient events"], "Impact contribution to salient event learning."),
  descriptor("personality.standardMomentum", "personality", "ratio", 0, 1, ["personality velocity"], "Momentum retention for salient events."),
]);

const LEGACY_SET = sealModelParameterSet({
  version: LEGACY_MODEL_PARAMETER_SET_VERSION,
  status: "legacy",
  changeReason: "Frozen compatibility snapshot of the V14 temporal and personality behavior.",
  values: BASE_VALUES,
});

const CURRENT_SET = sealModelParameterSet({
  version: CURRENT_MODEL_PARAMETER_SET_VERSION,
  status: "current",
  changeReason: "First governed parameter set; behavior-preserving migration from scattered constants.",
  values: BASE_VALUES,
});

const REGISTRY: Readonly<Record<string, ModelParameterSet>> = Object.freeze({
  [LEGACY_SET.version]: LEGACY_SET,
  [CURRENT_SET.version]: CURRENT_SET,
});

export function getCurrentModelParameterSet(): ModelParameterSet {
  return CURRENT_SET;
}

export function getModelParameterSet(version: string): ModelParameterSet {
  const parameterSet = REGISTRY[version];
  if (!parameterSet) throw new Error(`Unknown model parameter set: ${version}`);
  return parameterSet;
}

export function hasModelParameterSet(version: string): boolean {
  return Object.hasOwn(REGISTRY, version);
}

export function listModelParameterSets(): ModelParameterSet[] {
  return Object.values(REGISTRY);
}

export function listModelParameterDescriptors(): readonly ModelParameterDescriptor[] {
  return DESCRIPTORS;
}

export function createModelParameterVariant(params: {
  base?: ModelParameterSet;
  version: string;
  changeReason: string;
  overrides: ModelParameterOverrides;
}): ModelParameterSet {
  const base = params.base ?? CURRENT_SET;
  const variant = sealModelParameterSet({
    version: params.version,
    status: "calibration_variant",
    changeReason: params.changeReason,
    values: {
      temporal: { ...base.temporal, ...params.overrides.temporal },
      memory: { ...base.memory, ...params.overrides.memory },
      boundary: {
        ...base.boundary,
        ...params.overrides.boundary,
        stressWeightByCategory: {
          ...base.boundary.stressWeightByCategory,
          ...params.overrides.boundary?.stressWeightByCategory,
        },
      },
      personality: { ...base.personality, ...params.overrides.personality },
    },
  });
  const validation = validateModelParameterSet(variant);
  if (!validation.valid) {
    throw new Error(
      `Invalid model parameter variant ${params.version}: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`,
    );
  }
  return variant;
}

export function validateModelParameterSet(parameterSet: ModelParameterSet): ModelParameterValidationResult {
  const issues: ModelParameterValidationIssue[] = [];
  if (!parameterSet.version.trim()) issues.push({ path: "version", message: "version must be non-empty" });
  if (!parameterSet.changeReason.trim()) issues.push({ path: "changeReason", message: "change reason must be non-empty" });
  const values = flattenNumericParameters(parameterSet);
  const descriptorByPath = new Map(DESCRIPTORS.map((item) => [item.path, item]));
  for (const [path, value] of Object.entries(values)) {
    const descriptor = descriptorByPath.get(path as ModelParameterPath);
    if (!descriptor) {
      issues.push({ path, message: "numeric parameter is missing governance metadata" });
      continue;
    }
    if (!Number.isFinite(value)) issues.push({ path, message: "value must be finite" });
    if (value < descriptor.min || value > descriptor.max) {
      issues.push({ path, message: `value ${value} must be within [${descriptor.min}, ${descriptor.max}]` });
    }
  }
  for (const descriptor of DESCRIPTORS) {
    if (!(descriptor.path in values)) {
      issues.push({ path: descriptor.path, message: "descriptor does not map to a numeric parameter" });
    }
  }
  const expectedFingerprint = fingerprintFor(parameterSet);
  if (parameterSet.fingerprint !== expectedFingerprint) {
    issues.push({ path: "fingerprint", message: "fingerprint does not match parameter values" });
  }
  if (Math.abs(parameterSet.memory.recencyFloor + parameterSet.memory.recencyDynamicWeight - 1) > 0.000001) {
    issues.push({ path: "memory", message: "recencyFloor + recencyDynamicWeight must equal 1" });
  }
  if (parameterSet.personality.generalLearningMin > parameterSet.personality.generalLearningMax) {
    issues.push({ path: "personality.generalLearningMin", message: "general minimum cannot exceed maximum" });
  }
  return {
    valid: issues.length === 0,
    issues,
    numericParameterCount: Object.keys(values).length,
    describedParameterCount: DESCRIPTORS.length,
  };
}

export function flattenNumericParameters(parameterSet: ModelParameterSet): Record<ModelParameterPath, number> {
  const result: Partial<Record<ModelParameterPath, number>> = {};
  for (const [key, value] of Object.entries(parameterSet.temporal)) result[`temporal.${key}` as ModelParameterPath] = value;
  for (const [key, value] of Object.entries(parameterSet.memory)) result[`memory.${key}` as ModelParameterPath] = value;
  for (const [key, value] of Object.entries(parameterSet.boundary)) {
    if (key === "stressWeightByCategory") continue;
    result[`boundary.${key}` as ModelParameterPath] = value as number;
  }
  for (const [category, value] of Object.entries(parameterSet.boundary.stressWeightByCategory)) {
    result[`boundary.stressWeightByCategory.${category}`] = value;
  }
  for (const [key, value] of Object.entries(parameterSet.personality)) result[`personality.${key}` as ModelParameterPath] = value;
  return result as Record<ModelParameterPath, number>;
}

function descriptor(
  path: ModelParameterPath,
  group: ModelParameterDescriptor["group"],
  unit: ModelParameterDescriptor["unit"],
  min: number,
  max: number,
  dependencies: readonly string[],
  rationale: string,
): ModelParameterDescriptor {
  return Object.freeze({
    path,
    group,
    unit,
    min,
    max,
    source: "engineering_prior",
    dependencies: Object.freeze([...dependencies]),
    rationale,
  });
}

function sealModelParameterSet(params: {
  version: string;
  status: ModelParameterSetStatus;
  changeReason: string;
  values: {
    temporal: TemporalModelParameters;
    memory: MemoryModelParameters;
    boundary: BoundaryModelParameters;
    personality: PersonalityModelParameters;
  };
}): ModelParameterSet {
  const withoutFingerprint = {
    schemaVersion: "1.0.0" as const,
    version: params.version,
    status: params.status,
    createdAt: DETERMINISTIC_TIMESTAMP,
    changeReason: params.changeReason,
    temporal: { ...params.values.temporal },
    memory: { ...params.values.memory },
    boundary: {
      ...params.values.boundary,
      stressWeightByCategory: { ...params.values.boundary.stressWeightByCategory },
    },
    personality: { ...params.values.personality },
  };
  const parameterSet: ModelParameterSet = {
    ...withoutFingerprint,
    fingerprint: fingerprintFor(withoutFingerprint),
  };
  return deepFreeze(parameterSet);
}

function fingerprintFor(parameterSet: Omit<ModelParameterSet, "fingerprint"> | ModelParameterSet): string {
  const values = {
    schemaVersion: parameterSet.schemaVersion,
    version: parameterSet.version,
    status: parameterSet.status,
    changeReason: parameterSet.changeReason,
    temporal: parameterSet.temporal,
    memory: parameterSet.memory,
    boundary: parameterSet.boundary,
    personality: parameterSet.personality,
  };
  return deterministicId("model-parameters", JSON.stringify(values));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
