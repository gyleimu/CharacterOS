import { buildLlmProviderResponse } from "./llmBoundaryBuilders";
import type {
  LlmBoundaryPrompt,
  LlmBoundaryRequest,
  LlmProviderConfig,
  LlmProviderResponse,
  LlmProviderType,
} from "./llmBoundaryTypes";

export interface LlmProviderCompletionInput {
  readonly request: LlmBoundaryRequest;
  readonly prompt: LlmBoundaryPrompt;
  readonly providerConfig: LlmProviderConfig;
}

export interface LlmProviderAdapter {
  readonly providerType: LlmProviderType;
  complete(input: LlmProviderCompletionInput): Promise<LlmProviderResponse>;
}

export type MockLlmResponseMode =
  | "grounded"
  | "empty"
  | "timeout"
  | "error"
  | "diagnosis"
  | "mutation_claim"
  | "ungrounded"
  | "missing_safety"
  | "custom";

export interface MockLlmProviderOptions {
  readonly mode?: MockLlmResponseMode;
  readonly customText?: string;
}

export class MockLlmProvider implements LlmProviderAdapter {
  readonly providerType = "mock" as const;
  private readonly mode: MockLlmResponseMode;
  private readonly customText: string;

  constructor(options: MockLlmProviderOptions = {}) {
    this.mode = options.mode ?? "grounded";
    this.customText = options.customText ?? "";
  }

  async complete(input: LlmProviderCompletionInput): Promise<LlmProviderResponse> {
    if (input.providerConfig.providerType !== "mock") {
      return response(input, "", "error", "Mock provider cannot execute a non-mock configuration.");
    }
    if (input.providerConfig.networkAllowed) {
      return response(input, "", "error", "Mock provider requires networkAllowed=false.");
    }

    switch (this.mode) {
      case "empty":
        return response(input, "");
      case "timeout":
        return response(input, "", "timeout", "Mock provider timeout.");
      case "error":
        return response(input, "", "error", "Mock provider error.");
      case "diagnosis":
        return response(input, withSafety("[事实] 角色已被诊断为焦虑症。", input.prompt));
      case "mutation_claim":
        return response(input, withSafety("[事实] 事件已经写入，角色状态已修改。", input.prompt));
      case "ungrounded":
        return response(input, withSafety("[事实] 角色已经秘密决定永久离开所有关系。", input.prompt));
      case "missing_safety":
        return response(input, groundedText(input.prompt, false));
      case "custom":
        return response(input, this.customText);
      case "grounded":
        return response(input, groundedText(input.prompt, true));
    }
  }
}

function response(
  input: LlmProviderCompletionInput,
  rawText: string,
  finishReason: "stop" | "error" | "timeout" = "stop",
  error: string | null = null,
): LlmProviderResponse {
  return buildLlmProviderResponse({
    providerId: input.providerConfig.providerId,
    requestId: input.request.requestId,
    rawText,
    finishReason,
    usage: finishReason === "stop"
      ? {
          promptTokens: approximateTokens(JSON.stringify(input.prompt)),
          completionTokens: approximateTokens(rawText),
        }
      : null,
    latencyMs: null,
    providerWarnings: [],
    error,
  });
}

function groundedText(prompt: LlmBoundaryPrompt, includeSafety: boolean): string {
  const facts = prompt.groundingFacts
    .filter((fact) => !fact.startsWith("[warning]"))
    .slice(0, 3)
    .map(stripGroundingPrefix);
  const lines = facts.length > 0
    ? facts.map((fact) => `[事实] ${fact}`)
    : ["[回复] 当前可用信息有限，无法形成接地结论。"];

  for (const note of prompt.uncertaintyNotes.slice(0, 2)) {
    lines.push(`[不确定性] ${note}`);
  }
  if (includeSafety) {
    for (const notice of prompt.safetyNotices) lines.push(`[安全] ${notice}`);
  }
  return lines.join("\n");
}

function withSafety(text: string, prompt: LlmBoundaryPrompt): string {
  return [text, ...prompt.safetyNotices.map((notice) => `[安全] ${notice}`)].join("\n");
}

function stripGroundingPrefix(value: string): string {
  return value.replace(/^\[(?:grounded|evidence:[^\]]+|causal:[^\]]+)\]\s*/i, "").trim();
}

function approximateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
