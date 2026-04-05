export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  priority: string;
  dependsOnStepIds: string[];
  estimatedMinutes?: number;
  autoAssign: boolean; // auto-assign to the new agent
}

export interface OnboardingWorkflow {
  id: string;
  companyId: string;
  name: string;
  description: string;
  targetRole: string; // which role this onboarding applies to
  steps: OnboardingStep[];
  enabled: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingInstance {
  id: string;
  companyId: string;
  workflowId: string;
  workflowName: string;
  agentId: string;
  agentName: string;
  status: "active" | "completed" | "cancelled";
  issueIds: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface OffboardingReport {
  agentId: string;
  agentName: string;
  agentRole: string;
  // Reassignment
  openTasksReassigned: number;
  reassignedToAgentId: string | null;
  reassignedToAgentName: string | null;
  // Vault
  vaultCheckoutsRevoked: number;
  // State
  status: string;
  offboardedAt: string;
  actions: string[];
}

export type ChangeRequestStatus = "draft" | "pending_review" | "approved" | "rejected" | "implemented" | "rolled_back";
export type ChangeRequestRisk = "low" | "medium" | "high" | "critical";
export type ChangeRequestCategory = "agent_config" | "policy_change" | "infrastructure" | "workflow" | "access_control" | "other";

export interface ChangeRequest {
  id: string;
  companyId: string;
  title: string;
  description: string;
  category: ChangeRequestCategory;
  risk: ChangeRequestRisk;
  status: ChangeRequestStatus;
  requestedByUserId: string;
  reviewerNotes: string;
  // Impact
  affectedAgentIds: string[];
  affectedAgentNames?: string[];
  // Scheduling
  scheduledAt: string | null;
  implementedAt: string | null;
  rolledBackAt: string | null;
  // Validation
  validationSteps: string;
  validationResult: string | null;
  createdAt: string;
  updatedAt: string;
}
