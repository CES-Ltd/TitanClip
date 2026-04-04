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

export const instanceAdminSettingsSchema = z.object({
  adminPinHash: z.string().nullable().default(null),
  allowedAdapterTypes: z.array(z.string()).nullable().default(null),
  allowedModelsPerAdapter: z.record(z.string(), z.array(z.string()).nullable()).nullable().default(null),
  allowedRoles: z.array(z.string()).nullable().default(null),
  pinSessionTimeoutSec: z.number().int().min(60).max(86400).default(1800),
}).strict();

export const patchInstanceAdminSettingsSchema = instanceAdminSettingsSchema
  .omit({ adminPinHash: true })
  .partial();

export const changePinSchema = z.object({
  currentPin: z.string().min(4).max(32),
  newPin: z.string().min(4).max(32),
}).strict();

export const verifyPinSchema = z.object({
  pin: z.string().min(1).max(32),
}).strict();

export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
export type InstanceAdminSettingsValidated = z.infer<typeof instanceAdminSettingsSchema>;
export type PatchInstanceAdminSettings = z.infer<typeof patchInstanceAdminSettingsSchema>;
