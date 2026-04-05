export interface PermissionPolicy {
  id: string;
  companyId: string | null;
  name: string;
  description: string;
  canCreateIssues: boolean;
  canUpdateIssues: boolean;
  canDeleteIssues: boolean;
  canCreateAgents: boolean;
  canManageSecrets: boolean;
  canAccessVault: boolean;
  canApproveRequests: boolean;
  allowedVaultCredentials: string[] | null;
  allowedWorkspaces: string[] | null;
  maxConcurrentRuns: number;
  maxRunDurationSeconds: number;
  allowedDomains: string[] | null;
  blockedDomains: string[];
  createdAt: string;
  updatedAt: string;
}
