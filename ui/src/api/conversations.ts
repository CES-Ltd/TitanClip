import { api } from "./client";

export interface Conversation {
  id: string;
  companyId: string;
  agentId: string;
  title: string | null;
  issueId: string | null;
  projectId: string | null;
  status: string;
  messageCount: number;
  totalTokens: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  runId: string | null;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export interface ConversationSearchResult {
  messageId: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  conversationTitle: string | null;
  agentId: string;
}

export const conversationsApi = {
  list: (companyId: string, opts?: { agentId?: string; issueId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.issueId) params.set("issueId", opts.issueId);
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    return api.get<Conversation[]>(`/companies/${companyId}/conversations${qs ? `?${qs}` : ""}`);
  },

  create: (companyId: string, data: { agentId: string; title?: string; issueId?: string; projectId?: string }) =>
    api.post<Conversation>(`/companies/${companyId}/conversations`, data),

  get: (id: string) =>
    api.get<ConversationWithMessages>(`/conversations/${id}`),

  appendMessage: (id: string, data: { role: string; content: string; runId?: string; tokenCount?: number }) =>
    api.post<ConversationMessage>(`/conversations/${id}/messages`, data),

  search: (companyId: string, query: string, opts?: { agentId?: string }) =>
    api.post<ConversationSearchResult[]>(`/companies/${companyId}/conversations/search`, { query, ...opts }),

  update: (id: string, data: { title?: string; status?: string; issueId?: string }) =>
    api.patch<Conversation>(`/conversations/${id}`, data),
};
