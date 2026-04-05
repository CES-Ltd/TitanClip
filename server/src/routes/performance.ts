import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { performanceService } from "../services/performance.js";

function assertCompanyAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function performanceRoutes(db: Db) {
  const router = Router();
  const svc = performanceService(db);

  // Get agent performance metrics
  router.get("/companies/:companyId/performance", async (req, res) => {
    assertCompanyAccess(req, req.params.companyId as string);
    const sinceDays = Math.min(Number(req.query.sinceDays) || 30, 365);
    const metrics = await svc.getAgentMetrics(req.params.companyId as string, sinceDays);
    res.json(metrics);
  });

  return router;
}
