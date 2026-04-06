/**
 * Agent Chat — modern conversational AI interface with the team's main agent.
 *
 * Features:
 * - SSE streaming with typed events (content, tools, approvals, thinking)
 * - # issue mentions with typeahead
 * - @ agent mentions with routing
 * - / slash commands with autocomplete
 * - Project context selector
 * - CopilotKit-inspired tool call cards
 * - Inline approval cards
 * - Rich markdown rendering
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, User, Plus, MessageCircle, CircleDot, Check, AlertTriangle, FolderOpen } from "lucide-react";
import { useChatStream, type IssueCard } from "../hooks/useChatStream";
import { ChatInput } from "../components/chat/ChatInput";
import { ToolCallGroup } from "../components/chat/ToolCallCard";
import { ApprovalCard } from "../components/chat/ApprovalCard";
import { ThinkingIndicator } from "../components/chat/ThinkingIndicator";
import { MarkdownBody } from "../components/MarkdownBody";
import { useCompany } from "../context/CompanyContext";
import { conversationsApi, type ConversationMessage } from "../api/conversations";
import { cn } from "../lib/utils";

export function AgentChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvIdRef = useRef<string | null>(conversationId ?? null);

  useEffect(() => { activeConvIdRef.current = conversationId ?? null; }, [conversationId]);

  // ── Data Queries ─────────────────────────────────────────────────────
  const { data: mainAgent } = useQuery({
    queryKey: ["main-agent", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/main-agent`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => conversationsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: activeConversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.get(conversationId!),
    enabled: !!conversationId,
  });

  const messages = activeConversation?.messages ?? [];
  const agentId = mainAgent?.id;

  // ── Chat Stream ──────────────────────────────────────────────────────
  const stream = useChatStream({
    onConversationCreated: (id) => {
      activeConvIdRef.current = id;
      if (!conversationId) {
        navigate(`/chat/${id}`, { replace: true });
      }
    },
    onDone: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      const cid = activeConvIdRef.current;
      if (cid) queryClient.invalidateQueries({ queryKey: ["conversation", cid] });
    },
  });

  const handleSend = useCallback((message: string, mentions: { issues: string[]; agents: string[] }) => {
    if (!companyId || !agentId) return;
    stream.send(`/api/companies/${companyId}/agents/${agentId}/chat`, {
      message,
      conversationId: conversationId || undefined,
      projectId: selectedProjectId || undefined,
      mentions: (mentions.issues.length > 0 || mentions.agents.length > 0) ? mentions : undefined,
    });
  }, [companyId, agentId, conversationId, selectedProjectId, stream]);

  // ── Auto-scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, stream.content, stream.toolCalls.length]);

  // ── Group conversations by date ──────────────────────────────────────
  const groupedConversations = groupByDate(conversations);

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-60 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border/50 flex items-center justify-between">
          <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Chats</span>
          <Link to="/chat" className="p-1 rounded-lg hover:bg-accent/50 text-muted-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex-1 overflow-auto scrollbar-auto-hide">
          {groupedConversations.map(({ label, items }) => (
            <div key={label}>
              <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{label}</div>
              {items.map((c) => (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors border-l-2",
                    c.id === (conversationId ?? activeConvIdRef.current)
                      ? "border-l-indigo-500 bg-accent/40 text-foreground"
                      : "border-l-transparent hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="truncate text-[13px]">{c.title ?? "Untitled"}</div>
                </Link>
              ))}
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground/50">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-11 border-b border-border/50 flex items-center px-4 gap-3 shrink-0">
          {mainAgent ? (
            <>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <span className="text-sm font-medium">{mainAgent.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground font-medium">
                {mainAgent.role}
              </span>
              <span className="text-[11px] text-muted-foreground/50 font-mono">
                {(mainAgent.adapterConfig as any)?.model ?? ""}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground/60">No agent available</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto scrollbar-auto-hide">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {/* Empty state */}
            {messages.length === 0 && !stream.isStreaming && (
              <EmptyState agentName={mainAgent?.name} />
            )}

            {/* Conversation messages */}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}

            {/* Streaming state */}
            {stream.isStreaming && (
              <StreamingMessage stream={stream} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        {companyId && (
          <ChatInput
            companyId={companyId}
            disabled={!agentId}
            isStreaming={stream.isStreaming}
            onSend={handleSend}
            onStop={stream.stop}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
        )}
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ agentName }: { agentName?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <Bot className="h-8 w-8 text-indigo-500/40" />
        </div>
        <h2 className="text-lg font-medium mb-1">Paperclip Agent</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Chat with {agentName ?? "your agent"}, manage tasks, and monitor your team.
        </p>
        <div className="grid grid-cols-2 gap-2 text-left text-xs">
          {[
            { trigger: "/status", desc: "Team overview" },
            { trigger: "/plan", desc: "Task breakdown" },
            { trigger: "#issue", desc: "Reference an issue" },
            { trigger: "@agent", desc: "Mention an agent" },
            { trigger: "/create-issue", desc: "Create a task" },
            { trigger: "/review", desc: "Sprint review" },
          ].map((h) => (
            <div key={h.trigger} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30">
              <code className="text-indigo-400 font-mono text-[11px]">{h.trigger}</code>
              <span className="text-muted-foreground">{h.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Chat Bubble ──────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  const meta = message.metadata as Record<string, any> | null;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-blue-500/10" : "bg-indigo-500/10"
      )}>
        {isUser ? <User className="h-3.5 w-3.5 text-blue-500" /> : <Bot className="h-3.5 w-3.5 text-indigo-500" />}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "flex justify-end")}>
        <div className={cn(
          "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] inline-block",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-card/80 border border-border/50"
        )}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="paperclip-markdown">
              <MarkdownBody>{message.content}</MarkdownBody>
            </div>
          )}
        </div>
        <div className={cn("text-[10px] mt-1 px-1", isUser ? "text-right" : "text-left", "text-muted-foreground/40")}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {meta?.model && <span className="ml-1.5">{meta.model}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Streaming Message ────────────────────────────────────────────────────

function StreamingMessage({ stream }: { stream: ReturnType<typeof useChatStream> }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0 space-y-2 max-w-[85%]">
        {/* Thinking state */}
        {!stream.content && stream.toolCalls.length === 0 && stream.approvals.length === 0 && stream.issueCards.length === 0 && (
          <ThinkingIndicator />
        )}

        {/* Tool calls */}
        {stream.toolCalls.length > 0 && (
          <ToolCallGroup tools={stream.toolCalls} />
        )}

        {/* Approval cards */}
        {stream.approvals.map((a) => (
          <ApprovalCard key={a.approvalId} approval={a} />
        ))}

        {/* Issue cards */}
        {stream.issueCards.map((ic, i) => (
          <IssueCreatedCard key={i} card={ic} />
        ))}

        {/* Content */}
        {stream.content && (
          <div className="rounded-2xl px-4 py-2.5 text-sm bg-card/80 border border-border/50">
            <div className="paperclip-markdown">
              <MarkdownBody>{stream.content}</MarkdownBody>
            </div>
            <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-middle" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function groupByDate(conversations: any[]): { label: string; items: any[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, any[]> = { Today: [], Yesterday: [], "This Week": [], Older: [] };

  for (const c of conversations) {
    const d = new Date(c.updatedAt ?? c.createdAt);
    if (d >= today) groups["Today"]!.push(c);
    else if (d >= yesterday) groups["Yesterday"]!.push(c);
    else if (d >= weekAgo) groups["This Week"]!.push(c);
    else groups["Older"]!.push(c);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// ── Issue Created Card ───────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-400",
  in_progress: "text-amber-400",
  done: "text-emerald-400",
  error: "text-red-400",
};

function IssueCreatedCard({ card }: { card: IssueCard }) {
  const isError = card.status === "error";

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-colors",
      isError
        ? "border-red-500/30 bg-red-500/5"
        : "border-emerald-500/30 bg-emerald-500/5"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {isError ? (
          <AlertTriangle className="h-4 w-4 text-red-400" />
        ) : (
          <Check className="h-4 w-4 text-emerald-400" />
        )}
        <span className="text-sm font-medium">
          {isError ? "Issue Creation Failed" : "Issue Created"}
        </span>
      </div>

      {isError ? (
        <div className="text-sm text-red-400">
          <p>{card.error}</p>
          {card.title && <p className="text-muted-foreground mt-1">Description: {card.title}</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-accent text-foreground font-bold">
              {card.identifier}
            </span>
            <span className="text-sm font-medium truncate">{card.title}</span>
          </div>
          {card.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CircleDot className={cn("h-3 w-3", STATUS_COLORS[card.status])} />
              {card.status}
            </span>
            <span>Priority: {card.priority}</span>
            {card.projectName && (
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {card.projectName}
              </span>
            )}
            {card.assignee && (
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {card.assignee}
              </span>
            )}
          </div>
          <Link
            to={`/issues/${card.identifier || card.id}`}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
          >
            View Issue →
          </Link>
        </div>
      )}
    </div>
  );
}
