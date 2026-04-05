import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageCircle } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { ChatMessageComponent } from "../components/chat/ChatMessage";
import { ChatInput } from "../components/chat/ChatInput";
import type { ChatMessage, ChatAction } from "../api/chat";

export function TeamChat() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  // Fetch agents to find the CEO/Business Unit Head
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const leadAgent = agents?.find((a) => a.role === "ceo") ?? agents?.[0];

  // Fetch pending approvals
  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId!, "pending"),
    queryFn: () => approvalsApi.list(selectedCompanyId!, "pending"),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  // Add welcome message and approvals on load
  useEffect(() => {
    if (!leadAgent) return;
    const welcomeMessages: ChatMessage[] = [
      {
        id: "welcome",
        role: "system",
        content: `Welcome to your team chat. You're connected with ${leadAgent.name} (${leadAgent.title ?? "Business Unit Head"}).`,
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(welcomeMessages);
  }, [leadAgent?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build approval actions for chat
  const approvalActions: ChatAction[] = (approvals ?? []).map((a) => ({
    type: "approval_pending" as const,
    approval: a,
  }));

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      setMessages((prev) => [...prev, {
        id: `sys-${Date.now()}`,
        role: "system",
        content: "Approval granted.",
        createdAt: new Date().toISOString(),
      }]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      setMessages((prev) => [...prev, {
        id: `sys-${Date.now()}`,
        role: "system",
        content: "Approval rejected.",
        createdAt: new Date().toISOString(),
      }]);
    },
  });

  // Send message handler
  const handleSend = useCallback(async (text: string) => {
    if (!selectedCompanyId || !leadAgent) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Parse intent and create appropriate action
      const lowerText = text.toLowerCase();
      const actions: ChatAction[] = [];

      if (lowerText.includes("create") && (lowerText.includes("task") || lowerText.includes("issue"))) {
        // Create an issue
        const title = text.replace(/^(create|make|add)\s+(a\s+)?(task|issue)\s*(to|for|about|:)?\s*/i, "").trim() || text;
        const issue = await issuesApi.create(selectedCompanyId, {
          title,
          description: `Created from team chat: "${text}"`,
          priority: "medium",
          assigneeAgentId: leadAgent.id,
        });
        actions.push({ type: "issue_created", issue: issue as any });

        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `I've created a new task and assigned it to ${leadAgent.name}.`,
          actions,
          createdAt: new Date().toISOString(),
        }]);
      } else if (lowerText.includes("wake") || lowerText.includes("invoke") || lowerText.includes("start")) {
        // Wake the agent
        try {
          await agentsApi.wakeup(leadAgent.id, { source: "on_demand", triggerDetail: "manual" }, selectedCompanyId);
          actions.push({ type: "agent_invoked", runId: "triggered" });
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `I've triggered ${leadAgent.name} to start working. Check the dashboard for run status.`,
            actions,
            createdAt: new Date().toISOString(),
          }]);
        } catch {
          setMessages((prev) => [...prev, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `Could not wake ${leadAgent.name}. The agent may already be running or paused.`,
            createdAt: new Date().toISOString(),
          }]);
        }
      } else if (lowerText.includes("status") || lowerText.includes("how")) {
        // Status check
        const agentList = agents ?? [];
        const running = agentList.filter((a) => a.status === "running").length;
        const idle = agentList.filter((a) => a.status === "idle" || a.status === "active").length;
        const paused = agentList.filter((a) => a.status === "paused").length;
        const pendingApprovals = (approvals ?? []).length;

        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `Team status:\n• ${agentList.length} agents (${running} working, ${idle} idle, ${paused} paused)\n• ${pendingApprovals} pending approvals\n\nNeed me to do anything?`,
          createdAt: new Date().toISOString(),
        }]);
      } else {
        // General response
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `I understand you said: "${text}"\n\nI can help you:\n• **Create a task**: "Create a task to build login page"\n• **Check status**: "How is the team doing?"\n• **Wake an agent**: "Wake up the team lead"\n\nWhat would you like to do?`,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [selectedCompanyId, leadAgent, agents, approvals]);

  if (!selectedCompanyId) {
    return <div className="p-4 text-muted-foreground text-sm">Select a team first.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">
            {leadAgent?.name ?? "Team Chat"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {leadAgent?.title ?? "Business Unit Head"} • {selectedCompany?.name ?? "Team"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${leadAgent?.status === "running" ? "bg-green-400 animate-pulse" : leadAgent?.status === "paused" ? "bg-yellow-400" : "bg-green-400"}`} />
          <span className="text-[10px] text-muted-foreground">{leadAgent?.status ?? "offline"}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.map((msg) => (
          <ChatMessageComponent
            key={msg.id}
            role={msg.role}
            content={msg.content}
            actions={msg.actions}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            approvalPending={approveMutation.isPending || rejectMutation.isPending}
          />
        ))}

        {/* Pending approvals */}
        {approvalActions.length > 0 && (
          <ChatMessageComponent
            role="system"
            content={`You have ${approvalActions.length} pending approval${approvalActions.length > 1 ? "s" : ""}:`}
            actions={approvalActions}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => rejectMutation.mutate(id)}
            approvalPending={approveMutation.isPending || rejectMutation.isPending}
          />
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex items-center gap-1 px-4 py-2.5 bg-muted/30 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isThinking || !leadAgent}
        placeholder={leadAgent ? `Message ${leadAgent.name}...` : "No agents available"}
      />
    </div>
  );
}
