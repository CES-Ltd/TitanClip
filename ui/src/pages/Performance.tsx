import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Heart,
  Cpu,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { performanceApi, type AgentPerformanceMetrics } from "../api/performance";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

type SortKey = "healthScore" | "taskCompletionRate" | "errorRate" | "utilizationPercent" | "totalCostCents" | "tokenEfficiency" | "agentName";
type TimeRange = 7 | 30 | 90;

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
    score >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
    score >= 40 ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
    "bg-red-500/15 text-red-400 border-red-500/20";

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", color)}>
      <Heart className="h-3 w-3" />
      {score}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active" ? "bg-emerald-400" :
    status === "paused" ? "bg-amber-400" :
    status === "error" ? "bg-red-400" :
    "bg-zinc-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", color)} />;
}

function MetricCard({ label, value, subValue, icon: Icon, trend }: {
  label: string;
  value: string;
  subValue?: string;
  icon: typeof BarChart3;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && (
          <span className={cn("text-xs font-medium",
            trend === "up" ? "text-emerald-400" :
            trend === "down" ? "text-red-400" : "text-muted-foreground"
          )}>
            {trend === "up" && <TrendingUp className="h-3 w-3 inline" />}
            {trend === "down" && <TrendingUp className="h-3 w-3 inline rotate-180" />}
          </span>
        )}
      </div>
      {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = "primary" }: { value: number; max?: number; color?: "primary" | "emerald" | "amber" | "red" }) {
  const pct = Math.min(100, (value / max) * 100);
  const bg =
    color === "emerald" ? "bg-emerald-500" :
    color === "amber" ? "bg-amber-500" :
    color === "red" ? "bg-red-500" :
    "bg-primary";
  return (
    <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function barColor(val: number): "emerald" | "amber" | "red" {
  if (val >= 70) return "emerald";
  if (val >= 40) return "amber";
  return "red";
}

function errorBarColor(val: number): "emerald" | "amber" | "red" {
  if (val <= 10) return "emerald";
  if (val <= 30) return "amber";
  return "red";
}

export function Performance() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const { data: metrics, isLoading } = useQuery({
    queryKey: queryKeys.performance.metrics(companyId, timeRange),
    queryFn: () => performanceApi.getMetrics(companyId, timeRange),
    enabled: !!companyId,
    refetchInterval: 60_000,
  });

  // Aggregate stats
  const aggregates = useMemo(() => {
    if (!metrics?.length) return null;
    const totalTasks = metrics.reduce((s, m) => s + m.totalTasksAssigned, 0);
    const totalCompleted = metrics.reduce((s, m) => s + m.tasksCompleted, 0);
    const totalRuns = metrics.reduce((s, m) => s + m.totalRuns, 0);
    const totalFailed = metrics.reduce((s, m) => s + m.failedRuns, 0);
    const totalCost = metrics.reduce((s, m) => s + m.totalCostCents, 0);
    const avgHealth = Math.round(metrics.reduce((s, m) => s + m.healthScore, 0) / metrics.length);
    const activeCount = metrics.filter(m => m.agentStatus === "active").length;
    return { totalTasks, totalCompleted, totalRuns, totalFailed, totalCost, avgHealth, activeCount, total: metrics.length };
  }, [metrics]);

  // Sorted metrics
  const sorted = useMemo(() => {
    if (!metrics) return [];
    const arr = [...metrics];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [metrics, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortHeader({ label, field, className }: { label: string; field: SortKey; className?: string }) {
    return (
      <button
        onClick={() => handleSort(field)}
        className={cn("flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors", className)}
      >
        {label}
        {sortKey === field ? (
          sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    );
  }

  function formatCost(cents: number): string {
    if (cents === 0) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function relativeTime(iso: string | null): string {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-indigo-400" />
          <div>
            <h1 className="text-lg font-semibold">Agent Performance</h1>
            <p className="text-xs text-muted-foreground">Monitor agent health, efficiency, and utilization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as TimeRange[]).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                timeRange === days
                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Loading performance data...
          </div>
        ) : !metrics?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">No agent data available</p>
            <p className="text-xs mt-1">Create agents and assign tasks to see performance metrics</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {aggregates && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  label="Avg Health Score"
                  value={String(aggregates.avgHealth)}
                  subValue={`${aggregates.activeCount}/${aggregates.total} agents active`}
                  icon={Heart}
                />
                <MetricCard
                  label="Tasks Completed"
                  value={`${aggregates.totalCompleted}/${aggregates.totalTasks}`}
                  subValue={aggregates.totalTasks > 0 ? `${Math.round((aggregates.totalCompleted / aggregates.totalTasks) * 100)}% completion rate` : "No tasks"}
                  icon={CheckCircle2}
                />
                <MetricCard
                  label="Total Runs"
                  value={String(aggregates.totalRuns)}
                  subValue={aggregates.totalRuns > 0 ? `${aggregates.totalFailed} failed (${Math.round((aggregates.totalFailed / aggregates.totalRuns) * 100)}%)` : "No runs yet"}
                  icon={Activity}
                />
                <MetricCard
                  label="Total Cost"
                  value={formatCost(aggregates.totalCost)}
                  subValue={`Last ${timeRange} days`}
                  icon={DollarSign}
                />
              </div>
            )}

            {/* Agent Leaderboard */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold">Agent Leaderboard</h2>
                <span className="text-xs text-muted-foreground ml-auto">{sorted.length} agents</span>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-[2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-2 px-4 py-2 border-b border-border/30 bg-muted/20">
                <SortHeader label="Agent" field="agentName" />
                <SortHeader label="Health" field="healthScore" className="justify-center" />
                <SortHeader label="Completion" field="taskCompletionRate" className="justify-center" />
                <SortHeader label="Error Rate" field="errorRate" className="justify-center" />
                <SortHeader label="Utilization" field="utilizationPercent" className="justify-center" />
                <SortHeader label="Efficiency" field="tokenEfficiency" className="justify-center" />
                <SortHeader label="Cost" field="totalCostCents" className="justify-end" />
              </div>

              {/* Rows */}
              {sorted.map((agent, idx) => {
                const isExpanded = expandedAgent === agent.agentId;
                return (
                  <div key={agent.agentId}>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.agentId)}
                      className={cn(
                        "w-full grid grid-cols-[2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr] gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/20",
                        isExpanded && "bg-muted/20",
                        idx === 0 && !isExpanded && "bg-amber-500/5"
                      )}
                    >
                      {/* Agent */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>
                        <StatusDot status={agent.agentStatus} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{agent.agentName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{agent.agentRole}</p>
                        </div>
                      </div>

                      {/* Health */}
                      <div className="flex items-center justify-center">
                        <HealthBadge score={agent.healthScore} />
                      </div>

                      {/* Completion */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="text-sm font-medium">{agent.taskCompletionRate}%</span>
                        <ProgressBar value={agent.taskCompletionRate} color={barColor(agent.taskCompletionRate)} />
                      </div>

                      {/* Error Rate */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={cn("text-sm font-medium", agent.errorRate > 20 && "text-red-400")}>
                          {agent.errorRate}%
                        </span>
                        <ProgressBar value={agent.errorRate} color={errorBarColor(agent.errorRate)} />
                      </div>

                      {/* Utilization */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="text-sm font-medium">{agent.utilizationPercent}%</span>
                        <ProgressBar value={agent.utilizationPercent} color={barColor(agent.utilizationPercent)} />
                      </div>

                      {/* Efficiency */}
                      <div className="flex items-center justify-center">
                        <span className="text-sm font-medium">{agent.tokenEfficiency}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">t/M</span>
                      </div>

                      {/* Cost */}
                      <div className="flex items-center justify-end">
                        <span className="text-sm font-medium">{formatCost(agent.totalCostCents)}</span>
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-6 py-4 bg-muted/10 border-b border-border/30 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3" /> Tasks
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Assigned</span>
                              <span className="font-medium">{agent.totalTasksAssigned}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Completed</span>
                              <span className="font-medium text-emerald-400">{agent.tasksCompleted}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Avg Duration</span>
                              <span className="font-medium">{agent.avgTaskDurationMinutes}m</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="h-3 w-3" /> Runs
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Total</span>
                              <span className="font-medium">{agent.totalRuns}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Succeeded</span>
                              <span className="font-medium text-emerald-400">{agent.successfulRuns}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Failed</span>
                              <span className={cn("font-medium", agent.failedRuns > 0 && "text-red-400")}>{agent.failedRuns}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">1st-time success</span>
                              <span className="font-medium">{agent.firstTimeSuccessRate}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Cpu className="h-3 w-3" /> Tokens
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Input</span>
                              <span className="font-medium">{formatTokens(agent.totalInputTokens)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Output</span>
                              <span className="font-medium">{formatTokens(agent.totalOutputTokens)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Efficiency</span>
                              <span className="font-medium">{agent.tokenEfficiency} tasks/M</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> Status
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Status</span>
                              <span className="font-medium capitalize">{agent.agentStatus}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Last active</span>
                              <span className="font-medium">{relativeTime(agent.lastActiveAt)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Total cost</span>
                              <span className="font-medium">{formatCost(agent.totalCostCents)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Health breakdown */}
                        <div className="col-span-full mt-2 pt-3 border-t border-border/30">
                          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Health Score Breakdown</h4>
                          <div className="grid grid-cols-4 gap-4">
                            {[
                              { label: "Completion (30%)", value: agent.taskCompletionRate, weight: 0.3 },
                              { label: "Low Errors (30%)", value: 100 - agent.errorRate, weight: 0.3 },
                              { label: "Utilization (20%)", value: Math.min(100, agent.utilizationPercent), weight: 0.2 },
                              { label: "1st Success (20%)", value: agent.firstTimeSuccessRate, weight: 0.2 },
                            ].map((item) => (
                              <div key={item.label} className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground">{item.label}</span>
                                  <span className="font-medium">{Math.round(item.value * item.weight)}</span>
                                </div>
                                <ProgressBar value={item.value} color={barColor(item.value)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Alerts section */}
            {(() => {
              const alerts = sorted.filter(a => a.healthScore < 50 || a.errorRate > 30);
              if (alerts.length === 0) return null;
              return (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-400">Attention Required</h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.map((a) => (
                      <div key={a.agentId} className="flex items-center gap-3 text-xs">
                        <StatusDot status={a.agentStatus} />
                        <span className="font-medium">{a.agentName}</span>
                        {a.healthScore < 50 && (
                          <span className="text-red-400">Health: {a.healthScore}/100</span>
                        )}
                        {a.errorRate > 30 && (
                          <span className="text-orange-400">Error rate: {a.errorRate}%</span>
                        )}
                        {a.taskCompletionRate < 30 && a.totalTasksAssigned > 0 && (
                          <span className="text-amber-400">Completion: {a.taskCompletionRate}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
