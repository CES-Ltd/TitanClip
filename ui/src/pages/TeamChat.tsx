import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, User, Send, Sparkles, Trash2, Terminal,
  Activity, CheckCircle, XCircle, AlertTriangle,
  Users, ClipboardList, Zap, Shield,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { activityApi } from "../api/activity";
import { heartbeatsApi } from "../api/heartbeats";
import { chatApi } from "../api/chat";
import type { ChatMessage } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { ApprovalCard } from "../components/chat/ApprovalCard";
import { cn } from "../lib/utils";
import type { ActivityEvent } from "@titanclip/shared";

// Map activity actions to display info
const ACTION_META: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  "agent.created": { icon: Users, color: "text-emerald-400", label: "Agent created" },
  "agent.updated": { icon: Users, color: "text-blue-400", label: "Agent updated" },
  "agent.paused": { icon: AlertTriangle, color: "text-amber-400", label: "Agent paused" },
  "agent.resumed": { icon: Zap, color: "text-emerald-400", label: "Agent resumed" },
  "agent.terminated": { icon: XCircle, color: "text-red-400", label: "Agent terminated" },
  "issue.created": { icon: ClipboardList, color: "text-blue-400", label: "Task created" },
  "issue.updated": { icon: ClipboardList, color: "text-indigo-400", label: "Task updated" },
  "issue.status_changed": { icon: CheckCircle, color: "text-emerald-400", label: "Task status changed" },
  "heartbeat.run.started": { icon: Zap, color: "text-amber-400", label: "Run started" },
  "heartbeat.run.completed": { icon: CheckCircle, color: "text-emerald-400", label: "Run completed" },
  "heartbeat.run.failed": { icon: XCircle, color: "text-red-400", label: "Run failed" },
  "approval.created": { icon: Shield, color: "text-amber-400", label: "Approval requested" },
  "approval.approved": { icon: CheckCircle, color: "text-emerald-400", label: "Approval granted" },
  "approval.rejected": { icon: XCircle, color: "text-red-400", label: "Approval rejected" },
  "company.created": { icon: Users, color: "text-indigo-400", label: "Team created" },
  "goal.created": { icon: Activity, color: "text-purple-400", label: "Goal created" },
  "project.created": { icon: ClipboardList, color: "text-blue-400", label: "Project created" },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { icon: Activity, color: "text-muted-foreground", label: action.replace(/[._]/g, " ") };
}

function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TeamChat() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const chatStorageKey = selectedCompanyId ? `titanclip-chat-${selectedCompanyId}` : null;

  function saveMessages(msgs: ChatMessage[]) {
    if (!chatStorageKey) return;
    try { localStorage.setItem(chatStorageKey, JSON.stringify(msgs)); } catch {}
  }
  function loadMessages(): ChatMessage[] {
    if (!chatStorageKey) return [];
    try { const r = localStorage.getItem(chatStorageKey); return r ? JSON.parse(r) : []; } catch { return []; }
  }

  useEffect(() => { setBreadcrumbs([{ label: "Command Center" }]); }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const leadAgent = agents?.find((a) => a.role === "ceo") ?? agents?.[0];

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  // Activity feed — recent events
  const { data: activityEvents } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  // Live runs
  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.heartbeats(selectedCompanyId!), "live-runs"],
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  // Load persisted history
  useEffect(() => {
    if (!leadAgent) return;
    const saved = loadMessages();
    if (saved.length > 0) {
      setMessages(saved);
    } else {
      setMessages([{
        id: "welcome",
        role: "system",
        content: `Command Center active. Connected to **${leadAgent.name}**. Type a command or ask a question.`,
        createdAt: new Date().toISOString(),
      }]);
    }
  }, [leadAgent?.id, chatStorageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > 0) saveMessages(messages);
  }, [messages]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) }),
  });

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedCompanyId || !leadAgent || isThinking) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const history = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const response = await chatApi.send(selectedCompanyId, leadAgent.id, text, history);
      setMessages((prev) => [...prev, { id: response.message.id, role: "assistant", content: response.message.content, createdAt: response.message.createdAt }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: "assistant", content: `⚠️ ${err?.message ?? "Failed to get response."}`, createdAt: new Date().toISOString() }]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }, [input, selectedCompanyId, leadAgent, isThinking, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!selectedCompanyId) return <div className="p-8 text-muted-foreground text-sm">Select a team first.</div>;

  const recentEvents = (activityEvents ?? []).slice(0, 20);
  const activeRuns = liveRuns ?? [];

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-background">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Terminal className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold tracking-tight">Command Center</h2>
            <p className="text-xs text-muted-foreground">
              {leadAgent?.name ?? "No agent"} · {selectedCompany?.name ?? "Team"}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
            <div className={cn("w-2 h-2 rounded-full", leadAgent?.status === "running" ? "bg-emerald-400 animate-pulse" : leadAgent?.status === "paused" ? "bg-amber-400" : "bg-emerald-400")} />
            <span className="text-[11px] text-muted-foreground capitalize">{leadAgent?.status ?? "offline"}</span>
          </div>
          {activeRuns.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Zap className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">{activeRuns.length} running</span>
            </div>
          )}
          <button
            onClick={() => { if (chatStorageKey) localStorage.removeItem(chatStorageKey); setMessages([{ id: "welcome", role: "system", content: `Command Center active. Connected to **${leadAgent?.name ?? "Agent"}**. Type a command or ask a question.`, createdAt: new Date().toISOString() }]); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-3 max-w-3xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto")}>
              {msg.role !== "system" && (
                <div className={cn("shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5", msg.role === "user" ? "bg-primary/15 text-primary" : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400")}>
                  {msg.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
              )}
              <div className={cn("px-4 py-3 text-sm leading-relaxed max-w-[85%]", msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md shadow-sm" : msg.role === "system" ? "bg-muted/40 text-muted-foreground rounded-2xl text-xs italic w-full max-w-none text-center py-2" : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-md shadow-sm")}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Pending approvals */}
          {(approvals ?? []).length > 0 && (
            <div className="mr-auto max-w-3xl space-y-3">
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mt-0.5">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{(approvals ?? []).length} pending approval{(approvals ?? []).length > 1 ? "s" : ""}:</p>
                  {(approvals ?? []).map((a: any) => (
                    <ApprovalCard key={a.id} approval={a} onApprove={(id) => approveMutation.mutate(id)} onReject={(id) => rejectMutation.mutate(id)} isPending={approveMutation.isPending || rejectMutation.isPending} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {isThinking && (
            <div className="flex gap-3 mr-auto max-w-3xl">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 flex items-center justify-center mt-0.5">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-tl-md px-5 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="flex items-end gap-3 max-w-3xl mx-auto rounded-2xl border border-border bg-card shadow-lg p-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={leadAgent ? `Command or message...` : "No agents available"}
              disabled={isThinking || !leadAgent} rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none"
              style={{ minHeight: "40px", maxHeight: "120px" }} />
            <button onClick={handleSend} disabled={isThinking || !leadAgent || !input.trim()}
              className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all", input.trim() && !isThinking ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105" : "bg-muted text-muted-foreground cursor-not-allowed")}>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar — Activity Feed */}
      <div className="w-72 border-l border-border bg-card/50 flex flex-col shrink-0 hidden lg:flex">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Live Activity
          </h3>
        </div>

        {/* Active runs */}
        {activeRuns.length > 0 && (
          <div className="px-3 py-2 border-b border-border">
            {activeRuns.map((run: any) => (
              <div key={run.id} className="flex items-center gap-2 py-1.5">
                <Zap className="h-3 w-3 text-emerald-400 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{run.agentName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{run.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent events */}
        <div className="flex-1 overflow-y-auto">
          {recentEvents.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No recent activity</p>
          )}
          {recentEvents.map((event: ActivityEvent) => {
            const meta = getActionMeta(event.action);
            const Icon = meta.icon;
            return (
              <div key={event.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors border-b border-border/30">
                <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-foreground leading-tight">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {event.entityType}{event.details && typeof event.details === "object" && (event.details as any).name ? `: ${(event.details as any).name}` : ""}
                  </p>
                </div>
                <span className="text-[9px] text-muted-foreground/60 shrink-0 mt-0.5">
                  {formatTime(event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
