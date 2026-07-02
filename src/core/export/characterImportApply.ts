import { createHash } from "node:crypto";
import { buildCharacterImportPlan, type CharacterImportPlan } from "./characterImportPlan";
import type { StateIntegrityReport } from "../state/stateIntegrity";

export type CharacterImportApplyStatus = "applied" | "blocked";

export interface CharacterImportApplyTrace {
  status: CharacterImportApplyStatus;
  targetCharacterId: string;
  sourceCharacterId?: string;
  confirmationRequired: string;
  plan: CharacterImportPlan;
  transactionSteps: CharacterImportTransactionStep[];
  transactionSummary: CharacterImportTransactionSummary;
  historyEntryId?: string;
  historyRecordedAt?: string;
  transitionId?: string;
  appliedAt?: string;
  transitionSummary?: CharacterImportTransitionSummary;
  beforeStateIntegrity?: StateIntegrityReport;
  afterStateIntegrity?: StateIntegrityReport;
  /** Serialized pre-mutation state snapshot for manual rollback if needed. Present when state was mutated. */
  stateRollbackSnapshot?: unknown;
  /** Describes which mutations completed and which failed, for diagnosing partial failure. */
  mutationOutcome?: CharacterImportMutationOutcome;
  reasons: string[];
  errors: string[];
}

export interface CharacterImportMutationOutcome {
  stateReplaced: boolean;
  adjustmentHistoryReplaced: boolean;
  historyRecorded: boolean;
  /** When true, all three mutations completed — the import is fully applied. */
  fullyApplied: boolean;
  /** Human-readable diagnosis of what happened. */
  description: string;
}

export type CharacterImportTransactionStepName =
  | "authorization_checked"
  | "before_state_integrity_inspected"
  | "state_deserialized"
  | "after_state_integrity_inspected"
  | "pre_mutation_snapshot_captured"
  | "state_replaced"
  | "adjustment_history_replaced"
  | "apply_failed"
  | "history_recorded";

export type CharacterImportTransactionStepStatus = "completed" | "blocked" | "failed";

export interface CharacterImportTransactionStep {
  name: CharacterImportTransactionStepName;
  status: CharacterImportTransactionStepStatus;
  message: string;
  details?: Record<string, string | number | boolean | null>;
}

export type CharacterImportTransactionTerminalStatus = "completed" | "blocked" | "failed";

export interface CharacterImportTransactionSummary {
  terminalStatus: CharacterImportTransactionTerminalStatus;
  totalSteps: number;
  completedSteps: number;
  blockedSteps: number;
  failedSteps: number;
  stateMutated: boolean;
  adjustmentHistoryMutated: boolean;
  historyRecorded: boolean;
  lastStep?: CharacterImportTransactionStepName;
  reasons: string[];
}

export interface CharacterImportTransitionSummary {
  packageDigest: string;
  before: StateIntegrityReport["summary"];
  after: StateIntegrityReport["summary"];
  delta: StateIntegrityDeltaSummary;
  beforeValid: boolean;
  afterValid: boolean;
  errorDelta: number;
  warningDelta: number;
}

export interface StateIntegrityDeltaSummary {
  memoryCount: number;
  particleCount: number;
  clusterCount: number;
  beliefCount: number;
  proceduralRoutineCount: number;
}

export function authorizeCharacterImportApplication(params: {
  targetCharacterId: string;
  package: unknown;
  confirmation?: string;
}): CharacterImportApplyTrace {
  const plan = buildCharacterImportPlan({
    targetCharacterId: params.targetCharacterId,
    package: params.package
  });
  const confirmationRequired = buildImportConfirmationPhrase(params.targetCharacterId);
  const base = {
    targetCharacterId: params.targetCharacterId,
    ...(plan.sourceCharacterId ? { sourceCharacterId: plan.sourceCharacterId } : {}),
    confirmationRequired,
    plan
  };

  const noMutationOutcome: CharacterImportMutationOutcome = {
    stateReplaced: false,
    adjustmentHistoryReplaced: false,
    historyRecorded: false,
    fullyApplied: false,
    description: "import blocked at authorization — no mutations were attempted"
  };

  if (plan.status !== "ready") {
    return {
      ...base,
      status: "blocked",
      transactionSteps: [
        createImportTransactionStep({
          name: "authorization_checked",
          status: "blocked",
          message: "import plan is not ready for application",
          details: { planStatus: plan.status, risk: plan.risk }
        })
      ],
      transactionSummary: summarizeImportTransactionSteps([
        createImportTransactionStep({
          name: "authorization_checked",
          status: "blocked",
          message: "import plan is not ready for application",
          details: { planStatus: plan.status, risk: plan.risk }
        })
      ]),
      mutationOutcome: noMutationOutcome,
      reasons: [
        "import plan is not ready for application",
        ...plan.reasons
      ],
      errors: plan.errors
    };
  }

  if (params.confirmation !== confirmationRequired) {
    return {
      ...base,
      status: "blocked",
      transactionSteps: [
        createImportTransactionStep({
          name: "authorization_checked",
          status: "blocked",
          message: "explicit confirmation phrase did not match",
          details: { planStatus: plan.status, risk: plan.risk }
        })
      ],
      transactionSummary: summarizeImportTransactionSteps([
        createImportTransactionStep({
          name: "authorization_checked",
          status: "blocked",
          message: "explicit confirmation phrase did not match",
          details: { planStatus: plan.status, risk: plan.risk }
        })
      ]),
      mutationOutcome: noMutationOutcome,
      reasons: [
        "explicit confirmation phrase is required before replacing character state",
        `expected confirmation: ${confirmationRequired}`
      ],
      errors: []
    };
  }

  return {
    ...base,
    status: "applied",
    transactionSteps: [
      createImportTransactionStep({
        name: "authorization_checked",
        status: "completed",
        message: "import package passed authorization checks",
        details: { planStatus: plan.status, risk: plan.risk }
      })
    ],
    transactionSummary: summarizeImportTransactionSteps([
      createImportTransactionStep({
        name: "authorization_checked",
        status: "completed",
        message: "import package passed authorization checks",
        details: { planStatus: plan.status, risk: plan.risk }
      })
    ]),
    reasons: [
      "import package passed validation",
      "explicit confirmation phrase matched",
      "character state and adjustment history may be replaced"
    ],
    errors: []
  };
}

export function buildImportConfirmationPhrase(characterId: string): string {
  return `replace:${characterId}`;
}

export function createImportTransactionStep(params: CharacterImportTransactionStep): CharacterImportTransactionStep {
  return params.details
    ? {
        name: params.name,
        status: params.status,
        message: params.message,
        details: params.details
      }
    : {
        name: params.name,
        status: params.status,
        message: params.message
      };
}

export function appendImportTransactionStep(
  trace: CharacterImportApplyTrace,
  step: CharacterImportTransactionStep
): CharacterImportApplyTrace {
  const transactionSteps = [
    ...trace.transactionSteps,
    createImportTransactionStep(step)
  ];
  return {
    ...trace,
    transactionSteps,
    transactionSummary: summarizeImportTransactionSteps(transactionSteps)
  };
}

export function summarizeImportTransactionSteps(
  steps: CharacterImportTransactionStep[]
): CharacterImportTransactionSummary {
  const completedSteps = steps.filter((step) => step.status === "completed").length;
  const blockedSteps = steps.filter((step) => step.status === "blocked").length;
  const failedSteps = steps.filter((step) => step.status === "failed").length;
  const stateMutated = steps.some((step) => step.name === "state_replaced" && step.status === "completed");
  const adjustmentHistoryMutated = steps.some(
    (step) => step.name === "adjustment_history_replaced" && step.status === "completed"
  );
  const historyRecorded = steps.some((step) => step.name === "history_recorded" && step.status === "completed");
  return {
    terminalStatus: calculateTransactionTerminalStatus({ blockedSteps, failedSteps }),
    totalSteps: steps.length,
    completedSteps,
    blockedSteps,
    failedSteps,
    stateMutated,
    adjustmentHistoryMutated,
    historyRecorded,
    ...(steps.at(-1) ? { lastStep: steps.at(-1)!.name } : {}),
    reasons: buildTransactionSummaryReasons({
      totalSteps: steps.length,
      blockedSteps,
      failedSteps,
      stateMutated,
      adjustmentHistoryMutated,
      historyRecorded
    })
  };
}

function calculateTransactionTerminalStatus(params: {
  blockedSteps: number;
  failedSteps: number;
}): CharacterImportTransactionTerminalStatus {
  if (params.failedSteps > 0) return "failed";
  if (params.blockedSteps > 0) return "blocked";
  return "completed";
}

function buildTransactionSummaryReasons(params: {
  totalSteps: number;
  blockedSteps: number;
  failedSteps: number;
  stateMutated: boolean;
  adjustmentHistoryMutated: boolean;
  historyRecorded: boolean;
}): string[] {
  const reasons = [`${params.totalSteps} transaction step(s) recorded`];
  if (params.failedSteps > 0) reasons.push(`${params.failedSteps} failed step(s)`);
  if (params.blockedSteps > 0) reasons.push(`${params.blockedSteps} blocked step(s)`);
  if (params.stateMutated) reasons.push("character state was replaced");
  if (params.adjustmentHistoryMutated) reasons.push("parameter adjustment history was replaced");
  if (params.historyRecorded) reasons.push("import transition history was recorded");
  // Detect partial mutation: state replaced but adjustment history not
  if (params.stateMutated && !params.adjustmentHistoryMutated) {
    reasons.push("WARNING: partial mutation — state replaced without adjustment history; manual rollback may be needed");
  }
  return reasons;
}

export function buildCharacterImportTransitionSummary(params: {
  packageDigest: string;
  beforeStateIntegrity: StateIntegrityReport;
  afterStateIntegrity: StateIntegrityReport;
}): CharacterImportTransitionSummary {
  return {
    packageDigest: params.packageDigest,
    before: params.beforeStateIntegrity.summary,
    after: params.afterStateIntegrity.summary,
    delta: {
      memoryCount: params.afterStateIntegrity.summary.memoryCount - params.beforeStateIntegrity.summary.memoryCount,
      particleCount: params.afterStateIntegrity.summary.particleCount - params.beforeStateIntegrity.summary.particleCount,
      clusterCount: params.afterStateIntegrity.summary.clusterCount - params.beforeStateIntegrity.summary.clusterCount,
      beliefCount: params.afterStateIntegrity.summary.beliefCount - params.beforeStateIntegrity.summary.beliefCount,
      proceduralRoutineCount:
        params.afterStateIntegrity.summary.proceduralRoutineCount -
        params.beforeStateIntegrity.summary.proceduralRoutineCount
    },
    beforeValid: params.beforeStateIntegrity.valid,
    afterValid: params.afterStateIntegrity.valid,
    errorDelta: params.afterStateIntegrity.errorCount - params.beforeStateIntegrity.errorCount,
    warningDelta: params.afterStateIntegrity.warningCount - params.beforeStateIntegrity.warningCount
  };
}

export function buildCharacterImportTransitionId(params: {
  targetCharacterId: string;
  sourceCharacterId?: string;
  packageDigest: string;
  beforeStateIntegrity: StateIntegrityReport;
  afterStateIntegrity: StateIntegrityReport;
}): string {
  const payload = {
    targetCharacterId: params.targetCharacterId,
    sourceCharacterId: params.sourceCharacterId ?? null,
    packageDigest: params.packageDigest,
    before: params.beforeStateIntegrity.summary,
    after: params.afterStateIntegrity.summary,
    beforeValid: params.beforeStateIntegrity.valid,
    afterValid: params.afterStateIntegrity.valid,
    beforeErrorCount: params.beforeStateIntegrity.errorCount,
    afterErrorCount: params.afterStateIntegrity.errorCount,
    beforeWarningCount: params.beforeStateIntegrity.warningCount,
    afterWarningCount: params.afterStateIntegrity.warningCount
  };
  return `import_${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16)}`;
}
