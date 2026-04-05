import type { Issue, Approval } from "@titanclip/shared";
import { api } from "./client";

export interface ChatAction {
  type: "issue_created" | "approval_pending" | "plan_created" | "agent_invoked" | "info";
  issue?: Issue;
  approval?: Approval;
  issues?: Issue[];
  runId?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actions?: ChatAction[];
  createdAt: string;
}

export interface ChatResponse {
  message: ChatMessage;
  actions: ChatAction[];
}

export const chatApi = {
  send: (companyId: string, agentId: string, message: string) =>
    api.post<ChatResponse>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/chat`,
      { message },
    ),

  getHistory: (companyId: string, agentId: string) =>
    api.get<ChatMessage[]>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/chat/history`,
    ),
};
