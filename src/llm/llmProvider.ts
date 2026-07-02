export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMGenerateOptions {
  temperature?: number;
  responseFormat?: "json_object";
}

export interface LLMProvider {
  generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<string>;
}
