/**
 * OpenRouter Provider — OpenAI-compatible API that routes to multiple models.
 * Extends the OpenAI provider with OpenRouter-specific model discovery.
 */

import { OpenAIProvider } from "./openai.js";
import type { LLMProviderConfig, ModelInfo } from "./base.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProvider extends OpenAIProvider {
  override readonly slug = "openrouter";
  override readonly label = "OpenRouter";

  override async listModels(config: LLMProviderConfig): Promise<ModelInfo[]> {
    const baseUrl = config.baseUrl || OPENROUTER_BASE_URL;
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.data ?? [])
        .slice(0, 100) // Limit to top 100 models
        .map((m: any) => ({
          id: m.id,
          label: m.name ?? m.id,
          contextWindow: m.context_length,
          inputCostPer1k: m.pricing?.prompt ? parseFloat(m.pricing.prompt) * 1000 : undefined,
          outputCostPer1k: m.pricing?.completion ? parseFloat(m.pricing.completion) * 1000 : undefined,
        }));
    } catch {
      return [];
    }
  }

  override estimateCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
    // OpenRouter returns cost in the response; fallback to 0
    return 0;
  }

  override async testConnection(config: LLMProviderConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const models = await this.listModels(config);
      return { ok: models.length > 0 };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
