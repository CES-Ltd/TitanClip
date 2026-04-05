import type { IssueDependency, WorkflowTemplate, CriticalPathResult } from "@titanclip/shared";
import { api } from "./client";

const enc = encodeURIComponent;

export const dependencyApi = {
  // Dependencies
  listForCompany: (companyId: string) =>
    api.get<IssueDependency[]>(`/companies/${enc(companyId)}/dependencies`),
  listForIssue: (companyId: string, issueId: string) =>
    api.get<IssueDependency[]>(`/companies/${enc(companyId)}/dependencies/issue/${enc(issueId)}`),
  add: (companyId: string, sourceIssueId: string, targetIssueId: string, dependencyType: string) =>
    api.post<IssueDependency>(`/companies/${enc(companyId)}/dependencies`, { sourceIssueId, targetIssueId, dependencyType }),
  remove: (companyId: string, depId: string) =>
    api.delete(`/companies/${enc(companyId)}/dependencies/${enc(depId)}`),
  onCompleted: (companyId: string, issueId: string) =>
    api.post<{ unblocked: string[] }>(`/companies/${enc(companyId)}/dependencies/issue/${enc(issueId)}/completed`, {}),
  getCriticalPath: (companyId: string, rootIssueId?: string) => {
    const params = rootIssueId ? `?rootIssueId=${enc(rootIssueId)}` : "";
    return api.get<CriticalPathResult>(`/companies/${enc(companyId)}/dependencies/critical-path${params}`);
  },

  // Workflows
  listWorkflows: (companyId: string) =>
    api.get<WorkflowTemplate[]>(`/companies/${enc(companyId)}/workflows`),
  getWorkflow: (companyId: string, id: string) =>
    api.get<WorkflowTemplate>(`/companies/${enc(companyId)}/workflows/${enc(id)}`),
  createWorkflow: (companyId: string, body: Partial<WorkflowTemplate>) =>
    api.post<WorkflowTemplate>(`/companies/${enc(companyId)}/workflows`, body),
  updateWorkflow: (companyId: string, id: string, body: Partial<WorkflowTemplate>) =>
    api.patch<WorkflowTemplate>(`/companies/${enc(companyId)}/workflows/${enc(id)}`, body),
  deleteWorkflow: (companyId: string, id: string) =>
    api.delete(`/companies/${enc(companyId)}/workflows/${enc(id)}`),
  executeWorkflow: (companyId: string, id: string, opts?: { projectId?: string; prefix?: string }) =>
    api.post<{ issueIds: string[] }>(`/companies/${enc(companyId)}/workflows/${enc(id)}/execute`, opts ?? {}),
};
