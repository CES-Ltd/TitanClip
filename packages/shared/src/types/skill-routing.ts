export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  1: "Novice",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  1: "text-zinc-400",
  2: "text-blue-400",
  3: "text-amber-400",
  4: "text-orange-400",
  5: "text-emerald-400",
};

export interface AgentSkillProficiency {
  id: string;
  companyId: string;
  agentId: string;
  agentName?: string;
  skillName: string;
  proficiency: ProficiencyLevel;
  endorsedBy: string | null; // user or agent who endorsed
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSkillRequirement {
  skillName: string;
  minProficiency: ProficiencyLevel;
}

export interface RoutingCandidate {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentStatus: string;
  // Scoring
  skillFitScore: number;       // 0-100: how well skills match
  availabilityScore: number;   // 0-100: current workload capacity
  workloadScore: number;       // 0-100: balance relative to peers
  costScore: number;           // 0-100: cost efficiency
  overallScore: number;        // 0-100: weighted composite
  // Detail
  matchedSkills: { skillName: string; proficiency: ProficiencyLevel; required: ProficiencyLevel }[];
  missingSkills: string[];
  currentTaskCount: number;
  recentCostCents: number;
  healthScore: number;
}

export interface RoutingResult {
  candidates: RoutingCandidate[];
  bestMatch: RoutingCandidate | null;
  requirements: TaskSkillRequirement[];
}

// Built-in skill catalog
export const SKILL_CATALOG = [
  "coding", "testing", "code-review", "documentation", "debugging",
  "architecture", "devops", "security", "data-analysis", "research",
  "api-design", "frontend", "backend", "database", "infrastructure",
  "project-management", "communication", "problem-solving",
] as const;
