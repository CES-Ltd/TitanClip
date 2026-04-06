import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Sparkles, X, ChevronDown, Users } from "lucide-react";
import { adminSettingsApi } from "../api/adminSettings";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { useAdminGovernance } from "../context/AdminGovernanceContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { generateSprite, generateAgentNumber, generateVillainAgentName } from "../lib/pixel-sprite";
import { instanceSettingsApi } from "../api/instanceSettings";
import { adapterLabels, roleLabels } from "../components/agent-config-primitives";
import type { AgentTemplate } from "@titanclip/shared";

const ROLE_BADGE_COLORS: Record<string, string> = {
  ceo: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  cto: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  cmo: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  cfo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  engineer: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  designer: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  pm: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  qa: "bg-green-500/15 text-green-400 border-green-500/20",
  devops: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  researcher: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  general: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const SUPPORTED_ADAPTERS = [
  "titanclaw_local", "claude_local", "codex_local", "gemini_local", "opencode_local",
  "pi_local", "cursor", "hermes_local", "openclaw_gateway",
];

export function AgentGallery() {
  const { selectedCompany, selectedCompanyId: cid } = useCompany();
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const governance = useAdminGovernance();

  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const funModeEnabled = experimentalSettings?.enableFunMode === true;

  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [hireAdapter, setHireAdapter] = useState("");
  const [hireModel, setHireModel] = useState("");
  const [hireReportsTo, setHireReportsTo] = useState("");

  // Data
  const { data: templates = [] } = useQuery({
    queryKey: queryKeys.instance.availableTemplates,
    queryFn: () => adminSettingsApi.listAvailableTemplates(),
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid!),
    queryFn: () => agentsApi.list(cid!),
    enabled: !!cid,
  });

  const { data: models = [] } = useQuery({
    queryKey: queryKeys.agents.adapterModels(cid!, hireAdapter),
    queryFn: () => agentsApi.adapterModels(cid!, hireAdapter),
    enabled: !!cid && !!hireAdapter,
  });

  const activeAgents = agents.filter((a: any) => a.status !== "terminated");

  // Filter adapters by governance
  const availableAdapters = useMemo(() => {
    if (governance.allowedAdapterTypes) {
      return SUPPORTED_ADAPTERS.filter(a => governance.allowedAdapterTypes!.includes(a));
    }
    return SUPPORTED_ADAPTERS;
  }, [governance.allowedAdapterTypes]);

  // Open hire dialog
  function openHire(template: AgentTemplate) {
    setSelectedTemplate(template);
    setHireAdapter(availableAdapters[0] ?? "");
    setHireModel("");
    setHireReportsTo("");
  }

  // Hire mutation
  const hireMut = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !cid) throw new Error("Missing data");
      const shortId = crypto.randomUUID().slice(0, 8);
      const templateName = (selectedTemplate.name || selectedTemplate.role || "Agent").replace(/\s+/g, "_");
      const agentName = funModeEnabled
        ? generateVillainAgentName()
        : `${templateName}_${shortId}`;
      return agentsApi.create(cid, {
        name: agentName,
        role: selectedTemplate.role,
        title: selectedTemplate.name,
        reportsTo: hireReportsTo || undefined,
        adapterType: hireAdapter,
        adapterConfig: hireModel ? { model: hireModel } : {},
        runtimeConfig: {
          heartbeat: { enabled: true, intervalSeconds: 3600, wakeOnDemand: true, maxConcurrentRuns: 1 },
        },
        templateId: selectedTemplate.id,
        hireSource: "agent-gallery",
      } as any);
    },
    onSuccess: (agent: any) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(cid!) });
      qc.invalidateQueries({ queryKey: queryKeys.activity(cid!) });
      pushToast({ title: `${agent.name} hired!`, body: `${selectedTemplate?.name} is now part of your team`, tone: "success", ttlMs: 4000 });
      setSelectedTemplate(null);
    },
    onError: (err) => {
      pushToast({ title: "Hire failed", body: (err as Error).message, tone: "error" });
    },
  });

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-violet-400" />
          <div>
            <h1 className="text-lg font-semibold">Agent Gallery</h1>
            <p className="text-xs text-muted-foreground">Browse and hire agents from pre-configured delivery pod templates</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{templates.length} templates available</div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Store className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">No agent templates available</p>
            <p className="text-xs mt-1">Configure templates in Instance Settings → Admin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {templates.map((template) => (
              <AgentCard key={template.id} template={template} onHire={() => openHire(template)} />
            ))}
          </div>
        )}
      </div>

      {/* Hire Dialog */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTemplate(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Dialog Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={generateSprite(selectedTemplate.id, selectedTemplate.role)} alt="" className="w-10 h-10 rounded-lg" />
                <div>
                  <p className="text-sm font-semibold">Hire {selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground">Agent_{generateAgentNumber(selectedTemplate.id)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Adapter */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Adapter</label>
                <select value={hireAdapter}
                  onChange={e => { setHireAdapter(e.target.value); setHireModel(""); }}
                  className="w-full mt-1.5 px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {availableAdapters.map(a => (
                    <option key={a} value={a}>{adapterLabels[a] ?? a}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Model</label>
                <select value={hireModel}
                  onChange={e => setHireModel(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">{models.length === 0 ? "Loading models..." : "Select model..."}</option>
                  {(models as any[]).map((m: any) => (
                    <option key={typeof m === "string" ? m : m.id} value={typeof m === "string" ? m : m.id}>
                      {typeof m === "string" ? m : m.name ?? m.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reports To */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reports To</label>
                <select value={hireReportsTo}
                  onChange={e => setHireReportsTo(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">None (top-level)</option>
                  {activeAgents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({roleLabels[a.role] ?? a.role})</option>
                  ))}
                </select>
              </div>

              {/* Auto-approve notice */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-400">Auto approved direct hire — no approval required</span>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 text-xs rounded-xl border border-border hover:bg-muted/30 transition-colors">
                Cancel
              </button>
              <button onClick={() => hireMut.mutate()}
                disabled={!hireAdapter || !hireModel || hireMut.isPending}
                className="px-5 py-2 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {hireMut.isPending ? "Hiring..." : "Hire"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Component ──

function AgentCard({ template, onHire }: { template: AgentTemplate; onHire: () => void }) {
  const spriteUrl = generateSprite(template.id, template.role);
  const agentNum = generateAgentNumber(template.id);
  const roleBadgeColor = ROLE_BADGE_COLORS[template.role] ?? ROLE_BADGE_COLORS.general;

  return (
    <div className="group rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Top section with sprite */}
      <div className="pt-6 pb-3 flex flex-col items-center">
        <div className="relative">
          <img src={spriteUrl} alt={template.name} className="w-16 h-16 rounded-xl shadow-md group-hover:scale-105 transition-transform" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-card" title="Available" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2 flex-1 flex flex-col items-center text-center">
        <p className="text-sm font-bold">Agent_{agentNum}</p>
        <span className={cn("mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", roleBadgeColor)}>
          {roleLabels[template.role] ?? template.role}
        </span>
        <p className="mt-1.5 text-xs text-muted-foreground">{template.name}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60 line-clamp-2 leading-relaxed">{template.description}</p>
      </div>

      {/* Action */}
      <div className="px-4 pb-4 pt-2">
        <button onClick={onHire}
          className="w-full py-2 text-xs font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Hire Me!
        </button>
      </div>
    </div>
  );
}
