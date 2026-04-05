import type { FeedbackDataSharingPreference } from "./feedback.js";

export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
  keyboardShortcuts: boolean;
  feedbackDataSharingPreference: FeedbackDataSharingPreference;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
  enableAgentOs: boolean;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  role: string;
  soulMd: string;
  heartbeatMd: string;
  agentsMd: string;
  defaultBudgetMonthlyCents: number;
  permissionPolicyId: string | null;
  status: "available" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface InstanceAdminSettings {
  /** Scrypt-hashed PIN for admin access (null = use default "1234") */
  adminPinHash: string | null;
  /** Allowed adapter types for agent creation (null = all allowed) */
  allowedAdapterTypes: string[] | null;
  /** Allowed models per adapter type (null = all allowed, per-key null = all for that adapter) */
  allowedModelsPerAdapter: Record<string, string[] | null> | null;
  /** Allowed agent roles for creation (null = all allowed) */
  allowedRoles: string[] | null;
  /** Admin PIN session timeout in seconds */
  pinSessionTimeoutSec: number;
  /** Pre-configured agent templates */
  agentTemplates: AgentTemplate[];
  /** Data retention policies (days, 0 = keep forever) */
  retentionRunLogsDays: number;
  retentionActivityDays: number;
  retentionCostEventsDays: number;
  retentionTokenAuditDays: number;
  /** Workspace governance */
  allowedGitRepos: string[] | null;
  protectedBranches: string[];
  workspaceAutoCleanupHours: number;
  maxWorkspaceDiskMb: number;
  /** OpenTelemetry */
  otelEnabled: boolean;
  otelEndpoint: string;
  otelServiceName: string;
  otelSampleRate: number;
  /** Agent Governance: allow Agent OS to create temporary session agents */
  enableSessionAgents: boolean;
  /** Danger Zone: allow agents to use "autonomous" autonomy level */
  allowAutonomousMode: boolean;
}

/** Public version of admin settings (PIN hash stripped) */
export type InstanceAdminSettingsPublic = Omit<InstanceAdminSettings, "adminPinHash">;

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  admin: InstanceAdminSettings;
  createdAt: Date;
  updatedAt: Date;
}
