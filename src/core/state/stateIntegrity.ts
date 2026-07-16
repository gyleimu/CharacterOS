import { BASE_PERSONALITY_KEYS, type PersonalityDimensionKey } from "../personality/dimensions";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import {
  getModelParameterSet,
  hasModelParameterSet,
  validateModelParameterSet,
} from "../parameters/modelParameterRegistry";

export type StateIntegritySeverity = "error" | "warning";

export interface StateIntegrityIssue {
  severity: StateIntegritySeverity;
  path: string;
  message: string;
}

export interface StateIntegrityReport {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: StateIntegrityIssue[];
  summary: {
    memoryCount: number;
    particleCount: number;
    clusterCount: number;
    beliefCount: number;
    proceduralRoutineCount: number;
  };
}

export function inspectCharacterStateIntegrity(state: CharacterPhysicsState): StateIntegrityReport {
  const issues: StateIntegrityIssue[] = [];
  checkIdentity(state, issues);
  checkCoordinate("coordinate", state.coordinate.values, issues);
  checkVelocity(state, issues);
  checkScalar("learningRate", state.learningRate, issues, { min: 0, max: 1 });
  checkParameterSet(state, issues);
  checkTemporalState(state, issues);

  const particleIds = collectUniqueIds(
    state.particles.map((particle) => particle.id),
    "particles",
    issues
  );
  const memoryIds = collectUniqueIds(
    state.memories.map((memory) => memory.id),
    "memories",
    issues
  );
  const clusterIds = new Set([...state.clusters.values()].map((cluster) => cluster.id));

  for (const [category, cluster] of state.clusters) {
    const path = `clusters.${category}`;
    if (!cluster.id) addIssue(issues, "error", `${path}.id`, "cluster id must be non-empty");
    if (cluster.category !== category) {
      addIssue(issues, "warning", `${path}.category`, "cluster map key and category differ");
    }
    checkScalar(`${path}.mass`, cluster.mass, issues, { min: 0 });
    checkScalar(`${path}.density`, cluster.density, issues, { min: 0, max: 1 });
    checkScalar(`${path}.stability`, cluster.stability, issues, { min: 0, max: 1 });
    checkCoordinate(`${path}.centerCoordinate`, cluster.centerCoordinate.values, issues, { allowZeroVector: true });
    for (const particleId of cluster.particleIds) {
      if (!particleIds.has(particleId)) {
        addIssue(issues, "error", `${path}.particleIds`, `cluster references missing particle: ${particleId}`);
      }
    }
  }

  state.memories.forEach((memory, index) => {
    const path = `memories[${index}]`;
    if (!memory.id) addIssue(issues, "error", `${path}.id`, "memory id must be non-empty");
    if (memory.clusterId && !clusterIds.has(memory.clusterId)) {
      addIssue(issues, "error", `${path}.clusterId`, `memory references missing cluster: ${memory.clusterId}`);
    }
    checkScalar(`${path}.importance`, memory.importance, issues, { min: 0, max: 1 });
    checkScalar(`${path}.recency`, memory.recency, issues, { min: 0, max: 1 });
    checkScalar(`${path}.repetitionCount`, memory.repetitionCount, issues, { min: 0 });
    checkCoordinate(`${path}.vector`, memory.vector.values, issues, { allowZeroVector: true });
  });

  state.beliefStates.forEach((belief, index) => {
    const path = `beliefStates[${index}]`;
    if (!belief.id) addIssue(issues, "error", `${path}.id`, "belief id must be non-empty");
    checkScalar(`${path}.strength`, belief.strength, issues, { min: 0, max: 1 });
    checkScalar(`${path}.evidenceCount`, belief.evidenceCount, issues, { min: 0 });
    for (const memoryId of belief.sourceMemoryIds) {
      if (!memoryIds.has(memoryId)) {
        addIssue(issues, "error", `${path}.sourceMemoryIds`, `belief references missing memory: ${memoryId}`);
      }
    }
  });

  state.proceduralRoutines.forEach((routine, index) => {
    const path = `proceduralRoutines[${index}]`;
    if (!routine.id) addIssue(issues, "error", `${path}.id`, "routine id must be non-empty");
    checkScalar(`${path}.strength`, routine.strength, issues, { min: 0, max: 1 });
    checkScalar(`${path}.repetitionCount`, routine.repetitionCount, issues, { min: 0 });
    if (!routine.cueTags.length) {
      addIssue(issues, "warning", `${path}.cueTags`, "routine without cue tags cannot be activated");
    }
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    issues,
    summary: {
      memoryCount: state.memories.length,
      particleCount: state.particles.length,
      clusterCount: state.clusters.size,
      beliefCount: state.beliefStates.length,
      proceduralRoutineCount: state.proceduralRoutines.length
    }
  };
}

function checkIdentity(state: CharacterPhysicsState, issues: StateIntegrityIssue[]): void {
  if (!state.identity.id) addIssue(issues, "error", "identity.id", "identity id must be non-empty");
  if (!state.identity.name) addIssue(issues, "error", "identity.name", "identity name must be non-empty");
}

function checkVelocity(state: CharacterPhysicsState, issues: StateIntegrityIssue[]): void {
  for (const key of BASE_PERSONALITY_KEYS) {
    const value = state.velocity.values[key];
    if (!Number.isFinite(value)) {
      addIssue(issues, "error", `velocity.${key}`, "velocity value must be finite");
    }
  }
}

function checkParameterSet(state: CharacterPhysicsState, issues: StateIntegrityIssue[]): void {
  if (!state.parameterSetVersion) {
    addIssue(issues, "error", "parameterSetVersion", "parameter set version must be non-empty");
    return;
  }
  if (!hasModelParameterSet(state.parameterSetVersion)) {
    addIssue(issues, "error", "parameterSetVersion", `unknown parameter set: ${state.parameterSetVersion}`);
    return;
  }
  const validation = validateModelParameterSet(getModelParameterSet(state.parameterSetVersion));
  for (const issue of validation.issues) {
    addIssue(issues, "error", `parameterSet.${issue.path}`, issue.message);
  }
}

function checkTemporalState(state: CharacterPhysicsState, issues: StateIntegrityIssue[]): void {
  const temporal = state.temporal;
  const minimumDensityScale = hasModelParameterSet(state.parameterSetVersion)
    ? getModelParameterSet(state.parameterSetVersion).temporal.minimumDensityScale
    : 0;
  checkScalar("temporal.totalElapsedDays", temporal.totalElapsedDays, issues, { min: 0 });
  checkScalar("temporal.processedEventCount", temporal.processedEventCount, issues, { min: 0 });
  checkScalar("temporal.timedEventCount", temporal.timedEventCount, issues, { min: 0 });
  if (!Number.isInteger(temporal.processedEventCount)) {
    addIssue(issues, "error", "temporal.processedEventCount", "processed event count must be an integer");
  }
  if (!Number.isInteger(temporal.timedEventCount)) {
    addIssue(issues, "error", "temporal.timedEventCount", "timed event count must be an integer");
  }
  if (temporal.timedEventCount > temporal.processedEventCount) {
    addIssue(issues, "error", "temporal.timedEventCount", "timed event count cannot exceed processed count");
  }
  if (temporal.recentEvents.length > temporal.timedEventCount) {
    addIssue(issues, "error", "temporal.recentEvents", "recent timed events cannot exceed timed event count");
  }
  if (temporal.lastProcessedAt && !Number.isFinite(Date.parse(temporal.lastProcessedAt))) {
    addIssue(issues, "error", "temporal.lastProcessedAt", "temporal clock must be a valid timestamp");
  }
  const temporalSequences = new Set<number>();
  temporal.recentEvents.forEach((record, index) => {
    const path = `temporal.recentEvents[${index}]`;
    if (!record.eventId) addIssue(issues, "error", `${path}.eventId`, "event id must be non-empty");
    if (!record.category) addIssue(issues, "error", `${path}.category`, "category must be non-empty");
    if (!Number.isFinite(Date.parse(record.occurredAt))) {
      addIssue(issues, "error", `${path}.occurredAt`, "event time must be valid");
    }
    if (!Number.isInteger(record.sequence) || record.sequence < 1 || record.sequence > temporal.processedEventCount) {
      addIssue(issues, "error", `${path}.sequence`, "event sequence must reference a processed event");
    }
    if (temporalSequences.has(record.sequence)) {
      addIssue(issues, "error", `${path}.sequence`, "temporal event sequence must be unique");
    }
    temporalSequences.add(record.sequence);
    checkScalar(`${path}.rawImpact`, record.rawImpact, issues, { min: 0, max: 1 });
    checkScalar(`${path}.effectiveImpact`, record.effectiveImpact, issues, { min: 0, max: 1 });
    checkScalar(`${path}.densityScale`, record.densityScale, issues, { min: minimumDensityScale, max: 1 });
    if (record.effectiveImpact > record.rawImpact) {
      addIssue(issues, "error", `${path}.effectiveImpact`, "effective impact cannot exceed raw impact");
    }
  });
}

function checkCoordinate(
  path: string,
  values: Partial<Record<PersonalityDimensionKey, number>>,
  issues: StateIntegrityIssue[],
  options: { allowZeroVector?: boolean } = {}
): void {
  for (const key of BASE_PERSONALITY_KEYS) {
    const value = values[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      addIssue(issues, "error", `${path}.${key}`, "coordinate value must be finite");
      continue;
    }
    const min = options.allowZeroVector ? -1 : 0;
    if (value < min || value > 1) {
      addIssue(issues, "error", `${path}.${key}`, `coordinate value must be between ${min} and 1`);
    }
  }
}

function checkScalar(
  path: string,
  value: number,
  issues: StateIntegrityIssue[],
  bounds: { min?: number; max?: number } = {}
): void {
  if (!Number.isFinite(value)) {
    addIssue(issues, "error", path, "value must be finite");
    return;
  }
  if (bounds.min !== undefined && value < bounds.min) {
    addIssue(issues, "error", path, `value must be >= ${bounds.min}`);
  }
  if (bounds.max !== undefined && value > bounds.max) {
    addIssue(issues, "error", path, `value must be <= ${bounds.max}`);
  }
}

function collectUniqueIds(ids: string[], path: string, issues: StateIntegrityIssue[]): Set<string> {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) {
      addIssue(issues, "error", path, "id must be non-empty");
      continue;
    }
    if (seen.has(id)) {
      addIssue(issues, "error", path, `duplicate id: ${id}`);
    }
    seen.add(id);
  }
  return seen;
}

function addIssue(
  issues: StateIntegrityIssue[],
  severity: StateIntegritySeverity,
  path: string,
  message: string
): void {
  issues.push({ severity, path, message });
}
