import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { lifecycleService } from "../services/lifecycle.js";

function assertAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function lifecycleRoutes(db: Db) {
  const router = Router();
  const svc = lifecycleService(db);

  // ── Onboarding Workflows ──

  router.get("/companies/:companyId/onboarding/workflows", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await svc.listOnboardingWorkflows(req.params.companyId as string));
  });

  router.post("/companies/:companyId/onboarding/workflows", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { name, description, targetRole, steps } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const wf = await svc.createOnboardingWorkflow(req.params.companyId as string, {
      name, description, targetRole: targetRole ?? "general", steps: steps ?? [],
    });
    res.status(201).json(wf);
  });

  router.patch("/companies/:companyId/onboarding/workflows/:id", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const updated = await svc.updateOnboardingWorkflow(req.params.id as string, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  router.delete("/companies/:companyId/onboarding/workflows/:id", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    await svc.deleteOnboardingWorkflow(req.params.id as string);
    res.json({ ok: true });
  });

  // Execute onboarding for an agent
  router.post("/companies/:companyId/onboarding/execute", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { agentId, workflowId } = req.body;
    if (!agentId || !workflowId) { res.status(400).json({ error: "agentId and workflowId required" }); return; }
    try {
      const instance = await svc.executeOnboarding(req.params.companyId as string, agentId, workflowId);
      res.status(201).json(instance);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/companies/:companyId/onboarding/instances", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await svc.listOnboardingInstances(req.params.companyId as string));
  });

  // ── Offboarding ──

  router.post("/companies/:companyId/offboard/:agentId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { reassignToAgentId } = req.body;
    try {
      const report = await svc.offboardAgent(req.params.companyId as string, req.params.agentId as string, reassignToAgentId);
      res.json(report);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Change Requests ──

  router.get("/companies/:companyId/change-requests", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const status = req.query.status as string | undefined;
    res.json(await svc.listChangeRequests(req.params.companyId as string, status));
  });

  router.post("/companies/:companyId/change-requests", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { title, description, category, risk, affectedAgentIds, scheduledAt, validationSteps } = req.body;
    if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
    const cr = await svc.createChangeRequest(req.params.companyId as string, {
      title, description, category: category ?? "other", risk: risk ?? "medium",
      affectedAgentIds, scheduledAt, validationSteps,
      requestedByUserId: req.actor.type === "board" ? (req.actor.userId ?? "board") : "agent",
    });
    res.status(201).json(cr);
  });

  router.patch("/companies/:companyId/change-requests/:id", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const updated = await svc.updateChangeRequest(req.params.id as string, req.body);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  router.delete("/companies/:companyId/change-requests/:id", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    await svc.deleteChangeRequest(req.params.id as string);
    res.json({ ok: true });
  });

  return router;
}
