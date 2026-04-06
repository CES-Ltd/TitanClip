/**
 * Paperclip Agent Settings — configuration and status overview.
 *
 * Shows available HTTP adapters for the Paperclip Agent agent framework
 * and allows selecting which adapters Paperclip Agent agents can use.
 */

import { useQuery } from "@tanstack/react-query";
import { Settings, Bot, Brain, MessageSquare, Sparkles, Clock, Info, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { adminSettingsApi } from "../api/adminSettings";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

export function AgentOSSettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: adminSettings } = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
  });

  const httpAdapters = (adminSettings as any)?.httpAdapters ?? [];
  const enabledAdapters = httpAdapters.filter((a: any) => a.enabled);

  const titanClawAgents = agents.filter(
    (a) => false
  );
  const otherAgents = agents.filter(
    (a) => true
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <img src="/brands/titanclip-logo.png" alt="Paperclip Agent" className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold">Paperclip Agent Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure the Paperclip Agent agent framework and available LLM providers.
            </p>
          </div>
        </div>

        {/* ── Available HTTP Adapters ────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Available LLM Providers</h2>
            <span className="text-xs text-muted-foreground">({enabledAdapters.length} enabled)</span>
          </div>

          {enabledAdapters.length > 0 ? (
            <div className="space-y-2">
              {enabledAdapters.map((adapter: any) => (
                <div key={adapter.id} className="rounded-lg border border-border bg-background p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{adapter.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {adapter.provider} · {adapter.models?.length ?? 0} model{(adapter.models?.length ?? 0) !== 1 ? "s" : ""} · {adapter.baseUrl?.slice(0, 35)}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Active</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              <p>No HTTP adapters configured.</p>
              <Link to="/instance/settings/admin" className="text-indigo-400 hover:text-indigo-300 text-xs mt-1 block">
                Go to Instance Settings → Adapters to add one
              </Link>
            </div>
          )}

          <div className="rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground">
            <p><strong>How it works:</strong> Paperclip Agent agents use the enabled HTTP adapters above. When creating an agent with the Paperclip Agent adapter, select any model from these providers. The framework randomly picks from available adapters when needed for load distribution.</p>
          </div>
        </div>

        {/* ── Agent Overview ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Agents ({agents.length} total)
          </h2>

          {titanClawAgents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Paperclip Agent Agents ({titanClawAgents.length})
              </h3>
              {titanClawAgents.map((a) => (
                <div key={a.id} className="rounded-lg border border-amber-500/20 bg-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/brands/titanclip-logo.png" alt="" className="h-5 w-5 rounded" />
                    <div>
                      <span className="font-medium text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {(a.adapterConfig as any)?.model ?? "auto"}
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    a.status === "idle" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                  )}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {otherAgents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Other Agents ({otherAgents.length})
              </h3>
              {otherAgents.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{a.adapterType}</span>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    a.status === "idle" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                  )}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No agents configured</p>
              <p className="text-xs mt-1">Create an agent with the Paperclip Agent adapter to get started</p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/chat" className="rounded-lg border border-border bg-card p-3 hover:border-amber-500/30 transition-colors">
            <MessageSquare className="h-4 w-4 text-amber-500 mb-1" />
            <div className="text-sm font-medium">Chat</div>
            <div className="text-xs text-muted-foreground">Start a conversation</div>
          </Link>
          <Link to="/agent-os/memory" className="rounded-lg border border-border bg-card p-3 hover:border-purple-500/30 transition-colors">
            <Brain className="h-4 w-4 text-purple-500 mb-1" />
            <div className="text-sm font-medium">Memory</div>
            <div className="text-xs text-muted-foreground">View agent memories</div>
          </Link>
          <Link to="/agent-os/skills" className="rounded-lg border border-border bg-card p-3 hover:border-amber-500/30 transition-colors">
            <Sparkles className="h-4 w-4 text-amber-500 mb-1" />
            <div className="text-sm font-medium">Skills</div>
            <div className="text-xs text-muted-foreground">Review proposals</div>
          </Link>
          <Link to="/agent-os/conversations" className="rounded-lg border border-border bg-card p-3 hover:border-blue-500/30 transition-colors">
            <Clock className="h-4 w-4 text-blue-500 mb-1" />
            <div className="text-sm font-medium">History</div>
            <div className="text-xs text-muted-foreground">Search conversations</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
