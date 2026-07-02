export interface CharacterExportValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CharacterExportPackageSummary {
  characterId: string;
  version: string;
  exportedAt: string;
  memoryCount: number;
  clusterCount: number;
  particleCount: number;
  stateIntegrityValid: boolean | null;
  stateIntegrityErrorCount: number | null;
  stateIntegrityWarningCount: number | null;
  hasPackageDigest: boolean;
  adjustmentCount: number;
  overrideCount: number;
  stabilityRisk: string;
  governanceRecommendation: string;
}

const supportedExportVersions = new Set(["1.1"]);

export function validateCharacterExportPackage(value: unknown): CharacterExportValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["export package must be an object"] };
  }

  if (typeof value.exportedAt !== "string" || !value.exportedAt) {
    errors.push("exportedAt must be a non-empty string");
  }
  if (typeof value.characterId !== "string" || !value.characterId) {
    errors.push("characterId must be a non-empty string");
  }
  if (typeof value.version !== "string" || !supportedExportVersions.has(value.version)) {
    errors.push("version must be a supported export version");
  }
  validateSerializedState(value.state, "state", errors);
  if (value.stateIntegrity !== undefined) {
    validateStateIntegrityReport(value.stateIntegrity, "stateIntegrity", errors);
  }
  if (value.packageDigest !== undefined) {
    validatePackageDigest(value.packageDigest, "packageDigest", errors);
  }
  validateAdjustmentHistoryPackage(value.adjustmentHistory, "adjustmentHistory", errors);

  return { valid: errors.length === 0, errors };
}

export function summarizeCharacterExportPackage(value: unknown): CharacterExportPackageSummary | null {
  const validation = validateCharacterExportPackage(value);
  if (!validation.valid || !isRecord(value) || !isRecord(value.state) || !isRecord(value.adjustmentHistory)) {
    return null;
  }
  const state = value.state;
  const adjustmentHistory = value.adjustmentHistory;
  const summary = isRecord(adjustmentHistory.summary) ? adjustmentHistory.summary : {};
  const governance = isRecord(adjustmentHistory.governance) ? adjustmentHistory.governance : {};
  const stateIntegrity = isRecord(value.stateIntegrity) ? value.stateIntegrity : null;

  return {
    characterId: String(value.characterId),
    version: String(value.version),
    exportedAt: String(value.exportedAt),
    memoryCount: Array.isArray(state.memories) ? state.memories.length : 0,
    clusterCount: Array.isArray(state.clusters) ? state.clusters.length : 0,
    particleCount: Array.isArray(state.particles) ? state.particles.length : 0,
    stateIntegrityValid: typeof stateIntegrity?.valid === "boolean" ? stateIntegrity.valid : null,
    stateIntegrityErrorCount: typeof stateIntegrity?.errorCount === "number" ? stateIntegrity.errorCount : null,
    stateIntegrityWarningCount: typeof stateIntegrity?.warningCount === "number" ? stateIntegrity.warningCount : null,
    hasPackageDigest: isRecord(value.packageDigest),
    adjustmentCount: typeof summary.totalEntries === "number" ? summary.totalEntries : 0,
    overrideCount: typeof summary.overrideCount === "number" ? summary.overrideCount : 0,
    stabilityRisk: typeof summary.stabilityRisk === "string" ? summary.stabilityRisk : "unknown",
    governanceRecommendation:
      typeof governance.recommendation === "string" ? governance.recommendation : "unknown"
  };
}

function validateStateIntegrityReport(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.valid !== "boolean") errors.push(`${path}.valid must be a boolean`);
  if (typeof value.errorCount !== "number") errors.push(`${path}.errorCount must be a number`);
  if (typeof value.warningCount !== "number") errors.push(`${path}.warningCount must be a number`);
  if (!Array.isArray(value.issues)) errors.push(`${path}.issues must be an array`);
  if (!isRecord(value.summary)) errors.push(`${path}.summary must be an object`);
}

function validatePackageDigest(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (value.algorithm !== "sha256") errors.push(`${path}.algorithm must be sha256`);
  if (value.canonicalization !== "characteros-json-v1") {
    errors.push(`${path}.canonicalization must be characteros-json-v1`);
  }
  if (!Array.isArray(value.excludedTopLevelFields)) {
    errors.push(`${path}.excludedTopLevelFields must be an array`);
  }
  if (typeof value.value !== "string" || !/^[a-f0-9]{64}$/.test(value.value)) {
    errors.push(`${path}.value must be a sha256 hex string`);
  }
}

function validateSerializedState(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  // Coordinate: must have a `values` sub-object with numeric Big Five + extended dimensions.
  if (!isRecord(value.coordinate)) {
    errors.push(`${path}.coordinate must be an object`);
  } else if (!isRecord(value.coordinate.values)) {
    errors.push(`${path}.coordinate.values must be an object`);
  } else {
    const dims = value.coordinate.values;
    // Core Big Five dimensions (always present)
    for (const key of ["openness", "conscientiousness", "extroversion", "agreeableness", "neuroticism"]) {
      if (typeof dims[key] !== "number") {
        errors.push(`${path}.coordinate.values.${key} must be a number`);
      }
    }
    // Extended character-specific dimensions (may be present)
    for (const key of ["trust", "attachment", "fear", "control"]) {
      if (dims[key] !== undefined && typeof dims[key] !== "number") {
        errors.push(`${path}.coordinate.values.${key} must be a number if present`);
      }
    }
  }
  // Personality: Big Five vector (same five core dimensions).
  if (!isRecord(value.personality)) {
    errors.push(`${path}.personality must be an object`);
  } else {
    for (const key of ["openness", "conscientiousness", "extroversion", "agreeableness", "neuroticism"]) {
      if (typeof value.personality[key] !== "number") {
        errors.push(`${path}.personality.${key} must be a number`);
      }
    }
  }
  // Clusters: each must have id, category, mass at minimum.
  if (!Array.isArray(value.clusters)) {
    errors.push(`${path}.clusters must be an array`);
  } else {
    value.clusters.forEach((cluster: unknown, index: number) => {
      if (!isRecord(cluster)) {
        errors.push(`${path}.clusters[${index}] must be an object`);
        return;
      }
      if (typeof cluster.id !== "string" || !cluster.id) errors.push(`${path}.clusters[${index}].id must be a non-empty string`);
      if (typeof cluster.category !== "string") errors.push(`${path}.clusters[${index}].category must be a string`);
      if (typeof cluster.mass !== "number") errors.push(`${path}.clusters[${index}].mass must be a number`);
    });
  }
  if (!Array.isArray(value.particles)) {
    errors.push(`${path}.particles must be an array`);
  }
  // Memories: each must have id, recency, importance at minimum.
  if (!Array.isArray(value.memories)) {
    errors.push(`${path}.memories must be an array`);
  } else {
    value.memories.forEach((memory: unknown, index: number) => {
      if (!isRecord(memory)) {
        errors.push(`${path}.memories[${index}] must be an object`);
        return;
      }
      if (typeof memory.id !== "string" || !memory.id) errors.push(`${path}.memories[${index}].id must be a non-empty string`);
      if (typeof memory.recency !== "number") errors.push(`${path}.memories[${index}].recency must be a number`);
      if (typeof memory.importance !== "number") errors.push(`${path}.memories[${index}].importance must be a number`);
    });
  }
  if (typeof value.learningRate !== "number") errors.push(`${path}.learningRate must be a number`);
  if (!isRecord(value.derived)) errors.push(`${path}.derived must be an object`);
  if (!isRecord(value.galaxy)) errors.push(`${path}.galaxy must be an object`);
}

function validateAdjustmentHistoryPackage(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!Array.isArray(value.history)) {
    errors.push(`${path}.history must be an array`);
  } else {
    value.history.forEach((entry, index) => validateHistoryEntry(entry, `${path}.history[${index}]`, errors));
  }
  validateHistorySummary(value.summary, `${path}.summary`, errors);
  validateGovernance(value.governance, `${path}.governance`, errors);
}

function validateHistoryEntry(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.id !== "string" || !value.id) errors.push(`${path}.id must be a non-empty string`);
  if (typeof value.characterId !== "string" || !value.characterId) {
    errors.push(`${path}.characterId must be a non-empty string`);
  }
  if (value.action !== "apply" && value.action !== "rollback") errors.push(`${path}.action must be apply or rollback`);
  if (value.status !== "applied" && value.status !== "blocked") errors.push(`${path}.status must be applied or blocked`);
  if (typeof value.snapshotId !== "string") errors.push(`${path}.snapshotId must be a string`);
  if (typeof value.operationCount !== "number") errors.push(`${path}.operationCount must be a number`);
  if (!Array.isArray(value.targetPaths)) errors.push(`${path}.targetPaths must be an array`);
  if (typeof value.createdAt !== "string" || !value.createdAt) errors.push(`${path}.createdAt must be a non-empty string`);
  if (!Array.isArray(value.reasons)) errors.push(`${path}.reasons must be an array`);
  if (value.governanceOverride !== undefined) {
    validateGovernanceOverride(value.governanceOverride, `${path}.governanceOverride`, errors);
  }
}

function validateGovernanceOverride(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (typeof value.used !== "boolean") errors.push(`${path}.used must be a boolean`);
  if (value.reason !== undefined && typeof value.reason !== "string") {
    errors.push(`${path}.reason must be a string`);
  }
}

function validateHistorySummary(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of [
    "totalEntries",
    "appliedCount",
    "rollbackCount",
    "blockedCount",
    "overrideCount",
    "totalOperations"
  ]) {
    if (typeof value[key] !== "number") errors.push(`${path}.${key} must be a number`);
  }
  if (!Array.isArray(value.uniqueTargetPaths)) errors.push(`${path}.uniqueTargetPaths must be an array`);
  if (!Array.isArray(value.latestTargetPaths)) errors.push(`${path}.latestTargetPaths must be an array`);
  if (!Array.isArray(value.frequentTargetPaths)) errors.push(`${path}.frequentTargetPaths must be an array`);
  if (value.stabilityRisk !== "low" && value.stabilityRisk !== "medium" && value.stabilityRisk !== "high") {
    errors.push(`${path}.stabilityRisk must be low, medium, or high`);
  }
  if (!Array.isArray(value.reasons)) errors.push(`${path}.reasons must be an array`);
}

function validateGovernance(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (value.recommendation !== "allow" && value.recommendation !== "cooldown" && value.recommendation !== "pause") {
    errors.push(`${path}.recommendation must be allow, cooldown, or pause`);
  }
  if (typeof value.cooldownDays !== "number") errors.push(`${path}.cooldownDays must be a number`);
  if (typeof value.cooldownActive !== "boolean") errors.push(`${path}.cooldownActive must be a boolean`);
  if (!Array.isArray(value.reasons)) errors.push(`${path}.reasons must be an array`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
