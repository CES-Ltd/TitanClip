import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Pencil, Trash2, Shield } from "lucide-react";
import { permissionPoliciesApi } from "../api/permissionPolicies";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";
import type { PermissionPolicy } from "@titanclip/shared";

export function InstancePolicies() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PermissionPolicy | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [canCreateIssues, setCanCreateIssues] = useState(true);
  const [canUpdateIssues, setCanUpdateIssues] = useState(true);
  const [canDeleteIssues, setCanDeleteIssues] = useState(false);
  const [canCreateAgents, setCanCreateAgents] = useState(false);
  const [canManageSecrets, setCanManageSecrets] = useState(false);
  const [canAccessVault, setCanAccessVault] = useState(false);
  const [canApproveRequests, setCanApproveRequests] = useState(false);
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState(3);
  const [maxRunDuration, setMaxRunDuration] = useState(3600);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setBreadcrumbs([{ label: "Instance Settings" }, { label: "Policies" }]); }, [setBreadcrumbs]);

  const policiesQuery = useQuery({
    queryKey: ["permission-policies"],
    queryFn: () => permissionPoliciesApi.list(),
  });

  const createMut = useMutation({
    mutationFn: (input: any) => permissionPoliciesApi.create(input),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["permission-policies"] }); resetForm(); },
    onError: (e) => setError((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => permissionPoliciesApi.update(id, patch),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["permission-policies"] }); resetForm(); },
    onError: (e) => setError((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => permissionPoliciesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["permission-policies"] }),
  });

  function resetForm() {
    setShowForm(false); setEditing(null); setName(""); setDescription("");
    setCanCreateIssues(true); setCanUpdateIssues(true); setCanDeleteIssues(false);
    setCanCreateAgents(false); setCanManageSecrets(false); setCanAccessVault(false);
    setCanApproveRequests(false); setMaxConcurrentRuns(3); setMaxRunDuration(3600);
    setError(null);
  }

  function openEdit(p: PermissionPolicy) {
    setEditing(p); setName(p.name); setDescription(p.description);
    setCanCreateIssues(p.canCreateIssues); setCanUpdateIssues(p.canUpdateIssues);
    setCanDeleteIssues(p.canDeleteIssues); setCanCreateAgents(p.canCreateAgents);
    setCanManageSecrets(p.canManageSecrets); setCanAccessVault(p.canAccessVault);
    setCanApproveRequests(p.canApproveRequests); setMaxConcurrentRuns(p.maxConcurrentRuns);
    setMaxRunDuration(p.maxRunDurationSeconds); setShowForm(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required."); return; }
    const payload = {
      name: name.trim(), description, canCreateIssues, canUpdateIssues, canDeleteIssues,
      canCreateAgents, canManageSecrets, canAccessVault, canApproveRequests,
      maxConcurrentRuns, maxRunDurationSeconds: maxRunDuration,
    };
    if (editing) updateMut.mutate({ id: editing.id, patch: payload });
    else createMut.mutate(payload as any);
  }

  const policies = policiesQuery.data ?? [];
  const permLabels = [
    { key: "canCreateIssues", label: "Create Tasks", val: canCreateIssues, set: setCanCreateIssues },
    { key: "canUpdateIssues", label: "Update Tasks", val: canUpdateIssues, set: setCanUpdateIssues },
    { key: "canDeleteIssues", label: "Delete Tasks", val: canDeleteIssues, set: setCanDeleteIssues },
    { key: "canCreateAgents", label: "Create Agents", val: canCreateAgents, set: setCanCreateAgents },
    { key: "canManageSecrets", label: "Manage Secrets", val: canManageSecrets, set: setCanManageSecrets },
    { key: "canAccessVault", label: "Access Vault", val: canAccessVault, set: setCanAccessVault },
    { key: "canApproveRequests", label: "Approve Requests", val: canApproveRequests, set: setCanApproveRequests },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Lock className="h-5 w-5" /> Permission Policies</h2>
          <p className="text-sm text-muted-foreground">Define access control policies that can be assigned to agent templates.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1">
          <Plus className="h-3 w-3" /> New Policy
        </Button>
      </div>

      {/* Policy List */}
      {policies.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground text-center py-8">No policies created yet.</p>
      )}
      <div className="space-y-2">
        {policies.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">{p.companyId ? "Team" : "Instance"}</span>
              </div>
              {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate ml-5">{p.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-1.5 ml-5">
                {p.canCreateIssues && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Tasks</span>}
                {p.canCreateAgents && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Agents</span>}
                {p.canAccessVault && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Vault</span>}
                {p.canApproveRequests && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Approvals</span>}
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Max {p.maxConcurrentRuns} runs</span>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }} className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Policy Form */}
      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border p-4 bg-background">
          <h3 className="text-sm font-medium">{editing ? "Edit Policy" : "New Policy"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read-Only Engineer" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this policy allows" />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Permissions</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {permLabels.map(({ key, label, val, set }) => (
                <label key={key} className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
                  val ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border text-muted-foreground",
                )}>
                  <input type="checkbox" checked={val} onChange={() => set(!val)} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Max Concurrent Runs</Label>
              <Input type="number" value={maxConcurrentRuns} onChange={(e) => setMaxConcurrentRuns(Number(e.target.value))} min={1} max={50} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Run Duration (seconds)</Label>
              <Input type="number" value={maxRunDuration} onChange={(e) => setMaxRunDuration(Number(e.target.value))} min={60} max={86400} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
