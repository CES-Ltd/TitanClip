import { Router, Request, Response } from "express";
import type { Db } from "@titanclip/db";
import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { agents, heartbeatRuns, instanceUserRoles, invites } from "@titanclip/db";
import type { DeploymentExposure, DeploymentMode } from "@titanclip/shared";
import { readPersistedDevServerStatus, toDevServerHealthStatus } from "../dev-server-status.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { serverVersion } from "../version.js";
import { logger } from "../middleware/logger.js";

export function healthRoutes(
  db?: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    authReady: boolean;
    companyDeletionEnabled: boolean;
  } = {
    deploymentMode: "local_trusted",
    deploymentExposure: "private",
    authReady: true,
    companyDeletionEnabled: true,
  },
) {
  const router = Router();

  router.get("/", async (_req, res) => {
    if (!db) {
      res.json({ status: "ok", version: serverVersion });
      return;
    }

    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      res.status(503).json({
        status: "unhealthy",
        version: serverVersion,
        error: "database_unreachable",
      });
      return;
    }

    let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
    let bootstrapInviteActive = false;
    if (opts.deploymentMode === "authenticated") {
      const roleCount = await db
        .select({ count: count() })
        .from(instanceUserRoles)
        .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
        .then((rows) => Number(rows[0]?.count ?? 0));
      bootstrapStatus = roleCount > 0 ? "ready" : "bootstrap_pending";

      if (bootstrapStatus === "bootstrap_pending") {
        const now = new Date();
        const inviteCount = await db
          .select({ count: count() })
          .from(invites)
          .where(
            and(
              eq(invites.inviteType, "bootstrap_ceo"),
              isNull(invites.revokedAt),
              isNull(invites.acceptedAt),
              gt(invites.expiresAt, now),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0));
        bootstrapInviteActive = inviteCount > 0;
      }
    }

    const persistedDevServerStatus = readPersistedDevServerStatus();
    let devServer: ReturnType<typeof toDevServerHealthStatus> | undefined;
    if (persistedDevServerStatus) {
      const instanceSettings = instanceSettingsService(db);
      const experimentalSettings = await instanceSettings.getExperimental();
      const activeRunCount = await db
        .select({ count: count() })
        .from(heartbeatRuns)
        .where(inArray(heartbeatRuns.status, ["queued", "running"]))
        .then((rows) => Number(rows[0]?.count ?? 0));

      devServer = toDevServerHealthStatus(persistedDevServerStatus, {
        autoRestartEnabled: experimentalSettings.autoRestartDevServerWhenIdle ?? false,
        activeRunCount,
      });
    }

    res.json({
      status: "ok",
      version: serverVersion,
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      bootstrapStatus,
      bootstrapInviteActive,
      features: {
        companyDeletionEnabled: opts.companyDeletionEnabled,
      },
      ...(devServer ? { devServer } : {}),
    });
  });

  router.get("/ready", async (_req, res) => {
    if (!db) {
      res.json({ status: "ready", version: serverVersion });
      return;
    }

    const checks: Record<string, { status: "ok" | "error"; error?: string }> = {};
    let allHealthy = true;

    try {
      await db.execute(sql`SELECT 1`);
      checks.database = { status: "ok" };
    } catch (err) {
      checks.database = { status: "error", error: err instanceof Error ? err.message : "unknown error" };
      allHealthy = false;
    }

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: allHealthy ? "ready" : "not_ready",
      version: serverVersion,
      checks,
    });
  });

  router.get("/live", async (_req, res) => {
    res.json({
      status: "alive",
      version: serverVersion,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  const startTime = Date.now();
  const requestCounts = new Map<string, number>();

  router.use((req: Request, _res: Response, next) => {
    const path = req.path.split("/").slice(0, 3).join("/");
    const count = requestCounts.get(path) ?? 0;
    requestCounts.set(path, count + 1);
    next();
  });

  router.get("/metrics", async (req, res) => {
    const metrics: string[] = [];

    metrics.push("# HELP titanclip_server_uptime_seconds Server uptime in seconds");
    metrics.push("# TYPE titanclip_server_uptime_seconds counter");
    metrics.push(`titanclip_server_uptime_seconds ${(Date.now() - startTime) / 1000}`);

    metrics.push("# HELP titanclip_server_memory_bytes Memory usage in bytes");
    metrics.push("# TYPE titanclip_server_memory_bytes gauge");
    const memUsage = process.memoryUsage();
    metrics.push(`titanclip_server_memory_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    metrics.push(`titanclip_server_memory_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    metrics.push(`titanclip_server_memory_bytes{type="rss"} ${memUsage.rss}`);

    metrics.push("# HELP titanclip_server_request_count Total request count by path");
    metrics.push("# TYPE titanclip_server_request_count counter");
    for (const [path, count] of requestCounts.entries()) {
      const safePath = path.replace(/"/g, '\\"');
      metrics.push(`titanclip_server_request_count{path="${safePath}"} ${count}`);
    }

    if (db) {
      try {
        const agentStats = await db
          .select({
            status: agents.status,
            count: count(),
          })
          .from(agents)
          .groupBy(agents.status);

        metrics.push("# HELP titanclip_agents_count Agent count by status");
        metrics.push("# TYPE titanclip_agents_count gauge");
        for (const row of agentStats) {
          metrics.push(`titanclip_agents_count{status="${row.status}"} ${Number(row.count)}`);
        }

        const activeRuns = await db
          .select({ count: count() })
          .from(heartbeatRuns)
          .where(inArray(heartbeatRuns.status, ["queued", "running"]))
          .then((rows) => Number(rows[0]?.count ?? 0));

        metrics.push("# HELP titanclip_active_runs Current active heartbeat runs");
        metrics.push("# TYPE titanclip_active_runs gauge");
        metrics.push(`titanclip_active_runs ${activeRuns}`);
      } catch (err) {
        logger.warn({ err }, "Failed to fetch metrics from database");
      }
    }

    metrics.push("# HELP titanclip_server_version Server version information");
    metrics.push("# TYPE titanclip_server_version gauge");
    metrics.push(`titanclip_server_version{version="${serverVersion}"} 1`);

    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(metrics.join("\n"));
  });

  return router;
}
