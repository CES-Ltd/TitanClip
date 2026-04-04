import type { InstanceAdminSettingsPublic, PatchInstanceAdminSettings } from "@titanclip/shared";
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
};
