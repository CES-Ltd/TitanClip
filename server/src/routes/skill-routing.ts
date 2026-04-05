import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { skillRoutingService } from "../services/skill-routing.js";

function assertAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function skillRoutingRoutes(db: Db) {
  const router = Router();
  const svc = skillRoutingService(db);

  // ── Skills ──

  // List all skills for company (matrix view data)
  router.get("/companies/:companyId/skill-proficiency", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await svc.listSkillsForCompany(req.params.companyId as string));
  });

  // Get skill matrix
  router.get("/companies/:companyId/skill-matrix", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await svc.getSkillMatrix(req.params.companyId as string));
  });

  // List skills for a specific agent
  router.get("/companies/:companyId/agents/:agentId/skills", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    res.json(await svc.listSkillsForAgent(req.params.agentId as string));
  });

  // Set/update a skill for an agent
  router.post("/companies/:companyId/skill-proficiency", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { agentId, skillName, proficiency, endorsedBy, notes } = req.body;
    if (!agentId || !skillName || !proficiency) {
      res.status(400).json({ error: "agentId, skillName, and proficiency are required" });
      return;
    }
    const skill = await svc.setSkill(req.params.companyId as string, agentId, skillName, proficiency, { endorsedBy, notes });
    res.status(201).json(skill);
  });

  // Remove a skill
  router.delete("/companies/:companyId/skill-proficiency/:skillId", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    await svc.removeSkill(req.params.skillId as string);
    res.json({ ok: true });
  });

  // ── Smart Routing ──

  // Route a task based on skill requirements
  router.post("/companies/:companyId/route-task", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const { requirements } = req.body;
    if (!requirements || !Array.isArray(requirements)) {
      res.status(400).json({ error: "requirements array is required" });
      return;
    }
    const result = await svc.routeTask(req.params.companyId as string, requirements);
    res.json(result);
  });

  return router;
}
