/**
 * Agent OS Settings — LLM provider configuration.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TestTube, Check, X, Star, Zap } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { llmProvidersApi, type LlmProviderConfig, type AvailableProvider } from "../api/llmProviders";

export function AgentOSSettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ["llm-providers", companyId],
    queryFn: () => llmProvidersApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: available = [] } = useQuery({
    queryKey: ["llm-providers-available"],
    queryFn: () => llmProvidersApi.listAvailable(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => llmProvidersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["llm-providers"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => llmProvidersApi.test(id),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => llmProvidersApi.update(id, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["llm-providers"] }),
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Agent OS Settings</h1>
            <p className="text-sm text-muted-foreground">Configure LLM providers and preferences</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Provider
          </button>
        </div>

        {/* Provider List */}
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onTest={() => testMutation.mutate(p.id)}
              testResult={testMutation.variables === p.id ? testMutation.data : undefined}
              isTesting={testMutation.isPending && testMutation.variables === p.id}
              onDelete={() => deleteMutation.mutate(p.id)}
              onSetDefault={() => defaultMutation.mutate(p.id)}
            />
          ))}

          {providers.length === 0 && !showAdd && (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No providers configured yet</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-2 text-indigo-500 hover:text-indigo-400 text-sm"
              >
                Add your first provider
              </button>
            </div>
          )}
        </div>

        {/* Add Provider Form */}
        {showAdd && companyId && (
          <AddProviderForm
            companyId={companyId}
            available={available}
            onDone={() => {
              setShowAdd(false);
              queryClient.invalidateQueries({ queryKey: ["llm-providers"] });
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onTest,
  testResult,
  isTesting,
  onDelete,
  onSetDefault,
}: {
  provider: LlmProviderConfig;
  onTest: () => void;
  testResult?: { ok: boolean; error?: string };
  isTesting: boolean;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{provider.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {provider.providerSlug}
              </span>
              {provider.isDefault && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                  <Star className="h-3 w-3 inline mr-1" />default
                </span>
              )}
            </div>
            {provider.baseUrl && (
              <span className="text-xs text-muted-foreground">{provider.baseUrl}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground"
            title="Test connection"
          >
            {isTesting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            ) : testResult ? (
              testResult.ok ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
          </button>
          {!provider.isDefault && (
            <button
              onClick={onSetDefault}
              className="p-2 rounded-md hover:bg-accent text-muted-foreground"
              title="Set as default"
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProviderForm({
  companyId,
  available,
  onDone,
  onCancel,
}: {
  companyId: string;
  available: AvailableProvider[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      llmProvidersApi.create(companyId, {
        providerSlug: slug,
        label: label || available.find((a) => a.slug === slug)?.label || slug,
        baseUrl: baseUrl || undefined,
        isDefault: false,
      }),
    onSuccess: () => onDone(),
  });

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-card p-4 space-y-4">
      <h3 className="font-medium">Add LLM Provider</h3>

      <div>
        <label className="text-sm text-muted-foreground block mb-1">Provider</label>
        <select
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            const found = available.find((a) => a.slug === e.target.value);
            if (found) setLabel(found.label);
            if (e.target.value === "ollama") setBaseUrl("http://localhost:11434/v1");
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select provider...</option>
          {available.map((a) => (
            <option key={a.slug} value={a.slug}>{a.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-muted-foreground block mb-1">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My OpenAI Account"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {slug !== "ollama" && (
        <p className="text-xs text-muted-foreground">
          API key: After adding, go to Secrets to store your API key, then link it here.
        </p>
      )}

      {(slug === "ollama" || slug === "openrouter") && (
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={slug === "ollama" ? "http://localhost:11434/v1" : "https://openrouter.ai/api/v1"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-2 rounded-md text-sm hover:bg-accent">
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!slug || createMutation.isPending}
          className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Adding..." : "Add Provider"}
        </button>
      </div>
    </div>
  );
}
