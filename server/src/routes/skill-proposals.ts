import { Router } from "express";
import type { Db } from "@titanclip/db";
import { skillProposerService } from "../services/skill-proposer.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function skillProposalRoutes(db: Db) {
  const router = Router();
  const svc = skillProposerService(db);

  router.get("/companies/:companyId/skill-proposals", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const proposals = await svc.list(req.params.companyId as string, {
      status: req.query.status as string,
      agentId: req.query.agentId as string,
    });
    res.json(proposals);
  });

  router.get("/skill-proposals/:id", async (req, res) => {
    const proposal = await svc.getById(req.params.id as string);
    if (!proposal) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, proposal.companyId);
    res.json(proposal);
  });

  router.post("/skill-proposals/:id/approve", async (req, res) => {
    const proposal = await svc.getById(req.params.id as string);
    if (!proposal) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, proposal.companyId);
    const actor = getActorInfo(req);
    // In a full implementation, this would create a CompanySkill from the proposal markdown
    const approved = await svc.approve(proposal.id, actor.actorId ?? "system", req.body.skillId ?? proposal.id);
    res.json(approved);
  });

  router.post("/skill-proposals/:id/reject", async (req, res) => {
    const proposal = await svc.getById(req.params.id as string);
    if (!proposal) { res.status(404).json({ error: "Not found" }); return; }
    assertCompanyAccess(req, proposal.companyId);
    const actor = getActorInfo(req);
    const rejected = await svc.reject(proposal.id, actor.actorId ?? "system");
    res.json(rejected);
  });

  router.get("/companies/:companyId/skill-usage/:skillId", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const effectiveness = await svc.getEffectiveness(req.params.skillId as string);
    res.json(effectiveness);
  });

  return router;
}
