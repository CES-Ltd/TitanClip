import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AGENT_ADAPTER_TYPES,
  AGENT_ROLES,
  AGENT_ROLE_LABELS,
  type AgentAdapterType,
  type AgentRole,
} from "@titanclip/shared";
import type { AgentTemplate, CreateAgentTemplate } from "@titanclip/shared";
import { Lock, LockOpen, ShieldCheck, KeyRound, Plus, Pencil, Trash2, FileText, Globe, EyeOff, Shield, Server, Database, AlertTriangle, Users, Bot, Clock } from "lucide-react";
import { adminSettingsApi } from "@/api/adminSettings";
import { permissionPoliciesApi } from "../api/permissionPolicies";
import { agentsApi } from "../api/agents";
import { useAdminSession } from "../context/AdminSessionContext";
import { useCompany } from "../context/CompanyContext";
import { AdminPinDialog } from "../components/AdminPinDialog";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "../lib/utils";
import { ComplianceDisclaimer } from "../components/ComplianceDisclaimer";
import { HttpEndpointModelFetcher } from "../components/admin/HttpEndpointModelFetcher";

const ADAPTER_LABELS: Record<string, string> = {
  process: "Process",
  http: "HTTP",
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  pi_local: "Pi",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw",
  hermes_local: "Hermes",
  universal_llm: "Universal LLM",
  openai_compatible: "OpenAI-Compatible",
};

export function InstanceAdminSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { isUnlocked, token, authMode, lock } = useAdminSession();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("adapters");

  // Change PIN state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Template state
  const [editingTemplate, setEditingTemplate] = useState<AgentTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  const [tplRole, setTplRole] = useState("general");
  const [tplBudget, setTplBudget] = useState(0);
  const [tplPolicyId, setTplPolicyId] = useState<string | null>(null);
  const [selectedAdapterForModels, setSelectedAdapterForModels] = useState<string | null>(null);
  const [tplStatus, setTplStatus] = useState<"available" | "draft">("draft");
  const [tplSoul, setTplSoul] = useState("");
  const [tplHeartbeat, setTplHeartbeat] = useState("");
  const [tplAgents, setTplAgents] = useState("");
  const [tplError, setTplError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "Admin" },
    ]);
  }, [setBreadcrumbs]);

  const adminQuery = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
  });

  const { data: allPolicies = [] } = useQuery({
    queryKey: ["permission-policies"],
    queryFn: () => permissionPoliciesApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof adminSettingsApi.update>[0]) =>
      adminSettingsApi.update(patch, token!),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update admin settings.");
    },
  });

  const changePinMutation = useMutation({
    mutationFn: () => adminSettingsApi.changePin(currentPin, newPin, token!),
    onSuccess: () => {
      setPinError(null);
      setPinSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setPinSuccess(false), 3000);
    },
    onError: (error) => {
      setPinError(error instanceof Error ? error.message : "Failed to change PIN.");
    },
  });

  // Template queries & mutations
  const templatesQuery = useQuery({
    queryKey: queryKeys.instance.adminTemplates,
    queryFn: () => adminSettingsApi.listTemplates(token!),
    enabled: isUnlocked && !!token,
  });

  const createTemplateMutation = useMutation({
    mutationFn: (input: CreateAgentTemplate) => adminSettingsApi.createTemplate(input, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminTemplates });
      resetTemplateForm();
    },
    onError: (err) => setTplError(err instanceof Error ? err.message : "Failed to create template."),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      adminSettingsApi.updateTemplate(id, patch as any, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminTemplates });
      resetTemplateForm();
    },
    onError: (err) => setTplError(err instanceof Error ? err.message : "Failed to update template."),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => adminSettingsApi.deleteTemplate(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminTemplates }),
  });

  const publishTemplateMutation = useMutation({
    mutationFn: (id: string) => adminSettingsApi.updateTemplate(id, { status: "available" } as any, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminTemplates }),
  });

  const unpublishTemplateMutation = useMutation({
    mutationFn: (id: string) => adminSettingsApi.updateTemplate(id, { status: "draft" } as any, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.instance.adminTemplates }),
  });

  function resetTemplateForm() {
    setShowTemplateForm(false);
    setEditingTemplate(null);
    setTplName(""); setTplDescription(""); setTplRole("general");
    setTplBudget(0); setTplPolicyId(null); setTplStatus("draft");
    setTplSoul(""); setTplHeartbeat(""); setTplAgents(""); setTplError(null);
  }

  function openEditTemplate(t: AgentTemplate) {
    setEditingTemplate(t);
    setTplName(t.name); setTplDescription(t.description); setTplRole(t.role);
    setTplBudget(t.defaultBudgetMonthlyCents); setTplPolicyId(t.permissionPolicyId ?? null);
    setTplStatus(t.status); setTplSoul(t.soulMd); setTplHeartbeat(t.heartbeatMd); setTplAgents(t.agentsMd);
    setShowTemplateForm(true);
  }

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setTplError(null);
    if (!tplName.trim()) { setTplError("Name is required."); return; }
    const payload = {
      name: tplName.trim(), description: tplDescription, role: tplRole,
      soulMd: tplSoul, heartbeatMd: tplHeartbeat, agentsMd: tplAgents,
      defaultBudgetMonthlyCents: tplBudget, permissionPolicyId: tplPolicyId,
      status: tplStatus,
    };
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, patch: payload });
    } else {
      createTemplateMutation.mutate(payload as CreateAgentTemplate);
    }
  }

  if (adminQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading admin settings...</div>;
  }

  const data = adminQuery.data;
  const allowedAdapters = data?.allowedAdapterTypes ?? null;
  const allowedRoles = data?.allowedRoles ?? null;
  const allowedModels = data?.allowedModelsPerAdapter ?? null;
  const allAdaptersAllowed = allowedAdapters === null;
  const allRolesAllowed = allowedRoles === null;

  // Fetch models for selected adapter in 2-pane view
  const { data: fetchedAdapterModels, isLoading: adapterModelsLoading } = useQuery({
    queryKey: ["adapter-models-admin", selectedAdapterForModels],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, selectedAdapterForModels!),
    enabled: !!selectedAdapterForModels && !!selectedCompanyId,
  });

  function toggleAdapter(type: string) {
    if (!isUnlocked) return;
    if (allAdaptersAllowed) {
      // Switch from "all" to explicit list with this one removed
      updateMutation.mutate({
        allowedAdapterTypes: AGENT_ADAPTER_TYPES.filter((t) => t !== type) as string[],
      });
    } else {
      const current = allowedAdapters!;
      const next = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      updateMutation.mutate({
        allowedAdapterTypes: next.length === AGENT_ADAPTER_TYPES.length ? null : next,
      });
    }
  }

  function toggleAllAdapters() {
    if (!isUnlocked) return;
    updateMutation.mutate({ allowedAdapterTypes: allAdaptersAllowed ? [] : null });
  }

  function toggleRole(role: string) {
    if (!isUnlocked) return;
    if (allRolesAllowed) {
      updateMutation.mutate({
        allowedRoles: AGENT_ROLES.filter((r) => r !== role) as string[],
      });
    } else {
      const current = allowedRoles!;
      const next = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      updateMutation.mutate({
        allowedRoles: next.length === AGENT_ROLES.length ? null : next,
      });
    }
  }

  function toggleAllRoles() {
    if (!isUnlocked) return;
    updateMutation.mutate({ allowedRoles: allRolesAllowed ? [] : null });
  }

  function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    if (newPin.length < 4) {
      setPinError("New PIN must be at least 4 characters.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and confirmation do not match.");
      return;
    }
    changePinMutation.mutate();
  }

  const isAdapterChecked = (type: string) =>
    allAdaptersAllowed || allowedAdapters!.includes(type);

  const isRoleChecked = (role: string) =>
    allRolesAllowed || allowedRoles!.includes(role);

  const SECTIONS = [
    { id: "adapters", label: "Adapters & Models", icon: Server, group: "Security & Access" },
    { id: "roles", label: "Allowed Roles", icon: Users, group: "Security & Access" },
    { id: "pin", label: "Admin PIN", icon: KeyRound, group: "Security & Access" },
    { id: "templates", label: "Agent Templates", icon: Bot, group: "Agent Governance" },
    { id: "session-agents", label: "Session Agents", icon: Clock, group: "Agent Governance" },
    { id: "retention", label: "Data Retention", icon: Database, group: "Data & Retention" },
    { id: "workspaces", label: "Workspace Governance", icon: Globe, group: "Infrastructure" },
    { id: "otel", label: "OpenTelemetry", icon: Server, group: "Infrastructure" },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle, group: "Danger Zone" },
  ];

  const groups = [...new Set(SECTIONS.map((s) => s.group))];

  return (
    <div className="space-y-4">
      {/* Header with lock/unlock */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Admin Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Governance, security, and infrastructure configuration.
          </p>
        </div>
        {isUnlocked ? (
          <Button variant="outline" size="sm" onClick={lock} className="gap-2">
            <LockOpen className="h-4 w-4" /> Lock
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={() => setPinDialogOpen(true)} className="gap-2">
            <Lock className="h-4 w-4" /> Unlock
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* 2-Pane Layout */}
      <div className={cn("flex gap-6 min-h-[500px]", !isUnlocked && "opacity-50 pointer-events-none select-none")}>

        {/* Left Pane — Section Menu */}
        <nav className="w-52 shrink-0 space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <div className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-1",
                group === "Danger Zone" ? "text-red-500" : "text-muted-foreground/60"
              )}>
                {group}
              </div>
              {SECTIONS.filter((s) => s.group === group).map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                      isActive
                        ? section.id === "danger"
                          ? "bg-red-500/10 text-red-500 font-medium"
                          : "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {section.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Right Pane — Section Content */}
        <div className="flex-1 min-w-0">

      {/* === Section: Adapters & Models === */}
      {activeSection === "adapters" && (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
            <h3 className="font-medium text-sm">Adapters & Models</h3>
            <Button variant="ghost" size="sm" onClick={toggleAllAdapters} disabled={updateMutation.isPending}>
              {allAdaptersAllowed ? "Restrict All" : "Enable All"}
            </Button>
          </div>
          <div className="flex" style={{ minHeight: "280px" }}>
            {/* Left: Adapter list */}
            <div className="w-[200px] border-r overflow-y-auto">
              {AGENT_ADAPTER_TYPES.map((type) => {
                const enabled = isAdapterChecked(type);
                const selected = selectedAdapterForModels === type;
                return (
                  <div key={type} className={cn(
                    "flex items-center justify-between px-3 py-2.5 cursor-pointer border-b border-border/20 transition-colors",
                    selected ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/20",
                  )} onClick={() => setSelectedAdapterForModels(type)}>
                    <span className={cn("text-xs", enabled ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {ADAPTER_LABELS[type] ?? type}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAdapter(type); }}
                      className={cn("w-8 h-4 rounded-full transition-colors relative",
                        enabled ? "bg-emerald-500" : "bg-zinc-600"
                      )}
                    >
                      <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                        enabled ? "left-4" : "left-0.5"
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Right: Models for selected adapter */}
            <div className="flex-1 overflow-y-auto p-3">
              {!selectedAdapterForModels ? (
                <p className="text-xs text-muted-foreground text-center py-8">Select an adapter to manage its models</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium">Models for {ADAPTER_LABELS[selectedAdapterForModels]}</h4>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const current = allowedModels?.[selectedAdapterForModels];
                      if (current === null || current === undefined) {
                        updateMutation.mutate({ allowedModelsPerAdapter: { ...(allowedModels ?? {}), [selectedAdapterForModels]: [] } });
                      } else {
                        updateMutation.mutate({ allowedModelsPerAdapter: { ...(allowedModels ?? {}), [selectedAdapterForModels]: null } });
                      }
                    }} className="text-xs h-6">
                      {(allowedModels?.[selectedAdapterForModels] === null || allowedModels?.[selectedAdapterForModels] === undefined) ? "Restrict" : "Allow All"}
                    </Button>
                  </div>
                  {adapterModelsLoading && <p className="text-xs text-muted-foreground">Loading models...</p>}
                  {(fetchedAdapterModels ?? []).map((m: any) => {
                    const modelList = allowedModels?.[selectedAdapterForModels];
                    const checked = modelList === null || modelList === undefined || modelList.includes(m.id);
                    return (
                      <label key={m.id} className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors",
                        checked ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border text-muted-foreground",
                      )}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          const current = allowedModels?.[selectedAdapterForModels] ?? null;
                          let next: string[] | null;
                          if (current === null || current === undefined) {
                            next = (fetchedAdapterModels ?? []).filter((x: any) => x.id !== m.id).map((x: any) => x.id);
                          } else {
                            next = checked ? current.filter((x: string) => x !== m.id) : [...current, m.id];
                          }
                          updateMutation.mutate({ allowedModelsPerAdapter: { ...(allowedModels ?? {}), [selectedAdapterForModels]: next.length === (fetchedAdapterModels ?? []).length ? null : next } });
                        }} className="rounded" />
                        <span>{m.label ?? m.id}</span>
                      </label>
                    );
                  })}
                  {(fetchedAdapterModels ?? []).length === 0 && !adapterModelsLoading && (
                    <p className="text-xs text-muted-foreground text-center py-4">No models available from local adapter metadata</p>
                  )}

                  {/* HTTP endpoint model discovery for openai_compatible / universal_llm */}
                  {(selectedAdapterForModels === "openai_compatible" || selectedAdapterForModels === "universal_llm") && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <HttpEndpointModelFetcher
                        allowedModels={allowedModels?.[selectedAdapterForModels] ?? null}
                        onModelsChange={(models) => {
                          updateMutation.mutate({
                            allowedModelsPerAdapter: {
                              ...(allowedModels ?? {}),
                              [selectedAdapterForModels!]: models,
                            },
                          });
                        }}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      )}

      {/* === Section: Allowed Roles === */}
      {activeSection === "roles" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Allowed Agent Roles</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllRoles}
              disabled={updateMutation.isPending}
            >
              {allRolesAllowed ? "Restrict" : "Allow All"}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AGENT_ROLES.map((role) => (
              <label
                key={role}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors",
                  isRoleChecked(role)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/30 border-border text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={isRoleChecked(role)}
                  onChange={() => toggleRole(role)}
                  disabled={updateMutation.isPending}
                  className="rounded"
                />
                {AGENT_ROLE_LABELS[role as AgentRole] ?? role}
              </label>
            ))}
          </div>
        </div>

      )}

      {/* === Section: Admin PIN === */}
      {activeSection === "pin" && authMode !== "sso" && (
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Change Admin PIN
            </h3>
            <form onSubmit={handleChangePin} className="space-y-3 max-w-sm">
              <div className="space-y-1">
                <Label htmlFor="current-pin" className="text-xs">Current PIN</Label>
                <Input
                  id="current-pin"
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-pin" className="text-xs">New PIN</Label>
                <Input
                  id="new-pin"
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-pin" className="text-xs">Confirm New PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  autoComplete="off"
                  disabled={changePinMutation.isPending}
                />
              </div>
              {pinError && (
                <p className="text-sm text-destructive">{pinError}</p>
              )}
              {pinSuccess && (
                <p className="text-sm text-green-500">PIN changed successfully.</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={changePinMutation.isPending || !currentPin || !newPin || !confirmPin}
              >
                {changePinMutation.isPending ? "Changing..." : "Change PIN"}
              </Button>
            </form>
          </div>
      )}

      {/* === Section: Session Agents === */}
      {activeSection === "session-agents" && (
        <div className="space-y-3 rounded-lg border border-indigo-500/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Session Agents</h3>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">Beta</span>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Allow Agent OS to create temporary session agents on-the-fly when no matching template is found.
                Session agents inherit their parent's IAM permissions, require explicit user approval, and
                automatically expire after 24 hours.
              </p>
            </div>
            <button
              type="button"
              aria-label="Toggle session agents"
              disabled={updateMutation.isPending}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                (data as any)?.enableSessionAgents ? "bg-indigo-600" : "bg-muted",
              )}
              onClick={() => updateMutation.mutate({ enableSessionAgents: !(data as any)?.enableSessionAgents } as any)}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                (data as any)?.enableSessionAgents ? "translate-x-4.5" : "translate-x-0.5",
              )} />
            </button>
          </div>
          <ComplianceDisclaimer severity="warning" />
        </div>
      )}

      {/* === Section: Agent Templates === */}
      {activeSection === "templates" && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Agent Templates
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { resetTemplateForm(); setShowTemplateForm(true); }}
              disabled={!isUnlocked}
              className="gap-1"
            >
              <Plus className="h-3 w-3" /> Create Template
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pre-configured agent blueprints with instructions. Available templates can be used by non-admin users when creating agents.
          </p>

          {/* Template list */}
          {(templatesQuery.data ?? []).length === 0 && !showTemplateForm && (
            <p className="text-xs text-muted-foreground py-4 text-center">No templates yet. Create one to get started.</p>
          )}
          <div className="flex flex-col gap-2">
            {(templatesQuery.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      t.status === "available" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500",
                    )}>
                      {t.status === "available" ? "Available" : "Draft"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {AGENT_ROLE_LABELS[t.role as AgentRole] ?? t.role}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {t.status === "draft" ? (
                    <Button variant="ghost" size="sm" onClick={() => publishTemplateMutation.mutate(t.id)}
                      disabled={publishTemplateMutation.isPending}
                      className="h-7 px-2 gap-1 text-emerald-500 hover:text-emerald-400 text-xs">
                      <Globe className="h-3 w-3" /> Publish
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => unpublishTemplateMutation.mutate(t.id)}
                      disabled={unpublishTemplateMutation.isPending}
                      className="h-7 px-2 gap-1 text-amber-500 hover:text-amber-400 text-xs">
                      <EyeOff className="h-3 w-3" /> Unpublish
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEditTemplate(t)} className="h-7 w-7 p-0">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteTemplateMutation.mutate(t.id); }} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Template editor form */}
          {showTemplateForm && (
            <form onSubmit={handleSaveTemplate} className="space-y-3 rounded-md border p-4 bg-background mt-2">
              <h4 className="text-sm font-medium">{editingTemplate ? "Edit Template" : "New Template"}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="e.g. Senior Engineer" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <select value={tplRole} onChange={(e) => setTplRole(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    {AGENT_ROLES.map((r) => <option key={r} value={r}>{AGENT_ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Permission Policy</Label>
                  <select value={tplPolicyId ?? ""} onChange={(e) => setTplPolicyId(e.target.value || null)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    <option value="">No policy (full access)</option>
                    {allPolicies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Default Budget ($/month)</Label>
                  <Input type="number" value={tplBudget / 100} onChange={(e) => setTplBudget(Math.round(Number(e.target.value) * 100))} min={0} step={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <select value={tplStatus} onChange={(e) => setTplStatus(e.target.value as "available" | "draft")} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                    <option value="draft">Draft</option>
                    <option value="available">Available</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={tplDescription} onChange={(e) => setTplDescription(e.target.value)} placeholder="What this agent does..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SOUL.md (Persona & Voice)</Label>
                <textarea value={tplSoul} onChange={(e) => setTplSoul(e.target.value)} rows={8}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y"
                  placeholder="# SOUL.md&#10;&#10;You are a..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HEARTBEAT.md (Periodic Task Logic)</Label>
                <textarea value={tplHeartbeat} onChange={(e) => setTplHeartbeat(e.target.value)} rows={8}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y"
                  placeholder="# HEARTBEAT.md&#10;&#10;Run this checklist..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AGENTS.md (Instructions & Skills)</Label>
                <textarea value={tplAgents} onChange={(e) => setTplAgents(e.target.value)} rows={8}
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y"
                  placeholder="# AGENTS.md&#10;&#10;## Skills&#10;..." />
              </div>
              {tplError && <p className="text-sm text-destructive">{tplError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
                  {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetTemplateForm}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* === Section: Data Retention === */}
      {activeSection === "retention" && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Database className="h-4 w-4" /> Data Retention
          </h3>
          <p className="text-xs text-muted-foreground">Data retention is configured via the admin API. Current policies are shown in the governance settings.</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Run Logs</span><br/><strong>{data?.retentionRunLogsDays ?? 90} days</strong></div>
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Activity</span><br/><strong>{data?.retentionActivityDays ?? 365} days</strong></div>
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Cost Events</span><br/><strong>{data?.retentionCostEventsDays ?? 365} days</strong></div>
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Token Audit</span><br/><strong>{data?.retentionTokenAuditDays ?? 180} days</strong></div>
          </div>
        </div>
      )}

      {/* === Section: Workspace Governance === */}
      {activeSection === "workspaces" && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" /> Workspace Governance
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Auto-Cleanup</span><br/><strong>{data?.workspaceAutoCleanupHours ?? 24} hours</strong></div>
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Max Disk</span><br/><strong>{data?.maxWorkspaceDiskMb ?? 5120} MB</strong></div>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Protected Branches:</span>{" "}
            <strong>{(data?.protectedBranches ?? ["main", "master"]).join(", ")}</strong>
          </div>
        </div>
      )}

      {/* === Section: OpenTelemetry === */}
      {activeSection === "otel" && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Server className="h-4 w-4" /> OpenTelemetry
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Enabled</span><br/><strong>{data?.otelEnabled ? "Yes" : "No"}</strong></div>
            <div className="rounded-md border p-3"><span className="text-muted-foreground">Sample Rate</span><br/><strong>{data?.otelSampleRate ?? 1.0}</strong></div>
            <div className="rounded-md border p-3 col-span-2"><span className="text-muted-foreground">Endpoint</span><br/><strong className="break-all">{data?.otelEndpoint ?? "http://localhost:4318"}</strong></div>
          </div>
        </div>
      )}

      {/* === Section: Danger Zone === */}
      {activeSection === "danger" && token && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider">Danger Zone Settings</h2>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              Not Recommended
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            These settings can expose your system to significant risk. Only enable them if you fully understand the consequences.
          </p>

          <div className="rounded-xl border border-red-500/30 bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Allow Autonomous Mode for Agents</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    Dangerous
                  </span>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  When enabled, agents can be set to "autonomous" autonomy level which grants unrestricted tool execution
                  — including shell commands, file writes, and destructive operations — without any approval gates.
                  Only "sandboxed" and "supervised" modes are available when this is disabled.
                </p>
              </div>
              <button
                type="button"
                data-slot="toggle"
                aria-label="Toggle autonomous mode"
                disabled={updateMutation.isPending}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  (data as any)?.allowAutonomousMode ? "bg-red-600" : "bg-muted",
                )}
                onClick={() =>
                  updateMutation.mutate({
                    allowAutonomousMode: !(data as any)?.allowAutonomousMode,
                  } as any)
                }
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                    (data as any)?.allowAutonomousMode ? "translate-x-4.5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </div>
          <ComplianceDisclaimer severity="danger" />
        </div>
      )}

        </div>{/* end right pane */}
      </div>{/* end 2-pane flex */}

      {/* PIN Dialog */}
      <AdminPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
    </div>
  );
}
