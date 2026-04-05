import { api } from "./client";

export interface LlmProviderConfig {
  id: string;
  companyId: string;
  providerSlug: string;
  label: string;
  baseUrl: string | null;
  apiKeySecretId: string | null;
  isDefault: boolean;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableProvider {
  slug: string;
  label: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
}

export const llmProvidersApi = {
  listAvailable: () =>
    api.get<AvailableProvider[]>("/llm-providers/available"),

  list: (companyId: string) =>
    api.get<LlmProviderConfig[]>(`/companies/${companyId}/llm-providers`),

  get: (id: string) =>
    api.get<LlmProviderConfig>(`/llm-providers/${id}`),

  create: (companyId: string, data: {
    providerSlug: string;
    label: string;
    baseUrl?: string;
    apiKeySecretId?: string;
    isDefault?: boolean;
    metadata?: Record<string, unknown>;
  }) => api.post<LlmProviderConfig>(`/companies/${companyId}/llm-providers`, data),

  update: (id: string, data: Partial<{
    label: string;
    baseUrl: string | null;
    apiKeySecretId: string | null;
    isDefault: boolean;
    status: string;
    metadata: Record<string, unknown>;
  }>) => api.patch<LlmProviderConfig>(`/llm-providers/${id}`, data),

  remove: (id: string) =>
    api.delete<{ ok: true }>(`/llm-providers/${id}`),

  test: (id: string) =>
    api.post<{ ok: boolean; error?: string }>(`/llm-providers/${id}/test`, {}),

  listModels: (id: string) =>
    api.get<ModelInfo[]>(`/llm-providers/${id}/models`),
};
