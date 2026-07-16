import type { ExperienceEvent } from "../core/event/event";
import type { BoundaryImpactResult } from "../core/boundary/psychologicalBoundary";
import type { SerializedCharacterPhysicsState } from "../core/physics/serialization";
import type { GalaxyStepTrace } from "../core/trace/galaxyTrace";
import type { SimulationSnapshot } from "../core/simulation/runner";
import type { TraceReplaySummaryIndex } from "../core/trace/traceReplaySummary";
import type { ReplayCalibrationSuite } from "../core/trace/replayCalibration";
import type { ContinuousTickOptions, ContinuousTickTrace } from "../core/time/continuousTick";
import type {
  ParameterAdjustmentApplyTrace
} from "../core/parameters/parameterAdjustmentApply";
import type {
  ParameterAdjustmentHistoryEntry,
  ParameterAdjustmentHistorySummary
} from "../core/parameters/parameterAdjustmentHistory";
import type { ParameterAdjustmentGovernanceTrace } from "../core/parameters/parameterAdjustmentGovernance";
import type { ParameterAdjustmentGovernanceOverride } from "../core/parameters/parameterAdjustmentGovernanceOverride";
import type { ParameterAdjustmentPatchTrace } from "../core/parameters/parameterAdjustmentPatch";
import type { ParameterAdjustmentSnapshotTrace } from "../core/parameters/parameterAdjustmentSnapshot";
import type { ProceduralActivation } from "../core/procedural/proceduralMemory";
import type { RewardResult } from "../core/reward/rewardSystem";
import type { TimePerceptionTrace } from "../core/time/timePerception";
import type { EventTemporalTrace } from "../core/time/eventTemporalSemantics";
import type { WorldModelInterpretation } from "../core/worldmodel/worldModel";
import type { AttentionEvaluation } from "../core/attention/attentionSystem";
import type { CharacterExportPackageSummary } from "../core/export/characterExportValidation";
import type { CharacterImportPlan } from "../core/export/characterImportPlan";
import type { CharacterImportApplyTrace } from "../core/export/characterImportApply";
import type {
  CharacterImportTransitionHistoryEntry,
  CharacterImportTransitionHistorySummary
} from "../core/export/characterImportTransitionHistory";
import type { StateIntegrityReport } from "../core/state/stateIntegrity";
import type { CharacterExportPackageDigest } from "../core/export/characterExportPackageDigest";

export interface ProcessEventRequest {
  characterId: string;
  event: ExperienceEvent;
}

export interface ProcessEventResponse {
  characterId: string;
  eventId: string;
  memoryId: string;
  category: string;
  impactScore: number;
  clusterId: string;
  clusterMass: number;
  clusterStability: number;
  boundaryImpact: BoundaryImpactResult;
  galaxyTrace: GalaxyStepTrace;
  proceduralActivations: ProceduralActivation[];
  rewardResult: RewardResult;
  timePerception: TimePerceptionTrace;
  worldInterpretation: WorldModelInterpretation;
  /** Per-event attention evaluation — diagnostic only, does NOT modify personality. */
  attentionEvaluation: AttentionEvaluation;
  temporalSemantics: EventTemporalTrace;
  state: SerializedCharacterPhysicsState;
}

export interface SimulateEventsRequest {
  characterId: string;
  events: ExperienceEvent[];
  daysPerStep?: number;
}

export interface SimulateEventsResponse {
  characterId: string;
  snapshots: SimulationSnapshot[];
  state: SerializedCharacterPhysicsState;
}

export interface GetCharacterPhysicsStateResponse {
  characterId: string;
  state: SerializedCharacterPhysicsState;
  integrity: StateIntegrityReport;
}

export interface CharacterPhysicsExportResponse {
  exportedAt: string;
  characterId: string;
  version: string;
  state: SerializedCharacterPhysicsState;
  stateIntegrity?: StateIntegrityReport;
  packageDigest?: CharacterExportPackageDigest;
  adjustmentHistory: {
    history: ParameterAdjustmentHistoryEntry[];
    summary: ParameterAdjustmentHistorySummary;
    governance: ParameterAdjustmentGovernanceTrace;
  };
}

export interface ValidateCharacterImportRequest {
  package: unknown;
}

export interface ValidateCharacterImportResponse {
  characterId: string;
  valid: boolean;
  errors: string[];
  summary: CharacterExportPackageSummary | null;
  plan: CharacterImportPlan;
  mutatesState: false;
}

export interface ApplyCharacterImportRequest {
  package: unknown;
  confirmation?: string;
}

export interface ApplyCharacterImportResponse {
  characterId: string;
  trace: CharacterImportApplyTrace;
  state: SerializedCharacterPhysicsState;
  mutatesState: true;
}

export interface GetCharacterImportTransitionHistoryResponse {
  characterId: string;
  history: CharacterImportTransitionHistoryEntry[];
  summary: CharacterImportTransitionHistorySummary;
}

export type ContinuousTickRequest = ContinuousTickOptions;

export interface ContinuousTickResponse {
  characterId: string;
  trace: ContinuousTickTrace;
  state: SerializedCharacterPhysicsState;
}

export interface ApplyParameterAdjustmentRequest {
  patch: ParameterAdjustmentPatchTrace;
  snapshot: ParameterAdjustmentSnapshotTrace;
  governanceOverride?: Partial<ParameterAdjustmentGovernanceOverride>;
}

export interface ApplyParameterAdjustmentResponse {
  characterId: string;
  trace: ParameterAdjustmentApplyTrace;
  state: SerializedCharacterPhysicsState;
}

export interface RollbackParameterAdjustmentRequest {
  snapshot: ParameterAdjustmentSnapshotTrace;
}

export interface RollbackParameterAdjustmentResponse {
  characterId: string;
  trace: ParameterAdjustmentApplyTrace;
  state: SerializedCharacterPhysicsState;
}

export interface GetParameterAdjustmentHistoryResponse {
  characterId: string;
  history: ParameterAdjustmentHistoryEntry[];
  summary: ParameterAdjustmentHistorySummary;
  governance: ParameterAdjustmentGovernanceTrace;
}

export interface GetTraceReplaySummaryResponse {
  index: TraceReplaySummaryIndex;
}

export interface GetTraceReplayCalibrationResponse {
  calibration: ReplayCalibrationSuite;
}

// ─── V6.7 Benchmark Report ─────────────────────────────────────────────

export interface BenchmarkReportResultEntry {
  caseId: string;
  category: string;
  verdict: "pass" | "fail" | "inconclusive" | "error";
  passedAssertions: number;
  totalAssertions: number;
  durationMs: number;
  warnings: string[];
  explanation: string;
}

export interface BenchmarkReportSummary {
  totalCases: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  erroredCount: number;
  supportedCategories: string[];
  unsupportedCategories: string[];
}

export interface GetBenchmarkReportResponse {
  generatedAt: string;
  summary: BenchmarkReportSummary;
  results: BenchmarkReportResultEntry[];
  warnings: string[];
  reasons: string[];
}

// ─── V10.12 Differentiated Decision ─────────────────────────────────────

import type {
  DifferentiatedDecision,
  ActivatedSchema,
  NeedProfile,
  DesireProfile,
  BehaviorStrategy,
  ActionSurface,
} from "../core/differentiation/characterDifferentiation";

export type {
  DifferentiatedDecision,
  ActivatedSchema,
  NeedProfile,
  DesireProfile,
  BehaviorStrategy,
  ActionSurface,
};

export interface DecisionResponse {
  characterId: string;
  decision: import("../core/decision/behaviorDecision").BehaviorDecision;
  derived: import("../core/state/derivedCharacterState").DerivedCharacterState;
  narrative?: string;
  /** V10.12: Full differentiated decision chain. */
  differentiatedDecision?: DifferentiatedDecision;
  /** V10.12: Activated schemas from differentiation engine. */
  schemas?: ActivatedSchema[];
  /** V10.12: Derived needs from differentiation engine. */
  needs?: NeedProfile[];
  /** V10.12: Derived desires from differentiation engine. */
  desires?: DesireProfile[];
  /** V10.12: Selected behavior strategy. */
  selectedStrategy?: BehaviorStrategy;
  /** V10.12: Concrete action surface. */
  actionSurface?: ActionSurface;
  warnings?: string[];
}

// ─── V10.18 Longitudinal Simulation ─────────────────────────────────────

import type {
  LongitudinalSimulationResult,
  LongitudinalSimulationRequest as CoreLongitudinalSimulationRequest,
} from "../core/life/longitudinalSimulation";
import type {
  LongitudinalCommitPreview,
  LongitudinalRequestDigest,
  LongitudinalStateFingerprint,
} from "../core/life/finalStateForCommit";
import type { LongitudinalCommitApplyStatus } from "../core/life/longitudinalCommitApply";
import type { LongitudinalCommitRollbackStatus } from "../core/life/longitudinalCommitRollback";
import type { LongitudinalCommitAuditStatus } from "../core/life/longitudinalCommitAudit";

export interface RunLongitudinalSimulationRequest {
  totalHours: number;
  stepHours: number;
  seed?: string;
  observed?: boolean;
  includeDecision?: boolean;
  includeExplanation?: boolean;
  commitPolicy?: CoreLongitudinalSimulationRequest["commitPolicy"];
  lifeOptions?: CoreLongitudinalSimulationRequest["lifeOptions"];
}

export interface RunLongitudinalSimulationResponse {
  characterId: string;
  result: LongitudinalSimulationResult;
  warnings: string[];
  reasons: string[];
}

// V10.22 Longitudinal Commit Preview

export interface PreviewLongitudinalCommitRequest extends RunLongitudinalSimulationRequest {}

export interface PreviewLongitudinalCommitResponse {
  characterId: string;
  preview: LongitudinalCommitPreview;
  warnings: string[];
  reasons: string[];
}

// V10.26 Longitudinal Commit Apply API

export interface ApplyLongitudinalCommitRequest extends RunLongitudinalSimulationRequest {
  confirmation?: string;
  allowWarnings?: boolean;
  simulationId?: string;
  requestDigest?: LongitudinalRequestDigest;
  baseStateFingerprint?: LongitudinalStateFingerprint;
}

export interface ApplyLongitudinalCommitAuditDto {
  id: string;
  status: LongitudinalCommitAuditStatus;
  simulationId: string;
  changedPathCount: number;
  generatedMemoryCount: number;
  governanceStatus: string;
  updatedAt: string;
  appliedAt?: string;
}

export interface ApplyLongitudinalCommitRollbackDto {
  id: string;
  type: "remove_generated_memories";
  generatedMemoryCount: number;
  staleWritePolicy: "block_if_changed";
}

export interface ApplyLongitudinalCommitResponse {
  characterId: string;
  status: LongitudinalCommitApplyStatus;
  applied: boolean;
  simulationId: string;
  audit?: ApplyLongitudinalCommitAuditDto;
  rollback?: ApplyLongitudinalCommitRollbackDto;
  readiness?: {
    status: string;
    blockers: string[];
    warnings: string[];
    reasons: string[];
  };
  warnings: string[];
  reasons: string[];
}

// V10.27 Longitudinal Commit Rollback API

export interface RollbackLongitudinalCommitRequest {
  simulationId?: string;
  auditId?: string;
  confirmation?: string;
}

export interface RollbackLongitudinalCommitResponse {
  characterId: string;
  status: LongitudinalCommitRollbackStatus;
  rolledBack: boolean;
  simulationId?: string;
  audit?: ApplyLongitudinalCommitAuditDto;
  rollback?: ApplyLongitudinalCommitRollbackDto;
  readiness?: {
    status: string;
    blockers: string[];
    warnings: string[];
    reasons: string[];
  };
  removedMemoryCount: number;
  missingMemoryCount: number;
  warnings: string[];
  reasons: string[];
}

// ─── V7.7 Graph Snapshot ───────────────────────────────────────────────

import type { MindGraphSnapshot } from "@/core/graph/mindGraphTypes";

export interface GetGraphSnapshotResponse {
  snapshot: MindGraphSnapshot;
}
