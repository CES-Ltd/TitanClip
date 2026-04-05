import type { VaultCredential, VaultTokenCheckout, CreateVaultCredential, UpdateVaultCredential } from "@titanclip/shared";
import { api } from "./client";

export const vaultApi = {
  list: (companyId: string) =>
    api.get<VaultCredential[]>(`/companies/${encodeURIComponent(companyId)}/vault`),

  get: (credId: string) =>
    api.get<VaultCredential>(`/vault/${credId}`),

  create: (companyId: string, input: CreateVaultCredential) =>
    api.post<VaultCredential>(`/companies/${encodeURIComponent(companyId)}/vault`, input),

  update: (credId: string, patch: UpdateVaultCredential) =>
    api.patch<VaultCredential>(`/vault/${credId}`, patch),

  revoke: (credId: string) =>
    api.delete<{ ok: boolean }>(`/vault/${credId}`),

  rotate: (credId: string, newValue: string) =>
    api.post<VaultCredential>(`/vault/${credId}/rotate`, { newValue }),

  audit: (credId: string) =>
    api.get<VaultTokenCheckout[]>(`/vault/${credId}/audit`),

  activeCheckouts: (companyId: string) =>
    api.get<VaultTokenCheckout[]>(`/companies/${encodeURIComponent(companyId)}/vault/active-checkouts`),

  recentCheckouts: (companyId: string) =>
    api.get<VaultTokenCheckout[]>(`/companies/${encodeURIComponent(companyId)}/vault/recent-checkouts`),
};
