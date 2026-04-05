/**
 * User Credentials Route — user-managed development credentials.
 *
 * Non-admin users can create/manage credentials for dev tools (GitHub, GitLab,
 * NPM, Docker, SSH, etc.). Cloud LLM API keys are blocked — those require
 * admin access through the Vault.
 *
 * Same security policies (permission policies, RBAC) apply.
 */

import { Router } from "express";
import type { Db } from "@titanclip/db";
import { vaultCredentials } from "@titanclip/db";
import { eq, and } from "drizzle-orm";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { validateUserCredential, getUserCredentialOptions } from "../services/user-credential-validator.js";
import { logActivity } from "../services/activity-log.js";

export function userCredentialRoutes(db: Db) {
  const router = Router();

  // Get available provider/type options for UI
  router.get("/user-credentials/options", (_req, res) => {
    res.json(getUserCredentialOptions());
  });

  // List user-scoped credentials for a company
  router.get("/companies/:companyId/user-credentials", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const creds = await db
      .select()
      .from(vaultCredentials)
      .where(and(
        eq(vaultCredentials.companyId, companyId),
        eq(vaultCredentials.scope, "user"),
      ));
    res.json(creds);
  });

  // Create a user-scoped credential
  router.post("/companies/:companyId/user-credentials", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const { name, provider, credentialType, description } = req.body;

    // Validate provider/type against allowed list
    const validation = validateUserCredential(provider ?? "custom", credentialType ?? "access_token");
    if (!validation.valid) {
      res.status(403).json({ error: validation.error });
      return;
    }

    const [cred] = await db
      .insert(vaultCredentials)
      .values({
        companyId,
        name,
        description: description ?? "",
        provider: provider ?? "custom",
        credentialType: credentialType ?? "access_token",
        scope: "user",
        createdByUserId: actor.actorId ?? "unknown",
        status: "active",
      })
      .returning();

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId ?? "unknown",
      action: "user_credential.created",
      entityType: "vault_credential",
      entityId: cred.id,
      details: { name, provider, credentialType, scope: "user" },
    });

    res.status(201).json(cred);
  });

  // Update a user-scoped credential (own creds or admin)
  router.patch("/user-credentials/:id", async (req, res) => {
    const id = req.params.id as string;
    const [existing] = await db.select().from(vaultCredentials).where(eq(vaultCredentials.id, id));
    if (!existing || existing.scope !== "user") {
      res.status(404).json({ error: "User credential not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    // Validate provider change if present
    if (req.body.provider) {
      const validation = validateUserCredential(req.body.provider, existing.credentialType);
      if (!validation.valid) {
        res.status(403).json({ error: validation.error });
        return;
      }
    }

    const [updated] = await db
      .update(vaultCredentials)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(vaultCredentials.id, id))
      .returning();
    res.json(updated);
  });

  // Revoke a user-scoped credential
  router.delete("/user-credentials/:id", async (req, res) => {
    const id = req.params.id as string;
    const [existing] = await db.select().from(vaultCredentials).where(eq(vaultCredentials.id, id));
    if (!existing || existing.scope !== "user") {
      res.status(404).json({ error: "User credential not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);

    const [revoked] = await db
      .update(vaultCredentials)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(vaultCredentials.id, id))
      .returning();

    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId ?? "unknown",
      action: "user_credential.revoked",
      entityType: "vault_credential",
      entityId: id,
      details: { name: existing.name, provider: existing.provider },
    });

    res.json(revoked);
  });

  return router;
}
