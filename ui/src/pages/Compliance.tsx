import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, Activity, KeyRound, Users, ClipboardList,
  CheckCircle, XCircle, AlertTriangle, Lock, Download,
  Calendar, Database, Clock, Filter,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { activityApi } from "../api/activity";
import { vaultApi } from "../api/vault";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import type { ActivityEvent } from "@titanclip/shared";

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ACTION_CATEGORIES: Record<string, { icon: typeof Activity; color: string; category: string }> = {
  "agent.created": { icon: Users, color: "text-emerald-400", category: "Agent" },
  "agent.updated": { icon: Users, color: "text-blue-400", category: "Agent" },
  "agent.paused": { icon: AlertTriangle, color: "text-amber-400", category: "Agent" },
  "agent.resumed": { icon: Users, color: "text-emerald-400", category: "Agent" },
  "agent.terminated": { icon: XCircle, color: "text-red-400", category: "Agent" },
  "agent.key_created": { icon: KeyRound, color: "text-indigo-400", category: "Access" },
  "agent.key_revoked": { icon: KeyRound, color: "text-red-400", category: "Access" },
  "issue.created": { icon: ClipboardList, color: "text-blue-400", category: "Task" },
  "issue.updated": { icon: ClipboardList, color: "text-indigo-400", category: "Task" },
  "issue.commented": { icon: ClipboardList, color: "text-muted-foreground", category: "Task" },
  "approval.created": { icon: Shield, color: "text-amber-400", category: "Approval" },
  "approval.approved": { icon: CheckCircle, color: "text-emerald-400", category: "Approval" },
  "approval.rejected": { icon: XCircle, color: "text-red-400", category: "Approval" },
  "vault.credential_created": { icon: KeyRound, color: "text-indigo-400", category: "Vault" },
  "vault.credential_rotated": { icon: KeyRound, color: "text-amber-400", category: "Vault" },
  "vault.credential_revoked": { icon: KeyRound, color: "text-red-400", category: "Vault" },
  "permission_policy.created": { icon: Lock, color: "text-indigo-400", category: "Policy" },
  "secret.created": { icon: Lock, color: "text-indigo-400", category: "Secret" },
  "secret.rotated": { icon: Lock, color: "text-amber-400", category: "Secret" },
  "secret.deleted": { icon: Lock, color: "text-red-400", category: "Secret" },
  "instance.settings.admin_updated": { icon: Shield, color: "text-indigo-400", category: "Admin" },
  "instance.settings.admin_pin_changed": { icon: Lock, color: "text-amber-400", category: "Admin" },
};

function getActionMeta(action: string) {
  return ACTION_CATEGORIES[action] ?? { icon: Activity, color: "text-muted-foreground", category: "Other" };
}

const FILTER_CATEGORIES = ["All", "Agent", "Task", "Approval", "Vault", "Access", "Policy", "Secret", "Admin"] as const;

export function Compliance() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const cid = selectedCompanyId!;
  const [filter, setFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { setBreadcrumbs([{ label: "Compliance" }]); }, [setBreadcrumbs]);

  const { data: allEvents = [] } = useQuery({
    queryKey: queryKeys.activity(cid),
    queryFn: () => activityApi.list(cid),
    enabled: !!cid,
    refetchInterval: 15_000,
  });

  const { data: vaultCreds = [] } = useQuery({
    queryKey: ["vault", cid],
    queryFn: () => vaultApi.list(cid),
    enabled: !!cid,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const { data: recentCheckouts = [] } = useQuery({
    queryKey: ["vault", cid, "recent-checkouts"],
    queryFn: () => vaultApi.recentCheckouts(cid),
    enabled: !!cid,
  });

  // Filter events
  const filteredEvents = allEvents.filter((e) => {
    const meta = getActionMeta(e.action);
    if (filter !== "All" && meta.category !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.action.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        (e.details && JSON.stringify(e.details).toLowerCase().includes(q));
    }
    return true;
  });

  // Stats
  const agentEvents = allEvents.filter((e) => e.action.startsWith("agent.")).length;
  const approvalEvents = allEvents.filter((e) => e.action.startsWith("approval.")).length;
  const vaultEvents = allEvents.filter((e) => e.action.startsWith("vault.") || e.action.startsWith("secret.")).length;
  const policyViolations = 0; // Future: track blocked actions

  function exportCsv() {
    const headers = ["Timestamp", "Action", "Entity Type", "Entity ID", "Actor Type", "Actor ID", "Details"];
    const rows = filteredEvents.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.action, e.entityType, e.entityId, e.actorType, e.actorId,
      e.details ? JSON.stringify(e.details) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `compliance-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Compliance Dashboard</h2>
              <p className="text-xs text-muted-foreground">{selectedCompany?.name} · Audit & Access</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: Stats + Filters + Audit Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{allEvents.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Events</p>
            </div>
            <div className="rounded-xl border border-border/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-blue-400">{agentEvents}</p>
              <p className="text-[10px] text-muted-foreground">Agent Events</p>
            </div>
            <div className="rounded-xl border border-border/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-indigo-400">{vaultEvents}</p>
              <p className="text-[10px] text-muted-foreground">Vault Events</p>
            </div>
            <div className="rounded-xl border border-border/50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-amber-400">{approvalEvents}</p>
              <p className="text-[10px] text-muted-foreground">Approvals</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
              {FILTER_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className={cn("px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                    filter === cat ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/30 rounded-lg border-none focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <span className="text-[10px] text-muted-foreground">{filteredEvents.length} events</span>
          </div>

          {/* Audit Timeline */}
          <div className="space-y-0.5">
            {filteredEvents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No events match the filter</p>
            )}
            {filteredEvents.map((event: ActivityEvent) => {
              const meta = getActionMeta(event.action);
              const Icon = meta.icon;
              const agentName = event.agentId ? (agents.find((a) => a.id === event.agentId)?.name ?? null) : null;
              return (
                <div key={event.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/20 transition-colors">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{event.action.replace(/[._]/g, " ")}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">{meta.category}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {event.actorType === "agent" ? (agentName ?? `Agent ${event.actorId.slice(0, 8)}`) : event.actorType === "user" ? "User" : "System"}
                      {" · "}{event.entityType}
                      {event.details && typeof event.details === "object" && (event.details as any).name ? `: ${(event.details as any).name}` : ""}
                    </p>
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 shrink-0">{timeAgo(event.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Access Report + Data Residency */}
        <div className="w-[280px] border-l border-border overflow-y-auto flex flex-col shrink-0 hidden lg:flex">
          {/* Credential Access Report */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Credential Access
            </h3>
          </div>
          <div className="px-3 py-2 border-b border-border">
            {vaultCreds.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No vault credentials</p>
            ) : vaultCreds.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{cred.name}</p>
                  <p className="text-[10px] text-muted-foreground">{cred.provider} · {cred.totalCheckouts} uses</p>
                </div>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full",
                  cred.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}>{cred.status}</span>
              </div>
            ))}
          </div>

          {/* Recent Token Checkouts */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Recent Checkouts
            </h3>
          </div>
          <div className="px-3 py-2 border-b border-border">
            {recentCheckouts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No checkouts</p>
            ) : recentCheckouts.slice(0, 10).map((co) => (
              <div key={co.id} className="flex items-center gap-2 py-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full",
                  co.status === "active" ? "bg-cyan-400" :
                  co.status === "checked_in" ? "bg-emerald-400" : "bg-red-400"
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium truncate">{co.envVarName}</p>
                  <p className="text-[9px] text-muted-foreground">{co.status.replace(/_/g, " ")} · {timeAgo(co.issuedAt)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Data Residency */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Database className="h-3 w-3" /> Data Residency
            </h3>
          </div>
          <div className="px-3 py-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">Local (Encrypted)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Encryption</span>
              <span className="font-medium text-emerald-400">AES-256-GCM</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">Embedded PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Backups</span>
              <span className="font-medium">Enabled (60m interval)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
