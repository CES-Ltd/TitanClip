import type { AgentSkillProficiency, TaskSkillRequirement, RoutingResult } from "@titanclip/shared";
import { api } from "./client";

const enc = encodeURIComponent;

export const skillRoutingApi = {
  // Skills
  listSkills: (companyId: string) =>
    api.get<AgentSkillProficiency[]>(`/companies/${enc(companyId)}/skill-proficiency`),
  getMatrix: (companyId: string) =>
    api.get<{
      agents: { id: string; name: string; role: string; status: string }[];
      skills: string[];
      matrix: Record<string, Record<string, number>>;
    }>(`/companies/${enc(companyId)}/skill-matrix`),
  listForAgent: (companyId: string, agentId: string) =>
    api.get<AgentSkillProficiency[]>(`/companies/${enc(companyId)}/agents/${enc(agentId)}/skills`),
  setSkill: (companyId: string, agentId: string, skillName: string, proficiency: number, opts?: { notes?: string }) =>
    api.post<AgentSkillProficiency>(`/companies/${enc(companyId)}/skill-proficiency`, { agentId, skillName, proficiency, ...opts }),
  removeSkill: (companyId: string, skillId: string) =>
    api.delete(`/companies/${enc(companyId)}/skill-proficiency/${enc(skillId)}`),

  // Routing
  routeTask: (companyId: string, requirements: TaskSkillRequirement[]) =>
    api.post<RoutingResult>(`/companies/${enc(companyId)}/route-task`, { requirements }),
};
