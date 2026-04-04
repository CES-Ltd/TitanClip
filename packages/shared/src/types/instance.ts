import type { FeedbackDataSharingPreference } from "./feedback.js";

export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
  keyboardShortcuts: boolean;
  feedbackDataSharingPreference: FeedbackDataSharingPreference;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
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
