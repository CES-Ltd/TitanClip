/**
 * UserCredentials — user-managed development credentials.
 *
 * Users can add GitHub PATs, SSH keys, NPM tokens, Docker credentials, etc.
 * Cloud LLM API keys are blocked — those require admin access.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, ShieldAlert, Github } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { userCredentialsApi, type UserCredential, type CredentialOptions } from "../api/userCredentials";

const PROVIDER_ICONS: Record<string, string> = {
  github: "GH",
  gitlab: "GL",
  bitbucket: "BB",
  npm: "npm",
  docker: "DK",
  ollama_local: "OL",
  custom: "API",
};

const PROVIDER_COLORS: Record<string, string> = {
  github: "bg-gray-700 text-white",
  gitlab: "bg-orange-600 text-white",
  bitbucket: "bg-blue-600 text-white",
  npm: "bg-red-600 text-white",
  docker: "bg-blue-500 text-white",
  ollama_local: "bg-purple-600 text-white",
  custom: "bg-slate-600 text-white",
};

export function UserCredentials() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: credentials = [] } = useQuery({
    queryKey: ["user-credentials", companyId],
    queryFn: () => userCredentialsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: options } = useQuery({
    queryKey: ["user-credential-options"],
    queryFn: () => userCredentialsApi.options(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => userCredentialsApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-credentials"] }),
  });

  const activeCreds = credentials.filter((c) => c.status === "active");
  const revokedCreds = credentials.filter((c) => c.status === "revoked");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Key className="h-5 w-5" />
              My Credentials
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your development credentials — GitHub tokens, SSH keys, registry access, and more.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Credential
          </button>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-400/80">
            <strong>Security policy:</strong> LLM API keys (OpenAI, Anthropic, Google, Azure, etc.)
            must be configured by an administrator through the Vault. Only development credentials
            (GitHub, GitLab, NPM, Docker, SSH, local endpoints) can be managed here.
          </div>
        </div>

        {/* Add form */}
        {showAdd && companyId && options && (
          <AddCredentialForm
            companyId={companyId}
            options={options}
            onDone={() => {
              setShowAdd(false);
              queryClient.invalidateQueries({ queryKey: ["user-credentials"] });
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {/* Active credentials */}
        <div className="space-y-3">
          {activeCreds.map((cred) => (
            <CredentialCard key={cred.id} credential={cred} onRevoke={() => revokeMutation.mutate(cred.id)} />
          ))}
          {activeCreds.length === 0 && !showAdd && (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No credentials configured</p>
              <button onClick={() => setShowAdd(true)} className="mt-2 text-indigo-500 hover:text-indigo-400 text-sm">
                Add your first credential
              </button>
            </div>
          )}
        </div>

        {/* Revoked */}
        {revokedCreds.length > 0 && (
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer">
              {revokedCreds.length} revoked credential{revokedCreds.length > 1 ? "s" : ""}
            </summary>
            <div className="space-y-2 mt-2 opacity-60">
              {revokedCreds.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card/50 p-3 flex items-center gap-3">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c.provider}</span>
                  <span className="text-sm line-through">{c.name}</span>
                  <span className="text-xs text-red-400 ml-auto">Revoked</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function CredentialCard({ credential, onRevoke }: { credential: UserCredential; onRevoke: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${PROVIDER_COLORS[credential.provider] ?? "bg-muted text-muted-foreground"}`}>
          {PROVIDER_ICONS[credential.provider] ?? "?"}
        </div>
        <div>
          <div className="font-medium text-sm">{credential.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{credential.provider}</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{credential.credentialType}</span>
            {credential.description && <span>— {credential.description}</span>}
          </div>
        </div>
      </div>
      <button
        onClick={onRevoke}
        className="p-2 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
        title="Revoke credential"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddCredentialForm({
  companyId, options, onDone, onCancel,
}: {
  companyId: string;
  options: CredentialOptions;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [credType, setCredType] = useState("access_token");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => userCredentialsApi.create(companyId, { name, provider, credentialType: credType, description }),
    onSuccess: onDone,
    onError: (err: any) => setError(err?.body?.error ?? err?.message ?? "Failed to create"),
  });

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-card p-4 space-y-3">
      <h3 className="font-medium text-sm">Add Development Credential</h3>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Provider</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Select provider...</option>
          {options.providers.map((p) => (
            <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Credential Type</label>
        <select value={credType} onChange={(e) => setCredType(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          {options.credentialTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., GitHub PAT (work)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this credential is for"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">{error}</div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-2 rounded-md text-sm hover:bg-accent">Cancel</button>
        <button onClick={() => { setError(null); createMutation.mutate(); }}
          disabled={!provider || !name || createMutation.isPending}
          className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {createMutation.isPending ? "Creating..." : "Add Credential"}
        </button>
      </div>
    </div>
  );
}
