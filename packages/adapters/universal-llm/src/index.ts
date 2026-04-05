/**
 * Universal LLM Adapter — metadata and configuration.
 *
 * Supports: OpenAI, Anthropic, OpenRouter, Ollama
 * Provider and model are selected via agent adapterConfig.
 */

export const adapterType = "universal_llm";
export const adapterLabel = "Universal LLM";

export const agentConfigurationDoc = `
# Universal LLM Adapter

Connects to any LLM provider via a unified interface.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| provider | string | Yes | Provider slug: "openai", "anthropic", "openrouter", "ollama" |
| model | string | Yes | Model ID (e.g., "gpt-4o", "claude-sonnet-4-20250514") |
| apiKey | string | Yes* | API key (* not needed for Ollama) |
| baseUrl | string | No | Custom API endpoint |
| systemPrompt | string | No | Default system prompt |
| temperature | number | No | Sampling temperature (0-2) |
| maxTokens | number | No | Max output tokens (default: 4096) |
| maxHistoryTurns | number | No | Max conversation turns to keep (default: 50) |

## Supported Providers

- **OpenAI**: GPT-4o, GPT-4o-mini, o1, o3-mini
- **Anthropic**: Claude Opus 4, Sonnet 4, Haiku 4, Claude 3.5 family
- **OpenRouter**: 100+ models from multiple providers
- **Ollama**: Any locally running model (llama3, mixtral, phi, etc.)
`;

export const models = [
  // OpenAI
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { id: "openai/o3-mini", label: "o3-mini (OpenAI)" },
  // Anthropic
  { id: "anthropic/claude-opus-4-20250514", label: "Claude Opus 4 (Anthropic)" },
  { id: "anthropic/claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Anthropic)" },
  { id: "anthropic/claude-haiku-4-20250514", label: "Claude Haiku 4 (Anthropic)" },
  // Ollama
  { id: "ollama/llama3", label: "Llama 3 (Ollama Local)" },
  { id: "ollama/mixtral", label: "Mixtral (Ollama Local)" },
];
