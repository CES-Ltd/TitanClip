/**
 * HttpEndpointModelFetcher — connects to OpenAI-compatible endpoints
 * to discover and whitelist available models.
 *
 * Used in the Instance Admin Settings adapter section when the selected
 * adapter is "openai_compatible" or "universal_llm".
 *
 * Flow: Select preset → enter API key → click Connect → models appear with toggles.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Zap, Loader2, Check, X, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const PROVIDER_PRESETS = [
  { slug: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", keyRequired: true },
  { slug: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com", keyRequired: true },
  { slug: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", keyRequired: true },
  { slug: "azure", label: "Azure Foundry API", baseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}/", keyRequired: true, urlEditable: true },
  { slug: "vertex", label: "Vertex AI", baseUrl: "https://{region}-aiplatform.googleapis.com/v1beta1/", keyRequired: true, urlEditable: true },
  { slug: "ollama_cloud", label: "Ollama Cloud", baseUrl: "https://api.ollama.ai/v1", keyRequired: true },
  { slug: "ollama_local", label: "Ollama Local", baseUrl: "http://localhost:11434/v1", keyRequired: false, urlEditable: true },
  { slug: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyRequired: true },
  { slug: "custom", label: "Custom Endpoint", baseUrl: "", keyRequired: true, urlEditable: true },
];

interface FetchedModel {
  id: string;
  label: string;
}

interface HttpEndpointModelFetcherProps {
  /** Currently whitelisted model IDs for this adapter */
  allowedModels: string[] | null;
  /** Callback when model whitelist changes */
  onModelsChange: (models: string[] | null) => void;
  /** Whether mutations are in progress */
  disabled?: boolean;
}

export function HttpEndpointModelFetcher({ allowedModels, onModelsChange, disabled }: HttpEndpointModelFetcherProps) {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const preset = PROVIDER_PRESETS.find((p) => p.slug === selectedPreset);
  const isUrlEditable = preset?.urlEditable ?? selectedPreset === "custom";
  const needsKey = preset?.keyRequired ?? true;

  const connectMutation = useMutation({
    mutationFn: async () => {
      setConnectError(null);
      const effectiveUrl = baseUrl || preset?.baseUrl || "";
      if (!effectiveUrl) throw new Error("Base URL is required");

      // Try to fetch models from the provider
      // For OpenAI-compatible endpoints, GET /models returns the list
      let modelsUrl = effectiveUrl.replace(/\/+$/, "");
      if (!modelsUrl.endsWith("/models")) modelsUrl += "/models";

      const headers: Record<string, string> = {};
      if (apiKey) {
        // Anthropic uses x-api-key, others use Bearer
        if (selectedPreset === "anthropic") {
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
          // Anthropic doesn't have a /models endpoint — return static list
          return [
            { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
            { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
            { id: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
            { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
            { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
          ];
        }
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API returned ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();

      // OpenAI format: { data: [{ id, ... }] }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => ({
          id: m.id ?? m.name,
          label: m.id ?? m.name,
        })).slice(0, 100);
      }

      // Ollama format: { models: [{ name, ... }] }
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: any) => ({
          id: m.name ?? m.model,
          label: m.name ?? m.model,
        }));
      }

      return [];
    },
    onSuccess: (models) => {
      setFetchedModels(models);
      setConnected(true);
    },
    onError: (err: Error) => {
      setConnectError(err.message);
      setConnected(false);
      setFetchedModels([]);
    },
  });

  const handlePresetChange = (slug: string) => {
    setSelectedPreset(slug);
    const p = PROVIDER_PRESETS.find((pr) => pr.slug === slug);
    setBaseUrl(p?.baseUrl ?? "");
    setConnected(false);
    setFetchedModels([]);
    setConnectError(null);
    setApiKey("");
  };

  const isModelAllowed = (modelId: string) => {
    if (allowedModels === null) return true; // null = all allowed
    return allowedModels.includes(modelId);
  };

  const toggleModel = (modelId: string) => {
    if (allowedModels === null) {
      // Switch from "all" to explicit with this one removed
      onModelsChange(fetchedModels.filter((m) => m.id !== modelId).map((m) => m.id));
    } else if (allowedModels.includes(modelId)) {
      const next = allowedModels.filter((id) => id !== modelId);
      onModelsChange(next.length === 0 ? null : next);
    } else {
      onModelsChange([...allowedModels, modelId]);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-indigo-500/20 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-indigo-500" />
        <h4 className="text-sm font-medium">HTTP Endpoint Model Discovery</h4>
      </div>

      {/* Provider Preset */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Provider Preset</label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a provider...</option>
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label}</option>
          ))}
        </select>
      </div>

      {selectedPreset && (
        <>
          {/* Base URL */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">API Endpoint URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={disabled || !isUrlEditable}
              placeholder="https://api.example.com/v1"
              className={cn(
                "w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono",
                !isUrlEditable && "opacity-60"
              )}
            />
          </div>

          {/* API Key */}
          {needsKey && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={disabled}
                placeholder="sk-..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Used only to fetch models — not stored. For agent runtime, configure API keys in the agent's adapter settings or Secrets.
              </p>
            </div>
          )}

          {/* Connect Button */}
          <button
            onClick={() => connectMutation.mutate()}
            disabled={disabled || connectMutation.isPending || (needsKey && !apiKey && selectedPreset !== "ollama_local")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              connected
                ? "bg-green-600 text-white"
                : "bg-indigo-600 text-white hover:bg-indigo-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {connectMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
            ) : connected ? (
              <><Check className="h-4 w-4" /> Connected — {fetchedModels.length} models</>
            ) : (
              <><Zap className="h-4 w-4" /> Connect & Fetch Models</>
            )}
          </button>

          {/* Error */}
          {connectError && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
              <X className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{connectError}</span>
            </div>
          )}

          {/* Model List with Toggles */}
          {fetchedModels.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-auto rounded-md border border-border p-2">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground border-b border-border mb-1">
                <span>Model ID</span>
                <span>Allowed</span>
              </div>
              {fetchedModels.map((model) => {
                const allowed = isModelAllowed(model.id);
                return (
                  <div
                    key={model.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/30 text-sm"
                  >
                    <span className="font-mono text-xs truncate flex-1 mr-2">{model.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleModel(model.id)}
                      disabled={disabled}
                      className={cn(
                        "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
                        allowed ? "bg-green-600" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                        allowed ? "translate-x-3.5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
