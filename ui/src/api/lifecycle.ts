import type { OnboardingWorkflow, OnboardingInstance, OffboardingReport, ChangeRequest } from "@titanclip/shared";
import { api } from "./client";

const enc = encodeURIComponent;

export const lifecycleApi = {
  // Onboarding
  listOnboardingWorkflows: (companyId: string) =>
    api.get<OnboardingWorkflow[]>(`/companies/${enc(companyId)}/onboarding/workflows`),
  createOnboardingWorkflow: (companyId: string, body: Partial<OnboardingWorkflow>) =>
    api.post<OnboardingWorkflow>(`/companies/${enc(companyId)}/onboarding/workflows`, body),
  updateOnboardingWorkflow: (companyId: string, id: string, body: Partial<OnboardingWorkflow>) =>
    api.patch<OnboardingWorkflow>(`/companies/${enc(companyId)}/onboarding/workflows/${enc(id)}`, body),
  deleteOnboardingWorkflow: (companyId: string, id: string) =>
    api.delete(`/companies/${enc(companyId)}/onboarding/workflows/${enc(id)}`),
  executeOnboarding: (companyId: string, agentId: string, workflowId: string) =>
    api.post<OnboardingInstance>(`/companies/${enc(companyId)}/onboarding/execute`, { agentId, workflowId }),
  listOnboardingInstances: (companyId: string) =>
    api.get<OnboardingInstance[]>(`/companies/${enc(companyId)}/onboarding/instances`),

  // Offboarding
  offboardAgent: (companyId: string, agentId: string, reassignToAgentId?: string) =>
    api.post<OffboardingReport>(`/companies/${enc(companyId)}/offboard/${enc(agentId)}`, { reassignToAgentId }),

  // Change Requests
  listChangeRequests: (companyId: string, status?: string) => {
    const params = status ? `?status=${enc(status)}` : "";
    return api.get<ChangeRequest[]>(`/companies/${enc(companyId)}/change-requests${params}`);
  },
  createChangeRequest: (companyId: string, body: Partial<ChangeRequest>) =>
    api.post<ChangeRequest>(`/companies/${enc(companyId)}/change-requests`, body),
  updateChangeRequest: (companyId: string, id: string, body: Partial<ChangeRequest>) =>
    api.patch<ChangeRequest>(`/companies/${enc(companyId)}/change-requests/${enc(id)}`, body),
  deleteChangeRequest: (companyId: string, id: string) =>
    api.delete(`/companies/${enc(companyId)}/change-requests/${enc(id)}`),
};
