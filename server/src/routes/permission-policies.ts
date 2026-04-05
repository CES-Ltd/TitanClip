import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { createPermissionPolicySchema, updatePermissionPolicySchema } from "@titanclip/shared";
import { forbidden, notFound } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { permissionPolicyService } from "../services/permission-policies.js";
import { logActivity } from "../services/index.js";
import { getActorInfo } from "./authz.js";

function assertInstanceAdmin(req: Request) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
    throw forbidden("Instance admin required");
  }
}

export function permissionPolicyRoutes(db: Db) {
  const router = Router();
  const svc = permissionPolicyService(db);

  // List policies (any board user can read)
  router.get("/permission-policies", async (req, res) => {
    if (req.actor.type !== "board") throw forbidden("Board access required");
    res.json(await svc.list());
  });

  // List policies for a company
  router.get("/companies/:companyId/permission-policies", async (req, res) => {
    if (req.actor.type !== "board") throw forbidden("Board access required");
    res.json(await svc.list(req.params.companyId as string));
  });

  // Get single policy
  router.get("/permission-policies/:id", async (req, res) => {
    if (req.actor.type !== "board") throw forbidden("Board access required");
    const policy = await svc.getById(req.params.id as string);
    if (!policy) throw notFound("Policy not found");
    res.json(policy);
  });

  // Create policy (instance admin only)
  router.post(
    "/permission-policies",
    validate(createPermissionPolicySchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const policy = await svc.create(req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: policy.companyId ?? "instance",
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "permission_policy.created",
        entityType: "permission_policy",
        entityId: policy.id,
        details: { name: policy.name },
      });
      res.status(201).json(policy);
    },
  );

  // Update policy (instance admin only)
  router.patch(
    "/permission-policies/:id",
    validate(updatePermissionPolicySchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const updated = await svc.update(req.params.id as string, req.body);
      if (!updated) throw notFound("Policy not found");
      res.json(updated);
    },
  );

  // Delete policy (instance admin only)
  router.delete("/permission-policies/:id", async (req, res) => {
    assertInstanceAdmin(req);
    await svc.remove(req.params.id as string);
    res.json({ ok: true });
  });

  return router;
}
