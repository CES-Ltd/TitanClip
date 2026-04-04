import type { InstanceAdminSettingsPublic, PatchInstanceAdminSettings } from "@titanclip/shared";
import { api } from "./client";

export const adminSettingsApi = {
  get: () =>
    api.get<InstanceAdminSettingsPublic>("/instance/settings/admin"),

  getAuthMode: () =>
    api.get<{ mode: "pin" | "sso" }>("/instance/settings/admin/auth-mode"),

  verifyPin: (pin: string) =>
    api.post<{ token: string; expiresAt: string }>(
      "/instance/settings/admin/verify-pin",
      { pin },
    ),

  update: (patch: PatchInstanceAdminSettings, adminToken: string) =>
    api.patch<InstanceAdminSettingsPublic>("/instance/settings/admin", patch, {
      headers: { "x-admin-token": adminToken },
    }),

  changePin: (currentPin: string, newPin: string, adminToken: string) =>
    api.post<{ ok: boolean }>(
      "/instance/settings/admin/change-pin",
      { currentPin, newPin },
      { headers: { "x-admin-token": adminToken } },
    ),
};
