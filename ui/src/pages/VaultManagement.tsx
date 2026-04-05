import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, Plus, Pencil, Trash2, RotateCcw, Shield,
  Clock, Users, Lock, Eye, EyeOff,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { vaultApi } from "../api/vault";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";
import type { VaultCredential } from "@titanclip/shared";

const PROVIDERS = ["github", "aws", "gcp", "azure", "npm", "docker", "custom"] as const;
const CREDENTIAL_TYPES = ["api_key", "ssh_key", "oauth_token", "service_account", "custom"] as const;

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function VaultManagement() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const cid = selectedCompanyId!;

  const [showForm, setShowForm] = useState(false);
  const [showRotate, setShowRotate] = useState<string | null>(null);
  const [showValue, setShowValue] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<string>("custom");
  const [credType, setCredType] = useState<string>("api_key");
  const [envVarName, setEnvVarName] = useState("");
  const [value, setValue] = useState("");
  const [tokenTtl, setTokenTtl] = useState(3600);
  const [maxCheckouts, setMaxCheckouts] = useState(5);
  const [rotationPolicy, setRotationPolicy] = useState<string>("manual");
  const [rotationDays, setRotationDays] = useState<number | null>(null);
  const [newRotateValue, setNewRotateValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { setBreadcrumbs([{ label: "Vault" }]); }, [setBreadcrumbs]);

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["vault", cid],
    queryFn: () => vaultApi.list(cid),
    enabled: !!cid,
    refetchInterval: 15_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const createMut = useMutation({
    mutationFn: (input: any) => vaultApi.create(cid, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault", cid] });
      pushToast({ title: "Credential created", tone: "success" });
      resetForm();
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => vaultApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault", cid] });
      pushToast({ title: "Credential revoked", tone: "warn" });
    },
  });

  const rotateMut = useMutation({
    mutationFn: ({ id, newValue }: { id: string; newValue: string }) => vaultApi.rotate(id, newValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault", cid] });
      pushToast({ title: "Credential rotated", tone: "success" });
      setShowRotate(null);
      setNewRotateValue("");
    },
    onError: (e) => setFormError((e as Error).message),
  });

  function resetForm() {
    setShowForm(false); setName(""); setDescription(""); setProvider("custom");
    setCredType("api_key"); setEnvVarName(""); setValue(""); setTokenTtl(3600);
    setMaxCheckouts(5); setRotationPolicy("manual"); setRotationDays(null);
    setFormError(null); setShowValue(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) { setFormError("Name is required"); return; }
    if (!envVarName.trim()) { setFormError("Environment variable name is required"); return; }
    if (!value.trim()) { setFormError("Secret value is required"); return; }
    createMut.mutate({
      name: name.trim(), description, provider, credentialType: credType,
      envVarName: envVarName.trim(), value: value.trim(),
      tokenTtlSeconds: tokenTtl, maxConcurrentCheckouts: maxCheckouts,
      rotationPolicy, rotationIntervalDays: rotationDays,
    });
  }

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-400" /> Credential Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage encrypted credentials for agent runtime. Agents receive timed tokens, never raw secrets.
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Credential
        </Button>
      </div>

      {/* Credential List */}
      {isLoading && <p className="text-sm text-muted-foreground">Loading vault...</p>}
      {credentials.length === 0 && !isLoading && !showForm && (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl">
          <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No credentials in the vault</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add API keys, tokens, and secrets for your agents</p>
        </div>
      )}

      <div className="space-y-3">
        {credentials.map((cred) => (
          <div key={cred.id} className="rounded-2xl border border-border/50 p-4 hover:bg-muted/10 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-semibold">{cred.name}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                    cred.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                    cred.status === "expired" ? "bg-red-500/10 text-red-400" :
                    cred.status === "revoked" ? "bg-zinc-500/10 text-zinc-400" :
                    "bg-amber-500/10 text-amber-400"
                  )}>{cred.status}</span>
                </div>
                {cred.description && <p className="text-xs text-muted-foreground ml-6 mb-2">{cred.description}</p>}
                <div className="flex flex-wrap gap-3 ml-6 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {cred.provider}</span>
                  <span>{cred.credentialType.replace(/_/g, " ")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> TTL: {cred.tokenTtlSeconds < 3600 ? `${cred.tokenTtlSeconds / 60}m` : `${cred.tokenTtlSeconds / 3600}h`}</span>
                  <span>Max: {cred.maxConcurrentCheckouts} concurrent</span>
                  <span>{cred.totalCheckouts} checkouts</span>
                  {cred.lastCheckedOutAt && <span>Last: {timeAgo(cred.lastCheckedOutAt)}</span>}
                </div>
                {cred.rotationPolicy === "auto" && cred.rotationIntervalDays && (
                  <p className="text-[10px] text-amber-400 ml-6 mt-1 flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> Auto-rotate every {cred.rotationIntervalDays} days
                    {cred.lastRotatedAt && ` · Last: ${timeAgo(cred.lastRotatedAt)}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-3">
                <Button variant="ghost" size="sm" onClick={() => { setShowRotate(cred.id); setNewRotateValue(""); }}
                  disabled={cred.status !== "active"} className="h-7 px-2 gap-1 text-xs text-indigo-400">
                  <RotateCcw className="h-3 w-3" /> Rotate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Revoke "${cred.name}"? This cannot be undone.`)) revokeMut.mutate(cred.id); }}
                  disabled={cred.status === "revoked"} className="h-7 px-2 gap-1 text-xs text-destructive">
                  <Trash2 className="h-3 w-3" /> Revoke
                </Button>
              </div>
            </div>

            {/* Rotate inline form */}
            {showRotate === cred.id && (
              <div className="mt-3 ml-6 flex items-end gap-2 p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">New Secret Value</Label>
                  <Input type="password" value={newRotateValue} onChange={(e) => setNewRotateValue(e.target.value)} placeholder="Enter new value..." />
                </div>
                <Button size="sm" onClick={() => rotateMut.mutate({ id: cred.id, newValue: newRotateValue })}
                  disabled={!newRotateValue.trim() || rotateMut.isPending}>
                  {rotateMut.isPending ? "Rotating..." : "Rotate"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRotate(null)}>Cancel</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border p-5 bg-card">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New Credential</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GitHub Deploy Key" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Environment Variable *</Label>
              <Input value={envVarName} onChange={(e) => setEnvVarName(e.target.value.toUpperCase())} placeholder="e.g. GITHUB_TOKEN" className="font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Provider</Label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
                {PROVIDERS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Credential Type</Label>
              <select value={credType} onChange={(e) => setCredType(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
                {CREDENTIAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Secret Value *</Label>
            <div className="relative">
              <Input type={showValue ? "text" : "password"} value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" className="font-mono pr-10" />
              <button type="button" onClick={() => setShowValue(!showValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Will be encrypted with AES-256-GCM. Agents receive timed tokens, never the raw value.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this credential is used for" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Token TTL (seconds)</Label>
              <Input type="number" value={tokenTtl} onChange={(e) => setTokenTtl(Number(e.target.value))} min={60} max={86400} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Concurrent Checkouts</Label>
              <Input type="number" value={maxCheckouts} onChange={(e) => setMaxCheckouts(Number(e.target.value))} min={1} max={100} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rotation Policy</Label>
              <select value={rotationPolicy} onChange={(e) => setRotationPolicy(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2 text-sm">
                <option value="manual">Manual</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>

          {rotationPolicy === "auto" && (
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Rotation Interval (days)</Label>
              <Input type="number" value={rotationDays ?? ""} onChange={(e) => setRotationDays(Number(e.target.value) || null)} min={1} max={365} placeholder="e.g. 30" />
            </div>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Encrypting..." : "Add to Vault"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
