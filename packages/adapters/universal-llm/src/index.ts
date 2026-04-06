/**
 * OpenAI-Compatible LLM Adapter — connects to any LLM via HTTP endpoints.
 *
 * Supports OpenAI, Anthropic, Gemini, Azure, Vertex AI, Ollama, OpenRouter,
 * and any custom OpenAI-compatible endpoint.
 *
 * Provider and model are selected via agent adapterConfig.
 * Pre-configured endpoint presets auto-populate URLs for known providers.
 */

export const adapterType = "openai_compatible";
export const adapterLabel = "OpenAI-Compatible HTTP Endpoint";

/**
 * Provider presets — pre-populated URLs and auth requirements for known providers.
 * Used by the agent creation UI to auto-fill configuration.
 */
export const PROVIDER_PRESETS = [
  {
    slug: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "GPT-4o, o3-mini, and other OpenAI models",
  },
  {
    slug: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Claude Opus 4, Sonnet 4, Haiku 4",
  },
  {
    slug: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Gemini 2.5 Pro, Flash, and other Google models",
  },
  {
    slug: "azure",
    label: "Azure Foundry API",
    baseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}/",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Azure-hosted OpenAI models (replace {resource} and {deployment})",
  },
  {
    slug: "vertex",
    label: "Vertex AI",
    baseUrl: "https://{region}-aiplatform.googleapis.com/v1beta1/",
    authType: "oauth" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Google Cloud Vertex AI (replace {region}, requires service account key)",
  },
  {
    slug: "ollama_cloud",
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Ollama cloud-hosted inference",
  },
  {
    slug: "ollama_local",
    label: "Ollama Local",
    baseUrl: "http://localhost:11434/v1",
    authType: "none" as const,
    urlEditable: true,
    keyRequired: false,
    description: "Local Ollama instance (free, no API key needed)",
  },
  {
    slug: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "100+ models from multiple providers via single API key",
  },
  {
    slug: "custom",
    label: "Custom Endpoint",
    baseUrl: "",
    authType: "api_key" as const,
    urlEditable: true,
    keyRequired: true,
    description: "Any OpenAI-compatible API endpoint",
  },
] as const;

export type ProviderPreset = (typeof PROVIDER_PRESETS)[number];

export const agentConfigurationDoc = `
# OpenAI-Compatible HTTP Endpoint Adapter

Connects to any LLM provider that supports the OpenAI Chat Completions API format.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| provider | string | Yes | Provider preset slug (openai, anthropic, gemini, azure, vertex, ollama_cloud, ollama_local, openrouter, custom) |
| model | string | Yes | Model ID (e.g., "gpt-4o", "claude-sonnet-4-20250514") |
| apiKey | string | Yes* | API key (* not needed for Ollama Local) |
| baseUrl | string | Auto | API endpoint URL (auto-populated from preset, editable) |
| systemPrompt | string | No | Default system prompt |
| temperature | number | No | Sampling temperature (0-2) |
| maxTokens | number | No | Max output tokens (default: 4096) |
| maxToolIterations | number | No | Max tool loop iterations (default: 10) |
| maxCostPerRunUsd | number | No | Per-run cost limit in USD (default: 1.00) |
| maxTokensPerRun | number | No | Per-run token limit (default: 100000) |
| autonomyLevel | string | No | sandboxed, supervised, or autonomous (default: supervised) |
| allowedTools | string[] | No | Restrict to specific tools (default: all available) |

## Supported Providers

- **OpenAI**: GPT-4o, GPT-4o-mini, o1, o3-mini
- **Anthropic**: Claude Opus 4, Sonnet 4, Haiku 4
- **Google Gemini**: Gemini 2.5 Pro, Flash
- **Azure Foundry**: Azure-hosted OpenAI deployments
- **Vertex AI**: Google Cloud Vertex AI
- **Ollama Cloud**: Cloud-hosted Ollama inference
- **Ollama Local**: Local Ollama instance (free)
- **OpenRouter**: 100+ models via single API
- **Custom**: Any OpenAI-compatible endpoint

## Agentic Tool Loop

This adapter supports autonomous tool use. When the LLM responds with tool calls,
the adapter executes them and feeds results back, repeating until the LLM produces
a final text response or the iteration/cost budget is exhausted.

Built-in tools: web_search, web_fetch, shell_exec, read_file, write_file,
current_time, delegate_to_agent.
`;

export const models = [
  { id: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { id: "o3-mini", label: "o3-mini (OpenAI)" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4 (Anthropic)" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Anthropic)" },
  { id: "claude-haiku-4-20250514", label: "Claude Haiku 4 (Anthropic)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
  { id: "llama3", label: "Llama 3 (Ollama)" },
  { id: "mixtral", label: "Mixtral (Ollama)" },
];
