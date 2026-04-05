import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, HardDrive, Clock, Shield, Plus, X, FolderGit } from "lucide-react";
import { adminSettingsApi } from "@/api/adminSettings";
import { useAdminSession } from "../context/AdminSessionContext";
import { AdminPinDialog } from "../components/AdminPinDialog";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";

export function InstanceWorkspaceGovernance() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { isUnlocked, token, lock } = useAdminSession();
  const { pushToast } = useToast();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [newBranch, setNewBranch] = useState("");

  useEffect(() => { setBreadcrumbs([{ label: "Instance Settings" }, { label: "Workspaces" }]); }, [setBreadcrumbs]);

  const adminQuery = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
  });

  const updateMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => adminSettingsApi.update(patch as any, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminSettings });
      pushToast({ title: "Workspace policy updated", tone: "success", ttlMs: 2000 });
    },
  });

  const data = adminQuery.data;
  const allowedRepos = (data as any)?.allowedGitRepos as string[] | null ?? null;
  const protectedBranches = (data as any)?.protectedBranches as string[] ?? ["main", "master"];
  const cleanupHours = (data as any)?.workspaceAutoCleanupHours as number ?? 24;
  const maxDiskMb = (data as any)?.maxWorkspaceDiskMb as number ?? 5120;

  function addRepo() {
    if (!newRepo.trim()) return;
    const next = [...(allowedRepos ?? []), newRepo.trim()];
    updateMut.mutate({ allowedGitRepos: next });
    setNewRepo("");
  }

  function removeRepo(repo: string) {
    const next = (allowedRepos ?? []).filter((r) => r !== repo);
    updateMut.mutate({ allowedGitRepos: next.length > 0 ? next : null });
  }

  function addBranch() {
    if (!newBranch.trim()) return;
    const next = [...protectedBranches, newBranch.trim()];
    updateMut.mutate({ protectedBranches: next });
    setNewBranch("");
  }

  function removeBranch(branch: string) {
    updateMut.mutate({ protectedBranches: protectedBranches.filter((b) => b !== branch) });
  }

  if (adminQuery.isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderGit className="h-5 w-5" /> Workspace Governance
          </h2>
          <p className="text-sm text-muted-foreground">Control workspace access, branch protection, and resource limits for agent execution.</p>
        </div>
        {isUnlocked ? (
          <Button variant="outline" size="sm" onClick={lock} className="gap-2">
            <Shield className="h-4 w-4" /> Lock
          </Button>
        ) : (
          <Button size="sm" onClick={() => setPinDialogOpen(true)} className="gap-2">
            <Shield className="h-4 w-4" /> Unlock
          </Button>
        )}
      </div>

      <div className={cn(!isUnlocked && "opacity-50 pointer-events-none select-none")}>
        {/* Allowed Git Repositories */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" /> Allowed Git Repositories
            </h3>
            {allowedRepos === null && <span className="text-[10px] text-emerald-400">All repos allowed</span>}
          </div>
          <p className="text-xs text-muted-foreground">Restrict which git repositories agents can clone and work in. Leave empty to allow all.</p>

          {allowedRepos && allowedRepos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allowedRepos.map((repo) => (
                <span key={repo} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono">
                  {repo}
                  <button onClick={() => removeRepo(repo)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input value={newRepo} onChange={(e) => setNewRepo(e.target.value)} placeholder="github.com/org/repo"
              className="flex-1 text-xs font-mono" onKeyDown={(e) => e.key === "Enter" && addRepo()} />
            <Button size="sm" variant="outline" onClick={addRepo} disabled={!newRepo.trim()}><Plus className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Protected Branches */}
        <div className="rounded-lg border p-4 space-y-3 mt-4">
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            <Shield className="h-4 w-4" /> Protected Branches
          </h3>
          <p className="text-xs text-muted-foreground">Agents cannot push directly to these branches. They must create feature branches instead.</p>

          <div className="flex flex-wrap gap-2">
            {protectedBranches.map((branch) => (
              <span key={branch} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-400">
                {branch}
                <button onClick={() => removeBranch(branch)} className="text-amber-400/50 hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="e.g. production, staging"
              className="flex-1 text-xs font-mono" onKeyDown={(e) => e.key === "Enter" && addBranch()} />
            <Button size="sm" variant="outline" onClick={addBranch} disabled={!newBranch.trim()}><Plus className="h-3 w-3" /></Button>
          </div>
        </div>

        {/* Resource Limits */}
        <div className="rounded-lg border p-4 space-y-3 mt-4">
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            <HardDrive className="h-4 w-4" /> Resource Limits
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Auto-Cleanup (hours)</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Workspaces auto-teardown after this many hours of inactivity. 0 = no auto-cleanup.</p>
              <Input type="number" value={cleanupHours} min={0} max={720}
                onChange={(e) => updateMut.mutate({ workspaceAutoCleanupHours: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><HardDrive className="h-3 w-3" /> Max Disk (MB)</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Maximum disk space per workspace. 0 = unlimited.</p>
              <Input type="number" value={maxDiskMb} min={0} max={102400}
                onChange={(e) => updateMut.mutate({ maxWorkspaceDiskMb: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </div>

      <AdminPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
    </div>
  );
}
