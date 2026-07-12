import { buildLlmFallbackReply } from "./llmBoundaryBuilders";
import type { LlmBoundaryRequest, LlmFallbackReply } from "./llmBoundaryTypes";

export type LlmFallbackReason =
  | "safety_preflight_failed"
  | "llm_disabled"
  | "provider_not_allowed"
  | "llm_unavailable"
  | "validation_failed"
  | "grounding_failed";

export function generateLlmFallbackReply(
  request: LlmBoundaryRequest,
  reason: LlmFallbackReason,
): LlmFallbackReply {
  const facts = request.replyPlan.groundedFacts.slice(0, 3);
  const lines = [`[回复] ${fallbackLead(request.replyPlan.intent, reason)}`];
  for (const fact of facts) lines.push(`[事实] ${fact}`);
  if (facts.length === 0) lines.push("[不确定性] 当前没有足够的接地事实。");
  for (const note of request.replyPlan.uncertaintyNotes) lines.push(`[不确定性] ${note}`);
  for (const notice of request.replyPlan.safetyNotices) lines.push(`[安全] ${notice}`);

  return buildLlmFallbackReply({
    requestId: request.requestId,
    reason,
    outlineUsed: [...request.replyPlan.suggestedResponseOutline],
    text: lines.join("\n"),
    safetyNotices: [...request.replyPlan.safetyNotices],
  });
}

function fallbackLead(intent: string, reason: LlmFallbackReason): string {
  const reasonText = reason === "llm_disabled"
    ? "未启用外部语言模型，使用确定性回复。"
    : "语言模型输出未通过边界检查，已使用确定性回复。";
  switch (intent) {
    case "explain_state":
      return `以下状态说明仅来自结构化证据。${reasonText}`;
    case "preview_event":
      return `结构化事件预览尚未写入角色状态。${reasonText}`;
    case "ask_confirmation":
      return `事件应用仍需通过确定性写回流程明确确认。${reasonText}`;
    case "refuse_unsafe":
      return `当前输入已被安全策略阻止。${reasonText}`;
    case "summarize_history":
      return `以下历史摘要仅使用已有证据。${reasonText}`;
    case "clarify_input":
      return `当前信息不足，请补充具体事件与背景。${reasonText}`;
    default:
      return `已收到输入，当前没有可确认的状态写入。${reasonText}`;
  }
}
