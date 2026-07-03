/**
 * V12.6 — Reply Planner
 * V12.12 — Deterministic replyPlanId (no Date.now())
 *
 * Generates structured AgentReplyPlan from policy decision + grounding bundle.
 * No LLM calls. No final prose. No roleplay output.
 * Evidence-grounded. Policy-aware. Safety-first.
 */
import type {
  AgentSessionConfig, AgentPolicyDecision,
  AgentGroundingBundle, AgentReplyPlan,
  ReplyIntent, ReplyTone,
} from "./agentTypes";

// ── Stable hash helper (V12.12) ───────────────────────────────────────

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

export interface ReplyPlannerInput {
  session: AgentSessionConfig;
  policy: AgentPolicyDecision;
  bundle: AgentGroundingBundle;
  hasCandidates?: boolean;
  hasEvidence?: boolean;
}

// ── Main entry ──

export function buildAgentReplyPlan(input: ReplyPlannerInput): AgentReplyPlan {
  const intent = selectReplyIntent(input);
  const tone = selectReplyTone(input);
  const groundedFacts = buildGroundedFacts(input.bundle);
  const uncertaintyNotes = buildUncertaintyNotes(input.bundle, input.policy);
  const safetyNotices = buildReplySafetyNotices(input);
  const suggestedOutline = buildSuggestedResponseOutline(intent, input);
  const llmAllowed = input.session.llmMode === "planned_boundary_only";

  const plan: AgentReplyPlan = {
    replyPlanId: `reply_${stableHash(input.session.sessionId + "|" + intent + "|" + tone + "|" + groundedFacts.length + "|" + JSON.stringify(input.hasCandidates) + "|" + JSON.stringify(input.hasEvidence))}`,
    tone,
    intent,
    groundedFacts,
    uncertaintyNotes,
    safetyNotices,
    suggestedResponseOutline: suggestedOutline,
    llmAllowed,
    noStateMutation: true,
  };
  if (llmAllowed) plan.llmBoundaryInstructions = buildLLMBoundaryInstructions();
  return plan;
}

// ── Intent selection ──

export function selectReplyIntent(input: ReplyPlannerInput): ReplyIntent {
  const { policy, hasCandidates, hasEvidence } = input;

  if (policy.decision === "block") return "refuse_unsafe";
  if (policy.decision === "confirmation_required") return "ask_confirmation";
  if (policy.decision === "apply_allowed" && hasCandidates) return "preview_event";
  if (policy.decision === "preview_only" && hasCandidates) return "preview_event";
  if (hasEvidence && policy.decision === "preview_only") return "explain_state";
  if (hasEvidence) return "summarize_history";
  if (!hasCandidates && !hasEvidence) return "clarify_input";

  return "neutral_ack";
}

// ── Tone selection ──

export function selectReplyTone(input: ReplyPlannerInput): ReplyTone {
  const { session, policy } = input;

  if (policy.safetyLevel === "unsafe") return "safety_first";
  if (session.safetyMode === "strict") return "cautious";
  if (session.inputMode === "journal") return "reflective";
  if (session.inputMode === "story") return "reflective";
  if (session.inputMode === "plugin" || session.inputMode === "tool") return "technical";
  if (policy.decision === "block" || policy.decision === "confirmation_required") return "concise";

  return "calm";
}

// ── Grounded facts ──

export function buildGroundedFacts(bundle: AgentGroundingBundle): string[] {
  const facts: string[] = [];
  const surface = bundle.characterStateSurface;

  facts.push(`当前状态: ${surface.headline}`);
  facts.push(`情绪状态: ${surface.emotionalState.label}`);
  facts.push(`压力水平: ${surface.stressState.label} (${surface.stressState.phase})`);

  for (const belief of surface.dominantBeliefs.slice(0, 2)) {
    facts.push(`核心信念: ${belief.content} (强度: ${belief.strength})`);
  }

  if (surface.behaviorTendencies.likelyAction) {
    facts.push(`行为倾向: ${surface.behaviorTendencies.likelyAction}`);
  }

  return facts;
}

// ── Uncertainty notes ──

export function buildUncertaintyNotes(
  bundle: AgentGroundingBundle,
  policy: AgentPolicyDecision,
): string[] {
  const notes: string[] = [];

  if (!bundle.explainabilityTimeline || bundle.explainabilityTimeline.causalSteps.length === 0) {
    notes.push("无法追溯因果链 — 历史事件证据不足。");
  }

  if (bundle.explainabilityTimeline && bundle.explainabilityTimeline.confidence === "low") {
    notes.push("因果链置信度低 — 以下分析可能不完整。");
  }

  if (policy.warnings.length > 0) {
    notes.push(`策略警告: ${policy.warnings.join("; ")}`);
  }

  if (bundle.evidenceRefs.length <= 2) {
    notes.push("可用证据有限 — 建议澄清输入或提供更多背景。");
  }

  return notes;
}

// ── Safety notices ──

export function buildReplySafetyNotices(input: ReplyPlannerInput): string[] {
  const notices: string[] = [
    "这是 CharacterOS 模拟系统的输出，不是医学或心理诊断。",
    "角色状态为模型计算结果，不代表真实人格或临床状况。",
  ];

  if (input.policy.writebackAllowed) {
    notices.push("事件写入需要用户明确确认后才能应用。");
  } else {
    notices.push("本次交互不会写入角色状态 (writeback blocked)。");
  }

  if (input.session.llmMode === "planned_boundary_only") {
    notices.push("LLM 上下文仅作为参考约束，不生成最终回复，不修改状态。");
  }

  return notices;
}

// ── Suggested response outline ──

export function buildSuggestedResponseOutline(
  intent: ReplyIntent,
  input: ReplyPlannerInput,
): string[] {
  const lines: string[] = [];

  switch (intent) {
    case "explain_state":
      lines.push("描述角色当前心理状态（基于 CharacterStateSurface）");
      lines.push("解释情绪来源（基于 ExplainabilityTimeline 因果步骤）");
      lines.push("说明压力水平和行为倾向");
      lines.push("指出当前安全边界（不诊断、不治疗建议）");
      break;

    case "preview_event":
      lines.push("总结候选事件及其预期影响（基于 EventStudioPreview）");
      lines.push("说明事件强度、影响通道、personality delta 方向");
      lines.push("如果策略允许: 提示用户可以确认应用事件");
      lines.push("如果策略不允许: 说明为什么事件未被应用");
      break;

    case "ask_confirmation":
      lines.push("说明当前事件候选需要用户确认才能应用");
      lines.push("列出需要确认的关键点: 事件类别、强度、影响预估");
      lines.push("提供确认指令 (例如: 'apply')");
      lines.push("如果用户拒绝: 丢弃候选，不写入状态");
      break;

    case "refuse_unsafe":
      lines.push("说明输入被策略门阻止的原因");
      lines.push("列出安全标记和阻塞理由");
      lines.push("建议安全的替代输入方向");
      lines.push("如果用户修正输入后可以重试");
      break;

    case "summarize_history":
      lines.push("基于 ExplainabilityTimeline 总结近期变化");
      lines.push("指出关键事件和因果步骤");
      lines.push("说明人格坐标的漂移方向");
      lines.push("标注置信度和证据状态");
      break;

    case "neutral_ack":
      lines.push("确认收到输入");
      lines.push("提示当前无候选事件或显著状态变化");
      lines.push("建议用户提供更具体的事件描述");
      break;

    case "clarify_input":
      lines.push("提示输入信息不足以提取事件或分析状态变化");
      lines.push("建议用户提供更具体的事件描述或背景");
      lines.push("当前系统状态保持不变");
      break;
  }

  lines.push(`[Safety] 包含 simulation-not-diagnosis 声明`);
  if (input.policy.auditRequired) lines.push(`[Audit] 操作需要审计记录`);

  return lines;
}

// ── LLM boundary instructions ──

export function buildLLMBoundaryInstructions(): string {
  return [
    "LLM is at planned boundary only — not executed.",
    "Do NOT generate final chat prose.",
    "Do NOT mutate character state.",
    "Do NOT invent events or personality claims.",
    "Do NOT produce medical/psychological diagnosis.",
    "Use only the provided AgentGroundingBundle context.",
    "If context is insufficient, say so — do not fabricate.",
    "Reply plan structure is the contract, not suggestion.",
  ].join(" | ");
}
