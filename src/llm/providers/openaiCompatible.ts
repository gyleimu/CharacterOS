import type { LLMGenerateOptions, LLMMessage, LLMProvider } from "../llmProvider";

export interface OpenAICompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private readonly config: OpenAICompatibleProviderConfig) {}

  async generate(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120000);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: options.temperature ?? 0,
          response_format: options.responseFormat === "json_object" ? { type: "json_object" } : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("LLM response did not include message content.");
      }
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createOpenAICompatibleProviderFromEnv(): OpenAICompatibleProvider | undefined {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !apiKey || !model) return undefined;

  const config: OpenAICompatibleProviderConfig = {
    baseUrl,
    apiKey,
    model
  };
  if (process.env.LLM_TIMEOUT) {
    config.timeoutMs = Number(process.env.LLM_TIMEOUT) * 1000;
  }
  return new OpenAICompatibleProvider(config);
}
