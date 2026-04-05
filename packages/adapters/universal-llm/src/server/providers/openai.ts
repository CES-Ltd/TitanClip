/**
 * OpenAI Provider — wraps the OpenAI Chat Completions API.
 * Also serves as the base for OpenRouter (same API format).
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

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "o1": { input: 0.015, output: 0.06 },
  "o1-mini": { input: 0.003, output: 0.012 },
  "o3-mini": { input: 0.0011, output: 0.0044 },
};

export class OpenAIProvider implements LLMProvider {
  readonly slug = "openai";
  readonly label = "OpenAI";

  async chat(
    messages: ChatMessage[],
    options: ChatOptions,
    config: LLMProviderConfig
  ): Promise<ChatResponse> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.formatMessages(messages, options.systemPrompt),
      stream: false,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop) body.stop = options.stop;
    if (options.tools?.length) body.tools = options.tools;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.metadata?.organization
          ? { "OpenAI-Organization": config.metadata.organization as string }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? "",
      role: "assistant",
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason ?? "stop",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
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
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.formatMessages(messages, options.systemPrompt),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.tools?.length) body.tools = options.tools;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    let fullContent = "";
    let usage = { inputTokens: 0, outputTokens: 0 };
    let finishReason: ChatResponse["finishReason"] = "stop";
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
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const chunk = JSON.parse(line.slice(6)) as any;
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk({ type: "text_delta", content: delta.content });
          }
          if (chunk.choices?.[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };
          }
          if (chunk.model) model = chunk.model;
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    onChunk({ type: "done", usage });

    return {
      content: fullContent,
      role: "assistant",
      finishReason,
      usage,
      model,
      provider: this.slug,
    };
  }

  async listModels(config: LLMProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    return (data.data ?? [])
      .filter((m: any) => m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3"))
      .map((m: any) => ({
        id: m.id,
        label: m.id,
        ...(MODEL_PRICING[m.id] ?? {}),
      }))
      .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
  }

  estimateCost(model: string, usage: ChatResponse["usage"]): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;
    return (
      (usage.inputTokens / 1000) * pricing.input +
      (usage.outputTokens / 1000) * pricing.output
    );
  }

  async testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const models = await this.listModels(config);
      return { ok: models.length > 0 };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
    const result: ChatMessage[] = [];
    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }
    result.push(...messages);
    return result;
  }
}
