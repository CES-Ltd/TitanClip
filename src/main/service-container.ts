/**
 * Service Container — instantiates and holds all business logic services.
 *
 * This replaces the pattern where each route file calls `someService(db)`.
 * Instead, all services are created once at startup and shared across
 * IPC handlers.
 *
 * The container uses lazy initialization — services are created on first
 * access so we don't import the entire server codebase at startup.
 */

export interface ServiceContainer {
  db: any;

  // Core services — lazy-initialized
  company: ReturnType<any>;
  agent: ReturnType<any>;
  project: ReturnType<any>;
  issue: ReturnType<any>;
  goal: ReturnType<any>;
  approval: ReturnType<any>;
  routine: ReturnType<any>;
  cost: ReturnType<any>;
  finance: ReturnType<any>;
  budget: ReturnType<any>;
  secret: ReturnType<any>;
  dashboard: ReturnType<any>;
  activity: ReturnType<any>;
  sidebarBadge: ReturnType<any>;
  heartbeat: ReturnType<any>;
  instanceSettings: ReturnType<any>;
  companyPortability: ReturnType<any>;
  executionWorkspace: ReturnType<any>;
  workspaceOperation: ReturnType<any>;
  workProduct: ReturnType<any>;
  access: ReturnType<any>;
  boardAuth: ReturnType<any>;
  feedback: ReturnType<any>;
  companySkill: ReturnType<any>;
  agentInstructions: ReturnType<any>;
  asset: ReturnType<any>;
  document: ReturnType<any>;

  // Activity logging
  logActivity: (input: any) => Promise<void>;
  publishLiveEvent: (event: any) => void;
}

/**
 * Create the service container with all services initialized.
 *
 * Uses dynamic imports to load services from the server package.
 * This means the server code runs in the main process directly —
 * no child process, no HTTP overhead.
 */
export async function createServiceContainer(db: any): Promise<ServiceContainer> {
  // Dynamic import from the server package at runtime.
  // Uses Function() to prevent TypeScript from statically resolving the import.
  const { getServerServicesPath } = await (Function("p", "return import(p)")("./paths.js"));
  const serverServicesPath = getServerServicesPath();
  const services: any = await (Function("p", "return import(p)")(serverServicesPath));

  const container: ServiceContainer = {
    db,

    company: services.companyService(db),
    agent: services.agentService(db),
    project: services.projectService(db),
    issue: services.issueService(db),
    goal: services.goalService(db),
    approval: services.approvalService(db),
    routine: services.routineService(db),
    cost: services.costService(db),
    finance: services.financeService(db),
    budget: services.budgetService(db),
    secret: services.secretService(db),
    dashboard: services.dashboardService(db),
    activity: services.activityService(db),
    sidebarBadge: services.sidebarBadgeService(db),
    heartbeat: services.heartbeatService(db),
    instanceSettings: services.instanceSettingsService(db),
    companyPortability: services.companyPortabilityService(db),
    executionWorkspace: services.executionWorkspaceService(db),
    workspaceOperation: services.workspaceOperationService(db),
    workProduct: services.workProductService(db),
    access: services.accessService(db),
    boardAuth: services.boardAuthService(db),
    feedback: services.feedbackService(db),
    companySkill: services.companySkillService(db),
    agentInstructions: services.agentInstructionsService(db),
    asset: services.assetService(db),
    document: services.documentService(db),

    logActivity: (input: any) => services.logActivity(db, input),
    publishLiveEvent: services.publishLiveEvent,
  };

  return container;
}
