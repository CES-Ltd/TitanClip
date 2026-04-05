import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { dependencyService } from "../services/dependencies.js";
import { workflowService } from "../services/workflows.js";

function assertAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function dependencyRoutes(db: Db) {
  const router = Router();
  const deps = dependencyService(db);
  const workflows = workflowService(db);

  // ── Dependencies ──

  router.get("/companies/:companyId/dependencies", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await deps.listForCompany(req.params.companyId as string));
  });

  router.get("/companies/:companyId/dependencies/issue/:issueId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await deps.listForIssue(req.params.issueId as string));
  });

  router.post("/companies/:companyId/dependencies", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { sourceIssueId, targetIssueId, dependencyType } = req.body;
    if (!sourceIssueId || !targetIssueId || !dependencyType) {
      res.status(400).json({ error: "sourceIssueId, targetIssueId, and dependencyType are required" });
      return;
    }
    try {
      const dep = await deps.addDependency(req.params.companyId as string, sourceIssueId, targetIssueId, dependencyType);
      res.status(201).json(dep);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete("/companies/:companyId/dependencies/:depId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    await deps.removeDependency(req.params.depId as string);
    res.json({ ok: true });
  });

  // Notify completion (auto-unblock)
  router.post("/companies/:companyId/dependencies/issue/:issueId/completed", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const unblocked = await deps.onIssueCompleted(req.params.issueId as string);
    res.json({ unblocked });
  });

  // Critical path
  router.get("/companies/:companyId/dependencies/critical-path", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const rootIssueId = req.query.rootIssueId as string | undefined;
    res.json(await deps.getCriticalPath(req.params.companyId as string, rootIssueId));
  });

  // ── Workflow Templates ──

  router.get("/companies/:companyId/workflows", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await workflows.listTemplates(req.params.companyId as string));
  });

  router.get("/companies/:companyId/workflows/:workflowId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const t = await workflows.getTemplate(req.params.workflowId as string);
    if (!t) { res.status(404).json({ error: "Not found" }); return; }
    res.json(t);
  });

  router.post("/companies/:companyId/workflows", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { name, description, steps } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const template = await workflows.createTemplate(req.params.companyId as string, { name, description, steps: steps ?? [] });
    res.status(201).json(template);
  });

  router.patch("/companies/:companyId/workflows/:workflowId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const updated = await workflows.updateTemplate(req.params.workflowId as string, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  router.delete("/companies/:companyId/workflows/:workflowId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    await workflows.deleteTemplate(req.params.workflowId as string);
    res.json({ ok: true });
  });

  // Execute workflow (create linked issues)
  router.post("/companies/:companyId/workflows/:workflowId/execute", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { projectId, prefix } = req.body;
    try {
      const result = await workflows.executeWorkflow(req.params.companyId as string, req.params.workflowId as string, { projectId, prefix });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
