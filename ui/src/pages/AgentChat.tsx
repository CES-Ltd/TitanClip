/**
 * Agent Chat — personal AI chat interface with streaming responses.
 */

import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Bot, User, Loader2, Plus, Settings } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { conversationsApi, type Conversation, type ConversationMessage } from "../api/conversations";
import { Link } from "react-router-dom";

export function AgentChat() {
  const { conversationId } = useParams();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // List conversations for sidebar
  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => conversationsApi.list(companyId!),
    enabled: !!companyId,
  });

  // Get active conversation
  const { data: activeConversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.get(conversationId!),
    enabled: !!conversationId,
  });

  const messages = activeConversation?.messages ?? [];

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) return;
      await conversationsApi.appendMessage(conversationId, {
        role: "user",
        content,
      });
      // In a full implementation, this would trigger adapter execution
      // and stream the response back via WebSocket/SSE
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  // Create new conversation
  const createMutation = useMutation({
    mutationFn: () => {
      if (!companyId) throw new Error("No company");
      // Use first available agent — in production, let user pick
      return conversationsApi.create(companyId, {
        agentId: "default",
        title: "New Chat",
      });
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      window.location.hash = `#/agent-os/chat/${conv.id}`;
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(trimmed);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full">
      {/* Conversation List Sidebar */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="font-medium text-sm">Conversations</span>
          <button
            onClick={() => createMutation.mutate()}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              to={`/agent-os/chat/${conv.id}`}
              className={`block px-3 py-2 text-sm hover:bg-accent/50 border-b border-border/50 ${
                conv.id === conversationId ? "bg-accent/30" : ""
              }`}
            >
              <div className="font-medium truncate">{conv.title ?? "Untitled"}</div>
              <div className="text-xs text-muted-foreground">{conv.messageCount} messages</div>
            </Link>
          ))}
          {conversations.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            <span className="font-medium">
              {activeConversation?.title ?? "Agent OS Chat"}
            </span>
          </div>
          <Link to="/agent-os/settings" className="p-2 rounded-md hover:bg-accent text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!conversationId && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto text-indigo-500/30 mb-3" />
                <h2 className="text-lg font-medium">Agent OS Chat</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Start a new conversation or select an existing one
                </p>
                <button
                  onClick={() => createMutation.mutate()}
                  className="mt-4 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                >
                  New Conversation
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="flex-1 rounded-lg bg-card border border-border p-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {conversationId && (
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:border-indigo-500"
                disabled={sendMutation.isPending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? "bg-blue-500/10" : "bg-indigo-500/10"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-blue-500" />
        ) : (
          <Bot className="h-4 w-4 text-indigo-500" />
        )}
      </div>
      <div
        className={`flex-1 max-w-[80%] rounded-lg p-3 text-sm ${
          isUser
            ? "bg-blue-600 text-white ml-auto"
            : "bg-card border border-border"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-1 ${isUser ? "text-blue-200" : "text-muted-foreground"}`}>
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
