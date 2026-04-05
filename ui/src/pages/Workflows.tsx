import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, Plus, Trash2, Play, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, ArrowRight, AlertTriangle,
} from "lucide-react";
import { dependencyApi } from "../api/dependencies";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { WorkflowTemplate, WorkflowStep, CriticalPathResult } from "@titanclip/shared";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400", high: "text-orange-400", medium: "text-amber-400", low: "text-blue-400",
};

function StepNode({ step, index, total }: { step: WorkflowStep; index: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
          "bg-primary/10 border-primary/30 text-primary"
        )}>
          {index + 1}
        </div>
        {index < total - 1 && <div className="w-0.5 h-4 bg-border" />}
      </div>
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm font-medium">{step.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className={PRIORITY_COLORS[step.priority] ?? "text-muted-foreground"}>{step.priority}</span>
          {step.assigneeRole && <span>· {step.assigneeRole}</span>}
          {step.estimatedMinutes && <span>· ~{step.estimatedMinutes}m</span>}
          {step.dependsOnStepIds.length > 0 && <span>· depends on step {step.dependsOnStepIds.map((_, i) => i + 1).join(", ")}</span>}
        </div>
      </div>
    </div>
  );
}

export function Workflows() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"templates" | "critical-path">("templates");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<{ title: string; priority: string; description: string }[]>([
    { title: "", priority: "medium", description: "" },
  ]);

  const { data: templates = [] } = useQuery({
    queryKey: queryKeys.workflows.list(cid),
    queryFn: () => dependencyApi.listWorkflows(cid),
    enabled: !!cid,
  });

  const { data: criticalPath } = useQuery({
    queryKey: queryKeys.dependencies.criticalPath(cid),
    queryFn: () => dependencyApi.getCriticalPath(cid),
    enabled: !!cid && activeTab === "critical-path",
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const steps: WorkflowStep[] = formSteps.filter(s => s.title.trim()).map((s, i, arr) => ({
        id: crypto.randomUUID(),
        title: s.title,
        description: s.description,
        priority: s.priority,
        dependsOnStepIds: i > 0 ? [arr[i - 1]?.title ? `step-${i - 1}` : ""] : [], // will fix below
        estimatedMinutes: 30,
      }));
      // Set up sequential dependencies: each step depends on the previous
      for (let i = 1; i < steps.length; i++) {
        steps[i].dependsOnStepIds = [steps[i - 1].id];
      }
      return dependencyApi.createWorkflow(cid, { name: formName, description: formDesc, steps } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list(cid) });
      setShowCreate(false);
      setFormName(""); setFormDesc("");
      setFormSteps([{ title: "", priority: "medium", description: "" }]);
      pushToast({ title: "Workflow created", tone: "success", ttlMs: 3000 });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dependencyApi.deleteWorkflow(cid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list(cid) });
      pushToast({ title: "Workflow deleted", tone: "success", ttlMs: 3000 });
    },
  });

  const executeMut = useMutation({
    mutationFn: (id: string) => dependencyApi.executeWorkflow(cid, id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.issues.list(cid) });
      qc.invalidateQueries({ queryKey: queryKeys.dependencies.forCompany(cid) });
      pushToast({ title: `Created ${result.issueIds.length} linked issues`, tone: "success", ttlMs: 4000 });
    },
    onError: (err) => pushToast({ title: "Failed", body: (err as Error).message, tone: "error" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => dependencyApi.updateWorkflow(cid, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workflows.list(cid) }),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-purple-400" />
          <div>
            <h1 className="text-lg font-semibold">Workflows & Dependencies</h1>
            <p className="text-xs text-muted-foreground">Reusable pipelines and task dependency analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["templates", "critical-path"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors",
                activeTab === tab ? "bg-primary/10 text-primary border-primary/30 font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}>
              {tab === "templates" ? "Templates" : "Critical Path"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Templates Tab */}
        {activeTab === "templates" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Workflow Templates ({templates.length})</h2>
              <button onClick={() => setShowCreate(!showCreate)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3 w-3" /> New Workflow
              </button>
            </div>

            {/* Create form */}
            {showCreate && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Create Workflow Template</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                    <input value={formName} onChange={e => setFormName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="e.g. Feature Development Pipeline" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                    <input value={formDesc} onChange={e => setFormDesc(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="Optional description" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-2 block">Steps (sequential)</label>
                  <div className="space-y-2">
                    {formSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{i + 1}</span>
                        <input value={step.title} onChange={e => {
                          const next = [...formSteps]; next[i] = { ...next[i], title: e.target.value }; setFormSteps(next);
                        }}
                          className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                          placeholder={`Step ${i + 1} title`} />
                        <select value={step.priority} onChange={e => {
                          const next = [...formSteps]; next[i] = { ...next[i], priority: e.target.value }; setFormSteps(next);
                        }} className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg">
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        {formSteps.length > 1 && (
                          <button onClick={() => setFormSteps(formSteps.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setFormSteps([...formSteps, { title: "", priority: "medium", description: "" }])}
                    className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Step
                  </button>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => createMut.mutate()} disabled={!formName.trim() || formSteps.every(s => !s.title.trim()) || createMut.isPending}
                    className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {createMut.isPending ? "Creating..." : "Create Workflow"}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
                </div>
              </div>
            )}

            {/* Template list */}
            <div className="space-y-2">
              {templates.map((t) => {
                const isExpanded = expandedId === t.id;
                return (
                  <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-4 flex items-center gap-4">
                      <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{t.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                            {t.steps.length} steps
                          </span>
                          {t.usageCount > 0 && (
                            <span className="text-[10px] text-muted-foreground">Used {t.usageCount}x</span>
                          )}
                          {!t.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">Disabled</span>}
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                      </div>
                      <button onClick={() => executeMut.mutate(t.id)} disabled={executeMut.isPending || !t.enabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        title="Execute workflow">
                        <Play className="h-3 w-3" /> Run
                      </button>
                      <button onClick={() => toggleMut.mutate({ id: t.id, enabled: !t.enabled })}
                        className="text-muted-foreground hover:text-foreground">
                        {t.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button onClick={() => deleteMut.mutate(t.id)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-muted/10 border-t border-border/30">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Steps</h4>
                        <div className="space-y-1">
                          {t.steps.map((step, i) => (
                            <StepNode key={step.id} step={step} index={i} total={t.steps.length} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {templates.length === 0 && !showCreate && (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm">No workflow templates yet</p>
                  <p className="text-xs mt-1">Create reusable multi-step pipelines for common processes</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Critical Path Tab */}
        {activeTab === "critical-path" && (
          <>
            {criticalPath && criticalPath.nodes.length > 0 ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Critical Path Length</span>
                    <p className="text-2xl font-bold mt-1">{criticalPath.criticalPathLength} <span className="text-sm font-normal text-muted-foreground">steps</span></p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Est. Completion</span>
                    <p className="text-2xl font-bold mt-1">
                      {criticalPath.estimatedCompletionMinutes < 60
                        ? `${criticalPath.estimatedCompletionMinutes}m`
                        : `${Math.round(criticalPath.estimatedCompletionMinutes / 60)}h`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <span className="text-xs text-muted-foreground">Bottleneck</span>
                    <p className="text-sm font-medium mt-2 truncate">
                      {criticalPath.bottleneckIssueId
                        ? (criticalPath.nodes.find(n => n.issueId === criticalPath.bottleneckIssueId)?.issueTitle ?? "Unknown")
                        : "None"}
                    </p>
                  </div>
                </div>

                {/* DAG visualization */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/50">
                    <h3 className="text-sm font-semibold">Dependency Graph</h3>
                    <p className="text-[10px] text-muted-foreground">Red-highlighted nodes are on the critical path</p>
                  </div>
                  <div className="p-4 space-y-1">
                    {criticalPath.nodes.map((node) => (
                      <div key={node.issueId} className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                        node.isCritical ? "border-red-500/30 bg-red-500/5" : "border-border/50"
                      )} style={{ marginLeft: `${node.depth * 24}px` }}>
                        {node.depth > 0 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          node.issueStatus === "done" ? "bg-emerald-400" :
                          node.issueStatus === "blocked" ? "bg-red-400" :
                          node.issueStatus === "in_progress" ? "bg-amber-400" :
                          "bg-zinc-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted-foreground">{node.issueIdentifier}</span>
                            <span className="text-sm truncate">{node.issueTitle}</span>
                            {node.isCritical && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">Critical</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className={PRIORITY_COLORS[node.issuePriority] ?? ""}>{node.issuePriority}</span>
                            {node.assigneeAgentName && <span>· {node.assigneeAgentName}</span>}
                            {node.blockedBy.length > 0 && <span>· blocked by {node.blockedBy.length}</span>}
                            {node.blocks.length > 0 && <span>· blocks {node.blocks.length}</span>}
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full",
                          node.issueStatus === "done" ? "bg-emerald-500/10 text-emerald-400" :
                          node.issueStatus === "blocked" ? "bg-red-500/10 text-red-400" :
                          node.issueStatus === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                          "bg-muted text-muted-foreground"
                        )}>{node.issueStatus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <GitBranch className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No task dependencies found</p>
                <p className="text-xs mt-1">Add dependencies between issues to see the critical path</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
