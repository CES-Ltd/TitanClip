import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Clock,
  ShieldAlert, XCircle, RefreshCw,
} from "lucide-react";
import { slaApi } from "../api/sla";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { EscalationRule } from "@titanclip/shared";

const TRIGGER_OPTIONS = [
  { value: "sla_breach", label: "SLA Breach", desc: "Fires when N SLA breaches are active" },
  { value: "error_count", label: "Error Count", desc: "Fires when N errors occur in the last hour" },
  { value: "idle_time", label: "Agent Idle Time", desc: "Fires when an agent is idle for N minutes" },
  { value: "consecutive_failures", label: "Consecutive Failures", desc: "Fires when an agent has N consecutive failed runs" },
];

const ACTION_OPTIONS = [
  { value: "notify", label: "Notify" },
  { value: "reassign", label: "Reassign Task" },
  { value: "escalate_to_manager", label: "Escalate to Manager" },
  { value: "pause_agent", label: "Pause Agent" },
  { value: "restart_agent", label: "Restart Agent" },
];

function TriggerBadge({ trigger }: { trigger: string }) {
  const t = TRIGGER_OPTIONS.find(o => o.value === trigger);
  const colors: Record<string, string> = {
    sla_breach: "bg-red-500/10 text-red-400 border-red-500/20",
    error_count: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    idle_time: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    consecutive_failures: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", colors[trigger] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
      {t?.label ?? trigger}
    </span>
  );
}

export function EscalationRules() {
  const { selectedCompany } = useCompany();
  const cid = selectedCompany?.id ?? "";
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", trigger: "sla_breach",
    triggerThreshold: 3, action: "notify", cooldownMinutes: 60,
  });

  const { data: rules = [] } = useQuery({
    queryKey: queryKeys.escalation.rules(cid),
    queryFn: () => slaApi.listEscalationRules(cid),
    enabled: !!cid,
  });

  const createMut = useMutation({
    mutationFn: () => slaApi.createEscalationRule(cid, form as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.escalation.rules(cid) });
      setShowCreate(false);
      setForm({ name: "", description: "", trigger: "sla_breach", triggerThreshold: 3, action: "notify", cooldownMinutes: 60 });
      pushToast({ title: "Rule created", tone: "success", ttlMs: 3000 });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => slaApi.deleteEscalationRule(cid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.escalation.rules(cid) });
      pushToast({ title: "Rule deleted", tone: "success", ttlMs: 3000 });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => slaApi.updateEscalationRule(cid, id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.escalation.rules(cid) }),
  });

  const evalMut = useMutation({
    mutationFn: () => slaApi.evaluateEscalation(cid),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.escalation.rules(cid) });
      pushToast({ title: result.fired > 0 ? `${result.fired} rule(s) fired` : "No rules triggered", tone: result.fired > 0 ? "warn" : "success", ttlMs: 4000 });
    },
  });

  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.value === form.trigger);

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-orange-400" />
          <div>
            <h1 className="text-lg font-semibold">Escalation Rules</h1>
            <p className="text-xs text-muted-foreground">Automated responses to SLA breaches, errors, and idle agents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => evalMut.mutate()} disabled={evalMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
            <RefreshCw className={cn("h-3 w-3", evalMut.isPending && "animate-spin")} /> Evaluate Now
          </button>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3 w-3" /> New Rule
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Create Escalation Rule</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="e.g. Critical SLA Escalation" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Trigger</label>
                <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30">
                  {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {selectedTrigger && <p className="text-[10px] text-muted-foreground mt-1">{selectedTrigger.desc}</p>}
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Threshold</label>
                <input type="number" value={form.triggerThreshold} onChange={e => setForm(f => ({ ...f, triggerThreshold: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Action</label>
                <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30">
                  {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Cooldown (minutes)</label>
                <input type="number" value={form.cooldownMinutes} onChange={e => setForm(f => ({ ...f, cooldownMinutes: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending}
                className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createMut.isPending ? "Creating..." : "Create Rule"}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted/30">Cancel</button>
            </div>
          </div>
        )}

        {/* Rules list */}
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{rule.name}</span>
                  <TriggerBadge trigger={rule.trigger} />
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    threshold: {rule.triggerThreshold}
                  </span>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{rule.action.replace(/_/g, " ")}</span>
                  {!rule.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">Disabled</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cooldown: {rule.cooldownMinutes}m
                  {rule.fireCount > 0 && ` · Fired ${rule.fireCount}x`}
                  {rule.lastFiredAt && ` · Last: ${new Date(rule.lastFiredAt).toLocaleString()}`}
                </p>
                {rule.description && <p className="text-xs text-muted-foreground/60 mt-0.5">{rule.description}</p>}
              </div>
              <button onClick={() => toggleMut.mutate({ id: rule.id, enabled: !rule.enabled })}
                className="text-muted-foreground hover:text-foreground transition-colors" title={rule.enabled ? "Disable" : "Enable"}>
                {rule.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <button onClick={() => deleteMut.mutate(rule.id)}
                className="text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">No escalation rules defined</p>
              <p className="text-xs mt-1">Create rules to automatically respond to SLA breaches and agent issues</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
