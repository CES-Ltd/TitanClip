/**
 * Agent Chat — personal AI chat interface with SSE streaming.
 *
 * Sends user messages to POST /companies/:companyId/agents/:agentId/chat
 * and reads the SSE response stream for real-time output.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Bot, User, Loader2, Plus, Settings, StopCircle } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { conversationsApi, type ConversationMessage } from "../api/conversations";
import { agentsApi } from "../api/agents";

export function AgentChat() {
  const { conversationId } = useParams();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: agentsList = [] } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => conversationsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: activeConversation, refetch: refetchConversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.get(conversationId!),
    enabled: !!conversationId,
  });

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (!selectedAgentId && agentsList.length > 0) {
      const preferred = agentsList.find((a) => a.adapterType === "universal_llm");
      setSelectedAgentId(preferred?.id ?? agentsList[0]!.id);
    }
  }, [agentsList, selectedAgentId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!companyId || !selectedAgentId || isStreaming) return;
    setIsStreaming(true);
    setStreamingContent("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(
        `/api/companies/${companyId}/agents/${selectedAgentId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: content, conversationId: conversationId || undefined }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Chat failed" }));
        throw new Error((err as any).error ?? "Chat failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk" && event.content) {
              accumulated += event.content;
              setStreamingContent(accumulated);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("[AgentChat]", err.message);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId) refetchConversation();
    }
  }, [companyId, selectedAgentId, conversationId, isStreaming, queryClient, refetchConversation]);

  const handleSend = () => { const t = input.trim(); if (t) { setInput(""); sendMessage(t); } };
  const handleStop = () => abortRef.current?.abort();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="font-medium text-sm">Conversations</span>
          <Link to="/agent-os/chat" className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><Plus className="h-4 w-4" /></Link>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.map((c) => (
            <Link key={c.id} to={`/agent-os/chat/${c.id}`}
              className={`block px-3 py-2 text-sm hover:bg-accent/50 border-b border-border/50 ${c.id === conversationId ? "bg-accent/30" : ""}`}>
              <div className="font-medium truncate">{c.title ?? "Untitled"}</div>
              <div className="text-xs text-muted-foreground">{c.messageCount} msgs</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-indigo-500" />
            <select value={selectedAgentId ?? ""} onChange={(e) => setSelectedAgentId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm">
              {agentsList.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.adapterType})</option>)}
            </select>
          </div>
          <Link to="/agent-os/settings" className="p-2 rounded-md hover:bg-accent text-muted-foreground"><Settings className="h-4 w-4" /></Link>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto text-indigo-500/30 mb-3" />
                <h2 className="text-lg font-medium">Agent OS Chat</h2>
                <p className="text-sm text-muted-foreground mt-1">Send a message to start</p>
              </div>
            </div>
          )}
          {messages.map((m) => <ChatBubble key={m.id} message={m} />)}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex-1 max-w-[80%] rounded-lg bg-card border border-border p-3 text-sm">
                {streamingContent ? <div className="whitespace-pre-wrap">{streamingContent}<span className="animate-pulse">|</span></div>
                  : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={selectedAgentId ? "Type a message..." : "Select an agent"}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:border-indigo-500"
              disabled={!selectedAgentId || isStreaming} />
            {isStreaming ? (
              <button onClick={handleStop} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"><StopCircle className="h-4 w-4" /></button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim() || !selectedAgentId}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-blue-500/10" : "bg-indigo-500/10"}`}>
        {isUser ? <User className="h-4 w-4 text-blue-500" /> : <Bot className="h-4 w-4 text-indigo-500" />}
      </div>
      <div className={`flex-1 max-w-[80%] rounded-lg p-3 text-sm ${isUser ? "bg-blue-600 text-white ml-auto" : "bg-card border border-border"}`}>
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-1 ${isUser ? "text-blue-200" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString()}
          {message.metadata && (message.metadata as any).model && <span className="ml-2">({(message.metadata as any).model})</span>}
        </div>
      </div>
    </div>
  );
}
