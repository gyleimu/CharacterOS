/**
 * V4.3 UnifiedTickTrace — observation layer for V3 ContinuousTickTrace.
 *
 * Builds a V4-structured trace from an existing V3 ContinuousTickTrace.
 * Does NOT replace runContinuousTick. Does NOT execute adapters.
 * Does NOT mutate any state.
 *
 * This is a READ-ONLY transformation — it maps V3's 17-phase flat trace
 * into a per-process structured trace aligned with V4 metadata and adapters.
 */

import type { ContinuousTickPhaseName, ContinuousTickTrace } from "../time/continuousTick";
import { V3_TICK_PHASES, getV3TickPhase } from "./v3TickPhaseMetadata";
import type {
  TemporalProcessAdapterStatus,
  TemporalProcessMutationPolicy
} from "./temporalProcess";
import type { TemporalProcessAdapterRegistry } from "./temporalProcessAdapterRegistry";
import { V3_TICK_PHASE_ADAPTERS } from "./temporalProcessAdapterRegistry";

// ─── Unified tick trace types ─────────────────────────────────────────

/** One process entry in a unified tick trace. */
export interface UnifiedTickProcessTrace {
  /** TemporalProcess id (matches ContinuousTickPhaseName). */
  processId: string;
  /** Execution phase number (1-17). */
  phase: number;
  /** Human-readable label from metadata. */
  label: string;
  /** Current adapter implementation status. */
  adapterStatus: TemporalProcessAdapterStatus;
  /** Declared mutation policy from adapter. */
  mutationPolicy: TemporalProcessMutationPolicy;
  /** State fields the process declares it reads. */
  reads: string[];
  /** State fields the process declares it writes. */
  writes: string[];
  /** State field names that actually changed (from V3 trace). */
  changedStates: string[];
  /** V3 phase name (ContinuousTickPhaseName). */
  sourcePhaseName: ContinuousTickPhaseName;
  /**
   * True when this process is observation-only in V4.2:
   * adapterStatus != "delegated" and adapterStatus != "native".
   */
  observedOnly: boolean;
  /** Human-readable reasons from V3 trace. */
  reasons: string[];
}

/** Summary of mutation activity across all processes in this tick. */
export interface UnifiedTickMutationSummary {
  /** Total number of processes in the trace. */
  totalProcesses: number;
  /** Number of processes that are observed-only (not delegated/native). */
  observedOnlyCount: number;
  /** Number of processes with mutationPolicy = "delegates_to_v3". */
  delegateCandidateCount: number;
  /** Number of processes with non-empty writes (declared mutation). */
  declaredMutationProcessCount: number;
  /** Union of all changedStates across all processes. */
  actualChangedStateNames: string[];
  /** Warnings about mutation policy vs actual changes. */
  warnings: string[];
}

/** Coverage summary comparing metadata, adapters, and trace. */
export interface UnifiedTickCoverageSummary {
  /** Number of metadata entries (always 17). */
  metadataCount: number;
  /** Number of adapters registered. */
  adapterCount: number;
  /** Number of process ids with both metadata AND adapter. */
  matchedCount: number;
  /** Process ids with metadata but no adapter. */
  missingAdapters: string[];
  /** Adapter processIds not found in metadata. */
  orphanAdapters: string[];
}

/** Top-level unified tick trace. */
export interface UnifiedTickTrace {
  /** Trace format version. */
  version: "4.3.0";
  /** Days elapsed in this tick. */
  daysElapsed: number;
  /** Source of the trace data. */
  source: "v3_continuous_tick";
  /** Per-process trace entries, in phase order. */
  processTraces: UnifiedTickProcessTrace[];
  /** Mutation summary across all processes. */
  mutationSummary: UnifiedTickMutationSummary;
  /** Metadata-to-adapter coverage summary. */
  coverageSummary: UnifiedTickCoverageSummary;
  /** Warnings (metadata/adapter mismatches, missing coverage, etc.). */
  warnings: string[];
  /** Top-level reasons aggregated from V3 trace. */
  reasons: string[];
}

// ─── Builder input ────────────────────────────────────────────────────

export interface BuildUnifiedTickTraceInput {
  /** The V3 ContinuousTickTrace to transform. */
  v3Trace: ContinuousTickTrace;
  /** Adapter registry (defaults to V3_TICK_PHASE_ADAPTERS). */
  adapters?: TemporalProcessAdapterRegistry;
}

// ─── Builder ──────────────────────────────────────────────────────────

/**
 * Build a UnifiedTickTrace from a V3 ContinuousTickTrace.
 *
 * Reads from the V3 trace's `phases` array and maps each phase to a
 * UnifiedTickProcessTrace using V4 metadata and adapter information.
 *
 * Does NOT call runContinuousTick. Does NOT mutate state.
 */
export function buildUnifiedTickTrace(
  input: BuildUnifiedTickTraceInput
): UnifiedTickTrace {
  const { v3Trace } = input;
  const warnings: string[] = [];

  // Resolve adapters (use default if not provided).
  const adapters = input.adapters
    ? [...input.adapters.list()]
    : [...V3_TICK_PHASE_ADAPTERS];

  const adapterMap = new Map(adapters.map((a) => [a.processId, a]));

  // Build per-process traces from V3 phases.
  const processTraces: UnifiedTickProcessTrace[] = [];
  for (const v3Phase of v3Trace.phases) {
    const metadata = getV3TickPhase(v3Phase.name);
    const adapter = adapterMap.get(v3Phase.name);

    if (!metadata) {
      warnings.push(`V3 phase "${v3Phase.name}" has no V4 metadata entry`);
    }
    if (!adapter) {
      warnings.push(`V3 phase "${v3Phase.name}" has no V4 adapter`);
    }

    const adapterStatus: TemporalProcessAdapterStatus =
      adapter?.implementationStatus ?? "metadata_only";
    const observedOnly = adapterStatus !== "delegated" && adapterStatus !== "native";

    processTraces.push({
      processId: v3Phase.name,
      phase: metadata?.phase ?? 0,
      label: metadata?.label ?? v3Phase.name,
      adapterStatus,
      mutationPolicy: adapter?.mutationPolicy ?? "none",
      reads: metadata?.reads ?? [],
      writes: metadata?.writes ?? [],
      changedStates: [...v3Phase.changedStates],
      sourcePhaseName: v3Phase.name,
      observedOnly,
      reasons: [...v3Phase.reasons]
    });
  }

  // Build mutation summary.
  const mutationSummary = buildMutationSummary(processTraces, warnings);

  // Build coverage summary.
  const coverageSummary = buildCoverageSummary(adapterMap, warnings);

  return {
    version: "4.3.0",
    daysElapsed: v3Trace.daysElapsed,
    source: "v3_continuous_tick",
    processTraces,
    mutationSummary,
    coverageSummary,
    warnings,
    reasons: [...v3Trace.reasons]
  };
}

// ─── Summary builders ─────────────────────────────────────────────────

function buildMutationSummary(
  processTraces: UnifiedTickProcessTrace[],
  warnings: string[]
): UnifiedTickMutationSummary {
  const observedOnlyCount = processTraces.filter((p) => p.observedOnly).length;
  const delegateCandidateCount = processTraces.filter(
    (p) => p.mutationPolicy === "delegates_to_v3"
  ).length;
  const declaredMutationProcessCount = processTraces.filter(
    (p) => p.writes.length > 0
  ).length;

  const changedStateSet = new Set<string>();
  for (const pt of processTraces) {
    for (const state of pt.changedStates) {
      changedStateSet.add(state);
    }
  }
  const actualChangedStateNames = [...changedStateSet].sort();

  // Warn if a process declares writes but no changedStates in V3 trace.
  for (const pt of processTraces) {
    if (pt.writes.length > 0 && pt.changedStates.length === 0) {
      warnings.push(
        `Process "${pt.processId}" declares writes [${pt.writes.join(", ")}] but V3 trace shows no changedStates`
      );
    }
  }

  // Warn if a process has changedStates but declares no writes.
  for (const pt of processTraces) {
    if (pt.changedStates.length > 0 && pt.writes.length === 0) {
      warnings.push(
        `Process "${pt.processId}" shows changedStates [${pt.changedStates.join(", ")}] but declares no writes`
      );
    }
  }

  return {
    totalProcesses: processTraces.length,
    observedOnlyCount,
    delegateCandidateCount,
    declaredMutationProcessCount,
    actualChangedStateNames,
    warnings: [...warnings]
  };
}

function buildCoverageSummary(
  adapterMap: Map<string, { processId: string }>,
  warnings: string[]
): UnifiedTickCoverageSummary {
  const metadataIds = new Set(V3_TICK_PHASES.map((p) => p.id));
  const adapterIds = new Set(adapterMap.keys());

  const matchedCount = [...metadataIds].filter((id) => adapterIds.has(id)).length;
  const missingAdapters = [...metadataIds].filter((id) => !adapterIds.has(id));
  const orphanAdapters = [...adapterIds].filter((id) => !metadataIds.has(id));

  if (missingAdapters.length > 0) {
    warnings.push(`Metadata entries without adapters: ${missingAdapters.join(", ")}`);
  }
  if (orphanAdapters.length > 0) {
    warnings.push(`Adapters without metadata entries: ${orphanAdapters.join(", ")}`);
  }

  return {
    metadataCount: V3_TICK_PHASES.length,
    adapterCount: adapterMap.size,
    matchedCount,
    missingAdapters,
    orphanAdapters
  };
}
