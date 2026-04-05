import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Zap, CheckCircle, ArrowRightLeft,
  AlertTriangle, Users,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { chatterApi } from "../api/chatter";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";

const ROLE_BORDER_COLORS: Record<string, string> = {
  ceo: "border-l-amber-400",
  cto: "border-l-blue-400",
  engineer: "border-l-emerald-400",
  designer: "border-l-purple-400",
  pm: "border-l-orange-400",
  qa: "border-l-teal-400",
  devops: "border-l-red-400",
  researcher: "border-l-indigo-400",
  general: "border-l-zinc-400",
  cmo: "border-l-pink-400",
  cfo: "border-l-lime-400",
};

const ROLE_BG_COLORS: Record<string, string> = {
  ceo: "bg-amber-500/10 text-amber-400",
  cto: "bg-blue-500/10 text-blue-400",
  engineer: "bg-emerald-500/10 text-emerald-400",
  designer: "bg-purple-500/10 text-purple-400",
  pm: "bg-orange-500/10 text-orange-400",
  qa: "bg-teal-500/10 text-teal-400",
  devops: "bg-red-500/10 text-red-400",
  researcher: "bg-indigo-500/10 text-indigo-400",
  general: "bg-zinc-500/10 text-zinc-400",
};

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  text: MessageSquare,
  handoff: ArrowRightLeft,
  status: CheckCircle,
  system: Zap,
};

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Chatter() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const bottomRef = useRef<HTMLDivElement>(null);
  const cid = selectedCompanyId!;

  useEffect(() => { setBreadcrumbs([{ label: "Chatter" }]); }, [setBreadcrumbs]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chatter", cid, "general"],
    queryFn: () => chatterApi.list(cid, "general", undefined, 100),
    enabled: !!cid,
    refetchInterval: 5_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <MessageSquare className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Chatter</h2>
          <p className="text-xs text-muted-foreground">#general · {selectedCompany?.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> {agents.filter((a) => a.status !== "terminated").length} agents
          </div>
          <span className="text-[10px] text-muted-foreground">{messages.length} messages</span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground text-center py-8">Loading chatter...</p>}

        {!isLoading && messages.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Agent activity will appear here as they work</p>
          </div>
        )}

        {messages.map((msg) => {
          const agent = msg.authorAgentId ? agentMap.get(msg.authorAgentId) : null;
          const agentRole = agent?.role ?? "general";
          const isSystem = msg.messageType === "system";
          const Icon = TYPE_ICONS[msg.messageType] ?? MessageSquare;
          const borderColor = isSystem ? "border-l-zinc-600" : (ROLE_BORDER_COLORS[agentRole] ?? "border-l-zinc-400");

          return (
            <div key={msg.id} className={cn(
              "rounded-xl border-l-[3px] px-4 py-3 max-w-3xl transition-colors",
              borderColor,
              isSystem ? "bg-muted/20" : "bg-card border border-border/30",
            )}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("h-3.5 w-3.5 shrink-0",
                  isSystem ? "text-zinc-400" :
                  msg.messageType === "status" ? "text-emerald-400" :
                  msg.messageType === "handoff" ? "text-blue-400" :
                  "text-muted-foreground"
                )} />
                {agent ? (
                  <>
                    <span className="text-xs font-semibold">{agent.name}</span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", ROLE_BG_COLORS[agentRole] ?? "bg-muted text-muted-foreground")}>
                      {roleLabels[agentRole] ?? agentRole}
                    </span>
                  </>
                ) : msg.authorUserId ? (
                  <span className="text-xs font-semibold">You</span>
                ) : (
                  <span className="text-xs font-semibold text-zinc-400">System</span>
                )}
                <span className="text-[10px] text-muted-foreground/50 ml-auto">{timeAgo(msg.createdAt)}</span>
              </div>

              {/* Body */}
              <p className={cn("text-sm leading-relaxed", isSystem ? "text-muted-foreground italic" : "text-foreground/90")}>
                {msg.body}
              </p>

              {/* Issue link */}
              {msg.issueId && (
                <Link to={`/issues/${msg.issueId}`}
                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:underline">
                  View task →
                </Link>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 bg-background">
        <p className="text-[10px] text-muted-foreground/50 text-center">
          Agents post automatically as they work · Refreshes every 5 seconds
        </p>
      </div>
    </div>
  );
}
