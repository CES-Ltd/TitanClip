/**
 * Agent OS Settings — configuration and status overview.
 *
 * LLM provider configuration has been unified into the agent adapter system.
 * Configure providers when creating/editing agents via the "openai_compatible" adapter type.
 */

import { useQuery } from "@tanstack/react-query";
import { Settings, Bot, Brain, MessageSquare, Sparkles, Clock, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";

export function AgentOSSettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId ?? ""),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const openaiCompatAgents = agents.filter(
    (a) => a.adapterType === "openai_compatible" || a.adapterType === "universal_llm"
  );
  const otherAgents = agents.filter(
    (a) => a.adapterType !== "openai_compatible" && a.adapterType !== "universal_llm"
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent OS Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agent OS uses your existing TitanClip agents. Configure LLM providers
            when creating agents with the "OpenAI-Compatible" adapter type.
          </p>
        </div>

        {/* Info banner */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Unified Adapter System</p>
            <p className="mt-1">
              LLM providers are configured per-agent in the agent's adapter settings.
              When creating an agent, select the <strong>OpenAI-Compatible</strong> adapter
              and choose a provider preset (OpenAI, Anthropic, Gemini, Azure, Ollama, etc.)
              with pre-populated endpoint URLs.
            </p>
          </div>
        </div>

        {/* Agent Overview */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Agents Available for Chat ({agents.length} total)
          </h2>

          {openaiCompatAgents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                OpenAI-Compatible Agents ({openaiCompatAgents.length})
              </h3>
              {openaiCompatAgents.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-indigo-500" />
                    <div>
                      <span className="font-medium text-sm">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {(a.adapterConfig as any)?.provider ?? "openai"} / {(a.adapterConfig as any)?.model ?? "default"}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "idle" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {otherAgents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Other Adapters ({otherAgents.length})
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "idle" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
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
              <p className="text-xs mt-1">Create an agent to use Agent OS Chat</p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/agent-os/chat" className="rounded-lg border border-border bg-card p-3 hover:border-indigo-500/30 transition-colors">
            <MessageSquare className="h-4 w-4 text-indigo-500 mb-1" />
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
