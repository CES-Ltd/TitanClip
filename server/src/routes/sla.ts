import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { slaService } from "../services/sla.js";
import { escalationService } from "../services/escalation.js";

function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function slaRoutes(db: Db) {
  const router = Router();
  const sla = slaService(db);
  const escalation = escalationService(db);

  // ── SLA Policies ──

  router.get("/companies/:companyId/sla/policies", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await sla.listPolicies(req.params.companyId as string));
  });

  router.post("/companies/:companyId/sla/policies", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const { name, description, priority, targetResponseMinutes, targetResolutionMinutes, breachAction, escalateToAgentId, notifyUserIds, isDefault } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const policy = await sla.createPolicy(req.params.companyId as string, {
      name, description, priority, targetResponseMinutes, targetResolutionMinutes, breachAction, escalateToAgentId, notifyUserIds, isDefault,
    });
    res.status(201).json(policy);
  });

  router.patch("/companies/:companyId/sla/policies/:policyId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const updated = await sla.updatePolicy(req.params.policyId as string, req.body);
    if (!updated) { res.status(404).json({ error: "Policy not found" }); return; }
    res.json(updated);
  });

  router.delete("/companies/:companyId/sla/policies/:policyId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await sla.deletePolicy(req.params.policyId as string);
    res.json({ ok: true });
  });

  // ── SLA Tracking ──

  router.get("/companies/:companyId/sla/tracking", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const status = req.query.status as string | undefined;
    res.json(await sla.listTracking(req.params.companyId as string, { status }));
  });

  router.get("/companies/:companyId/sla/tracking/issue/:issueId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const tracking = await sla.getTrackingForIssue(req.params.issueId as string);
    res.json(tracking);
  });

  router.post("/companies/:companyId/sla/tracking", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const { issueId, policyId } = req.body;
    if (!issueId || !policyId) { res.status(400).json({ error: "issueId and policyId required" }); return; }
    const tracking = await sla.startTracking(req.params.companyId as string, issueId, policyId);
    res.status(201).json(tracking);
  });

  router.post("/companies/:companyId/sla/tracking/:issueId/pause", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await sla.pauseTracking(req.params.issueId as string);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/sla/tracking/:issueId/resume", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await sla.resumeTracking(req.params.issueId as string);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/sla/tracking/:issueId/respond", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await sla.markResponded(req.params.issueId as string);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/sla/tracking/:issueId/resolve", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await sla.markResolved(req.params.issueId as string);
    res.json({ ok: true });
  });

  // ── Dashboard ──

  router.get("/companies/:companyId/sla/dashboard", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await sla.getDashboardSummary(req.params.companyId as string));
  });

  // ── Breach check (can be called manually or by cron) ──

  router.post("/companies/:companyId/sla/check-breaches", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const result = await sla.checkBreaches(req.params.companyId as string);
    res.json(result);
  });

  // ── Escalation Rules ──

  router.get("/companies/:companyId/escalation/rules", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    res.json(await escalation.listRules(req.params.companyId as string));
  });

  router.post("/companies/:companyId/escalation/rules", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const { name, description, trigger, triggerThreshold, action, targetAgentId, notifyUserIds, cooldownMinutes } = req.body;
    if (!name?.trim() || !trigger || !action) { res.status(400).json({ error: "name, trigger, and action are required" }); return; }
    const rule = await escalation.createRule(req.params.companyId as string, {
      name, description, trigger, triggerThreshold, action, targetAgentId, notifyUserIds, cooldownMinutes,
    });
    res.status(201).json(rule);
  });

  router.patch("/companies/:companyId/escalation/rules/:ruleId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const updated = await escalation.updateRule(req.params.ruleId as string, req.body);
    if (!updated) { res.status(404).json({ error: "Rule not found" }); return; }
    res.json(updated);
  });

  router.delete("/companies/:companyId/escalation/rules/:ruleId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    await escalation.deleteRule(req.params.ruleId as string);
    res.json({ ok: true });
  });

  router.post("/companies/:companyId/escalation/evaluate", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const result = await escalation.evaluateRules(req.params.companyId as string);
    res.json(result);
  });

  return router;
}
