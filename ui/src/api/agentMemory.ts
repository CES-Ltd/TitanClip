import { api } from "./client";

export interface AgentMemory {
  id: string;
  companyId: string;
  agentId: string;
  memoryType: string;
  category: string | null;
  key: string;
  content: string;
  importance: number;
  sourceRunId: string | null;
  sourceIssueId: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const agentMemoryApi = {
  list: (companyId: string, agentId: string, opts?: { type?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (opts?.type) params.set("type", opts.type);
    if (opts?.category) params.set("category", opts.category);
    const qs = params.toString();
    return api.get<AgentMemory[]>(`/companies/${companyId}/agents/${agentId}/memories${qs ? `?${qs}` : ""}`);
  },

  create: (companyId: string, agentId: string, data: {
    memoryType: string;
    category?: string;
    key: string;
    content: string;
    importance?: number;
  }) => api.post<AgentMemory>(`/companies/${companyId}/agents/${agentId}/memories`, data),

  remove: (agentId: string, memoryId: string) =>
    api.delete(`/agents/${agentId}/memories/${memoryId}`),

  search: (companyId: string, agentId: string, query: string) =>
    api.post<AgentMemory[]>(`/companies/${companyId}/agents/${agentId}/memories/search`, { query }),

  getContext: (companyId: string, agentId: string) =>
    api.get<{ context: string }>(`/companies/${companyId}/agents/${agentId}/memory-context`),
};
