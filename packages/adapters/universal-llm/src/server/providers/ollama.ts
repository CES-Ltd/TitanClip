/**
 * Ollama Provider — local LLM inference via Ollama's OpenAI-compatible API.
 */

import { OpenAIProvider } from "./openai.js";
import type { LLMProviderConfig, ModelInfo, ChatResponse } from "./base.js";

const DEFAULT_OLLAMA_URL = "http://localhost:11434/v1";

export class OllamaProvider extends OpenAIProvider {
  override readonly slug = "ollama";
  override readonly label = "Ollama (Local)";

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
