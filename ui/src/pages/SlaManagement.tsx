import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Shield, AlertTriangle, CheckCircle2, XCircle, Plus, Trash2,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Timer, TrendingUp,
  PauseCircle, PlayCircle, Target,
} from "lucide-react";
import { slaApi } from "../api/sla";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { SlaPolicy, SlaTracking, SlaDashboardSummary } from "@titanclip/shared";

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical", color: "text-red-400" },
  { value: "high", label: "High", color: "text-orange-400" },
  { value: "medium", label: "Medium", color: "text-amber-400" },
  { value: "low", label: "Low", color: "text-blue-400" },
];

const BREACH_ACTIONS = [
  { value: "notify", label: "Notify" },
  { value: "escalate", label: "Escalate" },
  { value: "reassign", label: "Reassign Task" },
  { value: "pause_agent", label: "Pause Agent" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    breached: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase", styles[status] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITY_OPTIONS.find(o => o.value === priority);
  return <span className={cn("text-xs font-semibold uppercase", p?.color ?? "text-muted-foreground")}>{priority}</span>;
}

function timeLeft(deadline: string): { text: string; urgent: boolean; overdue: boolean } {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) return { text: `${Math.abs(Math.round(ms / 60_000))}m overdue`, urgent: true, overdue: true };
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return { text: `${mins}m left`, urgent: mins < 15, overdue: false };
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return { text: `${hrs}h left`, urgent: hrs < 2, overdue: false };
  return { text: `${Math.round(hrs / 24)}d left`, urgent: false, overdue: false };
}

export function SlaManagement() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"dashboard" | "policies" | "tracking">("dashboard");
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", description: "", priority: "medium",
    targetResponseMinutes: 60, targetResolutionMinutes: 480,
    breachAction: "notify", isDefault: false,
  });

  const { data: policies = [] } = useQuery({
    queryKey: queryKeys.sla.policies(cid), queryFn: () => slaApi.listPolicies(cid), enabled: !!cid,
  });
  const { data: dashboard } = useQuery({
    queryKey: queryKeys.sla.dashboard(cid), queryFn: () => slaApi.getDashboard(cid), enabled: !!cid, refetchInterval: 30_000,
  });
  const { data: tracking = [] } = useQuery({
    queryKey: queryKeys.sla.tracking(cid), queryFn: () => slaApi.listTracking(cid), enabled: !!cid && activeTab === "tracking", refetchInterval: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () => slaApi.createPolicy(cid, form as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sla.policies(cid) });
      setShowCreatePolicy(false);
      setForm({ name: "", description: "", priority: "medium", targetResponseMinutes: 60, targetResolutionMinutes: 480, breachAction: "notify", isDefault: false });
      pushToast({ title: "Policy created", tone: "success", ttlMs: 3000 });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => slaApi.deletePolicy(cid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sla.policies(cid) });
      pushToast({ title: "Policy deleted", tone: "success", ttlMs: 3000 });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => slaApi.updatePolicy(cid, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sla.policies(cid) }),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-indigo-400" />
          <div>
            <h1 className="text-lg font-semibold">SLA Management</h1>
            <p className="text-xs text-muted-foreground">Define service level agreements and track compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["dashboard", "policies", "tracking"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                activeTab === tab ? "bg-primary/10 text-primary border-primary/30 font-medium" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && dashboard && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Compliance Rate</span>
                  <Target className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <span className={cn("text-2xl font-bold", dashboard.complianceRate >= 90 ? "text-emerald-400" : dashboard.complianceRate >= 70 ? "text-amber-400" : "text-red-400")}>
                  {dashboard.complianceRate}%
                </span>
                <p className="text-xs text-muted-foreground mt-1">{dashboard.totalTracked} issues tracked</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">On Track</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400/50" />
                </div>
                <span className="text-2xl font-bold text-emerald-400">{dashboard.onTrack}</span>
                <p className="text-xs text-muted-foreground mt-1">{dashboard.atRisk} at risk</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Breached</span>
                  <XCircle className="h-4 w-4 text-red-400/50" />
                </div>
                <span className={cn("text-2xl font-bold", dashboard.breached > 0 ? "text-red-400" : "text-foreground")}>{dashboard.breached}</span>
                <p className="text-xs text-muted-foreground mt-1">active breaches</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Avg Resolution</span>
                  <Timer className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <span className="text-2xl font-bold">{dashboard.avgResolutionMinutes < 60 ? `${dashboard.avgResolutionMinutes}m` : `${Math.round(dashboard.avgResolutionMinutes / 60)}h`}</span>
                <p className="text-xs text-muted-foreground mt-1">avg response: {dashboard.avgResponseMinutes}m</p>
              </div>
            </div>

            {/* Active Breaches */}
            {dashboard.activeBreaches.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-red-400">Active Breaches ({dashboard.activeBreaches.length})</h3>
                </div>
                <div className="space-y-2">
                  {dashboard.activeBreaches.map((b) => {
                    const resTime = timeLeft(b.resolutionDeadline);
                    return (
                      <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{b.issueTitle ?? b.issueId}</p>
                          <p className="text-[10px] text-muted-foreground">Policy: {b.policyName} · {b.issuePriority}</p>
                        </div>
                        <span className="text-xs text-red-400 font-medium">{resTime.text}</span>
                        {b.breachActionTaken && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">{b.breachActionTaken}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {dashboard.totalTracked === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Shield className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No SLA tracking data yet</p>
                <p className="text-xs mt-1">Create policies and assign them to issues to start tracking</p>
              </div>
            )}
          </>
        )}

        {/* Policies Tab */}
        {activeTab === "policies" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">SLA Policies ({policies.length})</h2>
              <button onClick={() => setShowCreatePolicy(!showCreatePolicy)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Plus className="h-3 w-3" /> New Policy
              </button>
            </div>

            {/* Create form */}
            {showCreatePolicy && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Create SLA Policy</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="e.g. Critical Response SLA" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Priority</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30">
                      {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Target Response (minutes)</label>
                    <input type="number" value={form.targetResponseMinutes} onChange={e => setForm(f => ({ ...f, targetResponseMinutes: Number(e.target.value) }))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Target Resolution (minutes)</label>
                    <input type="number" value={form.targetResolutionMinutes} onChange={e => setForm(f => ({ ...f, targetResolutionMinutes: Number(e.target.value) }))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Breach Action</label>
                    <select value={form.breachAction} onChange={e => setForm(f => ({ ...f, breachAction: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30">
                      {BREACH_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                        className="rounded border-border" />
                      <span className="text-xs">Default for priority</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Optional description" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}
                    className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {createMut.isPending ? "Creating..." : "Create Policy"}
                  </button>
                  <button onClick={() => setShowCreatePolicy(false)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
                </div>
              </div>
            )}

            {/* Policy list */}
            <div className="space-y-2">
              {policies.map((policy) => (
                <div key={policy.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{policy.name}</span>
                      <PriorityBadge priority={policy.priority} />
                      {policy.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>}
                      {!policy.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">Disabled</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Response: {policy.targetResponseMinutes < 60 ? `${policy.targetResponseMinutes}m` : `${Math.round(policy.targetResponseMinutes / 60)}h`}
                      {" · "}Resolution: {policy.targetResolutionMinutes < 60 ? `${policy.targetResolutionMinutes}m` : `${Math.round(policy.targetResolutionMinutes / 60)}h`}
                      {" · "}On breach: {policy.breachAction}
                    </p>
                    {policy.description && <p className="text-xs text-muted-foreground/60 mt-0.5">{policy.description}</p>}
                  </div>
                  <button onClick={() => toggleMut.mutate({ id: policy.id, enabled: !policy.enabled })}
                    className="text-muted-foreground hover:text-foreground transition-colors" title={policy.enabled ? "Disable" : "Enable"}>
                    {policy.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => deleteMut.mutate(policy.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {policies.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No SLA policies yet</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Tracking Tab */}
        {activeTab === "tracking" && (
          <>
            <h2 className="text-sm font-semibold">SLA Tracking ({tracking.length} issues)</h2>
            <div className="space-y-2">
              {tracking.map((t) => {
                const respTime = t.responseDeadline ? timeLeft(t.responseDeadline) : null;
                const resTime = timeLeft(t.resolutionDeadline);
                return (
                  <div key={t.id} className={cn(
                    "rounded-xl border bg-card p-4 flex items-center gap-4",
                    t.status === "breached" ? "border-red-500/30" : "border-border"
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{t.issueTitle ?? t.issueId}</span>
                        <StatusBadge status={t.status} />
                        {t.issuePriority && <PriorityBadge priority={t.issuePriority} />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Policy: {t.policyName}
                        {t.assigneeAgentName && ` · Assigned: ${t.assigneeAgentName}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      {t.status === "running" && (
                        <>
                          {!t.respondedAt && respTime && (
                            <p className={cn("text-[11px]", respTime.overdue ? "text-red-400 font-semibold" : respTime.urgent ? "text-amber-400" : "text-muted-foreground")}>
                              Response: {respTime.text}
                            </p>
                          )}
                          {t.respondedAt && <p className="text-[11px] text-emerald-400">Responded</p>}
                          <p className={cn("text-[11px]", resTime.overdue ? "text-red-400 font-semibold" : resTime.urgent ? "text-amber-400" : "text-muted-foreground")}>
                            Resolution: {resTime.text}
                          </p>
                        </>
                      )}
                      {t.status === "completed" && <p className="text-[11px] text-emerald-400">Resolved</p>}
                      {t.status === "breached" && <p className="text-[11px] text-red-400 font-semibold">BREACHED</p>}
                      {t.status === "paused" && <p className="text-[11px] text-amber-400">Clock paused</p>}
                    </div>
                  </div>
                );
              })}
              {tracking.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Timer className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No active SLA tracking</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
