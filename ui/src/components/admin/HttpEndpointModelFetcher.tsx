/**
 * HttpEndpointModelFetcher — named HTTP adapter management.
 *
 * Users can:
 * 1. Create named adapters by selecting a provider, connecting, picking models, and saving
 * 2. View saved adapters with enable/disable toggles
 * 3. Toggle "Use in Paperclip Agent" for each adapter
 * 4. Delete saved adapters
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Zap, Loader2, Check, X, Plus, Trash2, Save } from "lucide-react";
import { cn } from "../../lib/utils";
import { api } from "../../api/client";
interface HttpAdapter {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  enabled: boolean;
  createdAt: string;
}

const PROVIDER_PRESETS = [
  { slug: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", keyRequired: true },
  { slug: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com", keyRequired: true },
  { slug: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", keyRequired: true },
  { slug: "azure", label: "Azure Foundry API", baseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}/", keyRequired: true },
  { slug: "vertex", label: "Vertex AI", baseUrl: "https://{region}-aiplatform.googleapis.com/v1beta1/", keyRequired: true },
  { slug: "ollama_cloud", label: "Ollama Cloud", baseUrl: "https://ollama.com/v1", keyRequired: true },
  { slug: "ollama_local", label: "Ollama Local", baseUrl: "http://localhost:11434/v1", keyRequired: false },
  { slug: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyRequired: true },
  { slug: "custom", label: "Custom Endpoint", baseUrl: "", keyRequired: true },
];

const PROVIDER_COLORS: Record<string, string> = {
  openai: "border-l-green-500",
  anthropic: "border-l-orange-500",
  gemini: "border-l-blue-500",
  azure: "border-l-sky-500",
  vertex: "border-l-purple-500",
  ollama_cloud: "border-l-pink-500",
  ollama_local: "border-l-pink-400",
  openrouter: "border-l-indigo-500",
  custom: "border-l-muted-foreground",
};

interface FetchedModel {
  id: string;
  label: string;
}

interface HttpEndpointModelFetcherProps {
  /** Saved HTTP adapters from admin settings */
  httpAdapters: HttpAdapter[];
  /** Callback to save the full list of adapters */
  onAdaptersChange: (adapters: HttpAdapter[]) => void;
  /** Whether mutations are in progress */
  disabled?: boolean;
}

export function HttpEndpointModelFetcher({ httpAdapters, onAdaptersChange, disabled }: HttpEndpointModelFetcherProps) {
  const [showForm, setShowForm] = useState(false);
  const [adapterName, setAdapterName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const preset = PROVIDER_PRESETS.find((p) => p.slug === selectedPreset);
  const needsKey = preset?.keyRequired ?? true;

  const connectMutation = useMutation({
    mutationFn: async () => {
      setConnectError(null);
      const effectiveUrl = baseUrl || preset?.baseUrl || "";
      if (!effectiveUrl) throw new Error("Base URL is required");

      const data: any = await api.post("/llm-proxy/models", {
        baseUrl: effectiveUrl,
        apiKey: apiKey || undefined,
        provider: selectedPreset || undefined,
      });

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => ({
          id: m.id ?? m.name,
          label: m.id ?? m.name,
        })).slice(0, 100) as FetchedModel[];
      }
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: any) => ({
          id: m.name ?? m.model,
          label: m.name ?? m.model,
        })) as FetchedModel[];
      }
      return [] as FetchedModel[];
    },
    onSuccess: (models) => {
      setFetchedModels(models);
      setConnected(true);
      // Select all models by default
      setSelectedModels(new Set(models.map((m) => m.id)));
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
    setSelectedModels(new Set());
    setConnectError(null);
    setApiKey("");
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const handleSave = () => {
    if (!adapterName.trim()) return;
    if (selectedModels.size === 0) return;

    const newAdapter: HttpAdapter = {
      id: crypto.randomUUID(),
      name: adapterName.trim(),
      provider: selectedPreset || "custom",
      baseUrl: baseUrl || preset?.baseUrl || "",
      apiKey: apiKey || undefined,
      models: Array.from(selectedModels),
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    onAdaptersChange([...httpAdapters, newAdapter]);
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setAdapterName("");
    setSelectedPreset("");
    setApiKey("");
    setBaseUrl("");
    setFetchedModels([]);
    setSelectedModels(new Set());
    setConnected(false);
    setConnectError(null);
  };

  const toggleAdapterEnabled = (id: string) => {
    onAdaptersChange(httpAdapters.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const deleteAdapter = (id: string) => {
    if (!window.confirm("Delete this adapter?")) return;
    onAdaptersChange(httpAdapters.filter((a) => a.id !== id));
  };

  const canSave = adapterName.trim().length > 0 && connected && selectedModels.size > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-medium">HTTP Adapters</h4>
          <span className="text-xs text-muted-foreground">({httpAdapters.length})</span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Adapter
          </button>
        )}
      </div>

      {/* ── Saved Adapters List ─────────────────────────────────────────── */}
      {httpAdapters.length > 0 && (
        <div className="space-y-2">
          {httpAdapters.map((adapter) => {
            const providerLabel = PROVIDER_PRESETS.find((p) => p.slug === adapter.provider)?.label ?? adapter.provider;
            const colorClass = PROVIDER_COLORS[adapter.provider] ?? "border-l-muted-foreground";
            return (
              <div
                key={adapter.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-3 border-l-4 flex items-center gap-3",
                  colorClass,
                  !adapter.enabled && "opacity-50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{adapter.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{providerLabel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {adapter.models.length} model{adapter.models.length !== 1 ? "s" : ""} · {adapter.baseUrl.slice(0, 40)}
                  </div>
                </div>

                {/* Enable/Disable toggle */}
                <button
                  type="button"
                  data-slot="toggle"
                  onClick={() => toggleAdapterEnabled(adapter.id)}
                  disabled={disabled}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                    adapter.enabled ? "bg-green-600" : "bg-muted"
                  )}
                  title={adapter.enabled ? "Enabled" : "Disabled"}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                    adapter.enabled ? "translate-x-4.5" : "translate-x-0.5"
                  )} />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteAdapter(adapter.id)}
                  disabled={disabled}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete adapter"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {httpAdapters.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No HTTP adapters configured. Click "Add Adapter" to connect an OpenAI-compatible endpoint.
        </div>
      )}

      {/* ── New Adapter Form ───────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-lg border border-indigo-500/20 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h5 className="text-sm font-medium">New HTTP Adapter</h5>
            <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>

          {/* Adapter Name */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Adapter Name *</label>
            <input
              value={adapterName}
              onChange={(e) => setAdapterName(e.target.value)}
              disabled={disabled}
              placeholder="e.g., Production OpenAI, Local Ollama"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Provider Preset */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
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
                  disabled={disabled}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
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
                </div>
              )}

              {/* Connect Button */}
              <button
                onClick={() => connectMutation.mutate()}
                disabled={disabled || connectMutation.isPending || (needsKey && !apiKey && selectedPreset !== "ollama_local")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  connected ? "bg-green-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700",
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

              {connectError && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
                  <X className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{connectError}</span>
                </div>
              )}

              {/* Model Selection (only after connection) */}
              {fetchedModels.length > 0 && (
                <>
                  <div className="space-y-1 max-h-48 overflow-auto rounded-md border border-border p-2">
                    <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground border-b border-border mb-1">
                      <span>Model</span>
                      <span>Enable</span>
                    </div>
                    {fetchedModels.map((model) => (
                      <div key={model.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/30 text-sm">
                        <span className="font-mono text-xs truncate flex-1 mr-2">{model.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleModelSelection(model.id)}
                          disabled={disabled}
                          className={cn(
                            "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
                            selectedModels.has(model.id) ? "bg-green-600" : "bg-muted"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                            selectedModels.has(model.id) ? "translate-x-3.5" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={disabled || !canSave}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full justify-center"
                  >
                    <Save className="h-4 w-4" />
                    Save Adapter "{adapterName || "..."}" ({selectedModels.size} models)
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
