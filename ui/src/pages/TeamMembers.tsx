/**
 * Agent Access Manager — assign permission policies to agents.
 * Replaces the user-centric "Team Members" page.
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Lock, CheckCircle, XCircle } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { agentsApi } from "../api/agents";
import { permissionPoliciesApi } from "../api/permissionPolicies";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";
import { Link } from "@/lib/router";
import type { PermissionPolicy } from "@titanclip/shared";

const STATUS_DOT: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-emerald-400",
  idle: "bg-emerald-400",
  paused: "bg-amber-400",
  error: "bg-red-400",
};

export function TeamMembers() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const cid = selectedCompanyId!;

  useEffect(() => { setBreadcrumbs([{ label: "Agent Access" }]); }, [setBreadcrumbs]);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["permission-policies"],
    queryFn: () => permissionPoliciesApi.list(),
  });

  const activeAgents = agents.filter((a) => a.status !== "terminated");
  const policyMap = new Map<string, PermissionPolicy>(policies.map((p) => [p.id, p]));

  const assignPolicyMut = useMutation({
    mutationFn: ({ agentId, policyId }: { agentId: string; policyId: string | null }) =>
      agentsApi.assignPolicy(agentId, policyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(cid) });
      pushToast({ title: "Policy updated", tone: "success", ttlMs: 2000 });
    },
  });

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" /> Agent Access Control
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage permission policies assigned to agents in {selectedCompany?.name ?? "this team"}.
        </p>
      </div>

      {/* Policy Summary */}
      {policies.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {policies.map((p) => {
            const agentCount = activeAgents.filter((a) => (a as any).permissionPolicyId === p.id).length;
            return (
              <div key={p.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.canCreateIssues && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Tasks</span>}
                  {p.canAccessVault && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">Vault</span>}
                  {p.canCreateAgents && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Agents</span>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{agentCount} agent{agentCount !== 1 ? "s" : ""}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent List with Policy Assignment */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Agents ({activeAgents.length})
        </h2>

        {activeAgents.length === 0 && (
          <div className="text-center py-8 border border-dashed border-border/50 rounded-2xl">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No agents in this team</p>
          </div>
        )}

        <div className="space-y-2">
          {activeAgents.map((agent) => {
            const policyId = (agent as any).permissionPolicyId;
            const policy = policyId ? policyMap.get(policyId) : null;
            return (
              <Link key={agent.id} to={`/agents/${agent.id}`}
                className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/10 transition-colors">
                <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", STATUS_DOT[agent.status] ?? "bg-zinc-500")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {roleLabels[agent.role] ?? agent.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {agent.adapterType} · {agent.status}
                  </p>
                </div>
                <div className="shrink-0" onClick={(e) => e.preventDefault()}>
                  <select
                    value={policyId ?? ""}
                    onChange={(e) => { e.preventDefault(); e.stopPropagation(); assignPolicyMut.mutate({ agentId: agent.id, policyId: e.target.value || null }); }}
                    className="rounded-lg border bg-background px-2 py-1 text-[11px] min-w-[140px]"
                  >
                    <option value="">No policy</option>
                    {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {policy ? (
                    <>
                      {policy.canCreateIssues ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-red-400/50" />}
                      {policy.canAccessVault ? <CheckCircle className="h-3 w-3 text-purple-400" /> : <XCircle className="h-3 w-3 text-red-400/50" />}
                    </>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">Full access</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border/30 pt-3">
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400" /> Tasks</span>
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-purple-400" /> Vault</span>
        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-400/50" /> Denied</span>
        <span>Policies are assigned via agent templates in Admin Settings</span>
      </div>
    </div>
  );
}
