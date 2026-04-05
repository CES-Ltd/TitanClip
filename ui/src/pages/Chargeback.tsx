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

// Cloud provider pricing per 1M tokens (input / output) — approximate averages as of 2026
const CLOUD_PRICING: {
  id: string; name: string; inputPer1M: number; outputPer1M: number; note: string;
}[] = [
  { id: "claude-sonnet", name: "Claude Sonnet 4", inputPer1M: 3.00, outputPer1M: 15.00, note: "Anthropic API" },
  { id: "claude-opus", name: "Claude Opus 4", inputPer1M: 15.00, outputPer1M: 75.00, note: "Anthropic API" },
  { id: "claude-haiku", name: "Claude Haiku 3.5", inputPer1M: 0.80, outputPer1M: 4.00, note: "Anthropic API" },
  { id: "gpt-4o", name: "GPT-4o", inputPer1M: 2.50, outputPer1M: 10.00, note: "OpenAI API" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", inputPer1M: 0.15, outputPer1M: 0.60, note: "OpenAI API" },
  { id: "gemini-pro", name: "Gemini 2.5 Pro", inputPer1M: 1.25, outputPer1M: 10.00, note: "Google AI" },
  { id: "gemini-flash", name: "Gemini 2.5 Flash", inputPer1M: 0.15, outputPer1M: 0.60, note: "Google AI" },
  { id: "deepseek-v3", name: "DeepSeek V3", inputPer1M: 0.27, outputPer1M: 1.10, note: "DeepSeek API" },
];

function estimateCost(inputTokens: number, outputTokens: number, pricing: typeof CLOUD_PRICING[0]): number {
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
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

      {/* Cloud Cost Estimator */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-amber-400" /> Cloud Cost Estimate
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimated cost if this token usage was billed at cloud API rates. Not actual charges — for comparison only.
            </p>
          </div>
          <span className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 font-medium">ESTIMATE</span>
        </div>

        {(() => {
          // Aggregate total tokens across all agents
          const totalInput = sortedAgentCosts.reduce((sum: number, ac: any) => sum + (ac.inputTokens ?? 0), 0);
          const totalOutput = sortedAgentCosts.reduce((sum: number, ac: any) => sum + (ac.outputTokens ?? 0), 0);
          const totalCached = sortedAgentCosts.reduce((sum: number, ac: any) => sum + (ac.cachedInputTokens ?? 0), 0);

          if (totalInput === 0 && totalOutput === 0) {
            return <p className="text-xs text-muted-foreground text-center py-4">No token usage data to estimate</p>;
          }

          return (
            <>
              {/* Token summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-background/50 border border-border/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{formatTokens(totalInput)}</p>
                  <p className="text-[10px] text-muted-foreground">Input Tokens</p>
                </div>
                <div className="rounded-xl bg-background/50 border border-border/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{formatTokens(totalOutput)}</p>
                  <p className="text-[10px] text-muted-foreground">Output Tokens</p>
                </div>
                <div className="rounded-xl bg-background/50 border border-border/30 p-3 text-center">
                  <p className="text-lg font-semibold tabular-nums">{formatTokens(totalCached)}</p>
                  <p className="text-[10px] text-muted-foreground">Cached Input</p>
                </div>
              </div>

              {/* Provider pricing comparison table */}
              <div className="rounded-xl bg-background/50 border border-border/30 overflow-hidden">
                <div className="grid grid-cols-5 gap-0 text-[10px] font-medium text-muted-foreground px-3 py-2 border-b border-border/20 bg-muted/10">
                  <span className="col-span-2">Model</span>
                  <span className="text-right">Input $/1M</span>
                  <span className="text-right">Output $/1M</span>
                  <span className="text-right font-semibold text-foreground">Estimated Cost</span>
                </div>
                {CLOUD_PRICING.map((p) => {
                  const est = estimateCost(totalInput, totalOutput, p);
                  const isLowest = est === Math.min(...CLOUD_PRICING.map((pp) => estimateCost(totalInput, totalOutput, pp)));
                  const isHighest = est === Math.max(...CLOUD_PRICING.map((pp) => estimateCost(totalInput, totalOutput, pp)));
                  return (
                    <div key={p.id} className={cn(
                      "grid grid-cols-5 gap-0 px-3 py-2.5 border-b border-border/10 last:border-0 items-center",
                      isLowest && "bg-emerald-500/5",
                    )}>
                      <div className="col-span-2">
                        <p className="text-xs font-medium">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground">{p.note}</p>
                      </div>
                      <p className="text-xs text-right tabular-nums text-muted-foreground">${p.inputPer1M.toFixed(2)}</p>
                      <p className="text-xs text-right tabular-nums text-muted-foreground">${p.outputPer1M.toFixed(2)}</p>
                      <div className="text-right">
                        <p className={cn("text-xs font-semibold tabular-nums",
                          isLowest ? "text-emerald-400" : isHighest ? "text-red-400" : "text-foreground"
                        )}>
                          ${est.toFixed(2)}
                        </p>
                        {isLowest && <p className="text-[8px] text-emerald-400">Lowest</p>}
                        {isHighest && <p className="text-[8px] text-red-400">Highest</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Range summary */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground">Estimated range:</span>
                <span className="font-semibold">
                  ${Math.min(...CLOUD_PRICING.map((p) => estimateCost(totalInput, totalOutput, p))).toFixed(2)}
                  {" — "}
                  ${Math.max(...CLOUD_PRICING.map((p) => estimateCost(totalInput, totalOutput, p))).toFixed(2)}
                </span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
