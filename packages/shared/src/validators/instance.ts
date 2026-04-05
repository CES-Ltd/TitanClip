import { z } from "zod";
import { DEFAULT_FEEDBACK_DATA_SHARING_PREFERENCE } from "../types/feedback.js";
import { feedbackDataSharingPreferenceSchema } from "./feedback.js";

export const instanceGeneralSettingsSchema = z.object({
  censorUsernameInLogs: z.boolean().default(false),
  keyboardShortcuts: z.boolean().default(false),
  feedbackDataSharingPreference: feedbackDataSharingPreferenceSchema.default(
    DEFAULT_FEEDBACK_DATA_SHARING_PREFERENCE,
  ),
}).strict();

export const patchInstanceGeneralSettingsSchema = instanceGeneralSettingsSchema.partial();

export const instanceExperimentalSettingsSchema = z.object({
  enableIsolatedWorkspaces: z.boolean().default(false),
  autoRestartDevServerWhenIdle: z.boolean().default(false),
}).strict();

export const patchInstanceExperimentalSettingsSchema = instanceExperimentalSettingsSchema.partial();

export const agentTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  role: z.string().min(1),
  soulMd: z.string().max(100_000).default(""),
  heartbeatMd: z.string().max(100_000).default(""),
  agentsMd: z.string().max(100_000).default(""),
  defaultBudgetMonthlyCents: z.number().int().min(0).default(0),
  permissionPolicyId: z.string().uuid().nullable().default(null),
  status: z.enum(["available", "draft"]).default("draft"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createAgentTemplateSchema = agentTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAgentTemplateSchema = createAgentTemplateSchema.partial();

export const instanceAdminSettingsSchema = z.object({
  adminPinHash: z.string().nullable().default(null),
  allowedAdapterTypes: z.array(z.string()).nullable().default(null),
  allowedModelsPerAdapter: z.record(z.string(), z.array(z.string()).nullable()).nullable().default(null),
  allowedRoles: z.array(z.string()).nullable().default(null),
  pinSessionTimeoutSec: z.number().int().min(60).max(86400).default(1800),
  agentTemplates: z.array(agentTemplateSchema).default([]),
  retentionRunLogsDays: z.number().int().min(0).max(3650).default(90),
  retentionActivityDays: z.number().int().min(0).max(3650).default(365),
  retentionCostEventsDays: z.number().int().min(0).max(3650).default(365),
  retentionTokenAuditDays: z.number().int().min(0).max(3650).default(180),
  allowedGitRepos: z.array(z.string()).nullable().default(null),
  protectedBranches: z.array(z.string()).default(["main", "master"]),
  workspaceAutoCleanupHours: z.number().int().min(0).max(720).default(24),
  maxWorkspaceDiskMb: z.number().int().min(0).max(102400).default(5120),
}).strict();

export const patchInstanceAdminSettingsSchema = instanceAdminSettingsSchema
  .omit({ adminPinHash: true })
  .partial();

export const changePinSchema = z.object({
  currentPin: z.string().min(1).max(128),
  newPin: z.string().min(1).max(128),
});

export const verifyPinSchema = z.object({
  pin: z.string().min(1).max(128),
});

export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
export type InstanceAdminSettingsValidated = z.infer<typeof instanceAdminSettingsSchema>;
export type PatchInstanceAdminSettings = z.infer<typeof patchInstanceAdminSettingsSchema>;
export type CreateAgentTemplate = z.infer<typeof createAgentTemplateSchema>;
export type UpdateAgentTemplate = z.infer<typeof updateAgentTemplateSchema>;
