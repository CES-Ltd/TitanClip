import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { createVaultCredentialSchema, updateVaultCredentialSchema, rotateVaultCredentialSchema } from "@titanclip/shared";
import { badRequest, forbidden, notFound } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { vaultService } from "../services/vault.js";
import { secretService } from "../services/secrets.js";
import { logActivity } from "../services/index.js";
import { getActorInfo } from "./authz.js";

function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

function assertBoardAccess(req: Request) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
}

export function vaultRoutes(db: Db) {
  const router = Router();
  const secrets = secretService(db);
  const vault = vaultService(db, {
    create: async (companyId: string, name: string, value: string) => {
      const result = await secrets.create(companyId, { name, provider: "local_encrypted" as any, value });
      return { id: result.id };
    },
    rotate: async (secretId: string, newValue: string) => {
      await secrets.rotate(secretId, { value: newValue });
    },
    resolve: async (secretId: string) => {
      // Get the secret to find its companyId, then resolve
      const secret = await secrets.getById(secretId);
      if (!secret) throw new Error("Secret not found");
      return secrets.resolveSecretValue(secret.companyId, secretId, "latest" as any);
    },
  });

  // List all credentials for a company
  router.get("/companies/:companyId/vault", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await vault.list(req.params.companyId as string));
  });

  // Get single credential
  router.get("/vault/:credId", async (req, res) => {
    const cred = await vault.getById(req.params.credId as string);
    if (!cred) throw notFound("Credential not found");
    assertCompanyAccess(req, cred.companyId);
    res.json(cred);
  });

  // Create credential (board only)
  router.post(
    "/companies/:companyId/vault",
    validate(createVaultCredentialSchema),
    async (req, res) => {
      assertBoardAccess(req);
      const companyId = req.params.companyId as string;
      const cred = await vault.create(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "vault.credential_created",
        entityType: "vault_credential",
        entityId: cred.id,
        details: { name: cred.name, provider: cred.provider, credentialType: cred.credentialType },
      });
      res.status(201).json(cred);
    },
  );

  // Update credential (board only)
  router.patch(
    "/vault/:credId",
    validate(updateVaultCredentialSchema),
    async (req, res) => {
      assertBoardAccess(req);
      const updated = await vault.update(req.params.credId as string, req.body);
      if (!updated) throw notFound("Credential not found");
      res.json(updated);
    },
  );

  // Revoke credential (board only)
  router.delete("/vault/:credId", async (req, res) => {
    assertBoardAccess(req);
    const cred = await vault.getById(req.params.credId as string);
    if (!cred) throw notFound("Credential not found");
    await vault.revoke(cred.id);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: cred.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "vault.credential_revoked",
      entityType: "vault_credential",
      entityId: cred.id,
      details: { name: cred.name },
    });
    res.json({ ok: true });
  });

  // Rotate credential (board only)
  router.post(
    "/vault/:credId/rotate",
    validate(rotateVaultCredentialSchema),
    async (req, res) => {
      assertBoardAccess(req);
      const rotated = await vault.rotate(req.params.credId as string, req.body.newValue);
      if (!rotated) throw notFound("Credential not found");
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: rotated.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "vault.credential_rotated",
        entityType: "vault_credential",
        entityId: rotated.id,
        details: { name: rotated.name },
      });
      res.json(rotated);
    },
  );

  // Checkout timed token (for agent runtime — typically called by heartbeat service)
  router.post("/vault/:credId/checkout", async (req, res) => {
    assertCompanyAccess(req, req.body.companyId ?? "");
    const { agentId, runId, envVarName } = req.body;
    if (!agentId || !envVarName) throw badRequest("agentId and envVarName required");
    try {
      const result = await vault.checkout(req.params.credId as string, agentId, runId ?? null, envVarName);
      res.json(result);
    } catch (err) {
      throw badRequest((err as Error).message);
    }
  });

  // Checkout audit history
  router.get("/vault/:credId/audit", async (req, res) => {
    const cred = await vault.getById(req.params.credId as string);
    if (!cred) throw notFound("Credential not found");
    assertCompanyAccess(req, cred.companyId);
    res.json(await vault.listCheckouts(cred.id));
  });

  // Active checkouts for company (for IAM observability)
  router.get("/companies/:companyId/vault/active-checkouts", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await vault.listActiveCheckouts(req.params.companyId as string));
  });

  // Recent checkouts for company
  router.get("/companies/:companyId/vault/recent-checkouts", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await vault.listRecentCheckouts(req.params.companyId as string));
  });

  return router;
}
