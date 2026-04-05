import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, Download, Users, ClipboardList, Cpu,
  TrendingUp, Calendar, BarChart3,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { costsApi } from "../api/costs";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function Chargeback() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const cid = selectedCompanyId!;

  useEffect(() => { setBreadcrumbs([{ label: "Chargeback" }]); }, [setBreadcrumbs]);

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const { data: costSummary } = useQuery({
    queryKey: queryKeys.costs(cid),
    queryFn: () => costsApi.summary(cid),
    enabled: !!cid,
  });

  const { data: costByAgent = [] } = useQuery({
    queryKey: [...queryKeys.costs(cid), "by-agent"],
    queryFn: () => costsApi.byAgent(cid),
    enabled: !!cid,
  });

  const { data: costByProvider = [] } = useQuery({
    queryKey: [...queryKeys.costs(cid), "by-provider"],
    queryFn: () => costsApi.byProvider(cid),
    enabled: !!cid,
  });

  const { data: costByProject = [] } = useQuery({
    queryKey: [...queryKeys.costs(cid), "by-project"],
    queryFn: () => costsApi.byProject(cid),
    enabled: !!cid,
  });

  const totalSpend = (costSummary as any)?.spendCents ?? 0;
  const totalBudget = (costSummary as any)?.budgetCents ?? 0;
  const utilPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;

  // Sort agents by cost descending
  const sortedAgentCosts = [...costByAgent].sort((a: any, b: any) => (b.costCents ?? 0) - (a.costCents ?? 0));
  const maxAgentCost = sortedAgentCosts[0]?.costCents ?? 1;

  function exportCsv() {
    const headers = ["Agent", "Role", "Cost ($)", "Input Tokens", "Output Tokens", "Runs"];
    const rows = sortedAgentCosts.map((ac: any) => {
      const agent = agents.find((a) => a.id === ac.agentId);
      return [
        agent?.name ?? ac.agentName ?? "Unknown",
        agent?.role ?? "",
        (ac.costCents / 100).toFixed(2),
        ac.inputTokens ?? 0,
        ac.outputTokens ?? 0,
        (ac.apiRunCount ?? 0) + (ac.subscriptionRunCount ?? 0),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chargeback-${selectedCompany?.name ?? "team"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Chargeback Report</h1>
            <p className="text-xs text-muted-foreground">{selectedCompany?.name} · Cost Attribution</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/50 p-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
          <p className="text-2xl font-semibold tabular-nums">{formatCents(totalSpend)}</p>
          <p className="text-[10px] text-muted-foreground">Total Spend</p>
        </div>
        <div className="rounded-2xl border border-border/50 p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-400" />
          <p className="text-2xl font-semibold tabular-nums">{formatCents(totalBudget)}</p>
          <p className="text-[10px] text-muted-foreground">Budget</p>
        </div>
        <div className="rounded-2xl border border-border/50 p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-1 text-indigo-400" />
          <p className="text-2xl font-semibold tabular-nums">{sortedAgentCosts.length}</p>
          <p className="text-[10px] text-muted-foreground">Active Billers</p>
        </div>
        <div className="rounded-2xl border border-border/50 p-4 text-center">
          <Calendar className="h-5 w-5 mx-auto mb-1 text-amber-400" />
          <p className="text-2xl font-semibold tabular-nums">{utilPct}%</p>
          <p className="text-[10px] text-muted-foreground">Utilization</p>
        </div>
      </div>

      {/* Cost by Agent — Bar Chart Style */}
      <div className="rounded-2xl border border-border/50 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-indigo-400" /> Cost by Agent
        </h2>
        {sortedAgentCosts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No cost data yet</p>
        ) : (
          <div className="space-y-2">
            {sortedAgentCosts.map((ac: any) => {
              const agent = agents.find((a) => a.id === ac.agentId);
              const pct = maxAgentCost > 0 ? Math.max(2, Math.round((ac.costCents / maxAgentCost) * 100)) : 0;
              return (
                <div key={ac.agentId} className="flex items-center gap-3">
                  <div className="w-[120px] shrink-0">
                    <p className="text-xs font-medium truncate">{agent?.name ?? ac.agentName ?? "Agent"}</p>
                    <p className="text-[10px] text-muted-foreground">{roleLabels[agent?.role ?? ""] ?? agent?.role ?? ""}</p>
                  </div>
                  <div className="flex-1 h-6 rounded-full bg-muted/20 overflow-hidden relative">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-[80px] text-right shrink-0">
                    <p className="text-xs font-semibold tabular-nums">{formatCents(ac.costCents)}</p>
                    <p className="text-[9px] text-muted-foreground">{formatTokens((ac.inputTokens ?? 0) + (ac.outputTokens ?? 0))} tok</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cost by Provider/Model */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-blue-400" /> Cost by Model
          </h2>
          {(costByProvider as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No data</p>
          ) : (costByProvider as any[]).map((cp: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <div>
                <p className="text-xs font-medium">{cp.model ?? "Unknown"}</p>
                <p className="text-[10px] text-muted-foreground">{cp.provider ?? cp.biller ?? ""}</p>
              </div>
              <p className="text-xs font-semibold tabular-nums">{formatCents(cp.costCents ?? 0)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-emerald-400" /> Cost by Project
          </h2>
          {(costByProject as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No project data</p>
          ) : (costByProject as any[]).map((cp: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <p className="text-xs font-medium">{cp.projectName ?? "Unattributed"}</p>
              <p className="text-xs font-semibold tabular-nums">{formatCents(cp.costCents ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
