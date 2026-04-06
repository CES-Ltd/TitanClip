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
import { adminSettingsApi } from "../api/adminSettings";
import { queryKeys } from "../lib/queryKeys";

export function AgentOS() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: adminSettings } = useQuery({
    queryKey: queryKeys.instance.adminSettings,
    queryFn: () => adminSettingsApi.get(),
  });
  const httpAdapters = (adminSettings as any)?.httpAdapters ?? [];
  const enabledAdapters = httpAdapters.filter((a: any) => a.enabled);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <img src="/brands/titanclip-logo.png" alt="Paperclip Agent" className="h-7 w-7 rounded-md" />
            Paperclip Agent
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
            description={`${enabledAdapters.length} LLM provider${enabledAdapters.length !== 1 ? "s" : ""} configured`}
            href="settings"
            color="slate"
          />
        </div>

        {/* LLM Provider Status */}
        {enabledAdapters.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Available LLM Providers ({enabledAdapters.length} enabled)
            </h3>
            <div className="space-y-2">
              {enabledAdapters.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.provider} · {a.models?.length ?? 0} models
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Active</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {enabledAdapters.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center">
            <Zap className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <h3 className="font-medium">No LLM Providers Configured</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add an HTTP adapter in Instance Settings to connect Paperclip Agent to an LLM provider
            </p>
            <Link
              to="/instance/settings/admin"
              className="inline-block mt-3 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Configure Adapters
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
