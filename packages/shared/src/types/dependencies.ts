export type DependencyType = "blocks" | "depends_on" | "relates_to";

export interface IssueDependency {
  id: string;
  companyId: string;
  sourceIssueId: string;
  targetIssueId: string;
  dependencyType: DependencyType;
  // Enriched fields (populated by service)
  sourceIssueTitle?: string;
  sourceIssueIdentifier?: string;
  sourceIssueStatus?: string;
  targetIssueTitle?: string;
  targetIssueIdentifier?: string;
  targetIssueStatus?: string;
  createdAt: string;
}

export interface WorkflowTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  enabled: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  priority: string;
  assigneeRole?: string;
  dependsOnStepIds: string[]; // references other step IDs in same template
  estimatedMinutes?: number;
}

export interface WorkflowInstance {
  templateId: string;
  templateName: string;
  issueIds: string[];
  createdAt: string;
}

export interface CriticalPathNode {
  issueId: string;
  issueTitle: string;
  issueIdentifier: string;
  issueStatus: string;
  issuePriority: string;
  assigneeAgentName: string | null;
  estimatedMinutes: number;
  isCritical: boolean;
  depth: number;
  blockedBy: string[];
  blocks: string[];
}

export interface CriticalPathResult {
  nodes: CriticalPathNode[];
  criticalPathLength: number;
  estimatedCompletionMinutes: number;
  bottleneckIssueId: string | null;
}
