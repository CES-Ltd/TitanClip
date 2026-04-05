/**
 * Base LLM Provider Interface — all providers implement this contract.
 *
 * Messages use the OpenAI chat format as the canonical internal representation.
 * Each provider normalizes to/from this format.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  role: "assistant";
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "error";
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  };
  model: string;
  provider: string;
}

export interface StreamChunk {
  type: "text_delta" | "tool_call_delta" | "done" | "error";
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  error?: string;
  usage?: ChatResponse["usage"];
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
}

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract LLM Provider — each provider (OpenAI, Anthropic, etc.) implements this.
 */
export interface LLMProvider {
  readonly slug: string;
  readonly label: string;

  /** Send a chat completion request */
  chat(messages: ChatMessage[], options: ChatOptions, config: LLMProviderConfig): Promise<ChatResponse>;

  /** Stream a chat completion request */
  chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
    config: LLMProviderConfig,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResponse>;

  /** List available models from this provider */
  listModels(config: LLMProviderConfig): Promise<ModelInfo[]>;

  /** Estimate cost in USD for a given usage */
  estimateCost(model: string, usage: ChatResponse["usage"]): number;

  /** Test connectivity */
  testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }>;
}
