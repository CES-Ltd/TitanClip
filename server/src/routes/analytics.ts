import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import { forbidden } from "../errors.js";
import { analyticsService } from "../services/analytics.js";

function assertAccess(req: Request, companyId: string) {
  if (req.actor.type === "none") throw forbidden("Authentication required");
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) throw forbidden("Access denied");
}

export function analyticsRoutes(db: Db) {
  const router = Router();
  const svc = analyticsService(db);

  router.get("/companies/:companyId/analytics", async (req, res) => {
    assertAccess(req, req.params.companyId as string);
    const sinceDays = Math.min(Number(req.query.sinceDays) || 30, 365);
    res.json(await svc.getSummary(req.params.companyId as string, sinceDays));
  });

  return router;
}
