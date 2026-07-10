/**
 * V11.3 — Event Studio Apply Boundary
 * V12.12 — Deterministic auditId (no Date.now() / Math.random() fallback)
 *
 * Confirmation-gated write boundary for applying events to character state.
 * Default: clone-and-return. Mutation only with explicit allowMutation=true.
 * Every apply produces an audit entry and rollback reference.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { CharacterPhysicsEngine } from "../physics/physicsEngine";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../physics/serialization";
import { parseExperienceEvent } from "../event/eventParser";
import type {
  EventStudioDraft,
  EventStudioPreview,
  EventStudioApplyInput,
  EventStudioApplyResult,
  EventStudioApplyOptions,
  EventStudioAuditEntry,
} from "./explorerTypes";
import { buildCharacterStateSurfaceFromState } from "./explorerDtoBuilders";
import { deterministicAuditId } from "../deterministicHelpers";

const DEFAULT_CONFIRMATION = "apply";

export function applyEventStudioEvent(
  input: EventStudioApplyInput,
): EventStudioApplyResult {
  const opts = normalizeOptions(input.options);
  const warnings: string[] = [];

  // ── Confirmation Gate ──
  if (!input.confirmation || input.confirmation !== opts.confirmationPhrase) {
    return blocked("confirmation 不匹配或不完整", input, null, warnings);
  }

  // ── Preview Mode Gate ──
  if (!input.preview.requiresConfirmation) {
    return blocked("预览模式不是 full_preview，不能 apply", input, null, warnings);
  }

  // ── Reality Audit Gate ──
  if (input.preview.realityAuditPreview.expectedVerdict === "FAIL" && !opts.overrideAuditFail) {
    return blocked("Reality Audit 判定 FAIL — 需要 overrideAuditFail 才能继续", input, null, warnings);
  }
  if (input.preview.realityAuditPreview.expectedVerdict === "WARN") {
    warnings.push("Reality Audit 有 WARN — 事件已应用，但建议关注");
  }

  // ── Stale Preview Gate ──
  const beforeFingerprint = computeFingerprint(input.baselineState);
  if (input.preview.requiresConfirmation) {
    // For full preview, verify the draft hasn't changed
    if (input.draft.status !== "previewed") {
      warnings.push("草稿状态不是 previewed，可能已被修改");
    }
  }

  // ── Clone or mutate ──
  const targetState = opts.allowMutation
    ? input.baselineState
    : deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(input.baselineState)));

  // ── Apply event(s) via V10 engine ──
  const parsed = parseExperienceEvent({
    description: input.draft.naturalLanguageInput,
    tags: input.draft.tags.length > 0 ? input.draft.tags : undefined,
    categoryHint: "auto",
  } as Parameters<typeof parseExperienceEvent>[0]);

  const engine = new CharacterPhysicsEngine();
  let lastMemoryId: string | null = null;

  for (let i = 0; i < input.draft.repetitionCount; i++) {
    const step = engine.processEvent(targetState, parsed);
    lastMemoryId = step.memoryNode.id;
  }

  const afterFingerprint = computeFingerprint(targetState);
  const surface = buildCharacterStateSurfaceFromState(targetState);
  const baselineSurface = buildCharacterStateSurfaceFromState(input.baselineState);

  // ── Build audit entry ──
  const auditId = opts.auditSeed
    ? `audit_${opts.auditSeed}`
    : deterministicAuditId(computeAuditFingerprint(
      input.actorId,
      input.draft.sourceId || input.preview.draftId,
      input.confirmation,
      beforeFingerprint,
      input.preview.parsedEvent,
    ));

  const auditEntry: EventStudioAuditEntry = {
    auditId,
    eventDraftId: input.draft.sourceId || input.preview.draftId,
    sourceId: input.draft.sourceId || input.preview.draftId,
    actorId: input.actorId,
    applyReason: input.applyReason,
    appliedAt: new Date().toISOString(),
    beforeFingerprint,
    afterFingerprint,
    parsedEventSummary: input.preview.parsedEvent,
    stateDeltaSummary: `trust: ${input.baselineState.coordinate.values.trust.toFixed(3)}→${targetState.coordinate.values.trust.toFixed(3)}, `
      + `fear: ${input.baselineState.coordinate.values.fear.toFixed(3)}→${targetState.coordinate.values.fear.toFixed(3)}, `
      + `boundary: ${input.baselineState.boundary.phase}→${targetState.boundary.phase}`,
    realityAuditVerdict: input.preview.realityAuditPreview.expectedVerdict,
    confirmationProvided: true,
    rollbackReference: `rollback:${auditId}:before:${beforeFingerprint}`,
    warnings: [...warnings],
  };

  const rollbackReference = `rollback:${auditId}:before:${beforeFingerprint}`;

  return {
    applied: true,
    blockedReason: null,
    beforeFingerprint,
    afterFingerprint,
    parsedEvent: input.preview.parsedEvent,
    appliedMemoryId: lastMemoryId,
    stateDeltaSummary: auditEntry.stateDeltaSummary,
    realityAuditVerdict: input.preview.realityAuditPreview.expectedVerdict,
    warnings,
    auditEntry,
    rollbackReference,
    nextRequiredAction: "apply 已完成。如需回滚，请使用 rollback 功能（V11.4）。",
  };
}

// ── Helpers ──

function blocked(
  reason: string,
  input: EventStudioApplyInput,
  _targetState: CharacterPhysicsState | null,
  warnings: string[],
): EventStudioApplyResult {
  return {
    applied: false,
    blockedReason: reason,
    beforeFingerprint: computeFingerprint(input.baselineState),
    afterFingerprint: null,
    parsedEvent: input.preview.parsedEvent,
    appliedMemoryId: null,
    stateDeltaSummary: "",
    realityAuditVerdict: input.preview.realityAuditPreview.expectedVerdict,
    warnings,
    auditEntry: null,
    rollbackReference: null,
    nextRequiredAction: reason,
  };
}

function computeFingerprint(state: CharacterPhysicsState): string {
  // Deterministic fingerprint from key state metrics
  const c = state.coordinate.values;
  const b = state.boundary;
  const parts = [
    state.identity.id,
    state.memories.length,
    state.beliefStates.length,
    c.trust.toFixed(4),
    c.fear.toFixed(4),
    c.openness.toFixed(4),
    c.neuroticism.toFixed(4),
    c.attachment.toFixed(4),
    b.stressLoad.toFixed(4),
    b.integrity.toFixed(4),
    b.phase,
  ];
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

/**
 * V12.12 — Deterministic audit fingerprint.
 * Uses actorId + draft sourceId + confirmation + before state fingerprint
 * + parsed event summary to produce a stable audit ID.
 * Same inputs → same audit ID; no Date.now() / Math.random().
 */
function computeAuditFingerprint(
  actorId: string | undefined,
  draftSourceId: string | undefined,
  confirmation: string,
  beforeFingerprint: string,
  parsedEvent: unknown,
): string {
  const eventSummary = typeof parsedEvent === "string"
    ? parsedEvent
    : (parsedEvent && typeof parsedEvent === "object" && "summary" in (parsedEvent as Record<string, unknown>))
      ? String((parsedEvent as Record<string, unknown>).summary)
      : JSON.stringify(parsedEvent ?? "no_event");
  const seed = [
    actorId ?? "unknown",
    draftSourceId ?? "unknown",
    confirmation,
    beforeFingerprint,
    eventSummary,
  ].join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 12);
}

function normalizeOptions(opts?: EventStudioApplyOptions): Required<EventStudioApplyOptions> {
  return {
    confirmationPhrase: opts?.confirmationPhrase ?? DEFAULT_CONFIRMATION,
    allowMutation: opts?.allowMutation ?? false,
    overrideAuditFail: opts?.overrideAuditFail ?? false,
    auditSeed: opts?.auditSeed ?? "",
  };
}
