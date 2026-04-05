import type { PermissionPolicy, CreatePermissionPolicy, UpdatePermissionPolicy } from "@titanclip/shared";
import { api } from "./client";

export const permissionPoliciesApi = {
  list: () =>
    api.get<PermissionPolicy[]>("/permission-policies"),

  listForCompany: (companyId: string) =>
    api.get<PermissionPolicy[]>(`/companies/${encodeURIComponent(companyId)}/permission-policies`),

  get: (id: string) =>
    api.get<PermissionPolicy>(`/permission-policies/${id}`),

  create: (input: CreatePermissionPolicy) =>
    api.post<PermissionPolicy>("/permission-policies", input),

  update: (id: string, patch: UpdatePermissionPolicy) =>
    api.patch<PermissionPolicy>(`/permission-policies/${id}`, patch),

  remove: (id: string) =>
    api.delete<{ ok: boolean }>(`/permission-policies/${id}`),
};
