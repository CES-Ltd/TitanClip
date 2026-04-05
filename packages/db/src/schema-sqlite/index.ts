/**
 * SQLite Schema — mirrors the PostgreSQL schema with type conversions.
 *
 * Conversion rules:
 *   PostgreSQL          → SQLite
 *   ─────────────────────────────────
 *   uuid                → text (stored as string)
 *   text                → text (no change)
 *   integer             → integer (no change)
 *   timestamp(tz)       → text (ISO 8601 string)
 *   boolean             → integer (0/1)
 *   jsonb               → text (JSON string, parsed by application)
 *   serial              → integer (autoincrement via primaryKey)
 *   uuid.defaultRandom  → text.$defaultFn(() => crypto.randomUUID())
 *   timestamp.defaultNow→ text.$defaultFn(() => new Date().toISOString())
 *
 * Foreign keys are preserved as text references.
 * Indexes are preserved where SQLite supports them.
 * Partial indexes are converted or dropped where unsupported.
 */

// Re-export all tables from individual schema files
export { companies } from "./companies.js";
export { agents } from "./agents.js";
export { issues } from "./issues.js";
export { projects } from "./projects.js";
export { goals } from "./goals.js";
export { approvals, approvalComments } from "./approvals.js";
export { heartbeatRuns, heartbeatRunEvents } from "./heartbeat_runs.js";
export { costEvents } from "./cost_events.js";
export { financeEvents } from "./finance_events.js";
export { activityLog } from "./activity_log.js";
export { instanceSettings } from "./instance_settings.js";
export { authUsers, authSessions, authAccounts, authVerifications } from "./auth.js";
export { companyMemberships } from "./company_memberships.js";
export { instanceUserRoles } from "./instance_user_roles.js";
export { agentApiKeys } from "./agent_api_keys.js";
export { agentConfigRevisions } from "./agent_config_revisions.js";
export { agentRuntimeState } from "./agent_runtime_state.js";
export { agentTaskSessions } from "./agent_task_sessions.js";
export { agentWakeupRequests } from "./agent_wakeup_requests.js";
export { companySecrets } from "./company_secrets.js";
export { companySecretVersions } from "./company_secret_versions.js";
export { companySkills } from "./company_skills.js";
export { issueComments } from "./issue_comments.js";
export { issueAttachments } from "./issue_attachments.js";
export { issueLabels } from "./issue_labels.js";
export { issueApprovals } from "./issue_approvals.js";
export { issueWorkProducts } from "./issue_work_products.js";
export { issueDocuments } from "./issue_documents.js";
export { issueReadStates } from "./issue_read_states.js";
export { issueInboxArchives } from "./issue_inbox_archives.js";
export { issueDependencies } from "./issue_dependencies.js";
export { documents, documentRevisions } from "./documents.js";
export { labels } from "./labels.js";
export { assets } from "./assets.js";
export { projectWorkspaces } from "./project_workspaces.js";
export { projectGoals } from "./project_goals.js";
export { executionWorkspaces } from "./execution_workspaces.js";
export { workspaceOperations } from "./workspace_operations.js";
export { workspaceRuntimeServices } from "./workspace_runtime_services.js";
export { routines, routineTriggers, routineRuns } from "./routines.js";
export { budgetPolicies } from "./budget_policies.js";
export { budgetIncidents } from "./budget_incidents.js";
export { plugins } from "./plugins.js";
export { pluginConfig } from "./plugin_config.js";
export { pluginState } from "./plugin_state.js";
export { pluginJobs, pluginJobRuns } from "./plugin_jobs.js";
export { pluginLogs } from "./plugin_logs.js";
export { pluginEntities } from "./plugin_entities.js";
export { pluginCompanySettings } from "./plugin_company_settings.js";
export { pluginWebhookDeliveries } from "./plugin_webhooks.js";
export { vaultCredentials, vaultTokenCheckouts } from "./vault_credentials.js";
export { permissionPolicies } from "./permission_policies.js";
export { teamRoles } from "./team_roles.js";
export { chatterMessages } from "./chatter_messages.js";
export { slaPolicies } from "./sla_policies.js";
export { slaTracking } from "./sla_tracking.js";
export { escalationRules } from "./escalation_rules.js";
export { workflowTemplates } from "./workflow_templates.js";
export { agentSkillProficiency } from "./agent_skill_proficiency.js";
export { onboardingWorkflows, onboardingInstances, changeRequests } from "./onboarding_workflows.js";
export { feedbackVotes } from "./feedback_votes.js";
export { feedbackExports } from "./feedback_exports.js";
export { companyLogos } from "./company_logos.js";
export { boardApiKeys } from "./board_api_keys.js";
export { cliAuthChallenges } from "./cli_auth_challenges.js";
export { principalPermissionGrants } from "./principal_permission_grants.js";
export { invites } from "./invites.js";
export { joinRequests } from "./join_requests.js";
