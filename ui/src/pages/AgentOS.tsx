/**
 * Agent OS Hub — the central dashboard for the personal AI agent system.
 *
 * Quick-start chat, memory summary, recent conversations,
 * active routines, pending skill proposals, provider status.
 */

import { useQuery } from "@tanstack/react-query";
import { Brain, MessageSquare, Sparkles, Clock, Settings, Zap, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { llmProvidersApi } from "../api/llmProviders";

export function AgentOS() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: providers = [] } = useQuery({
    queryKey: ["llm-providers", companyId],
    queryFn: () => llmProvidersApi.list(companyId!),
    enabled: !!companyId,
  });

  const activeProviders = providers.filter((p) => p.status === "active");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7 text-indigo-500" />
            Agent OS
          </h1>
          <p className="text-muted-foreground mt-1">
            Your personal AI assistant that grows and learns with you
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="New Chat"
            description="Start a conversation with your AI agent"
            href="chat"
            color="indigo"
          />
          <QuickActionCard
            icon={<Brain className="h-5 w-5" />}
            title="Memory"
            description={`View and manage agent memories`}
            href="memory"
            color="purple"
          />
          <QuickActionCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Skills"
            description="Browse proposed and installed skills"
            href="skills"
            color="amber"
          />
          <QuickActionCard
            icon={<Clock className="h-5 w-5" />}
            title="Scheduled Tasks"
            description="Automated reports and routines"
            href="schedules"
            color="green"
          />
          <QuickActionCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Conversations"
            description="Search past conversations"
            href="conversations"
            color="blue"
          />
          <QuickActionCard
            icon={<Settings className="h-5 w-5" />}
            title="Settings"
            description={`${activeProviders.length} LLM provider${activeProviders.length !== 1 ? "s" : ""} configured`}
            href="settings"
            color="slate"
          />
        </div>

        {/* Provider Status */}
        {activeProviders.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Connected Providers
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeProviders.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm"
                >
                  <Zap className="h-3 w-3" />
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeProviders.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
            <Zap className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <h3 className="font-medium">No LLM Providers Configured</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect an LLM provider to start using Agent OS
            </p>
            <Link
              to="settings"
              className="inline-block mt-3 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Configure Provider
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20",
    purple: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
    amber: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
    green: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    blue: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    slate: "bg-slate-500/10 text-slate-400 hover:bg-slate-500/20",
  };

  return (
    <Link
      to={href}
      className="group rounded-lg border border-border bg-card p-4 hover:border-border/80 transition-colors"
    >
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color] ?? colorMap.slate} mb-3`}>
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </Link>
  );
}
