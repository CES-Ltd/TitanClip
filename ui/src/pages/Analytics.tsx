import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, BarChart3, Clock, DollarSign, Zap, Users,
  CheckCircle2, Target, ArrowRight, Calendar,
} from "lucide-react";
import { analyticsApi, type AnalyticsSummary, type VelocityPoint, type BurndownPoint, type CostTrendPoint } from "../api/analytics";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

type TimeRange = 7 | 30 | 90;

// ── Mini SVG Chart Components ──

function SparklineChart({ data, color = "#6366f1", height = 48, showArea = true }: {
  data: number[]; color?: string; height?: number; showArea?: boolean;
}) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-[10px] text-muted-foreground">No data</div>;
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 4)}`).join(" ");
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {showArea && <polygon points={areaPoints} fill={color} opacity="0.1" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function BarChart({ items, maxValue }: { items: { label: string; value: number; color: string }[]; maxValue?: number }) {
  const max = maxValue ?? Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-20 truncate text-right shrink-0">{item.label}</span>
          <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
          </div>
          <span className="text-[10px] font-medium w-8 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function DualLineChart({ data, height = 120 }: { data: { date: string; line1: number; line2: number }[]; height?: number }) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center text-[10px] text-muted-foreground">No data</div>;
  const max = Math.max(...data.flatMap(d => [d.line1, d.line2]), 1);
  const w = 100;
  const toPoints = (values: number[]) => values.map((v, i) => `${(i / (values.length - 1)) * w},${height - (v / max) * (height - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline points={toPoints(data.map(d => d.line1))} fill="none" stroke="#22c55e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <polyline points={toPoints(data.map(d => d.line2))} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MetricCard({ label, value, subValue, icon: Icon, color }: {
  label: string; value: string; subValue?: string; icon: typeof BarChart3; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", color ?? "text-muted-foreground/50")} />
      </div>
      <span className="text-2xl font-bold">{value}</span>
      {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
    </div>
  );
}

function formatCents(c: number): string { return c === 0 ? "$0" : `$${(c / 100).toFixed(2)}`; }

export function Analytics() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const [timeRange, setTimeRange] = useState<TimeRange>(30);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.summary(cid, timeRange),
    queryFn: () => analyticsApi.getSummary(cid, timeRange),
    enabled: !!cid,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-violet-400" />
          <div>
            <h1 className="text-lg font-semibold">Analytics & Forecasting</h1>
            <p className="text-xs text-muted-foreground">Velocity, burndown, cost trends, and workload forecasts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <button key={d} onClick={() => setTimeRange(d)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors",
                timeRange === d ? "bg-primary/10 text-primary border-primary/30 font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading analytics...</div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <>
            {/* Top Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Tasks Created" value={String(data.totalTasksCreated)} icon={Target} color="text-blue-400" />
              <MetricCard label="Tasks Completed" value={String(data.totalTasksCompleted)} icon={CheckCircle2} color="text-emerald-400"
                subValue={data.totalTasksCreated > 0 ? `${Math.round((data.totalTasksCompleted / data.totalTasksCreated) * 100)}% rate` : ""} />
              <MetricCard label="Avg Cycle Time" value={data.avgCycleTimeMinutes < 60 ? `${data.avgCycleTimeMinutes}m` : `${Math.round(data.avgCycleTimeMinutes / 60)}h`}
                icon={Clock} color="text-amber-400" />
              <MetricCard label="Total Runs" value={String(data.totalRuns)} subValue={`${data.successRate}% success`} icon={Zap} color="text-cyan-400" />
              <MetricCard label="Total Cost" value={formatCents(data.totalCostCents)} subValue={`Last ${timeRange} days`} icon={DollarSign} color="text-orange-400" />
              <MetricCard label="Open Tasks" value={String(data.workloadForecast.currentOpenTasks)}
                subValue={data.workloadForecast.estimatedClearDays > 0 ? `~${data.workloadForecast.estimatedClearDays}d to clear` : ""}
                icon={Users} color="text-purple-400" />
            </div>

            {/* Charts Row 1: Velocity + Burndown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Velocity */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Velocity
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Created</span>
                  </div>
                </div>
                {data.velocity.length > 1 ? (
                  <>
                    <DualLineChart data={data.velocity.map(v => ({ date: v.date, line1: v.completed, line2: v.created }))} height={100} />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>{data.velocity[0]?.date}</span>
                      <span>{data.velocity[data.velocity.length - 1]?.date}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">Not enough data</div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-500/5 p-2">
                    <p className="text-lg font-semibold text-emerald-400">{data.workloadForecast.avgCompletionPerDay}</p>
                    <p className="text-[10px] text-muted-foreground">avg/day completed</p>
                  </div>
                  <div className="rounded-lg bg-blue-500/5 p-2">
                    <p className="text-lg font-semibold text-blue-400">
                      {data.velocity.length > 0 ? Math.round(data.velocity.reduce((s, v) => s + v.created, 0) / data.velocity.length * 10) / 10 : 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">avg/day created</p>
                  </div>
                </div>
              </div>

              {/* Burndown */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-indigo-400" /> Burndown
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-500 inline-block" /> Actual</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-indigo-500 inline-block border-dashed" /> Ideal</span>
                  </div>
                </div>
                {data.burndown.length > 1 ? (
                  <>
                    <DualLineChart data={data.burndown.map(b => ({ date: b.date, line1: b.remaining, line2: b.ideal }))} height={100} />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>{data.burndown[0]?.date}</span>
                      <span>{data.burndown[data.burndown.length - 1]?.date}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-[100px] flex items-center justify-center text-xs text-muted-foreground">Not enough data</div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-indigo-500/5 p-2">
                    <p className="text-lg font-semibold">{data.workloadForecast.currentOpenTasks}</p>
                    <p className="text-[10px] text-muted-foreground">remaining tasks</p>
                  </div>
                  <div className="rounded-lg bg-purple-500/5 p-2">
                    <p className="text-lg font-semibold">{data.workloadForecast.capacityUtilization}%</p>
                    <p className="text-[10px] text-muted-foreground">capacity utilization</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 2: Work Distribution + Cost Trend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Work Distribution */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <Users className="h-4 w-4 text-purple-400" /> Work Distribution
                </h3>
                {data.workDistribution.length > 0 ? (
                  <div className="space-y-3">
                    <BarChart items={data.workDistribution.map(w => ({
                      label: w.agentName,
                      value: w.tasksAssigned,
                      color: "#8b5cf6",
                    }))} />
                    <div className="mt-3 border-t border-border/30 pt-3">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left font-medium pb-1">Agent</th>
                            <th className="text-right font-medium pb-1">Done</th>
                            <th className="text-right font-medium pb-1">Runs</th>
                            <th className="text-right font-medium pb-1">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.workDistribution.map(w => (
                            <tr key={w.agentId}>
                              <td className="py-0.5 font-medium">{w.agentName}</td>
                              <td className="py-0.5 text-right text-emerald-400">{w.tasksCompleted}/{w.tasksAssigned}</td>
                              <td className="py-0.5 text-right">{w.runCount}</td>
                              <td className="py-0.5 text-right">{formatCents(w.costCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No agent data</div>
                )}
              </div>

              {/* Cost Trend */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <DollarSign className="h-4 w-4 text-orange-400" /> Cost Trend
                </h3>
                {data.costTrend.length > 1 ? (
                  <>
                    <SparklineChart data={data.costTrend.map(c => c.costCents)} color="#f97316" height={80} />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>{data.costTrend[0]?.date}</span>
                      <span>{data.costTrend[data.costTrend.length - 1]?.date}</span>
                    </div>
                  </>
                ) : (
                  <div className="h-[80px] flex items-center justify-center text-xs text-muted-foreground">Not enough cost data</div>
                )}

                {/* Budget Forecast */}
                <div className="mt-4 pt-3 border-t border-border/30">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Budget Forecast
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-orange-500/5 p-2">
                      <p className="text-sm font-semibold">{formatCents(data.budgetForecast.currentMonthSpendCents)}</p>
                      <p className="text-[10px] text-muted-foreground">Month to date</p>
                    </div>
                    <div className="rounded-lg bg-orange-500/5 p-2">
                      <p className="text-sm font-semibold">{formatCents(data.budgetForecast.projectedMonthEndCents)}</p>
                      <p className="text-[10px] text-muted-foreground">Projected month end</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="text-sm font-semibold">{formatCents(data.budgetForecast.dailyBurnRateCents)}</p>
                      <p className="text-[10px] text-muted-foreground">Daily burn rate</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-2">
                      <p className="text-sm font-semibold">{data.budgetForecast.daysRemaining}d</p>
                      <p className="text-[10px] text-muted-foreground">Days remaining</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workload Forecast */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Zap className="h-4 w-4 text-cyan-400" /> Workload Forecast
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{data.workloadForecast.currentOpenTasks}</p>
                  <p className="text-xs text-muted-foreground">Open Tasks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{data.workloadForecast.avgCompletionPerDay}</p>
                  <p className="text-xs text-muted-foreground">Avg Completed/Day</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold",
                    data.workloadForecast.estimatedClearDays > 30 ? "text-red-400" :
                    data.workloadForecast.estimatedClearDays > 14 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {data.workloadForecast.estimatedClearDays > 0 ? `${data.workloadForecast.estimatedClearDays}d` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Est. Clear Time</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold",
                    data.workloadForecast.capacityUtilization > 80 ? "text-red-400" :
                    data.workloadForecast.capacityUtilization > 50 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {data.workloadForecast.capacityUtilization}%
                  </p>
                  <p className="text-xs text-muted-foreground">Capacity Utilization</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted/30 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                  data.workloadForecast.capacityUtilization > 80 ? "bg-red-500" :
                  data.workloadForecast.capacityUtilization > 50 ? "bg-amber-500" : "bg-emerald-500"
                )} style={{ width: `${data.workloadForecast.capacityUtilization}%` }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
