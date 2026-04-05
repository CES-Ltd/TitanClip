import { api } from "./client";

export interface UserCredential {
  id: string;
  companyId: string;
  name: string;
  description: string;
  credentialType: string;
  provider: string;
  scope: string;
  status: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialOptions {
  providers: Array<{ value: string; label: string; description: string }>;
  credentialTypes: Array<{ value: string; label: string }>;
}

export const userCredentialsApi = {
  options: () => api.get<CredentialOptions>("/user-credentials/options"),
  list: (companyId: string) => api.get<UserCredential[]>(`/companies/${companyId}/user-credentials`),
  create: (companyId: string, data: { name: string; provider: string; credentialType: string; description?: string }) =>
    api.post<UserCredential>(`/companies/${companyId}/user-credentials`, data),
  update: (id: string, data: Partial<{ name: string; description: string }>) =>
    api.patch<UserCredential>(`/user-credentials/${id}`, data),
  revoke: (id: string) => api.delete<UserCredential>(`/user-credentials/${id}`),
};
