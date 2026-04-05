import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal, Users, Zap, ClipboardList, Shield, Activity,
  CheckCircle, XCircle, AlertTriangle, Clock, DollarSign,
  ShieldAlert, ArrowRight, Play, KeyRound, Lock, Heart,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialog } from "../context/DialogContext";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { activityApi } from "../api/activity";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { dashboardApi } from "../api/dashboard";
import { costsApi } from "../api/costs";
import { budgetsApi } from "../api/budgets";
import { queryKeys } from "../lib/queryKeys";
import { ApprovalCard as ApprovalActionCard } from "../components/ApprovalActionCard";
import { vaultApi } from "../api/vault";
import { performanceApi } from "../api/performance";
import { slaApi } from "../api/sla";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { useToast } from "../context/ToastContext";
import { roleLabels } from "../components/agent-config-primitives";
import type { ActivityEvent } from "@titanclip/shared";

// Action meta for activity feed
const ACTION_META: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  "agent.created": { icon: Users, color: "text-emerald-400", label: "Agent created" },
  "agent.updated": { icon: Users, color: "text-blue-400", label: "Agent updated" },
  "agent.paused": { icon: AlertTriangle, color: "text-amber-400", label: "Agent paused" },
  "agent.resumed": { icon: Zap, color: "text-emerald-400", label: "Agent resumed" },
  "agent.terminated": { icon: XCircle, color: "text-red-400", label: "Agent terminated" },
  "issue.created": { icon: ClipboardList, color: "text-blue-400", label: "Task created" },
  "issue.updated": { icon: ClipboardList, color: "text-indigo-400", label: "Task updated" },
  "issue.status_changed": { icon: CheckCircle, color: "text-emerald-400", label: "Status changed" },
  "heartbeat.run.started": { icon: Zap, color: "text-cyan-400", label: "Run started" },
  "heartbeat.run.completed": { icon: CheckCircle, color: "text-emerald-400", label: "Run completed" },
  "heartbeat.run.failed": { icon: XCircle, color: "text-red-400", label: "Run failed" },
  "approval.created": { icon: Shield, color: "text-amber-400", label: "Approval requested" },
  "approval.approved": { icon: CheckCircle, color: "text-emerald-400", label: "Approved" },
  "approval.rejected": { icon: XCircle, color: "text-red-400", label: "Rejected" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { icon: Activity, color: "text-muted-foreground", label: action.replace(/[._]/g, " ") };
}

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_DOT: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-emerald-400",
  idle: "bg-emerald-400",
  paused: "bg-amber-400",
  error: "bg-red-400",
  pending_approval: "bg-amber-400",
  terminated: "bg-zinc-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-blue-400",
  low: "text-zinc-400",
};

export function CommandCenter() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialog();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => { setBreadcrumbs([{ label: "Command Center" }]); }, [setBreadcrumbs]);

  const [activeView, setActiveView] = useState<"ops" | "iam">("ops");
  const cid = selectedCompanyId!;

  // Data queries
  const { data: agents = [] } = useQuery({ queryKey: queryKeys.agents.list(cid), queryFn: () => agentsApi.list(cid), enabled: !!cid, refetchInterval: 10_000 });
  const { data: liveRuns = [] } = useQuery({ queryKey: [...queryKeys.heartbeats(cid), "live"], queryFn: () => heartbeatsApi.liveRunsForCompany(cid), enabled: !!cid, refetchInterval: 5_000 });
  const { data: summary } = useQuery({ queryKey: queryKeys.dashboard(cid), queryFn: () => dashboardApi.summary(cid), enabled: !!cid, refetchInterval: 15_000 });
  const { data: approvals = [] } = useQuery({ queryKey: queryKeys.approvals.list(cid, "pending"), queryFn: () => approvalsApi.list(cid, "pending"), enabled: !!cid, refetchInterval: 15_000 });
  const { data: activityEvents = [] } = useQuery({ queryKey: queryKeys.activity(cid), queryFn: () => activityApi.list(cid), enabled: !!cid, refetchInterval: 10_000 });
  const { data: tasks = [] } = useQuery({ queryKey: [...queryKeys.issues.list(cid), "active"], queryFn: () => issuesApi.list(cid, { status: "in_progress,todo" }), enabled: !!cid, refetchInterval: 10_000 });
  const { data: costSummary } = useQuery({ queryKey: queryKeys.costs(cid), queryFn: () => costsApi.summary(cid), enabled: !!cid, refetchInterval: 30_000 });
  const { data: budgetOverview } = useQuery({ queryKey: ["budgets", cid], queryFn: () => budgetsApi.overview(cid), enabled: !!cid, refetchInterval: 30_000 });

  // Performance metrics
  const { data: perfMetrics } = useQuery({ queryKey: queryKeys.performance.metrics(cid, 30), queryFn: () => performanceApi.getMetrics(cid, 30), enabled: !!cid, refetchInterval: 120_000 });
  const healthByAgent = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of perfMetrics ?? []) map.set(m.agentId, m.healthScore);
    return map;
  }, [perfMetrics]);

  // SLA dashboard
  const { data: slaDashboard } = useQuery({ queryKey: queryKeys.sla.dashboard(cid), queryFn: () => slaApi.getDashboard(cid), enabled: !!cid, refetchInterval: 30_000 });

  // Vault / IAM queries
  const { data: vaultCreds = [] } = useQuery({ queryKey: ["vault", cid], queryFn: () => vaultApi.list(cid), enabled: !!cid && activeView === "iam", refetchInterval: 15_000 });
  const { data: activeCheckouts = [] } = useQuery({ queryKey: ["vault", cid, "active-checkouts"], queryFn: () => vaultApi.activeCheckouts(cid), enabled: !!cid && activeView === "iam", refetchInterval: 5_000 });
  const { data: recentCheckouts = [] } = useQuery({ queryKey: ["vault", cid, "recent-checkouts"], queryFn: () => vaultApi.recentCheckouts(cid), enabled: !!cid && activeView === "iam", refetchInterval: 10_000 });

  const approveMut = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(cid, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(cid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(cid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(cid) });
      pushToast({ title: "Approved", tone: "success", ttlMs: 3000 });
    },
    onError: (err) => {
      pushToast({ title: "Failed to approve", body: (err as Error).message, tone: "error" });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(cid, "pending") });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(cid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(cid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activity(cid) });
      pushToast({ title: "Rejected", tone: "warn", ttlMs: 3000 });
    },
    onError: (err) => {
      pushToast({ title: "Failed to reject", body: (err as Error).message, tone: "error" });
    },
  });
  const wakeMut = useMutation({ mutationFn: (agentId: string) => agentsApi.wakeup(agentId, { source: "on_demand", triggerDetail: "manual" }, cid) });

  if (!selectedCompanyId) return <div className="p-8 text-muted-foreground text-sm">Select a team first.</div>;

  const activeAgents = agents.filter((a) => a.status !== "terminated");
  const runningCount = activeAgents.filter((a) => a.status === "running").length;
  const spendCents = (costSummary as any)?.spendCents ?? (summary as any)?.spendMonthlyCents ?? 0;
  const budgetCents = (costSummary as any)?.budgetCents ?? (summary as any)?.budgetMonthlyCents ?? 1;
  const utilPct = budgetCents > 0 ? Math.min(100, Math.round((spendCents / budgetCents) * 100)) : 0;
  const budgetIncidents = (budgetOverview as any)?.activeIncidents?.length ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 px-5 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Terminal className="h-4 w-4 text-white" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Command Center</h2>
        <div className="flex items-center gap-0.5 ml-2 bg-muted/30 rounded-lg p-0.5">
          <button onClick={() => setActiveView("ops")} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", activeView === "ops" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Operations
          </button>
          <button onClick={() => setActiveView("iam")} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1", activeView === "iam" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <KeyRound className="h-3 w-3" /> IAM
          </button>
        </div>
        <span className="text-xs text-muted-foreground ml-2">{selectedCompany?.name}</span>

        <div className="ml-auto flex items-center gap-3">
          {/* Agent count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> {activeAgents.length} agents
            {runningCount > 0 && <span className="text-cyan-400 font-medium">({runningCount} running)</span>}
          </div>
          {/* Live runs badge */}
          {liveRuns.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <Zap className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span className="text-[11px] text-cyan-400 font-medium">{liveRuns.length} live</span>
            </div>
          )}
          {/* Spend */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" /> {formatCents(spendCents)}
          </div>
          {/* Quick actions */}
          <Button size="sm" variant="outline" onClick={() => openNewIssue()} className="text-xs gap-1">
            <ClipboardList className="h-3 w-3" /> New Task
          </Button>
        </div>
      </div>

      {/* IAM View */}
      {activeView === "iam" && (
        <div className="flex-1 overflow-hidden flex">
          {/* Credential Inventory */}
          <div className="w-[45%] border-r border-border overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> Credential Vault ({vaultCreds.length})
              </h3>
              {vaultCreds.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border/50 rounded-xl">
                  <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No credentials in vault</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Add credentials via the API or Team Settings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vaultCreds.map((cred) => (
                    <div key={cred.id} className="rounded-xl border border-border/50 p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span className="text-sm font-medium flex-1 truncate">{cred.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          cred.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                          cred.status === "expired" ? "bg-red-500/10 text-red-400" :
                          cred.status === "revoked" ? "bg-zinc-500/10 text-zinc-400" :
                          "bg-amber-500/10 text-amber-400"
                        )}>{cred.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted/30">{cred.provider}</span>
                        <span>{cred.credentialType.replace(/_/g, " ")}</span>
                        <span>TTL: {cred.tokenTtlSeconds < 3600 ? `${cred.tokenTtlSeconds / 60}m` : `${cred.tokenTtlSeconds / 3600}h`}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                        <span>{cred.totalCheckouts} checkouts</span>
                        {cred.lastCheckedOutAt && <span>Last: {timeAgo(cred.lastCheckedOutAt)}</span>}
                        {cred.expiresAt && <span>Expires: {new Date(cred.expiresAt).toLocaleDateString()}</span>}
                        {cred.rotationPolicy === "auto" && cred.rotationIntervalDays && (
                          <span className="text-amber-400">Rotate every {cred.rotationIntervalDays}d</span>
                        )}
                      </div>
                      {cred.allowedAgentIds && (
                        <div className="mt-1 text-[10px] text-muted-foreground/50">
                          Scoped to {cred.allowedAgentIds.length} agent{cred.allowedAgentIds.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Checkouts */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Active Checkouts ({activeCheckouts.length})
              </h3>
              {activeCheckouts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-xl">No active token checkouts</p>
              ) : (
                <div className="space-y-1.5">
                  {activeCheckouts.map((co) => {
                    const ttlRemaining = Math.max(0, Math.floor((new Date(co.expiresAt).getTime() - Date.now()) / 1000));
                    const ttlMin = Math.floor(ttlRemaining / 60);
                    return (
                      <div key={co.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">{co.envVarName}</span>
                            <span className="text-muted-foreground">→ {agents.find((a) => a.id === co.agentId)?.name ?? "Agent"}</span>
                          </div>
                          <p className="text-[10px] text-cyan-400/60">{ttlMin > 0 ? `${ttlMin}m remaining` : "Expiring..."}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Token Audit Trail */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Token Activity
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {recentCheckouts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No token activity yet</p>
              ) : recentCheckouts.map((co) => {
                const isActive = co.status === "active";
                const isExpired = co.status === "expired";
                const icon = isActive ? Zap : isExpired ? AlertTriangle : co.status === "checked_in" ? CheckCircle : XCircle;
                const Icon = icon;
                const color = isActive ? "text-cyan-400" : isExpired ? "text-red-400" : co.status === "checked_in" ? "text-emerald-400" : "text-zinc-400";
                return (
                  <div key={co.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-medium">{co.envVarName}</span>
                        <span className={cn("px-1 py-0.5 rounded text-[9px]",
                          isActive ? "bg-cyan-500/10 text-cyan-400" :
                          isExpired ? "bg-red-500/10 text-red-400" :
                          co.status === "checked_in" ? "bg-emerald-500/10 text-emerald-400" :
                          "bg-zinc-500/10 text-zinc-400"
                        )}>{co.status.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {agents.find((a) => a.id === co.agentId)?.name ?? "Agent"}
                        {co.checkedInAt && ` · returned ${timeAgo(co.checkedInAt)}`}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground/50 shrink-0">{timeAgo(co.issuedAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3-Zone Layout */}
      {activeView === "ops" && (
      <div className="flex-1 overflow-hidden flex">

        {/* ZONE 1: Live Operations */}
        <div className="w-[38%] border-r border-border overflow-y-auto p-4 space-y-4">
          {/* Agent Status Grid */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Agents
            </h3>
            <div className="space-y-1.5">
              {activeAgents.map((agent) => (
                <Link key={agent.id} to={`/agents/${agent.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 hover:border-border hover:bg-muted/20 transition-all group">
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", STATUS_DOT[agent.status] ?? "bg-zinc-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabels[agent.role] ?? agent.role}</span>
                      {healthByAgent.has(agent.id) && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border",
                          (healthByAgent.get(agent.id)! >= 80) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          (healthByAgent.get(agent.id)! >= 60) ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          (healthByAgent.get(agent.id)! >= 40) ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                          "bg-red-500/10 text-red-400 border-red-500/20"
                        )}>
                          <Heart className="h-2.5 w-2.5" />
                          {healthByAgent.get(agent.id)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {agent.status === "running" ? "Working" : agent.status}
                      {agent.lastHeartbeatAt && ` · ${timeAgo(agent.lastHeartbeatAt)}`}
                    </p>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); wakeMut.mutate(agent.id); }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                    title="Wake agent">
                    <Play className="h-3 w-3" />
                  </button>
                </Link>
              ))}
              {activeAgents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No agents yet</p>}
            </div>
          </div>

          {/* Live Runs */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Live Runs
            </h3>
            {liveRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-xl">No active runs</p>
            ) : (
              <div className="space-y-2">
                {liveRuns.map((run: any) => (
                  <div key={run.id} className="px-3 py-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-sm font-medium">{run.agentName}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{run.status}</span>
                    </div>
                    {run.issueTitle && <p className="text-[11px] text-muted-foreground mt-1 truncate">{run.issueIdentifier ?? ""} {run.issueTitle}</p>}
                    <p className="text-[10px] text-cyan-400/60 mt-0.5">{timeAgo(run.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Run Stats */}
          <div className="px-3 py-3 rounded-xl border border-border/50 bg-muted/10">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Run Stats</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-semibold tabular-nums">{(summary as any)?.totalRuns ?? 0}</p><p className="text-[10px] text-muted-foreground">Total Runs</p></div>
              <div><p className="text-lg font-semibold tabular-nums text-emerald-400">{(summary as any)?.successfulRuns ?? 0}</p><p className="text-[10px] text-muted-foreground">Succeeded</p></div>
              <div><p className="text-lg font-semibold tabular-nums text-red-400">{(summary as any)?.failedRuns ?? 0}</p><p className="text-[10px] text-muted-foreground">Failed</p></div>
            </div>
          </div>
        </div>

        {/* ZONE 2: Work Pipeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Active Tasks */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ClipboardList className="h-3 w-3" /> Active Tasks ({tasks.length})
            </h3>
            <div className="space-y-1.5">
              {tasks.slice(0, 10).map((task: any) => (
                <Link key={task.id} to={`/issues/${task.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 hover:border-border hover:bg-muted/20 transition-all">
                  <span className={cn("text-sm", PRIORITY_COLORS[task.priority] ?? "text-zinc-400")}>●</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">{task.identifier ?? ""}</span>
                      <span className="text-sm truncate">{task.title}</span>
                    </div>
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full",
                    task.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                    task.status === "todo" ? "bg-blue-500/10 text-blue-400" :
                    "bg-muted text-muted-foreground"
                  )}>{task.status.replace(/_/g, " ")}</span>
                </Link>
              ))}
              {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-xl">No active tasks</p>}
              {tasks.length > 10 && <Link to="/issues" className="text-xs text-primary flex items-center gap-1 justify-center py-2">View all {tasks.length} tasks <ArrowRight className="h-3 w-3" /></Link>}
            </div>
          </div>

          {/* Pending Approvals */}
          {approvals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-amber-400" /> Pending Approvals ({approvals.length})
              </h3>
              <div className="space-y-2">
                {approvals.map((a: any) => (
                  <ApprovalActionCard key={a.id} approval={a}
                    onApprove={(id: string) => approveMut.mutate(id)}
                    onReject={(id: string) => rejectMut.mutate(id)}
                    isPending={approveMut.isPending || rejectMut.isPending} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ZONE 3: Activity & Finance Feed */}
        <div className="w-[25%] border-l border-border overflow-y-auto flex flex-col">
          {/* Cost Ticker */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground font-medium">Monthly Spend</span>
              <span className="text-xs font-semibold tabular-nums">{formatCents(spendCents)} / {formatCents(budgetCents)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all",
                utilPct > 90 ? "bg-red-500" : utilPct > 70 ? "bg-amber-500" : "bg-emerald-500"
              )} style={{ width: `${utilPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{utilPct}% utilized</p>
          </div>

          {/* SLA Compliance Widget */}
          {slaDashboard && slaDashboard.totalTracked > 0 && (
            <Link to="/sla" className="block px-4 py-3 border-b border-border hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><Clock className="h-3 w-3" /> SLA Compliance</span>
                <span className={cn("text-xs font-semibold", slaDashboard.complianceRate >= 90 ? "text-emerald-400" : slaDashboard.complianceRate >= 70 ? "text-amber-400" : "text-red-400")}>
                  {slaDashboard.complianceRate}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                  slaDashboard.complianceRate >= 90 ? "bg-emerald-500" : slaDashboard.complianceRate >= 70 ? "bg-amber-500" : "bg-red-500"
                )} style={{ width: `${slaDashboard.complianceRate}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span className="text-emerald-400">{slaDashboard.onTrack} on track</span>
                {slaDashboard.atRisk > 0 && <span className="text-amber-400">{slaDashboard.atRisk} at risk</span>}
                {slaDashboard.breached > 0 && <span className="text-red-400">{slaDashboard.breached} breached</span>}
              </div>
            </Link>
          )}

          {/* Budget Health */}
          <div className="px-4 py-2.5 border-b border-border">
            {budgetIncidents > 0 ? (
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] text-amber-400 font-medium">{budgetIncidents} budget incident{budgetIncidents > 1 ? "s" : ""}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-medium">Budget healthy</span>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Activity
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activityEvents.slice(0, 30).map((event: ActivityEvent) => {
              const meta = getActionMeta(event.action);
              const Icon = meta.icon;
              return (
                <div key={event.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors border-b border-border/20">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-foreground leading-tight">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {event.entityType}
                      {event.details && typeof event.details === "object" && (event.details as any).name ? `: ${(event.details as any).name}` : ""}
                    </p>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">{timeAgo(event.createdAt)}</span>
                </div>
              );
            })}
            {activityEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No activity yet</p>}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
