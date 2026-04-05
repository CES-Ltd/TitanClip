/**
 * Anthropic Provider — wraps the Anthropic Messages API.
 */

import type {
  LLMProvider,
  LLMProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
} from "./base.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

const MODELS: ModelInfo[] = [
  { id: "claude-opus-4-20250514", label: "Claude Opus 4", contextWindow: 200000, inputCostPer1k: 0.015, outputCostPer1k: 0.075 },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", contextWindow: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
  { id: "claude-haiku-4-20250514", label: "Claude Haiku 4", contextWindow: 200000, inputCostPer1k: 0.0008, outputCostPer1k: 0.004 },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", contextWindow: 200000, inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", contextWindow: 200000, inputCostPer1k: 0.001, outputCostPer1k: 0.005 },
];

export class AnthropicProvider implements LLMProvider {
  readonly slug = "anthropic";
  readonly label = "Anthropic";

  async chat(
    messages: ChatMessage[],
    options: ChatOptions,
    config: LLMProviderConfig
  ): Promise<ChatResponse> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

    // Extract system message (Anthropic uses a separate `system` field)
    const systemMessages: string[] = [];
    const chatMessages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) systemMessages.push(options.systemPrompt);

    for (const msg of messages) {
      if (msg.role === "system") {
        systemMessages.push(msg.content);
      } else {
        chatMessages.push({ role: msg.role === "tool" ? "user" : msg.role, content: msg.content });
      }
    }

    const body: Record<string, unknown> = {
      model: options.model,
      messages: chatMessages,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (systemMessages.length > 0) body.system = systemMessages.join("\n\n");
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop) body.stop_sequences = options.stop;

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    const textBlocks = (data.content ?? []).filter((b: any) => b.type === "text");
    const content = textBlocks.map((b: any) => b.text).join("");

    return {
      content,
      role: "assistant",
      finishReason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason ?? "stop",
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        cachedInputTokens: data.usage?.cache_read_input_tokens ?? 0,
      },
      model: data.model ?? options.model,
      provider: this.slug,
    };
  }

  async chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
    config: LLMProviderConfig,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResponse> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

    const systemMessages: string[] = [];
    const chatMessages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) systemMessages.push(options.systemPrompt);
    for (const msg of messages) {
      if (msg.role === "system") systemMessages.push(msg.content);
      else chatMessages.push({ role: msg.role === "tool" ? "user" : msg.role, content: msg.content });
    }

    const body: Record<string, unknown> = {
      model: options.model,
      messages: chatMessages,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    };
    if (systemMessages.length > 0) body.system = systemMessages.join("\n\n");
    if (options.temperature !== undefined) body.temperature = options.temperature;

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    let fullContent = "";
    let usage = { inputTokens: 0, outputTokens: 0 };
    let model = options.model;

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as any;
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullContent += event.delta.text;
            onChunk({ type: "text_delta", content: event.delta.text });
          }
          if (event.type === "message_delta" && event.usage) {
            usage.outputTokens = event.usage.output_tokens ?? 0;
          }
          if (event.type === "message_start" && event.message) {
            model = event.message.model ?? model;
            usage.inputTokens = event.message.usage?.input_tokens ?? 0;
          }
        } catch {
          // skip malformed SSE
        }
      }
    }

    onChunk({ type: "done", usage });

    return { content: fullContent, role: "assistant", finishReason: "stop", usage, model, provider: this.slug };
  }

  async listModels(_config: LLMProviderConfig): Promise<ModelInfo[]> {
    return MODELS;
  }

  estimateCost(model: string, usage: ChatResponse["usage"]): number {
    const info = MODELS.find((m) => m.id === model);
    if (!info?.inputCostPer1k) return 0;
    return (
      (usage.inputTokens / 1000) * info.inputCostPer1k +
      (usage.outputTokens / 1000) * (info.outputCostPer1k ?? 0)
    );
  }

  async testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey ?? "",
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      return { ok: res.ok || res.status === 400 }; // 400 = valid key, bad request
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
