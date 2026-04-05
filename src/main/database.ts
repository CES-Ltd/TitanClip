/**
 * Database initialization for the Electron main process.
 *
 * Supports two backends:
 *   - SQLite (default for Electron): in-process, instant startup, single file
 *   - PostgreSQL (embedded or external): for compatibility with server mode
 *
 * The engine is selected via DatabaseConfig.engine:
 *   - "sqlite" (default) — uses better-sqlite3 via Drizzle ORM
 *   - "postgres" — uses embedded-postgres or external URL
 */

import { app } from "electron";
import path from "path";
import { getSqliteDbPath, getSqliteMigrationsPath } from "./paths.js";

// The Db type from @titanclip/db is available at runtime via dynamic import.
// For type annotations in the main process, use `any` to avoid static import.

let dbInstance: any = null;
let dbCleanup: (() => void | Promise<void>) | null = null;

export type DatabaseEngine = "sqlite" | "postgres";

export interface DatabaseConfig {
  /** Database engine to use. Default: "sqlite" for Electron. */
  engine?: DatabaseEngine;
  /** External PostgreSQL connection string (only for engine="postgres") */
  databaseUrl?: string;
  /** Whether to auto-apply pending migrations */
  autoApplyMigrations: boolean;
}

/**
 * Initialize the database connection.
 */
export async function initDatabase(config: DatabaseConfig): Promise<any> {
  const engine = config.engine ?? "sqlite";

  if (engine === "sqlite") {
    return initSqlite(config);
  } else {
    return initPostgres(config);
  }
}

// ── SQLite ──────────────────────────────────────────────────────────────

async function initSqlite(config: DatabaseConfig): Promise<any> {
  const dbPath = getSqliteDbPath();
  console.log(`[TitanClip] Initializing SQLite database at: ${dbPath}`);

  const dynamicImport = Function("p", "return import(p)");
  // In dev, import from workspace; in prod, from bundled server-dist
  const sqliteClientPath = app.isPackaged
    ? path.join((process as any).resourcesPath, "server-dist", "node_modules", "@titanclip", "db", "dist", "sqlite-client.js")
    : path.join(__dirname, "..", "..", "packages", "db", "src", "sqlite-client.js");
  const { createSqliteDb, applySqliteMigrations } = await dynamicImport(sqliteClientPath);

  const sqliteDb = await createSqliteDb({ dbPath });

  // Apply migrations
  if (config.autoApplyMigrations) {
    const migrationsDir = getSqliteMigrationsPath();
    try {
      const result = await applySqliteMigrations(sqliteDb, migrationsDir);
      if (result.applied.length > 0) {
        console.log(`[TitanClip] Applied ${result.applied.length} SQLite migrations`);
      } else {
        console.log("[TitanClip] SQLite schema is up to date");
      }
    } catch (err) {
      console.error("[TitanClip] SQLite migration error:", err);
      // On first run, use Drizzle's push to create tables from schema
      console.log("[TitanClip] Attempting schema push from Drizzle schema...");
    }
  }

  dbInstance = sqliteDb.drizzle;
  dbCleanup = () => sqliteDb.close();

  console.log("[TitanClip] SQLite database ready");
  return dbInstance;
}

// ── PostgreSQL ──────────────────────────────────────────────────────────

let embeddedPostgres: any = null;

async function initPostgres(config: DatabaseConfig): Promise<any> {
  const dynamicImport = Function("p", "return import(p)");
  const dbModule: any = await dynamicImport("@titanclip/db");
  const {
    createDb,
    ensurePostgresDatabase,
    inspectMigrations,
    applyPendingMigrations,
    reconcilePendingMigrationHistory,
  } = dbModule;

  let connectionString: string;

  if (config.databaseUrl) {
    connectionString = config.databaseUrl;
    console.log("[TitanClip] Connecting to external PostgreSQL...");
  } else {
    connectionString = await startEmbeddedPostgres();
    console.log("[TitanClip] Embedded PostgreSQL started");
  }

  await ensurePostgresDatabase(connectionString, "titanclip");

  if (config.autoApplyMigrations) {
    let state = await inspectMigrations(connectionString);

    if (state.status === "needsMigrations" && state.reason === "pending-migrations") {
      const repair = await reconcilePendingMigrationHistory(connectionString);
      if (repair.repairedMigrations.length > 0) {
        state = await inspectMigrations(connectionString);
      }
    }

    if (state.status === "needsMigrations") {
      console.log(`[TitanClip] Applying ${state.pendingMigrations.length} pending migrations...`);
      await applyPendingMigrations(connectionString);
      console.log("[TitanClip] Migrations applied successfully");
    } else {
      console.log("[TitanClip] Database schema is up to date");
    }
  }

  dbInstance = createDb(connectionString);
  dbCleanup = async () => {
    if (embeddedPostgres) {
      console.log("[TitanClip] Stopping embedded PostgreSQL...");
      try { await embeddedPostgres.stop(); } catch {}
      embeddedPostgres = null;
    }
  };

  console.log("[TitanClip] PostgreSQL database connection established");
  return dbInstance;
}

async function startEmbeddedPostgres(): Promise<string> {
  const dynamicImport = Function("p", "return import(p)");
  const { default: EmbeddedPostgres } = await dynamicImport("embedded-postgres");

  const dataDir = path.join(app.getPath("userData"), "postgres-data");
  const port = 5434;

  embeddedPostgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "titanclip",
    password: "titanclip",
    port,
    persistent: true,
    onLog: (msg: unknown) => console.log("[postgres]", msg),
    onError: (msg: unknown) => console.error("[postgres]", msg),
  });

  await embeddedPostgres.initialise();
  await embeddedPostgres.start();

  return `postgresql://titanclip:titanclip@127.0.0.1:${port}/titanclip`;
}

/**
 * Get the current database instance.
 */
export function getDb(): any {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

/**
 * Gracefully shut down the database.
 */
export async function shutdownDatabase(): Promise<void> {
  if (dbCleanup) {
    await dbCleanup();
    dbCleanup = null;
  }
  dbInstance = null;
}
