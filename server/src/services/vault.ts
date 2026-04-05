import crypto from "node:crypto";
import type { Db } from "@titanclip/db";
import { vaultCredentials, vaultTokenCheckouts } from "@titanclip/db";
import { eq, and, desc } from "drizzle-orm";
import type { VaultCredential, VaultTokenCheckout, VaultCheckoutResult } from "@titanclip/shared";

export function vaultService(db: Db, secretsSvc: {
  create: (companyId: string, name: string, value: string) => Promise<{ id: string }>;
  rotate: (secretId: string, newValue: string) => Promise<void>;
  resolve: (secretId: string, version?: string) => Promise<string>;
}) {
  function toVaultCredential(row: typeof vaultCredentials.$inferSelect): VaultCredential {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      description: row.description ?? "",
      credentialType: row.credentialType as VaultCredential["credentialType"],
      provider: row.provider as VaultCredential["provider"],
      secretId: row.secretId,
      allowedAgentIds: row.allowedAgentIds as string[] | null,
      allowedRoles: row.allowedRoles as string[] | null,
      rotationPolicy: row.rotationPolicy as "manual" | "auto",
      rotationIntervalDays: row.rotationIntervalDays,
      lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      tokenTtlSeconds: row.tokenTtlSeconds,
      maxConcurrentCheckouts: row.maxConcurrentCheckouts,
      totalCheckouts: row.totalCheckouts,
      lastCheckedOutAt: row.lastCheckedOutAt?.toISOString() ?? null,
      lastCheckedOutByAgentId: row.lastCheckedOutByAgentId,
      status: row.status as VaultCredential["status"],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  function toCheckout(row: typeof vaultTokenCheckouts.$inferSelect): VaultTokenCheckout {
    return {
      id: row.id,
      credentialId: row.credentialId,
      companyId: row.companyId,
      agentId: row.agentId,
      runId: row.runId,
      envVarName: row.envVarName,
      issuedAt: row.issuedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      expiredAt: row.expiredAt?.toISOString() ?? null,
      status: row.status as VaultTokenCheckout["status"],
      createdAt: row.createdAt.toISOString(),
    };
  }

  return {
    // --- CRUD ---
    async list(companyId: string): Promise<VaultCredential[]> {
      const rows = await db.select().from(vaultCredentials)
        .where(eq(vaultCredentials.companyId, companyId))
        .orderBy(desc(vaultCredentials.createdAt));
      return rows.map(toVaultCredential);
    },

    async getById(id: string): Promise<VaultCredential | null> {
      const [row] = await db.select().from(vaultCredentials).where(eq(vaultCredentials.id, id));
      return row ? toVaultCredential(row) : null;
    },

    async create(companyId: string, input: {
      name: string; description?: string; credentialType?: string; provider?: string;
      value: string; envVarName: string;
      allowedAgentIds?: string[] | null; allowedRoles?: string[] | null;
      rotationPolicy?: string; rotationIntervalDays?: number | null;
      expiresAt?: string | null; tokenTtlSeconds?: number; maxConcurrentCheckouts?: number;
    }): Promise<VaultCredential> {
      // Store the value as an encrypted secret
      const secret = await secretsSvc.create(companyId, `vault:${input.name}`, input.value);
      const now = new Date();
      const [row] = await db.insert(vaultCredentials).values({
        companyId,
        name: input.name,
        description: input.description ?? "",
        credentialType: input.credentialType ?? "api_key",
        provider: input.provider ?? "custom",
        secretId: secret.id,
        allowedAgentIds: input.allowedAgentIds ?? null,
        allowedRoles: input.allowedRoles ?? null,
        rotationPolicy: input.rotationPolicy ?? "manual",
        rotationIntervalDays: input.rotationIntervalDays ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        tokenTtlSeconds: input.tokenTtlSeconds ?? 3600,
        maxConcurrentCheckouts: input.maxConcurrentCheckouts ?? 5,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return toVaultCredential(row);
    },

    async update(id: string, patch: Record<string, unknown>): Promise<VaultCredential | null> {
      const { value, envVarName, ...safePatch } = patch as any;
      const [row] = await db.update(vaultCredentials)
        .set({ ...safePatch, updatedAt: new Date() })
        .where(eq(vaultCredentials.id, id))
        .returning();
      return row ? toVaultCredential(row) : null;
    },

    async revoke(id: string): Promise<void> {
      await db.update(vaultCredentials)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(vaultCredentials.id, id));
    },

    async rotate(id: string, newValue: string): Promise<VaultCredential | null> {
      const cred = await this.getById(id);
      if (!cred || !cred.secretId) return null;
      await secretsSvc.rotate(cred.secretId, newValue);
      const [row] = await db.update(vaultCredentials)
        .set({ lastRotatedAt: new Date(), status: "active", updatedAt: new Date() })
        .where(eq(vaultCredentials.id, id))
        .returning();
      return row ? toVaultCredential(row) : null;
    },

    // --- TOKEN CHECKOUT ---
    async checkout(credentialId: string, agentId: string, runId: string | null, envVarName: string): Promise<VaultCheckoutResult> {
      const cred = await this.getById(credentialId);
      if (!cred) throw new Error("Credential not found");
      if (cred.status !== "active") throw new Error(`Credential is ${cred.status}`);
      if (cred.expiresAt && new Date(cred.expiresAt) < new Date()) {
        await db.update(vaultCredentials).set({ status: "expired" }).where(eq(vaultCredentials.id, credentialId));
        throw new Error("Credential has expired");
      }

      // Access control
      if (cred.allowedAgentIds && !cred.allowedAgentIds.includes(agentId)) {
        throw new Error("Agent not authorized for this credential");
      }

      // Check concurrent checkout limit
      const activeCheckouts = await db.select().from(vaultTokenCheckouts)
        .where(and(
          eq(vaultTokenCheckouts.credentialId, credentialId),
          eq(vaultTokenCheckouts.status, "active"),
        ));
      if (activeCheckouts.length >= cred.maxConcurrentCheckouts) {
        throw new Error(`Max concurrent checkouts (${cred.maxConcurrentCheckouts}) reached`);
      }

      // Resolve the actual secret value
      const value = await secretsSvc.resolve(cred.secretId!);

      // Create checkout record
      const now = new Date();
      const expiresAt = new Date(now.getTime() + cred.tokenTtlSeconds * 1000);
      const [checkout] = await db.insert(vaultTokenCheckouts).values({
        credentialId,
        companyId: cred.companyId,
        agentId,
        runId,
        envVarName,
        issuedAt: now,
        expiresAt,
        status: "active",
      }).returning();

      // Update credential audit fields
      await db.update(vaultCredentials).set({
        totalCheckouts: cred.totalCheckouts + 1,
        lastCheckedOutAt: now,
        lastCheckedOutByAgentId: agentId,
        updatedAt: now,
      }).where(eq(vaultCredentials.id, credentialId));

      return {
        tokenId: checkout.id,
        envVarName,
        value,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async checkin(tokenId: string): Promise<void> {
      await db.update(vaultTokenCheckouts)
        .set({ checkedInAt: new Date(), status: "checked_in" })
        .where(eq(vaultTokenCheckouts.id, tokenId));
    },

    async checkinAllForRun(runId: string): Promise<void> {
      await db.update(vaultTokenCheckouts)
        .set({ checkedInAt: new Date(), status: "checked_in" })
        .where(and(
          eq(vaultTokenCheckouts.runId, runId),
          eq(vaultTokenCheckouts.status, "active"),
        ));
    },

    // --- AUDIT ---
    async listCheckouts(credentialId: string, limit = 50): Promise<VaultTokenCheckout[]> {
      const rows = await db.select().from(vaultTokenCheckouts)
        .where(eq(vaultTokenCheckouts.credentialId, credentialId))
        .orderBy(desc(vaultTokenCheckouts.createdAt))
        .limit(limit);
      return rows.map(toCheckout);
    },

    async listActiveCheckouts(companyId: string): Promise<VaultTokenCheckout[]> {
      const rows = await db.select().from(vaultTokenCheckouts)
        .where(and(
          eq(vaultTokenCheckouts.companyId, companyId),
          eq(vaultTokenCheckouts.status, "active"),
        ))
        .orderBy(desc(vaultTokenCheckouts.issuedAt));
      return rows.map(toCheckout);
    },

    async listRecentCheckouts(companyId: string, limit = 50): Promise<VaultTokenCheckout[]> {
      const rows = await db.select().from(vaultTokenCheckouts)
        .where(eq(vaultTokenCheckouts.companyId, companyId))
        .orderBy(desc(vaultTokenCheckouts.createdAt))
        .limit(limit);
      return rows.map(toCheckout);
    },
  };
}
