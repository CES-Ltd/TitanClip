import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, UserMinus, FileText, Plus, Trash2, Play, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock, Shield,
  XCircle, ArrowRight,
} from "lucide-react";
import { lifecycleApi } from "../api/lifecycle";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { ChangeRequest } from "@titanclip/shared";
import { AGENT_ROLE_LABELS } from "@titanclip/shared";

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  pending_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  implemented: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rolled_back: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const CATEGORIES = ["agent_config", "policy_change", "infrastructure", "workflow", "access_control", "other"];
const RISKS = ["low", "medium", "high", "critical"];
const CR_STATUSES = ["draft", "pending_review", "approved", "rejected", "implemented", "rolled_back"];

export function Lifecycle() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"onboarding" | "offboarding" | "changes">("onboarding");

  // ── Onboarding state ──
  const [showCreateWf, setShowCreateWf] = useState(false);
  const [wfForm, setWfForm] = useState({ name: "", description: "", targetRole: "general", steps: [{ title: "", priority: "medium", description: "" }] });
  const [selectedAgentForOnboard, setSelectedAgentForOnboard] = useState("");
  const [selectedWfForOnboard, setSelectedWfForOnboard] = useState("");

  // ── Offboarding state ──
  const [offboardAgentId, setOffboardAgentId] = useState("");
  const [reassignToId, setReassignToId] = useState("");

  // ── Change Request state ──
  const [showCreateCR, setShowCreateCR] = useState(false);
  const [crForm, setCrForm] = useState({ title: "", description: "", category: "other", risk: "medium", validationSteps: "" });

  // Queries
  const { data: workflows = [] } = useQuery({ queryKey: queryKeys.lifecycle.onboardingWorkflows(cid), queryFn: () => lifecycleApi.listOnboardingWorkflows(cid), enabled: !!cid });
  const { data: instances = [] } = useQuery({ queryKey: queryKeys.lifecycle.onboardingInstances(cid), queryFn: () => lifecycleApi.listOnboardingInstances(cid), enabled: !!cid });
  const { data: agents = [] } = useQuery({ queryKey: queryKeys.agents.list(cid), queryFn: () => agentsApi.list(cid), enabled: !!cid });
  const { data: changeRequests = [] } = useQuery({ queryKey: queryKeys.lifecycle.changeRequests(cid), queryFn: () => lifecycleApi.listChangeRequests(cid), enabled: !!cid && activeTab === "changes" });

  const activeAgents = agents.filter((a: any) => a.status !== "terminated");
  const roleLabels: Record<string, string> = AGENT_ROLE_LABELS as any;

  // Mutations
  const createWfMut = useMutation({
    mutationFn: () => {
      const steps = wfForm.steps.filter(s => s.title.trim()).map((s, i, arr) => ({
        id: crypto.randomUUID(), title: s.title, description: s.description, priority: s.priority,
        dependsOnStepIds: [] as string[], autoAssign: true,
      }));
      for (let i = 1; i < steps.length; i++) steps[i].dependsOnStepIds = [steps[i - 1].id];
      return lifecycleApi.createOnboardingWorkflow(cid, { name: wfForm.name, description: wfForm.description, targetRole: wfForm.targetRole, steps } as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.lifecycle.onboardingWorkflows(cid) }); setShowCreateWf(false); setWfForm({ name: "", description: "", targetRole: "general", steps: [{ title: "", priority: "medium", description: "" }] }); pushToast({ title: "Workflow created", tone: "success", ttlMs: 3000 }); },
  });

  const deleteWfMut = useMutation({
    mutationFn: (id: string) => lifecycleApi.deleteOnboardingWorkflow(cid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.lifecycle.onboardingWorkflows(cid) }); pushToast({ title: "Deleted", tone: "success", ttlMs: 2000 }); },
  });

  const toggleWfMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => lifecycleApi.updateOnboardingWorkflow(cid, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lifecycle.onboardingWorkflows(cid) }),
  });

  const execOnboardMut = useMutation({
    mutationFn: () => lifecycleApi.executeOnboarding(cid, selectedAgentForOnboard, selectedWfForOnboard),
    onSuccess: (inst) => { qc.invalidateQueries({ queryKey: queryKeys.lifecycle.onboardingInstances(cid) }); pushToast({ title: `Onboarding started: ${inst.issueIds.length} tasks created`, tone: "success", ttlMs: 4000 }); },
    onError: (err) => pushToast({ title: "Failed", body: (err as Error).message, tone: "error" }),
  });

  const offboardMut = useMutation({
    mutationFn: () => lifecycleApi.offboardAgent(cid, offboardAgentId, reassignToId || undefined),
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(cid) });
      pushToast({ title: `${report.agentName} offboarded`, body: report.actions.join("; "), tone: "success", ttlMs: 5000 });
      setOffboardAgentId(""); setReassignToId("");
    },
    onError: (err) => pushToast({ title: "Failed", body: (err as Error).message, tone: "error" }),
  });

  const createCRMut = useMutation({
    mutationFn: () => lifecycleApi.createChangeRequest(cid, crForm as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.lifecycle.changeRequests(cid) }); setShowCreateCR(false); setCrForm({ title: "", description: "", category: "other", risk: "medium", validationSteps: "" }); pushToast({ title: "Change request created", tone: "success", ttlMs: 3000 }); },
  });

  const updateCRMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ChangeRequest> }) => lifecycleApi.updateChangeRequest(cid, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lifecycle.changeRequests(cid) }),
  });

  const deleteCRMut = useMutation({
    mutationFn: (id: string) => lifecycleApi.deleteChangeRequest(cid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.lifecycle.changeRequests(cid) }); pushToast({ title: "Deleted", tone: "success", ttlMs: 2000 }); },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <UserPlus className="h-5 w-5 text-teal-400" />
          <div>
            <h1 className="text-lg font-semibold">Lifecycle Management</h1>
            <p className="text-xs text-muted-foreground">Agent onboarding, offboarding, and change management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["onboarding", "offboarding", "changes"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize",
                activeTab === tab ? "bg-primary/10 text-primary border-primary/30 font-medium" : "border-border text-muted-foreground hover:text-foreground"
              )}>
              {tab === "changes" ? "Change Requests" : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ═══ ONBOARDING TAB ═══ */}
        {activeTab === "onboarding" && (
          <>
            {/* Execute onboarding */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Play className="h-4 w-4 text-emerald-400" /> Run Onboarding</h3>
              <div className="flex items-center gap-3">
                <select value={selectedAgentForOnboard} onChange={e => setSelectedAgentForOnboard(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                  <option value="">Select agent...</option>
                  {activeAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({roleLabels[a.role] ?? a.role})</option>)}
                </select>
                <select value={selectedWfForOnboard} onChange={e => setSelectedWfForOnboard(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                  <option value="">Select workflow...</option>
                  {workflows.filter(w => w.enabled).map(w => <option key={w.id} value={w.id}>{w.name} ({w.targetRole})</option>)}
                </select>
                <button onClick={() => execOnboardMut.mutate()} disabled={!selectedAgentForOnboard || !selectedWfForOnboard || execOnboardMut.isPending}
                  className="px-4 py-2 text-xs rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                  {execOnboardMut.isPending ? "Running..." : "Start"}
                </button>
              </div>
            </div>

            {/* Recent instances */}
            {instances.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent Onboarding ({instances.length})</h3>
                <div className="space-y-1.5">
                  {instances.map(inst => (
                    <div key={inst.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/50">
                      <CheckCircle2 className={cn("h-4 w-4", inst.status === "completed" ? "text-emerald-400" : "text-amber-400")} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{inst.agentName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{inst.workflowName} · {inst.issueIds.length} tasks</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(inst.startedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflows */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Onboarding Workflows ({workflows.length})</h3>
              <button onClick={() => setShowCreateWf(!showCreateWf)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3 w-3" /> New Workflow
              </button>
            </div>

            {showCreateWf && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Create Onboarding Workflow</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-[11px] font-medium text-muted-foreground">Name</label>
                    <input value={wfForm.name} onChange={e => setWfForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="e.g. Engineer Onboarding" /></div>
                  <div><label className="text-[11px] font-medium text-muted-foreground">Target Role</label>
                    <select value={wfForm.targetRole} onChange={e => setWfForm(f => ({ ...f, targetRole: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                      {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select></div>
                  <div><label className="text-[11px] font-medium text-muted-foreground">Description</label>
                    <input value={wfForm.description} onChange={e => setWfForm(f => ({ ...f, description: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" /></div>
                </div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Steps</label>
                  <div className="space-y-1.5 mt-1">
                    {wfForm.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{i + 1}</span>
                        <input value={s.title} onChange={e => { const next = [...wfForm.steps]; next[i] = { ...next[i], title: e.target.value }; setWfForm(f => ({ ...f, steps: next })); }}
                          className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg" placeholder={`Step ${i + 1}`} />
                        {wfForm.steps.length > 1 && <button onClick={() => setWfForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    ))}
                    <button onClick={() => setWfForm(f => ({ ...f, steps: [...f.steps, { title: "", priority: "medium", description: "" }] }))} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Step</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => createWfMut.mutate()} disabled={!wfForm.name.trim() || createWfMut.isPending} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Create</button>
                  <button onClick={() => setShowCreateWf(false)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {workflows.map(wf => (
                <div key={wf.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wf.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400">{roleLabels[wf.targetRole] ?? wf.targetRole}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{wf.steps.length} steps</span>
                      {wf.usageCount > 0 && <span className="text-[10px] text-muted-foreground">Used {wf.usageCount}x</span>}
                      {!wf.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">Disabled</span>}
                    </div>
                    {wf.description && <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>}
                  </div>
                  <button onClick={() => toggleWfMut.mutate({ id: wf.id, enabled: !wf.enabled })} className="text-muted-foreground hover:text-foreground">
                    {wf.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => deleteWfMut.mutate(wf.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {workflows.length === 0 && !showCreateWf && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <UserPlus className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No onboarding workflows yet</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ OFFBOARDING TAB ═══ */}
        {activeTab === "offboarding" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserMinus className="h-5 w-5 text-red-400" />
                <h3 className="text-sm font-semibold text-red-400">Offboard Agent</h3>
              </div>
              <p className="text-xs text-muted-foreground">Offboarding will: reassign or unassign open tasks, revoke active vault checkouts, and set the agent to terminated status.</p>

              <div className="space-y-3">
                <div><label className="text-[11px] font-medium text-muted-foreground">Agent to offboard</label>
                  <select value={offboardAgentId} onChange={e => setOffboardAgentId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                    <option value="">Select agent...</option>
                    {activeAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({roleLabels[a.role] ?? a.role})</option>)}
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Reassign open tasks to (optional)</label>
                  <select value={reassignToId} onChange={e => setReassignToId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                    <option value="">Unassign tasks (no reassignment)</option>
                    {activeAgents.filter((a: any) => a.id !== offboardAgentId).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => offboardMut.mutate()} disabled={!offboardAgentId || offboardMut.isPending}
                  className="px-4 py-2 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                  {offboardMut.isPending ? "Processing..." : "Offboard Agent"}
                </button>
                {offboardAgentId && <p className="text-[10px] text-red-400">This action cannot be undone.</p>}
              </div>
            </div>

            {offboardMut.data && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Offboarding Report</h4>
                <div className="space-y-1 text-xs">
                  {offboardMut.data.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-muted-foreground" /><span>{a}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ CHANGE REQUESTS TAB ═══ */}
        {activeTab === "changes" && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Change Requests ({changeRequests.length})</h3>
              <button onClick={() => setShowCreateCR(!showCreateCR)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3 w-3" /> New Request
              </button>
            </div>

            {showCreateCR && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold">Create Change Request</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[11px] font-medium text-muted-foreground">Title</label>
                    <input value={crForm.title} onChange={e => setCrForm(f => ({ ...f, title: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="e.g. Update engineer agent model" /></div>
                  <div><label className="text-[11px] font-medium text-muted-foreground">Category</label>
                    <select value={crForm.category} onChange={e => setCrForm(f => ({ ...f, category: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select></div>
                  <div><label className="text-[11px] font-medium text-muted-foreground">Risk Level</label>
                    <select value={crForm.risk} onChange={e => setCrForm(f => ({ ...f, risk: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                      {RISKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select></div>
                  <div><label className="text-[11px] font-medium text-muted-foreground">Validation Steps</label>
                    <input value={crForm.validationSteps} onChange={e => setCrForm(f => ({ ...f, validationSteps: e.target.value }))} className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="How to verify the change" /></div>
                </div>
                <div><label className="text-[11px] font-medium text-muted-foreground">Description</label>
                  <textarea value={crForm.description} onChange={e => setCrForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" /></div>
                <div className="flex gap-2">
                  <button onClick={() => createCRMut.mutate()} disabled={!crForm.title.trim() || createCRMut.isPending} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Create</button>
                  <button onClick={() => setShowCreateCR(false)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {changeRequests.map(cr => (
                <div key={cr.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{cr.title}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold", STATUS_COLORS[cr.status] ?? "")}>
                          {cr.status.replace(/_/g, " ")}
                        </span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", RISK_COLORS[cr.risk] ?? "")}>
                          {cr.risk} risk
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{cr.category.replace(/_/g, " ")}</span>
                      </div>
                      {cr.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cr.description}</p>}
                      {cr.affectedAgentNames && cr.affectedAgentNames.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Affects: {cr.affectedAgentNames.join(", ")}</p>
                      )}
                    </div>
                    {/* Status transitions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {cr.status === "draft" && (
                        <button onClick={() => updateCRMut.mutate({ id: cr.id, patch: { status: "pending_review" } })}
                          className="px-2 py-1 text-[10px] rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">Submit</button>
                      )}
                      {cr.status === "pending_review" && (
                        <>
                          <button onClick={() => updateCRMut.mutate({ id: cr.id, patch: { status: "approved" } })}
                            className="px-2 py-1 text-[10px] rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Approve</button>
                          <button onClick={() => updateCRMut.mutate({ id: cr.id, patch: { status: "rejected" } })}
                            className="px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Reject</button>
                        </>
                      )}
                      {cr.status === "approved" && (
                        <button onClick={() => updateCRMut.mutate({ id: cr.id, patch: { status: "implemented" } })}
                          className="px-2 py-1 text-[10px] rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">Implement</button>
                      )}
                      {cr.status === "implemented" && (
                        <button onClick={() => updateCRMut.mutate({ id: cr.id, patch: { status: "rolled_back" } })}
                          className="px-2 py-1 text-[10px] rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20">Rollback</button>
                      )}
                      <button onClick={() => deleteCRMut.mutate(cr.id)} className="text-muted-foreground hover:text-red-400 ml-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {changeRequests.length === 0 && !showCreateCR && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">No change requests</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
