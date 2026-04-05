import { Router, type Request } from "express";
import type { Db } from "@titanclip/db";
import {
  patchInstanceAdminSettingsSchema,
  verifyPinSchema,
  changePinSchema,
  createAgentTemplateSchema,
  updateAgentTemplateSchema,
} from "@titanclip/shared";
import { forbidden, badRequest } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { instanceSettingsService, logActivity } from "../services/index.js";
import { createAdminAuthService } from "../services/admin-auth.js";
import { getActorInfo } from "./authz.js";
interface AdminRoutesConfig {
  ssoClientId?: string;
}

function assertBoardUser(req: Request) {
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

function assertInstanceAdmin(req: Request) {
  assertBoardUser(req);
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function adminSettingsRoutes(db: Db, config: AdminRoutesConfig) {
  const router = Router();
  const settingsSvc = instanceSettingsService(db);
  const adminAuth = createAdminAuthService({
    getAdminSettings: () => settingsSvc.getAdmin(),
    updatePinHash: (hash) => settingsSvc.updateAdminPinHash(hash),
    ssoClientId: config.ssoClientId,
  });

  function assertAdminSession(req: Request) {
    assertInstanceAdmin(req);
    if (adminAuth.isSsoMode()) return; // SSO users verified via session already
    const token = req.header("x-admin-token");
    if (!token || !adminAuth.verifyToken(token)) {
      throw forbidden("Admin session required. Please enter your PIN.");
    }
  }

  // GET /instance/settings/admin — public admin settings (PIN hash stripped)
  router.get("/instance/settings/admin", async (req, res) => {
    assertBoardUser(req);
    const admin = await settingsSvc.getAdmin();
    const { adminPinHash: _, ...publicSettings } = admin;
    res.json(publicSettings);
  });

  // GET /instance/settings/admin/auth-mode — returns "pin" or "sso"
  router.get("/instance/settings/admin/auth-mode", async (req, res) => {
    assertBoardUser(req);
    res.json({ mode: adminAuth.isSsoMode() ? "sso" : "pin" });
  });

  // POST /instance/settings/admin/verify-pin — verify PIN, issue admin token
  router.post(
    "/instance/settings/admin/verify-pin",
    validate(verifyPinSchema),
    async (req, res) => {
      assertBoardUser(req);
      if (adminAuth.isSsoMode()) {
        throw badRequest("PIN authentication is disabled in SSO mode");
      }
      const { pin } = req.body;
      const valid = await adminAuth.verifyPin(pin);
      if (!valid) {
        throw forbidden("Incorrect PIN");
      }
      const adminSettings = await settingsSvc.getAdmin();
      const { token, expiresAt } = adminAuth.issueToken();
      res.json({ token, expiresAt: expiresAt.toISOString() });
    },
  );

  // PATCH /instance/settings/admin — update governance settings (requires admin session)
  router.patch(
    "/instance/settings/admin",
    validate(patchInstanceAdminSettingsSchema),
    async (req, res) => {
      assertAdminSession(req);
      const updated = await settingsSvc.updateAdmin(req.body);
      const actor = getActorInfo(req);
      const companyIds = await settingsSvc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "instance.settings.admin_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: {
              changedKeys: Object.keys(req.body).sort(),
            },
          }),
        ),
      );
      const { adminPinHash: _, ...publicSettings } = updated.admin;
      res.json(publicSettings);
    },
  );

  // POST /instance/settings/admin/change-pin — change admin PIN (requires admin session)
  router.post(
    "/instance/settings/admin/change-pin",
    validate(changePinSchema),
    async (req, res) => {
      assertAdminSession(req);
      if (adminAuth.isSsoMode()) {
        throw badRequest("PIN management is disabled in SSO mode");
      }
      const { currentPin, newPin } = req.body;
      try {
        await adminAuth.changePin(currentPin, newPin);
      } catch (err) {
        throw badRequest((err as Error).message);
      }
      const actor = getActorInfo(req);
      const companyIds = await settingsSvc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "instance.settings.admin_pin_changed",
            entityType: "instance_settings",
            entityId: "admin",
            details: {},
          }),
        ),
      );
      res.json({ ok: true });
    },
  );

  // --- Agent Template CRUD ---

  // GET all templates (admin only)
  router.get("/instance/settings/admin/templates", async (req, res) => {
    assertAdminSession(req);
    res.json(await settingsSvc.getAgentTemplates());
  });

  // POST create template (admin only)
  router.post(
    "/instance/settings/admin/templates",
    validate(createAgentTemplateSchema),
    async (req, res) => {
      assertAdminSession(req);
      const template = await settingsSvc.createAgentTemplate(req.body);
      res.status(201).json(template);
    },
  );

  // PATCH update template (admin only)
  router.patch(
    "/instance/settings/admin/templates/:id",
    validate(updateAgentTemplateSchema),
    async (req, res) => {
      assertAdminSession(req);
      const updated = await settingsSvc.updateAgentTemplate(req.params.id as string, req.body);
      if (!updated) throw badRequest("Template not found");
      res.json(updated);
    },
  );

  // DELETE template (admin only)
  router.delete("/instance/settings/admin/templates/:id", async (req, res) => {
    assertAdminSession(req);
    await settingsSvc.deleteAgentTemplate(req.params.id as string);
    res.json({ ok: true });
  });

  // GET available templates (any board user — for agent creation picker)
  router.get("/instance/settings/templates/available", async (req, res) => {
    assertBoardUser(req);
    res.json(await settingsSvc.getAvailableTemplates());
  });

  return router;
}
