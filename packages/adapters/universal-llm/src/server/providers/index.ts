import type { LLMProvider } from "./base.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenRouterProvider } from "./openrouter.js";
import { OllamaProvider } from "./ollama.js";

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  openrouter: new OpenRouterProvider(),
  ollama: new OllamaProvider(),
};

export function getProvider(slug: string): LLMProvider {
  const provider = providers[slug];
  if (!provider) {
    throw new Error(`Unknown LLM provider: "${slug}". Available: ${Object.keys(providers).join(", ")}`);
  }
  return provider;
}

export function listProviderSlugs(): string[] {
  return Object.keys(providers);
}

export function listProviders(): Array<{ slug: string; label: string }> {
  return Object.values(providers).map((p) => ({ slug: p.slug, label: p.label }));
}

export { type LLMProvider, type LLMProviderConfig, type ChatMessage, type ChatOptions, type ChatResponse, type StreamChunk, type ModelInfo } from "./base.js";
