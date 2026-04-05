import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Search, Clock, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { conversationsApi, type Conversation, type ConversationSearchResult } from "../api/conversations";

export function ConversationHistory() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => conversationsApi.list(companyId!),
    enabled: !!companyId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["conversation-search", companyId, searchQuery],
    queryFn: () => conversationsApi.search(companyId!, searchQuery),
    enabled: !!companyId && searchQuery.length >= 2,
  });

  const showSearch = searchQuery.length >= 2 && searchResults;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            Conversation History
          </h1>
          <p className="text-sm text-muted-foreground">{conversations.length} conversations</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>

        {/* Search Results */}
        {showSearch && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Search Results ({searchResults.length})</h3>
            {searchResults.map((r: ConversationSearchResult) => (
              <Link
                key={r.messageId}
                to={`/agent-os/chat/${r.conversationId}`}
                className="block rounded-lg border border-border bg-card p-3 hover:border-blue-500/30"
              >
                <div className="text-sm font-medium">{r.conversationTitle ?? "Untitled"}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.content}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        )}

        {/* Conversation List */}
        {!showSearch && (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/agent-os/chat/${conv.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium">{conv.title ?? "Untitled Conversation"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{conv.messageCount} messages</span>
                        <span>{conv.totalTokens.toLocaleString()} tokens</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString() : "No messages"}
                  </div>
                </div>
              </Link>
            ))}

            {conversations.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No conversations yet</p>
                <Link to="/agent-os/chat" className="mt-2 text-blue-500 hover:text-blue-400 text-sm block">
                  Start your first chat
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
