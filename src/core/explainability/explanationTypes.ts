/**
 * V9.6 Explainability System Foundation — Core Types
 *
 * Pure data types for structured explanation traces.
 * No LLM. No natural language generation. No UI rendering.
 *
 * These types form the backbone of the CharacterOS explainability layer.
 * Every explainability function in the system produces an ExplanationTrace.
 */

// ─── Scope ──────────────────────────────────────────────────────────────────

export type ExplanationScope =
  | "patch"
  | "decision"
  | "memory_activation"
  | "cluster_influence"
  | "belief_evolution"
  | "need_change"
  | "desire_change"
  | "behavior_bias"
  | "state_transition"
  | "integrity_policy"
  | "differentiated_decision"; // V10.13

// ─── Confidence & Severity ──────────────────────────────────────────────────

export type ExplanationConfidence = "low" | "medium" | "high";

export type ExplanationSeverity = "info" | "warning" | "danger" | "blocked";

// ─── Fact ───────────────────────────────────────────────────────────────────

export interface ExplanationFact {
  /** Unique fact id within the trace. */
  id: string;
  /** Short human-readable label (e.g. "Trust change", "Affected domain"). */
  label: string;
  /** The fact value — any JSON-serializable data. */
  value: unknown;
  /** Where this fact was sourced from. */
  source: "state" | "patch" | "validation" | "integrity" | "graph" | "benchmark" | "derived";
}

// ─── Reason ─────────────────────────────────────────────────────────────────

export interface ExplanationReason {
  /** Unique reason id within the trace. */
  id: string;
  /** Single short sentence explaining this reason. */
  message: string;
  /** Which system scope this reason belongs to. */
  scope: ExplanationScope;
  /** How severe this reason is. */
  severity: ExplanationSeverity;
  /** How confident the system is in this reason. */
  confidence: ExplanationConfidence;
  /** Facts that support this reason. */
  supportingFacts: ExplanationFact[];
}

// ─── Trace ──────────────────────────────────────────────────────────────────

export interface ExplanationTrace {
  /** Unique trace id. */
  id: string;
  /** Which system scope generated this trace. */
  scope: ExplanationScope;
  /** Short human-readable title. */
  title: string;
  /** One-sentence summary of what this trace explains. */
  summary: string;
  /** Ordered list of reasons — most important first. */
  reasons: ExplanationReason[];
  /** All facts referenced by reasons (deduplicated by id). */
  facts: ExplanationFact[];
  /** Standalone warning strings. */
  warnings: string[];
  /** ISO timestamp of trace creation. */
  createdAt: string;
}

// ─── Decision Trace Skeleton (V9.7+) ────────────────────────────────────────

/**
 * DecisionTrace captures the inputs to a behavioral decision.
 * V9.6 defines the type only — full decision explainability
 * is scheduled for V9.7+.
 */
export interface DecisionTrace {
  /** Unique decision identifier. */
  decisionId: string;
  /** IDs of memories active at decision time. */
  activatedMemoryIds: string[];
  /** IDs of beliefs that dominated the decision context. */
  dominantBeliefIds: string[];
  /** IDs of needs active at decision time. */
  activeNeedIds: string[];
  /** IDs of desires active at decision time. */
  activeDesireIds: string[];
  /** IDs of behavior biases that influenced the decision. */
  behaviorBiasIds: string[];
  /** The behavior that was selected. */
  selectedBehavior: string;
  /** Behaviors that were considered but rejected. */
  rejectedBehaviors: string[];
  /** Structured reasons explaining the decision. */
  reasons: ExplanationReason[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let traceCounter = 0;

/** Generate a unique trace id. */
export function createTraceId(): string {
  traceCounter++;
  return `trace_${Date.now()}_${traceCounter}_${Math.random().toString(16).slice(2, 8)}`;
}

let factCounter = 0;

/** Generate a unique fact id. */
export function createFactId(): string {
  factCounter++;
  return `fact_${Date.now()}_${factCounter}`;
}

let reasonCounter = 0;

/** Generate a unique reason id. */
export function createReasonId(): string {
  reasonCounter++;
  return `reason_${Date.now()}_${reasonCounter}`;
}
