/**
 * IPC Channel Definitions — Typed contract between Electron main and renderer.
 *
 * This file defines every IPC channel that replaces the Express REST API.
 * Each channel maps to a specific service call in the main process.
 *
 * Convention:
 *   - Channel names use "domain:action" format (e.g., "agents:list")
 *   - Compound actions use "domain:sub-action" (e.g., "agents:list-keys")
 *   - Args type is the request payload (void if none)
 *   - Result type is the response payload
 *
 * Usage in main process:
 *   ipcMain.handle("agents:list", async (_, args) => agentService.list(args))
 *
 * Usage in renderer:
 *   const agents = await window.electronAPI.invoke("agents:list", { companyId })
 */

import type {
  Company,
  Agent,
  AgentDetail,
  AgentPermissions,
  AgentKeyCreated,
  AgentConfigRevision,
  AgentInstructionsBundle,
  AgentInstructionsFileSummary,
  AgentInstructionsFileDetail,
  AgentRuntimeState,
  AgentTaskSession,
  AgentWakeupResponse,
  AdapterEnvironmentTestResult,
  AgentSkillSnapshot,
  Project,
  ProjectWorkspace,
  ExecutionWorkspace,
  WorkspaceOperation,
  Issue,
  IssueComment,
  IssueDocument,
  IssueDocumentSummary,
  IssueAttachment,
  IssueLabel,
  IssueWorkProduct,
  Goal,
  Approval,
  ApprovalComment,
  BudgetPolicy,
  BudgetPolicySummary,
  BudgetIncident,
  BudgetOverview,
  CostEvent,
  CostSummary,
  CostByAgent,
  CostByProviderModel,
  CostByBiller,
  CostByAgentModel,
  CostWindowSpendRow,
  CostByProject,
  FinanceEvent,
  FinanceSummary,
  FinanceByBiller,
  FinanceByKind,
  HeartbeatRun,
  HeartbeatRunEvent,
  LiveEvent,
  DashboardSummary,
  ActivityEvent,
  SidebarBadges,
  CompanySecret,
  SecretProviderDescriptor,
  Routine,
  RoutineDetail,
  RoutineRun,
  RoutineRunSummary,
  RoutineListItem,
  RoutineTrigger,
  RoutineTriggerSecretMaterial,
  PluginRecord,
  PluginConfig,
  PluginJobRecord,
  PluginJobRunRecord,
  VaultCredential,
  VaultTokenCheckout,
  VaultCheckoutResult,
  PermissionPolicy,
  TeamRole,
  CompanyMembership,
  Invite,
  JoinRequest,
  InstanceUserRoleGrant,
  InstanceSettings,
  InstanceGeneralSettings,
  InstanceExperimentalSettings,
  InstanceAdminSettings,
  InstanceAdminSettingsPublic,
  AssetImage,
  CompanyPortabilityExportResult,
  CompanyPortabilityPreviewResult,
  CompanyPortabilityImportResult,
  CompanyPortabilityExportPreviewResult,
  InstanceSchedulerHeartbeatAgent,
  AgentTemplate,
  CompanySkill,
  CompanySkillDetail,
  CompanySkillListItem,
  CompanySkillImportResult,
  CompanySkillProjectScanResult,
  QuotaWindow,
  ProviderQuotaResult,
  FeedbackVote,
  FeedbackTrace,
  FeedbackTraceBundle,
} from "./types/index.js";

import type {
  CreateCompany,
  UpdateCompany,
  UpdateCompanyBranding,
  CreateAgent,
  CreateAgentHire,
  UpdateAgent,
  UpdateAgentInstructionsBundle,
  UpsertAgentInstructionsFile,
  UpdateAgentInstructionsPath,
  CreateAgentKey,
  WakeAgent,
  ResetAgentSession,
  TestAdapterEnvironment,
  UpdateAgentPermissions,
  CreateProject,
  UpdateProject,
  CreateProjectWorkspace,
  UpdateProjectWorkspace,
  CreateIssue,
  UpdateIssue,
  CheckoutIssue,
  AddIssueComment,
  LinkIssueApproval,
  CreateIssueAttachmentMetadata,
  CreateIssueWorkProduct,
  UpdateIssueWorkProduct,
  UpdateExecutionWorkspace,
  UpsertIssueDocument,
  RestoreIssueDocumentRevision,
  CreateGoal,
  UpdateGoal,
  CreateApproval,
  ResolveApproval,
  RequestApprovalRevision,
  ResubmitApproval,
  AddApprovalComment,
  UpsertBudgetPolicy,
  ResolveBudgetIncident,
  UpdateBudget,
  CreateSecret,
  RotateSecret,
  UpdateSecret,
  CreateRoutine,
  UpdateRoutine,
  CreateRoutineTrigger,
  UpdateRoutineTrigger,
  RunRoutine,
  RotateRoutineTriggerSecret,
  CreateCostEvent,
  CreateFinanceEvent,
  CreateAssetImageMetadata,
  CreateCompanyInvite,
  AcceptInvite,
  UpdateMemberPermissions,
  UpdateUserCompanyAccess,
  // CreatePermissionPolicy, UpdatePermissionPolicy — imported separately below
  // CreateVaultCredential, UpdateVaultCredential — imported separately below
  InstallPlugin,
  UpsertPluginConfig,
  PatchPluginConfig,
  UpdatePluginStatus,
  UninstallPlugin,
  CompanyPortabilityExport,
  CompanyPortabilityPreview,
  CompanyPortabilityImport,
  AgentSkillSync,
  UpsertIssueFeedbackVote,
  CompanySkillImport,
  CompanySkillProjectScan,
  CompanySkillCreate,
  CompanySkillFileUpdate,
  CreateIssueLabel,
} from "./validators/index.js";

import type {
  ChatterMessage,
} from "./types/chatter.js";

import type {
  SlaPolicy,
  SlaTracking,
  SlaDashboardSummary,
  EscalationRule,
} from "./types/sla.js";

import type {
  IssueDependency,
  WorkflowTemplate,
  WorkflowInstance,
  CriticalPathResult,
} from "./types/dependencies.js";

import type {
  AgentSkillProficiency,
  RoutingResult,
} from "./types/skill-routing.js";

import type {
  OnboardingWorkflow,
  OnboardingInstance,
  OffboardingReport,
  ChangeRequest,
} from "./types/lifecycle.js";

import type {
  PatchInstanceGeneralSettings,
  PatchInstanceExperimentalSettings,
  PatchInstanceAdminSettings,
  CreateAgentTemplate,
  UpdateAgentTemplate,
} from "./validators/index.js";

import type {
  CreatePermissionPolicy,
  UpdatePermissionPolicy,
} from "./validators/permission-policy.js";

import type {
  CreateVaultCredential,
  UpdateVaultCredential,
} from "./validators/vault.js";

// ── Helper type for query parameters ─────────────────────────────────────

interface PaginationParams {
  limit?: number;
  offset?: number;
}

interface CompanyScoped {
  companyId: string;
}

interface DateRangeParams {
  from?: string;
  to?: string;
}

// ── IPC Channel Map ──────────────────────────────────────────────────────

/**
 * Complete typed map of all IPC channels.
 *
 * Key = channel name
 * Value = { args: request payload, result: response payload }
 */
export interface IpcChannelMap {
  // ═══════════════════════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════════════════════
  "health:check": {
    args: void;
    result: { status: string; database: string; bootstrapped: boolean };
  };
  "health:stats": {
    args: void;
    result: Record<string, any>;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COMPANIES
  // ═══════════════════════════════════════════════════════════════════════
  "companies:list": {
    args: void;
    result: Company[];
  };
  "companies:get": {
    args: { companyId: string };
    result: Company;
  };
  "companies:create": {
    args: CreateCompany;
    result: Company;
  };
  "companies:update": {
    args: { companyId: string } & Partial<UpdateCompany>;
    result: Company;
  };
  "companies:update-branding": {
    args: { companyId: string } & UpdateCompanyBranding;
    result: Company;
  };
  "companies:archive": {
    args: { companyId: string };
    result: void;
  };
  "companies:delete": {
    args: { companyId: string };
    result: void;
  };
  "companies:export": {
    args: { companyId: string } & CompanyPortabilityExport;
    result: CompanyPortabilityExportResult;
  };
  "companies:export-preview": {
    args: { companyId: string } & CompanyPortabilityExport;
    result: CompanyPortabilityExportPreviewResult;
  };
  "companies:import-preview": {
    args: CompanyPortabilityPreview;
    result: CompanyPortabilityPreviewResult;
  };
  "companies:import": {
    args: CompanyPortabilityImport;
    result: CompanyPortabilityImportResult;
  };
  "companies:get-feedback-traces": {
    args: CompanyScoped & PaginationParams;
    result: FeedbackTrace[];
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AGENTS
  // ═══════════════════════════════════════════════════════════════════════
  "agents:list": {
    args: CompanyScoped;
    result: Agent[];
  };
  "agents:get": {
    args: { id: string };
    result: AgentDetail;
  };
  "agents:get-me": {
    args: void;
    result: Agent;
  };
  "agents:create": {
    args: CompanyScoped & CreateAgent;
    result: Agent;
  };
  "agents:hire": {
    args: CompanyScoped & CreateAgentHire;
    result: Agent;
  };
  "agents:update": {
    args: { id: string } & UpdateAgent;
    result: Agent;
  };
  "agents:pause": {
    args: { id: string };
    result: Agent;
  };
  "agents:resume": {
    args: { id: string };
    result: Agent;
  };
  "agents:terminate": {
    args: { id: string };
    result: Agent;
  };
  "agents:delete": {
    args: { id: string };
    result: void;
  };
  "agents:wakeup": {
    args: { id: string } & WakeAgent;
    result: AgentWakeupResponse;
  };
  "agents:invoke-heartbeat": {
    args: { id: string };
    result: void;
  };

  // Agent configuration
  "agents:get-configuration": {
    args: { id: string };
    result: Record<string, any>;
  };
  "agents:get-config-revisions": {
    args: { id: string };
    result: AgentConfigRevision[];
  };
  "agents:get-config-revision": {
    args: { id: string; revisionId: string };
    result: AgentConfigRevision;
  };
  "agents:rollback-config": {
    args: { id: string; revisionId: string };
    result: void;
  };
  "agents:list-configurations": {
    args: CompanyScoped;
    result: Record<string, any>[];
  };

  // Agent permissions
  "agents:update-permissions": {
    args: { id: string } & UpdateAgentPermissions;
    result: AgentPermissions;
  };
  "agents:update-policy": {
    args: { id: string; policy: Record<string, any> };
    result: void;
  };

  // Agent instructions
  "agents:get-instructions-bundle": {
    args: { id: string };
    result: AgentInstructionsBundle;
  };
  "agents:update-instructions-bundle": {
    args: { id: string } & UpdateAgentInstructionsBundle;
    result: AgentInstructionsBundle;
  };
  "agents:get-instructions-file": {
    args: { id: string; path?: string };
    result: AgentInstructionsFileDetail;
  };
  "agents:upsert-instructions-file": {
    args: { id: string } & UpsertAgentInstructionsFile;
    result: AgentInstructionsFileSummary;
  };
  "agents:delete-instructions-file": {
    args: { id: string; path?: string };
    result: void;
  };
  "agents:update-instructions-path": {
    args: { id: string } & UpdateAgentInstructionsPath;
    result: void;
  };

  // Agent runtime
  "agents:get-runtime-state": {
    args: { id: string };
    result: AgentRuntimeState;
  };
  "agents:get-task-sessions": {
    args: { id: string };
    result: AgentTaskSession[];
  };
  "agents:reset-session": {
    args: { id: string } & ResetAgentSession;
    result: void;
  };

  // Agent API keys
  "agents:list-keys": {
    args: { id: string };
    result: any[];
  };
  "agents:create-key": {
    args: { id: string } & CreateAgentKey;
    result: AgentKeyCreated;
  };
  "agents:delete-key": {
    args: { id: string; keyId: string };
    result: void;
  };

  // Agent skills
  "agents:get-skills": {
    args: { id: string };
    result: AgentSkillSnapshot;
  };
  "agents:sync-skills": {
    args: { id: string } & AgentSkillSync;
    result: void;
  };

  // Agent inbox
  "agents:inbox-lite": {
    args: void;
    result: any;
  };
  "agents:inbox-mine": {
    args: Record<string, any>;
    result: Issue[];
  };

  // Agent Claude login
  "agents:claude-login": {
    args: { id: string };
    result: void;
  };

  // Org chart
  "agents:org-chart": {
    args: CompanyScoped;
    result: any;
  };
  "agents:org-chart-svg": {
    args: CompanyScoped;
    result: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ADAPTER / ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════════════
  "adapters:test-environment": {
    args: CompanyScoped & TestAdapterEnvironment;
    result: AdapterEnvironmentTestResult;
  };
  "adapters:list-models": {
    args: CompanyScoped & { type: string };
    result: any[];
  };
  "adapters:detect-model": {
    args: CompanyScoped & { type: string };
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ISSUES
  // ═══════════════════════════════════════════════════════════════════════
  "issues:list": {
    args: CompanyScoped & PaginationParams & {
      status?: string;
      priority?: string;
      assigneeId?: string;
      projectId?: string;
      search?: string;
    };
    result: Issue[];
  };
  "issues:get": {
    args: { id: string };
    result: Issue;
  };
  "issues:create": {
    args: CompanyScoped & CreateIssue;
    result: Issue;
  };
  "issues:update": {
    args: { id: string } & UpdateIssue;
    result: Issue;
  };
  "issues:checkout": {
    args: { id: string } & CheckoutIssue;
    result: Issue;
  };
  "issues:delete": {
    args: { id: string };
    result: void;
  };

  // Issue comments
  "issues:list-comments": {
    args: { issueId: string };
    result: IssueComment[];
  };
  "issues:add-comment": {
    args: { issueId: string } & AddIssueComment;
    result: IssueComment;
  };

  // Issue documents
  "issues:list-documents": {
    args: { issueId: string };
    result: IssueDocumentSummary[];
  };
  "issues:get-document": {
    args: { issueId: string; key: string };
    result: IssueDocument;
  };
  "issues:upsert-document": {
    args: { issueId: string } & UpsertIssueDocument;
    result: IssueDocument;
  };
  "issues:restore-document-revision": {
    args: { issueId: string; key: string } & RestoreIssueDocumentRevision;
    result: IssueDocument;
  };

  // Issue labels
  "issues:list-labels": {
    args: CompanyScoped;
    result: IssueLabel[];
  };
  "issues:create-label": {
    args: CompanyScoped & CreateIssueLabel;
    result: IssueLabel;
  };

  // Issue attachments
  "issues:create-attachment-metadata": {
    args: { issueId: string } & CreateIssueAttachmentMetadata;
    result: IssueAttachment;
  };

  // Issue work products
  "issues:list-work-products": {
    args: { issueId: string };
    result: IssueWorkProduct[];
  };
  "issues:create-work-product": {
    args: { issueId: string } & CreateIssueWorkProduct;
    result: IssueWorkProduct;
  };
  "issues:update-work-product": {
    args: { issueId: string; workProductId: string } & UpdateIssueWorkProduct;
    result: IssueWorkProduct;
  };

  // Issue approvals
  "issues:link-approval": {
    args: { issueId: string } & LinkIssueApproval;
    result: void;
  };

  // Issue feedback
  "issues:upsert-feedback-vote": {
    args: { issueId: string } & UpsertIssueFeedbackVote;
    result: FeedbackVote;
  };

  // Issue runs
  "issues:list-live-runs": {
    args: { issueId: string };
    result: HeartbeatRun[];
  };
  "issues:get-active-run": {
    args: { issueId: string };
    result: HeartbeatRun | null;
  };

  // Issue execution workspaces
  "issues:get-execution-workspace-settings": {
    args: { issueId: string };
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════════════════
  "projects:list": {
    args: CompanyScoped;
    result: Project[];
  };
  "projects:get": {
    args: { id: string };
    result: Project;
  };
  "projects:create": {
    args: CompanyScoped & CreateProject;
    result: Project;
  };
  "projects:update": {
    args: { id: string } & UpdateProject;
    result: Project;
  };
  "projects:delete": {
    args: { id: string };
    result: void;
  };

  // Project workspaces
  "projects:list-workspaces": {
    args: { projectId: string };
    result: ProjectWorkspace[];
  };
  "projects:create-workspace": {
    args: { projectId: string } & CreateProjectWorkspace;
    result: ProjectWorkspace;
  };
  "projects:update-workspace": {
    args: { projectId: string; workspaceId: string } & UpdateProjectWorkspace;
    result: ProjectWorkspace;
  };
  "projects:delete-workspace": {
    args: { projectId: string; workspaceId: string };
    result: void;
  };
  "projects:workspace-runtime-action": {
    args: { projectId: string; workspaceId: string; action: string };
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTION WORKSPACES
  // ═══════════════════════════════════════════════════════════════════════
  "execution-workspaces:list": {
    args: CompanyScoped;
    result: ExecutionWorkspace[];
  };
  "execution-workspaces:get": {
    args: { id: string };
    result: ExecutionWorkspace;
  };
  "execution-workspaces:update": {
    args: { id: string } & UpdateExecutionWorkspace;
    result: ExecutionWorkspace;
  };
  "execution-workspaces:get-close-readiness": {
    args: { id: string };
    result: any;
  };
  "execution-workspaces:list-operations": {
    args: { id: string };
    result: WorkspaceOperation[];
  };
  "execution-workspaces:runtime-action": {
    args: { id: string; action: string };
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // GOALS
  // ═══════════════════════════════════════════════════════════════════════
  "goals:list": {
    args: CompanyScoped;
    result: Goal[];
  };
  "goals:get": {
    args: { id: string };
    result: Goal;
  };
  "goals:create": {
    args: CompanyScoped & CreateGoal;
    result: Goal;
  };
  "goals:update": {
    args: { id: string } & UpdateGoal;
    result: Goal;
  };
  "goals:delete": {
    args: { id: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // APPROVALS
  // ═══════════════════════════════════════════════════════════════════════
  "approvals:list": {
    args: CompanyScoped & PaginationParams & { status?: string };
    result: Approval[];
  };
  "approvals:get": {
    args: { id: string };
    result: Approval;
  };
  "approvals:create": {
    args: CreateApproval;
    result: Approval;
  };
  "approvals:resolve": {
    args: { id: string } & ResolveApproval;
    result: Approval;
  };
  "approvals:request-revision": {
    args: { id: string } & RequestApprovalRevision;
    result: Approval;
  };
  "approvals:resubmit": {
    args: { id: string } & ResubmitApproval;
    result: Approval;
  };
  "approvals:add-comment": {
    args: { id: string } & AddApprovalComment;
    result: ApprovalComment;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ROUTINES
  // ═══════════════════════════════════════════════════════════════════════
  "routines:list": {
    args: CompanyScoped;
    result: RoutineListItem[];
  };
  "routines:get": {
    args: { id: string };
    result: RoutineDetail;
  };
  "routines:create": {
    args: CompanyScoped & CreateRoutine;
    result: Routine;
  };
  "routines:update": {
    args: { id: string } & UpdateRoutine;
    result: Routine;
  };
  "routines:delete": {
    args: { id: string };
    result: void;
  };
  "routines:run": {
    args: { id: string } & RunRoutine;
    result: void;
  };
  "routines:list-runs": {
    args: { id: string } & PaginationParams;
    result: RoutineRunSummary[];
  };

  // Routine triggers
  "routines:create-trigger": {
    args: { routineId: string } & CreateRoutineTrigger;
    result: RoutineTrigger;
  };
  "routines:update-trigger": {
    args: { triggerId: string } & UpdateRoutineTrigger;
    result: RoutineTrigger;
  };
  "routines:delete-trigger": {
    args: { triggerId: string };
    result: void;
  };
  "routines:rotate-trigger-secret": {
    args: { triggerId: string } & RotateRoutineTriggerSecret;
    result: RoutineTriggerSecretMaterial;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COSTS & FINANCE
  // ═══════════════════════════════════════════════════════════════════════
  "costs:create-event": {
    args: CompanyScoped & CreateCostEvent;
    result: CostEvent;
  };
  "costs:create-finance-event": {
    args: CompanyScoped & CreateFinanceEvent;
    result: FinanceEvent;
  };
  "costs:summary": {
    args: CompanyScoped & DateRangeParams;
    result: CostSummary;
  };
  "costs:by-agent": {
    args: CompanyScoped & DateRangeParams;
    result: CostByAgent[];
  };
  "costs:by-agent-model": {
    args: CompanyScoped & DateRangeParams;
    result: CostByAgentModel[];
  };
  "costs:by-provider": {
    args: CompanyScoped & DateRangeParams;
    result: CostByProviderModel[];
  };
  "costs:by-biller": {
    args: CompanyScoped & DateRangeParams;
    result: CostByBiller[];
  };
  "costs:by-project": {
    args: CompanyScoped & DateRangeParams;
    result: CostByProject[];
  };
  "costs:finance-summary": {
    args: CompanyScoped & DateRangeParams;
    result: FinanceSummary;
  };
  "costs:finance-by-biller": {
    args: CompanyScoped & DateRangeParams;
    result: FinanceByBiller[];
  };
  "costs:finance-by-kind": {
    args: CompanyScoped & DateRangeParams;
    result: FinanceByKind[];
  };
  "costs:finance-events": {
    args: CompanyScoped & DateRangeParams & PaginationParams;
    result: FinanceEvent[];
  };
  "costs:window-spend": {
    args: CompanyScoped;
    result: CostWindowSpendRow[];
  };
  "costs:quota-windows": {
    args: CompanyScoped;
    result: ProviderQuotaResult[];
  };

  // Budgets
  "budgets:overview": {
    args: CompanyScoped;
    result: BudgetOverview;
  };
  "budgets:upsert-policy": {
    args: CompanyScoped & UpsertBudgetPolicy;
    result: BudgetPolicy;
  };
  "budgets:resolve-incident": {
    args: CompanyScoped & { incidentId: string } & ResolveBudgetIncident;
    result: BudgetIncident;
  };
  "budgets:update": {
    args: CompanyScoped & UpdateBudget;
    result: void;
  };
  "budgets:update-agent": {
    args: { agentId: string } & UpdateBudget;
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SECRETS
  // ═══════════════════════════════════════════════════════════════════════
  "secrets:list-providers": {
    args: CompanyScoped;
    result: SecretProviderDescriptor[];
  };
  "secrets:list": {
    args: CompanyScoped;
    result: CompanySecret[];
  };
  "secrets:create": {
    args: CompanyScoped & CreateSecret;
    result: CompanySecret;
  };
  "secrets:rotate": {
    args: { id: string } & RotateSecret;
    result: CompanySecret;
  };
  "secrets:update": {
    args: { id: string } & UpdateSecret;
    result: CompanySecret;
  };
  "secrets:delete": {
    args: { id: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // VAULT
  // ═══════════════════════════════════════════════════════════════════════
  "vault:list": {
    args: CompanyScoped;
    result: VaultCredential[];
  };
  "vault:get": {
    args: { credId: string };
    result: VaultCredential;
  };
  "vault:create": {
    args: CompanyScoped & CreateVaultCredential;
    result: VaultCredential;
  };
  "vault:update": {
    args: { credId: string } & UpdateVaultCredential;
    result: VaultCredential;
  };
  "vault:delete": {
    args: { credId: string };
    result: void;
  };
  "vault:rotate": {
    args: { credId: string };
    result: VaultCredential;
  };
  "vault:checkout": {
    args: { credId: string };
    result: VaultCheckoutResult;
  };
  "vault:audit": {
    args: { credId: string };
    result: VaultTokenCheckout[];
  };
  "vault:active-checkouts": {
    args: CompanyScoped;
    result: VaultTokenCheckout[];
  };
  "vault:recent-checkouts": {
    args: CompanyScoped;
    result: VaultTokenCheckout[];
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DASHBOARD & ACTIVITY
  // ═══════════════════════════════════════════════════════════════════════
  "dashboard:summary": {
    args: CompanyScoped;
    result: DashboardSummary;
  };
  "activity:list": {
    args: CompanyScoped & PaginationParams & DateRangeParams & {
      actorId?: string;
      entityType?: string;
      entityId?: string;
    };
    result: ActivityEvent[];
  };
  "sidebar-badges:get": {
    args: CompanyScoped;
    result: SidebarBadges;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // HEARTBEAT RUNS
  // ═══════════════════════════════════════════════════════════════════════
  "heartbeat-runs:list": {
    args: CompanyScoped & PaginationParams;
    result: HeartbeatRun[];
  };
  "heartbeat-runs:list-live": {
    args: CompanyScoped;
    result: HeartbeatRun[];
  };
  "heartbeat-runs:get": {
    args: { runId: string };
    result: HeartbeatRun;
  };
  "heartbeat-runs:cancel": {
    args: { runId: string };
    result: void;
  };
  "heartbeat-runs:get-events": {
    args: { runId: string };
    result: HeartbeatRunEvent[];
  };
  "heartbeat-runs:get-log": {
    args: { runId: string };
    result: string;
  };
  "heartbeat-runs:list-operations": {
    args: { runId: string };
    result: WorkspaceOperation[];
  };
  "workspace-operations:get-log": {
    args: { operationId: string };
    result: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // INSTANCE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════
  "instance:get-general-settings": {
    args: void;
    result: InstanceGeneralSettings;
  };
  "instance:patch-general-settings": {
    args: PatchInstanceGeneralSettings;
    result: InstanceGeneralSettings;
  };
  "instance:get-experimental-settings": {
    args: void;
    result: InstanceExperimentalSettings;
  };
  "instance:patch-experimental-settings": {
    args: PatchInstanceExperimentalSettings;
    result: InstanceExperimentalSettings;
  };
  "instance:get-admin-settings": {
    args: void;
    result: InstanceAdminSettingsPublic;
  };
  "instance:patch-admin-settings": {
    args: PatchInstanceAdminSettings;
    result: InstanceAdminSettings;
  };
  "instance:get-scheduler-heartbeats": {
    args: void;
    result: InstanceSchedulerHeartbeatAgent[];
  };

  // Admin templates
  "instance:list-templates": {
    args: void;
    result: AgentTemplate[];
  };
  "instance:list-available-templates": {
    args: void;
    result: AgentTemplate[];
  };
  "instance:create-template": {
    args: CreateAgentTemplate;
    result: AgentTemplate;
  };
  "instance:update-template": {
    args: { id: string } & UpdateAgentTemplate;
    result: AgentTemplate;
  };
  "instance:delete-template": {
    args: { id: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SLA
  // ═══════════════════════════════════════════════════════════════════════
  "sla:list-policies": {
    args: CompanyScoped;
    result: SlaPolicy[];
  };
  "sla:create-policy": {
    args: CompanyScoped & Omit<SlaPolicy, "id">;
    result: SlaPolicy;
  };
  "sla:update-policy": {
    args: CompanyScoped & { policyId: string } & Partial<SlaPolicy>;
    result: SlaPolicy;
  };
  "sla:delete-policy": {
    args: CompanyScoped & { policyId: string };
    result: void;
  };
  "sla:list-tracking": {
    args: CompanyScoped;
    result: SlaTracking[];
  };
  "sla:get-issue-tracking": {
    args: CompanyScoped & { issueId: string };
    result: SlaTracking;
  };
  "sla:start-tracking": {
    args: CompanyScoped & { issueId: string; policyId?: string };
    result: SlaTracking;
  };
  "sla:pause-tracking": {
    args: CompanyScoped & { issueId: string };
    result: SlaTracking;
  };
  "sla:resume-tracking": {
    args: CompanyScoped & { issueId: string };
    result: SlaTracking;
  };
  "sla:respond-tracking": {
    args: CompanyScoped & { issueId: string };
    result: SlaTracking;
  };
  "sla:resolve-tracking": {
    args: CompanyScoped & { issueId: string };
    result: SlaTracking;
  };
  "sla:dashboard": {
    args: CompanyScoped;
    result: SlaDashboardSummary;
  };
  "sla:check-breaches": {
    args: CompanyScoped;
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ESCALATION
  // ═══════════════════════════════════════════════════════════════════════
  "escalation:list-rules": {
    args: CompanyScoped;
    result: EscalationRule[];
  };
  "escalation:create-rule": {
    args: CompanyScoped & Omit<EscalationRule, "id">;
    result: EscalationRule;
  };
  "escalation:update-rule": {
    args: CompanyScoped & { ruleId: string } & Partial<EscalationRule>;
    result: EscalationRule;
  };
  "escalation:delete-rule": {
    args: CompanyScoped & { ruleId: string };
    result: void;
  };
  "escalation:evaluate": {
    args: CompanyScoped;
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DEPENDENCIES & WORKFLOWS
  // ═══════════════════════════════════════════════════════════════════════
  "dependencies:list": {
    args: CompanyScoped;
    result: IssueDependency[];
  };
  "dependencies:list-for-issue": {
    args: CompanyScoped & { issueId: string };
    result: IssueDependency[];
  };
  "dependencies:create": {
    args: CompanyScoped & { sourceIssueId: string; targetIssueId: string; type: string };
    result: IssueDependency;
  };
  "dependencies:delete": {
    args: CompanyScoped & { depId: string };
    result: void;
  };
  "dependencies:mark-completed": {
    args: CompanyScoped & { issueId: string };
    result: void;
  };
  "dependencies:critical-path": {
    args: CompanyScoped;
    result: CriticalPathResult;
  };

  "workflows:list": {
    args: CompanyScoped;
    result: WorkflowTemplate[];
  };
  "workflows:get": {
    args: CompanyScoped & { workflowId: string };
    result: WorkflowTemplate;
  };
  "workflows:create": {
    args: CompanyScoped & Omit<WorkflowTemplate, "id">;
    result: WorkflowTemplate;
  };
  "workflows:update": {
    args: CompanyScoped & { workflowId: string } & Partial<WorkflowTemplate>;
    result: WorkflowTemplate;
  };
  "workflows:delete": {
    args: CompanyScoped & { workflowId: string };
    result: void;
  };
  "workflows:execute": {
    args: CompanyScoped & { workflowId: string };
    result: WorkflowInstance;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SKILL ROUTING
  // ═══════════════════════════════════════════════════════════════════════
  "skill-routing:list-proficiency": {
    args: CompanyScoped;
    result: AgentSkillProficiency[];
  };
  "skill-routing:skill-matrix": {
    args: CompanyScoped;
    result: any;
  };
  "skill-routing:agent-skills": {
    args: CompanyScoped & { agentId: string };
    result: AgentSkillProficiency[];
  };
  "skill-routing:set-proficiency": {
    args: CompanyScoped & AgentSkillProficiency;
    result: AgentSkillProficiency;
  };
  "skill-routing:delete-proficiency": {
    args: CompanyScoped & { skillId: string };
    result: void;
  };
  "skill-routing:route-task": {
    args: CompanyScoped & { description: string; skills?: string[] };
    result: RoutingResult;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════
  "analytics:get": {
    args: CompanyScoped & DateRangeParams;
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════
  "performance:get": {
    args: CompanyScoped & DateRangeParams;
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE (Onboarding, Offboarding, Change Requests)
  // ═══════════════════════════════════════════════════════════════════════
  "lifecycle:list-onboarding-workflows": {
    args: CompanyScoped;
    result: OnboardingWorkflow[];
  };
  "lifecycle:create-onboarding-workflow": {
    args: CompanyScoped & Omit<OnboardingWorkflow, "id">;
    result: OnboardingWorkflow;
  };
  "lifecycle:update-onboarding-workflow": {
    args: CompanyScoped & { id: string } & Partial<OnboardingWorkflow>;
    result: OnboardingWorkflow;
  };
  "lifecycle:delete-onboarding-workflow": {
    args: CompanyScoped & { id: string };
    result: void;
  };
  "lifecycle:execute-onboarding": {
    args: CompanyScoped & { agentId?: string; workflowId?: string };
    result: OnboardingInstance;
  };
  "lifecycle:list-onboarding-instances": {
    args: CompanyScoped;
    result: OnboardingInstance[];
  };
  "lifecycle:offboard-agent": {
    args: CompanyScoped & { agentId: string };
    result: OffboardingReport;
  };
  "lifecycle:list-change-requests": {
    args: CompanyScoped;
    result: ChangeRequest[];
  };
  "lifecycle:create-change-request": {
    args: CompanyScoped & Omit<ChangeRequest, "id">;
    result: ChangeRequest;
  };
  "lifecycle:update-change-request": {
    args: CompanyScoped & { id: string } & Partial<ChangeRequest>;
    result: ChangeRequest;
  };
  "lifecycle:delete-change-request": {
    args: CompanyScoped & { id: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CHATTER
  // ═══════════════════════════════════════════════════════════════════════
  "chatter:list": {
    args: CompanyScoped & PaginationParams & { channelId?: string };
    result: ChatterMessage[];
  };
  "chatter:send": {
    args: CompanyScoped & { content: string; channelId?: string };
    result: ChatterMessage;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ASSETS
  // ═══════════════════════════════════════════════════════════════════════
  "assets:upload-image": {
    args: CompanyScoped & CreateAssetImageMetadata & { data: ArrayBuffer };
    result: AssetImage;
  };
  "assets:upload-logo": {
    args: CompanyScoped & { data: ArrayBuffer };
    result: AssetImage;
  };
  "assets:get-content": {
    args: { assetId: string };
    result: ArrayBuffer;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TEAM ROLES & PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════
  "team-roles:list": {
    args: CompanyScoped;
    result: TeamRole[];
  };
  "team-roles:create": {
    args: CompanyScoped & Omit<TeamRole, "id">;
    result: TeamRole;
  };
  "team-roles:update": {
    args: { roleId: string } & Partial<TeamRole>;
    result: TeamRole;
  };
  "team-roles:delete": {
    args: { roleId: string };
    result: void;
  };

  "permission-policies:list": {
    args: CompanyScoped;
    result: PermissionPolicy[];
  };
  "permission-policies:create": {
    args: CompanyScoped & CreatePermissionPolicy;
    result: PermissionPolicy;
  };
  "permission-policies:update": {
    args: { id: string } & UpdatePermissionPolicy;
    result: PermissionPolicy;
  };
  "permission-policies:delete": {
    args: { id: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ACCESS & MEMBERS
  // ═══════════════════════════════════════════════════════════════════════
  "members:list": {
    args: CompanyScoped;
    result: CompanyMembership[];
  };
  "members:update-permissions": {
    args: { memberId: string } & UpdateMemberPermissions;
    result: CompanyMembership;
  };
  "members:update-access": {
    args: { userId: string } & UpdateUserCompanyAccess;
    result: void;
  };

  "invites:create": {
    args: CompanyScoped & CreateCompanyInvite;
    result: Invite;
  };
  "invites:accept": {
    args: { token: string } & AcceptInvite;
    result: void;
  };
  "invites:list-join-requests": {
    args: CompanyScoped;
    result: JoinRequest[];
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COMPANY SKILLS
  // ═══════════════════════════════════════════════════════════════════════
  "company-skills:list": {
    args: CompanyScoped;
    result: CompanySkillListItem[];
  };
  "company-skills:get": {
    args: CompanyScoped & { skillId: string };
    result: CompanySkillDetail;
  };
  "company-skills:create": {
    args: CompanyScoped & CompanySkillCreate;
    result: CompanySkill;
  };
  "company-skills:import": {
    args: CompanyScoped & CompanySkillImport;
    result: CompanySkillImportResult;
  };
  "company-skills:scan-project": {
    args: CompanyScoped & CompanySkillProjectScan;
    result: CompanySkillProjectScanResult;
  };
  "company-skills:update-file": {
    args: CompanyScoped & { skillId: string } & CompanySkillFileUpdate;
    result: void;
  };
  "company-skills:delete": {
    args: CompanyScoped & { skillId: string };
    result: void;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PLUGINS
  // ═══════════════════════════════════════════════════════════════════════
  "plugins:list": {
    args: void;
    result: PluginRecord[];
  };
  "plugins:get": {
    args: { pluginId: string };
    result: PluginRecord;
  };
  "plugins:install": {
    args: InstallPlugin;
    result: PluginRecord;
  };
  "plugins:update-config": {
    args: { pluginId: string } & UpsertPluginConfig;
    result: PluginConfig;
  };
  "plugins:patch-config": {
    args: { pluginId: string } & PatchPluginConfig;
    result: PluginConfig;
  };
  "plugins:update-status": {
    args: { pluginId: string } & UpdatePluginStatus;
    result: PluginRecord;
  };
  "plugins:uninstall": {
    args: { pluginId: string } & UninstallPlugin;
    result: void;
  };
  "plugins:health": {
    args: { pluginId: string };
    result: any;
  };
  "plugins:dashboard": {
    args: { pluginId: string };
    result: any;
  };
  "plugins:ui-contributions": {
    args: void;
    result: any[];
  };
  "plugins:get-data": {
    args: { pluginId: string; key: string; payload?: any };
    result: any;
  };
  "plugins:perform-action": {
    args: { pluginId: string; key: string; payload?: any };
    result: any;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // LLM DOCS
  // ═══════════════════════════════════════════════════════════════════════
  "llms:agent-configuration": {
    args: void;
    result: string;
  };
  "llms:agent-icons": {
    args: void;
    result: string;
  };
  "llms:adapter-configuration": {
    args: { adapterType: string };
    result: string;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // NATIVE ELECTRON (non-REST, new)
  // ═══════════════════════════════════════════════════════════════════════
  "app:get-version": { args: void; result: string };
  "app:get-platform": { args: void; result: string };
  "app:get-locale": { args: void; result: string };
  "app:get-path": { args: string; result: string };
  "shell:open-external": { args: string; result: void };
  "shell:show-item-in-folder": { args: string; result: void };
  "nav:back": { args: void; result: void };
  "nav:forward": { args: void; result: void };
  "nav:can-go-back": { args: void; result: boolean };
  "nav:can-go-forward": { args: void; result: boolean };
  "theme:set": { args: "dark" | "light"; result: void };
  "dialog:open-file": { args: any; result: { canceled: boolean; filePaths: string[] } };
  "dialog:save-file": { args: any; result: { canceled: boolean; filePath: string } };
  "dialog:message-box": { args: any; result: { response: number; checkboxChecked: boolean } };
  "notification:show": { args: { title: string; body: string; navigateTo?: string; urgency?: string }; result: void };
  "tray:set-tooltip": { args: string; result: void };
  "tray:set-badge": { args: number; result: void };
  "window:minimize": { args: void; result: void };
  "window:maximize": { args: void; result: void };
  "window:is-maximized": { args: void; result: boolean };
  "window:is-fullscreen": { args: void; result: boolean };
  "window:close": { args: void; result: void };
  "context-menu:show": {
    args: Array<{ id: string; label: string; enabled?: boolean }>;
    result: string | null;
  };
}

// ── Type-safe IPC helpers ────────────────────────────────────────────────

/**
 * Extract the channel names as a union type.
 */
export type IpcChannel = keyof IpcChannelMap;

/**
 * Get the args type for a specific channel.
 */
export type IpcArgs<C extends IpcChannel> = IpcChannelMap[C]["args"];

/**
 * Get the result type for a specific channel.
 */
export type IpcResult<C extends IpcChannel> = IpcChannelMap[C]["result"];

/**
 * Push event channels (main → renderer, not request/response).
 */
export interface IpcPushEventMap {
  "menu:navigate": string;
  "menu:action": string;
  "live:event": LiveEvent;
  "updater:downloading": string;
}

export type IpcPushEvent = keyof IpcPushEventMap;
