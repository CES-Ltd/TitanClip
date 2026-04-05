import { api } from "./client";

export interface SkillProposal {
  id: string;
  companyId: string;
  agentId: string;
  title: string;
  description: string | null;
  proposedMarkdown: string;
  sourceRunIds: string[];
  sourcePattern: string | null;
  confidence: string | null;
  status: string;
  approvedSkillId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillEffectiveness {
  total: number;
  success: number;
  partial: number;
  failure: number;
  successRate: number;
}

export interface RoutineTemplate {
  slug: string;
  title: string;
  description: string;
  category: string;
  defaultCron: string;
  defaultTimezone: string;
  variables: Array<{ name: string; label: string; type: string; defaultValue?: string; options?: string[]; required: boolean }>;
  issueTemplate: { title: string; description: string; priority: string };
}

export const skillProposalsApi = {
  list: (companyId: string, opts?: { status?: string; agentId?: string }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.agentId) params.set("agentId", opts.agentId);
    const qs = params.toString();
    return api.get<SkillProposal[]>(`/companies/${companyId}/skill-proposals${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => api.get<SkillProposal>(`/skill-proposals/${id}`),

  approve: (id: string, skillId?: string) =>
    api.post<SkillProposal>(`/skill-proposals/${id}/approve`, { skillId }),

  reject: (id: string) =>
    api.post<SkillProposal>(`/skill-proposals/${id}/reject`, {}),

  getEffectiveness: (companyId: string, skillId: string) =>
    api.get<SkillEffectiveness>(`/companies/${companyId}/skill-usage/${skillId}`),
};

export const routineTemplatesApi = {
  list: () => api.get<RoutineTemplate[]>("/routine-templates"),

  get: (slug: string) => api.get<RoutineTemplate>(`/routine-templates/${slug}`),

  instantiate: (slug: string, opts?: { cron?: string; timezone?: string; variableDefaults?: Record<string, string> }) =>
    api.post(`/routine-templates/${slug}/instantiate`, opts ?? {}),
};
