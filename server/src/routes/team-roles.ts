import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden, badRequest } from "../errors.js";
import { teamRoleService } from "../services/team-roles.js";
import { logActivity } from "../services/index.js";
import { getActorInfo } from "./authz.js";

function assertBoardAccess(req: Request) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
}

export function teamRoleRoutes(db: Db) {
  const router = Router();
  const svc = teamRoleService(db);

  // List team members and their roles
  router.get("/companies/:companyId/team-roles", async (req, res) => {
    assertBoardAccess(req);
    res.json(await svc.list(req.params.companyId as string));
  });

  // Assign/update role for a user in a team
  router.post("/companies/:companyId/team-roles", async (req, res) => {
    assertBoardAccess(req);
    const { userId, role } = req.body;
    if (!userId || !role) throw badRequest("userId and role are required");
    const validRoles = ["instance_admin", "team_admin", "member", "viewer"];
    if (!validRoles.includes(role)) throw badRequest(`Invalid role. Must be one of: ${validRoles.join(", ")}`);

    const companyId = req.params.companyId as string;
    const assignedBy = req.actor.type === "board" ? req.actor.userId : undefined;
    const teamRole = await svc.assign(companyId, userId, role, assignedBy);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId, actorType: actor.actorType, actorId: actor.actorId,
      agentId: actor.agentId, runId: actor.runId,
      action: "team_role.assigned", entityType: "team_role", entityId: teamRole.id,
      details: { userId, role },
    });
    res.json(teamRole);
  });

  // Remove a user from a team
  router.delete("/companies/:companyId/team-roles/:userId", async (req, res) => {
    assertBoardAccess(req);
    const companyId = req.params.companyId as string;
    const userId = req.params.userId as string;
    await svc.remove(companyId, userId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId, actorType: actor.actorType, actorId: actor.actorId,
      agentId: actor.agentId, runId: actor.runId,
      action: "team_role.removed", entityType: "team_role", entityId: userId,
      details: { userId },
    });
    res.json({ ok: true });
  });

  return router;
}
