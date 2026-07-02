import {
  summarizeCharacterExportPackage,
  validateCharacterExportPackage,
  type CharacterExportPackageSummary
} from "./characterExportValidation";
import {
  compareCharacterExportPackageDigest,
  type CharacterExportPackageDigestComparison
} from "./characterExportPackageDigest";
import { deserializeCharacterPhysicsState } from "../physics/serialization";
import { inspectCharacterStateIntegrity, type StateIntegrityReport } from "../state/stateIntegrity";

export type CharacterImportPlanStatus = "ready" | "needs_review" | "blocked";

export type CharacterImportPlanRisk = "low" | "medium" | "high";

export type CharacterImportIntegritySnapshotStatus = "missing" | "matched" | "mismatch";

export interface CharacterImportIntegritySnapshotComparison {
  status: CharacterImportIntegritySnapshotStatus;
  reasons: string[];
}

export type CharacterImportAuditDecision = "can_apply" | "review_required" | "rejected";

export interface CharacterImportAuditCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface CharacterImportAuditSummary {
  decision: CharacterImportAuditDecision;
  canApply: boolean;
  requiresReview: boolean;
  nextAction: string;
  blockers: string[];
  warnings: string[];
  checks: CharacterImportAuditCheck[];
}

export interface CharacterImportPlan {
  status: CharacterImportPlanStatus;
  risk: CharacterImportPlanRisk;
  targetCharacterId: string;
  sourceCharacterId?: string;
  summary: CharacterExportPackageSummary | null;
  stateIntegrity: StateIntegrityReport | null;
  stateIntegritySnapshotComparison: CharacterImportIntegritySnapshotComparison;
  packageDigestComparison: CharacterExportPackageDigestComparison;
  requiresExplicitConfirmation: boolean;
  willReplaceState: boolean;
  willReplaceAdjustmentHistory: boolean;
  auditSummary: CharacterImportAuditSummary;
  reasons: string[];
  errors: string[];
}

export function buildCharacterImportPlan(params: {
  targetCharacterId: string;
  package: unknown;
}): CharacterImportPlan {
  const validation = validateCharacterExportPackage(params.package);
  if (!validation.valid) {
    return {
      status: "blocked",
      risk: "high",
      targetCharacterId: params.targetCharacterId,
      summary: null,
      stateIntegrity: null,
      stateIntegritySnapshotComparison: {
        status: "missing",
        reasons: ["import package did not pass shape validation"]
      },
      packageDigestComparison: {
        status: "missing",
        reasons: ["import package did not pass shape validation"]
      },
      requiresExplicitConfirmation: false,
      willReplaceState: false,
      willReplaceAdjustmentHistory: false,
      auditSummary: buildAuditSummary({
        status: "blocked",
        risk: "high",
        sameCharacter: false,
        stateIntegrity: null,
        snapshotComparison: {
          status: "missing",
          reasons: ["import package did not pass shape validation"]
        },
        digestComparison: {
          status: "missing",
          reasons: ["import package did not pass shape validation"]
        },
        errors: validation.errors,
        summary: null
      }),
      reasons: ["import package failed validation"],
      errors: validation.errors
    };
  }

  const summary = summarizeCharacterExportPackage(params.package);
  const stateIntegrity = inspectImportPackageStateIntegrity(params.package);
  const snapshotComparison = compareEmbeddedStateIntegritySnapshot(params.package, stateIntegrity);
  const digestComparison = compareCharacterExportPackageDigest(params.package);
  if (!stateIntegrity || !stateIntegrity.valid) {
    const sameCharacter = summary?.characterId === params.targetCharacterId;
    return {
      status: "blocked",
      risk: "high",
      targetCharacterId: params.targetCharacterId,
      ...(summary ? { sourceCharacterId: summary.characterId } : {}),
      summary,
      stateIntegrity,
      stateIntegritySnapshotComparison: snapshotComparison,
      packageDigestComparison: digestComparison,
      requiresExplicitConfirmation: false,
      willReplaceState: false,
      willReplaceAdjustmentHistory: false,
      auditSummary: buildAuditSummary({
        status: "blocked",
        risk: "high",
        sameCharacter,
        stateIntegrity,
        snapshotComparison,
        digestComparison,
        errors: stateIntegrity
          ? stateIntegrity.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `${issue.path}: ${issue.message}`)
          : ["import package state could not be deserialized for integrity inspection"],
        summary
      }),
      reasons: buildPlanReasons({
        summary,
        sameCharacter: summary?.characterId === params.targetCharacterId,
        risk: "high",
        stateIntegrity,
        snapshotComparison,
        digestComparison
      }),
      errors: stateIntegrity
        ? stateIntegrity.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => `${issue.path}: ${issue.message}`)
        : ["import package state could not be deserialized for integrity inspection"]
    };
  }
  const risk = classifyImportRisk({
    targetCharacterId: params.targetCharacterId,
    summary,
    stateIntegrity,
    snapshotComparison,
    digestComparison
  });
  const sameCharacter = summary?.characterId === params.targetCharacterId;
  const status = risk === "high" ? "needs_review" : "ready";

  return {
    status,
    risk,
    targetCharacterId: params.targetCharacterId,
    ...(summary ? { sourceCharacterId: summary.characterId } : {}),
    summary,
    stateIntegrity,
    stateIntegritySnapshotComparison: snapshotComparison,
    packageDigestComparison: digestComparison,
    requiresExplicitConfirmation: true,
    willReplaceState: true,
    willReplaceAdjustmentHistory: true,
    auditSummary: buildAuditSummary({
      status,
      risk,
      sameCharacter,
      stateIntegrity,
      snapshotComparison,
      digestComparison,
      errors: [],
      summary
    }),
    reasons: buildPlanReasons({ summary, sameCharacter, risk, stateIntegrity, snapshotComparison, digestComparison }),
    errors: []
  };
}

function buildAuditSummary(params: {
  status: CharacterImportPlanStatus;
  risk: CharacterImportPlanRisk;
  sameCharacter: boolean;
  stateIntegrity: StateIntegrityReport | null;
  snapshotComparison: CharacterImportIntegritySnapshotComparison;
  digestComparison: CharacterExportPackageDigestComparison;
  errors: string[];
  summary: CharacterExportPackageSummary | null;
}): CharacterImportAuditSummary {
  const checks: CharacterImportAuditCheck[] = [
    {
      name: "package_shape",
      status: params.errors.length && !params.summary ? "fail" : "pass",
      message: params.errors.length && !params.summary ? "package shape validation failed" : "package shape is valid"
    },
    {
      name: "state_integrity",
      status: !params.stateIntegrity || !params.stateIntegrity.valid
        ? "fail"
        : params.stateIntegrity.warningCount > 0
          ? "warn"
          : "pass",
      message: renderStateIntegrityMessage(params.stateIntegrity)
    },
    {
      name: "integrity_snapshot",
      status: comparisonStatusToCheckStatus(params.snapshotComparison.status),
      message: renderSnapshotComparisonMessage(params.snapshotComparison)
    },
    {
      name: "package_digest",
      status: comparisonStatusToCheckStatus(params.digestComparison.status),
      message: renderDigestComparisonMessage(params.digestComparison)
    },
    {
      name: "character_match",
      status: params.sameCharacter ? "pass" : "warn",
      message: params.sameCharacter
        ? "source character matches target character"
        : "source character differs from target character"
    },
    {
      name: "governance",
      status: params.summary?.governanceRecommendation === "pause" || params.summary?.stabilityRisk === "high"
        ? "fail"
        : params.summary?.overrideCount || (params.summary?.adjustmentCount ?? 0) >= 4
          ? "warn"
          : "pass",
      message: renderGovernanceMessage(params.summary)
    }
  ];
  const blockers = [
    ...params.errors,
    ...checks.filter((check) => check.status === "fail").map((check) => check.message)
  ];
  const warnings = checks.filter((check) => check.status === "warn").map((check) => check.message);
  const decision: CharacterImportAuditDecision =
    params.status === "blocked" ? "rejected" : params.status === "needs_review" ? "review_required" : "can_apply";
  return {
    decision,
    canApply: decision === "can_apply",
    requiresReview: decision === "review_required",
    nextAction: nextActionForDecision(decision),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    checks
  };
}

function comparisonStatusToCheckStatus(status: "missing" | "matched" | "mismatch"): CharacterImportAuditCheck["status"] {
  if (status === "mismatch") return "fail";
  if (status === "missing") return "warn";
  return "pass";
}

function renderStateIntegrityMessage(stateIntegrity: StateIntegrityReport | null): string {
  if (!stateIntegrity) return "state integrity could not be inspected";
  if (!stateIntegrity.valid) return "state integrity failed";
  if (stateIntegrity.warningCount > 0) return "state integrity passed with warnings";
  return "state integrity passed";
}

function renderSnapshotComparisonMessage(comparison: CharacterImportIntegritySnapshotComparison): string {
  if (comparison.status === "matched") return "embedded integrity snapshot matches recomputed state";
  if (comparison.status === "missing") return "embedded integrity snapshot is missing";
  return "embedded integrity snapshot does not match recomputed state";
}

function renderDigestComparisonMessage(comparison: CharacterExportPackageDigestComparison): string {
  if (comparison.status === "matched") return "package digest matches current content";
  if (comparison.status === "missing") return "package digest is missing";
  return "package digest does not match current content";
}

function renderGovernanceMessage(summary: CharacterExportPackageSummary | null): string {
  if (!summary) return "governance summary is unavailable";
  if (summary.governanceRecommendation === "pause") return "governance recommends pause";
  if (summary.stabilityRisk === "high") return "adjustment history has high stability risk";
  if (summary.overrideCount > 0) return "package contains governance overrides";
  if (summary.adjustmentCount >= 4) return "package contains frequent manual adjustments";
  return "governance allows import consideration";
}

function nextActionForDecision(decision: CharacterImportAuditDecision): string {
  if (decision === "can_apply") return "confirm with replace:<characterId> before applying";
  if (decision === "review_required") return "review audit warnings and use a future elevated workflow if acceptable";
  return "reject this package or repair it before retrying";
}

function classifyImportRisk(params: {
  targetCharacterId: string;
  summary: CharacterExportPackageSummary | null;
  stateIntegrity: StateIntegrityReport | null;
  snapshotComparison: CharacterImportIntegritySnapshotComparison;
  digestComparison: CharacterExportPackageDigestComparison;
}): CharacterImportPlanRisk {
  if (!params.summary) return "high";
  if (!params.stateIntegrity || !params.stateIntegrity.valid) return "high";
  if (params.snapshotComparison.status === "mismatch") return "high";
  if (params.digestComparison.status === "mismatch") return "high";
  if (params.stateIntegrity.warningCount > 0) return "medium";
  if (params.summary.governanceRecommendation === "pause" || params.summary.stabilityRisk === "high") return "high";
  if (params.summary.characterId !== params.targetCharacterId) return "medium";
  if (params.summary.overrideCount > 0 || params.summary.adjustmentCount >= 4) return "medium";
  return "low";
}

function buildPlanReasons(params: {
  summary: CharacterExportPackageSummary | null;
  sameCharacter: boolean;
  risk: CharacterImportPlanRisk;
  stateIntegrity: StateIntegrityReport | null;
  snapshotComparison: CharacterImportIntegritySnapshotComparison;
  digestComparison: CharacterExportPackageDigestComparison;
}): string[] {
  if (!params.summary) return ["valid package summary could not be generated"];
  const reasons = [
    "import plan is read-only and does not mutate character state",
    "import would replace current state and adjustment history"
  ];
  if (!params.sameCharacter) {
    reasons.push("source character id differs from target character id");
  }
  if (params.summary.overrideCount > 0) {
    reasons.push("source package contains governance overrides");
  }
  if (params.summary.governanceRecommendation === "pause") {
    reasons.push("source package governance recommends pause");
  }
  if (!params.stateIntegrity) {
    reasons.push("source package state could not be inspected");
  } else if (!params.stateIntegrity.valid) {
    reasons.push("source package state failed integrity inspection");
  } else if (params.stateIntegrity.warningCount > 0) {
    reasons.push("source package state has integrity warnings");
  } else {
    reasons.push("source package state passed integrity inspection");
  }
  if (params.digestComparison.status === "missing") {
    reasons.push("source package has no embedded digest");
  } else if (params.digestComparison.status === "matched") {
    reasons.push("embedded package digest matches current package content");
  } else {
    reasons.push("embedded package digest differs from current package content");
    reasons.push(...params.digestComparison.reasons);
  }
  if (params.snapshotComparison.status === "missing") {
    reasons.push("source package has no embedded integrity snapshot");
  } else if (params.snapshotComparison.status === "matched") {
    reasons.push("embedded integrity snapshot matches recomputed state integrity");
  } else {
    reasons.push("embedded integrity snapshot differs from recomputed state integrity");
    reasons.push(...params.snapshotComparison.reasons);
  }
  if (params.risk === "high") {
    reasons.push("high-risk import requires additional review before future application");
  }
  return reasons;
}

function compareEmbeddedStateIntegritySnapshot(
  candidatePackage: unknown,
  recomputed: StateIntegrityReport | null
): CharacterImportIntegritySnapshotComparison {
  if (!isRecord(candidatePackage) || !isRecord(candidatePackage.stateIntegrity)) {
    return {
      status: "missing",
      reasons: ["source package has no embedded integrity snapshot"]
    };
  }
  if (!recomputed) {
    return {
      status: "mismatch",
      reasons: ["recomputed state integrity is unavailable"]
    };
  }
  const embedded = candidatePackage.stateIntegrity;
  const mismatches: string[] = [];
  compareValue(embedded.valid, recomputed.valid, "valid", mismatches);
  compareValue(embedded.errorCount, recomputed.errorCount, "errorCount", mismatches);
  compareValue(embedded.warningCount, recomputed.warningCount, "warningCount", mismatches);
  if (isRecord(embedded.summary)) {
    compareValue(embedded.summary.memoryCount, recomputed.summary.memoryCount, "summary.memoryCount", mismatches);
    compareValue(embedded.summary.particleCount, recomputed.summary.particleCount, "summary.particleCount", mismatches);
    compareValue(embedded.summary.clusterCount, recomputed.summary.clusterCount, "summary.clusterCount", mismatches);
    compareValue(embedded.summary.beliefCount, recomputed.summary.beliefCount, "summary.beliefCount", mismatches);
    compareValue(
      embedded.summary.proceduralRoutineCount,
      recomputed.summary.proceduralRoutineCount,
      "summary.proceduralRoutineCount",
      mismatches
    );
  } else {
    mismatches.push("summary is missing from embedded integrity snapshot");
  }

  return {
    status: mismatches.length ? "mismatch" : "matched",
    reasons: mismatches.length ? mismatches : ["embedded integrity snapshot matches recomputed state integrity"]
  };
}

function compareValue(
  embedded: unknown,
  recomputed: unknown,
  path: string,
  mismatches: string[]
): void {
  if (embedded !== recomputed) {
    mismatches.push(`${path} mismatch: embedded=${String(embedded)} recomputed=${String(recomputed)}`);
  }
}

function inspectImportPackageStateIntegrity(candidatePackage: unknown): StateIntegrityReport | null {
  if (!isRecord(candidatePackage)) return null;
  try {
    return inspectCharacterStateIntegrity(deserializeCharacterPhysicsState(candidatePackage.state as never));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
