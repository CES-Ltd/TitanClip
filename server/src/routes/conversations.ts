import { Router } from "express";
import type { Db } from "@titanclip/db";
import { conversationService } from "../services/conversations.js";
import { assertCompanyAccess } from "./authz.js";

export function conversationRoutes(db: Db) {
  const router = Router();
  const svc = conversationService(db);

  router.get("/companies/:companyId/conversations", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const convs = await svc.list(req.params.companyId as string, {
      agentId: req.query.agentId as string,
      issueId: req.query.issueId as string,
      status: req.query.status as string,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(convs);
  });

  router.post("/companies/:companyId/conversations", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const conv = await svc.create(req.params.companyId as string, req.body.agentId, {
      title: req.body.title,
      issueId: req.body.issueId,
      projectId: req.body.projectId,
    });
    res.status(201).json(conv);
  });

  router.get("/conversations/:id", async (req, res) => {
    const conv = await svc.getById(req.params.id as string);
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, conv.companyId);
    const messages = await svc.getMessages(conv.id);
    res.json({ ...conv, messages });
  });

  router.post("/conversations/:id/messages", async (req, res) => {
    const conv = await svc.getById(req.params.id as string);
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, conv.companyId);
    const msg = await svc.appendMessage(conv.id, conv.companyId, req.body);
    res.status(201).json(msg);
  });

  router.post("/companies/:companyId/conversations/search", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const results = await svc.search(req.params.companyId as string, req.body.query, {
      agentId: req.body.agentId,
      limit: req.body.limit,
    });
    res.json(results);
  });

  router.patch("/conversations/:id", async (req, res) => {
    const conv = await svc.getById(req.params.id as string);
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, conv.companyId);
    if (req.body.title) await svc.updateTitle(conv.id, req.body.title);
    if (req.body.status === "archived") await svc.archive(conv.id);
    if (req.body.issueId) await svc.linkToIssue(conv.id, req.body.issueId);
    const updated = await svc.getById(conv.id);
    res.json(updated);
  });

  return router;
}
