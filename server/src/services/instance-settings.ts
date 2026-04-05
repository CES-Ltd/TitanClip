import crypto from "node:crypto";
import type { Db } from "@titanclip/db";
import { companies, instanceSettings } from "@titanclip/db";
import {
  DEFAULT_FEEDBACK_DATA_SHARING_PREFERENCE,
  instanceGeneralSettingsSchema,
  type InstanceGeneralSettings,
  instanceExperimentalSettingsSchema,
  type InstanceExperimentalSettings,
  instanceAdminSettingsSchema,
  type PatchInstanceGeneralSettings,
  type PatchInstanceExperimentalSettings,
  type PatchInstanceAdminSettings,
  type InstanceSettings,
} from "@titanclip/shared";
import type { InstanceAdminSettings } from "@titanclip/shared";
import { eq } from "drizzle-orm";

const DEFAULT_SINGLETON_KEY = "default";

function normalizeGeneralSettings(raw: unknown): InstanceGeneralSettings {
  const parsed = instanceGeneralSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      censorUsernameInLogs: parsed.data.censorUsernameInLogs ?? false,
      keyboardShortcuts: parsed.data.keyboardShortcuts ?? false,
      feedbackDataSharingPreference:
        parsed.data.feedbackDataSharingPreference ?? DEFAULT_FEEDBACK_DATA_SHARING_PREFERENCE,
    };
  }
  return {
    censorUsernameInLogs: false,
    keyboardShortcuts: false,
    feedbackDataSharingPreference: DEFAULT_FEEDBACK_DATA_SHARING_PREFERENCE,
  };
}

function normalizeExperimentalSettings(raw: unknown): InstanceExperimentalSettings {
  const parsed = instanceExperimentalSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      enableIsolatedWorkspaces: parsed.data.enableIsolatedWorkspaces ?? false,
      autoRestartDevServerWhenIdle: parsed.data.autoRestartDevServerWhenIdle ?? false,
    };
  }
  return {
    enableIsolatedWorkspaces: false,
    autoRestartDevServerWhenIdle: false,
  };
}

function normalizeAdminSettings(raw: unknown): InstanceAdminSettings {
  const parsed = instanceAdminSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      adminPinHash: parsed.data.adminPinHash ?? null,
      allowedAdapterTypes: parsed.data.allowedAdapterTypes ?? null,
      allowedModelsPerAdapter: parsed.data.allowedModelsPerAdapter ?? null,
      allowedRoles: parsed.data.allowedRoles ?? null,
      pinSessionTimeoutSec: parsed.data.pinSessionTimeoutSec ?? 1800,
      agentTemplates: parsed.data.agentTemplates ?? [],
      retentionRunLogsDays: parsed.data.retentionRunLogsDays ?? 90,
      retentionActivityDays: parsed.data.retentionActivityDays ?? 365,
      retentionCostEventsDays: parsed.data.retentionCostEventsDays ?? 365,
      retentionTokenAuditDays: parsed.data.retentionTokenAuditDays ?? 180,
      allowedGitRepos: parsed.data.allowedGitRepos ?? null,
      protectedBranches: parsed.data.protectedBranches ?? ["main", "master"],
      workspaceAutoCleanupHours: parsed.data.workspaceAutoCleanupHours ?? 24,
      maxWorkspaceDiskMb: parsed.data.maxWorkspaceDiskMb ?? 5120,
    };
  }
  return {
    adminPinHash: null,
    allowedAdapterTypes: null,
    allowedModelsPerAdapter: null,
    allowedRoles: null,
    pinSessionTimeoutSec: 1800,
    agentTemplates: [],
    retentionRunLogsDays: 90,
    retentionActivityDays: 365,
    retentionCostEventsDays: 365,
    retentionTokenAuditDays: 180,
    allowedGitRepos: null,
    protectedBranches: ["main", "master"],
    workspaceAutoCleanupHours: 24,
    maxWorkspaceDiskMb: 5120,
  };
}

function toInstanceSettings(row: typeof instanceSettings.$inferSelect): InstanceSettings {
  return {
    id: row.id,
    general: normalizeGeneralSettings(row.general),
    experimental: normalizeExperimentalSettings(row.experimental),
    admin: normalizeAdminSettings((row as any).admin),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function instanceSettingsService(db: Db) {
  async function getOrCreateRow() {
    const existing = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.singletonKey, DEFAULT_SINGLETON_KEY))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;

    const now = new Date();
    const [created] = await db
      .insert(instanceSettings)
      .values({
        singletonKey: DEFAULT_SINGLETON_KEY,
        general: {},
        experimental: {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [instanceSettings.singletonKey],
        set: {
          updatedAt: now,
        },
      })
      .returning();

    return created;
  }

  return {
    get: async (): Promise<InstanceSettings> => toInstanceSettings(await getOrCreateRow()),

    getGeneral: async (): Promise<InstanceGeneralSettings> => {
      const row = await getOrCreateRow();
      return normalizeGeneralSettings(row.general);
    },

    getExperimental: async (): Promise<InstanceExperimentalSettings> => {
      const row = await getOrCreateRow();
      return normalizeExperimentalSettings(row.experimental);
    },

    updateGeneral: async (patch: PatchInstanceGeneralSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const nextGeneral = normalizeGeneralSettings({
        ...normalizeGeneralSettings(current.general),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          general: { ...nextGeneral },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    updateExperimental: async (patch: PatchInstanceExperimentalSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const nextExperimental = normalizeExperimentalSettings({
        ...normalizeExperimentalSettings(current.experimental),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          experimental: { ...nextExperimental },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    getAdmin: async (): Promise<InstanceAdminSettings> => {
      const row = await getOrCreateRow();
      return normalizeAdminSettings((row as any).admin);
    },

    updateAdmin: async (patch: PatchInstanceAdminSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const currentAdmin = normalizeAdminSettings((current as any).admin);
      const nextAdmin = normalizeAdminSettings({
        ...currentAdmin,
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          admin: { ...nextAdmin } as any,
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    updateAdminPinHash: async (hash: string): Promise<void> => {
      const current = await getOrCreateRow();
      const currentAdmin = normalizeAdminSettings((current as any).admin);
      const now = new Date();
      await db
        .update(instanceSettings)
        .set({
          admin: { ...currentAdmin, adminPinHash: hash } as any,
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id));
    },

    getAgentTemplates: async () => {
      const admin = normalizeAdminSettings((await getOrCreateRow() as any).admin);
      return admin.agentTemplates;
    },

    getAvailableTemplates: async () => {
      const admin = normalizeAdminSettings((await getOrCreateRow() as any).admin);
      return admin.agentTemplates.filter((t) => t.status === "available");
    },

    getAgentTemplate: async (id: string) => {
      const admin = normalizeAdminSettings((await getOrCreateRow() as any).admin);
      return admin.agentTemplates.find((t) => t.id === id) ?? null;
    },

    createAgentTemplate: async (input: Omit<import("@titanclip/shared").AgentTemplate, "id" | "createdAt" | "updatedAt">) => {
      const current = await getOrCreateRow();
      const currentAdmin = normalizeAdminSettings((current as any).admin);
      const now = new Date().toISOString();
      const template = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      const nextAdmin = { ...currentAdmin, agentTemplates: [...currentAdmin.agentTemplates, template] };
      await db
        .update(instanceSettings)
        .set({ admin: nextAdmin as any, updatedAt: new Date() })
        .where(eq(instanceSettings.id, current.id));
      return template;
    },

    updateAgentTemplate: async (id: string, patch: Record<string, unknown>) => {
      const current = await getOrCreateRow();
      const currentAdmin = normalizeAdminSettings((current as any).admin);
      const idx = currentAdmin.agentTemplates.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      const updated = { ...currentAdmin.agentTemplates[idx], ...patch, updatedAt: new Date().toISOString() };
      const nextTemplates = [...currentAdmin.agentTemplates];
      nextTemplates[idx] = updated;
      const nextAdmin = { ...currentAdmin, agentTemplates: nextTemplates };
      await db
        .update(instanceSettings)
        .set({ admin: nextAdmin as any, updatedAt: new Date() })
        .where(eq(instanceSettings.id, current.id));
      return updated;
    },

    deleteAgentTemplate: async (id: string) => {
      const current = await getOrCreateRow();
      const currentAdmin = normalizeAdminSettings((current as any).admin);
      const nextAdmin = { ...currentAdmin, agentTemplates: currentAdmin.agentTemplates.filter((t) => t.id !== id) };
      await db
        .update(instanceSettings)
        .set({ admin: nextAdmin as any, updatedAt: new Date() })
        .where(eq(instanceSettings.id, current.id));
    },

    listCompanyIds: async (): Promise<string[]> =>
      db
        .select({ id: companies.id })
        .from(companies)
        .then((rows) => rows.map((row) => row.id)),
  };
}
