import type { ExperienceEvent } from "../event/event";
import { deterministicId } from "../deterministicHelpers";
import { clamp01, round4 } from "../parameters/parameterMath";

export const UNKNOWN_EVENT_OCCURRED_AT = "1970-01-01T00:00:00.000Z";
export const EVENT_DENSITY_WINDOW_HOURS = 24;
export const EVENT_HISTORY_RETENTION_DAYS = 90;
export const MAX_EVENT_RECOVERY_DAYS = 3650;
export const PERSONALITY_VELOCITY_HALF_LIFE_DAYS = 14;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_RECENT_TEMPORAL_EVENTS = 256;

export type EventTemporalMode =
  | "legacy_untimed"
  | "inherited_clock"
  | "invalid_timestamp"
  | "first_timed_event"
  | "forward_time"
  | "same_time"
  | "out_of_order";

export type EventTemporalWarning =
  | "timestamp_inherited_from_state"
  | "invalid_occurred_at"
  | "out_of_order_event"
  | "recovery_interval_clamped";

export interface TemporalEventRecord {
  readonly sequence: number;
  readonly eventId: string;
  readonly signature: string;
  readonly category: string;
  readonly occurredAt: string;
  readonly rawImpact: number;
  readonly effectiveImpact: number;
  readonly densityScale: number;
}

export interface CharacterTemporalState {
  readonly lastProcessedAt: string | null;
  readonly totalElapsedDays: number;
  readonly processedEventCount: number;
  readonly timedEventCount: number;
  readonly recentEvents: TemporalEventRecord[];
}

export interface EventTemporalPlan {
  readonly mode: EventTemporalMode;
  readonly providedOccurredAt: string | null;
  readonly resolvedOccurredAt: string | null;
  readonly previousProcessedAt: string | null;
  readonly elapsedDaysRaw: number;
  readonly elapsedDaysApplied: number;
  readonly densityWindowHours: number;
  readonly sameEventCountInWindow: number;
  readonly sameCategoryCountInWindow: number;
  readonly densityScale: number;
  readonly instantImpactValue: number;
  readonly accumulatedImpactInWindowBefore: number;
  readonly accumulatedImpactInWindowAfter: number;
  readonly recoverySinceLastEventDays: number;
  readonly rawImpactValue: number;
  readonly effectiveImpactValue: number;
  readonly eventSignature: string;
  readonly warnings: EventTemporalWarning[];
}

export interface EventTemporalRecoverySummary {
  readonly applied: boolean;
  readonly daysApplied: number;
  readonly boundaryStressBefore: number;
  readonly boundaryStressAfter: number;
  readonly averageMemoryRecencyBefore: number;
  readonly averageMemoryRecencyAfter: number;
  readonly clusterMassBefore: number;
  readonly clusterMassAfter: number;
  readonly velocityMagnitudeBefore: number;
  readonly velocityMagnitudeAfter: number;
  readonly velocityRetention: number;
}

export interface EventTemporalTrace extends EventTemporalPlan {
  readonly recovery: EventTemporalRecoverySummary;
  readonly clockAfter: string | null;
  readonly processedEventCountAfter: number;
}

export function createCharacterTemporalState(
  params: Partial<CharacterTemporalState> = {},
): CharacterTemporalState {
  const lastProcessedAt = normalizeStoredTimestamp(params.lastProcessedAt);
  const recentEvents = (params.recentEvents ?? [])
    .flatMap((record) => normalizeRecord(record))
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-MAX_RECENT_TEMPORAL_EVENTS);
  const maxRecentSequence = recentEvents.reduce((max, record) => Math.max(max, record.sequence), 0);
  const timedEventCount = Math.max(
    recentEvents.length,
    Math.floor(Math.max(0, finiteOr(params.timedEventCount, 0))),
  );
  return {
    lastProcessedAt,
    totalElapsedDays: round8(Math.max(0, finiteOr(params.totalElapsedDays, 0))),
    processedEventCount: Math.max(
      recentEvents.length,
      maxRecentSequence,
      timedEventCount,
      Math.floor(Math.max(0, finiteOr(params.processedEventCount, 0))),
    ),
    timedEventCount,
    recentEvents,
  };
}

export function planEventTemporalSemantics(params: {
  temporal: CharacterTemporalState;
  event: ExperienceEvent;
  category: string;
  rawImpactValue: number;
  densityWindowHours?: number;
}): EventTemporalPlan {
  const temporal = createCharacterTemporalState(params.temporal);
  const warnings: EventTemporalWarning[] = [];
  const provided = normalizeProvidedTimestamp(params.event.occurredAt);
  let resolvedOccurredAt: string | null = null;
  let mode: EventTemporalMode;

  if (provided.kind === "valid") {
    resolvedOccurredAt = provided.value;
    mode = temporal.lastProcessedAt ? "forward_time" : "first_timed_event";
  } else if (provided.kind === "invalid") {
    warnings.push("invalid_occurred_at");
    resolvedOccurredAt = temporal.lastProcessedAt;
    mode = "invalid_timestamp";
  } else if (temporal.lastProcessedAt) {
    warnings.push("timestamp_inherited_from_state");
    resolvedOccurredAt = temporal.lastProcessedAt;
    mode = "inherited_clock";
  } else {
    mode = "legacy_untimed";
  }

  let elapsedDaysRaw = 0;
  let elapsedDaysApplied = 0;
  if (resolvedOccurredAt && temporal.lastProcessedAt) {
    elapsedDaysRaw = round8(
      (Date.parse(resolvedOccurredAt) - Date.parse(temporal.lastProcessedAt)) / DAY_MS,
    );
    if (elapsedDaysRaw < 0) {
      mode = "out_of_order";
      warnings.push("out_of_order_event");
    } else if (elapsedDaysRaw === 0 && mode !== "invalid_timestamp" && mode !== "inherited_clock") {
      mode = "same_time";
    }
    elapsedDaysApplied = Math.max(0, Math.min(MAX_EVENT_RECOVERY_DAYS, elapsedDaysRaw));
    if (elapsedDaysRaw > MAX_EVENT_RECOVERY_DAYS) warnings.push("recovery_interval_clamped");
  }

  const densityWindowHours = Math.max(1, finiteOr(params.densityWindowHours, EVENT_DENSITY_WINDOW_HOURS));
  const eventSignature = buildEventTemporalSignature(params.event, params.category);
  const nearby = resolvedOccurredAt
    ? temporal.recentEvents.filter((record) => {
        const distance = Date.parse(resolvedOccurredAt) - Date.parse(record.occurredAt);
        return distance >= 0 && distance <= densityWindowHours * HOUR_MS;
      })
    : [];
  const sameEventCountInWindow = nearby.filter((record) => record.signature === eventSignature).length;
  const sameCategoryCountInWindow = nearby.filter((record) => record.category === params.category).length;
  const otherCategoryPressure = Math.max(0, sameCategoryCountInWindow - sameEventCountInWindow);
  const densityPressure = sameEventCountInWindow * 0.9 + otherCategoryPressure * 0.15;
  const densityScale = round4(Math.max(0.35, 1 / Math.sqrt(1 + densityPressure)));
  const rawImpactValue = round4(clamp01(params.rawImpactValue));
  const effectiveImpactValue = round4(rawImpactValue * densityScale);
  const accumulatedImpactInWindowBefore = round4(
    nearby.reduce((sum, record) => sum + record.effectiveImpact, 0),
  );
  const accumulatedImpactInWindowAfter = round4(
    accumulatedImpactInWindowBefore + effectiveImpactValue,
  );

  return {
    mode,
    providedOccurredAt: provided.kind === "missing" ? null : provided.original,
    resolvedOccurredAt,
    previousProcessedAt: temporal.lastProcessedAt,
    elapsedDaysRaw,
    elapsedDaysApplied: round8(elapsedDaysApplied),
    densityWindowHours: round4(densityWindowHours),
    sameEventCountInWindow,
    sameCategoryCountInWindow,
    densityScale,
    instantImpactValue: rawImpactValue,
    accumulatedImpactInWindowBefore,
    accumulatedImpactInWindowAfter,
    recoverySinceLastEventDays: round8(elapsedDaysApplied),
    rawImpactValue,
    effectiveImpactValue,
    eventSignature,
    warnings: [...new Set(warnings)],
  };
}

export function commitEventTemporalState(params: {
  temporal: CharacterTemporalState;
  event: ExperienceEvent;
  category: string;
  plan: EventTemporalPlan;
}): CharacterTemporalState {
  const temporal = createCharacterTemporalState(params.temporal);
  const sequence = temporal.processedEventCount + 1;
  let lastProcessedAt = temporal.lastProcessedAt;
  if (
    params.plan.resolvedOccurredAt &&
    (!lastProcessedAt || Date.parse(params.plan.resolvedOccurredAt) >= Date.parse(lastProcessedAt))
  ) {
    lastProcessedAt = params.plan.resolvedOccurredAt;
  }

  let recentEvents = temporal.recentEvents;
  if (params.plan.resolvedOccurredAt) {
    recentEvents = [
      ...recentEvents,
      {
        sequence,
        eventId: params.event.id,
        signature: params.plan.eventSignature,
        category: params.category,
        occurredAt: params.plan.resolvedOccurredAt,
        rawImpact: params.plan.rawImpactValue,
        effectiveImpact: params.plan.effectiveImpactValue,
        densityScale: params.plan.densityScale,
      },
    ];
  }

  return {
    ...temporal,
    lastProcessedAt,
    processedEventCount: sequence,
    timedEventCount: temporal.timedEventCount + (params.plan.resolvedOccurredAt ? 1 : 0),
    recentEvents: pruneRecentEvents(recentEvents, lastProcessedAt),
  };
}

export function advanceTemporalStateByDays(
  temporalInput: CharacterTemporalState,
  daysElapsed: number,
): CharacterTemporalState {
  const temporal = createCharacterTemporalState(temporalInput);
  const appliedDays = Math.max(0, Math.min(MAX_EVENT_RECOVERY_DAYS, finiteOr(daysElapsed, 0)));
  if (appliedDays === 0) return temporal;
  const lastProcessedAt = temporal.lastProcessedAt
    ? new Date(Date.parse(temporal.lastProcessedAt) + appliedDays * DAY_MS).toISOString()
    : null;
  return {
    ...temporal,
    lastProcessedAt,
    totalElapsedDays: round8(temporal.totalElapsedDays + appliedDays),
    recentEvents: pruneRecentEvents(temporal.recentEvents, lastProcessedAt),
  };
}

export function personalityVelocityRetention(daysElapsed: number): number {
  const days = Math.max(0, finiteOr(daysElapsed, 0));
  return round8(Math.exp((-Math.LN2 * days) / PERSONALITY_VELOCITY_HALF_LIFE_DAYS));
}

export function buildEventTemporalSignature(
  event: ExperienceEvent,
  category: string,
): string {
  const normalizedDescription = event.description.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedTags = [...event.tags]
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  return `${category}|${deterministicId("event", normalizedDescription, normalizedTags)}`;
}

function pruneRecentEvents(
  records: TemporalEventRecord[],
  clock: string | null,
): TemporalEventRecord[] {
  const cutoff = clock ? Date.parse(clock) - EVENT_HISTORY_RETENTION_DAYS * DAY_MS : Number.NEGATIVE_INFINITY;
  return records
    .filter((record) => Date.parse(record.occurredAt) >= cutoff)
    .slice(-MAX_RECENT_TEMPORAL_EVENTS);
}

function normalizeRecord(record: TemporalEventRecord): TemporalEventRecord[] {
  const occurredAt = normalizeStoredTimestamp(record.occurredAt);
  if (!occurredAt || !record.eventId || !record.category) return [];
  return [{
    sequence: Math.max(1, Math.floor(finiteOr(record.sequence, 1))),
    eventId: record.eventId,
    signature: record.signature || `${record.category}|${record.eventId}`,
    category: record.category,
    occurredAt,
    rawImpact: round4(clamp01(finiteOr(record.rawImpact, 0))),
    effectiveImpact: round4(clamp01(finiteOr(record.effectiveImpact, 0))),
    densityScale: round4(clamp01(finiteOr(record.densityScale, 1))),
  }];
}

function normalizeProvidedTimestamp(
  value: string | undefined,
):
  | { kind: "missing" }
  | { kind: "invalid"; original: string }
  | { kind: "valid"; original: string; value: string } {
  const original = value?.trim();
  if (!original || original === "unknown" || original === UNKNOWN_EVENT_OCCURRED_AT) {
    return { kind: "missing" };
  }
  const parsed = Date.parse(original);
  return Number.isFinite(parsed)
    ? { kind: "valid", original, value: new Date(parsed).toISOString() }
    : { kind: "invalid", original };
}

function normalizeStoredTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round8(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}
