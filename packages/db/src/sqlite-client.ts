/**
 * SQLite Client — alternative to the PostgreSQL client for local-first Electron usage.
 *
 * Uses better-sqlite3 (synchronous, in-process) via Drizzle ORM.
 * This eliminates the need for a separate PostgreSQL process, providing:
 *   - Instant startup (no database server to wait for)
 *   - Single-file database (easy backup = file copy)
 *   - Zero configuration
 *   - WAL mode for concurrent reads
 *   - ~200MB less memory usage
 *
 * The SQLite schema mirrors the PostgreSQL schema with type conversions:
 *   - uuid → text (store as string)
 *   - jsonb → text (JSON.stringify/parse)
 *   - timestamp with time zone → text (ISO 8601 strings)
 *   - boolean → integer (0/1)
 *   - serial → integer (autoincrement)
 */

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Types for better-sqlite3 (dynamically imported)
type BetterSqlite3Database = any;

export interface SqliteConfig {
  /** Path to the SQLite database file */
  dbPath: string;
  /** Enable WAL mode for better concurrent read performance (default: true) */
  walMode?: boolean;
  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean;
  /** Journal size limit in bytes (default: 64MB) */
  journalSizeLimit?: number;
}

export interface SqliteDb {
  /** The Drizzle ORM instance */
  drizzle: any;
  /** The raw better-sqlite3 database handle */
  raw: BetterSqlite3Database;
  /** Close the database connection */
  close: () => void;
}

/**
 * Create a SQLite database connection with Drizzle ORM.
 */
export async function createSqliteDb(config: SqliteConfig): Promise<SqliteDb> {
  const {
    dbPath,
    walMode = true,
    foreignKeys = true,
    journalSizeLimit = 64 * 1024 * 1024,
  } = config;

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Dynamic imports to avoid bundling issues
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  // Open the database
  const sqlite = new BetterSqlite3(dbPath);

  // Configure pragmas for performance and safety
  if (walMode) {
    sqlite.pragma("journal_mode = WAL");
  }
  if (foreignKeys) {
    sqlite.pragma("foreign_keys = ON");
  }
  sqlite.pragma(`journal_size_limit = ${journalSizeLimit}`);
  sqlite.pragma("synchronous = NORMAL"); // Good balance of speed and safety
  sqlite.pragma("cache_size = -64000"); // 64MB cache
  sqlite.pragma("temp_store = MEMORY");
  sqlite.pragma("mmap_size = 268435456"); // 256MB mmap

  // Import schema dynamically
  const schema = await import("./schema-sqlite/index.js");

  const db = drizzle(sqlite, { schema });

  return {
    drizzle: db,
    raw: sqlite,
    close: () => sqlite.close(),
  };
}

/**
 * Apply SQLite migrations from SQL files.
 * Uses a simple migration table to track applied migrations.
 */
export async function applySqliteMigrations(
  db: SqliteDb,
  migrationsDir: string,
): Promise<{ applied: string[]; skipped: string[] }> {
  const { readdirSync, readFileSync } = await import("node:fs");

  const raw = db.raw;

  // Create migration tracking table
  raw.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Get already applied migrations
  const applied = raw
    .prepare("SELECT name FROM __drizzle_migrations ORDER BY id")
    .all() as Array<{ name: string }>;
  const appliedSet = new Set(applied.map((r) => r.name));

  // Find migration files
  let migrationFiles: string[];
  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql"))
      .sort();
  } catch {
    return { applied: [], skipped: [] };
  }

  const newlyApplied: string[] = [];
  const skipped: string[] = [];

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      skipped.push(file);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    // Apply in a transaction
    const transaction = raw.transaction(() => {
      for (const statement of statements) {
        try {
          raw.exec(statement);
        } catch (err: any) {
          // Skip "already exists" errors for idempotent migrations
          if (
            err.message?.includes("already exists") ||
            err.message?.includes("duplicate column")
          ) {
            continue;
          }
          throw err;
        }
      }
      raw.prepare(
        "INSERT INTO __drizzle_migrations (name) VALUES (?)"
      ).run(file);
    });

    transaction();
    newlyApplied.push(file);
  }

  return { applied: newlyApplied, skipped };
}

/**
 * Backup a SQLite database by copying the file.
 * Uses SQLite's backup API for a consistent snapshot.
 */
export function backupSqliteDb(db: SqliteDb, backupPath: string): void {
  const dir = dirname(backupPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Use SQLite's built-in backup API for consistency
  db.raw.backup(backupPath);
}

/**
 * Simple file copy backup (faster but may be inconsistent if writes are in progress).
 * Safe when WAL mode is enabled and no writes are happening.
 */
export function backupSqliteDbSimple(dbPath: string, backupPath: string): void {
  const dir = dirname(backupPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(dbPath, backupPath);
  // Also copy WAL and SHM if they exist
  if (existsSync(`${dbPath}-wal`)) {
    copyFileSync(`${dbPath}-wal`, `${backupPath}-wal`);
  }
  if (existsSync(`${dbPath}-shm`)) {
    copyFileSync(`${dbPath}-shm`, `${backupPath}-shm`);
  }
}

/**
 * Get the size of a SQLite database in bytes.
 */
export function getSqliteDbSize(dbPath: string): number {
  const { statSync } = require("node:fs");
  try {
    const stat = statSync(dbPath);
    return stat.size;
  } catch {
    return 0;
  }
}
