import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, User, Send, Sparkles } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { chatApi } from "../api/chat";
import type { ChatMessage } from "../api/chat";
import { queryKeys } from "../lib/queryKeys";
import { ApprovalCard } from "../components/chat/ApprovalCard";
import { cn } from "../lib/utils";

export function TeamChat() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

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

  // Welcome message
  useEffect(() => {
    if (!leadAgent) return;
    setMessages([{
      id: "welcome",
      role: "system",
      content: `Connected to **${leadAgent.name}** (${leadAgent.title ?? "Business Unit Head"}). Ask anything — I'm powered by the configured AI model.`,
      createdAt: new Date().toISOString(),
    }]);
  }, [leadAgent?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Approve/reject mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedCompanyId || !leadAgent || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      // Build conversation history (exclude system messages)
      const history = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await chatApi.send(selectedCompanyId, leadAgent.id, text, history);

      setMessages((prev) => [...prev, {
        id: response.message.id,
        role: "assistant",
        content: response.message.content,
        createdAt: response.message.createdAt,
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ ${err?.message ?? "Failed to get response. Check that the agent has an API key configured."}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }, [input, selectedCompanyId, leadAgent, isThinking, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedCompanyId) {
    return <div className="p-8 text-muted-foreground text-sm">Select a team first.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold tracking-tight">
            {leadAgent?.name ?? "Team Chat"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {leadAgent?.title ?? "Business Unit Head"} · {selectedCompany?.name ?? "Team"}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
          <div className={cn(
            "w-2 h-2 rounded-full",
            leadAgent?.status === "running" ? "bg-emerald-400 animate-pulse" :
            leadAgent?.status === "paused" ? "bg-amber-400" :
            "bg-emerald-400",
          )} />
          <span className="text-[11px] text-muted-foreground capitalize">{leadAgent?.status ?? "offline"}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex gap-3 max-w-3xl",
            msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto",
          )}>
            {/* Avatar */}
            {msg.role !== "system" && (
              <div className={cn(
                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5",
                msg.role === "user"
                  ? "bg-primary/15 text-primary"
                  : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400",
              )}>
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
            )}

            {/* Bubble */}
            <div className={cn(
              "px-4 py-3 text-sm leading-relaxed max-w-[85%]",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md shadow-sm"
                : msg.role === "system"
                  ? "bg-muted/40 text-muted-foreground rounded-2xl text-xs italic w-full max-w-none text-center py-2"
                  : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-md shadow-sm",
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Pending Approvals */}
        {(approvals ?? []).length > 0 && (
          <div className="mr-auto max-w-3xl space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {(approvals ?? []).length} pending approval{(approvals ?? []).length > 1 ? "s" : ""}:
                </p>
                {(approvals ?? []).map((a: any) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    isPending={approveMutation.isPending || rejectMutation.isPending}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
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

      {/* Input Bar — Material style */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-end gap-3 max-w-3xl mx-auto rounded-2xl border border-border bg-card shadow-lg p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={leadAgent ? `Message ${leadAgent.name}...` : "No agents available"}
            disabled={isThinking || !leadAgent}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none"
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={isThinking || !leadAgent || !input.trim()}
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
              input.trim() && !isThinking
                ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
          Powered by {leadAgent?.adapterType === "claude_local" ? "Claude" : leadAgent?.adapterType ?? "AI"} · Conversations are not persisted
        </p>
      </div>
    </div>
  );
}
