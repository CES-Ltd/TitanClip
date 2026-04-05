import { api } from "./client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatResponse {
  message: ChatMessage;
  adapterType?: string;
  usage?: { inputTokens?: number; outputTokens?: number } | null;
}

export const chatApi = {
  send: (companyId: string, agentId: string, message: string, history?: { role: string; content: string }[]) =>
    api.post<ChatResponse>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/chat`,
      { message, history },
    ),
};
