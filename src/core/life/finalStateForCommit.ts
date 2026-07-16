// =========================================================================
// V10.21 finalStateForCommit Types & Helpers
//
// This module defines the private handoff and public preview surface for
// future longitudinal simulation commits. It does NOT persist state. It does
// NOT add API apply behavior. It keeps final state private until a later
// apply phase can enforce auth, audit, stale-write checks, and rollback.
// =========================================================================

import { createHash } from "node:crypto";
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { inspectCharacterStateIntegrity, type StateIntegrityReport } from "../state/stateIntegrity";
import type {
  CompactStateSummary,
  LongitudinalCommitPolicy,
  LongitudinalSimulationRequest,
  LongitudinalSimulationResult,
} from "./longitudinalSimulation";

// ── Fingerprints & Digests ────────────────────────────────────────────────

export interface LongitudinalDigest {
  algorithm: "sha256";
  canonicalization: "characteros-longitudinal-json-v1";
  value: string;
}

export type LongitudinalStateFingerprint = LongitudinalDigest;
export type LongitudinalRequestDigest = LongitudinalDigest;

// ── Commit Surface ────────────────────────────────────────────────────────

export type LongitudinalCommitSource =
  | "dream"
  | "random_thought"
  | "inspiration_seed"
  | "self_action_candidate"
  | "energy_fatigue"
  | "sleep_wake"
  | "boredom_expansion"
  | "unknown";

export interface LongitudinalCommitSurfaceChange {
  stepIndex: number;
  source: LongitudinalCommitSource;
  path: string;
  generatedId?: string;
  from: unknown;
  to: unknown;
  reason: string;
}

export interface LongitudinalCommitSurface {
  applied: boolean;
  totalSteps: number;
  committedSteps: number;
  generatedMemoryCount: number;
  changes: LongitudinalCommitSurfaceChange[];
  skipped: LongitudinalCommitSurfaceChange[];
  beforeSummary: CompactStateSummary;
  afterSummary: CompactStateSummary;
}

// ── Governance ────────────────────────────────────────────────────────────

export type LongitudinalCommitGovernanceStatus = "pass" | "warning" | "block";

export interface LongitudinalCommitGovernanceDecision {
  status: LongitudinalCommitGovernanceStatus;
  blockers: string[];
  warnings: string[];
  reasons: string[];
  integrity: StateIntegrityReport;
}

// ── Audit & Rollback ──────────────────────────────────────────────────────

export interface LongitudinalCommitAuditDraft {
  id: string;
  characterId: string;
  simulationId: string;
  timestamp: string;
  requestDigest: LongitudinalRequestDigest;
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
  commitPolicy: LongitudinalCommitPolicy;
  changedPaths: string[];
  generatedMemoryIds: string[];
  beforeSummary: CompactStateSummary;
  afterSummary: CompactStateSummary;
  governance: LongitudinalCommitGovernanceDecision;
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalCommitAuditSummary {
  id: string;
  characterId: string;
  simulationId: string;
  timestamp: string;
  changedPathCount: number;
  generatedMemoryCount: number;
  governanceStatus: LongitudinalCommitGovernanceStatus;
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalRollbackPlan {
  id: string;
  simulationId: string;
  type: "remove_generated_memories";
  generatedMemoryIds: string[];
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
  staleWritePolicy: "block_if_changed";
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalRollbackSummary {
  id: string;
  simulationId: string;
  type: "remove_generated_memories";
  generatedMemoryCount: number;
  staleWritePolicy: "block_if_changed";
  warnings: string[];
  reasons: string[];
}

// ── Private Handoff & Public Preview ──────────────────────────────────────

export interface LongitudinalFinalStateForCommit {
  version: "v10.21";
  characterId: string;
  simulationId: string;
  requestDigest: LongitudinalRequestDigest;
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
  /** INTERNAL ONLY. Never expose through public DTOs. */
  finalState: CharacterPhysicsState;
  commitSurface: LongitudinalCommitSurface;
  auditDraft: LongitudinalCommitAuditDraft;
  rollbackPlan: LongitudinalRollbackPlan;
  governance: LongitudinalCommitGovernanceDecision;
  warnings: string[];
  reasons: string[];
}

export interface LongitudinalCommitPreview {
  version: "v10.21";
  characterId: string;
  simulationId: string;
  requestDigest: LongitudinalRequestDigest;
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
  commitSurface: LongitudinalCommitSurface;
  auditSummary: LongitudinalCommitAuditSummary;
  rollbackSummary: LongitudinalRollbackSummary;
  governance: LongitudinalCommitGovernanceDecision;
  warnings: string[];
  reasons: string[];
}

// ── Builders ──────────────────────────────────────────────────────────────

export function computeLongitudinalRequestDigest(request: LongitudinalSimulationRequest): LongitudinalRequestDigest {
  return digest({
    characterId: request.characterId,
    totalHours: request.totalHours,
    stepHours: request.stepHours,
    seed: request.seed,
    observed: request.observed ?? true,
    includeDecision: request.includeDecision ?? false,
    includeExplanation: request.includeExplanation ?? false,
    commitPolicy: request.commitPolicy ?? { enabled: false },
    lifeOptions: request.lifeOptions ?? {},
  });
}

export function computeLongitudinalStateFingerprint(state: CharacterPhysicsState): LongitudinalStateFingerprint {
  return digest(projectStateForFingerprint(state));
}

export function createLongitudinalSimulationId(params: {
  characterId: string;
  requestDigest: LongitudinalRequestDigest;
  baseStateFingerprint: LongitudinalStateFingerprint;
}): string {
  return `longsim_${shortHash({
    characterId: params.characterId,
    requestDigest: params.requestDigest.value,
    baseStateFingerprint: params.baseStateFingerprint.value,
  })}`;
}

export function buildLongitudinalCommitSurface(result: LongitudinalSimulationResult): LongitudinalCommitSurface {
  const changes: LongitudinalCommitSurfaceChange[] = [];
  const skipped: LongitudinalCommitSurfaceChange[] = [];
  for (const step of result.steps) {
    const commit = step.commitResult;
    if (!commit) continue;
    changes.push(...commit.changes.map((change) => surfaceChange(step.index, change, commit.state)));
    skipped.push(...commit.skipped.map((change) => surfaceChange(step.index, change, commit.state)));
  }

  const first = result.steps[0];
  const last = result.steps[result.steps.length - 1];
  return {
    applied: result.applied,
    totalSteps: result.aggregate.totalSteps,
    committedSteps: result.aggregate.committedSteps,
    generatedMemoryCount: result.aggregate.generatedMemoryCount,
    changes,
    skipped,
    beforeSummary: first?.stateSummaryBefore ?? result.finalStateSummary,
    afterSummary: last?.stateSummaryAfter ?? result.finalStateSummary,
  };
}

export function evaluateLongitudinalCommitGovernance(params: {
  finalState: CharacterPhysicsState;
  commitSurface: LongitudinalCommitSurface;
  commitPolicy: LongitudinalCommitPolicy;
}): LongitudinalCommitGovernanceDecision {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];
  const integrity = inspectCharacterStateIntegrity(params.finalState);

  if (!params.commitPolicy.enabled) {
    blockers.push("commitPolicy.enabled must be true before final state can be applied.");
  } else {
    reasons.push("commitPolicy.enabled=true confirms explicit commit intent.");
  }

  if (params.commitSurface.changes.some((change) => change.source === "self_action_candidate")) {
    blockers.push("self-action candidate changes cannot enter finalStateForCommit.");
  } else {
    reasons.push("No self-action candidate changes are present in commit surface.");
  }

  if (!integrity.valid) {
    blockers.push("final state failed structural integrity inspection.");
  } else {
    reasons.push("final state passed structural integrity inspection.");
  }

  const generatedChangeCount = params.commitSurface.changes.filter((change) => Boolean(change.generatedId)).length;
  if (params.commitSurface.generatedMemoryCount !== generatedChangeCount) {
    warnings.push("generatedMemoryCount differs from surfaced generated memory change count.");
  }

  const status: LongitudinalCommitGovernanceStatus =
    blockers.length > 0 ? "block" : warnings.length > 0 ? "warning" : "pass";
  return { status, blockers, warnings, reasons, integrity };
}

export function buildLongitudinalRollbackPlan(params: {
  simulationId: string;
  commitSurface: LongitudinalCommitSurface;
  baseStateFingerprint: LongitudinalStateFingerprint;
  finalStateFingerprint: LongitudinalStateFingerprint;
}): LongitudinalRollbackPlan {
  const generatedMemoryIds = params.commitSurface.changes
    .map((change) => change.generatedId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return {
    id: `rollback_${shortHash({ simulationId: params.simulationId, generatedMemoryIds })}`,
    simulationId: params.simulationId,
    type: "remove_generated_memories",
    generatedMemoryIds,
    baseStateFingerprint: params.baseStateFingerprint,
    finalStateFingerprint: params.finalStateFingerprint,
    staleWritePolicy: "block_if_changed",
    warnings: generatedMemoryIds.length === 0 ? ["No generated memory ids are available for rollback."] : [],
    reasons: [
      "Rollback removes generated memory ids only.",
      "Rollback must block if the current state fingerprint differs from finalStateFingerprint.",
    ],
  };
}

export function buildLongitudinalFinalStateForCommit(params: {
  characterId: string;
  request: LongitudinalSimulationRequest;
  baseState: CharacterPhysicsState;
  finalState: CharacterPhysicsState;
  result: LongitudinalSimulationResult;
  timestamp: string;
  simulationId?: string;
}): LongitudinalFinalStateForCommit {
  const requestDigest = computeLongitudinalRequestDigest(params.request);
  const baseStateFingerprint = computeLongitudinalStateFingerprint(params.baseState);
  const finalStateFingerprint = computeLongitudinalStateFingerprint(params.finalState);
  const simulationId = params.simulationId ?? createLongitudinalSimulationId({
    characterId: params.characterId,
    requestDigest,
    baseStateFingerprint,
  });
  const commitSurface = buildLongitudinalCommitSurface(params.result);
  const commitPolicy = params.request.commitPolicy ?? { enabled: false };
  const governance = evaluateLongitudinalCommitGovernance({
    finalState: params.finalState,
    commitSurface,
    commitPolicy,
  });
  const rollbackPlan = buildLongitudinalRollbackPlan({
    simulationId,
    commitSurface,
    baseStateFingerprint,
    finalStateFingerprint,
  });
  const generatedMemoryIds = rollbackPlan.generatedMemoryIds;
  const auditDraft: LongitudinalCommitAuditDraft = {
    id: `longcommit_audit_${shortHash({ simulationId, timestamp: params.timestamp, requestDigest: requestDigest.value })}`,
    characterId: params.characterId,
    simulationId,
    timestamp: params.timestamp,
    requestDigest,
    baseStateFingerprint,
    finalStateFingerprint,
    commitPolicy,
    changedPaths: commitSurface.changes.map((change) => change.path),
    generatedMemoryIds,
    beforeSummary: commitSurface.beforeSummary,
    afterSummary: commitSurface.afterSummary,
    governance,
    warnings: [...params.result.warnings, ...governance.warnings, ...rollbackPlan.warnings],
    reasons: [
      "Audit draft prepared before any persistent write.",
      ...params.result.reasons,
      ...governance.reasons,
    ],
  };

  return {
    version: "v10.21",
    characterId: params.characterId,
    simulationId,
    requestDigest,
    baseStateFingerprint,
    finalStateFingerprint,
    finalState: params.finalState,
    commitSurface,
    auditDraft,
    rollbackPlan,
    governance,
    warnings: auditDraft.warnings,
    reasons: auditDraft.reasons,
  };
}

export function stripFinalStateForPublicPreview(handoff: LongitudinalFinalStateForCommit): LongitudinalCommitPreview {
  return {
    version: "v10.21",
    characterId: handoff.characterId,
    simulationId: handoff.simulationId,
    requestDigest: handoff.requestDigest,
    baseStateFingerprint: handoff.baseStateFingerprint,
    finalStateFingerprint: handoff.finalStateFingerprint,
    commitSurface: handoff.commitSurface,
    auditSummary: summarizeAuditDraft(handoff.auditDraft),
    rollbackSummary: summarizeRollbackPlan(handoff.rollbackPlan),
    governance: handoff.governance,
    warnings: [...handoff.warnings],
    reasons: [
      ...handoff.reasons,
      "Public preview strips finalState; persistence remains deferred until apply phase.",
    ],
  };
}

// ── Summaries ─────────────────────────────────────────────────────────────

function summarizeAuditDraft(draft: LongitudinalCommitAuditDraft): LongitudinalCommitAuditSummary {
  return {
    id: draft.id,
    characterId: draft.characterId,
    simulationId: draft.simulationId,
    timestamp: draft.timestamp,
    changedPathCount: draft.changedPaths.length,
    generatedMemoryCount: draft.generatedMemoryIds.length,
    governanceStatus: draft.governance.status,
    warnings: [...draft.warnings],
    reasons: [...draft.reasons],
  };
}

function summarizeRollbackPlan(plan: LongitudinalRollbackPlan): LongitudinalRollbackSummary {
  return {
    id: plan.id,
    simulationId: plan.simulationId,
    type: plan.type,
    generatedMemoryCount: plan.generatedMemoryIds.length,
    staleWritePolicy: plan.staleWritePolicy,
    warnings: [...plan.warnings],
    reasons: [...plan.reasons],
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────

function surfaceChange(stepIndex: number, change: {
  path: string;
  from: unknown;
  to: unknown;
  reason: string;
}, state?: CharacterPhysicsState): LongitudinalCommitSurfaceChange {
  const generatedId = inferGeneratedMemoryId(change.path, change.to, state);
  const surface: LongitudinalCommitSurfaceChange = {
    stepIndex,
    source: inferCommitSource(change.path, change.reason),
    path: change.path,
    from: change.from,
    to: summarizeValue(change.to),
    reason: change.reason,
  };
  if (generatedId) surface.generatedId = generatedId;
  return surface;
}

function inferCommitSource(path: string, reason: string): LongitudinalCommitSource {
  const text = `${path} ${reason}`;
  if (text.includes("dreamFragment") || text.includes("Dream fragment")) return "dream";
  if (text.includes("randomThought") || text.includes("Random thought")) return "random_thought";
  if (text.includes("inspirationSeed") || text.includes("Inspiration seed")) return "inspiration_seed";
  if (text.includes("selfActionCandidate") || text.includes("self-action")) return "self_action_candidate";
  if (text.includes("energyFatigue")) return "energy_fatigue";
  if (text.includes("sleepWake")) return "sleep_wake";
  if (text.includes("boredomExpansion")) return "boredom_expansion";
  return "unknown";
}

function inferGeneratedMemoryId(path: string, value: unknown, state?: CharacterPhysicsState): string | undefined {
  if (!path.startsWith("memories[")) return undefined;
  const index = Number(path.match(/^memories\[(\d+)\]/)?.[1]);
  if (Number.isInteger(index) && state?.memories[index]?.id) {
    return state.memories[index]!.id;
  }
  if (isRecord(value) && typeof value.id === "string") return value.id;
  const text = String(value ?? "");
  const prefix = text.startsWith("Dream residue") ? "life-dream" :
    text.startsWith("Thought:") ? "life-rt" :
    text.startsWith("Inspiration seed") ? "life-insp" :
    text.startsWith("Action tendency") ? "life-sac" : "life-generated";
  return `${prefix}-${shortHash({ path, text })}`;
}

function summarizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}...` : value;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (isRecord(value) && typeof value.id === "string") return { id: value.id };
  return "[object]";
}

function projectStateForFingerprint(state: CharacterPhysicsState): unknown {
  const projection = {
    identity: state.identity,
    biologicalNature: state.biologicalNature,
    memories: state.memories.map((memory) => ({
      id: memory.id,
      content: memory.content,
      importance: memory.importance,
      emotion: memory.emotion,
      recency: memory.recency,
      repetitionCount: memory.repetitionCount,
      beliefEffect: memory.beliefEffect,
      timeStamp: memory.timeStamp,
      clusterId: memory.clusterId,
    })),
    beliefStates: state.beliefStates.map((belief) => ({
      id: belief.id,
      content: belief.content,
      strength: belief.strength,
      evidenceCount: belief.evidenceCount,
      sourceMemoryIds: belief.sourceMemoryIds,
    })),
    coordinate: state.coordinate.values,
    velocity: state.velocity.values,
    personality: state.personality,
    boundary: state.boundary,
    metaState: state.metaState,
    rewardState: state.rewardState,
    homeostasisState: state.homeostasisState,
    boredomState: state.boredomState,
    proceduralRoutines: state.proceduralRoutines.map((routine) => ({
      id: routine.id,
      cueTags: routine.cueTags,
      strength: routine.strength,
      repetitionCount: routine.repetitionCount,
    })),
    particles: state.particles.map((particle) => ({
      id: particle.id,
      description: particle.description,
      category: particle.category,
      emotion: particle.emotion,
      impactScore: particle.impactScore,
      vector: particle.vector,
    })),
    clusters: [...state.clusters.entries()].map(([key, cluster]) => ({
      key,
      id: cluster.id,
      category: cluster.category,
      mass: cluster.mass,
      density: cluster.density,
      stability: cluster.stability,
      age: cluster.age,
      particleIds: cluster.particleIds,
    })),
    temporal: state.temporal,
    parameterSetVersion: state.parameterSetVersion,
    learningRate: state.learningRate,
  } satisfies Record<keyof CharacterPhysicsState, unknown>;
  return projection;
}

function digest(value: unknown): LongitudinalDigest {
  return {
    algorithm: "sha256",
    canonicalization: "characteros-longitudinal-json-v1",
    value: createHash("sha256").update(stableStringify(value)).digest("hex"),
  };
}

function shortHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
