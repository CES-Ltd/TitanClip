import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { chatterService } from "../services/chatter.js";

function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function chatterRoutes(db: Db) {
  const router = Router();
  const svc = chatterService(db);

  // List messages
  router.get("/companies/:companyId/chatter", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const { channel, cursor, limit } = req.query;
    const messages = await svc.listMessages(
      req.params.companyId as string,
      (channel as string) ?? "general",
      cursor as string | undefined,
      Math.min(Number(limit) || 50, 200),
    );
    res.json(messages);
  });

  // Post message (agents or board users)
  router.post("/companies/:companyId/chatter", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const { body, channel, messageType, metadata, issueId, runId } = req.body;
    if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

    const msg = await svc.postMessage(req.params.companyId as string, {
      channel,
      messageType,
      authorAgentId: req.actor.type === "agent" ? req.actor.agentId : null,
      authorUserId: req.actor.type === "board" ? req.actor.userId : null,
      body: body.trim(),
      metadata,
      issueId,
      runId,
    });
    res.status(201).json(msg);
  });

  return router;
}
