import type { ChatterMessage } from "@titanclip/shared";
import { api } from "./client";

export const chatterApi = {
  list: (companyId: string, channel = "general", cursor?: string, limit = 50) => {
    const params = new URLSearchParams({ channel, limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return api.get<ChatterMessage[]>(`/companies/${encodeURIComponent(companyId)}/chatter?${params}`);
  },

  post: (companyId: string, body: string, opts?: { channel?: string; messageType?: string; issueId?: string }) =>
    api.post<ChatterMessage>(`/companies/${encodeURIComponent(companyId)}/chatter`, { body, ...opts }),
};
