/**
 * V9.6 State Transition Explanation Skeleton
 *
 * Explains what changed between two character states at a structural level.
 * Does NOT infer psychological meaning — only reports:
 *   - which paths changed
 *   - before/after values
 *   - which domains were affected
 *
 * No LLM. No async. Deterministic.
 */

import type { CharacterEditDomain } from "../editor/characterEditPatch";
import {
  createTraceId,
  createFactId,
  createReasonId,
  type ExplanationTrace,
  type ExplanationFact,
  type ExplanationReason
} from "./explanationTypes";

// ─── State Transition Summary ───────────────────────────────────────────────

export interface StateTransitionSummary {
  /** Dot-separated paths that changed. */
  changedPaths: string[];
  /** Before values keyed by path (only changed paths). */
  beforeSummary: Record<string, unknown>;
  /** After values keyed by path (only changed paths). */
  afterSummary: Record<string, unknown>;
  /** Affected character domains (derived from changed paths). */
  affectedDomains: CharacterEditDomain[];
}

// ─── Domain mapping (mirrors editor logic for standalone use) ───────────────

const DOMAIN_PREFIXES: [string, CharacterEditDomain][] = [
  ["coordinate.values.", "personality"],
  ["learningRate", "personality"],
  ["boundary.", "boundary"],
  ["metaState.", "meta_state"],
  ["rewardState.", "reward"],
  ["homeostasisState.", "homeostasis"],
];

function inferDomainsFromPaths(paths: string[]): CharacterEditDomain[] {
  const domains = new Set<CharacterEditDomain>();
  for (const p of paths) {
    let found = false;
    for (const [prefix, domain] of DOMAIN_PREFIXES) {
      if (p.startsWith(prefix)) {
        domains.add(domain);
        found = true;
        break;
      }
    }
    if (!found) domains.add("unknown");
  }
  return [...domains].sort();
}

// ─── explainStateTransition ─────────────────────────────────────────────────

export function explainStateTransition(summary: StateTransitionSummary): ExplanationTrace {
  const traceId = createTraceId();
  const facts: ExplanationFact[] = [];
  const reasons: ExplanationReason[] = [];
  const warnings: string[] = [];

  const domains = summary.affectedDomains.length > 0
    ? summary.affectedDomains
    : inferDomainsFromPaths(summary.changedPaths);

  // Fact: changed paths
  const pathsFact: ExplanationFact = {
    id: createFactId(),
    label: "Changed paths",
    value: summary.changedPaths,
    source: "state"
  };
  facts.push(pathsFact);

  // Fact: change count
  const countFact: ExplanationFact = {
    id: createFactId(),
    label: "Number of changed paths",
    value: summary.changedPaths.length,
    source: "derived"
  };
  facts.push(countFact);

  // Fact: affected domains
  const domainsFact: ExplanationFact = {
    id: createFactId(),
    label: "Affected domains",
    value: domains,
    source: "derived"
  };
  facts.push(domainsFact);

  // Fact: before values
  const beforeFact: ExplanationFact = {
    id: createFactId(),
    label: "Before values",
    value: summary.beforeSummary,
    source: "state"
  };
  facts.push(beforeFact);

  // Fact: after values
  const afterFact: ExplanationFact = {
    id: createFactId(),
    label: "After values",
    value: summary.afterSummary,
    source: "state"
  };
  facts.push(afterFact);

  // Reason: overview
  reasons.push({
    id: createReasonId(),
    message: `${summary.changedPaths.length} path(s) changed across ${domains.length} domain(s).`,
    scope: "state_transition",
    severity: "info",
    confidence: "high",
    supportingFacts: [countFact, pathsFact, domainsFact]
  });

  // Reasons: per-path change
  for (const path of summary.changedPaths) {
    const before = summary.beforeSummary[path];
    const after = summary.afterSummary[path];

    const pathFact: ExplanationFact = {
      id: createFactId(),
      label: `Change: ${path}`,
      value: { before, after },
      source: "state"
    };
    facts.push(pathFact);

    reasons.push({
      id: createReasonId(),
      message: `"${path}" changed: ${String(before)} → ${String(after)}.`,
      scope: "state_transition",
      severity: "info",
      confidence: "high",
      supportingFacts: [pathFact]
    });
  }

  // Reason: domain summary
  if (domains.length > 0) {
    reasons.push({
      id: createReasonId(),
      message: `Affected character domains: ${domains.join(", ")}.`,
      scope: "state_transition",
      severity: "info",
      confidence: "high",
      supportingFacts: [domainsFact]
    });
  }

  return {
    id: traceId,
    scope: "state_transition",
    title: `State Transition: ${summary.changedPaths.length} path(s) changed`,
    summary: `${summary.changedPaths.length} path(s) changed across ${domains.length} domain(s).`,
    reasons,
    facts,
    warnings,
    createdAt: new Date().toISOString()
  };
}
