export type ChatterMessageType = "text" | "handoff" | "status" | "system";

export interface ChatterMessage {
  id: string;
  companyId: string;
  channel: string;
  messageType: ChatterMessageType;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  metadata: Record<string, unknown>;
  issueId: string | null;
  runId: string | null;
  createdAt: string;
}
