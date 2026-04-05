import { Router } from "express";
import type { Db } from "@titanclip/db";
import { agentMemoryService } from "../services/agent-memory.js";
import { assertCompanyAccess } from "./authz.js";

export function agentMemoryRoutes(db: Db) {
  const router = Router();
  const svc = agentMemoryService(db);

  router.get("/companies/:companyId/agents/:agentId/memories", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const memories = await svc.list(req.params.agentId as string, {
      type: req.query.type as any,
      category: req.query.category as string,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(memories);
  });

  router.post("/companies/:companyId/agents/:agentId/memories", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const memory = await svc.upsert(req.params.agentId as string, req.params.companyId as string, req.body);
    res.status(201).json(memory);
  });

  router.delete("/agents/:agentId/memories/:id", async (req, res) => {
    const memory = await svc.remove(req.params.id as string);
    res.json(memory ?? { ok: true });
  });

  router.post("/companies/:companyId/agents/:agentId/memories/search", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const results = await svc.search(req.params.agentId as string, req.body.query, {
      types: req.body.types,
      limit: req.body.limit,
    });
    res.json(results);
  });

  router.get("/companies/:companyId/agents/:agentId/memory-context", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const context = await svc.buildMemoryContext(req.params.agentId as string);
    res.json({ context });
  });

  return router;
}
