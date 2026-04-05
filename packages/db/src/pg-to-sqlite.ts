/**
 * PostgreSQL → SQLite Data Migration Tool
 *
 * Migrates all data from a PostgreSQL database to a SQLite database.
 * Used when converting an existing TitanClip installation from the
 * legacy embedded PostgreSQL to the new SQLite backend.
 *
 * Usage:
 *   tsx packages/db/src/pg-to-sqlite.ts \
 *     --pg-url postgresql://titanclip:titanclip@127.0.0.1:5434/titanclip \
 *     --sqlite-path /path/to/titanclip.db
 *
 * The tool:
 * 1. Connects to the PostgreSQL database
 * 2. Creates the SQLite database with schema
 * 3. Copies all rows from each table, converting types:
 *    - UUID → text (no change, already strings)
 *    - JSONB → text (JSON.stringify)
 *    - timestamp → text (ISO 8601)
 *    - boolean → integer (0/1)
 * 4. Reports progress for each table
 */

import { existsSync } from "node:fs";

// Tables in dependency order (parents before children)
const TABLE_ORDER = [
  "auth_users",
  "auth_sessions",
  "auth_accounts",
  "auth_verifications",
  "companies",
  "company_logos",
  "instance_settings",
  "instance_user_roles",
  "company_memberships",
  "principal_permission_grants",
  "invites",
  "join_requests",
  "board_api_keys",
  "cli_auth_challenges",
  "agents",
  "agent_api_keys",
  "agent_config_revisions",
  "agent_runtime_state",
  "agent_task_sessions",
  "agent_wakeup_requests",
  "agent_skill_proficiency",
  "projects",
  "project_workspaces",
  "project_goals",
  "goals",
  "execution_workspaces",
  "workspace_operations",
  "workspace_runtime_services",
  "issues",
  "issue_comments",
  "issue_attachments",
  "issue_labels",
  "labels",
  "issue_approvals",
  "issue_work_products",
  "issue_documents",
  "issue_read_states",
  "issue_inbox_archives",
  "issue_dependencies",
  "documents",
  "document_revisions",
  "assets",
  "heartbeat_runs",
  "heartbeat_run_events",
  "cost_events",
  "finance_events",
  "approvals",
  "approval_comments",
  "activity_log",
  "company_secrets",
  "company_secret_versions",
  "company_skills",
  "routines",
  "routine_triggers",
  "routine_runs",
  "budget_policies",
  "budget_incidents",
  "plugins",
  "plugin_config",
  "plugin_company_settings",
  "plugin_state",
  "plugin_entities",
  "plugin_jobs",
  "plugin_job_runs",
  "plugin_webhook_deliveries",
  "plugin_logs",
  "vault_credentials",
  "vault_token_checkouts",
  "permission_policies",
  "team_roles",
  "chatter_messages",
  "sla_policies",
  "sla_tracking",
  "escalation_rules",
  "workflow_templates",
  "onboarding_workflows",
  "onboarding_instances",
  "change_requests",
  "feedback_votes",
  "feedback_exports",
];

/**
 * Convert a PostgreSQL row value to SQLite-compatible format.
 */
function convertValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export async function migratePgToSqlite(pgUrl: string, sqlitePath: string): Promise<void> {
  // Dynamic imports
  const postgres = (await import("postgres")).default;
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  console.log("=== PostgreSQL → SQLite Migration ===\n");
  console.log(`Source: ${pgUrl}`);
  console.log(`Target: ${sqlitePath}\n`);

  if (existsSync(sqlitePath)) {
    throw new Error(`Target SQLite database already exists: ${sqlitePath}`);
  }

  // Connect to PostgreSQL
  const pg = postgres(pgUrl, { max: 1 });

  // Create SQLite database
  const sqlite = new BetterSqlite3(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = OFF"); // Disable during migration
  sqlite.pragma("synchronous = OFF"); // Speed up bulk insert

  // Apply SQLite schema
  const migrationPath = join(import.meta.dirname ?? __dirname, "migrations-sqlite", "0000_initial.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      sqlite.exec(stmt);
    } catch (err: any) {
      if (!err.message?.includes("already exists")) {
        console.warn(`  Warning: ${err.message}`);
      }
    }
  }

  console.log("SQLite schema created.\n");

  // Migrate each table
  let totalRows = 0;

  for (const tableName of TABLE_ORDER) {
    try {
      // Check if table exists in PostgreSQL
      const tableCheck = await pg`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${tableName}
        ) AS exists
      `;
      if (!tableCheck[0]?.exists) {
        continue;
      }

      // Check if table exists in SQLite
      const sqliteTableCheck = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName);
      if (!sqliteTableCheck) {
        console.log(`  Skipping ${tableName} (not in SQLite schema)`);
        continue;
      }

      // Get all rows from PostgreSQL
      const rows = await pg.unsafe(`SELECT * FROM "${tableName}"`);
      if (rows.length === 0) {
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(rows[0] as object);
      const snakeColumns = columns; // Already snake_case in DB

      // Build INSERT statement
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT OR IGNORE INTO "${tableName}" (${snakeColumns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;

      const insertStmt = sqlite.prepare(insertSql);

      // Bulk insert in a transaction
      const insertMany = sqlite.transaction((rowData: unknown[][]) => {
        for (const row of rowData) {
          insertStmt.run(...row);
        }
      });

      const convertedRows = rows.map((row: any) =>
        columns.map((col) => convertValue(row[col]))
      );

      insertMany(convertedRows);

      totalRows += rows.length;
      console.log(`  ${tableName}: ${rows.length} rows`);
    } catch (err: any) {
      console.error(`  Error migrating ${tableName}: ${err.message}`);
    }
  }

  // Re-enable safety pragmas
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  // Close connections
  sqlite.close();
  await pg.end();

  console.log(`\n=== Migration complete: ${totalRows} total rows ===`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const pgUrlIdx = args.indexOf("--pg-url");
  const sqliteIdx = args.indexOf("--sqlite-path");

  if (pgUrlIdx === -1 || sqliteIdx === -1) {
    console.error("Usage: tsx pg-to-sqlite.ts --pg-url <url> --sqlite-path <path>");
    process.exit(1);
  }

  const pgUrl = args[pgUrlIdx + 1]!;
  const sqlitePath = args[sqliteIdx + 1]!;

  migratePgToSqlite(pgUrl, sqlitePath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
