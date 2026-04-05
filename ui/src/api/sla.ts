import type { SlaPolicy, SlaTracking, SlaDashboardSummary, EscalationRule } from "@titanclip/shared";
import { api } from "./client";

const enc = encodeURIComponent;

export const slaApi = {
  // Policies
  listPolicies: (companyId: string) =>
    api.get<SlaPolicy[]>(`/companies/${enc(companyId)}/sla/policies`),
  createPolicy: (companyId: string, body: Partial<SlaPolicy>) =>
    api.post<SlaPolicy>(`/companies/${enc(companyId)}/sla/policies`, body),
  updatePolicy: (companyId: string, policyId: string, body: Partial<SlaPolicy>) =>
    api.patch<SlaPolicy>(`/companies/${enc(companyId)}/sla/policies/${enc(policyId)}`, body),
  deletePolicy: (companyId: string, policyId: string) =>
    api.delete(`/companies/${enc(companyId)}/sla/policies/${enc(policyId)}`),

  // Tracking
  listTracking: (companyId: string, status?: string) => {
    const params = status ? `?status=${enc(status)}` : "";
    return api.get<SlaTracking[]>(`/companies/${enc(companyId)}/sla/tracking${params}`);
  },
  getTrackingForIssue: (companyId: string, issueId: string) =>
    api.get<SlaTracking | null>(`/companies/${enc(companyId)}/sla/tracking/issue/${enc(issueId)}`),
  startTracking: (companyId: string, issueId: string, policyId: string) =>
    api.post<SlaTracking>(`/companies/${enc(companyId)}/sla/tracking`, { issueId, policyId }),
  pauseTracking: (companyId: string, issueId: string) =>
    api.post(`/companies/${enc(companyId)}/sla/tracking/${enc(issueId)}/pause`, {}),
  resumeTracking: (companyId: string, issueId: string) =>
    api.post(`/companies/${enc(companyId)}/sla/tracking/${enc(issueId)}/resume`, {}),
  markResponded: (companyId: string, issueId: string) =>
    api.post(`/companies/${enc(companyId)}/sla/tracking/${enc(issueId)}/respond`, {}),
  markResolved: (companyId: string, issueId: string) =>
    api.post(`/companies/${enc(companyId)}/sla/tracking/${enc(issueId)}/resolve`, {}),

  // Dashboard
  getDashboard: (companyId: string) =>
    api.get<SlaDashboardSummary>(`/companies/${enc(companyId)}/sla/dashboard`),
  checkBreaches: (companyId: string) =>
    api.post<{ newBreaches: number }>(`/companies/${enc(companyId)}/sla/check-breaches`, {}),

  // Escalation Rules
  listEscalationRules: (companyId: string) =>
    api.get<EscalationRule[]>(`/companies/${enc(companyId)}/escalation/rules`),
  createEscalationRule: (companyId: string, body: Partial<EscalationRule>) =>
    api.post<EscalationRule>(`/companies/${enc(companyId)}/escalation/rules`, body),
  updateEscalationRule: (companyId: string, ruleId: string, body: Partial<EscalationRule>) =>
    api.patch<EscalationRule>(`/companies/${enc(companyId)}/escalation/rules/${enc(ruleId)}`, body),
  deleteEscalationRule: (companyId: string, ruleId: string) =>
    api.delete(`/companies/${enc(companyId)}/escalation/rules/${enc(ruleId)}`),
  evaluateEscalation: (companyId: string) =>
    api.post<{ fired: number; actions: string[] }>(`/companies/${enc(companyId)}/escalation/evaluate`, {}),
};
