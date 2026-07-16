/**
 * V12.5 — Agent Context Builder
 *
 * Assembles safe, structured AgentGroundingBundle from V11 Explorer surfaces.
 * No raw state. No LLM calls. No writes. Evidence-grounded. Policy-aware.
 */
import type {
  AgentSessionConfig, AgentPolicyDecision,
  AgentGroundingBundle, AgentSafetyNotice,
} from "./agentTypes";
import type {
  CharacterStateSurface, ExplainabilityTimeline,
  RealityAuditPanel, TimeMachineRestoreView,
} from "../explorer/explorerTypes";

export interface ContextBuilderInput {
  session: AgentSessionConfig;
  policyDecision: AgentPolicyDecision;
  stateSurface: CharacterStateSurface;
  explainability?: ExplainabilityTimeline;
  realityAudit?: RealityAuditPanel;
  timeMachineRefs?: string[];
  restoreView?: TimeMachineRestoreView;
  evidenceQuery?: string;
}

// ── Main entry ──

export function buildAgentGroundingBundle(
  input: ContextBuilderInput,
): AgentGroundingBundle {
  const evidenceRefs = selectRelevantEvidence(input);
  const omission = buildContextOmissionReport();

  const bundle: AgentGroundingBundle = {
    characterStateSurface: input.stateSurface,
    timeMachineRefs: input.timeMachineRefs ?? [],
    evidenceRefs,
    omittedRawState: true,
  };
  if (input.policyDecision.decision !== "block" && input.explainability) {
    bundle.explainabilityTimeline = input.explainability;
  }
  if (input.policyDecision.decision === "apply_allowed" && input.realityAudit) {
    bundle.realityAuditPanel = input.realityAudit;
  }
  return bundle;
}

// ── Evidence selection ──

export function selectRelevantEvidence(input: ContextBuilderInput): Array<{ source: string; excerpt: string }> {
  const refs: Array<{ source: string; excerpt: string }> = [];

  // State surface headlines
  refs.push({
    source: "characterStateSurface.headline",
    excerpt: input.stateSurface.headline,
  });
  refs.push({
    source: "characterStateSurface.emotionalState",
    excerpt: input.stateSurface.emotionalState.label,
  });

  // Top beliefs
  for (const b of input.stateSurface.dominantBeliefs.slice(0, 2)) {
    refs.push({
      source: `characterStateSurface.belief`,
      excerpt: `${b.content} (${b.strength})`,
    });
  }

  // Explainability timeline steps
  if (input.explainability && input.explainability.causalSteps.length > 0) {
    for (const step of input.explainability.causalSteps.slice(0, 3)) {
      refs.push({
        source: `explainability.step.${step.stepId}`,
        excerpt: `${step.type}: ${step.summary.slice(0, 80)}`,
      });
    }
  }

  // No evidence fallback
  if (refs.length <= 2 && (!input.explainability || input.explainability.causalSteps.length === 0)) {
    refs.push({
      source: "context_builder",
      excerpt: "历史证据不足，回复置信度受限。",
    });
  }

  return refs;
}

// ── Omission report ──

export function buildContextOmissionReport(): {
  omittedRawState: true;
  omittedFields: string[];
  reasons: string[];
} {
  return {
    omittedRawState: true,
    omittedFields: [
      "CharacterPhysicsState (raw coordinate values)",
      "full memory payload dumps",
      "repository storage data",
      "API keys / secrets",
      "raw plugin payload",
      "internal engine state (velocity, driftMultiplier)",
    ],
    reasons: [
      "raw state is never exposed to external consumers",
      "context is qualitative and summary-only",
      "data is structured for ReplyPlanner consumption, not raw export",
    ],
  };
}

// ── Compact summary for ReplyPlanner ──

export function summarizeGroundingForReply(
  bundle: AgentGroundingBundle,
  policyDecision: AgentPolicyDecision,
): string {
  const parts: string[] = [];

  parts.push(`[State] ${bundle.characterStateSurface.headline}`);
  parts.push(`[Emotion] ${bundle.characterStateSurface.emotionalState.label}`);
  parts.push(`[Stress] ${bundle.characterStateSurface.stressState.label}`);

  const beliefs = bundle.characterStateSurface.dominantBeliefs
    .map((b) => b.content).join("; ");
  if (beliefs) parts.push(`[Beliefs] ${beliefs}`);

  if (bundle.explainabilityTimeline && bundle.explainabilityTimeline.causalSteps.length > 0) {
    parts.push(`[Timeline] ${bundle.explainabilityTimeline.causalSteps.length} causal steps`);
    parts.push(`[Confidence] ${bundle.explainabilityTimeline.confidence}`);
  } else {
    parts.push("[Timeline] 无可用历史因果链");
  }

  parts.push(`[Policy] ${policyDecision.decision}`);
  if (policyDecision.auditRequired) parts.push("[Audit] required");

  return parts.join(" | ");
}

// ── Safety notices for context ──

export function buildContextSafetyNotices(
  session: AgentSessionConfig,
): AgentSafetyNotice[] {
  const notices: AgentSafetyNotice[] = [
    {
      code: "SIMULATION_NOT_DIAGNOSIS",
      severity: "warn",
      message: "此上下文基于 CharacterOS 模拟系统生成，不是医学或心理诊断。",
      appliesTo: "reply",
      recoverable: true,
    },
    {
      code: "NO_AUTONOMOUS_WRITEBACK",
      severity: "warn",
      message: `当前写回策略: ${session.writebackPolicy}。系统不会自动写入状态。`,
      appliesTo: "writeback",
      recoverable: true,
    },
  ];

  if (session.llmMode === "planned_boundary_only") {
    notices.push({
      code: "LLM_BOUNDARY_ONLY",
      severity: "info",
      message: "LLM 仅能通过 V13 语言适配边界生成表述，不修改状态或执行写回。",
      appliesTo: "llm",
      recoverable: true,
    });
  }

  return notices;
}
