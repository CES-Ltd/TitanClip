import type { TeamRole } from "@titanclip/shared";
import { api } from "./client";

export const teamRolesApi = {
  list: (companyId: string) =>
    api.get<TeamRole[]>(`/companies/${encodeURIComponent(companyId)}/team-roles`),

  assign: (companyId: string, userId: string, role: string) =>
    api.post<TeamRole>(`/companies/${encodeURIComponent(companyId)}/team-roles`, { userId, role }),

  remove: (companyId: string, userId: string) =>
    api.delete<{ ok: boolean }>(`/companies/${encodeURIComponent(companyId)}/team-roles/${encodeURIComponent(userId)}`),
};
