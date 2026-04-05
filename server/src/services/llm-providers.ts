/**
 * LLM Provider Service — manages configured LLM providers per company.
 */

import { eq, and } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { llmProviderConfigs } from "@titanclip/db";

export function llmProviderService(db: Db) {
  return {
    async list(companyId: string) {
      return db
        .select()
        .from(llmProviderConfigs)
        .where(eq(llmProviderConfigs.companyId, companyId))
        .orderBy(llmProviderConfigs.createdAt);
    },

    async getById(id: string) {
      const rows = await db
        .select()
        .from(llmProviderConfigs)
        .where(eq(llmProviderConfigs.id, id));
      return rows[0] ?? null;
    },

    async getBySlug(companyId: string, providerSlug: string) {
      const rows = await db
        .select()
        .from(llmProviderConfigs)
        .where(
          and(
            eq(llmProviderConfigs.companyId, companyId),
            eq(llmProviderConfigs.providerSlug, providerSlug)
          )
        );
      return rows[0] ?? null;
    },

    async getDefault(companyId: string) {
      const rows = await db
        .select()
        .from(llmProviderConfigs)
        .where(
          and(
            eq(llmProviderConfigs.companyId, companyId),
            eq(llmProviderConfigs.isDefault, true)
          )
        );
      return rows[0] ?? null;
    },

    async create(
      companyId: string,
      input: {
        providerSlug: string;
        label: string;
        baseUrl?: string;
        apiKeySecretId?: string;
        isDefault?: boolean;
        metadata?: Record<string, unknown>;
      }
    ) {
      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(llmProviderConfigs)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(llmProviderConfigs.companyId, companyId));
      }

      const [row] = await db
        .insert(llmProviderConfigs)
        .values({
          companyId,
          providerSlug: input.providerSlug,
          label: input.label,
          baseUrl: input.baseUrl ?? null,
          apiKeySecretId: input.apiKeySecretId ?? null,
          isDefault: input.isDefault ?? false,
          metadata: input.metadata ?? null,
        })
        .returning();

      return row;
    },

    async update(
      id: string,
      input: Partial<{
        label: string;
        baseUrl: string | null;
        apiKeySecretId: string | null;
        isDefault: boolean;
        status: string;
        metadata: Record<string, unknown>;
      }>
    ) {
      if (input.isDefault) {
        const existing = await this.getById(id);
        if (existing) {
          await db
            .update(llmProviderConfigs)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(eq(llmProviderConfigs.companyId, existing.companyId));
        }
      }

      const [row] = await db
        .update(llmProviderConfigs)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(llmProviderConfigs.id, id))
        .returning();

      return row;
    },

    async remove(id: string) {
      const [row] = await db
        .delete(llmProviderConfigs)
        .where(eq(llmProviderConfigs.id, id))
        .returning();
      return row;
    },

    /**
     * Resolve a provider's API key from the secrets system.
     */
    async resolveApiKey(companyId: string, providerSlug: string): Promise<string | null> {
      const provider = await this.getBySlug(companyId, providerSlug);
      if (!provider?.apiKeySecretId) return null;
      // API key resolution would go through the secrets service.
      // For now, return null — the user provides keys via agent adapterConfig.
      return null;
    },
  };
}
