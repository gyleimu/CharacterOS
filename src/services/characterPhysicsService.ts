import type { ExperienceEvent } from "../core/event/event";
import {
  CharacterPhysicsEngine,
  type CharacterPhysicsState,
  type PhysicsStepResult
} from "../core/physics/physicsEngine";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../core/character/characterBlueprint";
import { runEventSequence, type SimulationResult } from "../core/simulation/runner";
import { runContinuousTick, type ContinuousTickOptions, type ContinuousTickTrace } from "../core/time/continuousTick";
import {
  applyParameterAdjustmentPatch,
  rollbackParameterAdjustmentPatch,
  type ParameterAdjustmentApplyTrace
} from "../core/parameters/parameterAdjustmentApply";
import {
  createParameterAdjustmentHistoryEntry,
  summarizeParameterAdjustmentHistory,
  type ParameterAdjustmentHistoryEntry
} from "../core/parameters/parameterAdjustmentHistory";
import { evaluateParameterAdjustmentGovernance } from "../core/parameters/parameterAdjustmentGovernance";
import {
  evaluateParameterAdjustmentGovernanceOverride,
  type ParameterAdjustmentGovernanceOverride
} from "../core/parameters/parameterAdjustmentGovernanceOverride";
import type { ParameterAdjustmentPatchTrace } from "../core/parameters/parameterAdjustmentPatch";
import type { ParameterAdjustmentSnapshotTrace } from "../core/parameters/parameterAdjustmentSnapshot";
import {
  InMemoryCharacterPhysicsRepository,
  type CharacterPhysicsRepository
} from "../db/repositories/characterPhysicsRepository";
import {
  InMemoryParameterAdjustmentHistoryRepository,
  type ParameterAdjustmentHistoryRepository
} from "../db/repositories/parameterAdjustmentHistoryRepository";
import {
  InMemoryCharacterImportTransitionHistoryRepository,
  type CharacterImportTransitionHistoryRepository
} from "../db/repositories/characterImportTransitionHistoryRepository";
import {
  InMemoryLongitudinalCommitAuditRepository,
  type LongitudinalCommitAuditRepository
} from "../db/repositories/longitudinalCommitAuditRepository";
import {
  createLongitudinalCommitAuditEntry,
  markLongitudinalCommitAuditApplied,
  markLongitudinalCommitAuditRolledBack,
  type LongitudinalCommitAuditEntry
} from "../core/life/longitudinalCommitAudit";
import {
  computeLongitudinalStateFingerprint,
  type LongitudinalFinalStateForCommit
} from "../core/life/finalStateForCommit";
import {
  evaluateLongitudinalCommitApplyReadiness,
  type LongitudinalCommitApplyOptions,
  type LongitudinalCommitApplyResult
} from "../core/life/longitudinalCommitApply";
import {
  applyLongitudinalCommitRollbackToState,
  evaluateLongitudinalCommitRollbackReadiness,
  type LongitudinalCommitRollbackOptions,
  type LongitudinalCommitRollbackResult,
  type LongitudinalCommitRollbackTarget
} from "../core/life/longitudinalCommitRollback";
import {
  appendImportTransactionStep,
  authorizeCharacterImportApplication,
  buildCharacterImportTransitionId,
  buildCharacterImportTransitionSummary,
  type CharacterImportApplyTrace,
  type CharacterImportMutationOutcome
} from "../core/export/characterImportApply";
import { normalizeTags } from "../core/event/tagNormalization";
import { computeCharacterExportPackageDigest } from "../core/export/characterExportPackageDigest";
import {
  createCharacterImportTransitionHistoryEntry,
  type CharacterImportTransitionHistoryEntry
} from "../core/export/characterImportTransitionHistory";
import {
  deserializeCharacterPhysicsState,
  serializeCharacterPhysicsState,
  type SerializedCharacterPhysicsState
} from "../core/physics/serialization";
import { inspectCharacterStateIntegrity } from "../core/state/stateIntegrity";

export interface CharacterPhysicsService {
  getState(characterId: string): CharacterPhysicsState;
  /** Returns true when a character state exists in the backing store (not auto-created). */
  hasCharacter(characterId: string): boolean;
  processEvent(characterId: string, event: ExperienceEvent): PhysicsStepResult;
  simulateEvents(
    characterId: string,
    events: ExperienceEvent[],
    options?: { daysPerStep?: number }
  ): SimulationResult;
  tickCharacter(characterId: string, options?: ContinuousTickOptions): ContinuousTickTrace;
  applyParameterAdjustment(
    characterId: string,
    patch: ParameterAdjustmentPatchTrace,
    snapshot: ParameterAdjustmentSnapshotTrace,
    governanceOverride?: Partial<ParameterAdjustmentGovernanceOverride>
  ): ParameterAdjustmentApplyTrace;
  rollbackParameterAdjustment(
    characterId: string,
    snapshot: ParameterAdjustmentSnapshotTrace
  ): ParameterAdjustmentApplyTrace;
  importCharacterPackage(
    characterId: string,
    candidatePackage: unknown,
    confirmation?: string
  ): CharacterImportApplyTrace;
  getParameterAdjustmentHistory(characterId: string): ParameterAdjustmentHistoryEntry[];
  getImportTransitionHistory(characterId: string): CharacterImportTransitionHistoryEntry[];
  resetCharacter(characterId: string, options?: ResetCharacterOptions): CharacterPhysicsState;
  /** Replace the entire character state. Used by the editor apply pipeline. */
  replaceState(characterId: string, state: CharacterPhysicsState): void;
  /** Record a patch audit entry in the in-memory log. */
  recordPatchAudit(characterId: string, entry: { id: string; patchId: string; timestamp: string; description: string; changedPaths: string[]; applied: boolean; dryRun: boolean; warnings: string[]; reasons: string[]; [key: string]: unknown }): void;
  /** Get patch audit history for a character. */
  getPatchAuditHistory(characterId: string): unknown[];
  /** Record a longitudinal simulation commit audit entry. */
  recordLongitudinalCommitAudit(entry: LongitudinalCommitAuditEntry): void;
  /** Get longitudinal simulation commit audit history for a character. */
  getLongitudinalCommitAuditHistory(characterId: string): LongitudinalCommitAuditEntry[];
  /** Look up a longitudinal commit audit by simulation id. */
  getLongitudinalCommitAuditBySimulationId(
    characterId: string,
    simulationId: string
  ): LongitudinalCommitAuditEntry | undefined;
  /** Apply a private longitudinal finalStateForCommit handoff. No public route calls this directly yet. */
  applyLongitudinalCommit(
    handoff: LongitudinalFinalStateForCommit,
    options?: LongitudinalCommitApplyOptions
  ): LongitudinalCommitApplyResult;
  /** Roll back an applied longitudinal commit by removing generated memory seeds only. */
  rollbackLongitudinalCommit(
    characterId: string,
    target: LongitudinalCommitRollbackTarget,
    options?: LongitudinalCommitRollbackOptions
  ): LongitudinalCommitRollbackResult;
}

export interface ResetCharacterOptions {
  seedInitialExperiences?: boolean;
}

export class InMemoryCharacterPhysicsService implements CharacterPhysicsService {
  private readonly engine = new CharacterPhysicsEngine();
  private readonly patchAuditLog = new Map<string, unknown[]>();

  constructor(
    private readonly repository: CharacterPhysicsRepository = new InMemoryCharacterPhysicsRepository(),
    private readonly adjustmentHistoryRepository: ParameterAdjustmentHistoryRepository =
      new InMemoryParameterAdjustmentHistoryRepository(),
    private readonly importTransitionHistoryRepository: CharacterImportTransitionHistoryRepository =
      new InMemoryCharacterImportTransitionHistoryRepository(),
    private readonly longitudinalCommitAuditRepository: LongitudinalCommitAuditRepository =
      new InMemoryLongitudinalCommitAuditRepository()
  ) {}

  getState(characterId: string): CharacterPhysicsState {
    return cloneCharacterPhysicsState(this.ensureState(characterId));
  }

  hasCharacter(characterId: string): boolean {
    return this.repository.get(characterId) !== undefined;
  }

  processEvent(characterId: string, event: ExperienceEvent): PhysicsStepResult {
    // Normalize tags to canonical Chinese form at the service boundary,
    // so that downstream tag-dependent systems (attention, world model,
    // procedural memory) always receive canonical tags regardless of
    // whether the event came through the parser or directly via API.
    const normalizedEvent = { ...event, tags: normalizeTags(event.tags) };
    let result: PhysicsStepResult | undefined;
    this.repository.update(characterId, (existing) => {
      const state = existing ?? createDefaultState();
      result = this.engine.processEvent(state, normalizedEvent);
      return state;
    });
    if (!result) throw new Error("processEvent did not produce a physics result");
    return result;
  }

  simulateEvents(
    characterId: string,
    events: ExperienceEvent[],
    options: { daysPerStep?: number } = {}
  ): SimulationResult {
    const normalizedEvents = events.map((event) => ({
      ...event,
      tags: normalizeTags(event.tags)
    }));
    let result: SimulationResult | undefined;
    this.repository.update(characterId, (existing) => {
      const state = existing ?? createDefaultState();
      result = runEventSequence({
        state,
        events: normalizedEvents,
        engine: this.engine,
        daysPerStep: options.daysPerStep ?? 0
      });
      return state;
    });
    if (!result) throw new Error("simulateEvents did not produce a simulation result");
    return result;
  }

  tickCharacter(characterId: string, options: ContinuousTickOptions = {}): ContinuousTickTrace {
    let trace: ContinuousTickTrace | undefined;
    this.repository.update(characterId, (existing) => {
      const state = existing ?? createDefaultState();
      trace = runContinuousTick(state, options);
      return state;
    });
    if (!trace) throw new Error("tickCharacter did not produce a continuous tick trace");
    return trace;
  }

  applyParameterAdjustment(
    characterId: string,
    patch: ParameterAdjustmentPatchTrace,
    snapshot: ParameterAdjustmentSnapshotTrace,
    governanceOverride?: Partial<ParameterAdjustmentGovernanceOverride>
  ): ParameterAdjustmentApplyTrace {
    const governance = evaluateParameterAdjustmentGovernance(
      summarizeParameterAdjustmentHistory(this.getParameterAdjustmentHistory(characterId))
    );
    const overrideDecision = evaluateParameterAdjustmentGovernanceOverride({
      governance,
      ...(governanceOverride ? { override: governanceOverride } : {})
    });
    if (!overrideDecision.allowed) {
      return {
        status: "blocked",
        appliedOperations: [],
        snapshotId: "",
        reasons: overrideDecision.reasons
      };
    }
    let trace: ParameterAdjustmentApplyTrace | undefined;
    this.repository.update(characterId, (existing) => {
      const state = existing ?? createDefaultState();
      const result = applyParameterAdjustmentPatch({ state, patch, snapshot });
      trace = result.trace;
      return result.trace.status === "applied" ? result.state : state;
    });
    if (!trace) throw new Error("applyParameterAdjustment did not produce a trace");
    if (trace.status === "applied") {
      if (overrideDecision.usedOverride) {
        trace.reasons.push(...overrideDecision.reasons);
        const overrideReason = governanceOverride?.reason?.trim();
        trace.governanceOverride = {
          used: true,
          ...(overrideReason ? { reason: overrideReason } : {})
        };
      }
      this.adjustmentHistoryRepository.append(createParameterAdjustmentHistoryEntry({
        characterId,
        action: "apply",
        trace
      }));
    }
    return trace;
  }

  rollbackParameterAdjustment(
    characterId: string,
    snapshot: ParameterAdjustmentSnapshotTrace
  ): ParameterAdjustmentApplyTrace {
    let trace: ParameterAdjustmentApplyTrace | undefined;
    this.repository.update(characterId, (existing) => {
      const state = existing ?? createDefaultState();
      const result = rollbackParameterAdjustmentPatch({ state, snapshot });
      trace = result.trace;
      return result.trace.status === "applied" ? result.state : state;
    });
    if (!trace) throw new Error("rollbackParameterAdjustment did not produce a trace");
    if (trace.status === "applied") {
      this.adjustmentHistoryRepository.append(createParameterAdjustmentHistoryEntry({
        characterId,
        action: "rollback",
        trace
      }));
    }
    return trace;
  }

  importCharacterPackage(
    characterId: string,
    candidatePackage: unknown,
    confirmation?: string
  ): CharacterImportApplyTrace {
    const authorization = authorizeCharacterImportApplication({
      targetCharacterId: characterId,
      package: candidatePackage,
      ...(confirmation ? { confirmation } : {})
    });
    if (authorization.status !== "applied") {
      return this.recordImportTransition(characterId, authorization);
    }
    const beforeStateIntegrity = inspectCharacterStateIntegrity(this.ensureState(characterId));
    let traceWithSteps = appendImportTransactionStep(authorization, {
      name: "before_state_integrity_inspected",
      status: "completed",
      message: "target character state integrity inspected before import",
      details: {
        valid: beforeStateIntegrity.valid,
        errors: beforeStateIntegrity.errorCount,
        warnings: beforeStateIntegrity.warningCount
      }
    });
    const importPackage = toImportableCharacterPackage(candidatePackage);
    if (!importPackage) {
      const trace = appendImportTransactionStep(traceWithSteps, {
        name: "apply_failed",
        status: "failed",
        message: "import package shape was not available at apply time"
      });
      return this.recordImportTransition(characterId, {
        ...trace,
        status: "blocked",
        beforeStateIntegrity,
        reasons: ["import package could not be applied safely", "import package shape was not available"],
        errors: ["import package application failed"]
      });
    }
    try {
      const nextState = deserializeCharacterPhysicsState(importPackage.state);
      traceWithSteps = appendImportTransactionStep(traceWithSteps, {
        name: "state_deserialized",
        status: "completed",
        message: "imported character state deserialized"
      });
      const afterStateIntegrity = inspectCharacterStateIntegrity(nextState);
      traceWithSteps = appendImportTransactionStep(traceWithSteps, {
        name: "after_state_integrity_inspected",
        status: "completed",
        message: "imported character state integrity inspected after deserialization",
        details: {
          valid: afterStateIntegrity.valid,
          errors: afterStateIntegrity.errorCount,
          warnings: afterStateIntegrity.warningCount
        }
      });
      const packageDigest = computeCharacterExportPackageDigest(candidatePackage).value;
      const transitionSummary = buildCharacterImportTransitionSummary({
        packageDigest,
        beforeStateIntegrity,
        afterStateIntegrity
      });
      const transitionId = buildCharacterImportTransitionId({
        targetCharacterId: characterId,
        ...(authorization.sourceCharacterId ? { sourceCharacterId: authorization.sourceCharacterId } : {}),
        packageDigest,
        beforeStateIntegrity,
        afterStateIntegrity
      });

      // Capture pre-mutation snapshot for manual rollback. This is NOT an
      // automatic rollback mechanism — it is an audit artifact so that a
      // human operator can restore the previous state if the import fails
      // partway through. Real ACID rollback would require wrapping all
      // repository writes in a transaction that can be aborted.
      const preMutationState = serializeCharacterPhysicsState(this.ensureState(characterId));
      traceWithSteps = appendImportTransactionStep(traceWithSteps, {
        name: "pre_mutation_snapshot_captured",
        status: "completed",
        message: "pre-mutation state snapshot captured for potential manual rollback"
      });

      // Mutation phase: each step is individually tracked so the trace
      // accurately reflects which side-effects actually occurred.
      const mutationOutcome: CharacterImportMutationOutcome = {
        stateReplaced: false,
        adjustmentHistoryReplaced: false,
        historyRecorded: false,
        fullyApplied: false,
        description: "mutation not yet attempted"
      };

      try {
        this.repository.set(characterId, nextState);
        mutationOutcome.stateReplaced = true;
        traceWithSteps = appendImportTransactionStep(traceWithSteps, {
          name: "state_replaced",
          status: "completed",
          message: "target character state replaced"
        });
      } catch (stateError) {
        traceWithSteps = appendImportTransactionStep(traceWithSteps, {
          name: "state_replaced",
          status: "failed",
          message: stateError instanceof Error ? stateError.message : "state replacement failed"
        });
        mutationOutcome.description = "state replacement failed; adjustment history was not modified";
        const trace: CharacterImportApplyTrace = {
          ...traceWithSteps,
          transitionId,
          transitionSummary,
          beforeStateIntegrity,
          afterStateIntegrity,
          stateRollbackSnapshot: preMutationState,
          mutationOutcome,
          reasons: [
            ...authorization.reasons,
            "character state replacement failed — pre-mutation snapshot preserved"
          ],
          errors: ["state replacement failed"]
        };
        return this.recordImportTransition(characterId, { ...trace, status: "blocked" });
      }

      try {
        this.adjustmentHistoryRepository.replace(characterId, importPackage.adjustmentHistory.history);
        mutationOutcome.adjustmentHistoryReplaced = true;
        traceWithSteps = appendImportTransactionStep(traceWithSteps, {
          name: "adjustment_history_replaced",
          status: "completed",
          message: "target parameter adjustment history replaced",
          details: { importedEntries: importPackage.adjustmentHistory.history.length }
        });
      } catch (historyError) {
        traceWithSteps = appendImportTransactionStep(traceWithSteps, {
          name: "adjustment_history_replaced",
          status: "failed",
          message: historyError instanceof Error ? historyError.message : "adjustment history replacement failed"
        });
        // State was already replaced. This is a partial mutation.
        mutationOutcome.description =
          "state replaced but adjustment history replacement failed — partial mutation; manual rollback may be needed";
        const trace: CharacterImportApplyTrace = {
          ...traceWithSteps,
          transitionId,
          transitionSummary,
          beforeStateIntegrity,
          afterStateIntegrity,
          stateRollbackSnapshot: preMutationState,
          mutationOutcome,
          reasons: [
            ...authorization.reasons,
            "character state was replaced but adjustment history replacement failed",
            "pre-mutation snapshot is available for manual rollback"
          ],
          errors: ["adjustment history replacement failed after state was already replaced"]
        };
        return this.recordImportTransition(characterId, { ...trace, status: "blocked" });
      }

      mutationOutcome.fullyApplied = true;
      mutationOutcome.description = "all mutations applied successfully";
      const trace: CharacterImportApplyTrace = {
        ...traceWithSteps,
        transitionId,
        appliedAt: new Date().toISOString(),
        transitionSummary,
        beforeStateIntegrity,
        afterStateIntegrity,
        stateRollbackSnapshot: preMutationState,
        mutationOutcome,
        reasons: [
          ...authorization.reasons,
          "character import replaced state and adjustment history"
        ]
      };
      return this.recordImportTransition(characterId, trace);
    } catch (error) {
      const trace: CharacterImportApplyTrace = {
        ...appendImportTransactionStep(traceWithSteps, {
          name: "apply_failed",
          status: "failed",
          message: error instanceof Error ? error.message : "unknown import apply error"
        }),
        status: "blocked",
        beforeStateIntegrity,
        mutationOutcome: {
          stateReplaced: false,
          adjustmentHistoryReplaced: false,
          historyRecorded: false,
          fullyApplied: false,
          description: "import failed before any mutation was attempted"
        },
        reasons: [
          "import package could not be applied safely",
          error instanceof Error ? error.message : "unknown import apply error"
        ],
        errors: ["import package application failed"]
      };
      return this.recordImportTransition(characterId, trace);
    }
  }

  getParameterAdjustmentHistory(characterId: string): ParameterAdjustmentHistoryEntry[] {
    return this.adjustmentHistoryRepository.list(characterId);
  }

  getImportTransitionHistory(characterId: string): CharacterImportTransitionHistoryEntry[] {
    return this.importTransitionHistoryRepository.list(characterId);
  }

  resetCharacter(characterId: string, options: ResetCharacterOptions = {}): CharacterPhysicsState {
    const state = createDefaultState(options);
    this.repository.set(characterId, state);
    this.adjustmentHistoryRepository.clear(characterId);
    this.importTransitionHistoryRepository.clear(characterId);
    this.longitudinalCommitAuditRepository.clear(characterId);
    return state;
  }

  replaceState(characterId: string, state: CharacterPhysicsState): void {
    this.repository.set(characterId, state);
  }

  recordPatchAudit(characterId: string, entry: Record<string, unknown>): void {
    const entries = this.patchAuditLog.get(characterId) ?? [];
    entries.push(entry);
    this.patchAuditLog.set(characterId, entries);
  }

  getPatchAuditHistory(characterId: string): unknown[] {
    return this.patchAuditLog.get(characterId) ?? [];
  }

  recordLongitudinalCommitAudit(entry: LongitudinalCommitAuditEntry): void {
    this.longitudinalCommitAuditRepository.append(entry);
  }

  getLongitudinalCommitAuditHistory(characterId: string): LongitudinalCommitAuditEntry[] {
    return this.longitudinalCommitAuditRepository.list(characterId);
  }

  getLongitudinalCommitAuditBySimulationId(
    characterId: string,
    simulationId: string
  ): LongitudinalCommitAuditEntry | undefined {
    return this.longitudinalCommitAuditRepository.getBySimulationId(characterId, simulationId);
  }

  applyLongitudinalCommit(
    handoff: LongitudinalFinalStateForCommit,
    options: LongitudinalCommitApplyOptions = {}
  ): LongitudinalCommitApplyResult {
    const characterId = handoff.characterId;
    if (!this.hasCharacter(characterId)) {
      return {
        status: "not_found",
        applied: false,
        characterId,
        simulationId: handoff.simulationId,
        warnings: [],
        reasons: [`Character "${characterId}" not found; longitudinal commit was not applied.`],
      };
    }

    const currentState = this.getState(characterId);
    const readiness = evaluateLongitudinalCommitApplyReadiness({
      handoff,
      currentStateFingerprint: computeLongitudinalStateFingerprint(currentState),
      ...(options.confirmation ? { confirmation: options.confirmation } : {}),
      ...(options.allowWarnings !== undefined ? { allowWarnings: options.allowWarnings } : {}),
    });

    const attemptedAt = options.appliedAt ?? new Date().toISOString();
    const existingAudit = this.longitudinalCommitAuditRepository.get(characterId, handoff.auditDraft.id);
    const baseAudit = existingAudit ?? createLongitudinalCommitAuditEntry(handoff, { createdAt: attemptedAt });

    if (readiness.status !== "ready") {
      const preserveAppliedAudit = existingAudit?.status === "applied";
      const blockedAudit: LongitudinalCommitAuditEntry = preserveAppliedAudit
        ? baseAudit
        : {
            ...baseAudit,
            status: "blocked",
            updatedAt: attemptedAt,
            warnings: [...baseAudit.warnings, ...readiness.warnings],
            reasons: [
              ...baseAudit.reasons,
              ...readiness.reasons,
              ...readiness.blockers.map((blocker) => `Apply blocked: ${blocker}`),
            ],
          };
      if (!preserveAppliedAudit) {
        this.upsertLongitudinalCommitAudit(blockedAudit);
      }
      return {
        status: readiness.status,
        applied: false,
        characterId,
        simulationId: handoff.simulationId,
        audit: blockedAudit,
        readiness,
        warnings: [...blockedAudit.warnings, ...readiness.warnings],
        reasons: [
          ...blockedAudit.reasons,
          ...(preserveAppliedAudit
            ? [
                "Apply attempt was blocked; existing applied audit entry was preserved without changing its status.",
                ...readiness.reasons,
                ...readiness.blockers.map((blocker) => `Apply blocked: ${blocker}`),
              ]
            : []),
        ],
      };
    }

    const appliedAudit = markLongitudinalCommitAuditApplied(baseAudit, attemptedAt);
    try {
      this.upsertLongitudinalCommitAudit(baseAudit);
      this.repository.set(characterId, handoff.finalState);
      this.upsertLongitudinalCommitAudit(appliedAudit);
    } catch (error) {
      try {
        this.repository.set(characterId, currentState);
      } catch {
        // Preserve the original failure; rollback of the local state is best effort.
      }
      throw error;
    }

    return {
      status: "applied",
      applied: true,
      characterId,
      simulationId: handoff.simulationId,
      audit: appliedAudit,
      readiness,
      warnings: [...appliedAudit.warnings],
      reasons: [...appliedAudit.reasons],
    };
  }

  rollbackLongitudinalCommit(
    characterId: string,
    target: LongitudinalCommitRollbackTarget,
    options: LongitudinalCommitRollbackOptions = {}
  ): LongitudinalCommitRollbackResult {
    if (!this.hasCharacter(characterId)) {
      return {
        status: "not_found",
        rolledBack: false,
        characterId,
        ...(target.simulationId ? { simulationId: target.simulationId } : {}),
        warnings: [],
        reasons: [`Character "${characterId}" not found; longitudinal commit rollback was not applied.`],
      };
    }

    const audit = target.auditId
      ? this.longitudinalCommitAuditRepository.get(characterId, target.auditId)
      : target.simulationId
        ? this.longitudinalCommitAuditRepository.getBySimulationId(characterId, target.simulationId)
        : undefined;

    if (!audit) {
      return {
        status: "not_found",
        rolledBack: false,
        characterId,
        ...(target.simulationId ? { simulationId: target.simulationId } : {}),
        warnings: [],
        reasons: ["Longitudinal commit audit entry was not found; rollback was not applied."],
      };
    }

    const currentState = this.getState(characterId);
    const readiness = evaluateLongitudinalCommitRollbackReadiness({
      audit,
      currentStateFingerprint: computeLongitudinalStateFingerprint(currentState),
      ...(options.confirmation ? { confirmation: options.confirmation } : {}),
    });

    if (readiness.status !== "ready") {
      return {
        status: readiness.status,
        rolledBack: false,
        characterId,
        simulationId: audit.simulationId,
        audit,
        readiness,
        warnings: [...audit.warnings, ...readiness.warnings],
        reasons: [
          ...audit.reasons,
          ...readiness.reasons,
          ...readiness.blockers.map((blocker) => `Rollback blocked: ${blocker}`),
        ],
      };
    }

    const mutation = applyLongitudinalCommitRollbackToState(currentState, audit);
    const rolledBackAt = options.rolledBackAt ?? new Date().toISOString();
    const rolledBackAudit = markLongitudinalCommitAuditRolledBack(audit, rolledBackAt);
    try {
      this.repository.set(characterId, mutation.state);
      this.upsertLongitudinalCommitAudit(rolledBackAudit);
    } catch (error) {
      try {
        this.repository.set(characterId, currentState);
      } catch {
        // Preserve the original failure; rollback of the local state is best effort.
      }
      throw error;
    }

    return {
      status: "rolled_back",
      rolledBack: true,
      characterId,
      simulationId: audit.simulationId,
      audit: rolledBackAudit,
      readiness,
      mutation: {
        removedMemoryIds: [...mutation.removedMemoryIds],
        missingMemoryIds: [...mutation.missingMemoryIds],
        afterStateFingerprint: mutation.afterStateFingerprint,
        warnings: [...mutation.warnings],
        reasons: [...mutation.reasons],
      },
      warnings: [...rolledBackAudit.warnings, ...mutation.warnings],
      reasons: [...rolledBackAudit.reasons, ...mutation.reasons],
    };
  }

  private ensureState(characterId: string): CharacterPhysicsState {
    const existing = this.repository.get(characterId);
    if (existing) return existing;
    return this.resetCharacter(characterId);
  }

  private recordImportTransition(characterId: string, trace: CharacterImportApplyTrace): CharacterImportApplyTrace {
    const entry = createCharacterImportTransitionHistoryEntry({
      characterId,
      trace
    });
    const traceWithHistoryEntry: CharacterImportApplyTrace = {
      ...trace,
      historyEntryId: entry.id,
      historyRecordedAt: entry.createdAt,
      ...(trace.mutationOutcome
        ? { mutationOutcome: { ...trace.mutationOutcome, historyRecorded: true } }
        : {})
    };
    const traceWithRecordedStep = appendImportTransactionStep(traceWithHistoryEntry, {
      name: "history_recorded",
      status: "completed",
      message: "import transition history entry recorded",
      details: { historyEntryId: entry.id }
    });
    this.importTransitionHistoryRepository.append({
      ...entry,
      trace: traceWithRecordedStep
    });
    return traceWithRecordedStep;
  }

  private upsertLongitudinalCommitAudit(entry: LongitudinalCommitAuditEntry): void {
    const existing = this.longitudinalCommitAuditRepository.get(entry.characterId, entry.id);
    if (existing) {
      this.longitudinalCommitAuditRepository.update(entry.characterId, entry.id, () => entry);
      return;
    }
    this.longitudinalCommitAuditRepository.append(entry);
  }
}

export function createDefaultState(options: ResetCharacterOptions = {}): CharacterPhysicsState {
  return createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: options.seedInitialExperiences ?? false
  });
}

function cloneCharacterPhysicsState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state)));
}

function toImportableCharacterPackage(value: unknown): {
  state: SerializedCharacterPhysicsState;
  adjustmentHistory: { history: ParameterAdjustmentHistoryEntry[] };
} | null {
  if (!isRecord(value) || !isRecord(value.state) || !isRecord(value.adjustmentHistory)) return null;
  if (!isSerializedCharacterPhysicsStateShape(value.state)) return null;
  const history = parseParameterAdjustmentHistory(value.adjustmentHistory.history);
  if (!history) return null;
  return {
    state: value.state,
    adjustmentHistory: { history }
  };
}

function isSerializedCharacterPhysicsStateShape(value: unknown): value is SerializedCharacterPhysicsState {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.coordinate) &&
    isRecord(value.personality) &&
    Array.isArray(value.clusters) &&
    Array.isArray(value.particles) &&
    Array.isArray(value.memories) &&
    typeof value.learningRate === "number" &&
    isRecord(value.derived) &&
    isRecord(value.galaxy)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseParameterAdjustmentHistory(value: unknown): ParameterAdjustmentHistoryEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries: ParameterAdjustmentHistoryEntry[] = [];
  for (const entry of value) {
    if (!isParameterAdjustmentHistoryEntry(entry)) return null;
    entries.push(entry);
  }
  return entries;
}

function isParameterAdjustmentHistoryEntry(value: unknown): value is ParameterAdjustmentHistoryEntry {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.characterId !== "string") return false;
  if (value.action !== "apply" && value.action !== "rollback") return false;
  if (value.status !== "applied" && value.status !== "blocked") return false;
  if (typeof value.snapshotId !== "string") return false;
  if (typeof value.operationCount !== "number") return false;
  if (!isStringArray(value.targetPaths)) return false;
  if (typeof value.createdAt !== "string") return false;
  if (!isStringArray(value.reasons)) return false;
  if (value.governanceOverride !== undefined && !isParameterAdjustmentGovernanceOverride(value.governanceOverride)) {
    return false;
  }
  return true;
}

function isParameterAdjustmentGovernanceOverride(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.used !== "boolean") return false;
  if (value.reason !== undefined && typeof value.reason !== "string") return false;
  return true;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
