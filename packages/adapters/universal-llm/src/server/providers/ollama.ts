/**
 * Ollama Provider — local/cloud LLM inference via Ollama's OpenAI-compatible API.
 *
 * Overrides chatStream to handle Ollama-specific quirks:
 * - Does not send stream_options (unsupported)
 * - Handles usage reporting differences
 * - Falls back to non-streaming if stream parsing fails
 */

import type {
  LLMProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ModelInfo,
} from "./base.js";
import { OpenAIProvider } from "./openai.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434/v1";

export class OllamaProvider extends OpenAIProvider {
  override readonly slug = "ollama";
  override readonly label = "Ollama (Local)";

  override async chatStream(
    messages: ChatMessage[],
    options: ChatOptions,
    config: LLMProviderConfig,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<ChatResponse> {
    const baseUrl = config.baseUrl || DEFAULT_OLLAMA_URL;
    const body: Record<string, unknown> = {
      model: options.model,
      messages: this.formatMessages(messages, options.systemPrompt),
      stream: true,
      // Note: do NOT send stream_options — Ollama doesn't support it
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.tools?.length) body.tools = options.tools;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${err}`);
    }

    let fullContent = "";
    let usage = { inputTokens: 0, outputTokens: 0 };
    let finishReason: ChatResponse["finishReason"] = "stop";
    let model = options.model;
    let toolCalls: ChatResponse["toolCalls"] = undefined;

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from Ollama");

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
        if (line === "data: [DONE]") continue;
        try {
          const chunk = JSON.parse(line.slice(6)) as any;
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk({ type: "text_delta", content: delta.content });
          }
          // Accumulate tool calls from deltas
          if (delta?.tool_calls) {
            if (!toolCalls) toolCalls = [];
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                while (toolCalls.length <= tc.index) {
                  toolCalls.push({ id: "", type: "function", function: { name: "", arguments: "" } });
                }
                const existing = toolCalls[tc.index]!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              }
            }
          }
          if (chunk.choices?.[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason;
          }
          // Ollama may send usage in the final chunk or in a separate chunk
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

    // If streaming produced no content and no usage, try non-streaming fallback
    if (!fullContent && usage.inputTokens === 0 && usage.outputTokens === 0) {
      return this.chat(messages, options, config);
    }

    onChunk({ type: "done", usage });

    return {
      content: fullContent,
      role: "assistant",
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      finishReason: toolCalls?.length ? "tool_calls" : finishReason,
      usage,
      model,
      provider: this.slug,
    };
  }

  override async listModels(config: LLMProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = (config.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/v1\/?$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.models ?? []).map((m: any) => ({
        id: m.name,
        label: m.name,
        contextWindow: m.details?.parameter_size ? undefined : undefined,
      }));
    } catch {
      return [];
    }
  }

  override estimateCost(_model: string, _usage: ChatResponse["usage"]): number {
    return 0; // Local inference is free
  }

  override async testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }> {
    const baseUrl = (config.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/v1\/?$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      return { ok: res.ok };
    } catch (err: any) {
      return { ok: false, error: `Cannot reach Ollama at ${baseUrl}: ${err.message}` };
    }
  }

}
