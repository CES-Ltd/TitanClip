import { Router } from "express";
import { routineTemplateService } from "../services/routine-templates.js";

export function routineTemplateRoutes() {
  const router = Router();
  const svc = routineTemplateService();

  router.get("/routine-templates", (_req, res) => {
    res.json(svc.list());
  });

  router.get("/routine-templates/:slug", (req, res) => {
    const template = svc.getBySlug(req.params.slug as string);
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  });

  router.post("/routine-templates/:slug/instantiate", (req, res) => {
    try {
      const result = svc.instantiate(req.params.slug as string, {
        cron: req.body.cron,
        timezone: req.body.timezone,
        variableDefaults: req.body.variableDefaults,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
