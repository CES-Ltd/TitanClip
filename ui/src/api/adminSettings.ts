import type { AgentTemplate, InstanceAdminSettingsPublic, PatchInstanceAdminSettings, CreateAgentTemplate, UpdateAgentTemplate } from "@titanclip/shared";
import { api, sha256 } from "./client";

export const adminSettingsApi = {
  get: () =>
    api.get<InstanceAdminSettingsPublic>("/instance/settings/admin"),

  getAuthMode: () =>
    api.get<{ mode: "pin" | "sso" }>("/instance/settings/admin/auth-mode"),

  verifyPin: async (pin: string) => {
    const pinHash = await sha256(pin);
    return api.post<{ token: string; expiresAt: string }>(
      "/instance/settings/admin/verify-pin",
      { pin: pinHash },
    );
  },

  update: (patch: PatchInstanceAdminSettings, adminToken: string) =>
    api.patch<InstanceAdminSettingsPublic>("/instance/settings/admin", patch, {
      headers: { "x-admin-token": adminToken },
    }),

  changePin: async (currentPin: string, newPin: string, adminToken: string) => {
    const currentHash = await sha256(currentPin);
    const newHash = await sha256(newPin);
    return api.post<{ ok: boolean }>(
      "/instance/settings/admin/change-pin",
      { currentPin: currentHash, newPin: newHash },
      { headers: { "x-admin-token": adminToken } },
    );
  },
  // Template CRUD (admin token required)
  listTemplates: (adminToken: string) =>
    api.get<AgentTemplate[]>("/instance/settings/admin/templates", {
      headers: { "x-admin-token": adminToken },
    }),

  createTemplate: (input: CreateAgentTemplate, adminToken: string) =>
    api.post<AgentTemplate>("/instance/settings/admin/templates", input, {
      headers: { "x-admin-token": adminToken },
    }),

  updateTemplate: (id: string, patch: UpdateAgentTemplate, adminToken: string) =>
    api.patch<AgentTemplate>(`/instance/settings/admin/templates/${id}`, patch, {
      headers: { "x-admin-token": adminToken },
    }),

  deleteTemplate: (id: string, adminToken: string) =>
    api.delete<{ ok: boolean }>(`/instance/settings/admin/templates/${id}`, {
      headers: { "x-admin-token": adminToken },
    }),

  // Available templates (any board user, no token needed)
  listAvailableTemplates: () =>
    api.get<AgentTemplate[]>("/instance/settings/templates/available"),
};
